BEST_PRACTICES_PROMPT = """"""

DESCRIBE_PROMPT = """
Analyze this image in detail and provide a comprehensive description. Focus on the following elements:

Visual Elements: Describe the main objects, subjects, and composition of the image.

Colors & Lighting: Describe the color palette, lighting conditions, and overall brightness (e.g., warm tones, cold blues, high contrast, soft lighting).

Textures & Materials: Identify visible textures and materials (e.g., smooth, rough, metallic, organic, fabric).

Mood & Atmosphere: Describe the emotional tone and atmosphere conveyed by the image (e.g., calm, energetic, mysterious, joyful).

Setting & Context: Describe the environment or setting (e.g., urban, natural, indoor, outdoor, futuristic).

Output: Provide a detailed, objective description of the image in English, covering all the elements mentioned above.
"""

AUDIO_DESCRIPTIONS_PROMPT = """Based on this image analysis:

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