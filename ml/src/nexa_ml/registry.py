"""In-process pipeline registry.

Serving processes register pipelines at start-up and resolve them by name per request. Registration
is explicit (duplicates raise) so a config mistake fails during boot, not on the first inference.
"""

from __future__ import annotations

from nexa_ml.pipelines.base import Pipeline


class PipelineRegistry:
    def __init__(self) -> None:
        self._pipelines: dict[str, Pipeline] = {}

    def register(self, pipeline: Pipeline, *, override: bool = False) -> None:
        if pipeline.name in self._pipelines and not override:
            raise ValueError(f"Pipeline '{pipeline.name}' is already registered.")
        self._pipelines[pipeline.name] = pipeline

    def unregister(self, name: str) -> None:
        self._pipelines.pop(name, None)

    def get(self, name: str) -> Pipeline:
        try:
            return self._pipelines[name]
        except KeyError:
            available = ", ".join(self.names()) or "none"
            raise KeyError(f"Unknown pipeline '{name}'. Registered: {available}.") from None

    def names(self) -> list[str]:
        return sorted(self._pipelines)

    def __len__(self) -> int:
        return len(self._pipelines)
