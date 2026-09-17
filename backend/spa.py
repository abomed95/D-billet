"""
Static SPA serving for single-container deployments (Cloud Run).

On the Droplet, Nginx serves `frontend/build` and proxies `/api` to uvicorn.
On Cloud Run there is no Nginx: the same container serves both, so the React
build is mounted here, behind the API routes.

Route resolution order (first match wins):
  1. an existing file          -> `/favicon.ico`, `/asset-manifest.json`...
  2. `<path>/index.html`       -> pages pre-rendered by react-snap
  3. `index.html`              -> client-side routing fallback
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Hashed CRA bundles (`/static/js/main.<hash>.js`) can be cached forever.
_IMMUTABLE = "public, max-age=31536000, immutable"
# Entry points must never be cached, otherwise deploys do not roll out.
_NO_STORE = "no-cache, no-store, must-revalidate"
_SHORT = "public, max-age=3600"

_NEVER_CACHED = {"index.html", "service-worker.js", "asset-manifest.json"}


def _cache_control(relative_path: str) -> str:
    name = relative_path.rsplit("/", 1)[-1]
    if name in _NEVER_CACHED:
        return _NO_STORE
    if relative_path.startswith("static/"):
        return _IMMUTABLE
    if name in {"manifest.json", "robots.txt", "sitemap.xml"}:
        return _SHORT
    return "public, max-age=86400"


def _file_response(build_dir: Path, relative_path: str) -> FileResponse:
    return FileResponse(
        build_dir / relative_path,
        headers={"Cache-Control": _cache_control(relative_path)},
    )


def _safe_join(build_dir: Path, raw_path: str) -> Path | None:
    """Resolve `raw_path` inside `build_dir`, or None if it escapes it."""
    candidate = (build_dir / raw_path).resolve()
    if candidate == build_dir or build_dir in candidate.parents:
        return candidate
    return None


class CachedStaticFiles(StaticFiles):
    """StaticFiles with an explicit Cache-Control header.

    Keeps StaticFiles' ETag and Range handling and only adds the caching
    header Nginx used to set for `/static/` and `/uploads/`. Both serve
    content-addressed names (CRA bundle hashes, upload UUIDs), so their
    responses can be cached aggressively.
    """

    def __init__(self, *args, cache_control: str = _IMMUTABLE, **kwargs):
        super().__init__(*args, **kwargs)
        self.cache_control = cache_control

    def file_response(self, *args, **kwargs):  # noqa: ANN002, ANN003, ANN201
        response = super().file_response(*args, **kwargs)
        response.headers.setdefault("Cache-Control", self.cache_control)
        return response


def mount_spa(app: FastAPI, build_dir: Path) -> None:
    """
    Serve the React build from `app`.

    Must be called AFTER every API router and root endpoint: the catch-all
    below matches any path and would otherwise shadow them.
    """
    build_dir = build_dir.resolve()

    # Hashed assets get their own mount so StaticFiles handles ranges/etags.
    static_dir = build_dir / "static"
    if static_dir.is_dir():
        app.mount(
            "/static",
            CachedStaticFiles(directory=str(static_dir)),
            name="spa-static",
        )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):  # noqa: ANN202
        # API paths never fall through to the SPA: a missing endpoint must
        # stay a JSON 404 instead of returning the HTML shell.
        if full_path.startswith(("api/", "uploads/")):
            raise HTTPException(status_code=404, detail="Not Found")

        if full_path:
            target = _safe_join(build_dir, full_path)
            if target is None:
                raise HTTPException(status_code=404, detail="Not Found")
            if target.is_file():
                return _file_response(build_dir, full_path)
            prerendered = target / "index.html"
            if prerendered.is_file():
                return _file_response(build_dir, f"{full_path.rstrip('/')}/index.html")

        return _file_response(build_dir, "index.html")
