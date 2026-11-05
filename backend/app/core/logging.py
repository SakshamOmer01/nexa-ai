"""Logging configuration.

Development uses a readable console format; container and production environments emit one JSON
object per line so logs are directly ingestible by aggregators. Every record carries the
correlation id of the request that produced it.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

from app.core.context import get_request_id

_CONFIGURED = False
_RESERVED = frozenset(vars(logging.LogRecord("", 0, "", 0, "", (), None)))


class JsonFormatter(logging.Formatter):
    """Serialise log records as single-line JSON."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": get_request_id(),
        }
        for key, value in vars(record).items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO", *, json_output: bool = True) -> None:
    """Install a root handler once per process."""
    global _CONFIGURED

    root = logging.getLogger()
    level_value = getattr(logging, level.upper(), logging.INFO)
    if _CONFIGURED:
        root.setLevel(level_value)
        return

    handler = logging.StreamHandler(sys.stdout)
    if json_output:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")
        )

    root.handlers = [handler]
    root.setLevel(level_value)

    # Uvicorn installs its own handlers; route them through the root configuration instead.
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        logger = logging.getLogger(name)
        logger.handlers = []
        logger.propagate = True

    _CONFIGURED = True
