"""Fixed-window rate limiting for credential endpoints.

The limiter is intentionally small and dependency-free. Buckets live in process memory, which is
enough to blunt per-account password guessing and refresh-token replay attempts on a single API
instance; a deployment with several replicas needs a shared store (Redis or the database) so the
budget is global. That limitation, and the trusted-client-identity work it requires, is tracked as
Phase 2 in ``docs/phase-1.md``.

Keys are opaque strings supplied by the caller (``login:<email>``, ``refresh:<digest>``). They are
never logged, so an account identifier or token digest cannot leak through a log line.
"""

from __future__ import annotations

import math
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass

# Keep the bucket table bounded without walking it on every request: expired windows are dropped
# at most once per window, and only once the table has grown past this many keys.
_PRUNE_THRESHOLD = 1024


@dataclass(frozen=True, slots=True)
class RateLimitDecision:
    """Outcome of one limiter hit."""

    allowed: bool
    retry_after_seconds: int
    remaining: int


class FixedWindowRateLimiter:
    """Count hits per key inside a fixed window.

    A hit is recorded even when it is rejected, so repeated attempts cannot extend their own
    window by waiting for a reset. The clock is injectable so tests can advance time instead of
    sleeping.
    """

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._windows: dict[str, tuple[float, int]] = {}
        self._last_prune = clock()
        # sync code only: the lock protects against threadpool access from sync dependencies.
        self._lock = threading.Lock()

    def hit(self, key: str, *, limit: int, window_seconds: int) -> RateLimitDecision:
        """Record one hit for ``key`` and report whether it fits inside the budget."""
        if limit < 1:
            raise ValueError("limit must be at least 1")
        if window_seconds < 1:
            raise ValueError("window_seconds must be at least 1")

        now = self._clock()
        with self._lock:
            window_start, count = self._windows.get(key, (now, 0))
            elapsed = now - window_start
            if elapsed >= window_seconds:
                window_start, count = now, 0

            count += 1
            self._windows[key] = (window_start, count)
            self._prune_if_needed(now, window_seconds)

            if count > limit:
                retry_after = max(1, math.ceil(window_seconds - (now - window_start)))
                return RateLimitDecision(
                    allowed=False, retry_after_seconds=retry_after, remaining=0
                )

            return RateLimitDecision(
                allowed=True,
                retry_after_seconds=0,
                remaining=limit - count,
            )

    def reset(self) -> None:
        """Drop every bucket (used by tests and administrative scripts)."""
        with self._lock:
            self._windows.clear()
            self._last_prune = self._clock()

    def _prune_if_needed(self, now: float, window_seconds: int) -> None:
        if len(self._windows) < _PRUNE_THRESHOLD or now - self._last_prune < window_seconds:
            return
        cutoff = now - window_seconds
        self._windows = {
            key: (start, count) for key, (start, count) in self._windows.items() if start >= cutoff
        }
        self._last_prune = now
