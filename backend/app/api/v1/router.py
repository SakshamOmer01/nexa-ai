"""v1 router composition.

Each feature adds one ``router.include_router(...)`` line here; endpoint modules stay unaware of
the version prefix.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, health

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(health.router)

__all__ = ["api_router"]
