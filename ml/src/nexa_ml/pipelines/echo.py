"""Reference pipeline.

Useful as a smoke-test target for serving infrastructure before a real model exists.
"""

from __future__ import annotations

import time

from nexa_ml.pipelines.base import Pipeline, PredictionRequest, PredictionResult


class EchoPipeline(Pipeline):
    name = "echo"

    def predict(self, request: PredictionRequest) -> PredictionResult:
        started = time.perf_counter()
        prefix = str(request.parameters.get("prefix", ""))
        elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
        return PredictionResult(
            model=self.name,
            output=f"{prefix}{request.input}",
            latency_ms=elapsed_ms,
        )
