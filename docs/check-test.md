# Pre-Launch Repo Check — زاد المسلم (Zad Al-Muslim)

> Full health check run **2026-06-10** before sharing the live link
> `https://solimananas.github.io/Tasbee7/`. Combines static analysis with a
> real-browser sweep of every page. Re-run anytime with the commands in
> [§7](#7-how-to-re-run).

**Verdict: ✅ Ready to share.** One real runtime bug was found and fixed during
this pass (dashboard crash, see §6). Everything else is clean; remaining items
are cosmetic/by-design and listed in §5.

---

## 1. Git / tracking

| Check | Result |
|-------|--------|
| Branch | `main` |
| `js/i18n/names.js` tracked & in HEAD | ✅ (commit `bc3aa9c`) |
| Working tree | Clean except two uncommitted icon files: `img/translate.svg` (M), `img/translate.png` (??) |

⚠️ **Action:** commit (or discard) `img/translate.svg` / `img/translate.png` before sharing
so the deploy is reproducible. Use `git add -A` (not `git commit -a`) so new files aren't skipped
— that's exactly how `names.js` was nearly left out earlier.

## 2. Service-worker precache (`sw.js`)

- **102 precache entries — 0 missing on disk.** A missing entry makes SW
  install reject (no offline + console errors), so this matters for launch.
- `CACHE_NAME` bumped to **`zad-muslim-v35`** so this pass's fixes ship.

## 3. Local asset references (every `src`/`href` in HTML)

- **22 pages scanned, 0 broken local references.** (Internal page-to-page
  links are included in this check.)
- Script: `scripts/audit-refs.cjs`.

## 4. i18n integrity

| Check | Result |
|-------|--------|
| Locale files parse | ✅ ar / en / tr / ckb / ur |
| Key parity | ✅ **625 keys each**, no missing/extra vs `en` |
| `js/i18n/names.js` coverage | ✅ 114 surahs · 206 reciters (0 missing ids) · 173 stations (0 missing names; 170 unique keys) |
| `data-i18n-html` keys with `{placeholder}` (child-destruction risk) | ✅ 0 remaining (the one offender was fixed — §6) |
| `manifest.json` | ✅ valid JSON, all icons exist |

## 5. Runtime page sweep (real Chrome, fresh client per page)

Loaded each page with caches cleared and watched the console. **All clean** except the noted items:

| Page | Console | Notes |
|------|---------|-------|
| index.html | ✅ clean | first-run language prompt works |
| pages/quran.html | ✅ clean | page 313 + DB + mushaf image load |
| pages/quran-text.html | ✅ clean | |
| pages/audio.html | ⚪ 1×404 | `audio-02.json` probe — **by design** (loader stops at first missing file; harmless) |
| pages/radio.html | ✅ clean | 173 stations load |
| pages/takrar.html | ✅ clean | |
| pages/masbaha.html | ✅ clean | |
| pages/azkar.html | ✅ clean | |
| pages/hisn.html | ✅ clean | |
| pages/duaa.html | ✅ clean | |
| pages/hadith.html | ⚪ favicon | only `/favicon.ico` 404 (browser auto-probe); all hadith JSON load 200 |
| pages/qibla.html | ✅ clean | |
| pages/notifications.html | ✅ clean | |
| pages/tasmee-dashboard.html | ✅ clean *(after fix)* | was crashing — §6 |
| pages/tasmee-review.html | ✅ clean | |

**Benign / by-design (no action needed):**
- `audio-02.json` 404 — the audio reciter loader probes contiguous `audio-NN.json` files and stops at the first 404; only `audio-01.json` exists, so exactly one probe fails.
- `/favicon.ico` 404 — pages set the icon via `<link rel="icon">`/manifest; the root favicon probe is cosmetic.
- Country-flag emoji render as letter codes (SA/GB/TR/PK) **on Windows only**; real flags show on Android/iOS/macOS.
- Radio: streams use `<audio crossorigin="anonymous">`, so a station lacking CORS headers can fail to preload — external-source dependent, pre-existing.

## 6. Bug found & fixed this pass — dashboard crash

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

## 7. How to re-run

```bash
# static checks
node scripts/audit-refs.cjs                       # broken local refs
node -e "..."                                      # (see git history for the SW/i18n/manifest one-liners)

# runtime: serve the repo and open each page with DevTools console open
python -m http.server 8753
#   then visit http://localhost:8753/index.html and the pages/ list,
#   clearing SW + caches first (Application → Service Workers → Unregister).
```

> Tip: the service worker aggressively caches `js/i18n/*.js`. When testing locale
> edits locally, unregister the SW + clear caches (or bump `CACHE_NAME`), otherwise
> you'll see stale strings (e.g. an old `{n}` label) that don't reflect the files.
