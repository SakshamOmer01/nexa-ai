"""Health-check contracts."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class ServiceStatus(StrEnum):
    OK = "ok"
    DEGRADED = "degraded"


class DependencyStatus(StrEnum):
    UP = "up"
    DOWN = "down"


class DependencyHealth(BaseModel):
    name: str
    status: DependencyStatus
    latency_ms: float | None = Field(default=None, ge=0)
    detail: str | None = None


class LivenessResponse(BaseModel):
    status: ServiceStatus = ServiceStatus.OK
    service: str
    version: str
    environment: str
    timestamp: datetime
    uptime_seconds: float = Field(ge=0)


class HealthResponse(LivenessResponse):
    """Readiness payload: liveness fields plus every checked dependency."""

    dependencies: list[DependencyHealth] = Field(default_factory=list)
