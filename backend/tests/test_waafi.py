"""
Unit tests for the WaafiPay payment service.

These tests mock the HTTP layer so they never touch the network and can run in
CI. An optional live sandbox test runs only when WAAFI_LIVE_TEST=1 is set.

Async coroutines are driven with asyncio.run() so no pytest-asyncio plugin is
required (the project does not depend on it).
"""
import asyncio
import importlib.util
import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load the waafi module directly from its file so the test stays isolated and
# does not pull in the whole services package (auth/bcrypt/motor/...).
_spec = importlib.util.spec_from_file_location(
    "waafi_under_test", BACKEND_DIR / "services" / "waafi.py"
)
waafi = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(waafi)


def run(coro):
    return asyncio.run(coro)


class _FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = str(payload)

    def json(self):
        return self._payload


class _FakeAsyncClient:
    """Minimal stand-in for httpx.AsyncClient used to capture requests."""

    last_url = None
    last_json = None
    response = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, json=None):
        type(self).last_url = url
        type(self).last_json = json
        return type(self).response


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(waafi, "WAAFI_MERCHANT_UID", "M01")
    monkeypatch.setattr(waafi, "WAAFI_API_USER_ID", "1008348")
    monkeypatch.setattr(waafi, "WAAFI_API_KEY", "API-test")
    monkeypatch.setattr(waafi.httpx, "AsyncClient", _FakeAsyncClient)
    _FakeAsyncClient.last_url = None
    _FakeAsyncClient.last_json = None
    _FakeAsyncClient.response = None
    return waafi


def test_is_configured_false_without_credentials(monkeypatch):
    monkeypatch.setattr(waafi, "WAAFI_MERCHANT_UID", "")
    monkeypatch.setattr(waafi, "WAAFI_API_USER_ID", "")
    monkeypatch.setattr(waafi, "WAAFI_API_KEY", "")
    assert waafi.is_configured() is False


def test_is_configured_true_with_credentials(configured):
    assert configured.is_configured() is True


def test_purchase_success(configured):
    _FakeAsyncClient.response = _FakeResponse(payload={
        "schemaVersion": "1.0",
        "responseCode": "2001",
        "errorCode": "0",
        "responseMsg": "RCS_SUCCESS",
        "params": {"referenceId": "ref1", "transactionId": "57741416",
                   "orderId": "28590761", "txAmount": "0.01", "state": "APPROVED"},
    })

    result = run(configured.purchase(
        account_no="25377111111", amount=0.01, reference_id="ref1",
    ))

    assert result["success"] is True
    assert result["state"] == "APPROVED"
    assert result["transaction_id"] == "57741416"
    # Request envelope was built correctly.
    body = _FakeAsyncClient.last_json
    assert body["serviceName"] == "API_PURCHASE"
    assert body["serviceParams"]["payerInfo"]["accountNo"] == "25377111111"
    assert body["serviceParams"]["transactionInfo"]["amount"] == "0.01"
    assert body["serviceParams"]["merchantUid"] == "M01"


def test_purchase_declined(configured):
    _FakeAsyncClient.response = _FakeResponse(payload={
        "schemaVersion": "1.0",
        "responseCode": "5001",
        "errorCode": "2007",
        "responseMsg": "account number does not match with our sandbox test accounts",
        "params": {"referenceId": "ref2", "state": "FAILED",
                   "description": "account number does not match"},
    })

    result = run(configured.purchase(
        account_no="252610000000", amount=0.01, reference_id="ref2",
    ))

    assert result["success"] is False
    assert result["state"] == "FAILED"
    assert "sandbox test accounts" in result["message"]


def test_preauthorize_uses_correct_service(configured):
    _FakeAsyncClient.response = _FakeResponse(payload={
        "responseCode": "2001",
        "params": {"transactionId": "57741417", "state": "APPROVED"},
    })
    result = run(configured.preauthorize(
        account_no="25377111111", amount=0.05, reference_id="ref3",
    ))
    assert result["success"] is True
    assert _FakeAsyncClient.last_json["serviceName"] == "API_PREAUTHORIZE"


def test_purchase_without_credentials_raises(monkeypatch):
    monkeypatch.setattr(waafi, "WAAFI_MERCHANT_UID", "")
    monkeypatch.setattr(waafi, "WAAFI_API_USER_ID", "")
    monkeypatch.setattr(waafi, "WAAFI_API_KEY", "")
    with pytest.raises(waafi.WaafiError):
        run(waafi.purchase(account_no="25377111111", amount=1.0, reference_id="x"))


def test_http_error_raises(configured):
    _FakeAsyncClient.response = _FakeResponse(status_code=500, payload={})
    with pytest.raises(configured.WaafiError):
        run(configured.purchase(account_no="25377111111", amount=1.0, reference_id="x"))


@pytest.mark.skipif(
    os.environ.get("WAAFI_LIVE_TEST") != "1",
    reason="Set WAAFI_LIVE_TEST=1 to run the live sandbox test",
)
def test_live_sandbox_purchase():
    """Hits the real WaafiPay sandbox. Requires WAAFI_* env vars to be set."""
    result = run(waafi.purchase(
        account_no=os.environ.get("WAAFI_TEST_ACCOUNT", "25377111111"),
        amount=0.01,
        reference_id="livetest",
        description="D-Billet live sandbox test",
    ))
    assert result["success"] is True
    assert result["state"] == "APPROVED"
