"""
Payment routes - WaafiPay Hosted Payment Page integration.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from config import db, FRONTEND_URL, WAAFIPAY_PAYMENT_METHOD_ID
from services import get_current_user, waafipay
from services.payments import resolve_waafi_payment

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Payments"])


def _public_payment(payment: dict) -> dict:
    return {
        "reference_id": payment.get("reference_id"),
        "status": payment.get("status"),
        "amount": payment.get("amount"),
        "currency": payment.get("currency"),
        "payment_method": payment.get("payment_method"),
        "source": payment.get("source"),
        "created_at": payment.get("created_at"),
        "paid_at": payment.get("paid_at"),
    }


@router.get("/payments/config")
async def payments_config():
    """Expose which payment providers are live so the UI can adapt."""
    return {
        "waafi": {
            "enabled": waafipay.is_available(),
            "provider": "waafipay",
            "method_id": WAAFIPAY_PAYMENT_METHOD_ID,
            # "wallet" = direct debit (customer enters Waafi number),
            # "redirect" = Hosted Payment Page.
            "flow": "wallet" if waafipay.is_api_configured() else ("redirect" if waafipay.is_configured() else None),
        }
    }


@router.api_route("/payments/waafi/return/{reference_id}", methods=["GET", "POST"])
async def waafi_return(reference_id: str, outcome: str = Query("success")):
    """
    WaafiPay redirects the customer's browser here after payment.
    We verify the outcome server-side, then bounce to the SPA result page.
    """
    payment = await resolve_waafi_payment(reference_id, outcome=outcome)
    status = payment.get("status") if payment else "unknown"
    redirect_url = f"{FRONTEND_URL}/payment/result?ref={reference_id}&status={status}"
    return RedirectResponse(url=redirect_url, status_code=303)


@router.post("/payments/waafi/verify")
async def waafi_verify(
    reference_id: str = Query(...),
    user: dict = Depends(get_current_user),
):
    """Manually (re)verify a payment - used by the result page to poll status."""
    payment = await db.payments.find_one({"reference_id": reference_id}, {"_id": 0})
    if not payment or payment.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    resolved = await resolve_waafi_payment(reference_id, outcome="success")
    return _public_payment(resolved or payment)


@router.get("/payments/{reference_id}")
async def get_payment(reference_id: str, user: dict = Depends(get_current_user)):
    """Return a payment and its tickets for the authenticated owner."""
    payment = await db.payments.find_one({"reference_id": reference_id}, {"_id": 0})
    if not payment or payment.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Paiement introuvable")

    tickets = []
    if payment.get("ticket_ids"):
        tickets = await db.tickets.find(
            {"id": {"$in": payment["ticket_ids"]}}, {"_id": 0}
        ).to_list(200)

    return {
        **_public_payment(payment),
        "tickets": [
            {
                "id": t["id"],
                "event_title": t.get("event_title"),
                "ticket_type": t.get("ticket_type"),
                "status": t.get("status"),
                "price": t.get("price"),
            }
            for t in tickets
        ],
    }
