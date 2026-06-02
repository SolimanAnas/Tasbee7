# Repository Structure — زاد المسلم (Zad Al-Muslim)

A static, offline-first **PWA** (no build step). HTML pages + vanilla JS modules,
served as-is and cached by a service worker. Optional Node/Cloudflare workers handle
push notifications and audio streaming.

> The repo was reorganised (branch `repo-restructure`) — see **§7** for what moved.

---

## 1. App entry points (the shipped app)

Shell is **`index.html`**; each feature is its own page. `sw.js` precaches exactly
these pages:

| Page | Feature |
|---|---|
| `index.html` | Home / launcher + streak/khatma tracking |
| `quran.html` | **Mushaf reader** (live) — variants, highlighting, search, audio, tafsir |
| `quran-text.html` | Text-mode Quran reader |
| `audio.html` | Multi-reciter audio player |
| `radio.html` | Live Quran radio (HLS) |
| `azkar.html` | Morning/evening adhkar |
| `masbaha.html` | Digital tasbeeh counter |
| `hisn.html` | Hisn Al-Muslim |
| `duaa.html` | Supplications |
| `hadith.html` | Hadith (via alquran/sunnah API) |
| `qibla.html` | Qibla compass |
| `notifications.html` | Reminder settings |
| `howto.html`, `about.html` | Help / about |

**Config:** `manifest.json`, `sw.js` (cache `zad-muslim-v22`), `coi-serviceworker.js`
(enables `crossOriginIsolated` for the Tasmee ONNX model). Dev server: `server.py` /
`server.bat` (or `python -m http.server`).

---

## 2. Directory map

| Dir | Contents |
|---|---|
| `js/` | App logic modules (see §4) |
| `css/` | `style.css`, `_masbaha.css` |
| `data/` | **All databases + bundled JSON data:** `quranpages.sqlite` (ayah rects), `quran.json` (full text), `vocab.json`, `tafsir-*.db` ×4, hadith `*.json`, `adhan.js`, `cities.js` |
| `coords/` | Mushaf overlay coordinates: `medina2_coords.json` (used), `mushaf2_map.json`, `Madina-coord-2.json` |
| `mushaf/` | Page images per variant: `madina-1421/`, `madina-green/`, `mushaf-madina-1441/`, `tajweed/`, `mushaf-2/` |
| `assets/` | Bundled content: azkar/duaa/audio JSON, `azan.mp3`, `husn.pdf`, `part1-5.json`, `media/` |
| `fonts/` | Arabic fonts (Amiri, Tajawal, Uthmani, Scheherazade, `uthmani-colored.ttf` …) |
| `models/` | `fastconformer_ar_ctc_q8.onnx` — offline Tasmee model (gitignored, user-downloaded) |
| `icons/`, `img/`, `images/` | App icons, UI graphics, backgrounds |
| `scripts/` | Python tooling + mushaf image converters (`*.py`) |
| `server/` | `server.js` — optional Node server |
| `worker/` | Cloudflare workers: `push-worker.js`, `stream-worker.js`, `wrangler.toml` |
| `tests/` | Playwright specs + `tasmee-matcher.test.js` (Node) — gitignored |
| `docs/` | Design notes: `v4-3-plan.md`, `v4-2.md`, `v4.md`, `V2.md`, `fixes.md`, `offline tarteel.md` |
| `archive/` | Orphaned/superseded files kept for safety (old `json/` duaa/audio/radio, root `styles.css`) |
| `instance/`, `node_modules/`, `.wrangler/`, `.git/`, `.claude/` | tooling/VCS (gitignored) |

---

## 3. Mushaf variants (id ↔ images ↔ coords)

| Variant id | Images | Coords |
|---|---|---|
| `mushaf-colored` | `mushaf/madina-1421/` | SQLite `ayarects` (word-level) |
| `mushaf-madina1441` | `mushaf/mushaf-madina-1441/` | `coords/medina2_coords.json` (line segments) |
| `mushaf-tajweed` | `mushaf/tajweed/` | medina coords |
| `mushaf-borderd` | `mushaf/mushaf-2/` | medina coords |
| `mushaf-green` | `mushaf/madina-green/` | medina coords |

`getImagePath()` (in each `quran*.html`) + `js/quran-app.js` / `js/quran-common.js`
build image URLs from these dirs. DB is fetched from `data/quranpages.sqlite`.

---

## 4. JavaScript modules (`js/`)

| File | Role |
|---|---|
| `quran-common.js`, `quran-app.js` | Quran reader logic; `SURAH_MAP`/`JUZ_MAP` |
| `surah-map.js`, `juz-map.js`, `quranpages.data.js`, `medina2.data.js` | maps + inlined coords |
| `notifications.js`, `masbaha.js`, `radio-stations.js` | per-feature logic |
| `plugins/` | Capacitor shims (native packaging) |
| **Tasmee' Pro:** | |
| `tarteel-worker.js` | Web Worker: ONNX FastConformer → transcript + ayah match |
| `tasmee-matcher.js` | DOM-free word-alignment brain (`quran-V4-2.html`) — 20 Node tests |
| `tasmee-store.js` | IndexedDB: sessions / mistakes / revisions |
| `tasmee-engine.js` | Legacy word-by-word Tasmee (Web Speech) |

Design + status: `docs/v4-3-plan.md`.

---

## 5. Quran reader versions

Only two are shipped; the rest are kept for reference (per request).

| File | Status |
|---|---|
| `quran.html` | ✅ **Live** mushaf reader (linked from `index.html`, precached) |
| `quran-text.html` | ✅ **Live** text reader |
| `quran-V4-2.html` | 🧪 **Staging** — Tasmee' Pro (word-by-word, stats, revision, heatmap). Promote to `quran.html` when ready. |
| `quran-V4.html`, `quran-V3.html`, `quran-V2.html` | 🗄️ older iterations |
| `quran2.html`, `_quran.html` | 🗄️ early drafts |

All variants were updated to the new `data/` + `mushaf/` + `coords/` paths and verified loading.

---

## 6. Quick facts
- **No build step** — open `index.html` over HTTP (service worker needs HTTP).
- Tafsir and hadith text come from the **alquran.cloud API**; local `tafsir-*.db` and
  hadith `*.json` are kept in `data/` but currently unused by the app.
- Bump `CACHE_NAME` in `sw.js` to ship JS/asset changes.
- Gitignored: `*.onnx`, `node_modules/`, `.wrangler/`, `.claude/`, `instance/`,
  `test-results/`, `tests/`, `test-*.png`, `.env`.

---

## 7. What the restructure changed (branch `repo-restructure`)
- **`data/`** ← consolidated root `quranpages.sqlite` (the used copy) + all `tafsir-*.db` + hadith `*.json`. Removed the duplicate **`db/`** directory entirely.
- **`mushaf/`** ← merged `"mushaf pages"/<variant>` (dropped the space-in-path) + `mushaf-2`.
- **`coords/`** ← `medina2_coords.json` + `mushaf2_map.json` + `Madina-coord-2.json` (from the old `json/`).
- **`docs/`** ← all `v*.md` / `V2.md` / `fixes.md` / `offline tarteel.md` design notes.
- **`scripts/`** ← root `*.py` + the mushaf image converter scripts.
- **`archive/`** ← orphaned old `json/` content (duaa/audio/radio) + unused root `styles.css`.
- **Path references** updated in all 7 `quran*.html` readers + `js/quran-app.js` + `js/quran-common.js`; verified (all variants + 14 pages load, no 404s).
- **Deleted/untracked:** dev `test-*.png`, `opencode.json.bak`; `git rm --cached` the leaked `.wrangler/cache/wrangler-account.json`.
- Left at root intentionally: `poster.png` (manifest), `splash.png`, `server.py`/`server.bat`.
