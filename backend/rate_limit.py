"""
Minimal in-memory rate limiting for cheap-to-abuse, unauthenticated endpoints.

docs/history/2026-07-code-review.md flags /auth/google/verify, /auth/google/callback and
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


def _client_ip(request: Request) -> str:
    """Best-effort real client IP.

    In every deployed environment, /auth* is fronted by CloudFront
    (infra/lib/frontend-stack.ts routes it to the Lambda origin), which
    terminates the viewer's connection and opens its own to the origin — so
    request.client.host alone would be CloudFront's egress IP, not the
    visitor's, collapsing every visitor sharing that edge/origin path into
    one shared rate-limit bucket. CloudFront always sets
    CloudFront-Viewer-Address ("ip:port", overwriting any client-supplied
    value of the same name) on requests it forwards to a custom origin, so
    prefer that when present. A caller that reaches the Lambda Function URL
    directly (bypassing CloudFront) could still forge this header — accepted
    here since this limiter is already documented as best-effort abuse
    mitigation, not a hard security boundary.
    """
    viewer_address = request.headers.get("cloudfront-viewer-address")
    if viewer_address:
        # "ip:port" or "[ipv6]:port" -- strip the port.
        host = viewer_address.rsplit(":", 1)[0] if ":" in viewer_address else viewer_address
        return host.strip("[]") or "unknown"
    return request.client.host if request.client else "unknown"


class InMemoryRateLimiter:
    def __init__(self, max_requests: int, window_seconds: float):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def _sweep_stale_keys_locked(self, now: float, cutoff: float) -> None:
        """Drop keys with no hits left in the window.

        Only trimming the *current* key's own hit-list on each call bounds
        that one list's length, but never removes the (now-empty) list from
        the dict for a caller who never comes back — the dict would still
        grow by one entry per distinct key ever seen, for the container's
        lifetime. Sweep periodically (at most once per window) instead of on
        every call, so this stays O(1) amortized rather than O(distinct
        keys) per request.
        """
        if now - self._last_sweep < self.window_seconds:
            return
        self._last_sweep = now
        stale = [k for k, hits in self._hits.items() if not hits or hits[-1] < cutoff]
        for k in stale:
            del self._hits[k]

    def check(self, key: str) -> None:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            self._sweep_stale_keys_locked(now, cutoff)
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
        limiter.check(_client_ip(request))

    return _dependency
