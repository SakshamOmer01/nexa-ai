# syntax=docker/dockerfile:1

# --- Build the virtualenv ---------------------------------------------------
FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /build
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies before the source tree is copied: this layer is keyed only on
# pyproject.toml, so changing application code no longer reinstalls SQLAlchemy/FastAPI/etc. The
# pip cache mount keeps wheels across rebuilds even when that layer does have to run again.
COPY pyproject.toml README.md ./
RUN --mount=type=cache,target=/root/.cache/pip \
    python -c "import tomllib; print('\n'.join(tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']))" > /tmp/requirements.txt \
    && pip install -r /tmp/requirements.txt

# The package itself is installed without dependencies (already present above) and is the only
# layer invalidated by a source change.
COPY app ./app
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-deps .

# --- Runtime ----------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONFAULTHANDLER=1

WORKDIR /app

RUN groupadd --system --gid 1001 nexa \
    && useradd --system --uid 1001 --gid nexa --no-create-home nexa

COPY --from=builder /opt/venv /opt/venv
COPY --chown=nexa:nexa app ./app
COPY --chown=nexa:nexa alembic ./alembic
COPY --chown=nexa:nexa alembic.ini ./

USER nexa
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"

# Access logs are emitted by the app's request middleware; avoid duplicate lines.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--no-access-log"]
