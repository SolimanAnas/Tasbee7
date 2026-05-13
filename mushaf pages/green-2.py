import os
import time
import requests

def download_extra_pages(start_idx, end_idx, output_folder="medina1_pages"):
    """
    Downloads the final appendix/index GIF images for Medina 1.
    """
    # Uses the same folder as before
    os.makedirs(output_folder, exist_ok=True)
    
    base_url = "https://app.quranflash.com/book/Medina1/epub/EPUB/imgs/"
    
    print(f"🚀 Downloading extra pages ({start_idx} to {end_idx})...")
    
    for i in range(start_idx, end_idx + 1):
        img_name = f"{i:04d}.gif"
        img_url = f"{base_url}{img_name}"
        save_path = os.path.join(output_folder, img_name)
        
        try:
            print(f"⏳ Fetching {img_name}...", end=" ")
            response = requests.get(img_url, stream=True, timeout=10)
            
            if response.status_code == 200:
                with open(save_path, 'wb') as file:
                    for chunk in response.iter_content(1024):
                        file.write(chunk)
                print("✅ Saved!")
            else:
                print(f"❌ Failed (404 Not Found - Server might not have this page)")
                
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Error: {e}")
            
        # 2-second delay to keep the server happy
        time.sleep(2)

    print("\n🎉 Extra pages complete!")

if __name__ == "__main__":
    # The exact range you requested
    START_PAGE = 605
    END_PAGE = 624 
    
    download_extra_pages(START_PAGE, END_PAGE)