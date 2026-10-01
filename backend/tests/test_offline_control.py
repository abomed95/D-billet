"""
Tests for offline ticket control (manifest + idempotent batch sync).

Self-contained: no server, no MongoDB. Run with:

    pytest backend/tests/test_offline_control.py -v
"""
import asyncio
import os
import sys
import tempfile
import uuid

import pytest

os.environ.setdefault("APP_ENV", "development")
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import config  # noqa: E402
from localdb import LocalAsyncDatabase  # noqa: E402
import routes.staff as staff_routes  # noqa: E402
from models import OfflineScan, BatchScanRequest  # noqa: E402

STAFF = {"id": "s1", "full_name": "Agent Un", "assigned_events": ["e1"]}
OTHER_STAFF = {"id": "s2", "full_name": "Agent Deux", "assigned_events": ["e1"]}


def _fresh_db():
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    db = LocalAsyncDatabase(tmp.name)
    config.db = db
    staff_routes.db = db
    return db


async def _seed(db):
    await db.events.insert_one({"id": "e1", "title": "Show", "date": "2026-11-02"})
    for i in (1, 2, 3):
        await db.tickets.insert_one({
            "id": f"t{i}", "event_id": "e1", "event_title": "Show",
            "event_date": "2026-11-02", "ticket_type": "Std", "status": "valid",
            "passenger_name": f"Passager {i}",
        })
    # One cancelled and one for another event, to check they are filtered out.
    await db.tickets.insert_one({
        "id": "t-cancelled", "event_id": "e1", "event_title": "Show",
        "event_date": "2026-11-02", "ticket_type": "Std", "status": "cancelled"})
    await db.tickets.insert_one({
        "id": "t-other", "event_id": "e2", "event_title": "Autre",
        "event_date": "2026-11-02", "ticket_type": "Std", "status": "valid"})


def _scan(ticket_id, device="device-A", scan_id=None):
    return OfflineScan(
        scan_id=scan_id or str(uuid.uuid4()),
        ticket_id=ticket_id,
        event_id="e1",
        scanned_at="2026-11-02T18:30:00+00:00",
        device_id=device,
    )


async def _sync(scans, staff=STAFF):
    return await staff_routes.staff_scans_batch(BatchScanRequest(scans=scans), staff=staff)


def _status(result, ticket_id):
    return next(r["status"] for r in result["results"] if r["ticket_id"] == ticket_id)


# ------------------------------------------------------------------ manifest

def test_manifest_lists_only_this_event_and_usable_tickets():
    async def run():
        db = _fresh_db()
        await _seed(db)
        manifest = await staff_routes.staff_manifest("e1", staff=STAFF)
        ids = {t["ticket_id"] for t in manifest["tickets"]}
        assert ids == {"t1", "t2", "t3"}
        assert manifest["count"] == 3
        assert manifest["event_title"] == "Show"
        assert manifest["generated_at"]
    asyncio.run(run())


def test_manifest_reports_already_used_tickets():
    async def run():
        db = _fresh_db()
        await _seed(db)
        await db.tickets.update_one({"id": "t2"}, {"$set": {"status": "used"}})
        manifest = await staff_routes.staff_manifest("e1", staff=STAFF)
        statuses = {t["ticket_id"]: t["status"] for t in manifest["tickets"]}
        assert statuses["t2"] == "used", "a device must know what was already scanned"
        assert statuses["t1"] == "valid"
    asyncio.run(run())


def test_manifest_carries_holder_names_only_when_the_ticket_has_one():
    async def run():
        db = _fresh_db()
        await _seed(db)
        await db.tickets.insert_one({
            "id": "t-noname", "event_id": "e1", "event_title": "Show",
            "event_date": "2026-11-02", "ticket_type": "VIP", "status": "valid"})
        manifest = await staff_routes.staff_manifest("e1", staff=STAFF)
        by_id = {t["ticket_id"]: t for t in manifest["tickets"]}
        assert by_id["t1"]["holder"] == "Passager 1"
        assert "holder" not in by_id["t-noname"]
    asyncio.run(run())


def test_manifest_refuses_an_unassigned_event():
    async def run():
        db = _fresh_db()
        await _seed(db)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as err:
            await staff_routes.staff_manifest("e2", staff=STAFF)
        assert err.value.status_code == 403
    asyncio.run(run())


# ------------------------------------------------------------- batch sync

def test_sync_records_a_valid_offline_scan():
    async def run():
        db = _fresh_db()
        await _seed(db)
        result = await _sync([_scan("t1")])
        assert _status(result, "t1") == "recorded"
        ticket = await db.tickets.find_one({"id": "t1"}, {"_id": 0})
        assert ticket["status"] == "used"
        # The device clock is kept, not the sync time.
        assert ticket["scanned_at"] == "2026-11-02T18:30:00+00:00"
        assert ticket["scanned_by_device"] == "device-A"
    asyncio.run(run())


def test_replaying_the_same_queue_changes_nothing():
    async def run():
        db = _fresh_db()
        await _seed(db)
        scan = _scan("t1")
        first = await _sync([scan])
        second = await _sync([scan])
        assert _status(first, "t1") == "recorded"
        assert _status(second, "t1") == "duplicate"
        logs = await db.scan_logs.find({"ticket_id": "t1"}, {"_id": 0}).to_list(10)
        assert len(logs) == 1, "a replayed sync must not double-count"
    asyncio.run(run())


def test_same_ticket_on_two_devices_is_reported_as_a_conflict():
    async def run():
        db = _fresh_db()
        await _seed(db)
        await _sync([_scan("t1", device="device-A")])
        result = await _sync([_scan("t1", device="device-B")], staff=OTHER_STAFF)
        entry = result["results"][0]
        assert entry["status"] == "conflict"
        assert entry["first_device"] == "device-A"
        assert entry["first_scanned_by"] == "Agent Un"
        assert result["counts"]["conflict"] == 1
    asyncio.run(run())


def test_same_device_rescanning_is_a_duplicate_not_a_conflict():
    async def run():
        db = _fresh_db()
        await _seed(db)
        await _sync([_scan("t1", device="device-A")])
        # A different scan_id, same device: the queue held the ticket twice.
        result = await _sync([_scan("t1", device="device-A")])
        assert result["results"][0]["status"] == "duplicate"
        assert "conflict" not in result["counts"]
    asyncio.run(run())


def test_cancelled_unknown_and_foreign_tickets_are_refused():
    async def run():
        db = _fresh_db()
        await _seed(db)
        result = await _sync([
            _scan("t-cancelled"),
            _scan("nope"),
            _scan("t-other"),
        ])
        assert _status(result, "t-cancelled") == "invalid"
        assert _status(result, "nope") == "not_found"
        assert _status(result, "t-other") == "wrong_event"
        # None of them may be marked used.
        other = await db.tickets.find_one({"id": "t-other"}, {"_id": 0})
        assert other["status"] == "valid"
    asyncio.run(run())


def test_scan_for_an_unassigned_event_is_refused_without_touching_the_ticket():
    async def run():
        db = _fresh_db()
        await _seed(db)
        scan = _scan("t1")
        scan.event_id = "e9"
        result = await _sync([scan])
        assert result["results"][0]["status"] == "forbidden"
        ticket = await db.tickets.find_one({"id": "t1"}, {"_id": 0})
        assert ticket["status"] == "valid"
    asyncio.run(run())


def test_a_mixed_queue_is_counted_per_outcome():
    async def run():
        db = _fresh_db()
        await _seed(db)
        result = await _sync([_scan("t1"), _scan("t2"), _scan("nope")])
        assert result["synced"] == 3
        assert result["counts"]["recorded"] == 2
        assert result["counts"]["not_found"] == 1
    asyncio.run(run())
