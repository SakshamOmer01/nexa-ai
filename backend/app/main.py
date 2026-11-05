"""ASGI entrypoint.

``create_app`` is a factory so tests, scripts and the container all build the same app with
injectable settings. Run it with ``uvicorn app.main:app``.
"""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.api import system
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from app.db.session import Database

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build a fully configured FastAPI application."""
    config = settings or get_settings()
    configure_logging(config.log_level, json_output=not config.debug)

    database = Database(config)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        try:
            await database.ping()
            logger.info("database_connected")
        except SQLAlchemyError:
            # Do not crash-loop on a cold start: expose liveness and report readiness as down.
            logger.warning("database_unavailable_at_startup", exc_info=True)
        yield
        await database.dispose()
        logger.info("database_disposed")

    docs_enabled = config.is_docs_enabled
    app = FastAPI(
        title=config.app_name,
        version=config.app_version,
        description="Nexa AI platform API.",
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
        lifespan=lifespan,
    )

    app.state.settings = config
    app.state.db = database
    app.state.started_at_monotonic = time.monotonic()

    # Outermost middleware is added last: CORS → request context → security headers.
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Process-Time-Ms"],
    )

    register_exception_handlers(app)
    app.include_router(system.router)
    app.include_router(api_router, prefix=config.api_v1_prefix)
    return app


app = create_app()
