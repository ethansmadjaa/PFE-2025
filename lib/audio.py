import os
import tempfile
from typing import List, Tuple

import torchaudio
from tangoflux import TangoFluxInference


class AudioGenerator:
    """Handles audio generation using TangoFlux model."""

    def __init__(self):
        """Initialize the TangoFlux model."""
        self.model = None

    def load_model(self):
        """Load the TangoFlux model."""
        if self.model is None:
            print("Loading TangoFlux model...")
            self.model = TangoFluxInference(name="declare-lab/TangoFlux")
            print("TangoFlux model loaded successfully!")

    def generate_audio(
        self,
        description: str,
        steps: int = 50,
        duration: int = 10
    ):
        """
        Generate audio from a text description.

        Args:
            description: Text description of the audio to generate
            steps: Number of generation steps (default: 50)
            duration: Duration of audio in seconds (default: 10)

        Returns:
            Generated audio tensor
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        return self.model.generate(
            description,
            steps=steps,
            duration=duration
        )

    def generate_sample_pack(
        self,
        descriptions: List[str],
        output_dir: str = None,
        steps: int = 50,
        duration: int = 10,
        sample_rate: int = 44100
    ) -> List[Tuple[str, str]]:
        """
        Generate multiple audio samples from descriptions.

        Args:
            descriptions: List of text descriptions
            output_dir: Directory to save audio files (creates temp dir if None)
            steps: Number of generation steps per sample
            duration: Duration of each audio in seconds
            sample_rate: Audio sample rate

        Returns:
            List of tuples (audio_path, description)
        """
        if self.model is None:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        # Create output directory if not provided
        if output_dir is None:
            output_dir = tempfile.mkdtemp()

        audio_files = []

        for idx, description in enumerate(descriptions, 1):
            print(f"Generating sample {idx}/{len(descriptions)}: {description}")

            # Generate audio
            audio = self.generate_audio(
                description,
                steps=steps,
                duration=duration
            )

            # Save audio file
            audio_path = os.path.join(output_dir, f"sample_{idx:02d}.wav")
            torchaudio.save(audio_path, audio, sample_rate)
            audio_files.append((audio_path, description))

        return audio_files

    def save_audio(
        self,
        audio_tensor,
        output_path: str,
        sample_rate: int = 44100
    ):
        """
        Save audio tensor to file.

        Args:
            audio_tensor: Audio tensor to save
            output_path: Path to save the audio file
            sample_rate: Audio sample rate
        """
        torchaudio.save(output_path, audio_tensor, sample_rate)
