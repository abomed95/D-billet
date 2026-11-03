"""
Concurrency test for the seat inventory against a real MongoDB.

The local JSON backend serialises everything behind a lock, so it can only
prove the filter logic is right. Overselling is a concurrency bug, so it has to
be checked where the concurrency is real: this fires many simultaneous
reservations at one ticket type and asserts that capacity is never exceeded.

Skipped unless a MongoDB is reachable. Run with:

    MONGO_TEST_URL=mongodb://127.0.0.1:27017 pytest backend/tests/test_inventory_mongo.py -v
"""
import asyncio
import os
import sys
import uuid

import pytest

os.environ.setdefault("APP_ENV", "development")
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

MONGO_TEST_URL = os.environ.get("MONGO_TEST_URL", "").strip()

pytestmark = pytest.mark.skipif(
    not MONGO_TEST_URL,
    reason="set MONGO_TEST_URL to run the MongoDB concurrency test",
)


async def _with_mongo(body):
    from motor.motor_asyncio import AsyncIOMotorClient

    import config
    import services.inventory as inventory

    client = AsyncIOMotorClient(MONGO_TEST_URL, serverSelectionTimeoutMS=5000)
    db_name = f"dbillet_test_{uuid.uuid4().hex[:8]}"
    db = client[db_name]
    previous = config.db, inventory.db
    config.db, inventory.db = db, db
    try:
        return await body(db, inventory)
    finally:
        config.db, inventory.db = previous
        await client.drop_database(db_name)
        client.close()


async def _seed(db, quantity):
    await db.events.insert_one({
        "id": "e1",
        "title": "Show",
        "ticket_types": [
            {"id": "t0", "name": "Other", "price": 500, "quantity": 5, "sold": 0},
            {"id": "t1", "name": "Std", "price": 1000, "quantity": quantity, "sold": 0},
        ],
    })


async def _sold(db, ticket_type_id="t1"):
    event = await db.events.find_one({"id": "e1"}, {"_id": 0})
    return next(t.get("sold", 0) for t in event["ticket_types"] if t["id"] == ticket_type_id)


def test_simultaneous_single_seat_reservations_never_oversell():
    async def body(db, inventory):
        await _seed(db, quantity=25)
        results = await asyncio.gather(
            *(inventory.reserve_event_seats("e1", "t1", 1) for _ in range(100))
        )
        accepted, sold = sum(results), await _sold(db)
        assert accepted == 25, f"{accepted} reservations accepted for 25 seats"
        assert sold == 25, f"counter drifted to {sold}"
        assert await _sold(db, "t0") == 0
    asyncio.run(_with_mongo(body))


def test_simultaneous_multi_seat_reservations_never_oversell():
    async def body(db, inventory):
        await _seed(db, quantity=30)
        # Twenty buyers want four seats each: at most seven can be served, and
        # the counter must land on a multiple of four.
        results = await asyncio.gather(
            *(inventory.reserve_event_seats("e1", "t1", 4) for _ in range(20))
        )
        accepted, sold = sum(results), await _sold(db)
        assert accepted == 7, f"{accepted} reservations accepted"
        assert sold == 28, f"counter landed on {sold}"
    asyncio.run(_with_mongo(body))


def test_simultaneous_reserve_and_release_keep_the_counter_exact():
    async def body(db, inventory):
        await _seed(db, quantity=50)
        assert await inventory.reserve_event_seats("e1", "t1", 20) is True

        # Reservations and releases interleaved: the counter must end at the
        # arithmetic result, with nothing lost to a read-modify-write race.
        await asyncio.gather(
            *([inventory.reserve_event_seats("e1", "t1", 1) for _ in range(10)]
              + [inventory.release_event_seats("e1", "t1", 1) for _ in range(10)])
        )
        assert await _sold(db) == 20
    asyncio.run(_with_mongo(body))
