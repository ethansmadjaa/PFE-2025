import base64
import json
import tempfile
from typing import List

import ollama

from constants import DESCRIBE_PROMPT


class ImageAnalyzer:
    """Handles image analysis and audio description generation using Ollama vision models."""

    def __init__(
        self,
        vision_model: str = "llama3.2-vision",
        text_model: str = "llama3.2"
    ):
        """
        Initialize the image analyzer.

        Args:
            vision_model: Ollama vision model to use for image analysis
            text_model: Ollama text model to use for generating descriptions
        """
        self.vision_model = vision_model
        self.text_model = text_model

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

        response = ollama.chat(
            model=self.vision_model,
            messages=[
                {
                    "role": "user",
                    "content": DESCRIBE_PROMPT,
                    "images": [image_path]
                }
            ]
        )

        vision_output = response.message.content
        print(f"Vision model response: {vision_output}")

        return vision_output

    def generate_audio_descriptions(
        self,
        vision_analysis: str,
        num_descriptions: int = 10
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

        prompt = f"""Based on this audio analysis:

{vision_analysis}

Generate exactly {num_descriptions} different, specific audio prompts for a sound generator.
Each prompt should be distinct and describe a concrete sound, instrument, or texture.
Return ONLY a valid JSON array of {num_descriptions} strings, no additional text.
Example format: ["deep bass drum with reverb", "metallic scraping sound", ...]"""

        response = ollama.chat(
            model=self.text_model,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )

        descriptions_text = response.message.content.strip()
        print(f"Descriptions response: {descriptions_text}")

        # Extract JSON array from the response
        # Handle cases where the model might wrap it in markdown code blocks
        if "```json" in descriptions_text:
            descriptions_text = descriptions_text.split("```json")[1].split("```")[0].strip()
        elif "```" in descriptions_text:
            descriptions_text = descriptions_text.split("```")[1].split("```")[0].strip()

        # Parse JSON
        try:
            audio_descriptions = json.loads(descriptions_text)

            # Validate and adjust list length
            if not isinstance(audio_descriptions, list):
                raise ValueError("Response is not a JSON array")

            # Trim or pad to exact number
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
        self,
        image_base64: str,
        num_descriptions: int = 10
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
            vision_analysis,
            num_descriptions
        )

        return audio_descriptions
