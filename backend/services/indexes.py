"""
Create MongoDB indexes at application startup.

Skipped silently for the local-json fallback (which does not understand indexes).
"""
from __future__ import annotations

import logging

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


async def ensure_indexes() -> None:
    """Create all collection indexes. Idempotent."""
    if DB_BACKEND != "mongo":
        logger.info("Skipping index creation - running on local-json backend")
        return

    created = 0
    for collection_name, specs in _INDEX_SPEC.items():
        collection = db[collection_name]
        for fields, options in specs:
            try:
                await collection.create_index(fields, **options)
                created += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Could not create index %s on %s: %s",
                    fields, collection_name, exc,
                )

    logger.info("MongoDB indexes ensured (%d total)", created)
