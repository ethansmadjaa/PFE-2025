import base64
import json
import os
import tempfile
from typing import List

import ollama

from constants import DESCRIBE_PROMPT


class ImageAnalyzer:
    """Handles image analysis and audio description generation using Ollama vision models."""

    def __init__(
        self, vision_model: str = "llama3.2-vision", text_model: str = "llama3.2"
    ):
        """
        Initialize the image analyzer.

        Args:
            vision_model: Ollama vision model to use for image analysis
            text_model: Ollama text model to use for generating descriptions
        """
        self.vision_model = vision_model
        self.text_model = text_model

        # Configure Ollama client with host from environment
        ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.client = ollama.Client(host=ollama_host)

    def analyze_image_from_base64(self, image_base64: str) -> str:
        """
        Analyze an image from base64 string.

        Args:
            image_base64: Base64 encoded image

        Returns:
            Vision model's analysis of the image
        """
        # Decode base64 image
        image_data = base64.b64decode(image_base64)

        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_image:
            temp_image.write(image_data)
            temp_image_path = temp_image.name

        try:
            return self.analyze_image_from_path(temp_image_path)
        finally:
            # Cleanup
            import os

            if os.path.exists(temp_image_path):
                os.unlink(temp_image_path)

    def analyze_image_from_path(self, image_path: str) -> str:
        """
        Analyze an image file using vision model.

        Args:
            image_path: Path to the image file

        Returns:
            Vision model's analysis of the image
        """
        print(f"Analyzing image with {self.vision_model}...")

        response = self.client.chat(
            model=self.vision_model,
            messages=[
                {"role": "user", "content": DESCRIBE_PROMPT, "images": [image_path]}
            ],
        )

        vision_output = response.message.content
        print(f"Vision model response: {vision_output}")

        return vision_output

    def generate_audio_descriptions(
        self, vision_analysis: str, num_descriptions: int = 10
    ) -> List[str]:
        """
        Generate audio descriptions from vision analysis.

        Args:
            vision_analysis: The vision model's analysis of the image
            num_descriptions: Number of audio descriptions to generate

        Returns:
            List of audio descriptions
        """
        print(f"Generating {num_descriptions} audio descriptions...")

        prompt = f"""Based on this image analysis:

        {vision_analysis}

        Generate exactly {num_descriptions} highly distinct sound design samples. All samples MUST be coherent with the visual mood, colors, atmosphere, and emotional tone of the image.

        FORMAT TO FOLLOW STRICTLY:

        - 14 Loops
        • Drones × 2
            - (4 bars) sustained harmonic clusters
            - (4 bars) single-note drones centered on one root note
        • Piano melody × 1
            - (4 bars) melodic piano phrase with emotional progression
        • Textures × 5
            - (2 bars) granular textures (transformed field recordings)
            - (2 bars) organic noises (wind, friction, water, resonant metal)
            - (2 bars) spatial ambiance (pink noise, synthetic wind, HF halos)
            - (1 bar) microtextures moving across the spectrum (shimmers, crackles, sparkles)
        • Low-end / rumbles × 2
            - (2 bars) deep atmospheric sub-bass layers
        • Pads × 3
            - (2 bars) textured pads (granular, analog, modular)

        - 3 Rhythmic Loops
        • (1 bar) soft percussive clicks / tacs / glitch ticks
        • (1 bar) low-frequency pulses (felt kick, sub pulses)
        • (1 bar) slow modular shakers / grain sequences

        - 4 One-shots
        • (1/2 bar) soft impacts (wood, light metal, reverberant hits) ×2
        • (1/2 bar) abstract percussive strike
        • (1/2 bar) atmospheric pluck without sharp transient

        RULES:
        1. Use the categories above as structural templates but adapt to the image mood.
        2. The prompts you generate must be very imaged and not technical - include colors, mood, ambiance, etc.
        3. Be specific, realistic, and musically usable.
        4. All {num_descriptions} samples must belong to different sub-types of the list above.
        5. Output MUST be a Python list of {num_descriptions} items, each item a single-sentence description.
        6. All notes must be in the same scale of notes (ex: C-minor, G-major, etc.)

        Example of final format (structure only):
        [
            "Sample 1 description...",
            "Sample 2 description...",
            ...
            "Sample {num_descriptions} description..."
        ]"""

        response = self.client.chat(
            model=self.text_model,
            messages=[{"role": "user", "content": prompt}],
            format={
                "type": "object",
                "properties": {
                    "descriptions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": num_descriptions,
                        "maxItems": num_descriptions,
                    }
                },
                "required": ["descriptions"],
            },
        )

        descriptions_text = response.message.content.strip()
        print(f"Descriptions response: {descriptions_text}")

        # Parse JSON
        try:
            response_data = json.loads(descriptions_text)

            # Extract the descriptions array from the structured response
            if isinstance(response_data, dict) and "descriptions" in response_data:
                audio_descriptions = response_data["descriptions"]
            elif isinstance(response_data, list):
                # Fallback: handle if model returns raw array despite schema
                audio_descriptions = response_data
            else:
                raise ValueError(
                    "Response does not contain 'descriptions' key or is not a valid structure"
                )

            # Validate it's a list
            if not isinstance(audio_descriptions, list):
                raise ValueError("Descriptions is not an array")

            # Trim or pad to exact number (as safety net)
            if len(audio_descriptions) > num_descriptions:
                audio_descriptions = audio_descriptions[:num_descriptions]
            elif len(audio_descriptions) < num_descriptions:
                while len(audio_descriptions) < num_descriptions:
                    audio_descriptions.append(
                        f"Ambient sound variation {len(audio_descriptions) + 1}"
                    )

            return audio_descriptions

        except (json.JSONDecodeError, ValueError) as e:
            raise ValueError(f"Failed to parse audio descriptions: {str(e)}")

    def image_to_audio_descriptions(
        self, image_base64: str, num_descriptions: int = 10
    ) -> List[str]:
        """
        Complete pipeline: analyze image and generate audio descriptions.

        Args:
            image_base64: Base64 encoded image
            num_descriptions: Number of audio descriptions to generate

        Returns:
            List of audio descriptions
        """
        # Analyze image
        vision_analysis = self.analyze_image_from_base64(image_base64)

        # Generate audio descriptions
        audio_descriptions = self.generate_audio_descriptions(
            vision_analysis, num_descriptions
        )

        return audio_descriptions
