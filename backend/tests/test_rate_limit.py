"""
Tests for rate_limit.py: real-client-IP resolution behind CloudFront, and
bounded memory growth in the in-memory limiter.
"""

import time
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from rate_limit import InMemoryRateLimiter, _client_ip


def _request(headers=None, client_host="1.2.3.4"):
    return SimpleNamespace(
        headers=headers or {},
        client=SimpleNamespace(host=client_host) if client_host else None,
    )


# ---------------------------------------------------------------------------
# _client_ip
# ---------------------------------------------------------------------------


def test_client_ip_falls_back_to_request_client_when_no_cf_header():
    req = _request(headers={}, client_host="203.0.113.7")
    assert _client_ip(req) == "203.0.113.7"


def test_client_ip_prefers_cloudfront_viewer_address_ipv4():
    req = _request(
        headers={"cloudfront-viewer-address": "198.51.100.23:54321"},
        client_host="10.0.0.5",  # would be CloudFront's own egress IP
    )
    assert _client_ip(req) == "198.51.100.23"


def test_client_ip_prefers_cloudfront_viewer_address_ipv6():
    req = _request(
        headers={"cloudfront-viewer-address": "[2001:db8::1]:54321"},
        client_host="10.0.0.5",
    )
    assert _client_ip(req) == "2001:db8::1"


def test_client_ip_handles_missing_client_gracefully():
    req = _request(headers={}, client_host=None)
    assert _client_ip(req) == "unknown"


# ---------------------------------------------------------------------------
# InMemoryRateLimiter: core throttling behavior unchanged
# ---------------------------------------------------------------------------


def test_limiter_allows_up_to_max_then_rejects():
    limiter = InMemoryRateLimiter(max_requests=3, window_seconds=60)
    limiter.check("k")
    limiter.check("k")
    limiter.check("k")
    with pytest.raises(HTTPException) as exc_info:
        limiter.check("k")
    assert exc_info.value.status_code == 429


def test_limiter_tracks_keys_independently():
    limiter = InMemoryRateLimiter(max_requests=1, window_seconds=60)
    limiter.check("a")
    limiter.check("b")  # different key -- must not be throttled by a's hit
    with pytest.raises(HTTPException):
        limiter.check("a")


# ---------------------------------------------------------------------------
# InMemoryRateLimiter: unbounded-growth fix
# ---------------------------------------------------------------------------


def test_stale_keys_are_swept_and_dict_does_not_grow_unboundedly(monkeypatch):
    fake_now = [1_000.0]
    monkeypatch.setattr(time, "monotonic", lambda: fake_now[0])
    limiter = InMemoryRateLimiter(max_requests=5, window_seconds=10)

    # 50 distinct one-off callers, each never seen again.
    for i in range(50):
        limiter.check(f"caller-{i}")
    assert len(limiter._hits) == 50

    # Advance well past the window and beyond the sweep's own gating
    # (sweep runs at most once per window_seconds) so a fresh check triggers
    # a sweep that finds all 50 entries fully expired.
    fake_now[0] += 100.0
    limiter.check("caller-new")

    # Only the just-added key should remain -- the 50 stale ones were
    # reclaimed instead of sitting in the dict forever.
    assert len(limiter._hits) == 1
    assert "caller-new" in limiter._hits


def test_sweep_does_not_evict_a_still_active_key(monkeypatch):
    fake_now = [1_000.0]
    monkeypatch.setattr(time, "monotonic", lambda: fake_now[0])
    limiter = InMemoryRateLimiter(max_requests=5, window_seconds=10)

    limiter.check("idle-caller")
    fake_now[0] += 5.0  # still within idle-caller's window
    limiter.check("active-caller")

    fake_now[0] += 11.0  # idle-caller's single hit is now stale; sweep fires
    limiter.check("active-caller")  # active-caller keeps hitting -> stays live

    assert "idle-caller" not in limiter._hits
    assert "active-caller" in limiter._hits
