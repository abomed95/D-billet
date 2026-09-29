"""
Atomic seat inventory for event ticket types.

The checkout used to read the stock, decide in Python, then write the whole
`ticket_types` array back with `$set`. Two simultaneous purchases could both
read the same `sold` value and each overwrite the other's increment: the event
oversold and the counter drifted.

Both helpers below do the decision and the write in a single document update.
MongoDB applies one document update atomically, so a concurrent checkout either
sees the seats already taken or takes them itself - never both.

The array element is addressed by its index (`ticket_types.2.sold`) rather than
the positional `$` operator, so the same statement works on the local JSON
backend used in development. The filter also pins the element's `id`, so a
ticket type reordered between the read and the write can never be decremented
by mistake.
"""
from __future__ import annotations

import logging

from config import db

logger = logging.getLogger(__name__)


async def _locate_ticket_type(event_id: str, ticket_type_id: str):
    """Return (index, ticket_type) for `ticket_type_id`, or (None, None)."""
    event = await db.events.find_one({"id": event_id}, {"_id": 0, "ticket_types": 1})
    if not event:
        return None, None
    for index, ticket_type in enumerate(event.get("ticket_types") or []):
        if ticket_type.get("id") == ticket_type_id:
            return index, ticket_type
    return None, None


async def reserve_event_seats(event_id: str, ticket_type_id: str, quantity: int) -> bool:
    """
    Take `quantity` seats from a ticket type.

    Returns True when the seats were reserved, False when the ticket type is
    gone or does not have enough left. Callers must treat False as a hard stop:
    nothing was written.
    """
    if quantity <= 0:
        return True

    index, ticket_type = await _locate_ticket_type(event_id, ticket_type_id)
    if index is None:
        return False

    capacity = int(ticket_type.get("quantity", 0) or 0)
    # Highest `sold` value that still leaves room for this purchase.
    ceiling = capacity - quantity
    if ceiling < 0:
        return False

    sold_field = f"ticket_types.{index}.sold"
    result = await db.events.update_one(
        {
            "id": event_id,
            f"ticket_types.{index}.id": ticket_type_id,
            # Tickets created before `sold` existed have no such field.
            "$or": [
                {sold_field: {"$lte": ceiling}},
                {sold_field: {"$exists": False}},
            ],
        },
        {"$inc": {sold_field: quantity}},
    )
    return result.matched_count == 1


async def release_event_seats(event_id: str, ticket_type_id: str, quantity: int) -> None:
    """
    Give seats back after a payment failed, expired or was cancelled.

    The decrement is guarded so a replayed release cannot drive `sold` below
    zero; if the guard rejects it, the counter is clamped instead.
    """
    if quantity <= 0:
        return

    index, _ = await _locate_ticket_type(event_id, ticket_type_id)
    if index is None:
        return

    sold_field = f"ticket_types.{index}.sold"
    result = await db.events.update_one(
        {
            "id": event_id,
            f"ticket_types.{index}.id": ticket_type_id,
            sold_field: {"$gte": quantity},
        },
        {"$inc": {sold_field: -quantity}},
    )
    if result.matched_count == 1:
        return

    # Fewer seats were held than we are releasing: the counter is already off,
    # so clamp rather than leave a negative value behind.
    logger.warning(
        "Releasing %s seats on event %s ticket type %s exceeded the recorded "
        "count; clamping to zero",
        quantity,
        event_id,
        ticket_type_id,
    )
    await db.events.update_one(
        {"id": event_id, f"ticket_types.{index}.id": ticket_type_id},
        {"$set": {sold_field: 0}},
    )
