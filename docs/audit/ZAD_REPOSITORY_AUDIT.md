# Zad Al-Muslim — Repository Audit

Phase 1 of the November 2026 audit. Read-only: no application file was changed to produce it.

**Baseline:** branch `ccr-4dafda5f-ubdbgo` (main at `03805d7` plus the unmerged offline work).
**How to read it:** every statement is *verified* (I read the code or measured it) unless it is
marked **Assumption**. File paths are relative to the repository root.

Earlier documents in `docs/` were read and reconciled, in particular `docs/cleanup-candidates.md`
(October 2026), `upgrades.md` and `docs/plan2.md`. Where they are still accurate this report
points to them instead of repeating them.

---

## 1. What the application is

A static, multi-page Progressive Web App. There is no framework, no bundler in the production
path, no backend for content and no user accounts.

| Aspect | Reality |
|---|---|
| Hosting | GitHub Pages, served from the repository root under `/Tasbee7/` |
| Distribution | Web/PWA, plus a Google Play listing that wraps the site as a Trusted Web Activity |
| Languages | Vanilla HTML, CSS and JavaScript (classic scripts sharing globals). Four TypeScript files for the tasmee engine, transpiled to committed `.js` twins |
| Pages | `index.html` + 32 files in `pages/` (24 reachable, 8 orphaned — section 7) |
| Build | `vite build` exists and runs in CI, but **GitHub Pages serves the source files, not `dist/`**. The build is a syntax check, not a deployment step |
| State | `localStorage` (86 distinct keys), IndexedDB (tasmee sessions), Cache Storage (offline) |
| Servers | Two Cloudflare Workers the app calls: a push-notification scheduler and a radio stream proxy |
| Tests | 147 Playwright test definitions in 14 spec files (367 executed cases), one Node unit test, three CI guard scripts |

## 2. Size and shape

Tracked content is about **1.2 GB** in 6,400 files; `.git` is 1.1 GB.

| Path | Size | Files | What it is |
|---|---:|---:|---|
| `quran/` | 419 MB | 2,416 | Mushaf page images — **duplicates** of `mushaf pages/`, used only by an orphaned page |
| `promo/` | 351 MB | 108 | Marketing video sources and renders — not part of the app |
| `mushaf pages/` | ~420 MB | ~2,440 | Four mushaf image sets (604 pages each) — live |
| `mushaf-2/` | 176 MB | 605 | Fifth mushaf image set (PNG) — live |
| `assets/` | 127 MB | 79 | Hadith books (58 MB), bundled recordings (70 MB), adhkar JSON |
| `screenshots/` | 62 MB | 57 | Store screenshots — not part of the app |
| `db/` | 61 MB | 5 | Four tafsir SQLite books + the page-coordinate database |
| `images/` | 25 MB | 307 | Backgrounds, 250+ reciter portraits, thabat and video-maker art |
| `js/` | 8.6 MB | 70 | 5.4 MB of that is one base64 data file |
| everything else | < 20 MB | | pages, css, fonts, tests, docs, scripts |

Roughly **830 MB of the published site is not needed by any reachable screen** (`quran/`,
`promo/`, `screenshots/`). GitHub Pages has a 1 GB published-size limit; the site is over it or
very close. *(Assumption: I could not read the Pages build status from here.)*

## 3. Entry points and execution flow

### 3.1 Start-up

1. `index.html` loads `css/fonts.css`, `css/style.css`, `js/theme-manager.js`, `js/i18n.js`,
   `data/adhan.js`, `js/prayer-service.js`, then ~700 lines of inline script.
2. `ThemeManager.init()` applies `themeMode` from `localStorage` before paint.
3. `I18n.init()` dynamically imports `js/i18n/<lang>.js` and rewrites every `[data-i18n]` node.
   On first run it opens a language sheet.
4. Prayer times are computed **locally** with `adhan.js` from a stored approximate location
   (`prayer_lat`/`prayer_lng`, rounded to two decimals). No prayer-time API is called.
5. `sw.js` is registered. Since this branch, `js/net-status.js` registers it from every page.

### 3.2 Navigation

There is no router. Every feature is its own HTML document and navigation is a full page load
(`location.href`). Two exceptions:

- **Continuous audio** (`js/continuous-player.js`): when enabled, `audio.html` stays loaded as a
  host and other pages open inside an iframe above it, with a floating "island" player.
- **Back handling** (`js/back-close.js`): a shared helper that makes the hardware back button
  close the top sheet/modal before leaving the page.

### 3.3 The mushaf reader (`pages/quran.html`)

The page is 1,555 lines of markup with 119 inline event attributes; logic lives in
`js/quran-common.js` and 12 modules under `js/quran/`.

1. `js/vendor/sql-wasm.js` (bundled) and two data scripts load:
   `js/quranpages.data.js` (5.4 MB — the coordinate database as base64) and
   `js/medina2.data.js` (1.3 MB).
2. `state.js → initDatabase()` opens the SQLite database in memory. Table `ayarects` maps every
   word of every ayah to a rectangle on one of 604 pages.
3. `settings.js` picks one of six variants (five image sets, one text view) and builds image
   URLs with `getImagePath()`.
4. `highlights.js` draws ayah/word highlights from the rectangles. *(Per the owner's
   instruction these settings and the image sizes are out of scope for change.)*
5. `audio.js` asks `api.alquran.cloud` for each ayah's audio URL, then streams it from
   `cdn.islamic.network`. This path needs a connection.
6. `tafsir.js` reads tafsir from a local SQLite book (`db/tafsir-*.db`) — but also fetches the
   ayah text from `api.alquran.cloud` in the same `Promise.all`, so **the whole sheet fails
   offline even though the tafsir itself is on the device** (`js/quran/tafsir.js:176`).
7. Tasmee (recitation checking) runs a 131 MB ONNX speech model in a module worker
   (`js/tarteel-worker.js`), downloaded on demand from an R2 bucket and cached.

### 3.4 The text mushaf (`pages/quran-text.html`)

Self-contained: 932 lines of inline script. It does **not** use the local `data/quran.json`.
Each page's text is fetched live from two third-party APIs (`api.quran.com` for the text,
`api.alquran.cloud` for metadata and audio), merged by array index, formatted with regular
expressions and stored as rendered HTML in `localStorage`. See the content audit for the
integrity implications.

### 3.5 Audio player (`pages/audio.html`)

976 lines of inline script. Track indexes come from `json/audio-01.json` and `audio-02.json`
(about 3,000 URLs across 250+ reciters, mostly `mp3quran.net`). Media Session, sleep timer,
favourites, resume and error recovery are implemented here.

### 3.6 Notifications

`js/notifications.js` computes a 30-day schedule locally and uploads it to the push worker
(`server/cloudflare.js`), which a cron trigger walks every minute. The service worker shows the
push and handles the click. A local in-page scheduler covers browsers without push.

## 4. Feature inventory (verified by opening each page)

| Area | Pages | Notes |
|---|---|---|
| Mushaf (page images) | `quran.html` | 5 image variants + text view, word highlighting, bookmarks, search, 4 tafsir books, tasmee |
| Mushaf (text) | `quran-text.html` | Online text, fonts, auto-scroll, tafsir via API |
| Audio | `audio.html` | 250+ reciters, continuous playback, download |
| Radio | `radio.html` | 173 stations, HLS via `hls.js`, categories, sleep timer |
| Memorisation | `takrar.html`, `tasmee-dashboard.html`, `tasmee-review.html` | Repetition tool; speech-checked recitation with spaced review |
| Adhkar | `azkar.html?type=morning|night|ruqia|salah|sleeping`, `salah.html`, `sleeping.html` | Counters, sources, virtues, bundled audio |
| Books | `hisn.html`, `duaa.html`, `nawawi.html`, `qudsi.html` | Shared engine `js/hadith-book.js`, memorise/favourite/share |
| Hadith library | `hadith.html`, `hadith-viewer.html` | 15 collections, ~34,500 records |
| Tasbeeh | `masbaha.html` | Counter, custom dhikr, targets, stats |
| Steadfastness | `thabat.html` | Private habit/abstinence journeys, Quran wird, optional PIN |
| Utilities | `qibla.html`, `notifications.html`, `video-maker.html` | Compass with magnetic correction; push settings; ayah video export |
| Info | `howto.html`, `about.html`, `privacy.html` | |
| Home | `index.html` | Prayer card, Hijri date, feature grid, weekly stats, settings sheet, offline download |

Not present, despite the brief asking: **authentication, user accounts, cloud sync, a database
backend, Supabase.** None exists in the code. `.env.example` mentions Flask and a Google client
id, which nothing uses.

## 5. Dependencies

| Dependency | How it is loaded | Assessment |
|---|---|---|
| `adhan.js` | Vendored (`data/adhan.js`) | Good — offline prayer times |
| `sql.js` 1.8.0 | Vendored on this branch (`js/vendor/`) | Good |
| `hls.js` 1.5.13 | CDN, pinned, no integrity hash (`pages/radio.html:26`) | Acceptable; add SRI or vendor |
| `hls.js@latest` | CDN, **unpinned** (`pages/radio2.html:46`) | Orphaned page — delete with the page |
| `jszip` 3.10.1 | CDN, injected at runtime (`pages/audio-download.html:1973`) | Orphaned page |
| `onnxruntime-web` 1.24.2 | CDN ES module import inside a worker | Pinned; runs with full worker privileges, no SRI possible on `import` |
| Capacitor shims | `js/plugins/*` | Leftovers from a native build; not loaded by the service worker path |
| Dev: vite, playwright, typescript, eslint | `package.json` | `npm audit` reports 7 advisories (6 high), all in dev tooling, none shipped |

No runtime npm dependencies. That is a strength: nothing to break on install, nothing to patch
in production.

## 6. External services the app talks to

| Host | Used for | Fails gracefully offline? |
|---|---|---|
| `api.alquran.cloud` | Ayah audio lookup, search, tafsir text, text-mushaf metadata | Partly — tafsir sheet does not |
| `api.quran.com` | Text-mushaf Quran text | No — page shows a loader |
| `cdn.islamic.network` | Per-ayah audio (no CORS headers → cannot be cached) | Stops with a message (this branch) |
| `mp3quran.net`, `archive.org`, GitHub Releases | Surah recordings | Yes — error state with retry |
| `everyayah.com` | Takrar and video-maker audio | Partly |
| `qurango.net`, `itworkscdn.net` | Radio streams | Yes |
| `zad-push-server.*.workers.dev` | Push schedule | Yes — falls back to local scheduling |
| `quran-stream-proxy.*.workers.dev` | CORS proxy for one radio provider | Yes |
| R2 bucket | 131 MB speech model | Feature disabled until downloaded |
| `hisnmuslim.com` | Hisn audio | Yes |

## 7. Dead code, duplication and unused assets

`docs/cleanup-candidates.md` is accurate; I re-verified its main items. Summary plus what is new:

**Orphaned pages (no link opens them), all still precached:**
`quran-v2.html`, `quran_v2.html`, `audio2.html`, `audio2 - Copy.html`, `audio3.html`,
`radio2.html`, `audio-download.html`, `video.html`. `quran.html` and `quran_v2.html` differ by
two script tags.

**Scripts no page loads:** `js/masbaha.js`, `js/quran-app.js`, `js/quran/audio-cache.js`,
`js/quran/local-search.js`, `js/toast.js`, `js/juz-map.js`, `css/_masbaha.css`.

**Precached but never requested by any page (new finding):**
`assets/husn.pdf` (2.2 MB), `assets/part1…5.json`, `assets/audio.json`, plus the orphaned pages
and scripts above. Every install downloads them.

**Dead settings UI (new finding):** the mushaf settings show "audio cache" status and a
"download surah audio" button (`pages/quran.html:898-908`). The module they call is never loaded,
and the audio host does not allow the files to be stored, so the feature cannot work as built.

**Introduced by the offline work on this branch (self-review):** `assets/azan.mp3` (4.4 MB) was
added to the "download everything" list, but no code plays it. It should come out.

**Duplication by copy-paste:** each large page carries its own toast, modal, theme toggle, share
and escape helpers. There are at least five HTML-escaping functions and eight toast
implementations (`upgrades.md` P2-3c). Four near-identical visual systems are described in the UX
audit.

**Two push-server implementations:** `server/cloudflare.js` (deployed) and
`worker/push-worker.js` (not deployed, empty KV id). `server/server.js` is a labelled reference
with placeholder keys.

## 8. Error handling and logging

- No global `error` / `unhandledrejection` handler and no error reporting. A failure in the field
  is invisible to the maintainer. That is consistent with the no-tracking promise, but it means
  quality depends entirely on tests and user reports.
- 97 empty `catch {}` blocks. Most are deliberate (storage unavailable), some hide real failures —
  for example the tafsir sheet reports "tafsir not found" when the actual cause is no connection.
- 26 `alert()` and 6 `confirm()` calls remain; they block the UI and cannot be styled or translated
  consistently.
- 91 `console.*` calls ship to production, several with emoji banners in `sw.js`.

## 9. Build, CI and deployment

- **CI (`.github/workflows/ci.yml`):** type-check, ESLint (0 errors, ~850 advisory warnings),
  `vite build`, precache-reference guard, HTML-reference guard, i18n key-parity guard, tasmee
  `.ts`/`.js` twin check, matcher unit test. This is a good safety net for a project this size.
- **Playwright (`playwright.yml`):** two shards on `ubuntu-24.04`.
- **Deployment:** a push to `main` publishes the repository as-is. There is no staging, no
  preview deployment and no minification. Cache invalidation relies on bumping `CACHE_NAME` by
  hand in `sw.js`; the changelog for every version since v73 lives in a single 6,000-character
  comment on that line.
- **`tests/screenshots/*.png` are tracked although `.gitignore` excludes them**, so every local
  test run dirties the working tree.

## 10. Technical debt, ranked

1. **Inline code.** About 13,000 lines of JavaScript and 11,000 lines of CSS live inside HTML
   files. They are outside ESLint, cannot be shared, and make a Content-Security-Policy
   impossible without `unsafe-inline`.
2. **No shared UI layer.** Header, sheets, toasts, buttons and themes are re-implemented per
   page, which is why the app looks like four different products.
3. **Repository weight.** 830 MB of unused published files; 1.1 GB of history.
4. **The text mushaf depends on third-party APIs at read time** while a verified local copy of the
   text sits unused beside it.
5. **Manual release mechanics.** Hand-maintained precache list (321 entries) and version string.
6. **Orphaned pages and scripts** still tested (37 tests target an orphaned page) and precached.
7. **Global-scope coupling.** Modules communicate through `window` globals and inline
   `onclick=""` attributes; load order is the only contract.

## 11. Critical architectural weaknesses

- **Reading the Quran as text requires the network and trusts two external APIs** for sacred text
  shown to the user (details in the content audit).
- **`pages/hadith.html` downloads all 15 collections — 47.6 MB — every time it opens**
  (`pages/hadith.html:478`), to build an in-memory search index. On mobile data this is the single
  most expensive action in the app.
- **`pages/quran.html` transfers 9.1 MB before first use**, 5.4 MB of it a base64 database that
  must be parsed on the main thread.
- **The push dispatcher's cost grows linearly with subscribers and runs every minute** (security
  and performance audit, finding H-3).
- **No error visibility** (section 8).

## 12. Strengths worth preserving

- **Zero runtime dependencies and no build step in production.** The app will still open in ten
  years. Do not trade this away for a framework.
- **Local prayer times and Qibla** (adhan.js, a World Magnetic Model implementation in
  `js/wmm.js`). No location ever leaves the device for these.
- **A real offline layer**: precache, on-demand heavy content, byte-range audio, download-all.
- **Honest privacy posture**: no analytics, no accounts, coarse location only.
- **The newer "book" pages** (`hisn`, `duaa`, `nawawi`, `qudsi`, `thabat`): external CSS and JS,
  one shared engine, escaped output, per-item sources. This is the pattern the rest should follow.
- **CI guards** for precache references, HTML references and translation parity.
- **Verified Quran data**: `data/quran.json` and the page-coordinate database are complete and
  internally consistent (content audit).
- **A hardened push worker**: endpoint allow-list, schedule sanitising, admin token, TTL.
- **Five-language interface** with enforced key parity (1,237 keys per locale).
