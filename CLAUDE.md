# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Image-to-audio sample pack generator. Upload an image → AI vision model extracts sonic implications → text model generates audio prompts → TangoFlux generates 10 WAV samples → packaged as ZIP. Also supports "remix" (refine a single sample description with user feedback).

## Commands

```bash
# Development
make front          # Next.js dev server (:3000)
make back           # Backend via Docker Compose (Ollama + FastAPI)
make back-local     # Backend locally: uv run main.py (:8000)
make all            # Both frontend + backend
make stop           # Stop Docker services
make clean          # Nuke Docker volumes/containers

# Frontend only
cd frontend && npm run dev      # Dev server
cd frontend && npm run build    # Production build
cd frontend && npm run lint     # ESLint

# Backend only
uv sync             # Install/sync Python deps
uv run main.py      # FastAPI server
uv run test.py      # Tests

# Docker
docker-compose up --build   # First run
docker-compose up           # Subsequent runs
```

## Architecture

**Stack**: Next.js 16 (React 19, TS) + FastAPI (Python 3.11) + Ollama + TangoFlux

```
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

**Frontend API routes** (`frontend/app/api/`) are proxies to the FastAPI backend — they forward requests to `localhost:8000`.

**Job lifecycle**: `PENDING → ANALYZING → GENERATING → COMPLETED/FAILED`
- Jobs stored in-memory Python dicts (`jobs`, `remix_jobs`)
- Processing runs in background threads (not async)
- Frontend polls status every 2s

**AI models** (configured in `src/lib/describe.py` and `src/templates/prompts.py`):
- Vision: `qwen3-vl` via Ollama — extracts sonic implications from image
- Text: `llama3.2` via Ollama — generates 10 structured audio prompts (JSON)
- Audio: TangoFlux — text-to-audio, 30 steps, 10s duration per sample

**Client-side storage**: IndexedDB via `frontend/lib/historyCache.ts` — caches generated sample packs for history panel.

## Remix Feature

User can remix any individual sample — from studio results or history panel.

**Flow**:

1. User clicks Remix (RefreshCw icon) on a sample → `RemixDialog` opens
2. User writes feedback (what to change: more reverb, different texture, etc.)
3. Frontend sends `POST /api/remix` with `{original_description, user_feedback}` (stateless — backend has no persistence, frontend sends the description it already has in IndexedDB)
4. Backend: Ollama (llama3.2) refines description via `REMIX_PROMPT` → TangoFlux generates new WAV
5. Frontend polls `GET /api/remix/{jobId}`, then downloads `GET /api/remix/{jobId}/download`
6. New audio replaces current; old version pushed to `sample.versions[]` in IndexedDB (capped at 5)

**Versioning**: each sample has optional `versions: AudioSampleVersion[]`. On remix, current {audioBlob, description, timestamp} is pushed to versions before replacement. Version badge (`v2`, `v3`...) shown in UI.

**Key files**: `RemixDialog.tsx` (dialog UI + polling), `REMIX_PROMPT` in `prompts.py`, `remix_description()` in `describe.py`, remix endpoints in `main.py`, `remixSample()` in `historyCache.ts`.

## Key Files

| File | Role |
|------|------|
| `main.py` | FastAPI app, job classes, all API routes, background processing |
| `src/lib/describe.py` | `ImageAnalyzer` — Ollama vision/text calls |
| `src/lib/audio.py` | `AudioGenerator` — TangoFlux model load/generate/save |
| `src/templates/prompts.py` | All prompt templates for Ollama |
| `frontend/app/page.tsx` | Main UI — upload, progress, playback, history |
| `frontend/lib/historyCache.ts` | IndexedDB wrapper for sample pack history |
| `frontend/app/api/sample/route.ts` | Proxy: POST /api/sample → backend |
| `frontend/app/api/remix/` | Proxy: remix endpoints → backend |

## Conventions

- Backend uses `uv` as package manager (not pip). Deps in `pyproject.toml`, lock in `uv.lock`.
- Frontend uses npm. Standard Next.js App Router structure.
- CORS hardcoded to `http://localhost:3000` in `main.py`.
- Models load at server startup via FastAPI lifespan handler (expensive, ~2min).
- Docker Compose runs 3 services: `ollama`, `ollama-init` (model puller), `app` (FastAPI).
