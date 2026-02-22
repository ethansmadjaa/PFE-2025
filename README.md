# PFE-2025 — Image-to-Audio Sample Pack Generator

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

Upload an image → AI vision model extracts sonic implications → text model generates audio prompts → TangoFlux generates 10 WAV samples → download as ZIP.

Also supports **remix**: refine any individual sample with natural language feedback.

## Quick Start

### Prerequisites

- Python 3.11+
- [UV](https://docs.astral.sh/uv/) (Python package manager)
- [Node.js](https://nodejs.org/) 18+ and npm
- [Ollama](https://ollama.com/) running locally
- ~25GB disk space for AI models
- 16GB+ RAM recommended

### 1. Install and Pull Models

```bash
# Install UV if you don't have it
pip install uv

# Pull required Ollama models
ollama pull qwen3-vl        # Vision model (~8GB)
ollama pull llama3.2         # Text model (~2GB)

# Clone and install Python dependencies
git clone <repo-url> && cd PFE-2025
uv sync
```

### 2. Start the Backend

```bash
# Option A: Run locally (recommended for development)
uv run main.py
# Backend available at http://localhost:8000

# Option B: Run via Docker (includes Ollama)
docker-compose up --build
```

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
# Frontend available at http://localhost:3000
```

### 4. Use the App

Open `http://localhost:3000`, upload an image, and wait for your 10-sample audio pack.

## Using the Makefile

```bash
make front          # Next.js dev server (:3000)
make back           # Backend via Docker Compose (Ollama + FastAPI)
make back-local     # Backend locally: uv run main.py (:8000)
make all            # Both frontend + backend
make stop           # Stop Docker services
make clean          # Remove Docker volumes/containers
```

## Architecture

**Stack**: Next.js 16 (React 19, TypeScript) + FastAPI (Python 3.11) + Ollama + TangoFlux

```text
Frontend (:3000)                    Backend (:8000)
┌─────────────────┐                ┌──────────────────┐
│ page.tsx         │  base64 img   │ main.py          │
│  ↕ polls /api/* ├───────────────→│  Job + RemixJob  │
│ historyCache.ts  │  ZIP/WAV back │  (in-memory dict)│
│  (IndexedDB)    │←───────────────┤                  │
└─────────────────┘                └──────┬───────────┘
                                          │ threading
                                   ┌──────┴───────────┐
                                   │ src/lib/          │
                                   │  describe.py      │→ Ollama (vision+text)
                                   │  audio.py         │→ TangoFlux (WAV gen)
                                   │ src/templates/    │
                                   │  prompts.py       │→ Prompt templates
                                   └──────────────────┘
```

### AI Models

| Model      | Role                                               | Provider        |
| ---------- | -------------------------------------------------- | --------------- |
| `qwen3-vl` | Extracts sonic implications from image             | Ollama (vision) |
| `llama3.2` | Generates 10 structured audio prompts (JSON)       | Ollama (text)   |
| TangoFlux  | Text-to-audio generation (30 steps, 10s per sample)| HuggingFace     |

### Job Lifecycle

Every generation request follows: `PENDING → ANALYZING → GENERATING → COMPLETED/FAILED`

- Jobs are stored in in-memory Python dicts (`jobs`, `remix_jobs`)
- Processing runs in background threads
- Frontend polls status every 2 seconds

## API Endpoints

### Sample Pack Generation

```bash
# 1. Submit an image (base64-encoded)
curl -X POST http://localhost:8000/sample \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "..."}'
# → {"job_id": "abc123", "status": "PENDING"}

# 2. Poll for status
curl http://localhost:8000/sample/abc123
# → {"status": "GENERATING", "progress": 60, "samples_generated": 6, "total_samples": 10}

# 3. Download the ZIP when complete
curl http://localhost:8000/sample/abc123/download --output pack.zip
# → ZIP containing 10 WAV files + metadata.json
```

### Remix a Sample

```bash
# 1. Submit remix request with original description + feedback
curl -X POST http://localhost:8000/remix \
  -H "Content-Type: application/json" \
  -d '{"original_description": "warm ambient pad with reverb", "user_feedback": "make it darker and add more bass"}'
# → {"job_id": "xyz789", "status": "PENDING"}

# 2. Poll for status
curl http://localhost:8000/remix/xyz789
# → {"status": "COMPLETED", "new_description": "dark ambient bass drone with heavy reverb"}

# 3. Download the new WAV
curl http://localhost:8000/remix/xyz789/download --output remixed.wav
```

## Remix Feature

Users can remix any individual sample from the studio results or the history panel:

1. Click the Remix icon on a sample → `RemixDialog` opens
2. Write feedback (e.g., "more reverb", "different texture", "make it brighter")
3. Backend refines the description via Ollama → TangoFlux generates a new WAV
4. New audio replaces the current sample; old version is saved to history

**Versioning**: each sample stores up to 5 previous versions in IndexedDB. A version badge (`v2`, `v3`...) is shown in the UI.

## Project Structure

```text
PFE-2025/
├── main.py                          # FastAPI app, routes, job management
├── src/
│   ├── lib/
│   │   ├── describe.py              # ImageAnalyzer — Ollama vision/text calls
│   │   └── audio.py                 # AudioGenerator — TangoFlux model load/generate
│   └── templates/
│       └── prompts.py               # All prompt templates for Ollama
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Main UI — upload, progress, playback, history
│   │   └── api/                     # Next.js proxy routes → backend
│   │       ├── sample/              # POST /api/sample, GET status, GET download
│   │       └── remix/               # POST /api/remix, GET status, GET download
│   ├── components/
│   │   ├── RemixDialog.tsx          # Remix dialog UI + polling
│   │   ├── HistoryPanel.tsx         # History panel with thumbnails
│   │   ├── ProcessSection.tsx       # Sample generation workflow
│   │   └── ui/                      # Shadcn/Radix UI components
│   └── lib/
│       └── historyCache.ts          # IndexedDB wrapper for sample pack history
├── docker-compose.yml               # Ollama + FastAPI orchestration
├── Dockerfile                       # Multi-stage build for backend
├── Makefile                         # Dev commands (make front, make back, etc.)
├── pyproject.toml                   # Python deps (managed by UV)
└── test.py                          # Test suite
```

## Docker Setup

See [README.docker.md](README.docker.md) for the full Docker guide including GPU support, troubleshooting, and resource requirements.

Quick summary:

```bash
# First run (~20-40 min, downloads all models)
docker-compose up --build

# Subsequent runs (~30-60s startup)
docker-compose up

# Stop
docker-compose down

# Full cleanup (deletes cached models!)
docker-compose down -v
```

Docker Compose runs 3 services: `ollama` (model server), `ollama-init` (model puller), `app` (FastAPI).

## Running Tests

```bash
uv run test.py
```

## Development Notes

- Backend uses **UV** as package manager (not pip). Dependencies in `pyproject.toml`, lock in `uv.lock`.
- Frontend uses **npm** with standard Next.js App Router structure.
- Frontend API routes (`frontend/app/api/`) are **proxies** to the FastAPI backend at `localhost:8000`.
- CORS is hardcoded to `http://localhost:3000` in `main.py`.
- AI models load at server startup via FastAPI lifespan handler (~2 min cold start).
- Client-side history is stored in **IndexedDB** via `historyCache.ts`.
