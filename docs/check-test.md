# Pre-Launch Repo Check — زاد المسلم (Zad Al-Muslim)

> Full health check run **2026-06-10** (second pass). Combines static analysis
> with a real-browser sweep of every page. Re-run anytime with the commands in
> [§7](#7-how-to-re-run).

**Verdict: ✅ Ready to share.** Working tree is clean since the last pass.
All static checks pass. One runtime bug (dashboard crash) was fixed in the first
pass and remains verified. This pass focused on i18n completeness — calc method
options, prayer names, and the date-picker aria-label have all been translated.

---

## 1. Git / tracking

| Check | Result |
|-------|--------|
| Branch | `main` |
| `js/i18n/names.js` tracked & in HEAD | ✅ (commit `bc3aa9c`) |
| Working tree | **✅ Clean** (no uncommitted files) |

Recent commits since last check:
- `c871a55` — Translate prayer widget & modal: `data-i18n-aria` for date picker,
  use `getPrayerName()` for dynamic prayer names
- `4c1442a` — Translate calc method options, fix azkar language icon & notch
  padding, clean up iOS detection

## 2. Service-worker precache (`sw.js`)

- **102 precache entries — 0 missing on disk.**
- `CACHE_NAME` bumped to **`zad-muslim-v36`** (was v35 in previous pass).

## 3. Local asset references (every `src`/`href` in HTML)

- **22 pages scanned, 0 real broken local references.**
- **1 false positive:** `pages/hadith.html` has `${link}` inside a JS template
  literal in a `<script>` tag — resolved dynamically at runtime, not a static
  HTML reference. Script: `scripts/audit-refs.cjs`.

## 4. i18n integrity

| Check | Result |
|-------|--------|
| Locale files parse | ✅ ar / en / tr / ckb / ur |
| Key parity | ✅ **612 keys each**, no missing/extra vs `en` |
| `js/i18n/names.js` coverage | ✅ 114 surahs · 206 reciters (0 id gaps) · 170 stations (all have EN/TR names) |
| `data-i18n-html` keys with `{placeholder}` (child-destruction risk) | ✅ 0 remaining (dashboard fix from §6 holding) |
| `manifest.json` | ✅ valid JSON, all icons exist |

**New translation keys added this pass:**
- `calc_method_uae`, `calc_method_mwl`, `calc_method_ummalqura`,
  `calc_method_egypt`, `calc_method_karachi` — prayer calculation methods
- `prayer_pick_date` — date picker button aria-label

**JS fix:** `prayerNamesAr[]` → `getPrayerName()` so Fajr/Dhuhr/Asr etc. use
`t('prayer_fajr')` etc. instead of hardcoded Arabic in the prayer chips and
modal list.

## 5. Runtime page sweep (real Chrome, fresh client per page)

Load each page with caches cleared and watch the console. **All clean** except the noted items:

| Page | Console | Notes |
|------|---------|-------|
| index.html | ✅ clean | first-run language prompt works |
| pages/quran.html | ✅ clean | page 313 + DB + mushaf image load |
| pages/quran-text.html | ✅ clean | |
| pages/audio.html | ⚪ 1×404 | `audio-02.json` probe — **by design** (loader stops at first missing file; harmless) |
| pages/radio.html | ✅ clean | 173 stations load |
| pages/takrar.html | ✅ clean | |
| pages/masbaha.html | ✅ clean | |
| pages/azkar.html | ✅ clean | translate icon now themed via CSS mask |
| pages/hisn.html | ✅ clean | |
| pages/duaa.html | ✅ clean | |
| pages/hadith.html | ⚪ favicon | only `/favicon.ico` 404 (browser auto-probe); all hadith JSON load 200 |
| pages/qibla.html | ✅ clean | |
| pages/notifications.html | ✅ clean | |
| pages/tasmee-dashboard.html | ✅ clean *(fix confirmed)* | was crashing — §6 |
| pages/tasmee-review.html | ✅ clean | |

**Benign / by-design (no action needed):**
- `audio-02.json` 404 — the audio reciter loader probes contiguous `audio-NN.json` files and stops at the first 404; only `audio-01.json` exists, so exactly one probe fails.
- `/favicon.ico` 404 — pages set the icon via `<link rel="icon">`/manifest; the root favicon probe is cosmetic.
- Country-flag emoji render as letter codes (SA/GB/TR/PK) **on Windows only**; real flags show on Android/iOS/macOS.
- Radio: streams use `<audio crossorigin="anonymous">`, so a station lacking CORS headers can fail to preload — external-source dependent, pre-existing.

## 6. Bug fix (first pass) — dashboard crash

**Symptom:** `pages/tasmee-dashboard.html` logged
`Tasmee dashboard init error: TypeError: Cannot set properties of null (setting 'textContent')`
whenever there were due revisions, and the "due to review" count showed a literal `{n}`
in non-Arabic languages.

**Root cause:** the count lived in `<span id="dueCount">` inside a
`<div data-i18n-html="tasmee_review_count">`. `I18n.applyTranslations()` overwrites that
div's `innerHTML` with the raw dictionary string (which contained an un-interpolated `{n}`),
which (a) destroyed `#dueCount` → `renderDueRevisions()` set `.textContent` on `null`, and
(b) displayed a literal `{n}`.

**Fix:**
- HTML: split into a number span + a label span — `<span id="dueCount">0</span> <span data-i18n="tasmee_review_count">…</span>`.
- JS (`tasmee-dashboard.js`): set only the number on `#dueCount` (null-guarded); the label is localized by `applyTranslations()` (correct timing, no render/i18n race).
- Locales: repurposed `tasmee_review_count` from `"{n} ayahs to review"` → `"ayahs to review"` (label only) in all 5 files.

**Verified:** dashboard loads with no console error; "due to review" shows `1 آية للمراجعة` (ar) and `1 ayahs to review` (en), with the styled number preserved.

## 7. Changes made this pass (second pass)

### 7a. Translate icon in azkar.html
Replaced the 🌐 emoji with a **CSS mask** using `img/translate.svg` so the icon
adapts to theme colours via `currentColor` (same pattern as `index.html`).

### 7b. Notch-safe padding for iPhone
Replaced `env(safe-area-inset-top)` + JS-based `body.is-ios` detection with a
pure CSS `@supports (-webkit-touch-callout: none) and (padding-top: env(safe-area-inset-top))`
rule in **azkar.html**, **duaa.html**, and **hisn.html** — sets 30px top padding
on notched iPhones only, Android unaffected.

### 7c. Calendar method translation
Added `data-i18n` attributes to all 5 `<option>` elements in the calc method
`<select>` and translation keys in all 5 locale files.

### 7d. Prayer widget & modal i18n
- Added `data-i18n="prayer_calculating"` to `prayerNextBanner`
- Added `data-i18n-aria="prayer_pick_date"` to the date picker button
- Changed `prayerNamesAr[k]` → `getPrayerName(k)` in the JS so prayer names
  (Fajr, Dhuhr, Asr, etc.) use `t()` translations in the home chips and modal list

## 8. How to re-run

```bash
# static checks
node scripts/audit-refs.cjs                       # broken local refs
node scripts/check-i18n-html.js                    # data-i18n-html placeholder risk

# runtime: serve the repo and open each page with DevTools console open
python -m http.server 8753
#   then visit http://localhost:8753/index.html and the pages/ list,
#   clearing SW + caches first (Application → Service Workers → Unregister).
```

> Tip: the service worker aggressively caches `js/i18n/*.js`. When testing locale
> edits locally, unregister the SW + clear caches (or bump `CACHE_NAME`), otherwise
> you'll see stale strings (e.g. an old `{n}` label) that don't reflect the files.
