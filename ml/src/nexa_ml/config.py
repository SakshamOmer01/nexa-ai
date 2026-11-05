"""ML workspace configuration.

All variables use the ``NEXA_ML_`` prefix so an ML process can share an environment with the API
without collisions.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class MLSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="NEXA_ML_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "test", "staging", "production"] = "development"
    model_dir: Path = Path("artifacts")
    device: Literal["cpu", "cuda", "mps"] = "cpu"
    max_batch_size: int = Field(default=32, ge=1, le=4096)
    random_seed: int = Field(default=1337, ge=0)


@lru_cache(maxsize=1)
def get_ml_settings() -> MLSettings:
    return MLSettings()
