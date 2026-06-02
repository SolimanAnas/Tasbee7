import requests
import sqlite3
import os

BASE_PATH = "/storage/emulated/0/1-Zad Al-Muslim/Archives/New 29 march/Data"
DB_PATH = os.path.join(BASE_PATH, "quran.db")

os.makedirs(BASE_PATH, exist_ok=True)

print("📥 Downloading Quran text...")

url = "https://api.alquran.cloud/v1/quran/quran-simple-clean"
data = requests.get(url).json()

surahs = data["data"]["surahs"]

print("💾 Creating database...")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS ayat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    surah INTEGER,
    ayah INTEGER,
    text TEXT,
    page INTEGER
)
""")

cursor.execute("DELETE FROM ayat")

print("📊 Processing ayahs...")

count = 0
for surah in surahs:
    s_num = surah["number"]
    for ayah in surah["ayahs"]:
        cursor.execute("""
        INSERT INTO ayat (surah, ayah, text, page)
        VALUES (?, ?, ?, ?)
        """, (
            s_num,
            ayah["numberInSurah"],
            ayah["text"],
            ayah["page"]
        ))
        count += 1
        if count % 500 == 0:
            print(f"Processed {count} ayahs...")

conn.commit()

print("⚡ Creating index...")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_text ON ayat(text)")

conn.close()

print("✅ Quran database created successfully!")