# Tasmee' Pro — The Tarteel-Level Upgrade Plan

Compiled 2026-07-04 from a full read of every Tasmee-related file in the repo (engines,
matchers, stores, the ONNX worker, all three UI surfaces, and the prior planning docs in
`docs/`). Every claim below is backed by a `file:line` citation — nothing here is a guess
about what the code currently does.

> **Naming note:** this repo's planning docs live in `docs/` (no leading dot). I've used
> that convention rather than creating a new `.docs/` folder.

---

## Implementation status (2026-07-05)

Executed as a **parallel v3 page** so `pages/quran.html` stays untouched and shippable
while the upgrade is validated:

- ✅ **Phase 0 #1 — wasted `matchVerse()` removed** from `js/tarteel-worker.js`
  `recognizeStream()`. It no longer runs a 6,236-verse Levenshtein scan on every 1.5s
  streaming tick (the result was never read). Benefits **both** v2 and v3 since they share
  the worker.
- ✅ **New `pages/quran_v2.html`** — byte-identical to `quran.html` except two script lines
  (adds `js/tasmee-matcher.js`, swaps `tasmee-pro-v2.js` → `tasmee-pro-v3.js`). Everything
  else — reader, audio, tafsir, search, download, themes — is unchanged.
- ✅ **New `js/quran/tasmee-pro-v3.js`** — the v2 panel's rendering/recording layer with two
  upgrades: (1) the matching brain is now the shared **`TasmeeMatcher`** (tajweed variants,
  Levenshtein-DP fuzzy, idgham two-word fusion, lookahead skip detection, extra-word
  tracking) instead of the old inline prefix/1-edit matcher — with a graceful fallback to
  the inline matcher if the shared module fails to load; (2) **sessions persist** — word
  states accumulate into a last-wins map and are saved via `TasmeeStore` (session +
  typed missing/wrong/extra mistakes) on page-switch and panel close, so the Tasmee
  dashboard finally sees Pro-panel usage (previously it saved nothing).
- ✅ **`TasmeeMatcher` resurrected from dead code** and hardened: fixed a corrupted
  diacritics regex in `js/tasmee-matcher.ts` (an RTL-edited character class had silently
  grown to eat *all* Arabic letters — now `\u`-escaped); added `variantsFor()` for the
  Uthmani dagger-alif spelling (`ذَٰلِكَ` ↔ ASR `ذلك`); and taught `feedTranscript`'s
  re-anchor scan to recognise idgham-fused pairs at their first token.
- ✅ **Tests** — new `tests/node/tasmee-matcher.test.cjs` (8 cases, run in CI-free Node:
  spec-parity skip/overlap/idempotence + iqlab/idgham/extra-word + the exact token-build
  path v3 uses) and `tests/tasmee-v3.spec.js` (mirrors `tasmee-v2.spec.js` against
  `quran_v2.html`, plus an IndexedDB persistence assertion). `sw.js` precache + reference
  guards updated; SW bumped to v69.

**Not yet done** (unchanged from the roadmap below): wiring the *other* surfaces
(`quran-text.html`, `tasmee-review.html`) onto the shared matcher/store, the offline
word-level ASR research (Phase 2), and cross-surface polish/i18n (Phase 3). `quran.html`
itself is deliberately left on v2 until `quran_v2.html`/v3 is validated in the field.

---

## 0. The one-paragraph version

You already built most of the *hard* half of a Tarteel-level app — a genuinely
sophisticated tajweed-aware word matcher, and a real offline ONNX speech model — but they
were built in **five disconnected copies** across three surfaces, and the two best pieces
(`TasmeeMatcher`, the module explicitly designed to connect the ONNX model to word-level
mistake detection) were **never wired together**. The ONNX model today only identifies
*which whole verse* was recited (a search feature), not *which words were wrong* (a
tutor feature) — that's the single biggest gap versus Tarteel, and closing it is Phase 2
below. Phase 0/1 (unify the duplication, wire up what already exists, persist every
session) is lower-risk, higher-certainty value and should ship first.

---

## 1. Current State: The Full Picture

### 1.1 Five parallel "matching brains," not one

| # | Implementation | Where it runs | Speech backend | Sophistication |
|---|---|---|---|---|
| 1 | `TasmeeEngine` (`js/tasmee-engine.ts` → `.js`, 548 lines) | `pages/quran-text.html:1620` (inline controller `:1450-1600`); also `pages/quran.html`'s legacy image-mode Tasmee via `js/quran/tasmee.js:278` | Web Speech API (`webkitSpeechRecognition`) — **cloud**, Google's servers | High: tajweed variants (idgham/iqlab ن-rules), Levenshtein≤1 fuzzy, idgham word-merge detection, 3-word lookahead skip detection, multi-alternative dry-run scoring |
| 2 | `TasmeeMatcher` (`js/tasmee-matcher.ts` → `.js`, 335/363 lines) | **Nowhere.** Confirmed dead: zero `<script>` tags, zero `new TasmeeMatcher(` call sites anywhere in the repo | Designed for ONNX streaming windows | **The most sophisticated of the five** — same tajweed/Levenshtein/lookahead as #1, *plus* explicit re-anchoring for overlapping ~8s streaming windows, *plus* extra-word (insertion) tracking, *plus* per-ayah completion stats. Built, unit-tested (per `docs/v4-3-plan.md:4`, "20 Node tests"), never connected. |
| 3 | `js/quran/tasmee-pro-v2.js` inline matcher (`_v2FuzzyEq`, `:298-314`) | `pages/quran.html`'s default "Tasmee' Pro" AI panel (`startAITasmee`, `:424-428`) | ONNX (`tarteel-worker.js`) streaming | **Weaker**: prefix-match + ≤1-edit greedy scan, no tajweed variants, no idgham merge detection, no shared code with #1/#2 |
| 4 | `js/quran/tasmee-review.js` inline matcher (`:106-153`) | `pages/tasmee-review.html` (daily spaced-repetition review) | Web Speech API, own `recognition` object | **Weakest**: reimplements normalize/tokenize/fuzzy from scratch, no tajweed variants, no idgham merge, no lookahead-skip |
| 5 | `tarteel-worker.js`'s `matchVerse()` (`:180-193`) | Both the "Tarteel" single-verse-ID sheet and (indirectly) the Pro v2 panel's final-chunk check | ONNX, whole-clip | Linear Levenshtein scan across all 6,236 verses — **whole-verse identification, not word-level** |

**The core architectural problem in one sentence:** the tajweed-aware, thoroughly-tested
matching brain (#1/#2) only ever runs against a *cloud* speech API, while the *offline*
ONNX model (#5) is wired to the *weakest* matcher (#3), because #2 — built specifically
to bridge them — was never connected.

### 1.2 Three copies of the same IndexedDB schema

| Store | File | Consumed by |
|---|---|---|
| `TasmeeStore` (canonical) | `js/tasmee-store.ts` → `.js` (184/142 lines), DB `tasmeePro` v1, stores `sessions`/`mistakes`/`revisions` | Only `js/quran/tasmee.js:257-262` (the *legacy* image-mode Web-Speech flow on `quran.html`) |
| Duplicate #1 | `js/quran/tasmee-dashboard.js:5-84` — comment literally says *"mirrors TasmeeStore schema"* | `pages/tasmee-dashboard.html` |
| Duplicate #2 | `js/quran/tasmee-review.js:9-77` | `pages/tasmee-review.html`, plus its own SM-2 scheduler (`:156-198`) not present in `TasmeeStore` itself |

**Net effect on data integrity:**
- `pages/quran-text.html` sessions → **never saved anywhere** (no `TasmeeStore` script tag at all; confirmed by reading its `onSessionEnd` handler, `:1450-1600` — DOM/toast only).
- `pages/quran.html`'s default "Tasmee' Pro v2" AI panel sessions → **never saved anywhere** (no persistence call exists in `tasmee-pro-v2.js` or `ui-extras.js`; only an in-memory `_v2.errors` counter that resets on close, `tasmee-pro-v2.js:284-295,430-444`).
- The dashboard's "تصنيف الأخطاء" (mistake-type breakdown: missing/wrong/extra) **always renders 0/0/0** in practice, because the only code that ever classifies mistakes into that taxonomy is `TasmeeMatcher` (#2 above) — which nothing calls.
- The "weak words" list is fed by the same dead path, so it's very likely empty for most real users too.

So today, of the four places a user can actually recite (`quran-text.html`, `quran.html`
legacy mode, `quran.html` Pro v2 panel, `tasmee-review.html`), **only one** — the legacy
mode, which nobody would default to since Pro v2 is the primary panel — persists anything
into the dashboard's streaks/history/mastery data.

### 1.3 The ONNX model: what it actually is (and isn't)

`js/tarteel-worker.js` is a faithful, well-implemented port of
[yazinsai/offline-tarteel](https://github.com/yazinsai/offline-tarteel) (properly
attributed in `ATTRIBUTION.md`, CC-BY-4.0, NVIDIA FastConformer Arabic CTC, ~131MB
quantized ONNX). The pipeline is real: hand-rolled radix-2 FFT (`:29-55`), NeMo-compatible
80-bin mel spectrogram with dithering/pre-emphasis/per-band normalization (`:91-128`),
proper CTC greedy decode (`:131-146`).

But — and this is the single fact that most determines the shape of the upgrade —
**`matchVerse()` (`:180-193`) does whole-utterance, whole-verse identification.** Given
~7 seconds of audio, it answers *"which of the 6,236 ayahs does this sound most like"*
with one similarity score. It cannot say *"word 4 was wrong."* It has no concept of a
word boundary in time, no per-word confidence, no partial-verse alignment.

The reference project's own README (`docs/offline tarteel.md:229-231`) is explicit that
closing the gap between "verse ID" and "streaming word-level accuracy" is *the open
research problem*, and reports realistic streaming numbers well below the 95% recall
headline: **~88-89% recall / ~68-73% precision** for the browser streaming mode this app
actually uses (`docs/offline tarteel.md:247-248`), versus ~78-85%/79-85% even in
non-streaming full-file mode on harder corpora. This is honest, valuable context — it
means the *existing* engineering choice to fall back to the Web Speech API's cloud STT for
real per-word tracking, and use ONNX only for coarse verse identification, was probably
the right call given the model's real accuracy — but it also means "wire ONNX up to do
what Tarteel does" is not a small integration task; it's closer to a research problem, and
should be scoped and resourced as one (see Phase 2).

**Performance bug (verified, not speculative):** `tasmee-pro-v2.js:_tpHandleStreamResult`
(`:316-354`) only ever reads `data.transcript` — it never reads `data.match`. Yet
`recognizeStream()` (`tarteel-worker.js:300-324`) runs the full 6,236-verse `matchVerse()`
scan on *every* streaming tick (every 1.5s, for the entire duration of every session,
`tasmee-pro-v2.js:538-541`). That's a full-corpus Levenshtein scan whose result is thrown
away, running continuously during live recitation on a background thread that's also the
one doing CTC inference. **This should be fixed regardless of anything else in this plan**
— it's pure waste, on the hot path, on every user's phone, in the current shipped code.

### 1.4 UX / polish inventory across the three surfaces

| Surface | Live word highlighting | Persistence | i18n | Visual polish |
|---|---|---|---|---|
| `quran-text.html` reader Tasmee | ✅ per-word color states (`.q-word--correct/fuzzy/missed/active`, `:275-280`) | ❌ none | ❌ 0% (no `data-i18n`, no `js/i18n.js`) | Bare pulsing dot mic indicator (`.tasmee-mic-indicator`, `:285-287`), no waveform, no live partial-transcript display |
| `quran.html` Tasmee Pro v2 panel | ✅ richer: word masks synced to real mushaf image coordinates via `ayarects` SQLite, ayah-medallion tap-to-start, live transcript strip | ❌ none | Not audited in depth but shares `quran.html`'s general lack of i18n on this panel | `css/tasmee-pro-v2.css` (324 lines) is meaningfully richer: halo, breathe, word-in, marker-pop, cursor, error-flash animations |
| `tasmee-review.html` daily review | ❌ **no color-coded word spans at all** — only an end-of-session toast | ✅ (own duplicated store) | ❌ 0% | Has a real mic-pulse ring + mastery grid, but the recitation itself is a black box while it's happening |
| `tasmee-dashboard.html` | n/a (read-only) | reads its own duplicated store | ✅ only page with real i18n coverage (`tasmee_*` keys × 5 locales) | Genuinely polished stats UI (streak flame, weekly chart, mastery heatmap) — this part is already close to Tarteel-grade |

**Mic-permission UX is inconsistent three ways:** `quran-text.html` hard-blocks entry if
`SpeechRecognition` is undefined with no fallback; `tasmee-review.html` gates on
`IndexedDB` availability (the *wrong* signal — it should check `SpeechRecognition`) and
only surfaces mic errors reactively after the user taps the mic; none of the three detect
Safari/iOS's partial `webkitSpeechRecognition` support explicitly.

### 1.5 What's genuinely already good (don't rebuild these)

- `TasmeeEngine`'s tajweed-variant generation (`_getTajweedVariants`) is a real, useful
  piece of Arabic phonology (iqlab ن→م before ب, idgham/ikhfa ن-elision before the
  appropriate letter classes) — keep and reuse verbatim.
- `TasmeeMatcher`'s streaming re-anchoring window search (`feedTranscript`, `:285-336`) is
  exactly the right approach for handling ONNX's overlapping windows without
  double-counting — this is hard to get right and it's already done.
- `TasmeeStore`'s schema and `aggregate()` (streak/weekly/weak-words) is sound and matches
  what a Tarteel-style dashboard needs — the problem is *consumption*, not design.
- The mushaf-image word-coordinate system (`ayarects` table, `getWordLevelLegacyCoords`)
  that Pro v2 uses for on-page-image word masking is a genuinely nice piece of engineering
  specific to this app's image-based reader — Tarteel doesn't have to solve this problem
  since it isn't rendering a real mushaf page raster.
- Attribution/licensing for the ONNX model is already done correctly (`ATTRIBUTION.md`).

---

## 2. What "Tarteel-level" actually means (the target bar)

Tarteel's core loop, distilled to what's technically reproducible offline-first:

1. **Continuous listening** while reciting, with **live per-word feedback** (not
   after-the-fact) — color-coded correct/wrong/skipped, updated within roughly a second
   of the word being spoken.
2. **Mistake taxonomy**, not just a percentage: missed words, mispronounced words, extra
   (inserted) words, and ideally *which* tajweed rule was likely violated.
3. **Session memory**: every recitation session recorded, contributing to per-ayah
   mastery, streaks, and a spaced-repetition queue of what to revise next.
4. **Works with just a phone mic**, ideally offline, with the app clearly indicating when
   it is/isn't using network/cloud speech.
5. **Teacher/self-review mode**: a shareable or reviewable summary of a session — what
   was recited, what was missed, trend over time.
6. **Low friction to start**: tap a verse/page, start reciting, no elaborate setup.

Given the audit above, items 3, 5, and 6 are **mostly solved already** in this codebase
(the dashboard, `TasmeeStore`, and the tap-a-medallion-to-start UX) — they just need to be
*connected* to every entry point instead of one. Items 1 and 2 are **solved for the cloud
Web Speech path** (via `TasmeeEngine`/`TasmeeMatcher`) but **not for the offline ONNX
path**, which is the real, hard, novel work.

---

## 3. Gap Analysis vs. Tarteel

| Capability | Tarteel | This app today | Gap |
|---|---|---|---|
| Live per-word highlighting | Yes | Yes, but only in 2 of 4 surfaces, and with 2 different matcher qualities | **Medium** — unification work |
| Mistake taxonomy (missing/wrong/extra) | Yes | Built (`TasmeeMatcher`) but disconnected everywhere it would matter | **Low** (already built — wire it up) |
| Offline word-level checking | Yes (proprietary model) | No — offline path (ONNX) only does whole-verse ID | **High** — genuine research/engineering gap |
| Session history / streaks / mastery | Yes | Built and polished (`tasmee-dashboard.html`) but starved of data from 3 of 4 entry points | **Low** (plumbing, not design) |
| Spaced repetition | Yes | Built (`tasmee-review.js` SM-2), works, but isolated to one surface with its own duplicate store | **Low** |
| Hesitation / timing-based feedback | Yes | None anywhere | **Medium** |
| Repeat-word detection | Partial | None anywhere (architecturally hard with the pointer-advance model — see §5) | **Medium** |
| Tajweed rule feedback (acoustic, not just text) | Yes (their flagship feature) | None — only *text-level* tajweed variant matching, not acoustic detection of madd length/ghunna/qalqalah | **Very high** — out of reach without a purpose-trained model |
| Pronunciation scoring | Yes | None | **Very high** |
| Teacher/summary sharing | Yes | Results modal exists but not shareable/exportable; no cross-surface consistency | **Medium** |
| i18n (5 languages, matching the rest of the app) | n/a (Tarteel is Arabic/English only) | 1 of 4 surfaces has it | **Low** (mechanical) |

---

## 4. Phased Roadmap

Ordered by risk-adjusted value: unify and fix what's broken before building anything new.
Each phase is independently shippable.

### Phase 0 — Stop the bleeding (days, not weeks)

Zero new features; fixes real, verified bugs and waste.

1. **Fix the wasted `matchVerse()` call in streaming** (`tarteel-worker.js:300-324`). Add a
   `skipMatch` flag to the `stream` message type, or simply delete the `matchVerse(transcript)`
   call from `recognizeStream()` and return `{type:'stream_result', transcript}` only —
   `_tpHandleStreamResult` never reads `.match` anyway. Immediate CPU/battery win on every
   session, no behavior change.
2. **Persist every session, everywhere.** Wire `TasmeeStore.addSession()` /
   `addMistakes()` into:
   - `pages/quran-text.html`'s `onSessionEnd` handler (currently DOM/toast only).
   - `pages/quran.html`'s Tasmee Pro v2 `_v2CountError`/`_v2Open`/`closeTasmeePro`
     lifecycle (currently only `_v2.errors` in memory).
   This alone makes the existing, already-polished dashboard (streaks, weekly chart,
   history, mastery grid) reflect *all* usage instead of a fraction of it — very likely
   the single highest perceived-quality win available, and it's almost entirely plumbing.
3. **Delete or repurpose the duplicate IndexedDB wrappers.** Point
   `tasmee-dashboard.js` and `tasmee-review.js` at the real `TasmeeStore` module instead of
   their own copies of the same schema. Keep `tasmee-review.js`'s SM-2 scheduler logic —
   that part is genuinely review-specific — but have it call `TasmeeStore.getRevision`/
   `putRevision` rather than opening its own `indexedDB.open('tasmeePro', 1)`.
4. **Fix the mic-permission capability check in `tasmee-review.html`** — it currently
   gates on `IndexedDB` availability with an Arabic string containing a typo
   ("التلمييع" instead of "التسميع", `js/quran/tasmee-review.js:696-698`); it should check
   `SpeechRecognition`/`webkitSpeechRecognition` up front like `quran-text.html` already
   does, and fix the typo regardless.

### Phase 1 — Unify the matching brain

1. **Retire `TasmeeMatcher` as dead code, or make it the single source of truth** — don't
   leave a third option sitting unused. Given it's the *most* capable of the five
   implementations (tajweed variants + idgham merge + lookahead + streaming re-anchoring
   + extra-word tracking, and it's already unit-tested), the right move is the latter:
   - Replace `tasmee-pro-v2.js`'s inline `_v2FuzzyEq`/`_tpHandleStreamResult` matching with
     `TasmeeMatcher.feedTranscript()`, gaining tajweed-awareness and proper insertion
     tracking for the ONNX path for the first time.
   - Replace `tasmee-review.js`'s inline normalize/tokenize/fuzzy (`:106-153`) with the
     same shared matcher, so the daily review session gets tajweed-variant matching and
     stops being the *weakest* of the four implementations.
   - `TasmeeEngine` (`quran-text.html`) can either keep its DOM-coupled version (it needs
     DOM span injection that `TasmeeMatcher` deliberately doesn't do) or be refactored to
     wrap `TasmeeMatcher` internally and keep only the DOM-rendering half as
     engine-specific code. Prefer the latter if time allows — it collapses two copies of
     the same tajweed/Levenshtein logic into one, tested once.
   - Net result: **one** matching algorithm, tested once (build on the existing 20 Node
     tests), consumed by all four session surfaces.
2. **Normalize the extra-word (insertion) taxonomy end-to-end.** `TasmeeMatcher` already
   emits `{type:'extra'}` mistakes (`:247-250`) that `TasmeeStore.addMistakes` already knows
   how to store and `tasmee-dashboard.js`'s "تصنيف الأخطاء" bars are already built to
   display — once Phase 0 point 3 and this point are done, that dashboard panel goes from
   *permanently showing 0/0/0* to actually working, with no dashboard-side code changes
   needed at all.
3. **Unify Arabic normalization to one function.** There are currently five independent
   normalizer implementations (`TasmeeEngine._normArabic`, `TasmeeMatcher.normArabic`,
   `tasmee-pro-v2.js._v2Norm`, `tasmee-review.js`'s inline version, and
   `tarteel-worker.js`'s `normalizeArabic`) with *slightly* different diacritic/waqf regexes.
   Even if the worker's copy must stay separate for bundling reasons (it's an isolated
   Worker module fetching its own dependencies), the four page-side copies should collapse
   into one shared export.

### Phase 2 — Real offline word-level checking (the hard, novel part)

This is a research spike, not a guaranteed deliverable — scope and timebox it as one.

1. **Investigate CTC forced alignment instead of whole-verse matching.** The FastConformer
   CTC model already produces per-timestep logits (`tarteel-worker.js:283-288`); a forced
   alignment against the *known expected text* (not a free decode against all 6,236
   verses) could in principle recover approximate word timing/confidence — this is
   architecturally closer to what real word-level tools do, and doesn't require a new
   model, just a different decode strategy against the *same* ONNX output. The reference
   project's own `experiments/ctc-alignment/` (mentioned in `docs/offline tarteel.md:265`)
   is exactly this approach and reportedly reached "81%" on their benchmark as a strong
   baseline — worth prototyping directly against that experiment's method rather than
   starting from zero.
2. **Shrink the matching problem before trying to solve it generally.** Today
   `matchVerse()` searches all 6,236 verses on every call. In every actual live session,
   the *expected* ayah range is already known (the user opened a specific page/ayah) — so
   even without forced alignment, restricting the streaming match window to "the current
   ayah ± a few words" instead of the whole Quran would let a much cheaper/faster
   comparison run every tick, freeing budget for a real per-word approach.
3. **Decide, explicitly, whether cloud Web Speech stays in the product.** The app markets
   itself as offline-first everywhere else; Tasmee's best matching quality today depends on
   sending audio to Google's servers. Two honest paths forward: (a) accept and disclose
   this clearly in the privacy policy (already added, see the earlier PR work) and treat
   Web Speech as the "high accuracy, needs internet" mode, with ONNX as the "offline,
   lower accuracy" mode — a real, honest tradeoff toggle for the user; or (b) invest fully
   in closing the ONNX gap so offline is never a second-class experience. This is a product
   decision, not an engineering one — flagged in Open Questions below.
4. **If (b): budget for model iteration**, not just integration. The reference repo's own
   `EXPERIMENTS.md`/`REPORT.md` document ~20 approaches tried and their tradeoffs; closing
   the streaming recall/precision gap (currently ~88%/~70%) is the reference project's
   *own* stated unsolved problem, not something this app's integration layer can fix by
   itself.

### Phase 3 — Bring every surface up to Pro-v2's visual bar

1. Port `css/tasmee-pro-v2.css`'s live-recitation visual language (halo/breathe/word-in/
   marker-pop/live-transcript-strip) to `quran-text.html` and `tasmee-review.html`'s mic
   experience — today both are a bare pulsing dot with no amplitude/waveform feedback.
2. Add real color-coded word highlighting to `tasmee-review.html` (it currently has none
   — only an end-of-session toast), using the now-unified matcher from Phase 1.
3. Unify the three different results-modal designs (`quran-text.html`'s score ring,
   `tasmee-review.html`'s blurred overlay card, and whatever Pro v2 ends up showing once
   it's wired to real mistake data) into one shared component/partial.
4. Full i18n coverage: add `data-i18n`/`js/i18n.js` to `quran-text.html` and
   `tasmee-review.html`'s Tasmee strings (currently 0% on both), matching the 5-locale
   pattern already proven on `tasmee-dashboard.html`.
5. Consistent, correct mic-permission/unsupported-browser UX across all four surfaces
   (single shared capability-check + error-messaging helper instead of three divergent
   implementations).

### Phase 4 — Tarteel-parity features on top of the unified base

Once Phase 0-3 land, these become straightforward additions on a single, well-tested
matching+storage foundation instead of needing to be built four times:

1. **Hesitation detection** — track wall-clock gaps between consecutive word matches;
   flag unusually long pauses as a distinct visual/analytics signal (Tarteel-style
   "you paused here" markers). Needs timing hooks added to the unified matcher's
   `onWord`/`feedTranscript` callback — a moderate, well-scoped addition once there's one
   matcher to add it to instead of five.
2. **Repeat-word detection** — the current pointer-only-advances-forward model can't tell
   "recited again for emphasis" from "recited a different, later occurrence of the same
   word." Needs either a short lookback window that tolerates re-matching the
   immediately-prior 1-2 words without treating it as a jump, or explicit UI affordance
   (a "repeat" button) rather than trying to infer it acoustically.
3. **Teacher-mode session summary** — a shareable/exportable per-session report (score,
   mistake list, weak-word trend) building directly on `TasmeeStore.aggregate()`, which
   already computes everything needed; this is nearly free once Phase 0's persistence
   wiring lands everywhere.
4. **Voice search as a first-class, discoverable entry point** — the underlying capability
   (whole-clip verse ID via `matchVerse`) already exists and works well for this exact use
   case (unlike live mistake-detection, coarse whole-verse ID is exactly what this
   function is good at); today it's buried inside the "Tarteel sheet." Promote it to a
   clearly labeled "🎙️ Find this verse" action from the main search UI.
5. **Weak-word drilling mode** — once the mistake taxonomy actually populates (Phase 0/1),
   add a "practice your weak words" mode that pulls the dashboard's existing top-10
   `weakWords` list and builds a focused mini-session from it.

### Phase 5 — Stretch / moonshot (flag, don't commit to, in this plan)

- **Acoustic tajweed detection** (madd length, ghunna/nasalization duration, qalqalah) —
  this is a fundamentally different ML problem from word-matching (needs phoneme/acoustic
  feature modeling, not text-level matching) and was explicitly marked out-of-scope in
  the prior `docs/v4-3-plan.md:29` for good reason — it likely needs a purpose-trained
  model, not something achievable by extending the current pipeline.
- **Pronunciation scoring** — same category of problem as above.
- **Cloud sync/backup of Tasmee history** — ties directly into the general
  backup/restore feature already scoped as a separate item (H6) in the broader repo audit;
  don't build a Tasmee-specific sync layer in isolation from that.
- **Reciter-style comparison / gamified leaderboards** — genuinely out of scope for an
  offline-first, no-account app unless the account/sync question above is resolved first.

---

## 5. Concrete file-level task list for Phase 0/1

For whoever picks this up first, the exact edits, in dependency order:

1. `js/tarteel-worker.js:300-324` — `recognizeStream()`: drop the `matchVerse()` call
   (or gate it behind a message flag the caller never sets); post `{type:'stream_result',
   transcript}` only.
2. `js/tasmee-store.ts`/`.js` — no schema changes needed; already correct.
3. `pages/quran-text.html` — add `<script src="../js/tasmee-store.js"></script>`; in the
   `onSessionEnd`/session-completion handler, call `TasmeeStore.addSession(...)` and
   `TasmeeStore.addMistakes(...)` using the engine's final `ScoreSummary` and per-word
   `state` list.
4. `js/quran/tasmee-pro-v2.js` — same: add a `TasmeeStore.addSession`/`addMistakes` call
   in `closeTasmeePro()`/the page-complete path (`_v2MarkExpected`'s `done` branch,
   `:272-275`), converting `_v2.errors`/masked-word states into the same session/mistake
   shape the store expects.
5. `js/quran/tasmee-dashboard.js` — replace `openDB`/`getAll`/`aggregate` (`:5-84`) with
   calls into the (now-shared-import) `TasmeeStore` module; delete the duplicated schema
   code.
6. `js/quran/tasmee-review.js` — same replacement for its store access (`:9-77`), keep the
   SM-2 functions (`:156-198`) but have them read/write through `TasmeeStore.getRevision`/
   `putRevision` instead of a private `indexedDB.open`.
7. `js/quran/tasmee-review.js:696-698` — fix the `IndexedDB`-vs-`SpeechRecognition`
   capability-check mismatch and the "التلمييع" typo.
8. `js/tasmee-matcher.ts`/`.js` — no logic changes needed to *start* using it; write the
   integration call sites in `tasmee-pro-v2.js` and `tasmee-review.js` per Phase 1 above.
9. Add `js/tasmee-matcher.js` to whatever pages now actually load it (it's precached by
   `sw.js` already per the earlier PWA audit — just needs a `<script>` tag where it's
   consumed).
10. Re-run/extend `tests/tasmee-v2.spec.js` (already tests `_tpHandleStreamResult`
    directly) to cover the new unified call path once `tasmee-pro-v2.js` is refactored to
    use `TasmeeMatcher`.

---

## 6. Risks & Constraints

- **Model size/bandwidth.** The 131MB ONNX model is fetched from a remote R2 URL with no
  local fallback shipped in the repo (`models/` doesn't exist on disk) — any Phase 2 work
  inherits this download cost. Confirm this is acceptable for the target audience's
  connectivity before investing further in the ONNX path.
- **Privacy/offline-first tension.** `TasmeeEngine`'s best matching quality depends on the
  Web Speech API, which is a cloud service on Chrome/Edge (Google's servers do the STT).
  This directly conflicts with the app's offline-first positioning elsewhere and should be
  disclosed in the privacy policy alongside the existing location/push disclosures.
- **Browser support matrix.** `SpeechRecognition` is Chromium-only in practice (no
  Firefox, inconsistent Safari/iOS). The ONNX path is the only cross-browser option — a
  strong argument for prioritizing Phase 2 despite its difficulty, if broad browser
  support matters more than short-term accuracy.
- **Performance on low-end devices.** Streaming ONNX inference every 1.5s plus a 6,236-
  verse Levenshtein scan (until Phase 0 fixes it) is real CPU load on a background
  thread; test on genuinely low-end Android hardware, not just development machines.
- **Test coverage is currently ONNX/stream-result-shaped, not matcher-shaped.**
  `tests/tasmee-v2.spec.js` tests `_tpHandleStreamResult` — once that function is refactored
  to delegate to `TasmeeMatcher`, make sure the *matcher's* own Node-level test suite
  (referenced as "20 Node tests" in `docs/v4-3-plan.md:4` — locate/verify these still
  exist and pass) becomes the primary regression guard, with the Playwright test
  confirming the wiring rather than re-testing the algorithm.

---

## 7. Success Metrics

| Metric | Today | Phase 0/1 target | Phase 2+ target |
|---|---|---|---|
| Sessions persisted / sessions actually recited | ~25% (1 of 4 surfaces) | 100% | 100% |
| Matching algorithms in production | 5 (4 distinct qualities) | 1 shared | 1 shared |
| Dashboard "mistake type" panel accuracy | Always 0/0/0 (broken) | Reflects real data | Reflects real data |
| Offline word-level mistake detection | None | None (unchanged — Phase 2 scope) | Prototype accuracy vs. Web Speech baseline, measured on the reference project's own benchmark corpus methodology |
| i18n coverage across Tasmee surfaces | 1 of 4 pages | 4 of 4 pages | 4 of 4 pages |
| Wasted CPU: full-corpus scans per streaming tick | 1 per 1.5s (thrown away) | 0 | 0 |

---

## 8. Open Questions for you (product decisions, not engineering ones)

1. **Cloud vs. offline for the primary "checks your recitation" experience** — keep Web
   Speech as the high-accuracy default (with clear disclosure it's cloud-based), keep ONNX
   as an explicit "offline mode" with honestly-lower accuracy, or commit real time to
   closing the ONNX gap (Phase 2) before shipping anything else? This changes the whole
   roadmap's center of gravity.
2. **Timebox for the Phase 2 research spike** — how much time/uncertainty is acceptable
   before deciding whether real offline word-level checking is achievable at all with the
   current model, versus needing a different model entirely?
3. **Is acoustic tajweed/pronunciation scoring (Phase 5) an actual goal for this app**, or
   is "text-level mistake detection done well and fully offline-consistent" the real bar?
   This determines whether Phase 5 is worth scoping in more detail at all or should stay a
   someday-maybe note.
4. **Should Tasmee history be part of the general backup/restore feature (H6, already
   scoped separately)**, or does it need its own export format given the richer schema
   (per-word mistakes, revision scheduling)?

---

*This plan is deliberately sequenced so that Phase 0 alone — a few days of plumbing, zero
new UI, zero new models — turns "three of four ways to practice Tasmee silently throw
away your data" into "every session counts," and fixes a real, verified performance bug.
That's shippable independently of any decision about Phase 2's much harder research
question.*
