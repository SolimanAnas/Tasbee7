<div align="center">

<img src="images/Featured.webp" alt="Zad Al-Muslim — زاد المسلم" width="100%">

<br>

# زاد المسلم — Zad Al-Muslim

[![Google Play](https://img.shields.io/badge/Google%20Play-00C853?style=for-the-badge&logo=googleplay&logoColor=white)](https://play.google.com/store/apps/details?id=io.github.solimananas.twa)
[![Live Demo](https://img.shields.io/badge/LIVE%20DEMO-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://solimananas.github.io/Tasbee7)
[![GitHub stars](https://img.shields.io/github/stars/SolimanAnas/Tasbee7?style=for-the-badge&color=FFD700)](https://github.com/SolimanAnas/Tasbee7/stargazers)
[![License](https://img.shields.io/github/license/SolimanAnas/Tasbee7?style=for-the-badge&color=1A7040)](https://github.com/SolimanAnas/Tasbee7/blob/main/LICENSE)

<br>

### <sub>"وَتَزَوَّدُوا فَإِنَّ خَيْرَ الزَّادِ التَّقْوَى"</sub>

<br>

A modern, lightweight, ad-free Progressive Web App — your all-in-one spiritual companion.
Supports **5 languages**: العربية, English, Türkçe, کوردی, اردو.

<br>

</div>

---

## Features

<div align="center">

| | Feature | Description |
|:---:|:---|:---|
| 📖 | **المصحف الشريف** | Interactive Quran with 5 mushaf variants, word-level ayah highlighting, search, bookmarks, and offline caching |
| 🎧 | **الاستماع للقرآن** | Multi-reciter audio player with background playback, media session, sleep timer, and favorites |
| 🔁 | **التكرار** | Repeat ayahs with configurable reciter, surah range, speed control, and ayah text display |
| 📿 | **المسبحة** | Smart digital counter with haptic feedback, daily targets, lifetime stats, and OLED power-saving mode |
| 📻 | **إذاعة القرآن** | 24/7 live Quran radio broadcasts via HLS streaming |
| 🤲 | **أذكار الصباح والمساء** | Morning & evening supplications with interactive counters |
| 🌙 | **أذكار النوم** | Bedtime adhkar with read-and-count workflow |
| 📿 | **حصن المسلم** | Complete Hisn Al-Muslim — all daily and occasion-based supplications |
| 🤲 | **الدعاء** | Comprehensive duaa collection |
| 🕋 | **الرقية الشرعية** | Prophetic Ruqyah supplications |
| 📚 | **الأربعين النووية** | Imam An-Nawawi's 40 Hadith collection |
| 🔍 | **باحث الأحاديث** | Hadith search and viewer with 13 book collections |
| 🧠 | **التلقين (Tasmee)** | Ayah-by-ayah memorization coach with speech recognition, spaced repetition, mistake tracking, and weekly charts |
| 🔔 | **الإشعارات** | Prayer time notifications with adhan alerts |
| 🧭 | **اتجاه القبلة** | Qibla compass with AR overlay |
| 🌐 | **5 لغات** | Full i18n — Arabic, English, Turkish, Kurdish (Sorani), Urdu |
| 🎨 | **واجهة زجاجية** | 4-theme glassmorphism system (Light, Dark, Sepia, OLED Black) with smooth animations |
| 📱 | **تطبيق متكامل** | Installable PWA — works offline on iOS and Android |

</div>

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, Vanilla JavaScript, TypeScript (core modules), CSS3 (Glassmorphism) |
| **Build** | Vite — dev server, production builds, asset hashing |
| **Type Test** | TypeScript (strict: false, incremental adoption) |
| **Audio** | HLS.js for live radio, MP3 streaming via everyayah.com, Media Session API |
| **Database** | SQLite via sql.js for ayah-level highlighting coordinates |
| **Search** | Tarteel.js for Quran text search |
| **Storage** | localStorage + IndexedDB for settings, bookmarks, statistics, and tasmee data |
| **i18n** | Custom lightweight engine — 5 locales (ar, en, tr, ckb, ur) |
| **PWA** | Service Workers + Web App Manifest for offline support |
| **Testing** | Playwright — ~144 automated tests (resource loading, navigation, i18n key parity) |

---

## Quick Start

```bash
git clone https://github.com/SolimanAnas/Tasbee7.git
cd Tasbee7
npm install
npm run dev        # Dev server at http://localhost:5173
```

### Build Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm test` | Run Playwright test suite |

---

## Project Structure

```
Tasbee7/
├── index.html                  # Main entry — app home
├── pages/
│   ├── quran.html              # Quran reader (Tasmee Pro v2 engine)
│   ├── quran-old.html          # Legacy image-based mushaf reader
│   ├── quran-text.html         # Quran text viewer
│   ├── quran2.html             # Quran reader v2
│   ├── audio.html              # Audio player
│   ├── takrar.html             # Ayah repetition tool
│   ├── radio.html              # Live Quran radio
│   ├── masbaha.html            # Digital counter
│   ├── azkar.html              # Morning/evening adhkar
│   ├── azkar2.html             # Additional adhkar
│   ├── hisn.html               # Hisn Al-Muslim
│   ├── duaa.html               # Duaa collection
│   ├── hadith.html             # Hadith browser
│   ├── hadith-viewer.html      # Hadith viewer (13 book collections)
│   ├── salah.html              # After-salah adhkar
│   ├── sleeping.html           # Sleeping adhkar
│   ├── tasmee-dashboard.html   # Tasmee memorization dashboard
│   ├── tasmee-review.html      # Tasmee review interface
│   ├── qibla.html              # Qibla compass
│   ├── notifications.html      # Prayer notifications
│   ├── about.html              # About page
│   └── howto.html              # How-to guide
├── css/
│   ├── style.css               # Global styles
│   ├── quran-v4.css            # Quran reader styles
│   ├── tasmee.css              # Tasmee engine styles
│   ├── tasmee-pro-v2.css       # Tasmee Pro v2 styles
│   └── _masbaha.css            # Masbaha styles
├── js/
│   ├── i18n.js                 # Internationalization engine
│   ├── i18n/                   # Locale dictionaries (5 languages)
│   │   ├── ar.js, en.js, tr.js, ckb.js, ur.js
│   │   └── names.js            # Localized surah/reciter/station names
│   ├── quran/                  # Quran reader modules
│   │   ├── state.js            # App state management
│   │   ├── navigation.js       # Page navigation
│   │   ├── highlights.js       # Ayah highlighting
│   │   ├── audio.js            # Audio playback
│   │   ├── audio-cache.js      # Audio caching
│   │   ├── tafsir.js           # Tafsir display
│   │   ├── settings.js         # User settings
│   │   ├── ui.js               # UI utilities
│   │   ├── ui-extras.js        # UI extras
│   │   ├── search.js           # Quran search
│   │   ├── local-search.js     # Local search
│   │   ├── download.js         # Offline download
│   │   ├── init.js             # Initialization
│   │   ├── tasmee.js           # Tasmee integration
│   │   ├── tasmee-pro-v2.js    # Tasmee Pro v2 engine
│   │   ├── tasmee-dashboard.js # Tasmee dashboard
│   │   └── tasmee-review.js    # Tasmee review
│   ├── tasmee-engine.js        # Tasmee engine
│   ├── tasmee-matcher.js       # Word alignment engine
│   ├── tasmee-store.js         # IndexedDB persistence
│   ├── quran-common.js         # Shared Quran navigation
│   ├── quran-app.js            # Quran app logic
│   ├── radio-stations.js       # Radio station data
│   ├── masbaha.js              # Counter logic
│   ├── notifications.js        # Notification logic
│   ├── juz-map.js              # Juz mapping
│   ├── surah-map.js            # Surah mapping
│   ├── medina2.data.js         # Medina font data
│   ├── quranpages.data.js      # Quran page data
│   └── tarteel-worker.js       # Tarteel search worker
├── data/                       # Quran data, adhan times, city data
├── db/                         # SQLite databases (tafsir, ayah coords)
├── json/                       # Ayah highlight coordinates
├── images/                     # Backgrounds, icons, featured images
├── img/                        # UI images and SVGs
├── icons/                      # PWA icons
├── fonts/                      # Local font files
├── assets/                     # Static assets (azkar JSON, audio, PDFs)
│   ├── thumbnails/6/           # Main 6 hadith book portraits (PNG)
│   └── thumbnails/others/      # Other hadith book covers (PNG)
├── tests/
│   ├── pages.spec.js           # Playwright page tests
│   ├── i18n.spec.js            # i18n key parity tests
│   └── tasmee-v2.spec.js       # Tasmee Pro v2 tests
├── scripts/                    # Utility scripts
├── docs/
│   └── check-test.md           # Pre-launch health check
├── tsconfig.json               # TypeScript configuration
├── vite.config.js              # Vite build configuration
├── playwright.config.js        # Playwright configuration
├── package.json                # Dependencies and scripts
├── sw.js                       # Service worker (v41)
└── manifest.json               # PWA manifest
```

---

## Pages

| Page | File | Description |
|---|---|---|
| Home | `index.html` | Feature grid, prayer widget, bottom navigation |
| Quran | `pages/quran.html` | Interactive mushaf with Tasmee Pro v2, 5 variants, word highlighting, tafsir |
| Quran (Legacy) | `pages/quran-old.html` | Legacy image-based mushaf reader |
| Quran Text | `pages/quran-text.html` | Plain text Quran reader with tasmee integration |
| Audio | `pages/audio.html` | Multi-reciter player with sleep timer, favorites, full-screen mode |
| Takrar | `pages/takrar.html` | Ayah repetition — range or single ayah, speed control, confirm picker |
| Radio | `pages/radio.html` | 24/7 live Quran radio stations with On-Air visuals |
| Masbaha | `pages/masbaha.html` | Smart counter with targets, stats, OLED mode |
| Azkar | `pages/azkar.html` | Morning & evening supplications |
| Azkar 2 | `pages/azkar2.html` | Additional adhkar collection |
| Hisn | `pages/hisn.html` | Complete Hisn Al-Muslim |
| Duaa | `pages/duaa.html` | Comprehensive duaa collection |
| Hadith | `pages/hadith.html` | Hadith browser by collection |
| Hadith Viewer | `pages/hadith-viewer.html` | Hadith viewer with 13 book collections, editorial book grid |
| Salah | `pages/salah.html` | After-salah adhkar |
| Sleeping | `pages/sleeping.html` | Bedtime adhkar with audio playback |
| Tasmee Dashboard | `pages/tasmee-dashboard.html` | Memorization progress & weekly charts |
| Tasmee Review | `pages/tasmee-review.html` | Due revisions with spaced repetition |
| Qibla | `pages/qibla.html` | Qibla compass with AR overlay |
| Notifications | `pages/notifications.html` | Prayer time notification settings |
| About | `pages/about.html` | App information |
| How To | `pages/howto.html` | Usage guide |

---

## Design System

The app uses a custom **glassmorphism** design system with 4 themes:

| Theme | Background | Glass Effect | Accent |
|---|---|---|---|
| **Light** | `Background-light.webp` | White translucent panels | Emerald `#10B981` |
| **Dark** | `Background-dark.webp` | Slate translucent panels | Emerald `#10B981` |
| **Sepia** | `background-sepia.webp` | Warm parchment panels | Gold `#E0B252` |
| **OLED Black** | None (pure black `#000000`) | Dark slate translucent panels | Emerald `#10B981` |

Key design tokens:
- **Fonts:** Tajawal (UI), Amiri (Quran/Arabic text)
- **Glass:** `backdrop-filter: blur(14px–16px)` with translucent backgrounds
- **Radius:** 12px–32px depending on component
- **Animations:** fadeIn, pulse, spin, staggered card entrance
- **Notch support:** `@supports` CSS rule for 30px safe-area padding on notched iPhones (Android unaffected)

---

## Internationalization

The app supports **5 languages** via a custom i18n engine (`js/i18n.js`):

| Language | Code | Status |
|---|---|---|
| العربية | `ar` | ✅ 612 keys |
| English | `en` | ✅ 612 keys |
| Türkçe | `tr` | ✅ 612 keys |
| کوردی (Sorani) | `ckb` | ✅ 612 keys |
| اردو | `ur` | ✅ 612 keys |

All 5 locales have full key parity — no missing or extra keys against English.
The language picker saves to `localStorage` and persists across sessions.

---

## Testing

```bash
npm test                          # Run all Playwright tests
npx playwright test --ui          # Open Playwright UI mode
npx playwright test -- -g "i18n"  # Run only i18n tests
```

Tests cover:
- Resource loading (no 404s, no broken paths)
- Navigation link consistency across all pages
- Index.html feature cards and settings links
- Intra-page link validation
- Service worker asset list verification
- HTML file existence checks
- i18n key parity (all 5 locales compared to English baseline)
- `data-i18n-html` placeholder safety (no child-destruction risk)

---

## Author

**Soliman Anas** — [@SolimanAnas](https://github.com/SolimanAnas)

Google Play: [Zad Al-Muslim](https://play.google.com/store/apps/details?id=io.github.solimananas.twa)
Live App: [solimananas.github.io/Tasbee7](https://solimananas.github.io/Tasbee7)

---

<div align="center">

### <sub>"وَتَزَوَّدُوا فَإِنَّ خَيْرَ الزَّادِ التَّقْوَى"</sub>
</div>
