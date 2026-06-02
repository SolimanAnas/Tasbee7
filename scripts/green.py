import os
import time
import requests

def download_quran_pages(start_idx, end_idx, output_folder="medina1_pages"):
    """
    Downloads GIF images from QuranFlash sequentially.
    """
    # Create the folder if it doesn't exist
    os.makedirs(output_folder, exist_ok=True)
    
    # Updated Base URL for Medina 1
    base_url = "https://app.quranflash.com/book/Medina1/epub/EPUB/imgs/"
    
    print(f"🚀 Starting download of {end_idx - start_idx + 1} pages...")
    print(f"📁 Saving to folder: {os.path.abspath(output_folder)}\n")

    for i in range(start_idx, end_idx + 1):
        # Format the number to have leading zeros AND use .gif extension
        img_name = f"{i:04d}.gif"
        img_url = f"{base_url}{img_name}"
        save_path = os.path.join(output_folder, img_name)
        
        try:
            # Download the image
            response = requests.get(img_url, stream=True, timeout=10)
            
            # Check if the download was successful
            if response.status_code == 200:
                with open(save_path, 'wb') as file:
                    for chunk in response.iter_content(1024):
                        file.write(chunk)
                print(f"✅ Success: Downloaded {img_name}")
            else:
                print(f"❌ Failed: {img_name} (Server returned status {response.status_code})")
                
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Error downloading {img_name}: {e}")
            
        # IMPORTANT: Wait 2 seconds before the next request to avoid rate-limiting
        time.sleep(2)

    print("\n🎉 All done! Your Medina 1 pages have been downloaded.")

if __name__ == "__main__":
    # Standard Mushaf is usually pages 1 through 604
    # (Adjust these numbers if you need a specific range)
    START_PAGE = 1
    END_PAGE = 604 
    
    download_quran_pages(START_PAGE, END_PAGE)