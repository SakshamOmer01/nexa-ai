"""Health and readiness checks."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from time import perf_counter

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.schemas.health import (
    DependencyHealth,
    DependencyStatus,
    HealthResponse,
    ServiceStatus,
)

logger = logging.getLogger(__name__)


class HealthService:
    """Builds health payloads for liveness and readiness probes."""

    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings

    async def check_database(self) -> DependencyHealth:
        """Round-trip a trivial query against PostgreSQL."""
        started = perf_counter()
        try:
            await self._session.execute(text("SELECT 1"))
        except Exception as exc:
            # A readiness probe is a boundary: any failure to run the query means "down". The
            # asyncpg driver raises raw OSError subclasses (e.g. ConnectionRefusedError) when it
            # cannot open a connection, and SQLAlchemy re-raises those unwrapped, so catching only
            # SQLAlchemyError would answer 500 during an outage instead of failing closed with 503.
            logger.warning("database_health_check_failed", extra={"error": type(exc).__name__})
            return DependencyHealth(
                name="postgresql",
                status=DependencyStatus.DOWN,
                latency_ms=round((perf_counter() - started) * 1000, 2),
                detail="database_unreachable",
            )
        return DependencyHealth(
            name="postgresql",
            status=DependencyStatus.UP,
            latency_ms=round((perf_counter() - started) * 1000, 2),
        )

    async def readiness(self, *, uptime_seconds: float) -> HealthResponse:
        """Return the full readiness report; callers map ``degraded`` to HTTP 503."""
        dependencies = [await self.check_database()]
        degraded = any(dep.status is DependencyStatus.DOWN for dep in dependencies)
        return HealthResponse(
            status=ServiceStatus.DEGRADED if degraded else ServiceStatus.OK,
            service=self._settings.app_name,
            version=self._settings.app_version,
            environment=self._settings.environment,
            timestamp=datetime.now(tz=UTC),
            uptime_seconds=round(uptime_seconds, 3),
            dependencies=dependencies,
        )
