"""
Create MongoDB indexes at application startup.

Skipped silently for the local-json fallback (which does not understand indexes).

Startup must not wait on this: with MongoDB unreachable, every index used to
wait for its own server-selection timeout (34 x 5 s in production, close to
three minutes) before the app accepted a single request. `ensure_indexes`
now probes the server once and gives up at once if it is not there, and
`ensure_indexes_in_background` retries later without blocking startup.
"""
from __future__ import annotations

import asyncio
import logging

from pymongo.errors import ConnectionFailure

from config import db, DB_BACKEND

logger = logging.getLogger(__name__)


# (collection_name, [ (fields, options) ])
_INDEX_SPEC = {
    "users": [
        ([("email", 1)], {"unique": False, "sparse": True}),
        ([("phone", 1)], {"unique": False, "sparse": True}),
        ([("role", 1)], {}),
        ([("id", 1)], {"unique": True, "sparse": True}),
    ],
    "events": [
        ([("status", 1), ("date", 1)], {}),
        ([("organizer_id", 1)], {}),
        ([("slug", 1)], {"unique": True, "sparse": True}),
        ([("featured", 1)], {}),
        ([("category", 1)], {}),
    ],
    "tickets": [
        ([("user_id", 1)], {}),
        ([("event_id", 1)], {}),
        ([("ticket_code", 1)], {"unique": True, "sparse": True}),
        ([("status", 1)], {}),
        ([("created_at", -1)], {}),
        ([("payment_method", 1)], {}),
    ],
    "scan_logs": [
        # scan_id is the client-generated key that makes a replayed offline sync
        # idempotent: the second insert is rejected rather than double-counted.
        ([("scan_id", 1)], {"unique": True, "sparse": True}),
        ([("event_id", 1), ("scanned_at", -1)], {}),
        ([("ticket_id", 1)], {}),
        ([("device_id", 1)], {}),
    ],
    "bookings": [
        ([("user_id", 1)], {}),
        ([("date", 1)], {}),
        ([("transport_type", 1)], {}),
        ([("status", 1)], {}),
    ],
    "ferry_trips": [
        ([("date", 1)], {}),
        ([("route", 1), ("date", 1)], {}),
    ],
    "train_trips": [
        ([("date", 1)], {}),
        ([("route", 1), ("date", 1)], {}),
    ],
    "staff": [
        ([("event_id", 1)], {}),
        ([("phone", 1)], {"sparse": True}),
        ([("staff_login", 1)], {"unique": True, "sparse": True}),
    ],
    "cart_items": [
        ([("session_id", 1)], {}),
        ([("user_id", 1)], {}),
    ],
    "testimonials": [
        ([("approved", 1)], {}),
    ],
    "news": [
        ([("published", 1), ("created_at", -1)], {}),
    ],
}


async def ensure_indexes() -> bool:
    """Create all collection indexes. Idempotent.

    Returns True when the database answered (even if a single index failed),
    False when it could not be reached, so the caller can retry later.
    """
    if DB_BACKEND != "mongo":
        logger.info("Skipping index creation - running on local-json backend")
        return True

    # One probe instead of one timeout per index.
    try:
        await db.command("ping")
    except ConnectionFailure as exc:
        logger.warning("MongoDB unreachable, indexes not ensured: %s", exc)
        return False

    created = 0
    for collection_name, specs in _INDEX_SPEC.items():
        collection = db[collection_name]
        for fields, options in specs:
            try:
                await collection.create_index(fields, **options)
                created += 1
            except ConnectionFailure as exc:
                # The server went away mid-run: stop, the next attempt redoes
                # everything (create_index is idempotent).
                logger.warning("MongoDB lost while creating indexes: %s", exc)
                return False
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Could not create index %s on %s: %s",
                    fields, collection_name, exc,
                )

    logger.info("MongoDB indexes ensured (%d total)", created)
    return True


# Delays between attempts when MongoDB is unreachable, in seconds.
RETRY_DELAYS = (15, 30, 60, 120, 300)


async def ensure_indexes_in_background(delays=RETRY_DELAYS) -> bool:
    """Run `ensure_indexes`, retrying with backoff while MongoDB is unreachable.

    Meant to be scheduled with `asyncio.create_task` at startup, so the app
    serves requests (static pages, health checks) while the database warms up.
    """
    for attempt, delay in enumerate((0, *delays)):
        if delay:
            await asyncio.sleep(delay)
        try:
            if await ensure_indexes():
                return True
        except Exception:  # noqa: BLE001
            logger.exception("Unexpected error while ensuring indexes")
        logger.info("Index creation attempt %d failed", attempt + 1)

    logger.error(
        "MongoDB indexes still not ensured after %d attempts; they will be "
        "created on the next restart.",
        len(delays) + 1,
    )
    return False
