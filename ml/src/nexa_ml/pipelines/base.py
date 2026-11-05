"""Pipeline contract.

Every model behind the platform implements :class:`Pipeline`. Keeping the interface this small
makes it possible to swap a stub for a GPU-backed model without touching API code.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import ClassVar

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    input: str = Field(min_length=1, max_length=8192)
    parameters: dict[str, float | int | str | bool] = Field(default_factory=dict)


class PredictionResult(BaseModel):
    model: str
    output: str
    latency_ms: float = Field(ge=0)


class Pipeline(ABC):
    """A named, loadable predictor."""

    name: ClassVar[str]

    @abstractmethod
    def predict(self, request: PredictionRequest) -> PredictionResult:
        """Run inference for a single request."""

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<{type(self).__name__} name={self.name}>"
