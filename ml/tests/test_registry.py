from __future__ import annotations

import pytest

from nexa_ml.pipelines.base import PredictionRequest
from nexa_ml.pipelines.echo import EchoPipeline
from nexa_ml.registry import PipelineRegistry


def test_register_and_resolve() -> None:
    registry = PipelineRegistry()
    pipeline = EchoPipeline()

    registry.register(pipeline)

    assert registry.get("echo") is pipeline
    assert registry.names() == ["echo"]
    assert len(registry) == 1


def test_duplicate_registration_is_rejected() -> None:
    registry = PipelineRegistry()
    registry.register(EchoPipeline())

    with pytest.raises(ValueError, match="already registered"):
        registry.register(EchoPipeline())

    registry.register(EchoPipeline(), override=True)
    assert len(registry) == 1


def test_unknown_pipeline_reports_available_names() -> None:
    registry = PipelineRegistry()
    registry.register(EchoPipeline())

    with pytest.raises(KeyError, match="echo"):
        registry.get("missing")


def test_echo_pipeline_predicts() -> None:
    result = EchoPipeline().predict(PredictionRequest(input="hello", parameters={"prefix": ">"}))

    assert result.model == "echo"
    assert result.output == ">hello"
    assert result.latency_ms >= 0


def test_empty_input_is_rejected() -> None:
    with pytest.raises(ValueError):
        PredictionRequest(input="")
