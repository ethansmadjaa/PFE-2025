import json
import os
import tempfile
import zipfile
import uuid
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from typing import Optional
import threading

import fastapi
import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel

from lib.audio import AudioGenerator
from lib.describe import ImageAnalyzer
import logging


# Initialize services
audio_generator = AudioGenerator()
image_analyzer = ImageAnalyzer()


# Job status enum
class JobStatus(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


# Job storage (in-memory - for production use Redis or a database)
class Job:
    def __init__(self, job_id: str, image_base64: str):
        self.id = job_id
        self.image_base64 = image_base64
        self.status = JobStatus.PENDING
        self.progress = 0
        self.current_step = ""
        self.created_at = datetime.now()
        self.completed_at: Optional[datetime] = None
        self.zip_path: Optional[str] = None
        self.error: Optional[str] = None
        self.samples_generated = 0
        self.total_samples = 10


jobs: dict[str, Job] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Load models on startup and cleanup on shutdown.
    """
    # Startup: Load models
    print("Starting up: Loading models...")
    audio_generator.load_model()
    yield
    # Shutdown: Cleanup resources if needed
    print("Shutting down: Cleaning up resources...")


app = fastapi.FastAPI(lifespan=lifespan)


class ImageRequest(BaseModel):
    image_base64: str


class JobResponse(BaseModel):
    job_id: str
    status: str
    message: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    current_step: str
    samples_generated: int
    total_samples: int
    error: Optional[str] = None


def process_sample_pack(job_id: str):
    """
    Background task to process sample pack generation.
    Updates job status as it progresses.
    """
    job = jobs.get(job_id)
    if not job:
        return

    try:
        logging.info(f"[Job {job_id}] Starting sample pack generation")

        # Step 1: Analyze image
        job.status = JobStatus.ANALYZING
        job.current_step = "Analyzing artwork with AI..."
        job.progress = 5
        logging.info(f"[Job {job_id}] Analyzing image")

        audio_descriptions = image_analyzer.image_to_audio_descriptions(
            job.image_base64,
            num_descriptions=10
        )
        logging.info(f"[Job {job_id}] Generated {len(audio_descriptions)} audio descriptions")

        job.progress = 15
        job.current_step = "Generating audio samples..."

        # Step 2: Generate audio samples
        job.status = JobStatus.GENERATING
        temp_audio_dir = tempfile.mkdtemp()
        logging.debug(f"[Job {job_id}] Created temporary directory: {temp_audio_dir}")

        # Generate samples one by one to update progress
        audio_files = []
        for idx, description in enumerate(audio_descriptions, 1):
            job.current_step = f"Generating sample {idx}/{len(audio_descriptions)}..."
            job.samples_generated = idx - 1
            # Progress from 15% to 90% during generation
            job.progress = 15 + int((idx - 1) / len(audio_descriptions) * 75)

            logging.info(f"[Job {job_id}] Generating sample {idx}: {description[:50]}...")

            audio_tensor = audio_generator.generate_audio(
                description=description,
                steps=30,
                duration=10
            )
            audio_path = os.path.join(temp_audio_dir, f"sample_{idx:02d}.wav")
            audio_generator.save_audio(audio_tensor, audio_path)
            audio_files.append((audio_path, description))
            job.samples_generated = idx

        logging.info(f"[Job {job_id}] Generated {len(audio_files)} audio files")

        # Step 3: Create ZIP file
        job.current_step = "Packaging samples..."
        job.progress = 92
        logging.info(f"[Job {job_id}] Creating ZIP file")

        zip_path = os.path.join(temp_audio_dir, "sample_pack.zip")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for audio_path, description in audio_files:
                zipf.write(audio_path, os.path.basename(audio_path))

            metadata = {
                "samples": [
                    {
                        "filename": f"sample_{idx:02d}.wav",
                        "description": desc
                    }
                    for idx, (_, desc) in enumerate(audio_files, 1)
                ]
            }
            metadata_path = os.path.join(temp_audio_dir, "metadata.json")
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            zipf.write(metadata_path, "metadata.json")

        # Mark as completed
        job.status = JobStatus.COMPLETED
        job.progress = 100
        job.current_step = "Complete!"
        job.zip_path = zip_path
        job.completed_at = datetime.now()
        logging.info(f"[Job {job_id}] Sample pack generated successfully!")

    except Exception as e:
        logging.error(f"[Job {job_id}] Error: {str(e)}", exc_info=True)
        job.status = JobStatus.FAILED
        job.error = str(e)
        job.current_step = "Failed"


@app.get("/")
def read_root():
    return {"message": "Hello, World!"}


@app.get("/audio")
def get_audio():
    return FileResponse("output.wav")


@app.post("/sample", status_code=202, response_model=JobResponse)
async def create_sample_pack_job(request: ImageRequest, background_tasks: BackgroundTasks):
    """
    Start a sample pack generation job.
    Returns immediately with a job_id that can be used to check status.
    """
    job_id = str(uuid.uuid4())
    job = Job(job_id, request.image_base64)
    jobs[job_id] = job

    logging.info(f"Created job {job_id}")

    # Start processing in background thread (not async to avoid blocking)
    thread = threading.Thread(target=process_sample_pack, args=(job_id,))
    thread.start()

    return JobResponse(
        job_id=job_id,
        status="accepted",
        message="Sample pack generation started. Use GET /sample/{job_id} to check status."
    )


@app.get("/sample/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Get the status of a sample pack generation job.
    """
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job.id,
        status=job.status.value,
        progress=job.progress,
        current_step=job.current_step,
        samples_generated=job.samples_generated,
        total_samples=job.total_samples,
        error=job.error
    )


@app.get("/sample/{job_id}/download")
async def download_sample_pack(job_id: str):
    """
    Download the completed sample pack ZIP file.
    """
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job is not completed. Current status: {job.status.value}"
        )

    if not job.zip_path or not os.path.exists(job.zip_path):
        raise HTTPException(status_code=404, detail="Sample pack file not found")

    return FileResponse(
        job.zip_path,
        media_type="application/zip",
        filename="sample_pack.zip"
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
