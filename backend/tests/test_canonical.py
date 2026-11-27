"""
Unit tests for the `www.` -> bare domain redirect.

Self-contained: no server, no database. Run with:

    pytest backend/tests/test_canonical.py -v
"""
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from canonical import CanonicalHostMiddleware  # noqa: E402


def _client(canonical_host):
    app = FastAPI()

    @app.api_route("/{path:path}", methods=["GET", "HEAD", "POST"])
    async def echo(path: str):
        return {"path": path}

    app.add_middleware(CanonicalHostMiddleware, canonical_host=canonical_host)
    return TestClient(app)


@pytest.fixture()
def client():
    return _client("d-billet.com")


@pytest.mark.parametrize("path, location", [
    ("/", "https://d-billet.com/"),
    ("/terms", "https://d-billet.com/terms"),
    ("/legal/support/", "https://d-billet.com/legal/support/"),
    ("/events?q=%7Bx%7D&p=2", "https://d-billet.com/events?q=%7Bx%7D&p=2"),
])
@pytest.mark.parametrize("method", ["get", "head"])
def test_www_is_permanently_redirected(client, path, location, method):
    response = getattr(client, method)(
        path, headers={"host": "www.d-billet.com"}, follow_redirects=False
    )
    assert response.status_code == 301
    assert response.headers["location"] == location


@pytest.mark.parametrize("host", ["WWW.D-Billet.com", "www.d-billet.com:443"])
def test_host_matching_ignores_case_and_port(client, host):
    response = client.get("/terms", headers={"host": host}, follow_redirects=False)
    assert response.status_code == 301


def test_non_safe_methods_keep_their_method(client):
    # 308, not 301: a browser would otherwise replay a POST as a GET.
    response = client.post(
        "/api/cart", headers={"host": "www.d-billet.com"}, follow_redirects=False
    )
    assert response.status_code == 308
    assert response.headers["location"] == "https://d-billet.com/api/cart"


@pytest.mark.parametrize("host", [
    "d-billet.com",
    "dbillet-abc123-ew.a.run.app",   # direct service URL, used by health checks
    "localhost:8001",
    "www.example.com",
    "evil.www.d-billet.com",
])
def test_other_hosts_are_served(client, host):
    response = client.get("/terms", headers={"host": host}, follow_redirects=False)
    assert response.status_code == 200
    assert response.json() == {"path": "terms"}


def test_disabled_when_canonical_host_is_empty():
    response = _client("").get(
        "/terms", headers={"host": "www.d-billet.com"}, follow_redirects=False
    )
    assert response.status_code == 200
