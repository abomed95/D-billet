"""
Tests for signed ticket QR codes (services/qr.py).

Self-contained: no server, no database. Run with:

    pytest backend/tests/test_qr.py -v
"""
import base64
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

os.environ.setdefault("APP_ENV", "development")
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import config  # noqa: E402
import services.qr as qr  # noqa: E402

TOMORROW = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
YESTERDAY = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()


def _seed(nbytes=32):
    return base64.urlsafe_b64encode(os.urandom(nbytes)).rstrip(b"=").decode()


@pytest.fixture
def signing_key(monkeypatch):
    key = _seed()
    monkeypatch.setattr(config, "TICKET_SIGNING_KEY", key)
    return key


@pytest.fixture
def no_signing_key(monkeypatch):
    monkeypatch.setattr(config, "TICKET_SIGNING_KEY", "")


# ---------------------------------------------------------------- issuing

def test_signed_payload_round_trip(signing_key):
    data = qr.build_payload(
        "abc-123", service="ferry", reference="Obock", seat="09:00",
        departure=TOMORROW,
    )
    assert data.startswith("DB1.")

    claims = qr.parse_payload(data)
    assert claims["valid_signature"] is True
    assert claims["ticket_id"] == "abc-123"
    assert claims["service"] == "ferry"
    assert claims["reference"] == "Obock"
    assert claims["seat"] == "09:00"
    assert claims["departure"] == TOMORROW
    assert claims["expired"] is False
    assert claims["error"] is None


def test_expiry_defaults_to_the_day_after_departure(signing_key):
    claims = qr.parse_payload(qr.build_payload("t1", service="train", departure="2026-05-10"))
    assert claims["expires"] == "2026-05-11"


def test_payload_stays_short_enough_to_scan(signing_key):
    data = qr.build_payload(
        "0f8c1b2e-4a5d-4c7e-9b1a-2d3e4f5a6b7c",
        service="ferry_vehicle", reference="Obock", seat="DJ-1234-AB",
        departure=TOMORROW,
    )
    # Well inside what a mid-range phone camera reads reliably.
    assert len(data) < 260, f"QR payload grew to {len(data)} characters"


def test_separator_in_a_field_cannot_break_the_format(signing_key):
    claims = qr.parse_payload(
        qr.build_payload("t1", service="event", reference="a|b", seat="c|d",
                         departure=TOMORROW)
    )
    assert claims["valid_signature"] is True
    assert claims["reference"] == "a/b"
    assert claims["seat"] == "c/d"


# ---------------------------------------------------------------- forgeries

def test_tampered_payload_is_rejected(signing_key):
    data = qr.build_payload("t1", service="event", departure=TOMORROW)
    prefix, payload, signature = data.split(".")

    forged_fields = "t1|event|VIP||" + TOMORROW + "|" + TOMORROW
    forged = base64.urlsafe_b64encode(forged_fields.encode()).rstrip(b"=").decode()
    claims = qr.parse_payload(f"{prefix}.{forged}.{signature}")

    assert claims["valid_signature"] is False
    assert claims["error"] == "bad_signature"
    # A forgery must not hand back a ticket id to look up.
    assert claims["ticket_id"] is None


def test_signature_from_another_key_is_rejected(monkeypatch):
    monkeypatch.setattr(config, "TICKET_SIGNING_KEY", _seed())
    data = qr.build_payload("t1", service="event", departure=TOMORROW)

    monkeypatch.setattr(config, "TICKET_SIGNING_KEY", _seed())
    claims = qr.parse_payload(data)
    assert claims["valid_signature"] is False
    assert claims["error"] == "bad_signature"
    assert claims["ticket_id"] is None


def test_garbage_and_truncated_payloads_never_raise(signing_key):
    for data in ["DB1.", "DB1.a.b", "DB1.!!!.???", "DB1.only-two-parts",
                 "DB1." + "A" * 200 + ".zzz", "", "   "]:
        claims = qr.parse_payload(data)
        assert claims["valid_signature"] is False
        assert claims["ticket_id"] is None or claims["error"] is not None


def test_expired_ticket_is_flagged(signing_key):
    data = qr.build_payload("t1", service="train", departure="2020-01-01",
                            expires=YESTERDAY)
    claims = qr.parse_payload(data)
    assert claims["valid_signature"] is True
    assert claims["expired"] is True


# ---------------------------------------------------------------- legacy

def test_legacy_prefixes_still_yield_a_ticket_id(no_signing_key):
    for raw, expected in [
        ("DBILLET-abc-123", "abc-123"),
        ("TRAIN-abc-123", "abc-123"),
        ("FERRY-abc-123", "abc-123"),
        ("FERRY-VEH-abc-123", "abc-123"),
        ("abc-123", "abc-123"),
    ]:
        claims = qr.parse_payload(raw)
        assert claims["ticket_id"] == expected, raw
        assert claims["signed"] is False


def test_without_a_key_the_legacy_format_is_issued(no_signing_key):
    assert qr.build_payload("t1", service="event") == "DBILLET-t1"
    assert qr.signing_enabled() is False
    assert qr.public_key_b64() is None


def test_signed_ticket_issued_before_a_key_rotation_reports_bad_signature(monkeypatch):
    """A rotated key must not silently accept old signatures."""
    monkeypatch.setattr(config, "TICKET_SIGNING_KEY", _seed())
    data = qr.build_payload("t1", service="event", departure=TOMORROW)
    monkeypatch.setattr(config, "TICKET_SIGNING_KEY", "")
    claims = qr.parse_payload(data)
    assert claims["valid_signature"] is False
    assert claims["error"] == "no_key"


# ---------------------------------------------------------------- key handling

def test_public_key_is_exposed_and_is_not_the_private_key(signing_key):
    public = qr.public_key_b64()
    assert public and public != signing_key
    assert len(base64.urlsafe_b64decode(public + "==")) == 32


def test_malformed_keys_disable_signing_instead_of_crashing(monkeypatch):
    for bad in ["not-base64!!", _seed(16), _seed(64)]:
        monkeypatch.setattr(config, "TICKET_SIGNING_KEY", bad)
        assert qr.signing_enabled() is False
        assert qr.build_payload("t1", service="event") == "DBILLET-t1"
