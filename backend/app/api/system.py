"""Unversioned infrastructure routes.

Load balancers and container runtimes probe stable, prefix-free paths, so these stay outside the
``/api/v1`` surface and keep their shape across API versions.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.api.deps import SettingsDep
from app.schemas.health import LivenessResponse, ServiceStatus


class ServiceInfo(BaseModel):
    name: str
    version: str
    environment: str
    api_prefix: str
    docs_url: str | None


router = APIRouter(tags=["system"])


def _uptime_seconds(request: Request) -> float:
    return time.monotonic() - request.app.state.started_at_monotonic


@router.get("/", response_model=ServiceInfo, summary="Service metadata")
async def service_info(settings: SettingsDep) -> ServiceInfo:
    return ServiceInfo(
        name=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        api_prefix=settings.api_v1_prefix,
        docs_url="/docs" if settings.is_docs_enabled else None,
    )


@router.get(
    "/health",
    response_model=LivenessResponse,
    summary="Liveness alias",
    description="Prefix-free liveness probe for container and load-balancer health checks.",
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
