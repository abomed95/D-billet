"""
Payment orchestration for D-Billet.

Handles the WaafiPay Hosted Payment Page redirect flow on top of the existing
checkout / ferry / train booking endpoints:

  1. The booking endpoint reserves the tickets in a "pending" state and calls
     ``start_waafi_payment`` which creates the HPP session and returns a
     redirect URL.
  2. The customer pays on WaafiPay's hosted page and is redirected back to
     ``/api/payments/waafi/return/{reference_id}``.
  3. ``resolve_waafi_payment`` verifies the outcome server-side via
     HPP_GETTRANINFO (the source of truth) and either confirms the tickets
     ("valid"/"paid") or releases the reserved inventory ("cancelled").

Everything is idempotent so a callback + a manual verify cannot double-apply.
"""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from config import db, APP_URL, WAAFIPAY_CURRENCY
from services import waafipay

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _reference_id() -> str:
    # Alphanumeric + dashes only, well under WaafiPay's 50-char limit.
    return f"DBILLET-{uuid.uuid4().hex[:20]}"


async def start_waafi_payment(
    *,
    user: dict,
    source: str,
    amount: int,
    ticket_ids: list,
    description: str,
    currency: str = None,
    vehicle_ids: list = None,
    promo_code: str = None,
    sold_adjustments: list = None,
    clear_cart: bool = False,
) -> dict:
    """
    Create a WaafiPay HPP session for an already-reserved (pending) order and
    persist a payment record. Returns the payload the frontend needs to redirect.
    """
    reference_id = _reference_id()
    currency = currency or WAAFIPAY_CURRENCY
    success_url = f"{APP_URL}/api/payments/waafi/return/{reference_id}?outcome=success"
    failure_url = f"{APP_URL}/api/payments/waafi/return/{reference_id}?outcome=failure"

    try:
        purchase = await waafipay.create_hpp_purchase(
            reference_id=reference_id,
            amount=amount,
            description=description,
            success_url=success_url,
            failure_url=failure_url,
            currency=currency,
            payer_phone=user.get("phone"),
        )
    except waafipay.WaafiPayError as exc:
        # Payment could not be created: release the seats we just reserved so
        # nothing stays blocked, and surface a clean error to the client.
        await _rollback_reservation(ticket_ids, vehicle_ids, sold_adjustments)
        logger.error("WaafiPay initiation failed (source=%s, user=%s): %s", source, user.get("id"), exc)
        raise HTTPException(
            status_code=502,
            detail="Le paiement WaafiPay est momentanement indisponible. Merci de reessayer dans un instant.",
        ) from exc

    now = _now()
    payment_doc = {
        "id": str(uuid.uuid4()),
        "reference_id": reference_id,
        "order_id": purchase.get("order_id"),
        "provider": "waafipay",
        "payment_method": "waafi",
        "user_id": user["id"],
        "source": source,
        "amount": amount,
        "currency": currency,
        "status": "pending",
        "ticket_ids": ticket_ids or [],
        "vehicle_ids": vehicle_ids or [],
        "promo_code": promo_code,
        "sold_adjustments": sold_adjustments or [],
        "clear_cart": bool(clear_cart),
        "hpp_url": purchase.get("hpp_url"),
        "created_at": now,
        "updated_at": now,
    }
    await db.payments.insert_one(payment_doc)

    logger.info(
        "WaafiPay payment initiated (ref=%s, source=%s, amount=%s %s, user=%s)",
        reference_id, source, amount, currency, user["id"],
    )

    return {
        "requires_payment": True,
        "provider": "waafipay",
        "payment_url": purchase.get("hpp_url"),
        "reference_id": reference_id,
        "amount": amount,
        "currency": currency,
    }


async def pay_with_waafi_wallet(
    *,
    user: dict,
    source: str,
    amount: int,
    ticket_ids: list,
    description: str,
    account_no: str,
    currency: str = None,
    vehicle_ids: list = None,
    promo_code: str = None,
    sold_adjustments: list = None,
    clear_cart: bool = False,
) -> dict:
    """
    Directly debit the customer's Waafi wallet (synchronous). The customer
    approves on their phone; on approval the reserved tickets are confirmed,
    otherwise the reservation is rolled back and an error is raised.
    """
    reference_id = _reference_id()
    currency = currency or WAAFIPAY_CURRENCY

    try:
        result = await waafipay.api_purchase(
            reference_id=reference_id,
            amount=amount,
            account_no=account_no,
            description=description,
            currency=currency,
        )
    except waafipay.WaafiPayError as exc:
        await _rollback_reservation(ticket_ids, vehicle_ids, sold_adjustments)
        logger.error("WaafiPay wallet debit failed (source=%s, user=%s): %s", source, user.get("id"), exc)
        raise HTTPException(
            status_code=502,
            detail="Le paiement WaafiPay est momentanement indisponible. Merci de reessayer dans un instant.",
        ) from exc

    now = _now()
    payment_doc = {
        "id": str(uuid.uuid4()),
        "reference_id": reference_id,
        "provider": "waafipay",
        "payment_method": "waafi",
        "flow": "api_purchase",
        "user_id": user["id"],
        "source": source,
        "amount": amount,
        "currency": currency,
        "ticket_ids": ticket_ids or [],
        "vehicle_ids": vehicle_ids or [],
        "promo_code": promo_code,
        "sold_adjustments": sold_adjustments or [],
        "transaction_id": result.get("transaction_id"),
        "state": result.get("state"),
        "created_at": now,
        "updated_at": now,
    }

    if not result["approved"]:
        await _rollback_reservation(ticket_ids, vehicle_ids, sold_adjustments)
        payment_doc["status"] = "failed"
        await db.payments.insert_one(payment_doc)
        message = result.get("message") or "Paiement refuse par WaafiPay"
        logger.info("WaafiPay wallet debit declined (ref=%s): %s", reference_id, message)
        raise HTTPException(status_code=402, detail=f"Paiement Waafi refuse: {message}")

    # Approved: confirm the reserved tickets.
    if ticket_ids:
        await db.tickets.update_many(
            {"id": {"$in": ticket_ids}},
            {"$set": {"status": "valid", "payment_status": "paid",
                      "payment_reference": reference_id, "paid_at": now}},
        )
    if vehicle_ids:
        await db.ferry_vehicles.update_many(
            {"id": {"$in": vehicle_ids}},
            {"$set": {"status": "valid", "payment_status": "paid", "paid_at": now}},
        )
    await _record_promo_usage({"source": source, "promo_code": promo_code, "amount": amount})
    if clear_cart:
        await db.carts.delete_one({"user_id": user["id"]})

    payment_doc["status"] = "paid"
    payment_doc["paid_at"] = now
    await db.payments.insert_one(payment_doc)
    logger.info("WaafiPay wallet debit approved (ref=%s, tx=%s)", reference_id, result.get("transaction_id"))

    return {
        "requires_payment": False,
        "paid": True,
        "reference_id": reference_id,
        "transaction_id": result.get("transaction_id"),
        "amount": amount,
        "currency": currency,
    }


async def _rollback_reservation(ticket_ids: list, vehicle_ids: list, sold_adjustments: list):
    """Undo a reservation when the payment could not even be created."""
    if ticket_ids:
        await db.tickets.delete_many({"id": {"$in": ticket_ids}})
    if vehicle_ids:
        await db.ferry_vehicles.delete_many({"id": {"$in": vehicle_ids}})
    await _release_sold(sold_adjustments)


async def _release_sold(sold_adjustments: list):
    """Give reserved event seats back when a payment fails/cancels."""
    for adj in sold_adjustments or []:
        event = await db.events.find_one({"id": adj["event_id"]})
        if not event:
            continue
        ticket_types = event.get("ticket_types", [])
        for tt in ticket_types:
            if tt["id"] == adj["ticket_type_id"]:
                tt["sold"] = max(0, tt.get("sold", 0) - adj["quantity"])
                break
        await db.events.update_one({"id": event["id"]}, {"$set": {"ticket_types": ticket_types}})


async def _record_promo_usage(payment: dict):
    promo_code = payment.get("promo_code")
    if not promo_code:
        return
    amount = int(payment.get("amount", 0) or 0)
    promo = await db.promo_codes.find_one({"code": promo_code.upper()})
    if not promo:
        return
    if payment.get("source") == "event":
        await db.promo_codes.update_one(
            {"code": promo_code.upper()},
            {"$inc": {"uses": 1, "total_sales": amount}},
        )
    else:  # transport (ferry / train) - mirror _record_transport_promo_usage
        await db.promo_codes.update_one(
            {"id": promo["id"]},
            {
                "$set": {
                    "uses": int(promo.get("uses", 0) or 0) + 1,
                    "bookings_count": int(promo.get("bookings_count", 0) or 0) + 1,
                    "total_sales": int(promo.get("total_sales", 0) or 0) + amount,
                    "last_used_at": _now(),
                }
            },
        )


async def _mark_paid(payment: dict, info: dict) -> dict:
    now = _now()
    if payment.get("ticket_ids"):
        await db.tickets.update_many(
            {"id": {"$in": payment["ticket_ids"]}},
            {"$set": {
                "status": "valid",
                "payment_status": "paid",
                "payment_reference": payment["reference_id"],
                "paid_at": now,
            }},
        )
    if payment.get("vehicle_ids"):
        await db.ferry_vehicles.update_many(
            {"id": {"$in": payment["vehicle_ids"]}},
            {"$set": {"status": "valid", "payment_status": "paid", "paid_at": now}},
        )
    await _record_promo_usage(payment)
    if payment.get("clear_cart"):
        await db.carts.delete_one({"user_id": payment["user_id"]})

    await db.payments.update_one(
        {"reference_id": payment["reference_id"]},
        {"$set": {
            "status": "paid",
            "transaction_id": info.get("transaction_id"),
            "state": info.get("state"),
            "paid_at": now,
            "updated_at": now,
        }},
    )
    payment["status"] = "paid"
    logger.info("WaafiPay payment confirmed (ref=%s)", payment["reference_id"])
    return payment


async def _cancel_payment(payment: dict, reason: str) -> dict:
    now = _now()
    if payment.get("ticket_ids"):
        await db.tickets.update_many(
            {"id": {"$in": payment["ticket_ids"]}},
            {"$set": {"status": "cancelled", "payment_status": "failed"}},
        )
    if payment.get("vehicle_ids"):
        await db.ferry_vehicles.update_many(
            {"id": {"$in": payment["vehicle_ids"]}},
            {"$set": {"status": "cancelled", "payment_status": "failed"}},
        )
    await _release_sold(payment.get("sold_adjustments"))
    await db.payments.update_one(
        {"reference_id": payment["reference_id"]},
        {"$set": {"status": "cancelled", "state": reason, "updated_at": now}},
    )
    payment["status"] = "cancelled"
    logger.info("WaafiPay payment cancelled (ref=%s, reason=%s)", payment["reference_id"], reason)
    return payment


async def resolve_waafi_payment(reference_id: str, outcome: str = "success") -> dict:
    """
    Verify and finalize a payment. Idempotent.

    - outcome == "failure": the customer aborted -> release inventory.
    - outcome == "success": verify via HPP_GETTRANINFO before confirming.
      * approved -> mark paid
      * terminal failure -> cancel
      * still pending/unknown -> leave pending (can be retried)
    """
    payment = await db.payments.find_one({"reference_id": reference_id}, {"_id": 0})
    if not payment:
        return None
    if payment["status"] in ("paid", "cancelled"):
        return payment  # already resolved

    if outcome == "failure":
        return await _cancel_payment(payment, reason="customer_aborted")

    try:
        info = await waafipay.get_transaction_info(reference_id)
    except waafipay.WaafiPayError as exc:
        logger.warning("Could not verify WaafiPay payment %s: %s", reference_id, exc)
        return payment  # keep pending, allow retry

    if info["approved"]:
        return await _mark_paid(payment, info)
    if info["failed"]:
        return await _cancel_payment(payment, reason=info["state"] or "declined")
    return payment  # still pending
