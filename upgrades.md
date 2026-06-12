# Tasbee7 — Upgrade Roadmap

A full-repo review (frontend, PWA/performance, security, server, tooling, repo hygiene),
compiled 2026-06-12. Items are grouped by priority; each has the evidence behind it and a
concrete action. Numbers were measured from the working tree, not estimated.

**Already done:**
- **Notification system** (commit `b801db7`): RFC 8291/8188 compliance, VAPID validation, push blackout bug fix, server auth. **Remaining manual step:** `cd server && wrangler deploy` and `wrangler secret put ADMIN_TOKEN`.
- **P0 batch** (commits `9132ac4`, `3637c6d`): image optimization (26.6 MB → 4.3 MB), dead-file cleanup, legacy archival, sitemap corrections, server banner, version metadata.
- **P1-1** (commit `a117da9`): audio precache diet (63.8 MB → 21.3 MB).
- **P2-1** (commit `aae8ec0`): deleted 4 duplicate/legacy pages (azkar2, quran2, masbaha2, quran-old).
- **P5-1** (commit `a50c627`): CI safety net — typecheck, build, precache + reference guards, Dependabot.
- **P1-2** (commit `4693119`): WebP conversion of 18 browser-rendered images (~2.9 MB lighter).

---

## P0 — Quick wins (under an hour each)

### 1. Fix the sitemap (6 pages missing)
`sitemap.xml` lists 17 URLs but `pages/` has 23. Missing: `azkar2`, `quran2`, `radio`,
`salah`, `sleeping`, `takrar`. Either add them or (better) resolve the duplicate-page
question first (see P2-1), then regenerate.

### 2. Stop committing test artifacts
`test-results.json` (written by `test_all.js`) is committed and re-dirtied on every run.
Add to `.gitignore` and `git rm --cached test-results.json`.

### 3. Delete dead-weight images (~7.9 MB)
- `icons/icon-full.png` — 2.1 MB, referenced nowhere
- `images/Featured.png` — 9.0 MB and `images/featured image.png` — 3.9 MB (marketing
  assets; move out of the deployed site if needed for the Play Store listing)
- `icons/icon_1024.png` — 1.7 MB; platforms use 192/512, the 1024 entry adds little

### 4. Quarantine legacy root files
`fix_tasmee.py` (hardcoded `G:/Github Repos/...` path), `server.py`, `server.bat` are
one-offs superseded by Vite + the Cloudflare worker. Move to `scripts/legacy/` or delete.

### 5. Label the reference server
`server/server.js` carries hardcoded placeholder VAPID keys (the well-known web-push
example key). It's documented as unused in `DEPLOY.md`, but add a banner comment at the
top of the file itself: *reference only, not deployed, keys are placeholders*. While
there: drop `node-fetch` (Node ≥18 has native fetch) and add `"engines": {"node": ">=18"}`.

---

## P1 — Performance (the biggest user-facing wins)

### 1. Shrink the service-worker precache — 72.8 MB today
**✅ P1-1 DONE (commit `a117da9`):** Moved `azan.mp3` (4.5 MB), `Azkar-morning.mp3` (19 MB),
and `Azkar-night.mp3` (20 MB) to runtime cache. Service Worker's audio fetch handler
(lines 343–363 in sw.js) detects `.mp3` requests and caches to `AUDIO_CACHE` on first play.
**Result:** precache reduced from 63.8 MB → 21.3 MB (68% lighter, first-install 43.5 MB smaller).

Remaining opportunities (to be prioritized):

| Asset | Size | Recommendation | Status |
|---|---|---|---|
| `js/quranpages.data.js` | 5.4 MB | Lazy-load only on Quran pages; consider splitting per-juz | P1-3 |
| 7 hadith thumbnail PNGs (`assets/thumbnails/others/`) | ~8.5 MB | Convert to WebP at sane dimensions (likely >90% smaller) | P1-2 |
| `data/quran.json` | 3.0 MB | Precache only if offline tasmee is a first-run promise; otherwise cache on first Quran open | P1-3 |
| `assets/husn.pdf` | 2.2 MB | Fetch on demand from hisn page | P1-3 |

### 2. Image modernization
**✅ P1-2 DONE (commit `4693119`):** Converted 18 browser-rendered images to WebP via
`scripts/to-webp.cjs` (sharp, q85), saving **~2.9 MB** (the roadmap's 15–20 MB estimate
predated P0, which had already resized/recompressed everything from 26.6 MB to 4.3 MB):
- 3 backgrounds (every page): 945 KB → 128 KB (86%)
- 13 hadith thumbnails: ~2.5 MB → ~0.9 MB
- `poster.png` manifest screenshot: 386 KB → 59 KB; `Featured.png` README hero: 468 KB → 176 KB

Kept PNG by design: `og-image.png` (social scrapers' WebP support is unreliable) and
`icons/*` (PWA manifest / iOS). WebP-only, no fallback — safe given the PWA already
requires SW/web-push/ONNX-era browsers. Also removed dead `BulughAlMaram.jpg`.

### 3. Font strategy — 3.0 MB across 12 files
All Quran-script fonts ship even though only one mushaf font is active at a time.
- Subset the UI font (Tajawal) to Arabic + Latin ranges.
- Load mushaf fonts (`me_quran`, `Amiri`, `almushaf`, `qortoba`, …) on demand when the
  user selects that script, not via precache.
- Use `font-display: swap` consistently (404.html has it; main pages don't).

### 4. Audio cache eviction
`audio-cache-v1` in `sw.js` grows forever (Quran recitations from mp3quran/archive.org are
cached on every play). Add an LRU cap (e.g. 500 MB, evict oldest) or surface a
"manage downloads" UI — `js/quran/audio-cache.js` already exists as the natural home.

### 5. Styled offline fallback
The SW returns plain-text `"Offline"` (503) for uncached navigations. Precache a small
`offline.html` (you already have a well-styled `404.html` to clone) and serve it for
failed HTML requests.

---

## P2 — Architecture & code health

### 1. Resolve the duplicate-page situation (~500 KB + maintenance tax)
**✅ P2-1 DONE (commit `aae8ec0`):** Deleted four dead pages — `quran-old.html`, `quran2.html`,
`azkar2.html`, `masbaha2.html` — which had no UI linkage, were not in sitemap, and existed
only as cosmetic variants. Updated `sw.js` STATIC_ASSETS and `test_all.js` page lists.
No functionality loss: all variants were CSS-only (color themes / metadata), with no incoming
navigation links from the app UI.

### 2. Extract inline CSS/JS from pages
`azkar.html` is ~87% inline code (950 lines CSS + 670 lines JS); `masbaha.html` ~94%;
`hadith.html`, `radio.html`, `takrar.html` similar. Consequences: nothing is minified
(Vite can't tree-shake inline code), nothing is cached across pages, and every shared
fix must be repeated. Target structure: `css/pages/<page>.css` + `js/pages/<page>.js`.

### 3. Centralize the thrice-duplicated utilities
- **Theme switching** is reimplemented in **10+ files** (`azkar.html:1443`,
  `hadith.html:387`, `radio.html:897`, `takrar.html:789`, `index.html:1373`, …) with
  subtly different theme lists. One `js/theme-manager.js` ends an entire bug class
  (e.g. the `masbaha.html` unescaped-quote incident in commit `d5cbde6` happened inside
  duplicated inline theme/toast code).
- **Prayer-time calculation** exists twice: `index.html:1025–1138` and
  `js/notifications.js` both wrap `adhan.PrayerTimes` with their own method/coords
  handling. Extract `js/prayer-service.js`; have both consume it. This also guarantees
  the home-screen times and the notification times can never disagree.
- **Toast/snackbar** — one implementation, used everywhere.

### 4. Make the TypeScript story honest
`js/tasmee-{engine,matcher,store}.ts` + hand-transpiled `.js` twins are both committed;
`tsconfig.json` has `noEmit: true`, `strict: false`, `checkJs: false`, and nothing runs
`tsc` in CI — so the types check nothing. Either:
- **(a)** wire the transpile into the Vite build and stop committing the `.js` twins, or
- **(b)** drop the `.ts` files and own the `.js`.

If keeping TS: enable `strict` incrementally and add `tsc --noEmit` to CI (see P5).

### 5. Error-handling pass
`pages/quran.html` has effectively zero try/catch around fetch/audio; geolocation and
permission failures mostly log to console with no user feedback. Wrap the critical paths
(tafsir/audio fetch, geolocation, notification permission) and surface a toast on failure.

### 6. Trim console noise
`js/notifications.js` alone has ~58 emoji-prefixed `console.*` calls. Gate verbose
logging behind a `localStorage.debug` flag.

---

## P3 — Security & privacy

### 1. Add a Content-Security-Policy
No CSP on any page. With ~47 inline `onclick=` handlers and large inline scripts, start
pragmatic: `default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'
https://api.alquran.cloud https://*.mp3quran.net https://archive.org
https://zad-push-server.solimananas2012.workers.dev; img-src 'self' data:`, then tighten
as P2-2 (inline extraction) lands. Long-term goal: drop `'unsafe-inline'` by moving
handlers to `addEventListener`.

### 2. Location data hygiene
`prayer_lat`/`prayer_lng`/`current_location_name` live in localStorage indefinitely.
Acceptable for the use case, but: round coordinates to ~2 decimals (≈1 km — plenty for
prayer times, much less precise as a fingerprint), and mention it in a short privacy note.

### 3. External link/window hardening
Links opened to Play Store/GitHub via JS should use `rel="noopener noreferrer"` /
`window.open(url, '_blank', 'noopener')`.

### 4. Subresource Integrity
Google Fonts CSS is the main third-party fetch; consider self-hosting Tajawal (you
already ship it in `fonts/`) and dropping the Google Fonts request entirely — faster,
more private, fully offline.

---

## P4 — PWA & feature upgrades

1. **Manifest polish:** add more screenshots (only one `poster.png` today; add a wide
   form-factor one), per-shortcut icons (all 4 shortcuts reuse the 192 icon), and
   `categories` review. Consider a `share_target` if you want "share verse to app".
2. **Periodic background sync** (`periodicsync`) to refresh the 7-day push schedule even
   when the app isn't opened — closes the "user doesn't open app for 8 days, pushes stop"
   gap in the notification design.
3. **Notification actions deep-links:** SW already supports `DEEP_LINKS`; add actions like
   "اقرأ الأذكار" directly on azkar notifications.
4. **`coi-serviceworker.js` scoping:** it exists for SharedArrayBuffer (ONNX tasmee). Verify
   it's only registered on tasmee pages, and document the interplay with `sw.js` in the
   README — two SWs with overlapping scope is a classic source of mystery bugs.
5. **i18n completeness check:** add the key-parity test the README promises (see P5-2) so
   the 5 locales can't drift (the `notif_blocked` key addition showed tr/ur files are
   offset ~30 lines from ar/en/ckb — drift has already started).

---

## P5 — Tooling, CI, repo hygiene

### 1. CI upgrades (`.github/workflows/`)
**✅ P5-1 DONE (commit `a50c627`):** Added `.github/workflows/ci.yml` running on push/PR to main:
- `vite build` (build verification — a broken build can no longer ship)
- `tsc --noEmit` (fixed 8 pre-existing type errors so this gate is green)
- `scripts/verify-precache.cjs` — every `sw.js` STATIC_ASSETS entry must resolve to a real
  file (catches "deleted page still precached" regressions)
- `scripts/audit-refs.cjs` — every local `src`/`href` in HTML must resolve (now exits non-zero)
- `.github/dependabot.yml` — weekly npm (root + server) and github-actions bumps

Remaining for a later pass:
- **ESLint** (no linter exists; even `eslint:recommended` will catch real bugs in 20k+ lines
  of vanilla JS)
- `.gitignore` lists `tests/` — existing specs are tracked, but **new** test files won't be
  picked up until that rule is narrowed (it's meant to ignore `test-results/`).

### 2. Test gaps
- i18n key-parity test across `js/i18n/{ar,en,tr,ckb,ur}.js`
- A notification-system unit test (the RFC 8291 round-trip test written during the push
  fix lives only in `/tmp` — bring it into `tests/` so the worker crypto can't regress)
- Basic axe-core accessibility sweep on the main pages
- Retire `test_all.js` (superseded by `tests/pages.spec.js`)

### 3. Repo size — 894 MB of git history
`.git` alone is 894 MB (mushaf page scans: `mushaf pages/` 421 MB + `mushaf-2/` 177 MB in
the working tree, plus their history). Options, least → most invasive:
- Git LFS for `mushaf*/`, mp3s, and large PNGs (new clones get pointers)
- Host the mushaf scans as a release asset / external bucket and fetch on demand
- History rewrite (`git filter-repo`) only if clone time actually hurts you

### 4. Version & metadata
Root `package.json` has no `version` field; sitemap `lastmod` dates and `README`
structure should be regenerated when the duplicate pages are resolved.

---

## Suggested order of attack

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | ✅ P0 batch (sitemap, gitignore, dead images, legacy files) | ½ day | hygiene + 8 MB |
| 2 | ✅ Precache diet (P1-1) | 1 day | first-install 64 MB → 21 MB |
| 3 | ✅ Duplicate pages decision (P2-1) | ½ day | −500 KB, simpler everything |
| 4 | ✅ CI: build + tsc + guards + dependabot (P5-1) | ½ day | regression safety net |
| 5 | ✅ Image/WebP pass (P1-2) — font subsetting (P1-3) still open | 1 day | −2.9 MB done; fonts next |
| 6 | Theme/prayer/toast centralization (P2-3) | 2–3 days | kills a recurring bug class |
| 7 | Inline CSS/JS extraction (P2-2) | 3–5 days | caching, minification, CSP path |
| 8 | CSP + handler migration (P3-1) | 2 days | XSS hardening |
| 9 | Periodic sync + manifest polish (P4) | 1–2 days | product polish |

Items 1–4 are done — the safety net now exists, so items 6–8 (which move code around) can
proceed with CI catching regressions. Item 5 (image/WebP) is the next high-leverage win.
