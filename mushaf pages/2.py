import os
from PIL import Image

# Configuration
SOURCE_DIR = 'mushaf-madina1441'
OUTPUT_DIR = 'mushaf-madina-1441'
QUALITY = 80      # 80-85 is the "sweet spot" for text clarity vs size
FUZZ_FACTOR = 40  # Slightly higher to ensure smooth edges around text

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def make_transparent_slim(filename):
    img_path = os.path.join(SOURCE_DIR, filename)
    try:
        with Image.open(img_path) as img:
            img = img.convert("RGBA")
            
            # 1. Faster background sampling
            bg_color = img.getpixel((img.width // 2, 5))
            r_bg, g_bg, b_bg, _ = bg_color
            
            # 2. Process pixel data
            data = img.getdata()
            new_data = []
            for item in data:
                r, g, b, a = item
                # If pixel matches background, make it transparent
                if abs(r - r_bg) < FUZZ_FACTOR and \
                   abs(g - g_bg) < FUZZ_FACTOR and \
                   abs(b - b_bg) < FUZZ_FACTOR:
                    new_data.append((r_bg, g_bg, b_bg, 0))
                else:
                    new_data.append(item)
            
            img.putdata(new_data)
            
            # 3. THE FIX: Lossy saving with Alpha
            # method=6 uses the slowest, most efficient compression algorithms
            output_name = os.path.splitext(filename)[0] + ".webp"
            img.save(
                os.path.join(OUTPUT_DIR, output_name), 
                "WEBP", 
                quality=QUALITY, 
                method=6, 
                exact=False # Allows better compression of transparent areas
            )
            
            print(f"Compressed Alpha: {output_name}")
            
    except Exception as e:
        print(f"Error processing {filename}: {e}")

# Run batch
files = [f for f in os.listdir(SOURCE_DIR) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
for file in files:
    make_transparent_slim(file)