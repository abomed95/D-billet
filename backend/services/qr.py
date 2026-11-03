"""
Signed ticket QR codes.

The QR used to carry `DBILLET-<uuid>`: a bare identifier that proves nothing on
its own, so validity could only be established by asking the server. Tickets are
checked on the train and on the ferry, where there is no network, which made
offline control impossible.

The payload below is signed with Ed25519. A controller device holding only the
PUBLIC key can establish that a QR was issued by D-Billet, for which trip, and
until when - without any connection. The server still has the last word on
whether a ticket was already used or refunded; the signature only proves the
ticket is genuine and names what it is for.

Wire format (one line, no JSON, to keep the QR easy to scan on a cheap camera):

    DB1.<payload>.<signature>

`payload` is base64url of pipe-separated fields, `signature` is base64url of the
Ed25519 signature over the payload bytes exactly as they appear:

    <ticket_id>|<service>|<reference>|<seat>|<departure>|<expires>

Both parts are base64url without padding. `|` never appears in the fields, all
of which are identifiers, slugs or ISO dates.

With no signing key configured the legacy `DBILLET-<uuid>` form is emitted
instead, so an existing deployment keeps working until a key is set and the
tickets issued before the switch stay scannable for ever.
"""
from __future__ import annotations

import base64
import logging
from datetime import datetime, timedelta, timezone

import config

try:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import (
        Ed25519PrivateKey,
        Ed25519PublicKey,
    )
except ImportError:  # pragma: no cover - cryptography is a production pin
    Ed25519PrivateKey = None
    Ed25519PublicKey = None

    class InvalidSignature(Exception):
        """Fallback when cryptography is unavailable."""


logger = logging.getLogger(__name__)

FORMAT_PREFIX = "DB1"
FIELD_SEPARATOR = "|"
# How long a ticket stays presentable after the departure it is valid for.
DEFAULT_VALIDITY_DAYS = 1

# Legacy prefixes, kept so tickets issued before signing remain scannable.
LEGACY_PREFIXES = ("DBILLET-", "TRAIN-", "FERRY-VEH-", "FERRY-")


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _private_key():
    """Load the Ed25519 signing key, or None when signing is not configured."""
    seed = (getattr(config, "TICKET_SIGNING_KEY", "") or "").strip()
    if not seed or Ed25519PrivateKey is None:
        return None
    try:
        raw = _b64url_decode(seed)
    except Exception:  # noqa: BLE001 - malformed configuration
        logger.error("TICKET_SIGNING_KEY is not valid base64url; QR signing disabled")
        return None
    if len(raw) != 32:
        logger.error(
            "TICKET_SIGNING_KEY must decode to 32 bytes (got %s); QR signing disabled",
            len(raw),
        )
        return None
    return Ed25519PrivateKey.from_private_bytes(raw)


def signing_enabled() -> bool:
    return _private_key() is not None


def public_key_b64() -> str | None:
    """The verification key controller devices need, base64url, or None."""
    private = _private_key()
    if private is None:
        return None
    from cryptography.hazmat.primitives import serialization

    raw = private.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return _b64url_encode(raw)


def _clean(value) -> str:
    """Fields must not contain the separator, and must be plain strings."""
    text = "" if value is None else str(value)
    return text.replace(FIELD_SEPARATOR, "/").strip()


def _expiry_for(departure: str) -> str:
    """One day after departure, falling back to a wide window if unparseable."""
    try:
        day = datetime.strptime(departure[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        day = datetime.now(timezone.utc)
    return (day + timedelta(days=DEFAULT_VALIDITY_DAYS)).date().isoformat()


def build_payload(
    ticket_id: str,
    service: str,
    reference: str = "",
    seat: str = "",
    departure: str = "",
    expires: str = "",
) -> str:
    """
    Build the QR content for a ticket.

    Returns the signed form when a key is configured, the legacy
    `DBILLET-<id>` form otherwise, so callers never have to check.
    """
    private = _private_key()
    if private is None:
        return f"DBILLET-{ticket_id}"

    fields = [
        _clean(ticket_id),
        _clean(service),
        _clean(reference),
        _clean(seat),
        _clean(departure)[:10],
        _clean(expires)[:10] or _expiry_for(departure),
    ]
    payload = FIELD_SEPARATOR.join(fields).encode("utf-8")
    signature = private.sign(payload)
    return f"{FORMAT_PREFIX}.{_b64url_encode(payload)}.{_b64url_encode(signature)}"


def parse_payload(qr_data: str) -> dict:
    """
    Read a scanned QR.

    Always returns a dict, never raises, so a scanner endpoint can report a
    forgery instead of a server error:

        {"ticket_id": str|None, "signed": bool, "valid_signature": bool,
         "service": str, "reference": str, "seat": str,
         "departure": str, "expires": str, "expired": bool, "error": str|None}
    """
    empty = {
        "ticket_id": None,
        "signed": False,
        "valid_signature": False,
        "service": "",
        "reference": "",
        "seat": "",
        "departure": "",
        "expires": "",
        "expired": False,
        "error": None,
    }

    data = (qr_data or "").strip()
    if not data:
        return {**empty, "error": "empty"}

    if not data.startswith(f"{FORMAT_PREFIX}."):
        # Legacy or hand-typed: a bare id, optionally with its old prefix.
        ticket_id = data
        for prefix in LEGACY_PREFIXES:
            if ticket_id.startswith(prefix):
                ticket_id = ticket_id[len(prefix):]
                break
        return {**empty, "ticket_id": ticket_id or None}

    parts = data.split(".")
    if len(parts) != 3:
        return {**empty, "signed": True, "error": "malformed"}

    try:
        payload = _b64url_decode(parts[1])
        signature = _b64url_decode(parts[2])
    except Exception:  # noqa: BLE001 - untrusted input
        return {**empty, "signed": True, "error": "malformed"}

    fields = payload.decode("utf-8", errors="replace").split(FIELD_SEPARATOR)
    fields += [""] * (6 - len(fields))
    ticket_id, service, reference, seat, departure, expires = fields[:6]

    result = {
        **empty,
        "signed": True,
        "ticket_id": ticket_id or None,
        "service": service,
        "reference": reference,
        "seat": seat,
        "departure": departure,
        "expires": expires,
    }

    private = _private_key()
    if private is None:
        return {**result, "error": "no_key"}

    try:
        private.public_key().verify(signature, payload)
    except InvalidSignature:
        return {**result, "ticket_id": None, "error": "bad_signature"}
    except Exception:  # noqa: BLE001 - untrusted input
        return {**result, "ticket_id": None, "error": "bad_signature"}

    expired = False
    if expires:
        try:
            expired = datetime.strptime(expires, "%Y-%m-%d").date() < datetime.now(
                timezone.utc
            ).date()
        except ValueError:
            expired = False

    return {**result, "valid_signature": True, "expired": expired}
