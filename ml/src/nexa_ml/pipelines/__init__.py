"""Pipeline contracts and reference implementations."""

from nexa_ml.pipelines.base import Pipeline, PredictionRequest, PredictionResult
from nexa_ml.pipelines.echo import EchoPipeline

__all__ = ["EchoPipeline", "Pipeline", "PredictionRequest", "PredictionResult"]
