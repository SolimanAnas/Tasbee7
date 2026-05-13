import os
from PIL import Image

def remove_white_background(img, tolerance=240):
    """
    Scans the image and converts white/near-white pixels to transparent.
    Tolerance is set to 240 to catch slight off-white anti-aliasing edges.
    """
    # Ensure image is in RGBA mode
    img = img.convert("RGBA")
    datas = img.getdata()

    new_data = []
    for item in datas:
        # item is (R, G, B, A)
        # If Red, Green, and Blue are all higher than the tolerance, it's "white"
        if item[0] > tolerance and item[1] > tolerance and item[2] > tolerance:
            # Change to fully transparent
            new_data.append((255, 255, 255, 0))
        else:
            # Keep original text/color pixel
            new_data.append(item)

    img.putdata(new_data)
    return img


def finalize_mushaf_transparent(input_dir="medina1_pages", output_dir="madina-green"):
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"🚀 Starting Process: Removing White Backgrounds, Cropping, and Renaming...")
    print(f"⏳ Note: Scanning pixels for transparency takes a bit longer. Please be patient!\n")
    
    for old_idx in range(4, 625):
        old_filename = f"{old_idx:04d}.gif"
        input_path = os.path.join(input_dir, old_filename)
        
        if not os.path.exists(input_path):
            print(f"⚠️ Missing: {old_filename}")
            continue
            
        new_page_num = old_idx - 3
        new_filename = f"{new_page_num:03d}.webp"
        output_path = os.path.join(output_dir, new_filename)
        
        try:
            # 1. OPEN IMAGE
            img = Image.open(input_path)
            
            # 2. REMOVE WHITE BACKGROUND (Make Transparent)
            img = remove_white_background(img, tolerance=240)
            width, height = img.size
            
            # 3. CROPPING RULES
            if 6 <= old_idx <= 607:
                if old_idx % 2 != 0:
                    # ODD PAGES IN SOURCE
                    left_crop = 91
                    right_crop = 17
                    action = "Cropped (Source Odd) + Transparent"
                else:
                    # EVEN PAGES IN SOURCE
                    left_crop = 23
                    right_crop = 85
                    action = "Cropped (Source Even) + Transparent"
                
                crop_box = (left_crop, 0, width - right_crop, height)
                img = img.crop(crop_box)
            else:
                action = "Converted Only + Transparent"
                
            # 4. SAVE AS WEBP
            img.save(output_path, "WEBP", lossless=True)
            
            print(f"✅ {old_filename} --> {new_filename} | {action}")
            
        except Exception as e:
            print(f"❌ Error processing {old_filename}: {e}")

    print("\n🎉 Processing Complete! All WebP files are now completely transparent.")

if __name__ == "__main__":
    finalize_mushaf_transparent()