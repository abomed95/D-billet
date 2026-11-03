"""
Response compression for single-container deployments (Cloud Run).

Nginx sets `gzip on` in front of the Droplet, so the API never had to compress
anything itself. On Cloud Run there is no Nginx and nothing else compresses:
`main.js` went out at 893 kB instead of 235 kB, which a Lighthouse mobile run
scored 65/100 against 82/100 compressed.

Starlette's own GZipMiddleware would fix that, but it compresses every response
above `minimum_size` with no regard for the content type. That would gzip the
event images served from /uploads and the ticket PDFs - already-compressed
payloads where gzip costs CPU (billed per request on Cloud Run) and returns
nothing, sometimes making them marginally larger. So the responder below gates
on the content type, mirroring `gzip_types` in deploy/digitalocean/nginx.conf.
"""
from __future__ import annotations

from starlette.datastructures import Headers
from starlette.middleware.gzip import GZipResponder
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Mirrors gzip_types in the Nginx config, plus text/html which Nginx always
# compresses. The `+json` / `+xml` suffixes cover application/manifest+json,
# application/ld+json and image/svg+xml without listing each one.
_COMPRESSIBLE_TYPES = frozenset({
    "application/json",
    "application/javascript",
    "application/x-javascript",
    "application/xml",
})


def is_compressible(content_type: str) -> bool:
    """True when gzip is worth the CPU for this content type."""
    # Drop any parameters: "text/html; charset=utf-8" -> "text/html"
    mime = content_type.split(";", 1)[0].strip().lower()
    if not mime:
        return False
    return (
        mime.startswith("text/")
        or mime.endswith(("+json", "+xml"))
        or mime in _COMPRESSIBLE_TYPES
    )


class _SelectiveGZipResponder(GZipResponder):
    """GZipResponder that only compresses compressible 200 responses.

    Rather than reimplement the parent's buffering and streaming paths, this
    reuses its `content_encoding_set` flag: the parent already has a branch
    that forwards a response untouched when it declares its own encoding.
    Setting the flag for anything we do not want compressed routes it through
    that same passthrough, so there is no duplicated compression logic here.
    """

    async def send_with_gzip(self, message: Message) -> None:
        if message["type"] == "http.response.start":
            # The parent stores the message and recomputes the flag, so decide
            # after it has run rather than before.
            await super().send_with_gzip(message)
            if not self.content_encoding_set:
                headers = Headers(raw=message["headers"])
                # 206 responses carry a byte range: compressing one would
                # invalidate Content-Range. 304 has no body to compress.
                if message["status"] != 200 or not is_compressible(
                    headers.get("content-type", "")
                ):
                    self.content_encoding_set = True
            return

        await super().send_with_gzip(message)


class SelectiveGZipMiddleware:
    """Compress text responses, leaving images, PDFs and media untouched."""

    def __init__(
        self,
        app: ASGIApp,
        minimum_size: int = 1024,
        compresslevel: int = 6,
    ) -> None:
        self.app = app
        self.minimum_size = minimum_size
        self.compresslevel = compresslevel

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            accept = Headers(scope=scope).get("Accept-Encoding", "")
            if "gzip" in accept:
                responder = _SelectiveGZipResponder(
                    self.app, self.minimum_size, self.compresslevel
                )
                await responder(scope, receive, send)
                return

        await self.app(scope, receive, send)
