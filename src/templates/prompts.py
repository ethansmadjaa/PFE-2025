BEST_PRACTICES_PROMPT = """"""

REMIX_PROMPT = """You are refining an audio sample description for a text-to-audio AI model (TangoFlux).

Original audio description:
{original_description}

User feedback (what they want changed):
{user_feedback}

Generate a single improved audio description that:
1. Keeps the core character and musical key of the original sample
2. Addresses the user's specific feedback
3. Uses PHYSICAL descriptions: instruments, playing techniques, acoustic environments, textures
4. Uses adjectives like: "reverberant", "dry", "distorted", "granular", "muffled", "sharp", "rhythmic"
5. DO NOT use abstract metaphors like "the sound of sadness"
6. Is a single, detailed sentence suitable for text-to-audio generation

Output ONLY the new description as a single sentence, nothing else."""

DESCRIBE_PROMPT = """
Analyze this image not just visually, but as a source of sound. Imagine the soundscape implied by this scene.

1. **Visual Subject**: What is the main subject?
2. **Materials & Textures**: List the dominant materials (e.g., metal, water, wood, glass, concrete). How would they sound if touched or struck? (e.g., resonant, damp, hollow, gritty).
3. **Lighting & Temperature**: Translate the lighting into sonic terms. (e.g., Dark/Shadows -> Bass/Low frequencies; Bright/High contrast -> High frequencies/Sharp transients; Warm -> Analog/Saturated; Cold -> Digital/Clean).
4. **Activity & Dynamics**: Is the scene static (drones, pads) or dynamic (rhythm, impacts)?
5. **Vibe**: Give 3 distinct adjectives that describe the AUDIO atmosphere (e.g., "Lo-fi", "Cinematic", "Industrial", "Ethereal").

Output: A concise analysis focusing on these sonic implications.
"""

AUDIO_DESCRIPTIONS_PROMPT = """Based on this audio-visual analysis:

        {vision_analysis}

        You are an expert Sound Designer. Your goal is to generate exactly {num_descriptions} distinct prompts for a text-to-audio model (TangoFlux).
        You must convert the visual atmosphere into concrete AUDIO instructions.

        **CRITICAL INSTRUCTION FOR WRITING PROMPTS:**
        - DO NOT use abstract metaphors like "the sound of sadness" or "colors of the wind".
        - DO USE physical descriptions: instruments, playing techniques, acoustic environments, and textures.
        - USE adjectives like: "reverberant", "dry", "distorted", "granular", "muffled", "sharp", "rhythmic".
        - Follow the structure below to pick the best {num_descriptions} sounds that fit the image.

        **MANDATORY MUSICAL CONSTRAINT:**
        - ALL tonal sounds (Pads, Bass, Piano) MUST be in the key of: [Choose a Scale that fits the mood, e.g., C Minor or F Major] completely consistent across all samples.

        **SOURCE CATEGORIES (Choose from these to create your list):**
        - **Drones/Pads:** "Cinematic drone, [Instrument], long sustain, [Texture Adjective], slow evolution, consistent with [Key]."
        - **Melodic:** "A [Instrument] playing a [Adjective] melody, [Emotion], in the key of [Key], [Effect: e.g., delay, reverb]."
        - **Textures:** "Field recording of [Material from image], [Adjective], looping background noise, immersive."
        - **Rhythmic:** "A [BPM] bpm beat, [Genre: e.g., Lofi/Techno/Ambient], using [Instrument 1] and [Instrument 2], [Adjective]."
        - **One-Shots:** "Single hit of [Material], [Adjective], [Acoustic characteristic: e.g., heavy impact, scrape, click]."

        **OUTPUT FORMAT:**
        Return ONLY a Python list of strings. Each string is a prompt for TangoFlux.

        Example of expected style:
        [
            "A deep analog synthesizer drone in C Minor, warm and fluctuating texture, heavy reverb.",
            "Rhythmic metallic clicking sounds, 120 bpm, industrial texture, resembling machinery.",
            "Soft piano melody in C Minor, slow tempo, melancholic, accompanied by rain sounds."
        ]

        Target: {num_descriptions} items.
"""