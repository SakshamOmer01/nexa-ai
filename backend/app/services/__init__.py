"""Domain services. Routers stay thin and delegate here."""

from app.services.health import HealthService

__all__ = ["HealthService"]
