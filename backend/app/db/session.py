"""Async engine and session management."""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.core.config import Settings


class Database:
    """Owns the SQLAlchemy engine and session factory for one application instance."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._engine: AsyncEngine = create_async_engine(
            settings.database_url,
            echo=settings.database_echo,
            pool_pre_ping=True,
            **self._engine_kwargs(settings),
        )
        self._session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
            bind=self._engine,
            expire_on_commit=False,
            autoflush=False,
        )

    @staticmethod
    def _engine_kwargs(settings: Settings) -> dict[str, Any]:
        if settings.database_url.startswith("sqlite"):
            # In-memory SQLite needs a shared connection and does not support pool sizing.
            return {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}}
        return {
            "pool_size": settings.database_pool_size,
            "max_overflow": settings.database_max_overflow,
            "pool_timeout": settings.database_pool_timeout_seconds,
        }

    @property
    def engine(self) -> AsyncEngine:
        return self._engine

    @property
    def session_factory(self) -> async_sessionmaker[AsyncSession]:
        return self._session_factory

    async def ping(self) -> None:
        """Round-trip the database; raises on failure."""
        async with self._engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

    async def dispose(self) -> None:
        """Release pooled connections during shutdown."""
        await self._engine.dispose()
