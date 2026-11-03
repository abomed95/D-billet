"""
Tests for the atomic seat inventory (services/inventory.py).

Self-contained: no server, no MongoDB. Uses the local JSON backend, which is
why services/inventory.py addresses array elements by index instead of the
positional `$` operator. Run with:

    pytest backend/tests/test_inventory.py -v

A real MongoDB concurrency check lives in test_inventory_mongo.py.
"""
import asyncio
import os
import sys
import tempfile

import pytest

os.environ.setdefault("APP_ENV", "development")
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import config  # noqa: E402
from localdb import LocalAsyncDatabase  # noqa: E402
import services.inventory as inventory  # noqa: E402


def _fresh_db():
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    db = LocalAsyncDatabase(tmp.name)
    config.db = db
    inventory.db = db
    return db


async def _seed(db, *, quantity=10, sold=0, include_sold=True):
    standard = {"id": "t1", "name": "Std", "price": 1000, "quantity": quantity}
    if include_sold:
        standard["sold"] = sold
    await db.events.insert_one({
        "id": "e1",
        "title": "Show",
        # A second type before the first guards against index confusion.
        "ticket_types": [
            {"id": "t0", "name": "Other", "price": 500, "quantity": 5, "sold": 0},
            standard,
        ],
    })


async def _sold(db, ticket_type_id="t1"):
    event = await db.events.find_one({"id": "e1"}, {"_id": 0})
    for ticket_type in event["ticket_types"]:
        if ticket_type["id"] == ticket_type_id:
            return ticket_type.get("sold", 0)
    raise AssertionError("ticket type not found")


def test_reserve_within_capacity():
    async def run():
        db = _fresh_db()
        await _seed(db, quantity=10)
        assert await inventory.reserve_event_seats("e1", "t1", 4) is True
        assert await _sold(db) == 4
        # The neighbouring type must not move.
        assert await _sold(db, "t0") == 0
    asyncio.run(run())


def test_reserve_exactly_the_last_seats():
    async def run():
        db = _fresh_db()
        await _seed(db, quantity=10, sold=7)
        assert await inventory.reserve_event_seats("e1", "t1", 3) is True
        assert await _sold(db) == 10
    asyncio.run(run())


def test_reserve_beyond_capacity_is_refused_and_writes_nothing():
    async def run():
        db = _fresh_db()
        await _seed(db, quantity=10, sold=8)
        assert await inventory.reserve_event_seats("e1", "t1", 3) is False
        assert await _sold(db) == 8
    asyncio.run(run())


def test_reserve_more_than_total_capacity_is_refused():
    async def run():
        db = _fresh_db()
        await _seed(db, quantity=2)
        assert await inventory.reserve_event_seats("e1", "t1", 5) is False
        assert await _sold(db) == 0
    asyncio.run(run())


def test_reserve_on_legacy_document_without_sold_field():
    async def run():
        db = _fresh_db()
        await _seed(db, quantity=10, include_sold=False)
        assert await inventory.reserve_event_seats("e1", "t1", 6) is True
        assert await _sold(db) == 6
    asyncio.run(run())


def test_unknown_event_or_ticket_type_is_refused():
    async def run():
        db = _fresh_db()
        await _seed(db)
        assert await inventory.reserve_event_seats("nope", "t1", 1) is False
        assert await inventory.reserve_event_seats("e1", "nope", 1) is False
    asyncio.run(run())


def test_zero_quantity_is_a_no_op():
    async def run():
        db = _fresh_db()
        await _seed(db, quantity=10, sold=3)
        assert await inventory.reserve_event_seats("e1", "t1", 0) is True
        assert await _sold(db) == 3
    asyncio.run(run())


def test_release_gives_seats_back():
    async def run():
        db = _fresh_db()
        await _seed(db, quantity=10, sold=6)
        await inventory.release_event_seats("e1", "t1", 4)
        assert await _sold(db) == 2
    asyncio.run(run())


def test_release_never_goes_negative():
    async def run():
        db = _fresh_db()
        await _seed(db, quantity=10, sold=2)
        # Releasing more than is held clamps instead of leaving a negative count.
        await inventory.release_event_seats("e1", "t1", 5)
        assert await _sold(db) == 0
    asyncio.run(run())


def test_reserve_then_release_round_trip():
    async def run():
        db = _fresh_db()
        await _seed(db, quantity=10)
        assert await inventory.reserve_event_seats("e1", "t1", 10) is True
        assert await inventory.reserve_event_seats("e1", "t1", 1) is False
        await inventory.release_event_seats("e1", "t1", 10)
        assert await _sold(db) == 0
        assert await inventory.reserve_event_seats("e1", "t1", 1) is True
    asyncio.run(run())


def test_interleaved_reservations_never_oversell():
    """
    The bug this replaces: two checkouts read the same `sold`, each wrote back
    its own increment, and one was lost. Here twenty single-seat reservations
    race for ten seats and exactly ten may win.
    """
    async def run():
        db = _fresh_db()
        await _seed(db, quantity=10)
        results = await asyncio.gather(
            *(inventory.reserve_event_seats("e1", "t1", 1) for _ in range(20))
        )
        assert sum(results) == 10, f"{sum(results)} reservations accepted for 10 seats"
        assert await _sold(db) == 10
    asyncio.run(run())


def test_interleaved_reservations_of_several_seats():
    async def run():
        db = _fresh_db()
        await _seed(db, quantity=10)
        # Four buyers want three seats each: only three can be served.
        results = await asyncio.gather(
            *(inventory.reserve_event_seats("e1", "t1", 3) for _ in range(4))
        )
        assert sum(results) == 3
        assert await _sold(db) == 9
    asyncio.run(run())
