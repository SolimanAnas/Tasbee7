# Zad Al-Muslim — Security & Performance Audit

Phase 3 of the November 2026 audit. Read-only and defensive: static review of the repository,
`npm audit`, and measurements against a local copy of the site. **No live system was probed** —
the deployed Cloudflare Workers, the Play listing and third-party APIs were not tested. No secret
is reproduced in this document.

Statements are verified unless marked **Assumption**.

---

## 1. Summary

| Severity | Count | Headline |
|---|---:|---|
| Critical | 0 | No exposed credentials, no authentication to break, no user data on a server beyond push subscriptions |
| High | 4 | Sacred text rendered as HTML from third-party APIs; 47.6 MB download on one page open; push dispatcher that will not scale; published site near the hosting size limit |
| Medium | 8 | No CSP and heavy inline code; unescaped API text in two more places; unpinned/unverified CDN scripts; cache staleness; storage exhaustion; page weight; accessibility; push abuse limits |
| Low | 9 | Housekeeping and hardening items |

**What the app does not have, so cannot get wrong:** user accounts, sessions, passwords, a content
database, Supabase or row-level security, payment data, analytics or advertising SDKs. The
security surface is the browser, three external content APIs and two small workers.

**Secret scan:** every tracked text file was searched for key and token patterns. Nothing was
found. `server/server.js` contains VAPID keys that are the well-known documentation placeholders
and is labelled "not deployed"; real keys are Wrangler secrets. `.env` and
`server/ADMIN_TOKEN.txt` are ignored by git.

---

## 2. High

### H-1 · Quran text is fetched from third parties and inserted as HTML

- **Where:** `pages/quran-text.html:1216-1262` (render), `:1180-1189` (formatting), `:1195-1213`
  (cache).
- **Evidence:** each page of the text mushaf is fetched from `api.quran.com` and
  `api.alquran.cloud`, concatenated into a string and assigned to `innerHTML`. The rendered HTML is
  then stored in `localStorage` (`quran_master_v49_<page>_<reciter>`) and re-inserted on later
  visits without re-validation.
- **Impact:** (1) *Integrity* — whatever those services return is what the reader sees as the
  Quran; an upstream error, edition change or compromise changes the displayed text, and the
  cached copy persists it. (2) *Script injection* — a response containing markup executes in the
  app's origin, with access to all local data and the service worker. Both require a fault or
  compromise at the provider; likelihood is low, consequence for this product is severe.
- **Remediation:** render from the bundled `data/quran.json` (verified, content audit section 1)
  with `textContent`; keep the APIs only for optional extras; clear the old `quran_master_*` keys.

### H-2 · The hadith page downloads 47.6 MB every time it opens

- **Where:** `pages/hadith.html:473-478`.
- **Evidence:** measured transfer on open: 47,663 KB in 28 requests; the page then reports
  "34,532 hadith loaded".
- **Impact:** on mobile data this is expensive and slow; on low-memory phones parsing ~50 MB of
  JSON can kill the tab. The service worker then stores all of it.
- **Remediation:** load a book only when it is opened; for cross-book search ship a compact
  prebuilt index (or search per selected book).

### H-3 · Push dispatcher reads every subscriber every minute

- **Where:** `server/cloudflare.js` — `dispatchDue()`, `listAllSubKeys()`, cron `* * * * *` in
  `server/wrangler.toml`.
- **Evidence:** each cron tick lists all keys, reads every record, and rewrites each record that
  had a due event.
- **Impact:** cost and latency grow linearly with installs. 1,000 subscribers means about 1.4
  million KV reads and 1,440 list operations a day. **Assumption:** on Cloudflare's free plan
  (commonly 100,000 reads, 1,000 lists and 1,000 writes per day — check the dashboard) the limits
  are passed at well under a hundred subscribers, after which notifications silently stop for the
  rest of the day.
- **Remediation:** index by time, not by user — e.g. a Durable Object alarm per subscriber, or
  minute-bucket keys (`due:<yyyy-mm-dd-hh-mm>` → list of subscriber ids) so a tick reads one key.
  Add a daily health check that alerts when dispatch fails.

### H-4 · Published site is at the hosting size limit

- **Where:** repository root (GitHub Pages publishes everything).
- **Evidence:** ~1.2 GB tracked; `quran/` (419 MB, duplicate images for an orphaned page),
  `promo/` (351 MB) and `screenshots/` (62 MB) are served publicly and used by no reachable page.
- **Impact:** GitHub Pages documents a 1 GB site limit and a soft bandwidth limit; deployments can
  start failing without a code change. Clones are slow (1.1 GB history).
- **Remediation:** move marketing assets to another repository or release; delete `quran/` with
  its orphaned page; untrack `tests/screenshots/*.png`.

---

## 3. Medium

### M-1 · No Content-Security-Policy; large inline-script surface

- **Evidence:** no page sets a CSP. About 13,000 lines of inline `<script>`, ~1,000 inline
  `on*=""` handlers, 306 `innerHTML` assignments.
- **Impact:** any injection becomes full script execution; nothing limits where scripts load from
  or where data is sent.
- **Remediation:** staged. First a `<meta>` CSP that restricts `script-src`/`connect-src` to the
  hosts actually used (still allowing inline), then remove inline handlers page by page as code is
  extracted, then drop `'unsafe-inline'`. GitHub Pages cannot send headers, so `frame-ancestors`
  is unavailable there — note it as a hosting limitation.

### M-2 · Unescaped external and user text in the image mushaf

- **Where:** `js/quran/search.js:124-131` (API result text and surah name), `:156` (the user's
  query echoed inside `<strong>`), `js/quran/tafsir.js:183-186` (API ayah text).
- **Impact:** the same class as H-1 with a smaller reach; the query echo is self-inflicted only.
- **Remediation:** build nodes with `textContent`, or pass every interpolated value through one
  shared escape helper. The newer pages (`js/hadith-book.js`, `js/thabat.js`) already do this.

### M-3 · CDN scripts without integrity

- **Where:** `pages/radio.html:26` (`hls.js@1.5.13`, pinned, no SRI), `js/tarteel-worker.js:8`
  (`onnxruntime-web@1.24.2` imported from jsDelivr), `pages/radio2.html:46` (`hls.js@latest`,
  orphaned page).
- **Impact:** a CDN-side change runs in the app's origin.
- **Remediation:** vendor `hls.js` like `sql.js`; pin and document the ONNX runtime (SRI is not
  available for `import`), or vendor it too (~10 MB, optional feature); delete `radio2.html`.

### M-4 · Service-worker cache can serve stale or broken content indefinitely

- **Where:** `sw.js` static-asset branch.
- **Evidence:** any same-origin 200 response is cached and then served cache-first with no
  revalidation until `CACHE_NAME` is bumped by hand. Data files (`azkar.json`, hadith books,
  tafsir) therefore never update between releases; a release that forgets the bump ships nothing.
  Opaque CDN responses are also cached (they count against quota at a padded size).
- **Remediation:** generate the precache list and version from file hashes in CI; use
  stale-while-revalidate for JSON data; stop caching opaque responses once CDNs are vendored.

### M-5 · `localStorage` used as a page cache

- **Where:** `pages/quran-text.html:1195` stores rendered HTML per page and per reciter.
- **Impact:** the ~5 MB origin quota fills after a few hundred pages; later writes (bookmarks,
  counters, settings — 86 keys share this store) can start failing. Not all writes are guarded.
- **Remediation:** disappears with H-1. Until then, cap the number of cached pages.

### M-6 · Page weight and main-thread work

| Screen | Transfer on open | Main cause |
|---|---:|---|
| `hadith.html` | 47.6 MB | H-2 |
| `video-maker.html` | 16.5 MB | all background previews eagerly loaded |
| `hadith-viewer.html?book=bukhari` | 10.5 MB | whole book in one JSON |
| `quran.html` | 9.1 MB | 5.4 MB base64 database + 1.3 MB data script + page image |
| `audio.html` | 2.0 MB | two track indexes |
| others | 0.3–1.4 MB | fonts and backgrounds |

Other measured or observed costs:

- **Precache: 321 files, 25.1 MB on first install**, of which ~3 MB is never used
  (`assets/husn.pdf`, `part1…5.json`, `assets/audio.json`, eight orphaned pages, seven unloaded
  scripts).
- **Fonts: 12 files, 3.0 MB**, all precached; a typical page uses two.
- **`js/quranpages.data.js`** embeds a SQLite file as base64: +33 % size and a synchronous
  `atob` loop on the main thread. The same database also exists as `db/quranpages.sqlite`.
- **186 `backdrop-filter` rules** — expensive compositing on low-end Android.
- **Hadith books are single 6–10 MB JSON files** parsed in one go.
- **Blob URLs and timers** are mostly cleaned up (11 create / 10 revoke; 23 `setInterval` / 32
  `clearInterval`); no systematic leak was found by reading. *Not profiled at runtime.*

Remediation is in the modernization plan (P2).

### M-7 · Accessibility (WCAG 2.2 AA) gaps

- Icon-only controls without accessible names on most toolbars (mushaf: 5 of 80 buttons labelled).
- Dozens of clickable `<div>`/`<span>` elements with no role, focus or key handling.
- Target size: many controls are 28–36 px (2.5.8 asks for 24 px minimum, 44 px is the platform
  guideline).
- `user-scalable=no` on `pages/azkar.html` (1.4.4 Resize Text).
- 36 `outline: none` rules against 8 `:focus-visible` rules — keyboard focus is often invisible.
- 13 screens without an `<h1>`, 12 without landmarks.
- Colour contrast was **not** measured; the light-theme notifications subtitle and several 10 px
  hint texts on glass are visibly weak.

### M-8 · Push API has no abuse limits

- **Where:** `server/cloudflare.js` `/subscribe`.
- **Evidence:** input is validated well (push-service allow-list, size caps, sanitised schedule,
  relative URLs only), but there is no rate limit and no proof that the caller owns the
  subscription. A record's key is the client-chosen `userId`; anyone who learns a user's id can
  overwrite that record. Ids are random and not exposed, so this is hard to exploit.
- **Impact:** storage flooding against the KV write quota; targeted loss of one user's
  notifications.
- **Remediation:** Cloudflare rate-limiting rule on `/subscribe`; key records by a hash of the
  push endpoint; compare the admin token in constant time.

---

## 4. Low

| # | Finding | Where | Remediation |
|---|---|---|---|
| L-1 | Dev-tool advisories: `npm audit` reports 7 (6 high) in the Vite toolchain; none is shipped | `package-lock.json` | `npm audit fix`; Dependabot is already configured |
| L-2 | Privacy page is out of date: says a 7-day schedule (it is 30), mentions Google Fonts (no longer used), omits the 45-day server retention | `pages/privacy.html` | Update text in all languages |
| L-3 | The uploaded prayer schedule lets the server infer approximate location (prayer times identify latitude/longitude to tens of kilometres) | `js/notifications.js:250` | State this in the privacy page; it is inherent to server-side scheduling |
| L-4 | 706 `http://` audio URLs in data files | `assets/part1.json`, `assets/hisn_complete.json` | Both files are unused — delete them |
| L-5 | 91 `console.*` calls in production, some logging URLs and notification titles | `sw.js`, pages | Gate behind the existing `debug` flag |
| L-6 | No error reporting of any kind | whole app | Optional, privacy-preserving: a local error log the user can choose to share |
| L-7 | Thabat PIN is a salted SHA-256 of four digits in `localStorage`; the code correctly describes it as "not encryption" | `js/thabat.js:690-697` | Fine for its stated purpose; say so in the UI |
| L-8 | `tests/screenshots/*.png` tracked although ignored | `.gitignore` | `git rm --cached` |
| L-9 | Release mechanics are manual: hand-edited precache list and a 6,000-character changelog comment on the version line | `sw.js:1` | Generate in CI; move the changelog to `CHANGELOG.md` |

---

## 5. What is already done well

- **Push worker input handling:** endpoint allow-list against open-relay abuse, schedule
  sanitising, relative-URL-only click targets, admin token on destructive routes, automatic expiry.
- **Stream proxy:** path allow-list, method restriction, strips client cookies and auth headers.
- **Data minimisation:** location rounded to two decimals before storage; prayer times and Qibla
  computed on the device; no analytics.
- **No runtime package dependencies.**
- **Newer modules escape all output** and avoid inline handlers where practical.
- **CI guards** catch broken precache entries and broken local references before they ship.
- **Offline audio** is served with correct byte ranges and never stores partial files.

---

## 6. Browser compatibility notes

- **Safari / iOS (Assumption — not tested):** installed PWAs get evicted storage after weeks of
  non-use unless persistence is granted; the app requests it only inside the download flows.
  Web Push needs iOS 16.4+ and an installed PWA. `backdrop-filter` needs the `-webkit-` prefix
  (present in most rules). Module workers and the ONNX runtime need recent versions.
- **Android TWA:** notifications work through Web Push; periodic background sync is unavailable,
  which the code already handles with a 30-day schedule.
- **Older Android WebViews:** optional chaining and `?.` are used throughout; anything below
  Chrome 80 will fail to parse. Acceptable, but undocumented.
