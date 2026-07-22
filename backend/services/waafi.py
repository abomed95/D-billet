"""
WaafiPay payment gateway integration.

Wraps the WaafiPay ASM API (https://sandbox.waafipay.com/asm) used for
mobile-wallet (EVC Plus / WAAFI) payments in Djibouti.

Supported flows:
  * purchase              -> API_PURCHASE (immediate charge)
  * preauthorize          -> API_PREAUTHORIZE (reserve funds)
  * preauthorize_commit   -> API_PREAUTHORIZE_COMMIT (capture reserved funds)
  * preauthorize_cancel   -> API_PREAUTHORIZE_CANCEL (release reserved funds)

Credentials and endpoint are read from the environment so the same code runs
against the sandbox and production without changes. See
``env.production.example`` for the variable names.
"""
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# --- Configuration -----------------------------------------------------------
WAAFI_BASE_URL = os.environ.get(
    "WAAFI_BASE_URL", "https://sandbox.waafipay.com/asm"
).rstrip("/")
WAAFI_MERCHANT_UID = os.environ.get("WAAFI_MERCHANT_UID", "").strip()
WAAFI_API_USER_ID = os.environ.get("WAAFI_API_USER_ID", "").strip()
WAAFI_API_KEY = os.environ.get("WAAFI_API_KEY", "").strip()
# HPP (Hosted Payment Page) credentials - reserved for a future redirect flow.
WAAFI_HPP_STORE_ID = os.environ.get("WAAFI_HPP_STORE_ID", "").strip()
WAAFI_HPP_KEY = os.environ.get("WAAFI_HPP_KEY", "").strip()
# Sandbox only settles USD; production may use DJF.
WAAFI_CURRENCY = os.environ.get("WAAFI_CURRENCY", "USD").strip() or "USD"
WAAFI_CHANNEL_NAME = os.environ.get("WAAFI_CHANNEL_NAME", "WEB").strip() or "WEB"
WAAFI_TIMEOUT_SECONDS = float(os.environ.get("WAAFI_TIMEOUT_SECONDS", "30"))

SCHEMA_VERSION = "1.0"
SUCCESS_RESPONSE_CODE = "2001"
APPROVED_STATE = "APPROVED"


class WaafiError(Exception):
    """Raised when a WaafiPay request cannot be completed."""


def is_configured() -> bool:
    """True when the mandatory API credentials are present."""
    return bool(WAAFI_MERCHANT_UID and WAAFI_API_USER_ID and WAAFI_API_KEY)


def _credentials() -> dict[str, str]:
    return {
        "merchantUid": WAAFI_MERCHANT_UID,
        "apiUserId": WAAFI_API_USER_ID,
        "apiKey": WAAFI_API_KEY,
    }


def _request_envelope(service_name: str, service_params: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "requestId": uuid.uuid4().hex[:16],
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
        "channelName": WAAFI_CHANNEL_NAME,
        "serviceName": service_name,
        "serviceParams": service_params,
    }


def _normalize(service_name: str, data: dict[str, Any]) -> dict[str, Any]:
    """Flatten a raw WaafiPay response into a predictable result dict."""
    params = data.get("params") or {}
    response_code = str(data.get("responseCode", ""))
    state = str(params.get("state", "")).upper()
    success = response_code == SUCCESS_RESPONSE_CODE and state == APPROVED_STATE
    return {
        "success": success,
        "state": state or "UNKNOWN",
        "service": service_name,
        "transaction_id": params.get("transactionId"),
        "order_id": params.get("orderId"),
        "reference_id": params.get("referenceId"),
        "amount": params.get("txAmount"),
        "response_code": response_code,
        "error_code": str(data.get("errorCode", "")),
        "message": data.get("responseMsg") or params.get("description") or "",
        "raw": data,
    }


async def _post(service_name: str, service_params: dict[str, Any]) -> dict[str, Any]:
    if not is_configured():
        raise WaafiError("WaafiPay credentials are not configured")

    payload = _request_envelope(service_name, service_params)
    try:
        async with httpx.AsyncClient(timeout=WAAFI_TIMEOUT_SECONDS) as client:
            response = await client.post(WAAFI_BASE_URL, json=payload)
    except httpx.HTTPError as exc:
        logger.error("WaafiPay %s request failed: %s", service_name, exc)
        raise WaafiError(f"WaafiPay request failed: {exc}") from exc

    if response.status_code != 200:
        logger.error("WaafiPay %s HTTP %s: %s", service_name, response.status_code, response.text)
        raise WaafiError(f"WaafiPay returned HTTP {response.status_code}")

    try:
        data = response.json()
    except ValueError as exc:
        raise WaafiError("WaafiPay returned a non-JSON response") from exc

    result = _normalize(service_name, data)
    logger.info(
        "WaafiPay %s -> state=%s code=%s ref=%s tx=%s",
        service_name, result["state"], result["response_code"],
        result["reference_id"], result["transaction_id"],
    )
    return result


def _transaction_info(
    amount: float,
    reference_id: str,
    invoice_id: str,
    description: str,
    currency: Optional[str],
) -> dict[str, str]:
    return {
        "referenceId": reference_id,
        "invoiceId": invoice_id,
        "amount": f"{float(amount):.2f}",
        "currency": (currency or WAAFI_CURRENCY),
        "description": description,
    }


async def purchase(
    account_no: str,
    amount: float,
    reference_id: str,
    invoice_id: Optional[str] = None,
    description: str = "D-Billet payment",
    currency: Optional[str] = None,
) -> dict[str, Any]:
    """Charge a mobile-wallet account immediately (API_PURCHASE)."""
    params = {
        **_credentials(),
        "paymentMethod": "MWALLET_ACCOUNT",
        "payerInfo": {"accountNo": account_no},
        "transactionInfo": _transaction_info(
            amount, reference_id, invoice_id or reference_id, description, currency
        ),
    }
    return await _post("API_PURCHASE", params)


async def preauthorize(
    account_no: str,
    amount: float,
    reference_id: str,
    invoice_id: Optional[str] = None,
    description: str = "D-Billet preauthorization",
    currency: Optional[str] = None,
) -> dict[str, Any]:
    """Reserve funds on a mobile-wallet account (API_PREAUTHORIZE)."""
    params = {
        **_credentials(),
        "paymentMethod": "MWALLET_ACCOUNT",
        "payerInfo": {"accountNo": account_no},
        "transactionInfo": _transaction_info(
            amount, reference_id, invoice_id or reference_id, description, currency
        ),
    }
    return await _post("API_PREAUTHORIZE", params)


async def preauthorize_commit(
    transaction_id: str,
    reference_id: Optional[str] = None,
    description: str = "D-Billet capture",
) -> dict[str, Any]:
    """Capture previously reserved funds (API_PREAUTHORIZE_COMMIT)."""
    params = {**_credentials(), "transactionId": transaction_id, "description": description}
    if reference_id:
        params["referenceId"] = reference_id
    return await _post("API_PREAUTHORIZE_COMMIT", params)


async def preauthorize_cancel(
    transaction_id: str,
    description: str = "D-Billet cancellation",
) -> dict[str, Any]:
    """Release previously reserved funds (API_PREAUTHORIZE_CANCEL)."""
    params = {**_credentials(), "transactionId": transaction_id, "description": description}
    return await _post("API_PREAUTHORIZE_CANCEL", params)
