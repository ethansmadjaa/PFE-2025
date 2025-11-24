import requests
import base64

# Lire une image
with open("image.jpg", "rb") as f:
    image_base64 = base64.b64encode(f.read()).decode()

# Appeler l'API
response = requests.post(
    "http://localhost:8000/sample", json={"image_base64": image_base64}
)

# Sauvegarder le ZIP
with open("sample_pack.zip", "wb") as f:
    f.write(response.content)
