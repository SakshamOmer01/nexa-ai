"""Request-scoped context shared by middleware, logging and services."""

from __future__ import annotations

from contextvars import ContextVar

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


def get_request_id() -> str:
    """Return the id of the request currently being handled, or ``-`` outside a request."""
    return request_id_ctx.get()
