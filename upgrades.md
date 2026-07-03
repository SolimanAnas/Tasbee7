# Zad Al-Muslim (Tasbee7) — Comprehensive Audit & Upgrade Roadmap

Full-repository audit compiled **2026-06-15**, covering architecture, UI/UX, performance,
PWA, Android/TWA wrapper, accessibility, security, SEO, i18n, and the Islamic-app feature
set benchmarked against 2026 market leaders. All numbers were measured from the working
tree, with `file:line` evidence throughout.

> This document supersedes the 2026-06-12 roadmap. That roadmap's completed work
> (notification RFC-8291 overhaul, image/audio precache diets, CI guards, ESLint,
> theme-manager/prayer-service/toast consolidation modules, i18n parity guard) is real and
> verified — see git history for the old file. **One correction to the old log:** it claims
> "P3: CSP meta on all 21 pages", but CSP was later **reverted** in commit `7b5947f` ("remove
> CSP that broke i18n and the AI tasmee worker"). Zero pages have a CSP today.

Legend: each recommendation carries **[Difficulty / Impact]** — Difficulty: Easy (<1 day),
Medium (1–5 days), Hard (>1 week); Impact: Low / Medium / High.

---

# Executive Summary

| Dimension | Score | One-line justification |
|---|---|---|
| **Overall health** | **6 / 10** | A genuinely feature-rich, offline-capable app with strong shared modules and CI — undermined by adoption debt, a data-destroying SW bug, and Play-compliance gaps |
| Maintainability | 4 / 10 | ~35–45% of hand-written frontend code is per-page duplication; ~6,860 lines of inline JS are unlinted/untypechecked; 454 inline `onclick=` handlers |
| UX | 6 / 10 | Individual pages are polished, but 3+ incompatible theme systems, crowded non-wrapping headers at 320px, and inconsistent navigation break cross-app coherence |
| Performance | 5 / 10 | quran.html blocks first paint on 6.8 MB of synchronous `<head>` scripts; hadith.html eagerly downloads and parses ~65 MB of JSON on load; zero `defer` anywhere |
| Accessibility | 3 / 10 | Zoom blocked app-wide (`user-scalable=no`), core interactions (tasbih counter, tasmee mic) silent to screen readers, dozens of div-onclick controls, sub-44px targets everywhere |
| PWA | 6 / 10 | 252-entry verified precache + CI guards are excellent — but every SW version bump silently deletes users' downloaded mushaf images (up to ~450 MB), and there is no offline navigation fallback |
| Android readiness | 5 / 10 | System back button closes pages instead of open sheets on ~19 pages; exit flow can strand users on `about:blank`; status-bar color flickers across 11 pages missing `theme-color` |
| Google Play readiness | 4 / 10 | **No privacy policy** despite uploading location-derived schedules to a workers.dev server — a hard Play blocker; assetlinks.json unverifiable from this repo |
| Future scalability | 5 / 10 | 1.8 GB working tree / 911 MB `.git` presses against GitHub Pages limits; the good news: the shared-module architecture to scale onto already exists |

**The three sentences that matter:** The codebase is two-layered — a thoughtful,
CI-guarded shared layer (`js/`, `scripts/`, workflows) sitting under ~13,000 lines of
copy-pasted per-page inline HTML/CSS/JS that predates it, so most architecture work is
*adoption* debt, not design debt. The single most urgent fix is one line in `sw.js` that
currently wipes users' offline Quran downloads on every deploy. The single biggest
compliance risk is the missing privacy policy for an app that sends location-derived data
off-device.

---

# Critical Issues

Fix these before the next release.

### C1. Service worker deletes user-downloaded mushaf images on every version bump — [Easy / High]
`sw.js:337-348` whitelists `zad-muslim-v57`, `audio-cache-v1`, `push-ctx-v1`, and prefixes
`quran-offline*` / `quran-pages*` on activate — but the actual download features write to
**`quran-mushaf-images-v1`** (`js/quran/download.js:28`, the 65–120 MB per-variant offline
download), **`quran-mushaf-v1`** (`js/quran-common.js:626`), and **`tarteel-model-v1`**
(`js/quran/ui-extras.js:222`). None match the whitelist. The SW version bumps frequently
(v53→v57 in weeks), so **every deploy silently wipes up to ~450 MB of user downloads** and
the tasmee AI model. Users on metered connections re-download everything after each update;
the flagship offline feature is self-destructing. Fix: add the missing cache names/prefixes
to the whitelist (or unify all mushaf caching onto the already-whitelisted `quran-pages-*`).

### C2. No privacy policy — Google Play compliance blocker — [Easy / High]
No `privacy.html` or policy link exists anywhere (`grep -ri privacy` finds only planning
docs). Meanwhile `js/notifications.js:214-243` uploads the push subscription **plus a 7-day
prayer schedule computed from the user's coordinates** to
`zad-push-server.solimananas2012.workers.dev` (`js/notifications.js:26`), and
`index.html:1334-1335` stores coords (rounded ~1 km — good). Play requires a hosted privacy
policy URL and a matching Data Safety declaration ("Approximate location, collected, app
functionality"). Publish a bilingual privacy page, link it from `pages/about.html` and the
settings sheet, and update the Play Console form.

### C3. TWA back button closes the page instead of open sheets/modals — [Easy–Medium / High]
`history.pushState`/`popstate` handling exists in exactly two places: `index.html:1510-1520`
and `js/quran/init.js:147-167`. Every other page (audio, azkar, masbaha, radio, hadith,
takrar, notifications…) opens bottom sheets and modals with **no history integration** — in
the Play TWA, pressing the system back button with a sheet open navigates away entirely.
Extract the small popstate pattern from `js/quran/init.js` into a shared module and include
it on all pages.

### C4. Exit flow strands TWA users on a blank white screen — [Easy / High]
`index.html:1494-1508` (`confirmExit`) falls through Capacitor (absent) → Cordova (absent) →
`window.close()` (ignored) → **`window.location.assign('about:blank')`**, leaving a blank
page inside the branded Android app. The history sentinel at `index.html:1511` also blocks
the natural TWA exit. On confirm, unwind history (`history.back()` past the sentinel) so
Android finishes the activity; delete the `about:blank` fallback.

### C5. Stored XSS via YouTube titles rendered with innerHTML — [Easy / Medium-High]
`pages/video.html:564-570` (`renderHistory`) and `:535-541` (playlist sheet) interpolate
`item.title`/`item.channel` from `player.getVideoData()` unescaped into `innerHTML`, and the
strings persist in `localStorage.vidHistory` — **any video uploader controls this string**,
and it re-executes on every page open (inside the Play TWA too). Escape it or use
`textContent`. Related: remote-API text hits `innerHTML` across Quran features
(`pages/quran-text.html:1031,1041,1166`, `js/quran/search.js:140-171`) — see Security.

### C6. Broken "streak" stat shipping on the home screen — [Easy / Medium]
`index.html:1455` reads `streakDays`, but **nothing anywhere writes it** — the streak card
is permanently "0" for every user. Either implement it (any of the existing daily counters
`masbaha_today` / `azkar_today` / `khatma_today` > 0 ⇒ increment on a new day, reset on a
gap) or remove the card. A visibly dead feature on the first screen erodes perceived quality.

### C7. Garbled meta description on the flagship page — [Easy / High for SEO]
`pages/quran.html:8-9,14` contains corrupted Arabic — `"المصحف الم.dkwnي"` repeated (a
broken find-replace of "المدني"). This text renders verbatim in Google results and every
social share of the Quran reader. Two-minute fix.

---

# High Impact Improvements

### H1. Finish the consolidation you already started — [Easy–Medium / High]
`js/theme-manager.js` and `js/toast.js` were written expressly to kill per-page copies, yet
ThemeManager is adopted by only 3 of 21 pages (hadith, hadith-viewer, takrar) and
**toast.js is included by zero pages** while 9 inline `showToast` copies live on
(`audio.html:501`, `hadith-viewer.html:467`, `hadith.html:596`, `masbaha.html:817`,
`radio.html:919`, `takrar.html:799`, `video.html:296`, `js/masbaha.js:265`,
`js/quran/tasmee-review.js:98`). Both dead modules are precached onto every user's device.
This is the highest-ROI work in the repo: wire them in, delete the copies.

### H2. Unify the three incompatible theme systems — [Medium / High]
The user's theme choice does not follow them across the app:
- Canonical: `themeMode` via ThemeManager (hadith, hadith-viewer, takrar)
- Legacy key `theme`: `pages/hisn.html:767`, `pages/duaa.html:830`, tasmee pages
  (`js/tasmee-dashboard.js:315-320`), `pages/radio.html:901`, `pages/audio.html:587`
- Legacy key `appThemeIdx` with a different cycle order: `pages/video.html:289-293`
- No theme at all (hard dark): `pages/masbaha.html`, `pages/qibla.html`
- azkar uses value `"warm"` instead of `sepia` and has no sepia CSS block (`azkar.html:48-78`)
- Sepia missing entirely from audio.html and radio.html CSS — selecting sepia silently falls
  back to light/dark.
Adopt ThemeManager everywhere; add the missing `[data-theme="sepia"]` blocks; sync
`theme-color` meta on theme change (only azkar/hadith do this today).

### H3. Make quran.html stop blocking first paint on 6.8 MB of JS — [Medium / High]
`pages/quran.html:27-29` loads CDN sql-wasm + `js/quranpages.data.js` (5.5 MB base64) +
`js/medina2.data.js` (1.3 MB) as synchronous `<head>` scripts, then `js/quran/state.js:40-41`
runs `atob()` on the 5.5 MB blob on the main thread. First paint is blocked for seconds on
mid-range phones. `db/quranpages.sqlite` already exists as a 4.1 MB binary (25% smaller than
the base64) — fetch it lazily as an arrayBuffer and `defer` the rest.

### H4. Stop hadith.html from eagerly loading ~65 MB — [Medium–Hard / High]
`pages/hadith.html:426-475` fetches **all 15 hadith books** (bukhari 9.6 MB, muslim 8.5 MB…)
via `Promise.all` in `window.onload`, `res.json()`-parses each on the main thread, then
loops every hadith building a normalized index. Multi-second jank and OOM risk on low-end
Android; enormous first-visit data cost. Load per-book on first search, parse in a Web
Worker, or precompute a normalized index file.

### H5. Fix i18n coverage cliffs — three pages are Arabic-only inside a 5-language app — [Medium / High]
`pages/hadith-viewer.html` (~60+ visible strings, **0 keyed, i18n.js not loaded**),
`pages/video.html` (0 keys, no i18n.js), `pages/tasmee-review.html` (0 keys, no i18n.js),
and `pages/quran-text.html` (~100 hardcoded strings, no i18n.js). A Turkish or Urdu user
gets a mixed-language app on its main reading surfaces. Also fix the `data-i18n` on modal
headers that contain close buttons (`hisn.html:465,475,527`, `duaa.html:511,521,575`) —
`applyTranslations` sets `textContent`, which **deletes the close button** when a
translation applies.

### H6. Backup / restore of user data — [Easy / High]
All bookmarks, stats, favorites, and settings live in localStorage and die with the WebView
profile (uninstall, "clear data", or device change). The only data tool today is
`resetData()` = `localStorage.clear()` (`index.html:1431`). Add Export/Import JSON buttons
in the settings sheet — `pages/hadith.html:566` already demonstrates the Blob-download
pattern. This is also the cheap on-ramp toward future cloud sync.

### H7. Notification permission: ask on a user gesture, not on page load — [Easy / High]
`js/notifications.js:327-329` (auto-`init()` at `:773-777`) requests permission with no user
gesture. Chrome auto-suppresses these and one dismissal embargoes the origin — this alone
likely keeps many users' adhan notifications dead. Gate behind an explainer + button in
`pages/notifications.html` / first-run.

### H8. Repository mass: 1.8 GB tree, 911 MB `.git` — [Hard / High]
600 MB of mushaf images (`mushaf pages/` — note the space in the name — and `mushaf-2/`),
62 MB of SQLite DBs, and 5.7 MB+1.35 MB data blobs are versioned in git and near GitHub
Pages' limits (1 GB soft site limit, 100 GB/month soft bandwidth — 604-image downloads per
user eat this fast). Move images to LFS or an external CDN/release assets; keep the repo
clone-able. Also rename `mushaf pages/` → `mushaf-pages/` (URL-encoding landmines,
cache-key mismatch bugs; refs at `js/quran/settings.js:142-146`, `js/quran-common.js:634`).

---

# Medium Improvements

### M1. Offline navigation fallback + query-string cache misses — [Easy / Medium]
`sw.js:388-411`: an uncached HTML navigation offline resolves `respondWith(undefined)` → the
browser error page; the polished `404.html` is precached but never used as fallback. Also
`cache.match(req)` uses default `ignoreSearch:false`, so notification deep links like
`pages/azkar.html?type=morning` (`sw.js:306`, `js/schedule-builder.js:79-81`) miss the cache
offline. Retry with `{ignoreSearch:true}`, then fall back to an offline page.

### M2. Fix the SW HTML double-fetch and precache hardening — [Easy–Medium / Medium]
`sw.js:393` + `:402` fetch every navigation **twice** when a cache hit exists. Install
fetches assets without `cache:"reload"` (can populate the new cache from stale HTTP cache)
and 252 serial fetches make first install slow on 3G (`sw.js:314-334`). Batch in parallel
groups; treat core-shell failures as install failure. Also fix version drift: cache is
`v57` (`sw.js:1`) but the banner logs "v55" (`sw.js:536`).

### M3. Precache the missing runtime data — [Easy / Medium]
`assets/hisn_complete.json` (280 KB, fetched by `hisn.html:624`), `salah.json`,
`sleeping-zikr.json`, `assets/hadith/Index-translated.json` are not in the precache list
(`sw.js:129-142`) — those pages' shells load offline but their data doesn't. Add them, plus
a per-book "download for offline" option for hadith JSONs.

### M4. `navigator.storage.persist()` after big downloads — [Easy / High for the few affected]
No call exists anywhere. After a user downloads 100+ MB of mushaf images, the browser
(Safari especially) may evict everything under storage pressure. One line in the download
completion path (`js/quran/download.js`).

### M5. Add an update toast; stop mid-session version tearing — [Medium / Medium]
`skipWaiting()` at install-start + `clients.claim()` + old-cache deletion (`sw.js:315,347`)
means updates apply silently mid-session and can tear open pages. Listen for `updatefound` /
`controllerchange`, show "نسخة جديدة متاحة — تحديث", move `skipWaiting` behind a message.

### M6. Kill hardcoded `/Tasbee7/` URLs (~15 files) — [Easy / Medium]
E.g. `pages/takrar.html:469`, `pages/hadith.html:314`, `pages/radio.html:473`,
`pages/azkar.html:1446`, `js/quran/init.js:181`, `js/notifications.js:17`. They break on
repo rename, custom domain, or local PWABuilder testing. Use relative paths.

### M7. SW registration on all pages — [Easy / Medium]
Only `index.html:1526`, `pages/masbaha.html:932`, and `js/quran/init.js:182` register the
SW; manifest shortcuts launch `pages/audio.html`, `pages/radio.html`, `pages/azkar.html`
(`manifest.json:47-92`) which never register — launching via shortcut before an index visit
runs with no offline layer.

### M8. Consolidate the three overlapping mushaf caches and two audio-eviction ledgers — [Medium / Medium]
`quran-mushaf-images-v1` (download modal), `quran-pages-${variant}` (`js/quran/ui.js:202`),
`quran-mushaf-v1` (`js/quran-common.js:626`) store the same images. The SW's 120-entry trim
of `audio-cache-v1` (`sw.js:361-378`) and the page-level `AudioCache` 200 MB
localStorage-tracked ledger (`js/quran/audio-cache.js:5-6,29`) evict independently and drift.

### M9. Fetch error states for content pages — [Easy / Medium]
`pages/azkar.html:1159-1164` has **no catch and no error UI** — a failed JSON fetch leaves a
permanently blank card. `pages/hisn.html:624-625` silently renders an empty page on failure
(`res.ok ? await res.json() : []`). duaa.html has the best story (inline fallback data,
`:603-650`) but doesn't tell the user they're seeing a subset. Add visible retry states.

### M10. Fix the corrupted `<img>`-tag strings from the emoji codemod — [Easy / Medium]
A past emoji-replacement script pasted literal `<img src="../img/SVG/...">` markup into JS
*strings* that render via `textContent` — users see raw HTML text: `hadith.html:518`
(clear-history chip), `hadith-viewer.html:476,485,496-497,817` (toasts).

### M11. Manifest polish — [Easy / Medium]
No dedicated 192px maskable icon (`manifest.json:15-34`; the 512 doubles as `any maskable`,
which clips or over-pads); `orientation:"portrait"` locks tablets out of landscape reading
(`manifest.json:11`); one narrow screenshot only (no `form_factor:"wide"`); shortcut icons
reuse the non-maskable 192. Also add `beforeinstallprompt`-driven install UX (none exists).

### M12. SEO gaps — [Easy / Medium]
5 pages missing description/canonical/OG entirely (hadith-viewer, quran-text,
tasmee-dashboard, tasmee-review, video); `robots.txt:5-6` blocks `/js/` and `/css/` (Google
warns this degrades rendering assessment — unblock them, keep `/db/`, `/assets/`);
`og:locale` is invalid `ar_AR` (`index.html:23`) — use `ar_SA`.

### M13. Document-wide swipe navigation without a vertical guard — [Easy / Medium]
`hisn.html:868-873`, `duaa.html:956-961`, `hadith-viewer.html:830-835` change chapters on
any 80px horizontal touch delta with **no dy check** — accidental chapter jumps while
scrolling long reading pages. azkar's guarded, opt-in swipe (`azkar.html:1779`) is the
pattern to copy.

---

# Nice-to-Have Features

(See also Future Feature Roadmap for sequencing.)

- **99 Names of Allah page** — expected in every Islamic app; pure static content fitting the
  existing page pattern. [Easy / Medium]
- **Zakat calculator** — common in Muslim Pro/Athan. [Easy / Medium]
- **Hijri month view + date converter + Islamic events** (Eid, Ashura, Arafah) — the Intl
  islamic calendar is already in use (`index.html:1082-1086`). [Easy–Medium / Medium]
- **Home screen personalization** — reorderable/hideable feature cards. [Medium / Low-Medium]
- **Word-by-word translation** in the Quran reader (the "words" code in `js/quran/tafsir.js`
  is only highlight geometry today). [Hard / Medium]
- **share_target** in the manifest to receive shared verse text. [Medium / Low]

---

# Performance Optimizations

(P1–P2 are H3/H4 above; not repeated.)

1. **Add `defer` to all scripts** — `defer`/`async` is used **zero times** in the codebase;
   index.html loads 11 synchronous scripts (`index.html:1013-1025`). [Easy / Medium]
2. **Convert fonts to WOFF2** — `fonts/` ships 3.0 MB of TTF/OTF (me_quran 452 KB, Amiri
   412 KB); WOFF2 cuts 50–60%. Add `font-display:swap` to the self-hosted `@font-face` in
   `index.html:82`. (Google Fonts links already all use `display=swap` — good.) [Easy / Medium]
3. **Optimize images** — `img/border.png` 872 KB (a decorative border!), `img/txt.png` and
   `img/frame.png` 276 KB each, `icons/icon_1024.png` 408 KB, `og-image.png` 236 KB → WebP /
   oxipng saves ~1.5 MB. [Easy / Medium]
4. **Make touch listeners passive on hot paths** — `js/quran-common.js:258,274` (page
   swipe), `pages/quran-text.html:858,865` (pinch), `js/quran/highlights.js:129,133`,
   `js/quran/init.js:16`, `pages/azkar.html:1771`. Blocks compositor scrolling. [Easy / Low-Med]
5. **Cache i18n dictionaries** — every MPA navigation re-fetches and re-evals the lang file
   (`js/i18n.js:29-34`); memoize in localStorage. [Easy / Low]
6. **Duplicate reminder timers** — `pages/masbaha.html:590` and `js/masbaha.js:61` each
   start an uncleared 60 s interval; `js/notifications.js:582` polls every 30 s on every
   page that loads it. (Also see Technical Debt: js/masbaha.js is dead code.) [Easy / Low]
7. **Self-host or drop the redundant CDN Amiri** — takrar loads Amiri from Google Fonts
   *and* locally (`takrar.html:24,26-31`); masbaha/azkar/hadith use CDN fonts while
   hisn/duaa/hadith-viewer self-host — normalize on self-hosted WOFF2 (also an offline win).
   [Easy / Medium]

---

# UI/UX Improvements

1. **Fix header crowding on small screens** — the recurring pattern: non-wrapping flex
   headers with 4–6 fixed ~34–36px icons + an unconstrained title. Worst: quran-text.html
   (6 icons, `flex-wrap` absent, center column squeezed to ~90px at 320px,
   `quran-text.html:167-174,376-419`); radio.html (3-button cluster vs title with no
   `flex-shrink`/ellipsis, `radio.html:101-118,471-504`); takrar/video absolutely-center
   their titles (`left:50%; translateX(-50%)`) so longer localized titles overlap the edge
   icons (`takrar.html:470`, `video.html:196`). Standardize one header component: wrapping
   or overflow menu, `min-width:0` + ellipsis on titles, 44px targets. [Medium / High]
2. **One design-token sheet** — 20 files each declare their own `:root` palette; light-theme
   accents drift across `#198754` (azkar), `#3498db` blue (hisn/duaa), `#0f7a52` (hadith),
   `#059669` (radio), `#10B981` (audio/takrar). Extract `css/tokens.css` + `css/shell.css`
   (header, modal, toast) and migrate page-by-page. [Medium / High]
3. **Landscape and tablet support** — most pages have **zero width media queries**
   (audio.html, radio.html, quran-text.html confirmed zero; qibla's fixed 300px compass +
   `overflow:hidden` clips in landscape, `qibla.html:64,144`). At minimum: don't lock
   `orientation:portrait` in the manifest (M11) and audit `100dvh; overflow:hidden` shells
   (azkar, masbaha, hadith). [Medium / Medium]
4. **Touch targets to 44px** — sub-44px controls on every audited page: theme dots 20–24px
   (`hadith-viewer.html:95`, `hisn.html:306`, `duaa.html:349`), icon buttons ~34px
   (`radio.html:126`, `audio.html:94`), action buttons 34–40px (`hadith.html:247`,
   `video.html:125-127`), azkar mini-player seek bar 3px tall (`azkar.html:761`),
   takrar icon-btns ~28px (`takrar.html:91-94`). [Easy–Medium / High]
5. **Consistent back navigation** — five pages hardcode home links to `/Tasbee7/index.html`
   (M6); hadith.html's back chevron points the LTR way in an RTL app (`hadith.html:314`);
   tasmee pages use bare `history.back()` with no fallback href (breaks deep links,
   `tasmee-dashboard.html:16`); hadith-viewer's home button is titled "العودة للبحث" but goes
   to the app home (`hadith-viewer.html:383`). [Easy / Medium]
6. **Persist reading position everywhere** — hisn/duaa persist section index
   (`hisnCurrentIdx`, `duaCurrentIdx`) but hadith-viewer does not (reload → section 0), and
   azkar loses the in-session zikr index on reload. hadith-viewer bookmarks are stored as
   raw indices that silently corrupt if data files reorder (`hadith-viewer.html:489-491`).
   [Easy / Medium]
7. **Theme toggle affordance** — takrar/video/hadith cycle buttons show a static moon icon
   that never reflects the current theme (`takrar.html:471`, `video.html:198`); hisn's theme
   dots have no active-state indicator (`hisn.html:489-491`). [Easy / Low]
8. **Offline/error messaging** — no page checks `navigator.onLine`; radio/audio/takrar/
   video surface generic errors when offline; video.html hangs on "جاري التحميل..." forever
   if the YouTube API script fails (`video.html:366`). [Easy–Medium / Medium]

---

# Accessibility Improvements

1. **Unblock zoom** — every audited page ships `maximum-scale=1.0, user-scalable=no`
   (e.g. `masbaha.html:5`, `quran-text.html:5`, `qibla.html:5`) — a WCAG 1.4.4 failure and a
   real barrier for older users of a religious app. The Quran reader has its own pinch-zoom,
   so the lock is unnecessary there too. [Easy / High]
2. **Make the tasbih counter speak** — the core interaction of masbaha.html is a
   div-onclick circle (`masbaha.html:331`) updating `#count` (`:354`) with **no aria-live,
   no keyboard operation, no role** — screen-reader users get nothing per tap. Same for
   tasmee-review's mic status (`tasmee-review.html:374`) and azkar's counter
   (`azkar.html:1028`). Add `role="button"`, keyboard handlers, and a polite live region.
   [Easy–Medium / High]
3. **Real buttons and labels** — dozens of div-onclick controls across pages (radio dropdown
   trigger `radio.html:509`, option rows `:836`; audio setting rows `audio.html:411-433`;
   azkar's four header buttons `azkar.html:978-988`; hisn/duaa menu items). Icon buttons
   almost universally rely on `title=` (often hardcoded Arabic) instead of `aria-label` —
   grep found 0 aria-labels in hisn.html and duaa.html. The tasmee pages
   (`tasmee-dashboard.html:16,22`) show the correct pattern. [Medium / High]
4. **Modal focus management** — no page implements focus trap, Escape-to-close, focus
   restore, or `role="dialog"`/`aria-modal` (confirmed zero `keydown` listeners in
   audio.html, quran-text.html, radio.html). [Medium / Medium]
5. **`prefers-reduced-motion`** — honored on radio (`radio.html:459`), azkar (partial,
   `azkar.html:967`), tasmee css, hadith-viewer; absent on audio, quran-text, hadith, video,
   masbaha (partial). Add the global kill-switch pattern from `css/tasmee.css:462-468`.
   [Easy / Low-Medium]
6. **Contrast & focus visibility** — masbaha sets `outline:none` globally (`masbaha.html:35`);
   audio removes the range slider's focus ring (`audio.html:124`); white-on-`#10B981` (~2.5:1)
   used for primary buttons; hisn/duaa offer a white text-color option on light theme with no
   contrast guard (`hisn.html:505`). [Easy–Medium / Medium]
7. **RTL correctness for LTR locales** — physical CSS properties break mirroring when
   i18n.js flips `dir` for en/tr: `azkar.html:546,598,850`, `masbaha.html:90,99,162-163,238`,
   audio's toggle knob (`audio.html:228,231`), hadith's accent spine (`hadith.html:229`),
   quran-text's progress bar pinned `left:0` (`quran-text.html:133-141`). Migrate to logical
   properties (`inset-inline-start`, `margin-inline`…) — takrar already does
   (`takrar.html:841`). Note pages that hardcode `<html dir="rtl" lang="ar">` and never load
   i18n.js stay RTL in English (H5). [Medium / Medium]

---

# PWA Improvements

(The critical one — cache-wipe on update — is C1. Offline fallback M1, double-fetch M2,
missing precache M3, storage.persist M4, update toast M5, registration M7, cache
consolidation M8, manifest polish M11 — all above.)

Additional:
1. **Lazy `importScripts` in sw.js** — `sw.js:7` imports adhan.js + prayer-service +
   schedule-builder at top level; a 404 in any bricks SW install, and all three parse on
   every SW wake-up though only `periodicsync` needs them. [Easy / Low]
2. **Radio stream proxy pass-through** — `.ts`/`.aac` segments from
   `quran-stream-proxy...workers.dev` flow through the generic cache-first handler
   (`sw.js:358-360,382-386`); exclude the host explicitly. [Easy / Low]
3. **iOS meta coverage** — `apple-mobile-web-app-*` and `apple-touch-icon` exist only on
   index.html (`:74-77`) and masbaha.html (`:8-11`); MPA navigation in an installed iOS PWA
   loses status-bar styling on other pages. No startup-image links (`splash.png` sits unused
   at repo root). [Easy / Low]
4. **Honest offline matrix** — communicate in-app what works offline: quran-text, tafsir
   *ayah text*, takrar, radio, and video are fully network-dependent (all
   api.quran.com/api.alquran.cloud calls are SW-bypassed, `sw.js:382-386`), while the mushaf
   reader, azkar, hisn (after M3), prayer times, and qibla work offline. A small offline
   indicator prevents "the app is broken" reviews. [Medium / Medium]

---

# Android Wrapper Improvements

(C3 back-button, C4 exit flow above are the critical ones.)

1. **theme-color on all pages, synced to theme** — missing entirely on 11 pages (audio,
   duaa, hisn, qibla, radio, salah, sleeping, takrar, tasmee-dashboard, tasmee-review,
   video) and mismatched across the rest (index `#10b981`, azkar `#0F172A`, masbaha
   `#020617`, quran `#FAF6EE`, hadith `#04100c`, 404 `#1A7040`) — the TWA status bar
   flashes a different color on every navigation. Only azkar/hadith update it dynamically
   (`azkar.html:1438`). ThemeManager's `--meta` mechanism already solves this — adopt it
   (H2). [Easy / Medium]
2. **Verify Digital Asset Links** — no `assetlinks.json` in this repo; for a project site it
   must live at `https://solimananas.github.io/.well-known/assetlinks.json` (the *user-site*
   repo) with the **Play App Signing** SHA-256. If wrong/missing, the TWA shows browser UI.
   [Easy / High if broken]
3. **The Capacitor layer is stubs** — `js/native-init.js` and `js/plugins/capacitor-*.js`
   are empty shims; the comment at `index.html:1522-1523` ("notifications handled by
   @capacitor/local-notifications") is aspirational. The shipped wrapper is a PWABuilder
   TWA, so notifications are exactly the web-push path — set expectations accordingly or
   actually build the Capacitor app. Document which wrapper is real. [Easy (docs) / Medium]
4. **Fix the CORS-doomed YouTube playlist fetch** — `pages/video.html:519` fetches
   `youtube.com/playlist` HTML client-side; always blocked, feature silently dead in
   production. Use the YouTube Data API, a worker proxy, or remove the feature. [Medium / Low]

---

# Google Play Improvements

1. **Privacy policy + Data Safety form** (C2) — the current #1 blocker. [Easy / High]
2. **Adhan/notification reliability expectations** — Play users judge adhan punctuality
   harshly. The web-push architecture (7-day schedule + Cloudflare cron, `js/notifications.js`,
   `server/cloudflare.js`) is genuinely well-engineered but subject to Doze/OEM battery
   killers and the 7-day horizon on iOS/Firefox. Gate permission behind a gesture (H7), add
   an in-app "notifications health" check (last-fired indicator, battery-optimization help
   link), and consider a true Capacitor build with AlarmManager for the long term.
   [Medium–Hard / High for retention]
3. **Perceived quality: kill the visible defects** — the permanently-zero streak card (C6),
   raw `<img...>` text in toasts (M10), the garbled Quran meta description (C7), status-bar
   flicker (Android #1). These are what one-star reviews cite. [Easy / High]
4. **Retention loops** — the notification stack already supports azkar/Kahf/streak types
   (`js/schedule-builder.js`): finish the streak feature (C6), add khatmah plan reminders
   (Roadmap 2.0), and a daily "next prayer + countdown" notification as the TWA widget
   substitute. [Medium / High]
5. **Store-listing hygiene** — wide screenshot/tablet screenshots (M11), unlock orientation
   for large-screen guidelines, ensure the push server offers a data-deletion path (the
   subscription upload includes location-derived data; an unsubscribe exists — confirm the
   server deletes the record). [Easy–Medium / Medium]

---

# Code Quality Improvements

1. **Extract inline JS from the worst pages into `js/pages/*.js`** — quran-text (905 inline
   JS lines), audio (713), takrar (687), azkar (673), index (540): ESLint/tsc currently
   never see ~6,860 lines (~40% of hand-written JS); the eslint config itself schedules this
   as "P2-2". [Medium / High]
2. **Replace 454 inline `onclick=` handlers** with `addEventListener`/delegation — the
   direct blocker that forced the CSP revert (`7b5947f`), forces globals, and prevents
   extraction. quran.html alone has 112. [Medium / High]
3. **Namespace localStorage** — canonical `themeMode` coexists with live writes to `theme`
   (3+ pages) and `appThemeIdx` (video); `bookmarks` vs `quranBookmarks`; generic keys
   (`debug`, `lastPage`, `grand_total`) on a shared origin. Adopt `zad.<area>.<key>` with a
   one-time migration shim (pattern proven in theme-manager.js). [Easy–Medium / Medium]
4. **Error handling** — ~192 catch blocks, 26 completely empty; storage/fetch/audio failures
   die silently; 58 stray `console.*`. Add a tiny `reportError` helper + visible fallbacks
   (M9). [Medium / Medium]
5. **Convert i18n dictionaries to JSON** — `js/i18n.js:34` `new Function` on fetched text
   adds no attacker surface (same-origin) but forces `'unsafe-eval'` in any future CSP and
   costs a parse per page. [Easy / Low-Medium]
6. **Rebalance tests toward risk** — 23 of 72 Playwright tests are SVG-icon checks; zero
   tests cover prayer computation, SW caching, masbaha persistence, or the quran reader.
   prayer-service is a pure function — trivially unit-testable via the Node-compatible
   pattern the tasmee files already use. [Medium / Medium]
7. **Document reality** — README implies a Vite build pipeline, but production is raw files
   on Pages (Vite is dev-server + CI canary only). Add a short ARCHITECTURE.md covering the
   classic-script/global convention, the `.ts`-twin transpile, and the SW version-bump
   ritual. [Easy / Medium]

---

# Technical Debt

| Item | Evidence | Effort |
|---|---|---|
| Dead-but-precached modules: `js/quran-app.js`, `js/masbaha.js` (stale fork of masbaha logic — drift already visible), `css/_masbaha.css`, `js/toast.js` (until H1 adopts it) | sole references are `sw.js` STATIC_ASSETS; every install downloads dead bytes | Easy |
| `archive/quran.html` — 5,511-line legacy monolith | referenced by nothing | Easy |
| `worker/` — older duplicate of the push worker (empty KV id, no cron) incl. duplicated RFC-8291 crypto; `server/` is the deployed one | security-sensitive code rot | Easy |
| `server/server.js` "REFERENCE ONLY" with placeholder VAPID keys; `.env.example` references Flask/Google auth that doesn't exist | confusing | Easy |
| ~12 committed one-off fix scripts (`scripts/fix-*`, `replace-emoji.js`, `create-svgs.js`, `debug-api.ps1`…) | one-shot migrations already applied; `scripts/legacy/` exists — finish the move | Easy |
| `test_all.js` legacy runner duplicating `tests/pages.spec.js` | superseded | Easy |
| `docs/` — 11 stale planning files | history, not docs | Easy |
| Repo mass: 600 MB images + 62 MB DBs in git; `.git` = 911 MB (H8) | GitHub Pages limits | Hard |
| `"mushaf pages/"` directory name contains a space (H8) | URL-encoding landmines | Medium |
| Two-and-a-half Quran readers: modular `js/quran/*` vs inline quran-text.html vs archived monolith — quran-text re-implements bookmarks/themes/settings | divergent behavior | Hard |
| `verify-precache.cjs` checks existence but not usage — can't catch dead-but-precached | extend the guard | Easy |
| `ad_format:0` non-existent YT param (`video.html:385`); silent-AudioContext background-play hack (`video.html:596-614`) — battery cost, possible YT ToS issue | review the video feature holistically | Medium |

---

# Security Recommendations

Ranked by severity:

1. **Stored XSS via YouTube metadata → innerHTML** (`video.html:535-541,564-570`, persists
   in localStorage) — escape or `textContent`. **Medium severity / Easy fix.** (C5)
2. **Remote-API text → innerHTML with no escaping anywhere** — `quran-text.html:1031,1041,1166`,
   `js/quran/search.js:140-171`, tasmee files; a compromised/poisoned api.alquran.cloud or
   api.quran.com response executes in-app (and in the TWA). No `escapeHTML` helper exists in
   the codebase (only hisn's `escapeJS`, `hisn.html:664`; duaa's weaker `safeText`,
   `duaa.html:727`, misses backslashes). Add one shared escaper, apply at all remote sinks.
   **Medium / Easy-Medium.**
3. **Supply chain: `hls.js@latest` unpinned, zero SRI anywhere** — `radio.html:27`
   auto-updates third-party code with full DOM access; sql.js (`quran.html:27`) pinned but
   no SRI; ONNX model fetched from a fixed R2 URL with no hash check
   (`js/tarteel-worker.js:15`). Pin + add `integrity`/`crossorigin`, or self-host.
   **Medium / Easy.**
4. **No CSP on any page** (confirmed 0 hits) — re-landing it is gated on removing inline
   handlers (Code Quality #2) and `new Function` (#5). Sequence: escape sinks now, CSP later.
   **Hard / Medium.**
5. **Privacy** — location-derived schedule uploaded to workers.dev (C2); disclose, provide
   deletion, keep the ~1 km rounding (`index.html:1334`, good). **Easy / High (compliance).**
6. **208 innerHTML uses on same-origin static JSON** (hadith text `hadith.html:762`,
   `hadith-viewer.html:713,745,783`, etc.) — low risk today; flips to XSS the moment a data
   source changes. `err.message → innerHTML` (`quran-text.html:1176`,
   `hadith-viewer.html:668`) can reflect URL-derived strings. Cover via the shared escaper
   over time. **Low / ongoing.**
7. Positive notes worth keeping: external `_blank` links carry `noopener noreferrer`
   (`hisn.html:538`, `duaa.html:586`); GPS coords rounded before storage; push server
   documented with admin auth; i18n `new Function` is same-origin only.

---

# Future Feature Roadmap

### Version 2.0 — "Trust & polish" (ship within ~1 month)
- All Critical Issues (C1–C7) + H1/H2 (consolidation, one theme system)
- Privacy policy live + Data Safety form updated (C2)
- Real streak + a simple stats dashboard (C6 → the counters already exist)
- Backup/Restore JSON export-import (H6)
- Back-button/exit fixes for TWA (C3, C4) + theme-color everywhere (Android #1)

### Version 2.1 — "Worship features" (1–3 months)
- Khatmah planner on top of existing `khatma_today` / `lastPage` counters [Easy-Med / High]
- Adhan sound option (in-app when open; best-effort notification sound) [Medium / High]
- Hijri month view + Islamic events + date converter [Easy-Med / Medium]
- 99 Names + Zakat calculator [Easy / Medium]
- Daily "next prayer" notification as the TWA widget substitute [Medium / Medium]
- i18n completion on the 4 uncovered pages (H5) + Quran translations for en/ur/tr/ckb
  (ship translation JSONs alongside quran.json) [Medium / High for non-Arabic users]

### Version 3.0 — "Platform maturity" (3–9 months)
- Inline-JS extraction + inline-handler removal + re-land CSP (Code Quality 1–2, Security 4)
- Repo slimming: images to LFS/CDN, rename `mushaf pages/` (H8)
- Ramadan mode: imsakiyah, iftar countdown (reuse `startCountdown`), fasting tracker
- Ayah-level bookmarks/notes/highlights collections
- Evaluate a true Capacitor build for AlarmManager-grade adhan reliability and real widgets

### Long-term Vision
- Optional account + cloud sync (the Cloudflare Workers + KV stack already in production for
  push is a natural substrate); backup/restore (H6) is the stepping stone
- Word-by-word translation and morphology in the reader
- Tarteel-class recitation feedback as the headline differentiator — the tasmee engine +
  ONNX matcher already works offline; invest in accuracy, UX, and marketing it
- Wear/desktop form factors once the responsive foundation (UI/UX 1–3) exists

---

# Quick Wins

Each under one hour:

1. Add `quran-mushaf`, `tarteel-model` prefixes to the SW activate whitelist (`sw.js:341`) — C1, the single most valuable line of code in this document.
2. Fix the garbled meta description in `pages/quran.html:8-14` (C7).
3. Escape YouTube titles in `video.html:535,564` (C5).
4. Pin `hls.js@latest` → a fixed version with SRI (`radio.html:27`).
5. Delete the `about:blank` exit fallback (`index.html:1494-1508`) (C4).
6. `navigator.storage.persist()` after mushaf/audio downloads (M4).
7. Remove the streak card or write `streakDays` (C6).
8. Unblock `/js/` and `/css/` in `robots.txt`; fix `og:locale` `ar_AR` → `ar_SA` (M12).
9. Fix sw.js version-string drift v55 vs v57 (`sw.js:1,536`).
10. Add `theme-color` meta to the 11 pages missing it (Android #1 — static values first, ThemeManager sync later).
11. `git rm` dead files: `archive/quran.html`, `test_all.js`, `js/quran-app.js`, `js/masbaha.js`, `css/_masbaha.css`, `worker/`, one-off `scripts/fix-*` (+ drop them from `sw.js` STATIC_ASSETS, bump SW).
12. Add `data-i18n-title` to the hardcoded fav-button title (`audio.html:376`) and fix modal-header `data-i18n` wiping close buttons (`hisn.html:465`, `duaa.html:511`).
13. Correct the old roadmap's CSP claim (done — this document).
14. Add `rel="noopener"` audit is already clean — instead: add missing meta description/canonical to the 5 bare pages (M12).

---

# Final Verdict

**Current strengths.** This is far above the median solo-maintained PWA. The offline mushaf
with five variants, offline tafsir via sql.js, a working push-notification pipeline with a
Cloudflare cron dispatcher and RFC-8291 crypto, an offline AI recitation-checking engine
(tasmee + ONNX), 5-language i18n with CI-enforced key parity, real Playwright tests, and CI
guards that verify the precache and reference integrity — several of these are features
that market-leading apps charge subscriptions for. The prior remediation pass built exactly
the right shared modules (theme-manager, prayer-service, toast, schedule-builder).

**Current weaknesses.** The shared modules were built but not adopted — the app is still
~13,000 lines of per-page copy-paste with three theme systems, two localStorage dialects,
and zero linting on 40% of its JS. The service worker actively destroys users' offline
downloads on every release (C1). Accessibility is the weakest dimension of the product:
zoom is blocked, and the app's two most iconic interactions (tasbih tap, tasmee mic) are
invisible to assistive tech. And the app is live on Google Play without a privacy policy
while uploading location-derived data — a compliance incident waiting to happen.

**Most valuable next improvements.** In order: (1) the one-line SW whitelist fix, (2) the
privacy policy, (3) TWA back-button/exit behavior, (4) finish theme/toast consolidation and
kill the visible defects (streak card, garbled meta, toast garbage), (5) backup/restore.
That sequence costs roughly a week of focused work and moves Play readiness from 4/10 to
~8/10 while making every future refactor cheaper.

**Overall assessment.** A feature-rich, sincerely engineered app one disciplined
consolidation pass away from being excellent. The hard problems (offline Quran, push
scheduling, recitation AI) are already solved; what remains is the unglamorous work —
adoption, accessibility, compliance, and consistency — that separates a good side project
from a five-star Play Store app.
