BEST_PRACTICES_PROMPT = """
**STYLE GUIDE (How to write for the audio model):**
- **GOAL:** Create musical samples (loops & one-shots) suitable for music production (DAW).
- **DO NOT** use technical notation (no "Key of C", no "120 BPM", no "4/4 signature").
- **DO** use genre and emotional adjectives (e.g., "lo-fi", "cinematic", "jazzy", "distorted", "ethereal", "upbeat").
- **DO** specify the instrument explicitly (e.g., "Grand Piano", "Analog Bass", "Electric Guitar", "Modular Synth").
- **Example of GOOD prompts:**
  * "A mellow electric guitar playing a slow, reverberant jazz melody."
  * "A deep analog bass line pulsing rhythmically with a dark techno vibe."
  * "A lo-fi hip hop drum beat with a dusty snare and soft kick."
  * "A wide, shimmering synthesizer pad evolving slowly with a futuristic atmosphere."
"""

REMIX_PROMPT = """You are refining a musical sample description for a text-to-audio AI model (TangoFlux).

Original audio description:
{original_description}

User feedback (what they want changed):
{user_feedback}

Generate a single improved audio description that:
1. Keeps the musical intent (instrument/genre) of the original unless told otherwise.
2. Addresses the user's specific feedback.
3. Uses MUSICAL adjectives (e.g., "reverberant", "dry", "distorted", "dreamy", "funky").
4. Explicitly names the instrument or sound source.
5. DO NOT use abstract metaphors like "the sound of sadness".
6. Is a single, detailed sentence suitable for text-to-audio generation.

Output ONLY the new description as a single sentence, nothing else."""

DESCRIBE_PROMPT = """
Analyze this image to inspire a music sample pack. Focus on the Vibe, Genre, and Instruments.

1. **Visual Mood & Genre**: based on the visual aesthetic, what music genre fits best? (e.g., Cyberpunk, Lofi Hip Hop, Dark Ambient, Acoustic Folk, Industrial Techno).
2. **Suggested Instruments**: Suggest 3-4 specific instruments that match the scene (e.g., "Synthesizer" for neon city, "Acoustic Guitar" for nature, "Saxophone" for noir).
3. **Environment (Reverb)**: Describe the acoustic space implied (e.g., "dry studio sound", "massive hall reverb", "underwater muffled").
4. **Energy**: Is the scene calm (pads, slow melodies) or energetic (fast rhythms, harsh leads)?

Output: A concise summary focusing on these musical elements to guide the sound generation.
"""

AUDIO_DESCRIPTIONS_PROMPT = """Based on this visual and musical analysis:
"{vision_analysis}"

You are an expert Audio Director creating a "Sample Pack" inspired by this image.
Generate a Python list of exactly {num_descriptions} distinct audio prompts.

{BEST_PRACTICES_PROMPT}

**STRUCTURE TO GENERATE (You must follow this split exactly):**

**PART A: 5 Musical Elements (Loops & One-shots)**
Focus on the *Genre* and *Instruments* identified in the analysis.
- **Melodic Loop:** "A [Adjective] [Instrument] playing a [Adjective] melody, [Vibe]."
- **Bass/Low End:** "A [Adjective] bass sound, [Texture], rhythmic."
- **Pad/Harmony:** "A [Adjective] [Instrument] pad, evolving slowly, [Atmosphere]."
- **Rhythmic Loop:** "A [Adjective] drum/percussion loop, [Style], featuring [Elements]."
- **Instrument One-Shot:** "A single, isolated [Instrument] note or chord, [Texture]."

**PART B: 5 Foley & Soundscape Elements (Real-world sounds)**
Focus on the *Environment* and *Materials* visible in the image.
- **Ambiance:** "A steady background sound of [Environment], [Adjective], immersive." (e.g., wind in trees, distant city).
- **Action/Event:** "A specific sound of [Action], [Texture], clear and distinct." (e.g., footsteps on wood, water splashing).
- **Texture:** "A close-up sound of [Material] being [Action], detailed." (e.g., paper crinkling, metal scraping).
- **Hybrid:** "A mix of [Natural Sound] harmonizing with [Musical Tone]." (e.g., birdsong with a faint chime).
- **Impact:** "A distinct impact sound of [Object] hitting [Surface]."

**RULES:**
1. **NO COPYING:** Do NOT use the examples from your instruction. Create NEW prompts based on the image analysis.
2. **COHERENCE:** If the image is a calm garden, do NOT generate "industrial techno" or "basketball sounds". Stick to the visual mood.
3. **VARIETY:** Ensure the 5 musical prompts use different instruments and the 5 soundscapes use different sources.
4. **FORMAT:** Keep descriptions under 25 words each.
5. **OUTPUT:** MUST be a valid Python list of strings containing exactly 10 items.

**OUTPUT:**
[
    "Musical prompt 1...",
    "Musical prompt 2...",
    "Musical prompt 3...",
    "Musical prompt 4...",
    "Musical prompt 5...",
    "Foley prompt 1...",
    "Foley prompt 2...",
    "Foley prompt 3...",
    "Foley prompt 4...",
    "Foley prompt 5..."
]
"""