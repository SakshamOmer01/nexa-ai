"""Nexa AI machine-learning workspace.

Provides the shared pipeline contract, a registry for serving code and environment-driven settings.
"""

from nexa_ml.config import MLSettings
from nexa_ml.pipelines.base import Pipeline, PredictionRequest, PredictionResult
from nexa_ml.registry import PipelineRegistry

__all__ = [
    "MLSettings",
    "Pipeline",
    "PipelineRegistry",
    "PredictionRequest",
    "PredictionResult",
]
