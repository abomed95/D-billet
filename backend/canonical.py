"""
Canonical host redirect for single-container deployments (Cloud Run).

Cloud Run maps both `d-billet.com` and `www.d-billet.com` to the same
service, so without this every page exists twice for search engines. Nginx
would do this on the Droplet; on Cloud Run the app has to.

Only the `www.` variant of the canonical host is redirected. Every other host
(the `*.run.app` URL, `localhost`, test clients) is left alone, so health
checks and direct access to the service keep working.

Written as a pure ASGI middleware rather than `BaseHTTPMiddleware`: it answers
before the app runs and never needs to read or stream a response body.
"""
from __future__ import annotations

from urllib.parse import quote

from starlette.datastructures import Headers
from starlette.responses import RedirectResponse
from starlette.types import ASGIApp, Receive, Scope, Send

# GET and HEAD can be redirected with 301 (permanent, cached, consolidates
# search signals). Other methods get 308 so the client replays the same
# method and body instead of downgrading to GET.
_SAFE_METHODS = {"GET", "HEAD"}


class CanonicalHostMiddleware:
    def __init__(self, app: ASGIApp, canonical_host: str) -> None:
        self.app = app
        self.canonical_host = canonical_host.strip().lower().rstrip(".")
        self.alias_host = f"www.{self.canonical_host}"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not self.canonical_host:
            await self.app(scope, receive, send)
            return

        host = Headers(scope=scope).get("host", "").split(":", 1)[0].lower()
        if host.rstrip(".") != self.alias_host:
            await self.app(scope, receive, send)
            return

        # Rebuild from the raw path so encoded characters survive untouched.
        # Some servers leave the query string in `raw_path`: drop it, the
        # query is appended from `query_string` below.
        raw_path = scope.get("raw_path")
        if raw_path:
            path = raw_path.decode("latin-1").split("?", 1)[0]
        else:
            path = quote(scope["path"])
        query = scope.get("query_string", b"").decode("latin-1")
        location = f"https://{self.canonical_host}{path}"
        if query:
            location = f"{location}?{query}"

        status = 301 if scope["method"] in _SAFE_METHODS else 308
        response = RedirectResponse(location, status_code=status)
        await response(scope, receive, send)
