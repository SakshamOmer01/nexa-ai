"""Health endpoints.

Two probes with different contracts:

* ``/api/v1/health/live``  — process liveness. Never touches I/O, always 200 while the app runs.
* ``/api/v1/health``       — readiness. Checks PostgreSQL and returns 503 when it is unavailable
  so orchestrators stop routing traffic instead of serving errors.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response, status

from app.api.deps import HealthServiceDep, SettingsDep
from app.schemas.health import HealthResponse, LivenessResponse, ServiceStatus

router = APIRouter(prefix="/health", tags=["health"])


def _uptime_seconds(request: Request) -> float:
    started_at: float = request.app.state.started_at_monotonic
    return time.monotonic() - started_at


@router.get(
    "/live",
    response_model=LivenessResponse,
    summary="Liveness probe",
    description="Cheap check that the API process is running. Does not touch the database.",
)
async def liveness(request: Request, settings: SettingsDep) -> LivenessResponse:
    return LivenessResponse(
        status=ServiceStatus.OK,
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        timestamp=datetime.now(tz=UTC),
        uptime_seconds=round(_uptime_seconds(request), 3),
    )


@router.get(
    "",
    response_model=HealthResponse,
    summary="Readiness probe",
    description="Reports PostgreSQL connectivity. Returns 503 when a dependency is down.",
    responses={503: {"model": HealthResponse, "description": "One or more dependencies down"}},
)
async def readiness(
    request: Request,
    response: Response,
    health: HealthServiceDep,
) -> HealthResponse:
    report = await health.readiness(uptime_seconds=_uptime_seconds(request))
    if report.status is ServiceStatus.DEGRADED:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return report
