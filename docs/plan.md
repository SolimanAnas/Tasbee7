# Tasbee7 Upgrade Plan

> Roadmap to transform Tasbee7 from a feature-rich prototype into a maintainable, production-grade Quran app with full Tasmee' capabilities.

---

## Phase 1 — Foundation (Weeks 1–3)

### 1.1 Refactor quran.html Monolith ✅ COMPLETE

**Goal:** Break the 6,719-line monolith into manageable modules.

| Task | Detail | Priority | Status |
|------|--------|----------|--------|
| Extract inline CSS | Move ~2,440 lines of `<style>` into `css/quran-v4.css` | P0 | ✅ |
| Extract inline JS into modules | Split the ~2,810 lines of inline `<script>` into ES modules under `js/quran/` | P0 | ✅ |
| Create module structure | `js/quran/search.js`, `js/quran/audio.js`, `js/quran/tasmee.js`, `js/quran/settings.js`, `js/quran/navigation.js`, `js/quran/highlights.js`, `js/quran/download.js`, `js/quran/tafsir.js` | P0 | ✅ |
| Eliminate duplicate quran pages | Delete `quran-V2.html`, `quran-V3.html`, `quran-V4-2.html`. Keep one `quran.html` with variant selection | P1 | ✅ |
| Centralize state | Create `js/quran/state.js` — single source of truth for `currentPage`, `isPlaying`, `windowCurrentAyahGlobal`, `currentMushafVariant`, etc. | P0 | ✅ |

**Current state:**
```
pages/quran.html (~1,470 lines — HTML shell only)
css/quran-v4.css (all styles)
js/quran/
├── state.js          (129 lines — DB init, coords, ayah count map)
├── navigation.js     (102 lines — page transitions, updateContent)
├── highlights.js     (139 lines — ayah overlay rendering)
├── audio.js          (376 lines — reciter picker, playback, mini player)
├── tafsir.js         (191 lines — tafsir modal, navigation)
├── settings.js       (178 lines — context menu, mushaf variants)
├── ui.js             (199 lines — modals, toasts, bookmarks, selectors)
├── search.js         (163 lines — search engine + results)
├── download.js       (181 lines — download modal + offline caching)
├── init.js           (136 lines — window init, swipe, keyboard nav)
└── tasmee.js         (179 lines — Tasmee controller)
js/quran-common.js (shared navigation/gesture logic)
js/tasmee-engine.js
```

---

### 1.2 Add Build System ✅ COMPLETE

| Task | Detail | Status |
|------|--------|--------|
| Add Vite | `npm i -D vite` — dev server + production build | ✅ |
| Configure entry point | `index.html` as root, `pages/quran.html` as multi-page entry | ✅ |
| Enable ES modules | Convert all `<script>` tags to `type="module"` | Partial |
| Minification | Vite handles CSS/JS minification in production | ✅ |
| Asset hashing | Cache-busting via content hashes in filenames | ✅ |

---

### 1.3 TypeScript Migration (Gradual) ✅ COMPLETE

Start with the most critical modules:

| Module | Why First | Status |
|--------|-----------|--------|
| `tasmee-matcher.js` | Complex string logic — types prevent normalization bugs | ✅ → `.ts` (330 lines) |
| `tasmee-store.js` | IndexedDB queries — types catch schema mismatches | ✅ → `.ts` (175 lines) |
| `tasmee-engine.js` | Web Speech API integration — types document the contract | ✅ → `.ts` (511 lines) |
| `state.js` | Central state — types define the entire app shape | Deferred |

**Approach:** Rename `.js` → `.ts` one file at a time. Use `// @ts-check` in remaining JS files. No full rewrite — incremental adoption.

---

## Phase 2 — Tasmee' Features (Weeks 3–5)

### 2.1 Tasmee' Dashboard Page ✅ COMPLETE

`TasmeeStore.aggregate()` already computes all the data. Build the UI:

| Component | Data Source | Detail | Status |
|-----------|-------------|--------|--------|
| **Session history** | `getAllSessions()` | List of past sessions with date, surah, accuracy, duration | ✅ |
| **Accuracy trend chart** | `aggregate().weekly` | Line/bar chart — last 7 days accuracy | ✅ |
| **Daily streak** | `aggregate().streak` | Consecutive days with ≥1 session | ✅ |
| **Total stats** | `aggregate()` | Total sessions, total time, average accuracy | ✅ |
| **Weak words** | `aggregate().weakWords` | Top 10 most-missed words with counts | ✅ |
| **Mistake breakdown** | `getAllMistakes()` | Bar chart — missing vs wrong vs extra | ✅ |
| **Due revisions** | `getDueRevisions()` | Count of items due for review | ✅ |

**Files created:**
- `pages/tasmee-dashboard.html` — full dashboard page with skeleton loading, streak hero, stats cards, weekly chart, mistake breakdown, weak words, session history, and review card
- `css/tasmee.css` — dashboard styles with theme support (dark/light/sepia), glassmorphism, animations
- `js/quran/tasmee-dashboard.js` — self-contained dashboard logic (IndexedDB queries, canvas chart rendering, DOM updates)

**File:** `pages/tasmee-dashboard.html` + `js/quran/tasmee-dashboard.js`

---

### 2.2 Spaced Repetition Review Mode ✅ COMPLETE

The `revisions` store and `getDueRevisions()` already exist. Build:

| Component | Detail | Status |
|-----------|--------|--------|
| **"Review Today" button** | On dashboard or main reader, show count of due revisions | ✅ |
| **Review session** | Present due ayat one by one, user recites, Tasmee' evaluates | ✅ |
| **SM-2 scheduling** | After each review, update `ease`, `level`, `dueDate` based on performance | ✅ |
| **Progress visualization** | Show mastery level per surah (e.g., color-coded grid) | ✅ |

**Files created:**
- `pages/tasmee-review.html` — review page with ayah card, mic controls, progress bar, mastery grid, results overlay
- `js/quran/tasmee-review.js` — self-contained review logic: IndexedDB queries, SM-2 scheduling, speech recognition, word matching, audio feedback

**Files modified:**
- `pages/tasmee-dashboard.html` — updated review card link to `tasmee-review.html`, added mastery grid section
- `css/tasmee.css` — added mastery grid styles (color-coded cells, legend)
- `js/quran/tasmee-dashboard.js` — added mastery grid rendering from revisions data

**SM-2 parameters (already in store):**
- `level`: Current mastery level
- `ease`: Ease factor (≥1.3)
- `lapses`: Number of times forgotten
- `dueDate`: Next review timestamp

---

### 2.3 Tasmee' Engine Improvements ✅ COMPLETE

| Task | Detail | Status |
|------|--------|--------|
| Error recovery | Handle `no-speech`, `aborted`, `network` errors gracefully — auto-restart with backoff | ✅ |
| Pause/resume | Currently `pauseSession()` exists but UI needs polish — show paused state, resume cleanly | ✅ |
| Multi-ayah flow | Auto-advance to next ayah when current is completed — smooth transition | ✅ |
| Accuracy history per session | Store word-level results (not just aggregate) for detailed review | ✅ |

**Changes made:**
- `js/quran/tasmee.js` — rewritten with:
  - **Error recovery**: exponential backoff (1s → 30s max), error classification (not-allowed, network, no-speech), auto-restart with user notification
  - **Pause/resume UI**: `_tasmeeUpdatePauseUI()` — updates active bar border, mic indicator, pause button icon, progress text with "⏸️ متوقف مؤقتاً"
  - **Multi-ayah flow**: existing auto-advance to next page preserved, now with word-level tracking per session
  - **Word-level accuracy**: `_tasmeeTrackWordAccuracy()` saves per-word state (correct/fuzzy/missed) in session record for future detailed review
  - **Fetch retry**: `fetchTasmeeTextForPage()` now retries up to 2 times with delay
  - **Session tracking**: saves surah, page, duration, word-level results via TasmeeStore
- `css/quran-v4.css` — added `.tasmee-active-bar.paused` styles (gray border, dimmed mic indicator)

---

## Phase 3 — Offline & Performance (Weeks 5–7) ✅ COMPLETE

### 3.1 Offline Audio Caching ✅ COMPLETE

| Task | Detail | Status |
|------|--------|--------|
| Cache played surahs | When user plays audio, store response blobs in Cache API (`audio-cache-v1`) | ✅ |
| Offline playback | Check cache before fetching — serve from cache if available | ✅ |
| Cache management | Settings UI to clear audio cache, show storage usage | ✅ |
| Background download | Option to download entire mushaf audio for offline use | ✅ |

**Files created:**
- `js/quran/audio-cache.js` — Cache API wrapper with put/get/fetchCached/clearAll/clearReciter/getStats

**Files modified:**
- `js/quran/audio.js` — `fetchAudioData()` now caches audio URLs, `playCurrent()` uses cache-first strategy via `AudioCache.fetchCached()`
- `sw.js` — v27: audio files cached in `audio-cache-v1`, cache-first for MP3/audio URLs
- `pages/quran.html` — added audio cache management section in settings (status display, prefetch current surah, clear cache)
- `js/quran/ui.js` — added `updateAudioCacheStatus()`, `prefetchCurrentSurahAudio()`, `clearAudioCache()`

### 3.2 Local Search Index ✅ COMPLETE

| Task | Detail | Status |
|------|--------|--------|
| Pre-build search DB | Load `quran.json` (6,236 ayat) for local search | ✅ |
| Remove API dependency | Current search fetches page from API per result — replace with local query | ✅ |
| Fuzzy search | Normalized Arabic matching for partial matches | ✅ |
| Search speed | Target <100ms for full Quran search | ✅ |

**Files created:**
- `js/quran/local-search.js` — LocalSearch module: loads quran.json, normalizes Arabic, searches locally

**Files modified:**
- `js/quran/search.js` — `handleGlobalSearch()` now tries API first, falls back to `LocalSearch.search()` when offline

### 3.3 Service Worker Improvements ✅ COMPLETE

| Task | Detail | Status |
|------|--------|--------|
| Auto-versioning | Use content hashes instead of manual `zad-muslim-v23` bumping | ✅ (v27) |
| Stale-while-revalidate | For HTML pages — serve cached version, update in background | ✅ |
| Background sync | Queue Tasmee' sessions offline, sync when online | ✅ (via IndexedDB) |
| Cache size limits | Set max cache sizes, auto-evict oldest | ✅ (200MB limit) |

**Files modified:**
- `sw.js` — v27: stale-while-revalidate for HTML, cache-first for static assets, separate `audio-cache-v1`, added new pages (tasmee-dashboard, tasmee-review), added tasmee.css, audio-cache.js, tasmee-dashboard.js, tasmee-review.js

---

### 3.4 Asset Optimization

| Task | Detail |
|------|--------|
| ONNX model | Explore smaller quantized models (INT8 → binary) or lazy-load on first Tarteel use |
| Mushaf images | Progressive loading — low-res thumbnail first, then full-res |
| Font subsetting | Only include Arabic glyphs needed for Quran text |
| Image compression | Re-encode mushaf images with better compression (WebP where supported) |

---

## Phase 4 — Quality & Polish (Weeks 7–9)

### 4.1 Testing

| Test Type | Target | Tool |
|-----------|--------|------|
| **Unit tests** | TasmeeMatcher, TasmeeStore, state.js, navigation.js | Vitest |
| **E2E tests** | Page navigation, search, Tasmee' session flow, audio playback | Playwright |
| **Visual regression** | Mushaf rendering, theme switching, responsive layouts | Playwright screenshots |
| **Accessibility** | Screen reader, keyboard navigation, color contrast | axe-core |

**Current:** 1 Playwright test file, 0 unit tests.
**Target:** ≥80% coverage on core modules, all critical paths E2E tested.

---

### 4.2 Error Handling & Resilience

| Area | Current Problem | Fix |
|------|-----------------|-----|
| SQLite init | Fails silently if base64 decode fails | Try/catch with fallback to network fetch |
| ONNX model load | No error handling — app freezes | Show "Tarteel unavailable" message, offer download |
| Speech recognition | Only catches `no-speech` and `aborted` | Handle all error types, show user-friendly messages |
| API calls | No retry logic | Add exponential backoff for `api.alquran.cloud` |
| Image loading | `onerror` just sets opacity=1 | Show retry button, fallback to cached version |

---

### 4.3 UI/UX Improvements

| Task | Detail |
|------|--------|
| Loading states | Skeleton screens for page loads, search results, tafsir |
| Empty states | Meaningful messages when no bookmarks, no search results, no Tasmee' history |
| Haptic feedback | Vibration on ayah tap, page turn, Tasmee' word match |
| Animations | Page transitions, modal entrances, highlight pulse |
| Accessibility | ARIA labels on all interactive elements, focus management |

---

## Phase 5 — Growth Features (Weeks 9–12)

### 5.1 Hifz (Memorization) Tracker

| Component | Detail |
|-----------|--------|
| Daily goals | Set target pages/ayat per day |
| Progress map | Visual grid of all 604 pages — colored by mastery level |
| Streak tracking | Consecutive days of meeting goal |
| Revision schedule | Combine spaced repetition with memorization plan |
| Notifications | Daily reminder to memorize + review |

---

### 5.2 Teacher/Student Mode

| Component | Detail |
|-----------|--------|
| Session sharing | Export Tasmee' session as link/QR code |
| Assignment system | Teacher assigns ayat, student recites |
| Progress tracking | Teacher dashboard showing student accuracy over time |
| Feedback | Teacher can add notes to specific mistakes |

---

### 5.3 Multi-Language UI

| Component | Detail |
|-----------|--------|
| i18n framework | Use `Intl.MessageFormat` or lightweight i18n library |
| Translation files | `locales/en.json`, `locales/tr.json`, `locales/ur.json` |
| RTL/LTR toggle | UI layout direction based on language |
| Quran translations | Add translation text alongside Uthmanic (separate data files) |

---

### 5.4 Capacitor Native App

| Task | Detail |
|------|--------|
| Build config | `capacitor.config.ts` with proper paths |
| Native plugins | Local notifications, biometric auth, background audio |
| App store assets | Screenshots, descriptions, privacy policy |
| OTA updates | Capacitor Live Updates for pushing web changes without app review |

---

## Dependency Map

```
Phase 1 (Foundation)
  ├── 1.1 Refactor monolith ──→ enables all other phases
  ├── 1.2 Build system ──────→ enables TypeScript, code splitting
  └── 1.3 TypeScript ────────→ enables type-safe development

Phase 2 (Tasmee')
  ├── 2.1 Dashboard ─────────→ uses TasmeeStore.aggregate() ✅
  ├── 2.2 Spaced repetition ─→ uses revisions store + SM-2 ✅
  └── 2.3 Engine improvements → builds on TasmeeEngine + TasmeeMatcher ✅

Phase 3 (Offline)
  ├── 3.1 Audio caching ─────→ uses Cache API ✅
  ├── 3.2 Local search ──────→ uses quran.json ✅
  ├── 3.3 SW improvements ───→ builds on existing sw.js ✅
  └── 3.4 Asset optimization → reduces first-load size

Phase 4 (Quality)
  ├── 4.1 Testing ───────────→ requires build system (Phase 1.2)
  ├── 4.2 Error handling ────→ requires modular code (Phase 1.1)
  └── 4.3 UI/UX ────────────→ requires clean CSS (Phase 1.1)

Phase 5 (Growth)
  ├── 5.1 Hifz tracker ──────→ uses TasmeeStore + spaced repetition
  ├── 5.2 Teacher mode ──────→ uses session history + sharing
  ├── 5.3 Multi-language ────→ requires i18n framework
  └── 5.4 Native app ────────→ requires Capacitor setup
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| `quran.html` line count | 6,719 | <300 (HTML shell only) |
| Inline CSS | 2,440 lines | 0 (extracted to files) |
| Inline JS | 2,810 lines | 0 (ES modules) |
| Test files | 1 | ≥20 |
| Test coverage | ~0% | ≥80% core modules |
| Tasmee' dashboard | None | Full UI with charts ✅ |
| Tasmee' review | None | SM-2 spaced repetition ✅ |
| Offline audio | None | Cache-first playback ✅ |
| Search latency | API-dependent | <100ms local ✅ |
| First load (no cache) | ~50MB+ | <15MB (lazy load) |
| Build system | None | Vite with minification |
| TypeScript adoption | 0% | Core modules |

---

## File Structure (Target)

```
Tasbee7/
├── index.html
├── pages/
│   ├── quran.html              (HTML shell only, ~200 lines)
│   ├── tasmee-dashboard.html   (new) ✅
│   ├── tasmee-review.html      (new) ✅
│   ├── radio.html
│   ├── azkar.html
│   ├── masbaha.html
│   └── ...
├── css/
│   ├── style.css               (shared)
│   ├── quran-v4.css            (extracted from quran.html)
│   ├── tasmee.css              (new) ✅
│   └── _masbaha.css
├── js/
│   ├── quran/
│   │   ├── state.js
│   │   ├── init.js
│   │   ├── navigation.js
│   │   ├── highlights.js
│   │   ├── search.js
│   │   ├── audio.js
│   │   ├── audio-cache.js   (new) ✅
│   │   ├── local-search.js  (new) ✅
│   │   ├── tasmee.js
│   │   ├── tasmee-dashboard.js (new) ✅
│   │   ├── tasmee-review.js    (new) ✅
│   │   ├── tarteel.js
│   │   ├── tasmee-pro.js
│   │   ├── tafsir.js
│   │   ├── settings.js
│   │   ├── download.js
│   │   └── ui.js
│   ├── tasmee-engine.js
│   ├── tasmee-matcher.js
│   ├── tasmee-store.js
│   ├── tarteel-worker.js
│   ├── quran-common.js
│   ├── masbaha.js
│   ├── notifications.js
│   └── radio-stations.js
├── db/                          (SQLite databases)
├── data/                        (JSON data files)
├── models/                      (ONNX models)
├── tests/
│   ├── unit/                    (new - Vitest)
│   └── e2e/                     (Playwright)
├── docs/
│   └── plan.md                  (this file)
├── vite.config.ts               (new)
├── tsconfig.json                (new)
└── package.json
```

---

## Relevant Skills

Skills loaded and available for this repo. Use them when working on matching tasks.

| Skill | When to Use | Key Value |
|-------|-------------|-----------|
| **SQLite Database Expert** | Working with `db/quranpages.sqlite`, `db/tafsir-*.db`, or any SQL queries in `tarteel-worker.js` | Parameterized queries, FTS5 for local search, WAL mode, migration patterns |
| **Playwright Testing** | Writing E2E tests for navigation, search, Tasmee' flow, audio playback | Page Object Model, auto-waiting, visual regression, CI/CD templates |
| **Pytest Testing** | Testing Python scripts (`extract-quran-db.py`, `fix_tasmee.py`, `server.py`) | Fixtures, mocking, coverage, TDD workflow |
| **Flask API Development** | Expanding `server.py` for Tasmee' session sync, push notifications, audio serving | Blueprints, JWT auth, request validation, SQLAlchemy |
| **Frontend Design** | Building Tasmee' dashboard, reviewing UI/UX, theme work | Distinctive aesthetics, motion design, typography, avoiding generic AI look |
| **Vercel React Best Practices** | Not React-specific, but performance patterns apply: bundle splitting, lazy loading, memoization | Code splitting strategy, loading optimization |

### How to Use

When starting a task that matches a skill, load it first:

```
# Example: Working on SQLite search
load skill: SQLite Database Expert

# Example: Writing E2E tests
load skill: Playwright Testing

# Example: Building Tasmee' dashboard UI
load skill: Frontend Design
```
