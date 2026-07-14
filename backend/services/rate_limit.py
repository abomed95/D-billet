"""
Lightweight in-memory rate limiter for sensitive endpoints.

Designed for a single uvicorn worker. For multi-worker / multi-server
deployments, complement with Nginx `limit_req` (already configured) or
swap the storage for Redis.

Usage:
    from services.rate_limit import rate_limited

    @router.post("/login", dependencies=[Depends(rate_limited("login", 5, 60))])
    async def login(...):
        ...
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from fastapi import HTTPException, Request, status


# bucket key -> deque of timestamps
_BUCKETS: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def rate_limited(name: str, max_calls: int, period_seconds: int):
    """
    Returns a FastAPI dependency that enforces a sliding-window rate limit.

    - `name`     : namespace (e.g. "login", "otp", "checkout")
    - `max_calls`: number of calls allowed within `period_seconds`
    - Identifies the caller by client IP (X-Forwarded-For aware).
    """

    async def dependency(request: Request) -> None:
        ip = _client_ip(request)
        key = (name, ip)
        now = time.monotonic()
        bucket = _BUCKETS[key]

        # Drop entries outside the sliding window
        threshold = now - period_seconds
        while bucket and bucket[0] < threshold:
            bucket.popleft()

        if len(bucket) >= max_calls:
            retry_after = int(period_seconds - (now - bucket[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de tentatives. Reessayez plus tard.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        bucket.append(now)

    return dependency
