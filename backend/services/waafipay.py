"""
WaafiPay payment gateway client.

Implements the subset of the WaafiPay API needed by D-Billet:
- HPP_PURCHASE   : create a Hosted Payment Page session and get the redirect URL
- HPP_GETTRANINFO: query a transaction status by our merchant reference id

WaafiPay envelope (all requests):
    {
      "schemaVersion": "1.0",
      "requestId": "<uuid>",
      "timestamp": "<yyyymmddHHMMSS>",
      "channelName": "WEB",
      "serviceName": "HPP_PURCHASE" | "HPP_GETTRANINFO",
      "serviceParams": { ... }
    }

Credentials are read from environment variables (see config.py) and are never
committed to the repository. When the gateway is not configured the checkout
flows fall back to the legacy simulated payment behaviour.
"""
import logging
import re
import uuid
from datetime import datetime, timezone

import httpx

import config

logger = logging.getLogger(__name__)

SCHEMA_VERSION = "1.0"
CHANNEL_NAME = "WEB"

# WaafiPay returns responseCode "2001" together with errorCode "0" on success.
SUCCESS_RESPONSE_CODE = "2001"

# Transaction states considered "paid".
APPROVED_STATES = {"APPROVED", "APPROVE", "SUCCESS", "SUCCESSFUL", "PAID", "COMPLETED"}
# Terminal failure states (safe to release the reserved inventory).
FAILED_STATES = {
    "DECLINED", "FAILED", "CANCELLED", "CANCELED", "REJECTED",
    "EXPIRED", "ERROR", "REVERSED", "VOID", "ABORTED",
}


class WaafiPayError(Exception):
    """Raised when the WaafiPay gateway returns an error or is unreachable."""


class WaafiPayNotConfigured(WaafiPayError):
    """Raised when a WaafiPay call is attempted without credentials."""


def is_configured() -> bool:
    """True when the HPP credentials required to create a payment are present."""
    return bool(
        config.WAAFIPAY_MERCHANT_UID
        and config.WAAFIPAY_STORE_ID
        and config.WAAFIPAY_HPP_KEY
    )


def _timestamp() -> str:
    # WaafiPay expects a compact timestamp (<= 20 chars).
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def _format_amount(amount) -> str:
    # Numeric with up to two decimals; WaafiPay truncates extra decimals.
    return f"{float(amount):.2f}"


def _normalize_phone(phone: str) -> str:
    """International format without '+' or leading zeros (e.g. 25377xxxxxx)."""
    digits = re.sub(r"\D", "", phone or "")
    return digits.lstrip("0")


async def _post(payload: dict) -> dict:
    try:
        async with httpx.AsyncClient(timeout=config.WAAFIPAY_TIMEOUT) as client:
            response = await client.post(config.WAAFIPAY_BASE_URL, json=payload)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPError as exc:
        logger.error("WaafiPay request failed (%s): %s", payload.get("serviceName"), exc)
        raise WaafiPayError(f"WaafiPay injoignable: {exc}") from exc
    except ValueError as exc:  # invalid JSON
        logger.error("WaafiPay returned a non-JSON response: %s", exc)
        raise WaafiPayError("Reponse WaafiPay invalide") from exc


def _base_params() -> dict:
    return {
        "merchantUid": config.WAAFIPAY_MERCHANT_UID,
        "storeId": config.WAAFIPAY_STORE_ID,
        "hppKey": config.WAAFIPAY_HPP_KEY,
    }


async def create_hpp_purchase(
    *,
    reference_id: str,
    amount,
    description: str,
    success_url: str,
    failure_url: str,
    currency: str = None,
    payment_method: str = None,
    payer_phone: str = None,
) -> dict:
    """
    Create a Hosted Payment Page purchase session.

    Returns a dict with keys: hpp_url, order_id, reference_id, raw.
    Raises WaafiPayError on failure.
    """
    if not is_configured():
        raise WaafiPayNotConfigured("Les identifiants WaafiPay ne sont pas configures")

    service_params = _base_params()
    service_params.update(
        {
            "hppSuccessCallbackUrl": success_url,
            "hppFailureCallbackUrl": failure_url,
            # 2 = the customer's browser is redirected back with GET parameters.
            "hppRespDataFormat": 2,
            "transactionInfo": {
                "referenceId": reference_id,
                "invoiceId": reference_id,
                "amount": _format_amount(amount),
                "currency": (currency or config.WAAFIPAY_CURRENCY),
                "description": (description or "D-Billet")[:255],
            },
        }
    )
    if payment_method:
        service_params["paymentMethod"] = payment_method
    if payer_phone:
        normalized = _normalize_phone(payer_phone)
        if normalized:
            service_params["payerInfo"] = {"subscriptionId": normalized}

    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "requestId": uuid.uuid4().hex,
        "timestamp": _timestamp(),
        "channelName": CHANNEL_NAME,
        "serviceName": "HPP_PURCHASE",
        "serviceParams": service_params,
    }

    data = await _post(payload)
    response_code = str(data.get("responseCode", ""))
    params = data.get("params") or {}
    hpp_url = (
        params.get("hppUrl")
        or params.get("hppRedirectUrl")
        or params.get("redirectUrl")
        or params.get("directPaymentLink")
    )

    if response_code != SUCCESS_RESPONSE_CODE or not hpp_url:
        message = data.get("responseMsg") or data.get("errorCode") or "Echec de creation du paiement"
        logger.error(
            "WaafiPay HPP_PURCHASE rejected (ref=%s, code=%s): %s",
            reference_id, response_code, message,
        )
        raise WaafiPayError(f"WaafiPay a refuse la creation du paiement: {message}")

    return {
        "hpp_url": hpp_url,
        "order_id": params.get("orderId") or params.get("transactionId"),
        "reference_id": params.get("referenceId") or reference_id,
        "raw": data,
    }


async def get_transaction_info(reference_id: str) -> dict:
    """
    Query the status of a transaction by our merchant reference id.

    Returns a dict: state, approved, failed, response_code, transaction_id, amount, raw.
    Raises WaafiPayError on transport failure.
    """
    if not is_configured():
        raise WaafiPayNotConfigured("Les identifiants WaafiPay ne sont pas configures")

    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "requestId": uuid.uuid4().hex,
        "timestamp": _timestamp(),
        "channelName": CHANNEL_NAME,
        "serviceName": "HPP_GETTRANINFO",
        "serviceParams": {**_base_params(), "referenceId": reference_id},
    }

    data = await _post(payload)
    params = data.get("params") or {}
    state = str(
        params.get("state")
        or params.get("status")
        or params.get("tranState")
        or params.get("tranStatusDesc")
        or ""
    ).upper()

    return {
        "state": state,
        "approved": state in APPROVED_STATES,
        "failed": state in FAILED_STATES,
        "response_code": str(data.get("responseCode", "")),
        "transaction_id": params.get("transactionId"),
        "amount": params.get("txAmount") or params.get("tranAmount") or params.get("amount"),
        "raw": data,
    }
