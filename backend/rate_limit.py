"""
Minimal in-memory rate limiting for cheap-to-abuse, unauthenticated endpoints.

docs/CODE_REVIEW.md flags /auth/google/verify, /auth/google/callback and
/auth/api-keys/exchange as having no rate limiting — each triggers an outbound
call (to Google, or a pbkdf2 hash verification) that costs real money on a
per-invocation Lambda, so an attacker can cheaply drive up the bill.

Caveat: this backend runs as an AWS Lambda behind a Function URL, so each
container has its own process memory — this limiter only throttles requests
landing on the same warm container, not global request volume. It is a
best-effort mitigation for sustained abuse from one source, not a substitute
for a WAF/API-Gateway-level rate limit if that becomes necessary.
"""

import threading
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] < cutoff:
                hits.pop(0)
            if len(hits) >= self.max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests, please try again later",
                )
            hits.append(now)


def rate_limit(max_requests: int, window_seconds: float):
    """FastAPI dependency factory: limits requests per client IP."""
    limiter = InMemoryRateLimiter(max_requests, window_seconds)

    def _dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        limiter.check(client_ip)

    return _dependency
