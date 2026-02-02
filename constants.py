DESCRIBE_PROMPT = """
Analyze this image not just visually, but as a source of sound. Imagine the soundscape implied by this scene.

1. **Visual Subject**: What is the main subject?
2. **Materials & Textures**: List the dominant materials (e.g., metal, water, wood, glass, concrete). How would they sound if touched or struck? (e.g., resonant, damp, hollow, gritty).
3. **Lighting & Temperature**: Translate the lighting into sonic terms. (e.g., Dark/Shadows -> Bass/Low frequencies; Bright/High contrast -> High frequencies/Sharp transients; Warm -> Analog/Saturated; Cold -> Digital/Clean).
4. **Activity & Dynamics**: Is the scene static (drones, pads) or dynamic (rhythm, impacts)?
5. **Vibe**: Give 3 distinct adjectives that describe the AUDIO atmosphere (e.g., "Lo-fi", "Cinematic", "Industrial", "Ethereal").

Output: A concise analysis focusing on these sonic implications.
"""