import json
import os
import tempfile
import zipfile
from contextlib import asynccontextmanager

import fastapi
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from lib.audio import AudioGenerator
from lib.describe import ImageAnalyzer
import logging


# Initialize services
audio_generator = AudioGenerator()
image_analyzer = ImageAnalyzer()


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


@app.get("/")
def read_root():
    return {"message": "Hello, World!"}


@app.get("/audio")
def get_audio():
    return FileResponse("output.wav")


@app.post("/sample")
async def generate_sample_pack(request: ImageRequest):
    """
    Generate a sample pack from an image:
    1. Decode base64 image
    2. Send to vision model to get audio descriptions
    3. Generate 10 audio samples with TangoFlux
    4. Return ZIP file with all samples
    """
    try:
        logging.info("Starting sample pack generation")

        # Analyze image and get audio descriptions
        logging.info("Analyzing image to get audio descriptions")
        audio_descriptions = image_analyzer.image_to_audio_descriptions(
            request.image_base64,
            num_descriptions=10
        )
        logging.info(f"Generated {len(audio_descriptions)} audio descriptions")

        # Generate audio samples
        logging.info("Generating audio samples...")
        temp_audio_dir = tempfile.mkdtemp()
        logging.debug(f"Created temporary directory: {temp_audio_dir}")

        audio_files = audio_generator.generate_sample_pack(
            descriptions=audio_descriptions,
            output_dir=temp_audio_dir,
            steps=50,
            duration=10
        )
        logging.info(f"Generated {len(audio_files)} audio files")

        # Create ZIP file with all samples
        logging.info("Creating ZIP file with all samples")
        zip_path = os.path.join(temp_audio_dir, "sample_pack.zip")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for audio_path, description in audio_files:
                zipf.write(audio_path, os.path.basename(audio_path))
                logging.debug(f"Added {os.path.basename(audio_path)} to ZIP")

            # Add a metadata file with descriptions
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
            logging.debug("Added metadata.json to ZIP")

        logging.info("Sample pack generated successfully!")

        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename="sample_pack.zip"
        )

    except ValueError as e:
        logging.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error generating sample pack: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error generating sample pack: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
