BEST_PRACTICES_PROMPT = """

**STYLE GUIDE (How to write for the audio model):**
- DO NOT use musical notation (no "Key of C", no "120 BPM").
- DO describe the sound source, the action, and the environment.
- Use verbs and physical adjectives (e.g., "bouncing", "scraping", "echoing", "muffled", "sharp").
- Example of GOOD prompts:
  * "A basketball bounces rhythmically on a court, shoes squeak against the floor."
  * "Dripping water echoes sharply, a distant growl reverberates through a cavern."
  * "Melodic human whistling harmonizing with natural birdsong.
  """

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
Analyze this image and describe the "soundscape" it suggests. Focus on physical materials and atmosphere.

1. **Main Subject & Action**: What is happening? Is there implied movement?
2. **Materials**: List the visible textures (e.g., rusty metal, flowing water, crackling wood, soft fabric, glass).
3. **Environment**: Describe the acoustic space (e.g., small room, open field, cavernous hall, underwater, busy street).
4. **Atmosphere**: What is the vibe? (e.g., tense, peaceful, industrial, chaotic).

Output: A concise paragraph focusing on these physical and atmospheric elements.
"""

AUDIO_DESCRIPTIONS_PROMPT = """Based on this visual description:
"{vision_analysis}"

You are an expert Sound Designer. Generate a Python list of exactly {num_descriptions} sound prompts to generate a sample pack.

{BEST_PRACTICES_PROMPT}

**STRUCTURE TO GENERATE (Adapt the content to the image mood):**
 use these best practices 
- **Drones (x2):** Describe a continuous, evolving background sound. (e.g., "A low, humming mechanical drone vibrating in a large empty tunnel").
- **Piano/Melodic (x1):** Describe a simple instrument playing emotionally. (e.g., "A lonely, reverberant piano melody playing slowly in a quiet room").
- **Textures (x5):** Describe specific material noises.
   - Granular/detailed sounds (e.g., "Sand shifting and crinkling").
   - Organic nature sounds (e.g., "Wind howling through dry branches").
   - Spatial ambiance (e.g., "Distant city traffic noise with rain falling").
- **Rhythmic Loops (x3):** Describe a repeating pattern of sounds. (e.g., "A rhythmic metallic clanking sound repeating like a machine").
- **One-shots (x4):** Short, single impacts. (e.g., "A heavy wooden door slamming shut with a thud").

**RULES:**
1. All descriptions must fit the mood of the image analysis provided.
2. Keep descriptions under 20 words each.
3. Output MUST be a valid Python list of strings.

**OUTPUT:**
[
    "Description 1...",
    "Description 2...",
    ...
]
"""