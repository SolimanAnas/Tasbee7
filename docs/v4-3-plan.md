# Tasmee' Pro — v4-3 Implementation Plan

## STATUS — all milestones shipped (2026-06)
- ✅ **M1** word-by-word tracking + real-time highlighting (F1–F5) — `js/tasmee-matcher.js` (20 Node tests), offline text from `data/quran.json`, colored word strip.
- ✅ **M2** session stats + mistake DB (F6, F7) — `js/tasmee-store.js` (IndexedDB), dashboard modal.
- ✅ **M3** spaced-repetition revision planner + memorization heatmap (F8, F9).
- ✅ **M4** teacher-mode session summary (F13) + voice search (F16).
- ✅ **M5** offline-first verified (page+text+matcher+store work with network blocked); no microphone audio is retained/uploaded (audited).
SW cache is at **v19**. Entry points: header mic = `startTasmeeFollow`; Tarteel sheet = `startAITasmee` + `إحصائياتي`; search overlay mic = `voiceSearch`.

## Context

`v4-2.md` is an ambitious 16-feature PRD (Tarteel-level app). After review, we are
building **only the realistic, high-value subset** that the existing offline assets
already support ~80%:

- **F1–F3** Word-by-word tracking + missing / extra word detection
- **F4** Ayah auto-progress (no manual selection)
- **F5** Real-time highlighting (green/yellow/red/gray)
- **F6** Session statistics + dashboard
- **F7** Mistake database
- **F8** Memorization heatmap (mastery per ayah/surah/juz)
- **F9** Smart revision planner (spaced repetition: 1/3/7/14/30 days)
- **F13** Teacher-mode session summary
- **F16** Voice search → navigate to verse
- **Tech reqs:** offline-first, IndexedDB, lazy loading, no mic retention

**Explicitly OUT of scope** (research / external / not offline-feasible): F10 custom
Quran ASR, F11 acoustic tajweed detection, F12 pronunciation scoring, cloud sync.

All work lands in **`quran-V4-2.html`** plus two small new ES modules. The old
text-based Tasmee (`js/tasmee-engine.js` via Web-Speech) is left intact.

---

## What already exists (reuse, don't rebuild)

| Asset | File | Reuse for |
|---|---|---|
| ONNX recognizer → `{transcript, surah, ayah, text, surahName, score}` + `stream_result` | `js/tarteel-worker.js` | Speech input (offline) |
| Word matcher: `_matchWords`, `_normArabic`, `_getTajweedVariants`, `_matchMergedAt`, `_isMatch`, `_fuzzyMatch`, `_computeScore`, word states `pending/active/correct/fuzzy/missed` | `js/tasmee-engine.js` | F1–F3 matching brain |
| Full offline Quran text (`text_uthmani`, `text_clean`) | `data/quran.json` | Offline expected-text (replaces API) |
| Follow mode: `startTasmeeFollow`, `_tpFollowToAyah` (lock+forward-window), `_tpRenderImageMasks`, `masksByAyah`, `_tpRevealBefore`, `_tpSetExpected` | `quran-V4-2.html` | F4 ayah progress |
| Per-word boxes (legacy): `getWordLevelLegacyCoords` (per word) | `quran-V4-2.html` | F5 image word highlight |
| Page lookup `_tpLookupPage`, `goToPage`, `ayahCountMap`, `SURAH_MAP`/`JUZ_MAP` | `quran-V4-2.html`, `js/quran-common.js` | F4/F8/F16 |
| localStorage streak/khatma + `NotificationSystem.updateStreak` | `index.html`, `js/notifications.js` | F6 streak pattern |

**Key constraint discovered:** word-level image coords are reliable **only for the
legacy/colored mushaf** (`ayarects` = one box per word). The Medina-family coords are
line-segments, not words. So **real-time per-word coloring on the image (F5) is
legacy-only**; all variants still get the word-by-word **text summary** (F13) and
ayah-level highlighting.

---

## Architecture

Two new ES modules, wired into `quran-V4-2.html`:

### 1. `js/tasmee-matcher.js` — pure word-alignment brain
Extract the matching logic from `TasmeeEngine` into a **DOM-free, Web-Speech-free**
class. Input: expected word tokens + a recognized transcript. Output: per-word states,
current position, extra words, score. No `SpeechRecognition`, no `document` access.

- Reuse verbatim: `_normArabic`, `_getTajweedVariants`, `_isMatch`, `_matchMergedAt`,
  `_fuzzyMatch`, `_computeScore`, `_buildWordIndex` (minus DOM `spanId`).
- New: **streaming-safe alignment**. The worker streams overlapping ~8 s windows
  every 1.8 s, so the same words re-appear. Re-align the recent transcript against
  expected words from the current ayah start each tick and advance the pointer
  **monotonically (forward-only)** to the furthest contiguous match — idempotent under
  overlap. Capture **extra words** (spoken tokens that match nothing within the
  lookahead window) for F3/F7.
- Emits callbacks: `onWord(idx, state)`, `onExtra(word)`, `onAyahComplete(surah, ayah, stats)`.

### 2. `js/tasmee-store.js` — IndexedDB persistence (tech req)
Tiny promise wrapper around one DB `tasmeePro` with stores:
- `sessions` — `{id, date, surah, fromAyah, toAyah, accuracy, mistakes, durationSec}`
- `mistakes` — `{id, surah, ayah, word, type: missing|wrong|extra, date}`
- `revisions` — `{key:"surah:ayah", level, dueDate, ease, lastReviewed, lapses}`
- `mastery` (optional/derived) — cached `{key, score}` for heatmap

Helpers: `addSession`, `addMistakes`, `getSessionsSince`, `scheduleRevision`,
`getDueRevisions`, `getMastery`. All offline; no network.

---

## Milestones

### M1 — ONNX → word-by-word matcher (F1, F2, F3, F4, F5)
- Build `js/tasmee-matcher.js` (above).
- In `quran-V4-2.html`, on entering follow mode, load the **page's ayah text offline**
  from `data/quran.json` (lazy-load once, cache) instead of `api.alquran.cloud`; build
  the expected-word index for the page. (`result.text` from the worker also gives the
  current ayah's text as a fallback.)
- Feed `_tpHandleStreamResult.transcript` and the final `_aiHandleResult.transcript`
  into the matcher. Keep the existing **lock + forward-window** guard so it still
  doesn't over-jump pages.
- **F5 highlight:** add per-word mask elements for the *current* ayah using
  `getWordLevelLegacyCoords` (legacy only); color via classes
  `.tasmee-word--correct/--fuzzy/--missed/--active/--pending`
  (green/yellow/red/active/gray). Non-legacy variants keep ayah-level reveal.
- **F4:** when the matcher hits the last word of an ayah, advance to the next ayah
  (reuse `_tpRevealBefore`/`_tpSetExpected`); cross pages via `_tpSwitchToPage`.

### M2 — Session stats + mistake DB (F6, F7)
- Add `js/tasmee-store.js`.
- On `onAyahComplete` / session end, write a `sessions` row and `mistakes` rows
  (missed→missing, fuzzy→wrong, extra→extra). **No audio is stored** (mic-retention req).
- **Dashboard** (new modal): accuracy %, time spent, total recitations, daily streak
  (reuse the streak localStorage pattern), weekly progress. Aggregate from `sessions`.

### M3 — Revision planner + heatmap (F8, F9)
- **F9:** SM-2-lite per ayah. On session end, for each recited ayah compute accuracy →
  set next `level` (1/3/7/14/30 d); ayat below a threshold drop a level (resurface
  sooner). Store in `revisions`. A "اليوم للمراجعة / Due today" list opens those ayat
  straight into follow mode.
- **F8:** heatmap view (per surah, expandable to ayah; juz roll-up) colored
  🟢/🟡/🔴 from mastery = f(recent accuracy, lapses) derived from `sessions`+`mistakes`.

### M4 — Teacher mode + voice search (F13, F16)
- **F13:** replace the post-session modal (extend existing
  `_showResultModal` / `tasmeeResultsModal`) with: score ring, per-ayah mistakes list,
  weak-words list (most-missed from `mistakes`), and a recommendation derived from
  the revision schedule ("راجع الآيات ٢٠–٣٥ غداً").
- **F16:** add a clear **voice-search** action (reuse the recognizer; `result.surah/ayah`
  → `goToPage(_tpLookupPage(...))` / scroll to verse). Largely already works via the
  Tarteel "تعرف على الآية" path — expose it as a dedicated search affordance.

### M5 — Offline-first hardening (tech reqs)
- Switch all Tasmee ayah-text reads to `data/quran.json` (drop the
  `api.alquran.cloud` dependency in the panel; keep it only as a last-resort fallback).
- Add `data/quran.json` to the service-worker precache list (`sw.js` `STATIC_ASSETS`,
  bump `CACHE_NAME`) so word-by-word works fully offline.
- Confirm no mic audio is persisted anywhere (it isn't today — verify and document).

---

## Files touched
- **New:** `js/tasmee-matcher.js`, `js/tasmee-store.js`
- **Edit:** `quran-V4-2.html` (wire matcher into follow mode, word-mask highlighting,
  dashboard/heatmap/teacher modals, voice-search action, offline text load)
- **Edit:** `sw.js` (precache `data/quran.json`; bump cache version)
- **Reuse (read-only):** `js/tasmee-engine.js` (source the matching logic),
  `js/tarteel-worker.js`, `data/quran.json`

## Main risks
1. **Streaming overlap → double-counting words.** Mitigated by forward-only monotonic
   re-alignment each tick (M1). Highest-risk item; build + test first.
2. **ASR transcript quality** (no diacritics, ASR errors). Mitigated by reusing the
   tajweed-variant + fuzzy (Levenshtein≤1) matching already proven in `tasmee-engine.js`.
3. **Per-word image highlight is legacy-only.** Accepted: text summary covers all variants.

## Verification (end-to-end)
- **Matcher unit tests** (Node, like the follow-mode sims): feed crafted transcripts
  (exact, missing word, extra word, idgham merge, ASR typo, overlapping windows) and
  assert word states + extra-word capture + monotonic position. No mic needed.
- **In-browser (chrome-devtools MCP, phone viewport):** open follow mode, inject
  transcripts via `_tpHandleStreamResult`, screenshot the colored word masks on a
  legacy page; confirm F4 auto-advance + cross-page.
- **Persistence:** drive a simulated session, then read back `sessions`/`mistakes`/
  `revisions` from IndexedDB; verify dashboard, heatmap, and "due today" reflect it.
- **Offline:** disable network, confirm Tasmee + text load still work from
  `data/quran.json` (SW cache).
- Run existing `tests/tasmee.spec.js` (Playwright) to ensure the old text-Tasmee
  still passes.

## Suggested order
M1 → M2 → M3 → M4 → M5 (M1 is the foundation and the riskiest; ship it first).
