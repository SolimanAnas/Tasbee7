<div align="center">

<img src="https://github.com/SolimanAnas/quran-data-library/blob/main/line-by-line/1/6.png" alt="بسم الله الرحمن الرحيم" width="80%">
<br>
<img src="https://github.com/SolimanAnas/quran-data-library/blob/main/line-by-line/1/7.png" alt="الحمد لله رب العالمين" width="80%">

<br>
<br>

<img src="images/Featured.webp" alt="Zad Al-Muslim — زاد المسلم" width="100%">

<br>

# زاد المسلم — Zad Al-Muslim

[![Google Play](https://img.shields.io/badge/Google%20Play-00C853?style=for-the-badge&logo=googleplay&logoColor=white)](https://play.google.com/store/apps/details?id=io.github.solimananas.twa)
[![Live Demo](https://img.shields.io/badge/LIVE%20DEMO-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://solimananas.github.io/Tasbee7)
[![GitHub stars](https://img.shields.io/github/stars/SolimanAnas/Tasbee7?style=for-the-badge&color=FFD700)](https://github.com/SolimanAnas/Tasbee7/stargazers)
[![MIT License](https://img.shields.io/badge/License-MIT-1A7040?style=for-the-badge)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/SolimanAnas/Tasbee7/ci.yml?style=for-the-badge&label=CI&logo=github)](https://github.com/SolimanAnas/Tasbee7/actions)
[![Playwright Tests](https://img.shields.io/github/actions/workflow/status/SolimanAnas/Tasbee7/playwright.yml?style=for-the-badge&label=tests&logo=playwright)](https://github.com/SolimanAnas/Tasbee7/actions)
[![PWA](https://img.shields.io/badge/PWA-ready-10B981?style=for-the-badge&logo=pwa)](https://solimananas.github.io/Tasbee7)

<br>

### <sub>"وَتَزَوَّدُوا فَإِنَّ خَيْرَ الزَّادِ التَّقْوَى"</sub>

<br>

A modern, lightweight, ad-free Progressive Web App — your all-in-one Islamic spiritual companion.

**Free · No ads · No tracking · Works offline**

Supports **5 languages**: العربية, English, Türkçe, کوردی, اردو.

<br>

</div>

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Progressive Web App](#progressive-web-app)
- [Push Notification System](#push-notification-system)
- [Internationalization](#internationalization)
- [Performance](#performance)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Credits & Attribution](#credits--attribution)
- [License](#license)

---

## Features

<div align="center">

### 📖 Quran & Recitation

| | Feature | Description |
|:---:|:---|:---|
| 🕋 | **المصحف الشريف** | Interactive Quran reader with **5 mushaf variants** (Medina, Madinah 1420, Green, Tajweed, Text), word-level ayah highlighting, surah/page/juz navigation, bookmarks, search, and tafsir (Ibn Kathir, Qurtubi, Baghawi, Sa'di) |
| 🎧 | **الاستماع للقرآن** | Multi-reciter audio player with background playback, Media Session API, sleep timer, auto-play, shuffle, repeat, speed control, favorites, and download support |
| 🎬 | **تلاوات مرئية** | Rare and historic video recitations — Minshawi New Mushaf, Abdulbasit Abdussamad, Al-Husary, Sudais, Maher Al-Muaiqly, Mishary Al-Afasy, and more |
| 📻 | **إذاعة القرآن** | 24/7 live Quran radio via HLS streaming — multiple stations from around the world |
| 🔁 | **التكرار (Takrar)** | Ayah repetition tool for memorization — configurable reciter, surah/juz/page range, speed control, and verse repeat count |
| 🧠 | **التلقين (Tasmee)** | Ayah-by-ayah memorization coach with **ONNX-powered speech recognition** (NVIDIA FastConformer), spaced repetition, mistake tracking (missing/wrong/extra words), weekly activity charts, mastery map, and review scheduler |

### 📿 Adhkar & Supplications

| | Feature | Description |
|:---:|:---|:---|
| ☀️ | **أذكار الصباح** | Morning supplications with interactive counter and audio playback |
| 🌙 | **أذكار المساء** | Evening supplications with interactive counter and audio playback |
| 🛡️ | **حصن المسلم** | Complete Hisn Al-Muslim — all daily and occasion-based supplications with search, bookmarks, chapter navigation, and font controls |
| 🤲 | **بستان الدعاء** | Comprehensive duaa collection from Quran and Sunnah with search and bookmarks |
| 🕋 | **الرقية الشرعية** | Prophetic Ruqyah supplications for healing and protection |
| 🌙 | **أذكار النوم** | Bedtime adhkar with read-and-count workflow and audio playback |
| 🕌 | **أذكار بعد الصلاة** | Post-prayer supplications |

### 🛠️ Tools & Times

| | Feature | Description |
|:---:|:---|:---|
| 📿 | **المسبحة (Tasbih)** | Smart digital counter with haptic feedback, daily targets, lifetime statistics, custom dhikr, and OLED power-saving mode |
| 🧭 | **اتجاه القبلة** | Qibla compass with AR overlay, manual calibration mode, distance to Kaaba, compass sensitivity adjustment |
| 🕐 | **مواقيت الصلاة** | Accurate prayer times with multiple calculation methods (UAE, MWL, Umm Al-Qura, Egyptian, Karachi), Hijri calendar, date reel, city search, and auto-location via GPS |
| 🔔 | **الإشعارات الذكية** | Smart notification system — prayer alerts with adhan, pre-prayer reminders, morning/evening adhkar, Friday Surah Al-Kahf reminder, motivational streak messages, quiet hours, and test notification |
| 📚 | **باحث الأحاديث** | Hadith search and viewer with **13 book collections** (Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasa'i, Ibn Majah, Riyad al-Salihin, Bulugh al-Maram, Mishkat al-Masabih, Al-Adab al-Mufrad, Al-Shama'il al-Muhammadiyya, 40 Hadith Nawawi, 40 Qudsi), advanced search across all books, bookmarks, chapter navigation, and hadith grading |

### 🎨 Experience

| | Feature | Description |
|:---:|:---|:---|
| 🎨 | **Glassmorphism Themes** | 4 elegant themes: **Light**, **Dark**, **Sepia** (warm parchment), and **OLED Black** with smooth transitions |
| 🌐 | **5 Languages** | Full i18n — العربية, English, Türkçe, کوردی (Sorani), اردو — with 637+ keys each at full parity |
| 📱 | **Progressive Web App** | Installable, works offline, app shortcuts to Quran/Audio/Radio/Azkar |
| 📦 | **Offline-First** | Full offline support via service worker — cached HTML, CSS, JS, fonts, and assets |
| ♿ | **Accessibility** | Reduced motion support, safe-area insets for notched devices, large touch targets |
| ⚡ | **Performance** | WebP images, lazy-loaded audio cache with FIFO eviction, self-hosted fonts with `font-display: swap` |

</div>

---

## Screenshots

<div align="center">

| Mobile | Tablet |
|:---:|:---:|
| ![Home](screenshots/home.png) | ![Home Tablet](screenshots/home-tablet.png) |
| ![Quran](screenshots/quran.png) | ![Quran Tablet](screenshots/quran-tablet.png) |
| ![Quran Text](screenshots/quran-text.png) | ![Quran Text Tablet](screenshots/quran-text-tablet.png) |
| ![Audio](screenshots/audio.png) | ![Audio Tablet](screenshots/audio-tablet.png) |
| ![Radio](screenshots/radio.png) | ![Radio Tablet](screenshots/radio-tablet.png) |
| ![Takrar](screenshots/takrar.png) | ![Takrar Tablet](screenshots/takrar-tablet.png) |
| ![Masbaha](screenshots/masbaha.png) | ![Masbaha Tablet](screenshots/masbaha-tablet.png) |
| ![Azkar](screenshots/azkar.png) | ![Azkar Tablet](screenshots/azkar-tablet.png) |
| ![Hisn](screenshots/hisn.png) | ![Hisn Tablet](screenshots/hisn-tablet.png) |
| ![Duaa](screenshots/duaa.png) | ![Duaa Tablet](screenshots/duaa-tablet.png) |
| ![Hadith](screenshots/hadith.png) | ![Hadith Tablet](screenshots/hadith-tablet.png) |
| ![Hadith Viewer](screenshots/hadith-viewer.png) | ![Hadith Viewer Tablet](screenshots/hadith-viewer-tablet.png) |
| ![Qibla](screenshots/qibla.png) | ![Qibla Tablet](screenshots/qibla-tablet.png) |
| ![Notifications](screenshots/notifications.png) | ![Notifications Tablet](screenshots/notifications-tablet.png) |
| ![Tasmee Dashboard](screenshots/tasmee-dashboard.png) | ![Tasmee Dashboard Tablet](screenshots/tasmee-dashboard-tablet.png) |
| ![Tasmee Review](screenshots/tasmee-review.png) | ![Tasmee Review Tablet](screenshots/tasmee-review-tablet.png) |
| ![How To](screenshots/howto.png) | ![How To Tablet](screenshots/howto-tablet.png) |
| ![About](screenshots/about.png) | ![About Tablet](screenshots/about-tablet.png) |
| ![Sleeping](screenshots/sleeping.png) | ![Sleeping Tablet](screenshots/sleeping-tablet.png) |
| ![Salah](screenshots/salah.png) | ![Salah Tablet](screenshots/salah-tablet.png) |

</div>

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, Vanilla JavaScript (ES2022), CSS3 (Glassmorphism) |
| **Build** | [Vite 7](https://vitejs.dev/) — dev server, production builds, multi-page rollup |
| **Type Checking** | [TypeScript 6](https://www.typescriptlang.org/) — incremental adoption, strict mode planned |
| **Linting** | [ESLint 9](https://eslint.org/) — flat config, correctness-only rules |
| **Audio** | HLS.js for live radio, MP3 streaming via `mp3quran.net` / `archive.org`, Media Session API |
| **Video** | HTML5 video player with rare Minshawi and top reciter recordings |
| **Quran Search** | Custom Tarteel search worker (indexed word-level matching) |
| **Database** | SQLite via [sql.js](https://sql.js.org/) for ayah-level tafsir/highlighting coordinates |
| **Storage** | `localStorage` + `IndexedDB` for settings, bookmarks, statistics, and Tasmee memorization data |
| **Speech Recognition** | [ONNX Runtime Web](https://onnxruntime.ai/) + NVIDIA FastConformer Arabic CTC model (quantized uint8, ~131 MB) |
| **Prayer Times** | [Adhan.js](https://github.com/batoulapps/adhan-js) — multiple calculation methods |
| **i18n** | Custom lightweight dynamic import engine — 5 locales at full key parity |
| **PWA** | Service Worker (cache-first, stale-while-revalidate, audio cache with FIFO eviction) + Web App Manifest |
| **Push Notifications** | Web Push API (RFC 8291/8188), VAPID, Cloudflare Workers + KV + Cron Triggers |
| **CI/CD** | GitHub Actions — typecheck, build, lint, precache/reference/i18n verification, Playwright (sharded × 2) |
| **Deployment** | GitHub Pages (frontend) + Cloudflare Workers (push server) |
| **Native** | Capacitor stubs — Google Play TWA build available |
| **Testing** | [Playwright](https://playwright.dev/) — ~200+ automated tests across all pages |

---

## Project Structure

```
Tasbee7/
├── index.html                  # App home — hero card, feature grid, prayer widget
├── 404.html                    # Styled offline/not-found fallback
├── pages/                      # Application pages
│   ├── quran.html              # Interactive mushaf (Tasmee Pro v2/v3)
│   ├── quran_v2.html           # Quran reader v2
│   ├── quran-text.html         # Plain text Quran reader
│   ├── audio.html              # Multi-reciter audio player
│   ├── video.html              # Rare video recitations
│   ├── radio.html              # Live Quran radio
│   ├── takrar.html             # Ayah repetition tool
│   ├── masbaha.html            # Digital tasbih counter
│   ├── azkar.html              # Morning/evening/ruqyah/sleeping/salah adhkar
│   ├── hisn.html               # Hisn Al-Muslim
│   ├── duaa.html               # Duaa collection
│   ├── hadith.html             # Hadith browser
│   ├── hadith-viewer.html      # Hadith viewer (13 book collections)
│   ├── qibla.html              # Qibla compass with AR
│   ├── notifications.html      # Push notification settings
│   ├── tasmee-dashboard.html   # Memorization progress & charts
│   ├── tasmee-review.html      # Spaced repetition review
│   ├── howto.html              # Usage guide
│   ├── about.html              # App information
│   ├── privacy.html            # Privacy policy
│   └── ...
├── css/                        # Stylesheets
│   ├── style.css               # Global styles + CSS custom properties
│   ├── svg-theme.css           # SVG icon theme overrides
│   ├── quran-v4.css            # Quran reader styles
│   ├── tasmee.css              # Tasmee engine styles
│   ├── tasmee-pro-v2.css       # Tasmee Pro v2/v3 styles
│   └── _masbaha.css            # Masbaha styles
├── js/                         # JavaScript modules
│   ├── i18n.js                 # Internationalization engine
│   ├── i18n/                   # Locale dictionaries (5 languages)
│   │   ├── ar.js, en.js, tr.js, ckb.js, ur.js
│   │   └── names.js            # Localized surah/reciter/station names
│   ├── theme-manager.js        # Unified theme switching (dark/light/sepia)
│   ├── prayer-service.js       # Centralized prayer time calculation
│   ├── toast.js                # Shared snackbar/toast component
│   ├── schedule-builder.js     # Push notification schedule builder
│   ├── notifications.js        # Push notification client
│   ├── quran-common.js         # Shared Quran navigation utilities
│   ├── tasmee-engine.js        # Tasmee memorization engine
│   ├── tasmee-matcher.js       # Word alignment engine (TypeScript transpiled)
│   ├── tasmee-store.js         # IndexedDB persistence layer
│   ├── masbaha.js              # Tasbih counter logic
│   ├── quran/                  # Quran reader sub-modules
│   │   ├── state.js, navigation.js, highlights.js, audio.js
│   │   ├── audio-cache.js, tafsir.js, settings.js, ui.js
│   │   ├── search.js, download.js, init.js
│   │   ├── tasmee.js, tasmee-pro-v2.js, tasmee-pro-v3.js
│   │   ├── tasmee-dashboard.js, tasmee-review.js
│   │   └── local-search.js, ui-extras.js
│   ├── plugins/                # Capacitor native stubs
│   └── ...
├── data/                       # Quran data, adhan times, city coordinates
│   ├── adhan.js                # Adhan prayer time library
│   ├── cities.js               # City coordinates database
│   ├── quran.json              # Full Quran text (uthmani + cleaned)
│   └── vocab.json              # CTC vocabulary for speech recognition
├── models/                     # ONNX speech recognition model
│   └── fastconformer_ar_ctc_q8.onnx
├── quran/                      # Mushaf page images (medina, tajweed, etc.)
├── assets/                     # Static assets
│   ├── azkar.json              # Adhkar and supplications JSON
│   ├── hisn_complete.json      # Complete Hisn Al-Muslim data
│   ├── duaa-*.json             # Duaa collections
│   ├── audio.json              # Quran audio metadata
│   ├── hadith/                 # Hadith collection data (13 books)
│   └── thumbnails/             # Hadith book cover thumbnails
├── fonts/                      # Self-hosted fonts (12 font files)
├── images/                     # Backgrounds and featured images
├── icons/                      # PWA icons (192, 512, 1024, maskable)
├── img/                        # UI icons (SVG set)
├── screenshots/                # App screenshots (mobile + tablet, 50+)
├── server/                     # Push notification server (Cloudflare Worker)
│   ├── cloudflare.js           # Main worker — HTTP API + cron dispatcher
│   ├── wrangler.toml           # Wrangler configuration
│   └── DEPLOY.md               # Deployment guide
├── worker/                     # Additional Cloudflare Workers
├── scripts/                    # Build and utility scripts
│   ├── verify-precache.cjs     # CI: verify SW precache references
│   ├── audit-refs.cjs          # CI: verify local HTML references
│   ├── check-i18n.cjs          # CI: verify i18n key parity
│   ├── transpile-tasmee.cjs    # CI: verify TS→JS twins match
│   ├── screenshots.cjs         # Screenshot generator
│   └── ...
├── tests/                      # Playwright test suite
│   ├── pages.spec.js           # Page loading, navigation, resource checks
│   ├── i18n.spec.js            # i18n key parity tests
│   ├── tasmee-v2.spec.js       # Tasmee Pro v2 tests
│   └── node/                   # Node.js unit tests
├── .github/workflows/          # CI/CD pipelines
│   ├── ci.yml                  # Typecheck, build, lint, verification
│   └── playwright.yml          # Playwright tests (2 shards)
├── vite.config.js              # Vite multi-page build config
├── playwright.config.js        # Playwright test configuration
├── tsconfig.json               # TypeScript config (incremental)
├── eslint.config.mjs           # ESLint flat config
├── sw.js                       # Service Worker (v69)
├── manifest.json               # PWA manifest
└── package.json                # Dependencies and scripts
```

---

## Quick Start

```bash
git clone https://github.com/SolimanAnas/Tasbee7.git
cd Tasbee7
npm install
npm run dev        # Dev server at http://localhost:3000
```

### Build Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint correctness checks |
| `npm run verify` | Run precache/reference/i18n verification suite |
| `npm test` | Run Playwright test suite |
| `npm run test:unit` | Run Node.js unit tests (Tasmee matcher) |

---

## Progressive Web App

Zad Al-Muslim is a fully-featured PWA that works reliably even without an internet connection.

| Feature | Implementation |
|---|---|
| **Installable** | Full Web App Manifest with icons (192–1024), `display: standalone`, `orientation: portrait` |
| **App Shortcuts** | 4 shortcuts: Quran, Audio, Radio, Azkar (long-press on home screen icon) |
| **Offline Support** | Service Worker precaches all HTML, CSS, JS, fonts, and assets on first visit |
| **Caching Strategy** | HTML: stale-while-revalidate; Static assets: cache-first; Audio: cache-first with FIFO eviction (120-entry cap); API calls: network-first |
| **Background Sync** | `periodicsync` refreshes the 7-day push notification schedule daily — notifications keep flowing even if the app isn't opened |
| **Offline Fallback** | Custom styled 404 page served when a page isn't cached |
| **Deep Links** | Notification deep links route to Quran, Azkar, Masbaha, Hisn, Radio, and Surah Al-Kahf |
| **Cross-Platform** | Works on Android (installable via Chrome), iOS (Safari "Add to Home Screen"), Desktop (Chrome/Edge/Firefox) |
| **Google Play** | Available as a Trusted Web Activity (TWA) on [Google Play](https://play.google.com/store/apps/details?id=io.github.solimananas.twa) |

---

## Push Notification System

The app features a production-grade push notification system built on **Web Push API (RFC 8291/8188)** with end-to-end encryption.

### Architecture

```
Client (adhan.js)
    │  /subscribe {subscription, schedule[7d], tzOffset}
    ▼
Cloudflare KV ─── Cloudflare Worker (cron * * * *)
                     │  dispatchDue() — fires due prayer/azkar/Kahf events
                     ▼
               Push Service → Device Notification
```

- **Client-side**: `js/notifications.js` computes prayer times locally using Adhan.js and uploads a ~7-day schedule of events on each app open
- **Server-side**: Cloudflare Worker (`server/cloudflare.js`) stores subscriptions in KV and runs every minute via cron trigger, dispatching only events due within the current minute
- **Deduplication**: Each record keeps a `lastDispatch` cursor — events fire once when `lastDispatch < ts ≤ now`; stale events (>15 min late) are skipped
- **Zero prayer-time math on server**: The server only delivers what the client precomputed — no server-side adhan dependency
- **Local scheduler defers to server**: When push is active, in-app notifications defer to the server dispatcher (no duplicate notifications)

### Notification Types

| Type | Timing | Description |
|---|---|---|
| Prayer alerts | At prayer time | Adhan notification with open/dismiss actions |
| Pre-prayer reminders | 10 min before | Prepare for the next prayer |
| Morning Adhkar | 4 AM – 8 AM | Daily morning supplication reminder |
| Evening Adhkar | 3 PM – 6 PM | Daily evening supplication reminder |
| Surah Al-Kahf | Friday | Weekly reminder to recite Surah Al-Kahf |
| Motivational | Daily | Streak-based encouragement messages |
| Quiet Hours | 11 PM – 5 AM | Do Not Disturb mode silences all notifications |

---

## Internationalization

The app uses a custom i18n engine (`js/i18n.js`) with dynamic locale imports, supporting **5 languages** at full key parity:

| Language | Code | Direction | Status |
|---|---|---|---|
| العربية | `ar` | RTL | ✅ 637+ keys |
| English | `en` | LTR | ✅ 637+ keys |
| Türkçe | `tr` | LTR | ✅ 637+ keys |
| کوردی (Sorani) | `ckb` | RTL | ✅ 637+ keys |
| اردو | `ur` | RTL | ✅ 637+ keys |

All 5 locales are verified in CI to have **identical key sets** — no missing or extra keys against the union. The language picker saves to `localStorage` and persists across sessions. RTL languages automatically apply the correct text direction.

---

## Performance

| Optimization | Detail |
|---|---|
| **WebP Images** | All background images, hadith thumbnails, and featured images converted to WebP (86% smaller than PNG equivalents) |
| **Service Worker Precache** | ~21 MB precache (down from 64 MB after moving large audio files to runtime cache) |
| **Audio Cache Eviction** | FIFO eviction with 120-entry cap prevents unbounded cache growth |
| **Font Loading** | `font-display: swap` with self-hosted fonts — no render-blocking font requests |
| **CSS Custom Properties** | Design tokens as CSS variables enable instant theme switching without repaints |
| **Staggered Animations** | Feature cards use staggered `cardIn` CSS animations with `prefers-reduced-motion` respect |
| **Lazy Module Loading** | Quran reader modules loaded on-demand; i18n dictionaries dynamically imported |
| **Notch Support** | `env(safe-area-inset-*)` for proper display on notched iPhones |
| **Touch Optimization** | `user-select: none` on UI, `active` scale transforms for instant feedback |

---

## Testing

```bash
npm test                          # Run all Playwright tests
npx playwright test --ui          # Open Playwright UI mode
npx playwright test -- -g "i18n"  # Run only i18n tests
npm run test:unit                 # Run Node.js unit tests
```

### CI Pipeline (GitHub Actions)

| Check | Description |
|---|---|
| **TypeScript** | `tsc --noEmit` — ensures type correctness |
| **ESLint** | Correctness-only rules — errors block, warnings advisory |
| **Vite Build** | Production build succeeds |
| **Precache Verification** | Every `sw.js` STATIC_ASSETS entry resolves to a real file |
| **Reference Audit** | Every local `src`/`href` in HTML resolves correctly |
| **i18n Parity** | All 5 locales have identical key sets (637+ keys each) |
| **Tasmee Twin Check** | `.js` transpiled outputs match their `.ts` sources |
| **Unit Tests** | Tasmee matcher algorithm tests |
| **Playwright (×2 shards)** | ~200+ tests across all pages — resource loading, navigation, link consistency, i18n rendering |

---

## Deployment

### Frontend (GitHub Pages)

The frontend is a static Vite build deployed to GitHub Pages:

```bash
npm run build
# Deploy dist/ to gh-pages branch
```

Live at: [solimananas.github.io/Tasbee7](https://solimananas.github.io/Tasbee7)

### Push Notification Server (Cloudflare Workers)

The push notification system runs as a Cloudflare Worker with KV storage and a per-minute cron trigger:

```bash
cd server
wrangler deploy
```

See [server/DEPLOY.md](server/DEPLOY.md) for full setup instructions including VAPID key generation and KV namespace creation.

---

## Roadmap

Based on the current codebase state and known gaps:

| Priority | Item | Status |
|---|---|---|
| 🎯 | **Centralize inline CSS/JS** — extract from pages into external files for caching and CSP | Planned |
| 🎯 | **Font subsetting** — reduce 3 MB font payload by subsetting to Arabic + Latin ranges | Deferred |
| 🎯 | **Content Security Policy** — tighten CSP as inline code is extracted | Planned |
| 📈 | **Enhanced accessibility** — axe-core sweep, ARIA labels, keyboard navigation | Open |
| 📈 | **Offline styled fallback** — serve a proper offline page instead of plain text 503 | Open |
| 📈 | **Manifest screenshots** — add more form factors for Play Store / PWA install prompt | Open |
| 🔧 | **Repo size** — 894 MB git history (mushaf page scans); consider Git LFS or external hosting | Open |
| 🔧 | **ESLint on HTML** — inline `<script>` patterns are currently out of scope | Open |

---

## Credits & Attribution

### Libraries & Frameworks

| Library | Purpose |
|---|---|
| [Vite](https://vitejs.dev/) | Build tool and dev server |
| [Playwright](https://playwright.dev/) | End-to-end testing |
| [Adhan.js](https://github.com/batoulapps/adhan-js) | Prayer time calculations |
| [HLS.js](https://github.com/video-dev/hls.js) | Live Quran radio streaming |
| [sql.js](https://sql.js.org/) | SQLite in the browser for tafsir coordinates |
| [ONNX Runtime Web](https://onnxruntime.ai/) | In-browser speech recognition for Tasmee |
| [ESLint](https://eslint.org/) | JavaScript linting |
| [TypeScript](https://www.typescriptlang.org/) | Type checking |

### Quran Speech Recognition Model

- **Model**: NVIDIA FastConformer Arabic CTC (quantized ONNX, uint8)
- **Base**: `nvidia/stt_ar_fastconformer_hybrid_large_pcd_v1.0`
- **License**: CC-BY-4.0
- **Source**: [yazinsai/offline-tarteel](https://github.com/yazinsai/offline-tarteel) — developed by [Yazin Insai](https://github.com/yazinsai)

### Audio Sources

- Quran recitations streamed from [mp3quran.net](https://mp3quran.net) and [archive.org](https://archive.org)
- Live radio streams from various Quran radio stations worldwide

### Fonts

- [Tajawal](https://fonts.google.com/specimen/Tajawal) — UI font (Arabic/Latin)
- [Amiri](https://fonts.google.com/specimen/Amiri) — Quran text display
- [Scheherazade New](https://fonts.google.com/specimen/Scheherazade+New) — Quran text
- Uthmanic Hafs, me_quran, qortoba, almushaf — additional mushaf script fonts

### Icons

- Custom SVG icon set (100+ icons) designed for the app
- Feather icon inspiration for some UI icons

---

## License

[MIT](LICENSE) © 2026 [Soliman Anas](https://github.com/SolimanAnas)

Built with ❤️ as Sadaqa Jariya (ongoing charity). If you find this app useful, please remember the developer and all contributors in your prayers.

<div align="center">

### <sub>"وَتَزَوَّدُوا فَإِنَّ خَيْرَ الزَّادِ التَّقْوَى"</sub>

</div>
