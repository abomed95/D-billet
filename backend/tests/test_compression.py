"""
Unit tests for the selective gzip rule.

Self-contained: no server, no database. Run with:

    pytest backend/tests/test_compression.py -v
"""
import os
import sys

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from compression import is_compressible  # noqa: E402


@pytest.mark.parametrize("content_type", [
    "text/html",
    "text/html; charset=utf-8",
    "text/css",
    "text/plain",
    "application/javascript",
    "application/json",
    "application/json; charset=utf-8",
    "application/xml",
    # The +json / +xml suffixes carry the manifest, JSON-LD and SVG cases.
    "application/manifest+json",
    "application/ld+json",
    "image/svg+xml",
    "application/xhtml+xml",
    # Casing and padding must not change the answer.
    "TEXT/HTML",
    "  application/json  ",
])
def test_compressible_types(content_type):
    assert is_compressible(content_type) is True


@pytest.mark.parametrize("content_type", [
    # Already compressed: gzip costs CPU and can make these slightly larger.
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/avif",
    "application/pdf",
    "font/woff2",
    "video/mp4",
    "audio/mpeg",
    "application/zip",
    "application/octet-stream",
    # A missing or empty header must never be treated as compressible.
    "",
    "   ",
    ";charset=utf-8",
])
def test_non_compressible_types(content_type):
    assert is_compressible(content_type) is False


def test_ticket_pdf_is_left_alone():
    """Ticket PDFs are reportlab output: already compressed internally."""
    assert is_compressible("application/pdf") is False


def test_uploaded_event_images_are_left_alone():
    """Organizer uploads are served from /uploads and must pass through."""
    for ctype in ("image/png", "image/jpeg", "image/gif"):
        assert is_compressible(ctype) is False
