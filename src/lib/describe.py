import base64
import json
import os
import tempfile
from typing import List

import ollama

from src.templates.prompts import (
    AUDIO_DESCRIPTIONS_PROMPT,
    BEST_PRACTICES_PROMPT,
    DESCRIBE_PROMPT,
    REMIX_PROMPT,
)


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

        prompt = AUDIO_DESCRIPTIONS_PROMPT.format(
            vision_analysis=vision_analysis,
            num_descriptions=num_descriptions,
            BEST_PRACTICES_PROMPT=BEST_PRACTICES_PROMPT,
        )

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

    def remix_description(self, original_description: str, user_feedback: str) -> str:
        """
        Generate a refined audio description based on user feedback.

        Args:
            original_description: The original audio description
            user_feedback: What the user wants changed

        Returns:
            A new refined audio description
        """
        print(f"Generating remix description...")

        prompt = REMIX_PROMPT.format(
            original_description=original_description,
            user_feedback=user_feedback,
        )

        response = self.client.chat(
            model=self.text_model,
            messages=[{"role": "user", "content": prompt}],
        )

        new_description = response.message.content.strip()
        print(f"Remix description: {new_description}")
        return new_description

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
