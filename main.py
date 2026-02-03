import json
import os
import tempfile
import zipfile
import uuid
import shutil
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from typing import Optional
import threading

import fastapi
import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from src.lib.audio import AudioGenerator
from src.lib.describe import ImageAnalyzer
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

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
        self.temp_dir: Optional[str] = None  # Track temp directory for cleanup
        self.error: Optional[str] = None
        self.samples_generated = 0
        self.total_samples = 10


jobs: dict[str, Job] = {}


class RemixJob:
    def __init__(self, job_id: str, original_description: str, user_feedback: str):
        self.id = job_id
        self.original_description = original_description
        self.user_feedback = user_feedback
        self.status = JobStatus.PENDING
        self.progress = 0
        self.current_step = ""
        self.created_at = datetime.now()
        self.completed_at: Optional[datetime] = None
        self.audio_path: Optional[str] = None
        self.temp_dir: Optional[str] = None
        self.error: Optional[str] = None
        self.new_description: Optional[str] = None


remix_jobs: dict[str, RemixJob] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Load models on startup and cleanup on shutdown.
    """
    # Startup: Load models
    print("\n" + "="*80)
    print("🎵 Art to Audio Sample Pack Generator - Starting Up")
    print("="*80)
    print("Loading models...")
    audio_generator.load_model()
    print("\n✅ All models loaded successfully!")
    print("🚀 Server is ready to generate audio samples!")
    print("="*80 + "\n")
    yield
    # Shutdown: Cleanup resources if needed
    print("\n" + "="*80)
    print("👋 Shutting down: Cleaning up resources...")
    print("="*80 + "\n")


app = fastapi.FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ImageRequest(BaseModel):
    image_base64: str


class RemixRequest(BaseModel):
    original_description: str
    user_feedback: str


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


class RemixStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    current_step: str
    error: Optional[str] = None
    new_description: Optional[str] = None


def process_sample_pack(job_id: str):
    """
    Background task to process sample pack generation.
    Updates job status as it progresses.
    """
    job = jobs.get(job_id)
    if not job:
        return

    try:
        print("\n" + "="*80)
        print(f"🚀 STARTING JOB: {job_id}")
        print("="*80 + "\n")
        logging.info(f"[Job {job_id}] Starting sample pack generation")

        # Step 1: Analyze image
        print("\n" + "-"*80)
        print("📸 CHECKPOINT 1/4: Analyzing Image with AI")
        print("-"*80)
        job.status = JobStatus.ANALYZING
        job.current_step = "Analyzing artwork with AI..."
        job.progress = 5
        logging.info(f"[Job {job_id}] Step 1: Analyzing image with llama3.2-vision")

        audio_descriptions = image_analyzer.image_to_audio_descriptions(
            job.image_base64,
            num_descriptions=10
        )
        
        print(f"✅ Analysis complete! Generated {len(audio_descriptions)} audio descriptions")
        logging.info(f"[Job {job_id}] ✅ Generated {len(audio_descriptions)} audio descriptions")
        for i, desc in enumerate(audio_descriptions, 1):
            print(f"   {i}. {desc[:60]}...")

        job.progress = 15
        job.current_step = "Generating audio samples..."

        # Step 2: Generate audio samples
        print("\n" + "-"*80)
        print("🎵 CHECKPOINT 2/4: Generating Audio Samples")
        print("-"*80)
        job.status = JobStatus.GENERATING
        temp_audio_dir = tempfile.mkdtemp()
        job.temp_dir = temp_audio_dir  # Store for cleanup
        logging.info(f"[Job {job_id}] Step 2: Generating {len(audio_descriptions)} audio samples")
        print(f"📁 Temporary directory: {temp_audio_dir}\n")

        # Generate samples one by one to update progress
        audio_files = []
        for idx, description in enumerate(audio_descriptions, 1):
            job.current_step = f"Generating sample {idx}/{len(audio_descriptions)}..."
            job.samples_generated = idx - 1
            # Progress from 15% to 90% during generation
            job.progress = 15 + int((idx - 1) / len(audio_descriptions) * 75)

            print(f"   🎼 Generating sample {idx}/{len(audio_descriptions)}: {description[:50]}...")
            logging.info(f"[Job {job_id}] Generating sample {idx}/{len(audio_descriptions)}")

            # Heuristic: First 5 are musical (MusicGen), rest are ambience (TangoFlux)
            model_type = "musicgen" if idx <= 5 else "tangoflux"

            audio_tensor = audio_generator.generate_audio(
                description=description,
                steps=30,
                duration=10,
                model_type=model_type
            )
            audio_path = os.path.join(temp_audio_dir, f"sample_{idx:02d}.wav")
            audio_generator.save_audio(audio_tensor, audio_path)
            audio_files.append((audio_path, description))
            job.samples_generated = idx
            print(f"   ✅ Sample {idx}/{len(audio_descriptions)} complete!")

        print(f"\n✅ All {len(audio_files)} audio files generated successfully!")
        logging.info(f"[Job {job_id}] ✅ Generated {len(audio_files)} audio files")

        # Step 3: Create ZIP file
        print("\n" + "-"*80)
        print("📦 CHECKPOINT 3/4: Creating ZIP Package")
        print("-"*80)
        job.current_step = "Packaging samples..."
        job.progress = 92
        logging.info(f"[Job {job_id}] Step 3: Creating ZIP file")

        zip_path = os.path.join(temp_audio_dir, "sample_pack.zip")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for audio_path, description in audio_files:
                zipf.write(audio_path, os.path.basename(audio_path))
                print(f"   📄 Added: {os.path.basename(audio_path)}")

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
            print(f"   📄 Added: metadata.json")

        print(f"✅ ZIP package created: {zip_path}")

        # Mark as completed
        print("\n" + "-"*80)
        print("🎉 CHECKPOINT 4/4: Job Complete!")
        print("-"*80)
        job.status = JobStatus.COMPLETED
        job.progress = 100
        job.current_step = "Complete!"
        job.zip_path = zip_path
        job.completed_at = datetime.now()
        
        duration = (job.completed_at - job.created_at).total_seconds()
        print(f"✅ Sample pack generated successfully in {duration:.1f} seconds!")
        print(f"📦 Ready for download: {zip_path}")
        print("="*80 + "\n")
        logging.info(f"[Job {job_id}] ✅ Sample pack generated successfully in {duration:.1f}s")

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
async def download_sample_pack(job_id: str, background_tasks: BackgroundTasks):
    """
    Download the completed sample pack ZIP file.
    Automatically cleans up temporary files after download.
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

    # Schedule cleanup after file is sent
    def cleanup_job_files():
        try:
            if job.temp_dir and os.path.exists(job.temp_dir):
                shutil.rmtree(job.temp_dir)
                logging.info(f"[Job {job_id}] Cleaned up temporary directory: {job.temp_dir}")
        except Exception as e:
            logging.error(f"[Job {job_id}] Failed to cleanup: {str(e)}")

    background_tasks.add_task(cleanup_job_files)

    return FileResponse(
        job.zip_path,
        media_type="application/zip",
        filename="sample_pack.zip"
    )


def process_remix(job_id: str):
    """Background task to process a remix generation."""
    job = remix_jobs.get(job_id)
    if not job:
        return

    try:
        logging.info(f"[Remix {job_id}] Starting remix generation")

        # Step 1: Generate refined description via Ollama
        job.status = JobStatus.ANALYZING
        job.current_step = "Refining audio description with AI..."
        job.progress = 10

        new_description = image_analyzer.remix_description(
            job.original_description, job.user_feedback
        )
        job.new_description = new_description
        job.progress = 30
        logging.info(f"[Remix {job_id}] New description: {new_description}")

        # Step 2: Generate audio with TangoFlux
        job.status = JobStatus.GENERATING
        job.current_step = "Generating new audio sample..."
        job.progress = 40

        audio_tensor = audio_generator.generate_audio(
            description=new_description,
            steps=30,
            duration=10
        )

        temp_dir = tempfile.mkdtemp()
        job.temp_dir = temp_dir
        audio_path = os.path.join(temp_dir, "remix.wav")
        audio_generator.save_audio(audio_tensor, audio_path)
        job.audio_path = audio_path
        job.progress = 95
        logging.info(f"[Remix {job_id}] Audio saved to {audio_path}")

        # Done
        job.status = JobStatus.COMPLETED
        job.progress = 100
        job.current_step = "Complete!"
        job.completed_at = datetime.now()

        duration = (job.completed_at - job.created_at).total_seconds()
        logging.info(f"[Remix {job_id}] Completed in {duration:.1f}s")

    except Exception as e:
        logging.error(f"[Remix {job_id}] Error: {str(e)}", exc_info=True)
        job.status = JobStatus.FAILED
        job.error = str(e)
        job.current_step = "Failed"


@app.post("/remix", status_code=202, response_model=JobResponse)
async def create_remix_job(request: RemixRequest):
    """Start a remix job. Returns a job_id for polling."""
    job_id = str(uuid.uuid4())
    job = RemixJob(job_id, request.original_description, request.user_feedback)
    remix_jobs[job_id] = job

    logging.info(f"Created remix job {job_id}")

    thread = threading.Thread(target=process_remix, args=(job_id,))
    thread.start()

    return JobResponse(
        job_id=job_id,
        status="accepted",
        message="Remix generation started. Use GET /remix/{job_id} to check status."
    )


@app.get("/remix/{job_id}", response_model=RemixStatusResponse)
async def get_remix_status(job_id: str):
    """Get the status of a remix job."""
    job = remix_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Remix job not found")

    return RemixStatusResponse(
        job_id=job.id,
        status=job.status.value,
        progress=job.progress,
        current_step=job.current_step,
        error=job.error,
        new_description=job.new_description if job.status == JobStatus.COMPLETED else None,
    )


@app.get("/remix/{job_id}/download")
async def download_remix(job_id: str, background_tasks: BackgroundTasks):
    """Download the remixed audio WAV file."""
    job = remix_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Remix job not found")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Remix job is not completed. Current status: {job.status.value}"
        )

    if not job.audio_path or not os.path.exists(job.audio_path):
        raise HTTPException(status_code=404, detail="Remix audio file not found")

    def cleanup_remix_files():
        try:
            if job.temp_dir and os.path.exists(job.temp_dir):
                shutil.rmtree(job.temp_dir)
                logging.info(f"[Remix {job_id}] Cleaned up temporary directory")
        except Exception as e:
            logging.error(f"[Remix {job_id}] Failed to cleanup: {str(e)}")

    background_tasks.add_task(cleanup_remix_files)

    return FileResponse(
        job.audio_path,
        media_type="audio/wav",
        filename="remix.wav"
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
