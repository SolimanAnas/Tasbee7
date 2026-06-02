from PIL import Image
import os
from pathlib import Path

# =========================
# CONFIG
# =========================
INPUT_DIR = "mushaf-colored"
OUTPUT_DIR = "madina-1421"

# white removal sensitivity
# lower = stricter
# higher = removes more near-white pixels
THRESHOLD = 245

# feather edge softness
SOFTNESS = 10

# =========================
# SETUP
# =========================
Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

SUPPORTED = {".png", ".jpg", ".jpeg", ".webp"}

# =========================
# PROCESS
# =========================
for filename in os.listdir(INPUT_DIR):

    ext = Path(filename).suffix.lower()

    if ext not in SUPPORTED:
        continue

    input_path = os.path.join(INPUT_DIR, filename)

    print(f"Processing: {filename}")

    img = Image.open(input_path).convert("RGBA")

    pixels = img.load()

    width, height = img.size

    for y in range(height):
        for x in range(width):

            r, g, b, a = pixels[x, y]

            # detect near-white background
            if r >= THRESHOLD and g >= THRESHOLD and b >= THRESHOLD:

                # average brightness
                brightness = (r + g + b) / 3

                # soft alpha fade
                alpha = int(
                    max(
                        0,
                        min(
                            255,
                            (255 - brightness) * (255 / SOFTNESS)
                        )
                    )
                )

                pixels[x, y] = (r, g, b, alpha)

    output_name = Path(filename).stem + ".webp"
    output_path = os.path.join(OUTPUT_DIR, output_name)

    img.save(
        output_path,
        "WEBP",
        lossless=True,
        quality=100,
        method=6
    )

    print(f"Saved: {output_path}")

print("\nDONE.")