"""Reusable request dependencies.

Resources live on ``app.state`` (created in the lifespan handler) so the app factory stays the
single place that owns infrastructure. Tests override these two functions to substitute
alternate settings or a database without patching modules.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.session import Database
from app.services.health import HealthService


def get_app_settings(request: Request) -> Settings:
    """Return the settings bound to this application instance."""
    return request.app.state.settings  # type: ignore[no-any-return]


def get_database(request: Request) -> Database:
    return request.app.state.db  # type: ignore[no-any-return]


async def get_db_session(
    database: Annotated[Database, Depends(get_database)],
) -> AsyncIterator[AsyncSession]:
    """Yield a session scoped to one request; the context manager rolls back on error."""
    async with database.session_factory() as session:
        yield session


def get_health_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> HealthService:
    return HealthService(session=session, settings=settings)


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]
HealthServiceDep = Annotated[HealthService, Depends(get_health_service)]
