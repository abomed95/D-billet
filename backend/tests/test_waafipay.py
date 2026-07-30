"""
Self-contained unit tests for the WaafiPay payment integration.

These tests use the local JSON database backend and a fully mocked WaafiPay
network layer, so they run without a live server and never touch the real
gateway (no accidental charges). Run with:

    pytest backend/tests/test_waafipay.py -v
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


def _fresh_db():
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    return LocalAsyncDatabase(tmp.name)


def _rebind_db(db):
    """Point config and the modules that captured `db` at import time to `db`."""
    import services.payments as payments_service
    import routes.cart as cart
    import routes.tickets as tickets_routes
    config.db = db
    payments_service.db = db
    cart.db = db
    tickets_routes.db = db


def _set_creds(*, api: bool, hpp: bool):
    config.WAAFIPAY_MERCHANT_UID = "M-TEST"
    config.WAAFIPAY_API_USER_ID = "API-USER" if api else ""
    config.WAAFIPAY_API_KEY = "API-KEY" if api else ""
    config.WAAFIPAY_STORE_ID = "STORE" if hpp else ""
    config.WAAFIPAY_HPP_KEY = "HPP-KEY" if hpp else ""


async def _seed(db):
    user = {"id": "u1", "phone": "+25377112233", "full_name": "Test"}
    await db.users.insert_one(user)
    await db.events.insert_one({
        "id": "e1", "title": "Show", "date": "2026-08-01", "time": "20:00",
        "venue": "V", "organizer_id": "o1",
        "ticket_types": [{"id": "t1", "name": "Std", "price": 1000,
                          "quantity": 100, "sold": 0, "max_per_order": 10}],
    })
    return user


async def _sold(db):
    e = await db.events.find_one({"id": "e1"})
    return e["ticket_types"][0]["sold"]


def _guard_no_network():
    """Make any un-mocked WaafiPay HTTP call fail loudly instead of hitting the net."""
    import services.waafipay as waafipay

    async def _boom(*a, **k):
        raise AssertionError("Unexpected real WaafiPay network call in a unit test")

    waafipay._post = _boom


# --------------------------------------------------------------------------- #
# msisdn normalization
# --------------------------------------------------------------------------- #

def test_normalize_msisdn():
    import services.waafipay as waafipay
    assert waafipay.normalize_msisdn("77112233") == "25377112233"
    assert waafipay.normalize_msisdn("+253 77 11 22 33") == "25377112233"
    assert waafipay.normalize_msisdn("0025377112233") == "25377112233"
    assert waafipay.normalize_msisdn("25377112233") == "25377112233"


# --------------------------------------------------------------------------- #
# Direct wallet debit (API_PURCHASE)
# --------------------------------------------------------------------------- #

def test_wallet_debit_approved(monkeypatch):
    import services.waafipay as waafipay
    import routes.cart as cart
    from models import CheckoutRequest

    db = _fresh_db()
    _rebind_db(db)
    _set_creds(api=True, hpp=False)
    _guard_no_network()

    async def fake_api_purchase(**kwargs):
        assert kwargs["account_no"], "a Waafi number must be provided"
        return {"approved": True, "state": "APPROVED", "response_code": "2001",
                "message": "RCS_SUCCESS", "transaction_id": "TX-1", "raw": {}}
    monkeypatch.setattr(waafipay, "api_purchase", fake_api_purchase)

    async def scenario():
        user = await _seed(db)
        await db.carts.insert_one({"user_id": "u1", "items": [
            {"event_id": "e1", "ticket_type_id": "t1", "quantity": 2}]})
        resp = await cart.checkout(
            CheckoutRequest(payment_method="waafi", payer_phone="77112233"), user)
        assert resp["paid"] is True and resp["requires_payment"] is False
        assert resp["transaction_id"] == "TX-1"
        ticket = await db.tickets.find_one({"id": resp["tickets"][0]["id"]})
        assert ticket["status"] == "valid" and ticket["payment_status"] == "paid"
        assert await _sold(db) == 2
        assert await db.carts.find_one({"user_id": "u1"}) is None

    asyncio.run(scenario())


def test_wallet_debit_declined_rolls_back(monkeypatch):
    import services.waafipay as waafipay
    import routes.cart as cart
    from fastapi import HTTPException
    from models import CheckoutRequest

    db = _fresh_db()
    _rebind_db(db)
    _set_creds(api=True, hpp=False)
    _guard_no_network()

    async def fake_api_purchase(**kwargs):
        return {"approved": False, "state": "DECLINED", "response_code": "5310",
                "message": "Insufficient balance", "transaction_id": None, "raw": {}}
    monkeypatch.setattr(waafipay, "api_purchase", fake_api_purchase)

    async def scenario():
        user = await _seed(db)
        await db.carts.insert_one({"user_id": "u1", "items": [
            {"event_id": "e1", "ticket_type_id": "t1", "quantity": 3}]})
        with pytest.raises(HTTPException) as exc:
            await cart.checkout(
                CheckoutRequest(payment_method="waafi", payer_phone="77112233"), user)
        assert exc.value.status_code == 402
        # inventory released, no tickets left valid
        assert await _sold(db) == 0
        remaining = await db.tickets.find({"status": "valid"}).to_list(100)
        assert remaining == []

    asyncio.run(scenario())


def test_wallet_requires_phone(monkeypatch):
    import routes.cart as cart
    from fastapi import HTTPException
    from models import CheckoutRequest

    db = _fresh_db()
    _rebind_db(db)
    _set_creds(api=True, hpp=False)
    _guard_no_network()

    async def scenario():
        user = {"id": "u1", "full_name": "No Phone"}  # no phone on file
        await db.users.insert_one(user)
        await db.events.insert_one({
            "id": "e1", "title": "Show", "date": "2026-08-01", "time": "20:00",
            "venue": "V", "organizer_id": "o1",
            "ticket_types": [{"id": "t1", "name": "Std", "price": 1000,
                              "quantity": 100, "sold": 0, "max_per_order": 10}]})
        await db.carts.insert_one({"user_id": "u1", "items": [
            {"event_id": "e1", "ticket_type_id": "t1", "quantity": 1}]})
        with pytest.raises(HTTPException) as exc:
            await cart.checkout(CheckoutRequest(payment_method="waafi"), user)
        assert exc.value.status_code == 400

    asyncio.run(scenario())


# --------------------------------------------------------------------------- #
# Only WaafiPay is available (D-Money / CAC Pay disabled)
# --------------------------------------------------------------------------- #

def test_other_methods_rejected_when_gateway_live(monkeypatch):
    import routes.cart as cart
    from fastapi import HTTPException
    from models import CheckoutRequest

    db = _fresh_db()
    _rebind_db(db)
    _set_creds(api=True, hpp=False)
    _guard_no_network()

    async def scenario():
        user = await _seed(db)
        await db.carts.insert_one({"user_id": "u1", "items": [
            {"event_id": "e1", "ticket_type_id": "t1", "quantity": 1}]})
        with pytest.raises(HTTPException) as exc:
            await cart.checkout(CheckoutRequest(payment_method="dmoney"), user)
        assert exc.value.status_code == 400
        assert await _sold(db) == 0  # nothing reserved

    asyncio.run(scenario())


# --------------------------------------------------------------------------- #
# HPP redirect fallback (only HPP creds configured)
# --------------------------------------------------------------------------- #

def test_hpp_redirect_fallback(monkeypatch):
    import services.waafipay as waafipay
    import routes.cart as cart
    from models import CheckoutRequest

    db = _fresh_db()
    _rebind_db(db)
    _set_creds(api=False, hpp=True)
    _guard_no_network()

    async def fake_create_hpp(**kwargs):
        return {"hpp_url": "https://pg.waafipay.net/hpp/token/xyz",
                "order_id": "ORD-1", "reference_id": kwargs["reference_id"], "raw": {}}
    monkeypatch.setattr(waafipay, "create_hpp_purchase", fake_create_hpp)

    async def scenario():
        user = await _seed(db)
        await db.carts.insert_one({"user_id": "u1", "items": [
            {"event_id": "e1", "ticket_type_id": "t1", "quantity": 1}]})
        resp = await cart.checkout(CheckoutRequest(payment_method="waafi"), user)
        assert resp["requires_payment"] is True
        assert resp["payment_url"].startswith("https://pg.waafipay.net/")
        # reserved but not yet paid
        ticket = await db.tickets.find_one({"id": resp["tickets"][0]["id"]})
        assert ticket["status"] == "pending"

    asyncio.run(scenario())


# --------------------------------------------------------------------------- #
# Scanner must reject unpaid / cancelled tickets
# --------------------------------------------------------------------------- #

def test_scanner_rejects_pending_ticket(monkeypatch):
    import routes.tickets as tickets_routes

    db = _fresh_db()
    _rebind_db(db)
    _guard_no_network()

    async def scenario():
        await db.tickets.insert_one({
            "id": "tk1", "event_id": "e1", "event_title": "Show",
            "status": "pending", "payment_status": "pending",
            "qr_code_data": "DBILLET-tk1", "ticket_type": "Std", "price": 1000})
        res = await tickets_routes.scanner_validate_ticket(qr_data="DBILLET-tk1")
        assert res["valid"] is False and res["status"] == "pending"

    asyncio.run(scenario())


# --------------------------------------------------------------------------- #
# Admin revenue totals must exclude unpaid (pending) / cancelled tickets
# --------------------------------------------------------------------------- #

def test_admin_transactions_only_counts_paid():
    import routes.admin as admin_routes
    from datetime import datetime, timezone

    db = _fresh_db()
    admin_routes.db = db
    now = datetime.now(timezone.utc).isoformat()

    async def scenario():
        await db.tickets.insert_one({"id": "a", "payment_method": "waafi", "price": 1000,
                                     "status": "valid", "created_at": now})
        await db.tickets.insert_one({"id": "b", "payment_method": "waafi", "price": 1000,
                                     "status": "pending", "created_at": now})
        await db.tickets.insert_one({"id": "c", "payment_method": "waafi", "price": 1000,
                                     "status": "cancelled", "created_at": now})
        res = await admin_routes.get_transactions(admin={"id": "adm"}, payment_method=None, days=30)
        # Only the one "valid" ticket is real revenue.
        assert res["total_amount"] == 1000
        assert res["total_count"] == 1
        assert res["summary"]["waafi"]["total"] == 1000
        assert res["pending_count"] == 1

    asyncio.run(scenario())
