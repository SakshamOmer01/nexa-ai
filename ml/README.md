# Nexa AI — ML workspace

Shared contracts for everything that trains or serves models. It is a library, not a service:
training jobs, notebooks and inference workers import these types so the rest of the platform can
depend on one interface.

```text
src/nexa_ml/
├── config.py            # environment-driven ML settings (paths, device, batch size)
├── pipelines/base.py    # Pipeline contract + typed prediction request/response
├── pipelines/echo.py    # reference implementation of the contract
└── registry.py          # name → pipeline registry used by serving code
```

## Usage

```python
from nexa_ml.pipelines.base import PredictionRequest
from nexa_ml.pipelines.echo import EchoPipeline
from nexa_ml.registry import PipelineRegistry

registry = PipelineRegistry()
registry.register(EchoPipeline())
result = registry.get("echo").predict(PredictionRequest(input="hello"))
```

## Development

```bash
pip install -e ".[dev]"
ruff check . && ruff format --check .
pytest
```

Heavy framework dependencies (PyTorch, Transformers, etc.) are intentionally not installed yet;
add them to the `inference` extra of the service that needs them, keeping this package lightweight.
