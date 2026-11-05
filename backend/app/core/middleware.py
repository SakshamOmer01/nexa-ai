"""Pure ASGI middleware.

Implemented as raw ASGI (not ``BaseHTTPMiddleware``) to keep streaming responses and context
variable propagation intact with no extra task per request.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from typing import ClassVar

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.context import request_id_ctx

logger = logging.getLogger("app.request")

_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
_MAX_LOGGED_PATH = 256


class RequestContextMiddleware:
    """Attach a correlation id, time the request and log a single completion record."""

    def __init__(self, app: ASGIApp, *, header_name: str = "X-Request-ID") -> None:
        self.app = app
        self.header_name = header_name

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = self._resolve_request_id(scope)
        token = request_id_ctx.set(request_id)
        started = time.perf_counter()
        status_code = 500

        async def send_with_metadata(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = MutableHeaders(scope=message)
                headers[self.header_name] = request_id
                headers["X-Process-Time-Ms"] = f"{(time.perf_counter() - started) * 1000:.2f}"
            await send(message)

        try:
            await self.app(scope, receive, send_with_metadata)
        finally:
            logger.info(
                "http_request",
                extra={
                    "http_method": scope.get("method"),
                    "http_path": str(scope.get("path", ""))[:_MAX_LOGGED_PATH],
                    "http_status": status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            request_id_ctx.reset(token)

    def _resolve_request_id(self, scope: Scope) -> str:
        """Reuse a well-formed inbound id, otherwise mint a new one."""
        for raw_key, raw_value in scope.get("headers", []):
            if raw_key.decode("latin-1").lower() == self.header_name.lower():
                candidate = raw_value.decode("latin-1")
                if _REQUEST_ID_PATTERN.match(candidate):
                    return candidate
        return uuid.uuid4().hex


class SecurityHeadersMiddleware:
    """Apply conservative browser hardening headers to every response."""

    _HEADERS: ClassVar[dict[str, str]] = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    }

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for key, value in self._HEADERS.items():
                    headers.setdefault(key, value)
            await send(message)

        await self.app(scope, receive, send_with_headers)
