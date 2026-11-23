# Zad Al-Muslim — Prioritized Modernization Plan

Phase 6 of the November 2026 audit. A plan for approval — **nothing in it has been implemented.**

IDs in brackets refer to findings: **H/M/L** = security & performance audit, **C** = content audit,
**X** = UX audit, **F** = product roadmap.

## Ground rules for every task

- **Do not change** the mushaf highlight settings or the mushaf image sizes (owner instruction).
- **Never edit Quranic text by hand.** Text changes come only from regenerating
  `data/quran.json` from a named source and re-running the 6,236-ayah comparison.
- No framework, no new runtime dependency without a written reason.
- One concern per pull request; each must pass the existing CI (type-check, lint, build,
  precache/reference/i18n guards, Playwright) and add a test for what it changes.
- Bump the service-worker version on every release that changes a shipped file.
- Religious content changes (sources, gradings, notes) need the reviewer named in the PR.

Complexity: **S** ≈ up to 2 days, **M** ≈ up to 2 weeks, **L** ≈ several weeks. Relative sizes.

---

## P0 — Critical bugs, security and data integrity

### P0-1 · Text mushaf renders the verified local text  [H-1, C-3, C-4, C-5, M-5]
- **Description:** replace the two-API fetch-and-merge with rendering from `data/quran.json`,
  keyed by surah:ayah; build nodes with `textContent`; exact-prefix basmala handling; remove the
  HTML page cache and delete old `quran_master_*` keys. Audio lookup stays online.
- **Files:** `pages/quran-text.html`, new `js/quran-data.js`, `sw.js`.
- **Dependencies:** P0-4 (clean data file).
- **Complexity:** M.
- **Acceptance:** every one of the 604 pages renders with no network; the text of each ayah in
  the DOM equals the stored text after the documented display normalisation; no `innerHTML` with
  remote data remains on the page.
- **Testing:** Playwright offline test over a sample of pages plus pages 1, 2, 187, 604; a Node
  test that walks all 6,236 ayahs through the formatter and asserts the letters and marks are
  preserved.

### P0-2 · Escape remote and user text in the image mushaf  [M-2]
- **Description:** route search results, the echoed query and the tafsir ayah quote through one
  escape helper or `textContent`.
- **Files:** `js/quran/search.js`, `js/quran/tafsir.js`, new `js/dom-safe.js`.
- **Dependencies:** none. **Complexity:** S.
- **Acceptance:** a query or mocked API response containing `<img onerror>` is displayed as text.
- **Testing:** Playwright test with a mocked API response.

### P0-3 · Tafsir works offline  [repository audit 3.3]
- **Description:** take the ayah text from the local file instead of the API; when an entry is
  empty, show the nearest preceding entry and say so [C-16].
- **Files:** `js/quran/tafsir.js`, `js/quran-common.js`.
- **Dependencies:** P0-1's data module. **Complexity:** S.
- **Acceptance:** with the server off and a tafsir book cached, the sheet shows ayah and tafsir.
- **Testing:** add to `tests/offline.spec.js`.

### P0-4 · Quran data provenance and an integrity gate  [C-1, C-2]
- **Description:** regenerate `data/quran.json` without the byte-order mark; record source,
  edition and date in `ATTRIBUTION.md`; commit a SHA-256 of the file; CI fails if the file changes
  without the checksum being updated, and re-checks counts and order.
- **Files:** `scripts/build-quran-json.cjs`, new `scripts/verify-quran.cjs`, `ci.yml`,
  `ATTRIBUTION.md`.
- **Dependencies:** owner confirms the reference source. **Complexity:** S.
- **Acceptance:** file differs from today's only by the removed mark; CI gate is live.
- **Testing:** the gate itself; tasmee unit test still passes.

### P0-5 · Content-presentation corrections  [C-7, C-8, C-13]
- **Description:** fix the end-of-mushaf message wording; add or flag the missing ruqyah source;
  show "grading not available" neutrally for the five ungraded collections.
- **Files:** `js/quran/audio.js`, `assets/azkar.json`, `pages/hadith-viewer.html`.
- **Dependencies:** reviewer for the ruqyah source. **Complexity:** S.
- **Acceptance:** no ungraded hadith is styled as authenticated. **Testing:** unit check on data.

### P0-6 · Repository and site size  [H-4, L-8]
- **Description:** move `promo/` and `screenshots/` out of the published site; delete `quran/`
  with the orphaned pages that use it; untrack `tests/screenshots/*.png`; remove unused data
  files and the unused `azan.mp3` from the download list.
- **Files:** as listed in `docs/cleanup-candidates.md`; `sw.js`; `tests/quran-v2.spec.js`
  (repoint or retire).
- **Dependencies:** **owner decision** on each deletion and on whether to rewrite history.
- **Complexity:** S (the work) — the decisions are the real cost.
- **Acceptance:** published site under 500 MB; CI green; no reachable page changed.
- **Testing:** full Playwright suite; `audit-refs` and `verify-precache` guards.

### P0-7 · Push reliability guard  [H-3, M-8]
- **Description:** confirm plan limits and current subscriber count in the Cloudflare dashboard;
  add a rate-limit rule on `/subscribe`; add a daily self-check that reports dispatch failures.
- **Files:** `server/cloudflare.js`, `server/wrangler.toml`. **Dependencies:** owner access.
- **Complexity:** S. **Acceptance:** an alert exists before users notice silence.
- **Testing:** `wrangler dev` with a seeded namespace.

---

## P1 — Core UX and architecture

### P1-1 · Design tokens and the navy / ivory theme  [X1, X2]
- **Description:** `css/tokens.css` with light (ivory) and dark (navy) values; solid surfaces
  instead of frosted glass; one accent; gold limited to ayah markers. Migrate families D → A → C →
  B. Mushaf page images and highlight colours untouched.
- **Files:** new `css/tokens.css`; every page's inline `:root` block; `css/style.css`,
  `css/hadith-book.css`, `css/thabat.css`.
- **Dependencies:** owner approves a palette on two sample screens first. **Complexity:** L.
- **Acceptance:** every screen follows the app theme; no page defines its own palette; text
  contrast ≥ 4.5:1 measured.
- **Testing:** screenshot comparison per page and theme; automated contrast check.

### P1-2 · Shared header, sheet, toast and buttons  [X3, X4, X9, X10]
- **Description:** small dependency-free modules (custom elements or plain functions) for the page
  header, bottom sheet, toast, confirm dialog, loading/empty/error states; replace `alert` and
  `confirm`; adopt `js/toast.js`.
- **Files:** new `js/ui/*.js`, `css/ui.css`; each page as it is migrated.
- **Dependencies:** P1-1. **Complexity:** L (incremental, one page per PR).
- **Acceptance:** one header and one sheet implementation in the codebase.
- **Testing:** component tests in Playwright.

### P1-3 · Touch targets and accessible names  [X5, X6, M-7]
- **Description:** 44 px hit areas (padding, not bigger icons); `aria-label` on every icon button;
  clickable `<div>`s become buttons/links; visible focus; pinch zoom restored on adhkar.
- **Files:** all pages; start with `quran.html`, `quran-text.html`, `takrar.html`, `audio.html`.
- **Dependencies:** none (can precede P1-1). **Complexity:** M.
- **Acceptance:** automated scan finds no unnamed control and no target under 40 px on the 26
  screens. **Testing:** add the scan used in this audit to CI.

### P1-4 · Home that knows the user  [F2, X-home]
- **Files:** `index.html` (after extraction, `js/home.js`). **Dependencies:** none.
- **Complexity:** M. **Acceptance:** next prayer, continue reading, continue listening and
  time-appropriate adhkar appear above the grid; empty states are actionable.
- **Testing:** Playwright with seeded storage and a mocked clock.

### P1-5 · Language completeness  [X7, X8, C-9]
- **Description:** translate the six untranslated screens and the mushaf chrome; correct `dir` on
  book pages; show adhkar translation; consistent digits per language.
- **Files:** `js/i18n/*.js`, the six pages, `js/hadith-book.js`, `pages/azkar.html`.
- **Dependencies:** translators for tr/ur/ckb. **Complexity:** M.
- **Acceptance:** no Arabic interface string in a non-Arabic session. **Testing:** extend
  `tests/i18n.spec.js`; key-parity guard already exists.

### P1-6 · First-run flow  [UX 3.1, 3.2]
- **Description:** language → location (with a reason) → home; defer the mushaf download offer.
- **Files:** `index.html`, `js/quran/download.js`. **Complexity:** S.
- **Acceptance:** a new user sees a mushaf page before any download prompt. **Testing:** Playwright.

### P1-7 · Extract inline scripts and styles  [debt #1, M-1]
- **Description:** move inline JS/CSS to files page by page, replacing `on*=""` with listeners.
  This is the enabler for linting, sharing and a strict CSP.
- **Files:** all large pages; largest first is not required — do it when a page is touched.
- **Dependencies:** none. **Complexity:** L (spread over time).
- **Acceptance:** per page — no inline script; behaviour unchanged. **Testing:** existing suite.

### P1-8 · Retire orphaned pages and dead modules  [repository audit 7]
- **Files:** eight pages, seven scripts/styles, duplicate push worker, legacy servers.
- **Dependencies:** P0-6 decisions. **Complexity:** S.
- **Acceptance:** nothing precached that no page can open.

---

## P2 — Performance and reliability

### P2-1 · Hadith: load on demand, search by index  [H-2, M-6]
- **Files:** `pages/hadith.html`, `pages/hadith-viewer.html`, new build script for per-book
  indexes and chapter-split files. **Complexity:** M.
- **Acceptance:** opening the library transfers < 300 KB; opening a chapter < 1 MB.
- **Testing:** transfer-size assertion in Playwright.

### P2-2 · Generated precache manifest and version  [M-4, L-9]
- **Description:** CI builds the precache list and a content-hash version from the files the
  pages actually reference; changelog moves to `CHANGELOG.md`.
- **Files:** `sw.js`, new `scripts/build-sw-manifest.cjs`, `ci.yml`. **Complexity:** M.
- **Acceptance:** no hand-edited list; a changed file always produces a new version.

### P2-3 · Lighter mushaf start-up — without touching rendering  [M-6]
- **Description:** load the coordinate database as the binary `db/quranpages.sqlite` (cached)
  instead of the 5.4 MB base64 script; open it in a worker so the first page image paints first.
  **Image files, sizes and highlight settings unchanged.**
- **Files:** `js/quran/state.js`, `pages/quran.html`, `sw.js`. **Complexity:** M.
- **Acceptance:** first page visible before the database finishes loading; transfer on first open
  reduced by ≥ 3 MB; highlights identical (pixel comparison on sample pages).

### P2-4 · Data freshness and cache policy  [M-4]
- **Description:** stale-while-revalidate for JSON content; no caching of opaque responses;
  request persistent storage at install time, not only in download flows.
- **Files:** `sw.js`. **Complexity:** S.

### P2-5 · Supply chain and CSP stage 1  [M-1, M-3, L-1]
- **Description:** vendor `hls.js`; `npm audit fix`; add a host-restricting `<meta>` CSP that
  still allows inline code; tighten as P1-7 progresses.
- **Files:** `pages/radio.html`, all pages (meta tag), `package-lock.json`. **Complexity:** S–M.

### P2-6 · Push dispatcher redesign  [H-3]
- **Description:** time-bucketed keys or Durable Object alarms so each tick does constant work.
- **Files:** `server/cloudflare.js`. **Dependencies:** P0-7 findings. **Complexity:** M.
- **Acceptance:** dispatch cost independent of subscriber count; migration keeps existing
  subscriptions.

### P2-7 · Audio link and identity monitor  [content audit §4]
- **Description:** weekly CI job checking each track's final URL and size; report in an issue.
- **Files:** new `scripts/check-audio.cjs`, workflow. **Complexity:** S.

### P2-8 · Remaining weight  [M-6]
- **Description:** lazy-load video-maker backgrounds; load only the fonts a page uses; split or
  subset rarely used fonts; replace `backdrop-filter` (largely done by P1-1).
- **Complexity:** M.

### P2-9 · Opt-in diagnostics  [L-6]
- **Description:** a local ring buffer of errors with a "copy report" button in settings. No
  automatic sending. **Complexity:** S.

---

## P3 — New features and product differentiation

| ID | Task | Roadmap | Depends on | Cx |
|---|---|---|---|:-:|
| P3-1 | Offline Quran search wired into both readers | F1 | P0-1 | S |
| P3-2 | Daily adhkar routine; merge `salah`/`sleeping` into the reader | F3 | P1-2 | M |
| P3-3 | Backup / export / restore | F4 | — | M |
| P3-4 | Offline-aware audio (saved marks, storage screen, bulk download) | F5 | — | M |
| P3-5 | Khatma and reading plans | F6 | P1-4 | M |
| P3-6 | Hijri calendar with adjustment and occasions | F8 | reviewer | M |
| P3-7 | Ramadan mode | F9 | P3-5, P3-6 | M |
| P3-8 | Ayah bookmarks, notes and collections | F7 | P0-1, P3-3 | M |
| P3-9 | Bundled Quran translations | F10 | licences, P0-1 | M |
| P3-10 | Accessibility mode | F11 | P1-1, P1-3 | M |
| P3-11 | Region-aware prayer-method default; method shown beside times | content §8 | reviewer | S |

Each needs, at minimum: an acceptance test that runs offline, a privacy line in
`pages/privacy.html` if it stores anything new, and translation keys in all five locales.

## P4 — Advanced capabilities

| ID | Task | Roadmap | Depends on | Cx |
|---|---|---|---|:-:|
| P4-1 | Unified search across Quran, hadith and adhkar | F12 | P2-1, P3-1 | L |
| P4-2 | Memorisation map | F14 | — | M |
| P4-3 | Topic index (curated), then optional on-device semantic retrieval | F16 | reviewer, P3-9 | M → L |
| P4-4 | Word-level follow-along recitation | F13 | timing data licence | L |
| P4-5 | Optional end-to-end-encrypted sync | F15 | P3-3 | L |
| P4-6 | Short verified lessons | F17 | author + reviewer | L (content) |

---

## Sequence

1. **Now:** P0-2, P0-3, P0-5 (small, independent) → P0-4 → P0-1. In parallel, owner decisions for
   P0-6 and dashboard check for P0-7.
2. **Next:** P1-3 (accessibility of controls) and P1-6 (first run) — visible wins that need no
   design decision. Palette approval for P1-1 on two sample screens.
3. **Then:** P1-1 and P1-2 family by family, with P1-7 extraction on each page as it is touched;
   P2-1 and P2-3 alongside (they are independent of design).
4. **Then:** P2-2, P2-4, P2-5, P2-6; P1-4, P1-5, P1-8.
5. **Features:** P3-1 → P3-3 → P3-2 → P3-4; P3-5/6/7 timed to be stable a month before Ramadan.
6. **Later:** remaining P3, then P4.

## Definition of done for a release

- CI green, including the offline suite and the new integrity gate.
- Manual pass on one real Android phone and one real iPhone (install, go offline, read, listen,
  receive one notification).
- Service-worker version bumped; changelog entry written.
- No new third-party host contacted without a line in the privacy page.
- For content changes: reviewer named.
