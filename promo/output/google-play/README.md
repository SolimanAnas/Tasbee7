# Google Play listing assets: Arabic (`ar/`)

These are made for the **Arabic store listing** of Zad Al-Muslim (*Play Console → Grow → Store presence → Main store listing → Arabic*). They follow Google's [preview-asset specs and guidelines](https://support.google.com/googleplay/android-developer/answer/9866151). `spec-check.md` holds the measured checks.

| File | Play Console field | Spec | Status |
|---|---|---|---|
| `app-icon-512.png` | App icon | 512×512, 32-bit PNG, ≤ 1 MB | ✅ 586 KB |
| `feature-graphic.png` | Feature graphic | 1024×500, 24-bit PNG (no alpha) | ✅ |
| `phone-01.png` … `phone-08.png` | Phone screenshots | up to 8; 1080×1920 (9:16), 24-bit PNG | ✅ 8. That is at least 4 at 1080 px, so the app is eligible for large-format recommendations |
| `promo-video-ar.mp4` | Video, **via a YouTube URL** | upload to YouTube first (below) | ✅ 1920×1080, 45 s, H.264/AAC |
| `captions-ar.srt` | YouTube captions (Arabic) | — | ✅ |

## Promo video: upload steps

Google Play only accepts a **YouTube link**. The file itself can't be uploaded to Play.

1. Upload `promo-video-ar.mp4` to YouTube and set it to **Public** or **Unlisted** (never Private).
2. **Turn monetization off**, so no ads run.
3. Don't mark it as made for adults or age-restricted. Leave **Allow embedding** on.
4. Under *Subtitles*, add `captions-ar.srt` as **Arabic**. Play autoplays the first 30 s **muted**, so captions and the on-screen headlines carry the message.
5. Copy the plain video URL (`https://www.youtube.com/watch?v=…`), with no playlist, channel link or `&t=` timestamp. Paste it into *Video* on the Arabic listing.

### How this cut differs from `zad-al-muslim-hero-ar-no-music.mp4`

The Play cut follows Google's preview-asset guidelines:

- **End card:** it has no Google Play badge, QR code, store URL or "download" call to action, and no price claim (no «مَجّاني»). The benefits read «بلا إعلانات • يعمل دون إنترنت».
- **Narration:** it ends on «بلا إعلانات، ويعمل دون إنترنت», regenerated in the same voice with CER 0.000.
- **Share of app footage:** the app is on screen from 4.7 s to 34.6 s and again from 36.3 s to the end, so about 86% of the video shows the real app (Google asks for ≥ 80%, with the app shown within the first 10 s).
- **Music:** none, as in the no-music cut. The audio is narration plus non-tonal sound design only.

## Screenshots

| # | Screen (genuine Arabic UI) | Headline · subline |
|---|---|---|
| 1 | Home | كلُّ ما تَحْتاجُهُ · القرآن والأذكار والحديث في تطبيقٍ واحد |
| 2 | Mushaf, Al-Fatiha | صِلَتُكَ بالقرآنِ الكريم · ٥ أنماط للمصحف مع التفاسير والعلامات |
| 3 | Quran audio | أجملُ التلاوات · قرّاء متعدّدون وتشغيل في الخلفية |
| 4 | Morning adhkar | أذكارُ يَوْمِكَ · الصباح والمساء وبعد الصلاة |
| 5 | Masbaha (33/33) | المِسْبَحةُ الذكيّة · أهداف يومية وإحصاءات دائمة |
| 6 | Hadith | كتبُ السنّة بين يَدَيْكَ · ابحث في الأحاديث بسهولة |
| 7 | Quran radio | إذاعةُ القرآنِ الكريم · بثّ مباشر على مدار الساعة |
| 8 | Takrar (memorization) | رَفِيقُكَ في الحفظ · تكرار الآيات بالسورة أو الجزء أو الصفحة |

These follow Google's guidance for preview assets:
- **Frames and text:** no device frames, and the tagline band takes up ≤ 20% of each image (about 19%).
- **Excluded content:** no badges, calls to action, prices, rankings, testimonials or time-limited offers.

## Feature graphic

- **Alt text** (required, ≤ 140 characters): `شعار تطبيق زاد المسلم مع لقطتين من المصحف والمسبحة الذكية` (English: `Zad Al-Muslim logo and name with screens of the Mushaf and the smart tasbeeh`)
- **Play button overlay:** once a promo video is set, Google Play draws a play button over the **centre** of the feature graphic, roughly over the name. The icon above it and the tagline below it stay visible.

## Not included

- **Tablet screenshots** (7-inch and 10-inch) are optional. Google expects them to show the tablet layout, so they need tablet-sized Arabic captures. They can be made with the same pipeline if you want them.
- **English listing graphics** can be produced the same way.

Rebuild:
```
node scripts/store-assets.cjs
python scripts/store-verify.py
node scripts/render.cjs --fmt=landscape --lang=ar --play
scripts/mux.sh landscape-ar-play google-play/ar/promo-video-ar.mp4 10M mix-ambient-ar-play.flac
```
