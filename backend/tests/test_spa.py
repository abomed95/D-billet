"""
Unit tests for the single-container SPA serving (Cloud Run path).

Self-contained: no server, no database. Run with:

    pytest backend/tests/test_spa.py -v
"""
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from spa import mount_spa  # noqa: E402


@pytest.fixture()
def client(tmp_path):
    (tmp_path / "index.html").write_text("<html>shell</html>")
    (tmp_path / "robots.txt").write_text("User-agent: *\n")
    (tmp_path / "terms").mkdir()
    (tmp_path / "terms" / "index.html").write_text("<html>terms</html>")
    (tmp_path / "static" / "js").mkdir(parents=True)
    (tmp_path / "static" / "js" / "main.abc.js").write_text("console.log(1)")

    app = FastAPI()
    mount_spa(app, tmp_path)
    return TestClient(app)


@pytest.mark.parametrize("path", [
    "/terms",            # pre-rendered page
    "/events/x/y",       # client-side route, falls back to the shell
    "/robots.txt",       # plain file
    "/static/js/main.abc.js",
])
def test_head_is_served_like_get(client, path):
    get = client.get(path)
    head = client.head(path)

    assert get.status_code == 200
    # Crawlers and monitors probe with HEAD; a 405 reads as a broken page.
    assert head.status_code == 200
    assert head.content == b""
    assert head.headers["content-type"] == get.headers["content-type"]
    assert head.headers["content-length"] == get.headers["content-length"]


def test_prerendered_page_wins_over_shell(client):
    assert client.get("/terms").text == "<html>terms</html>"
    assert client.get("/unknown").text == "<html>shell</html>"


@pytest.mark.parametrize("method", ["get", "head"])
def test_api_paths_never_fall_back_to_html(client, method):
    response = getattr(client, method)("/api/missing")
    assert response.status_code == 404


def test_path_traversal_is_rejected(client):
    assert client.get("/..%2f..%2fetc/passwd").status_code == 404


@pytest.mark.parametrize("path, location", [
    ("/terms/", "/terms"),
    ("/legal/support/", "/legal/support"),
    ("/events/?q=concert", "/events?q=concert"),
    ("/ferry//", "/ferry"),
    # An encoded leading slash decodes to `//evil.example/`: the redirect
    # must stay a local path, never become an off-site URL.
    ("/%2Fevil.example/", "/evil.example"),
])
@pytest.mark.parametrize("method", ["get", "head"])
def test_trailing_slash_redirects_to_canonical_path(client, path, location, method):
    response = getattr(client, method)(path, follow_redirects=False)
    assert response.status_code == 301
    assert response.headers["location"] == location


def test_api_paths_keep_their_trailing_slash(client):
    response = client.get("/api/events/", follow_redirects=False)
    assert response.status_code == 404
