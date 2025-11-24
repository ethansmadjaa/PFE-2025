# Docker Setup Guide

This guide covers how to run the PFE-2025 audio generation application using Docker.

## Overview

The Docker setup includes:
- **FastAPI Application**: Your audio generation service
- **Ollama Service**: LLM service with llama3.2-vision and llama3.2 models
- **Persistent Model Storage**: All models are cached in Docker volumes (~25-30GB)

## Prerequisites

- Docker Engine 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose v2.0+ (included with Docker Desktop)
- **25-30GB free disk space** for model storage
- **16GB+ RAM recommended** (8GB minimum)
- *Optional*: NVIDIA GPU + [nvidia-docker](https://github.com/NVIDIA/nvidia-docker) for GPU acceleration

## Quick Start

### First Run (Downloads All Models)

```bash
# Start all services and download models
docker-compose up --build
```

This will:
1. Build the FastAPI container (~5 minutes)
2. Pull Ollama container
3. Download llama3.2-vision model (~8GB)
4. Download llama3.2 text model (~2GB)
5. Download TangoFlux audio model (~10GB)
6. Start both services

**Expected time**: 20-40 minutes depending on internet speed.

### Subsequent Runs

```bash
# Start services (uses cached models)
docker-compose up
```

**Expected time**: 30-60 seconds startup.

## Usage

Once running, the API is available at `http://localhost:8000`

### API Endpoints

1. **Health Check**
   ```bash
   curl http://localhost:8000/
   ```

2. **Generate Audio Sample Pack**
   ```bash
   curl -X POST http://localhost:8000/sample \
     -H "Content-Type: application/json" \
     -d '{"image": "BASE64_ENCODED_IMAGE"}' \
     --output sample_pack.zip
   ```

### Test Script

Use the included test script:

```bash
# Install dependencies locally (if not using Docker for client)
pip install requests

# Run test (requires image.jpg in project root)
python test.py
```

## Docker Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Just FastAPI app
docker-compose logs -f app

# Just Ollama
docker-compose logs -f ollama
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (deletes cached models!)
docker-compose down -v
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart just the app
docker-compose restart app
```

### Check Service Status

```bash
docker-compose ps
```

## GPU Support (Optional)

For faster audio generation, enable GPU support:

1. **Install NVIDIA Container Toolkit**
   ```bash
   # Ubuntu/Debian
   distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
   curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
   curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
     sudo tee /etc/apt/sources.list.d/nvidia-docker.list
   sudo apt-get update && sudo apt-get install -y nvidia-docker2
   sudo systemctl restart docker
   ```

2. **Enable GPU in docker-compose.yml**

   Uncomment the `deploy` sections in both `app` and `ollama` services:

   ```yaml
   deploy:
     resources:
       reservations:
         devices:
           - driver: nvidia
             count: 1
             capabilities: [gpu]
   ```

3. **Restart services**
   ```bash
   docker-compose down
   docker-compose up
   ```

## Troubleshooting

### Models Not Loading

If models fail to download:

```bash
# Check Ollama service logs
docker-compose logs ollama-init

# Manually pull models
docker-compose exec ollama ollama pull llama3.2-vision
docker-compose exec ollama ollama pull llama3.2
```

### Out of Memory Errors

Increase Docker's memory limit:
- Docker Desktop: Settings → Resources → Memory (set to 16GB+)
- Linux: Adjust system memory available to Docker

### Port Already in Use

If port 8000 or 11434 is taken:

```bash
# Check what's using the port
lsof -i :8000
lsof -i :11434

# Change ports in docker-compose.yml
ports:
  - "8001:8000"  # Change host port
```

### Slow Generation Without GPU

Audio generation is CPU-intensive. Each sample may take 2-5 minutes without GPU.
Consider enabling GPU support or using a smaller model.

### Connection Refused Errors

Ensure services are healthy:

```bash
# Check health status
docker-compose ps

# Wait for all services to be "healthy"
```

## Volume Management

Model storage is persisted in Docker volumes:

```bash
# List volumes
docker volume ls | grep pfe

# Inspect volume
docker volume inspect pfe-huggingface-models

# Remove all volumes (WARNING: Deletes all cached models!)
docker-compose down -v
```

## Development Mode

To enable hot-reload for development:

1. The `docker-compose.yml` already mounts your local directory
2. Changes to Python files will require restart:
   ```bash
   docker-compose restart app
   ```

## Production Deployment

For production:

1. Remove the volume mount in `docker-compose.yml`:
   ```yaml
   # Comment out this line:
   # - ./:/app
   ```

2. Set production environment variables
3. Use a reverse proxy (nginx/traefik) for HTTPS
4. Configure proper logging and monitoring

## Resource Usage

Expected resource consumption:

| Component | Disk | RAM | CPU |
|-----------|------|-----|-----|
| Ollama Models | ~10GB | ~4-8GB | ~20-40% |
| HuggingFace Models | ~12GB | ~6-10GB | ~30-60% |
| Application | ~2GB | ~2GB | ~5-10% |
| **Total** | **~25GB** | **~16GB** | **Variable** |

## Support

For issues:
- Check logs: `docker-compose logs -f`
- Verify disk space: `df -h`
- Check Docker resources: `docker stats`
- Review Docker compose status: `docker-compose ps`

## Clean Uninstall

To completely remove everything:

```bash
# Stop and remove containers, networks, volumes
docker-compose down -v

# Remove Docker images
docker rmi $(docker images 'pfe-*' -q)

# Remove any dangling volumes
docker volume prune
```
