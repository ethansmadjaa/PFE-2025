import os
import tempfile
from typing import List, Tuple

import torch
import torchaudio
import torchaudio.transforms as T
from tangoflux import TangoFluxInference
from transformers import AutoProcessor, MusicgenForConditionalGeneration


class AudioGenerator:
    """Handles audio generation using TangoFlux and MusicGen models."""

    def __init__(self):
        """Initialize the models."""
        self.tangoflux_model = None
        self.musicgen_model = None
        self.musicgen_processor = None

    def load_model(self):
        """Load the TangoFlux and MusicGen models."""
        self.device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        print(f"Using device: {self.device}")

        if self.tangoflux_model is None:
            print("Loading TangoFlux model...")
            self.tangoflux_model = TangoFluxInference(name="declare-lab/TangoFlux")
            print("TangoFlux model loaded successfully!")
        
        if self.musicgen_model is None:
            print("Loading MusicGen model...")
            self.musicgen_processor = AutoProcessor.from_pretrained("facebook/musicgen-small")
            self.musicgen_model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small").to(self.device)
            print("MusicGen model loaded successfully!")

    def _generate_musicgen(self, description: str, duration: int = 10) -> torch.Tensor:
        """Generate melody using MusicGen."""
        if self.musicgen_model is None:
            raise RuntimeError("MusicGen model not loaded.")

        print(f"   🎵 MusicGen generating: {description[:50]}...")
        inputs = self.musicgen_processor(
            text=[description],
            padding=True,
            return_tensors="pt",
        )
        
        # Move inputs to device
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        # Calculate tokens (MusicGen is roughly 50 tokens/sec, 256 tokens ~ 5s)
        # So 10s ~= 512 tokens. Let's use duration * 52 to be safe.
        max_new_tokens = int(duration * 51.2) 
        
        audio_values = self.musicgen_model.generate(**inputs, max_new_tokens=max_new_tokens)
        
        # audio_values shape: (batch, channels, time) -> (1, 1, time)
        # Squeeze batch dimension: (1, time)
        audio_tensor = audio_values[0].cpu()
        
        # Resample from 32000 (MusicGen default) to 44100 (TangoFlux default)
        if self.musicgen_model.config.audio_encoder.sampling_rate != 44100:
            resampler = T.Resample(self.musicgen_model.config.audio_encoder.sampling_rate, 44100)
            audio_tensor = resampler(audio_tensor)
            
        return audio_tensor

    def generate_audio(
        self,
        description: str,
        steps: int = 50,
        duration: int = 10,
        model_type: str = "tangoflux"
    ):
        """
        Generate audio from a text description.

        Args:
            description: Text description of the audio to generate
            steps: Number of generation steps (default: 50)
            duration: Duration of audio in seconds (default: 10)
            model_type: "tangoflux" (for ambience) or "musicgen" (for melody)

        Returns:
            Generated audio tensor
        """
        if model_type == "musicgen":
            return self._generate_musicgen(description, duration)
            
        if self.tangoflux_model is None:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        return self.tangoflux_model.generate(
            description,
            steps=steps,
            duration=duration
        )

    def generate_sample_pack(
        self,
        descriptions: List[str],
        output_dir: str = None,
        steps: int = 30,
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
        # Note: This method is not used by main.py loop, but updated for completeness
        if self.tangoflux_model is None:
            self.load_model()

        if output_dir is None:
            output_dir = tempfile.mkdtemp()

        audio_files = []

        for idx, description in enumerate(descriptions, 1):
            print(f"Generating sample {idx}/{len(descriptions)}: {description}")

            # Heuristic: First 5 are musical (MusicGen), rest are ambience (TangoFlux)
            model_type = "musicgen" if idx <= 5 else "tangoflux"

            audio = self.generate_audio(
                description,
                steps=steps,
                duration=duration,
                model_type=model_type
            )

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
