# Docker Setup Guide

Run the PFE-2025 audio generation stack (FastAPI + Ollama + TangoFlux) with Docker Compose.

## Prerequisites

- Docker Engine 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose v2.0+
- **25-30GB free disk space** (AI models)
- **16GB+ RAM** recommended (8GB minimum)
- *Optional*: NVIDIA GPU + [nvidia-docker](https://github.com/NVIDIA/nvidia-docker) for GPU acceleration

## Quick Start

```bash
# First run — builds image + downloads all models (~20-40 min)
docker-compose up --build

# Subsequent runs — uses cached models (~30-60s startup)
docker-compose up
```

This spins up 3 services:

| Service | Role | Port |
| ------- | ---- | ---- |
| `ollama` | Vision + text model server | 11434 |
| `ollama-init` | Pulls `qwen3-vl` + `llama3.2` on first boot | — |
| `app` | FastAPI backend + TangoFlux | 8000 |

## Usage

API available at `http://localhost:8000` once running.

```bash
# Health check
curl http://localhost:8000/

# Generate a sample pack from an image
curl -X POST http://localhost:8000/sample \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "BASE64_ENCODED_IMAGE"}'
# → {"job_id": "abc123", "status": "PENDING"}

# Poll status
curl http://localhost:8000/sample/abc123
# → {"status": "GENERATING", "progress": 60, "samples_generated": 6}

# Download ZIP when complete
curl http://localhost:8000/sample/abc123/download --output pack.zip
```

### Running Tests

```bash
# Requires image.jpg in project root
pip install requests
python test.py
```

## Common Docker Commands

```bash
# Logs
docker-compose logs -f          # All services
docker-compose logs -f app      # FastAPI only
docker-compose logs -f ollama   # Ollama only

# Lifecycle
docker-compose restart          # Restart all
docker-compose restart app      # Restart FastAPI only
docker-compose down             # Stop all
docker-compose down -v          # Stop + delete cached models

# Status
docker-compose ps
```

## GPU Support

For faster audio generation, enable NVIDIA GPU:

1. **Install NVIDIA Container Toolkit**

   ```bash
   distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
   curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
   curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
     sudo tee /etc/apt/sources.list.d/nvidia-docker.list
   sudo apt-get update && sudo apt-get install -y nvidia-docker2
   sudo systemctl restart docker
   ```

2. **Uncomment `deploy` sections** in `docker-compose.yml` for both `app` and `ollama`:

   ```yaml
   deploy:
     resources:
       reservations:
         devices:
           - driver: nvidia
             count: 1
             capabilities: [gpu]
   ```

3. **Restart**

   ```bash
   docker-compose down && docker-compose up
   ```

## Resource Usage

| Component | Disk | RAM | CPU |
| --------- | ---- | --- | --- |
| Ollama Models | ~10GB | ~4-8GB | ~20-40% |
| HuggingFace Models | ~12GB | ~6-10GB | ~30-60% |
| Application | ~2GB | ~2GB | ~5-10% |
| **Total** | **~25GB** | **~16GB** | **Variable** |

## Troubleshooting

### Models Not Loading

```bash
docker-compose logs ollama-init

# Manual pull if needed
docker-compose exec ollama ollama pull qwen3-vl
docker-compose exec ollama ollama pull llama3.2
```

### Out of Memory

- **Docker Desktop**: Settings → Resources → Memory → set to 16GB+
- **Linux**: Ensure sufficient system memory available to Docker

### Port Conflict

```bash
# Check what's using the port
lsof -i :8000
lsof -i :11434

# Or change host port in docker-compose.yml
ports:
  - "8001:8000"
```

### Slow Generation Without GPU

Audio generation is CPU-intensive — each sample can take 2-5 min without GPU. Enable GPU support above or use a smaller model.

### Connection Refused

```bash
# Ensure all services are healthy
docker-compose ps
```

## Volume Management

Models are persisted in Docker volumes:

```bash
docker volume ls | grep pfe
docker volume inspect pfe-huggingface-models

# Remove all volumes (deletes cached models!)
docker-compose down -v
```

## Development Mode

The `docker-compose.yml` mounts your local directory. Python file changes require a restart:

```bash
docker-compose restart app
```

## Production Deployment

1. Remove the volume mount in `docker-compose.yml`:

   ```yaml
   # - ./:/app
   ```

2. Set production environment variables
3. Use a reverse proxy (nginx/traefik) for HTTPS
4. Configure logging and monitoring

## Clean Uninstall

```bash
docker-compose down -v
docker rmi $(docker images 'pfe-*' -q)
docker volume prune
```
