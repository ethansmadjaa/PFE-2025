# Multi-stage build for Python FastAPI application with ML models
FROM ghcr.io/astral-sh/uv:python3.11-bookworm AS builder

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies using UV
RUN uv sync --frozen

# Copy application code
COPY . .

# Set environment variables for model caching during build
ENV HF_HOME=/app/models/huggingface \
    TRANSFORMERS_CACHE=/app/models/huggingface \
    TORCH_HOME=/app/models/torch

# Create cache directories and pre-download TangoFlux model
RUN mkdir -p /app/models/huggingface /app/models/torch && \
    /app/.venv/bin/python download_models.py

# Final stage
FROM python:3.11-slim-bookworm

# Set working directory
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy UV and virtual environment from builder
COPY --from=builder /app/.venv /app/.venv
# Copy application code from builder
COPY --from=builder /app /app
# Copy cached models from builder
COPY --from=builder /app/models /app/models

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/models/huggingface \
    TRANSFORMERS_CACHE=/app/models/huggingface \
    TORCH_HOME=/app/models/torch

# Create directories for audio output (models are already copied from builder)
RUN mkdir -p /tmp/audio

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/')" || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
