# Tasbee7 — SWOT Analysis & Action Plan (plan2)

> Repo scan: 2026-06-09. Companion to [`plan.md`](plan.md) (the feature roadmap, Phases 1–5).
> `plan.md` tracks *what to build next*; **this doc focuses on production health, technical debt, and risks** uncovered by a full repo scan — the things that determine whether the shipped app actually works and stays maintainable.

---

## Executive Summary

Tasbee7 (زاد المسلم) is a feature-rich, ad-free Islamic PWA: Quran reader (5 mushaf variants, word-level Tasmee' recitation assessment), audio, radio, azkar, hisn, hadith, masbaha, qibla, and prayer notifications. Phases 1–3 of `plan.md` are largely complete (monolith refactor, Vite, TypeScript core, Tasmee' dashboard/review, offline audio cache, local search, SW v27).

The **product breadth is excellent**; the **delivery pipeline is the weak link**. The single most important finding: the deployment model (GitHub Pages from repo root) almost certainly **does not run the TypeScript Tasmee' modules in production**, and the repo carries ~**447 MB** of tracked content with large files triplicated. Fixing the build/deploy gap and the data duplication should precede new features.

---

## SWOT

### 🟢 Strengths

| # | Strength | Evidence |
|---|----------|----------|
| S1 | **Wide, genuinely useful feature set** | 20+ pages: Quran, audio, takrar, radio, masbaha, azkar, hisn, duaa, hadith, qibla, notifications, Tasmee' dashboard + review |
| S2 | **Flagship differentiator — Tasmee'** | Word-level recitation assessment with matcher/engine/store (`js/tasmee-*.ts`), SM-2 spaced repetition, dashboard analytics. Rare in free Quran apps |
| S3 | **Offline-first PWA** | `sw.js` v27: precache app shell, stale-while-revalidate HTML, dedicated `audio-cache-v1`, local search via `quran.json`. Works on iOS/Android |
| S4 | **Cohesive glassmorphism design system** | 4 themes (light/dark/sepia/OLED) via CSS variables, consistent across pages; recently unified sepia to warm-parchment glass |
| S5 | **Modular refactor done** | `quran.html` monolith split into `js/quran/*` modules + `css/quran-v4.css` (per `plan.md` Phase 1) |
| S6 | **Ad-free, no tracking, local-first data** | localStorage/IndexedDB; privacy-respecting — a real trust advantage |
| S7 | **CI exists** | `.github/workflows/playwright.yml` runs sharded Playwright on push/PR |

### 🔴 Weaknesses

| # | Weakness | Evidence / Location | Impact |
|---|----------|---------------------|--------|
| W1 | **TypeScript shipped raw to a static host** | `pages/quran.html` & `pages/quran-text.html` load `<script src="../js/tasmee-engine.ts">` (classic script). The `.ts` files contain real TS syntax (`interface`, type annotations). GitHub Pages serves `.ts` with a non-JS MIME (+`X-Content-Type-Options: nosniff`) → browser blocks/can't parse. **Tasmee' likely broken in production.** | 🔴 Critical — flagship feature dead on live site |
| W2 | **Dev/prod deploy mismatch** | `vite.config.js` builds to `dist/`, but no deploy workflow exists → GitHub Pages serves repo **root** (un-built source). Vite/TS toolchain is effectively dev-only | 🔴 Minification, hashing, TS transpile never reach users |
| W3 | **Repo bloat ~447 MB tracked; data triplicated** | `muslim.json`/`nasai.json`/`tirmidhi.json` exist at **root AND** `assets/hadith/` AND (others in) `json/`. Hadith JSONs duplicated 2–3×; root copies (~24 MB) are dead duplicates | 🟠 Slow clones, hard to maintain, drift risk |
| W4 | **Legacy/duplicate pages & dead code** | `pages/quran2.html`, `pages/azkar2.html`, `pages/hadith-viewer.html`, `pages/salah.html`, `pages/sleeping.html`, `archive/quran.html`, root `server.py`/`server.bat`/`fix_tasmee.py` | 🟠 Confusion, larger surface, stale links |
| W5 | **Third-party media dependency / link rot** | Audio from everyayah.com, mp3quran, qurango.net, archive.org. Recent commits fixed 56 dead radio + 26 dead reciters; `docs/broken-urls.md` tracks rot | 🟠 Features silently break over time |
| W6 | **Thin automated coverage** | One Playwright spec (`tests/pages.spec.js`, link/resource checks). 0 unit tests for the complex Tasmee' matcher/engine. `tests/` is also (contradictorily) listed in `.gitignore` though tracked | 🟠 Regressions in core logic go unnoticed |
| W7 | **Doc drift** | README links `/blob/main/LICENSE` (file is lowercase `license`), lists `pages/404.html` (deleted in `dde763f`), says "Tarteel.js search" though local search shipped, "45 tests" unverified | 🟡 Onboarding friction, broken badge link |
| W8 | **~~Arabic-only UI~~ → largely resolved** | UI i18n now shipped: `js/i18n.js` + 5 locales (ar/en/ckb/tr/ur, 582 keys), RTL auto-switch, 14/22 pages done (see [`translation.md`](translation.md)). Remaining: `quran*.html` + `tasmee-review.html` chrome, and Quran-text translations (O3) | ✅ mostly addressed |
| W9 | **Manual SW asset list** | `STATIC_ASSETS` hand-maintained in `sw.js`; easy to forget a file (already a class of past bugs). `plan.md` 3.3 claims auto-versioning but it's still manual `v27` | 🟡 Offline gaps when assets added |

### 🔵 Opportunities

| # | Opportunity | Rationale |
|---|-------------|-----------|
| O1 | **Proper CI/CD deploy** | A GitHub Actions job that runs `vite build` and deploys `dist/` to Pages fixes W1+W2 at once — TS transpiled, assets hashed/minified, smaller payloads |
| O2 | **Hifz tracker + teacher mode** | Tasmee' data (sessions, mistakes, revisions, mastery) already exists → high-value features at low marginal cost (`plan.md` 5.1/5.2) |
| O3 | **Internationalization** | UI i18n ✅ done (ar/en/ckb/tr/ur). Remaining: finish `quran*.html`/`tasmee-review.html` chrome + add **Quran-text translations** alongside Uthmanic — unlocks a massive global audience; data-driven, no architecture change |
| O4 | **Native app via Capacitor** | Plugin stubs already present (`js/plugins/*`, `js/native-init.js`); reliable background prayer notifications + app-store reach |
| O5 | **Background push notifications** | Cloudflare worker + cron design already drafted (`server/`); finishing it delivers closed-app prayer alerts |
| O6 | **Performance & Lighthouse wins** | Font subsetting, WebP/responsive mushaf images, lazy ONNX (`plan.md` 3.4) → faster first load, better SEO (SEO meta already added) |
| O7 | **Self-host critical audio** | Cache/host a fallback reciter set to blunt third-party link rot (W5) |

### 🟠 Threats

| # | Threat | Rationale |
|---|--------|-----------|
| T1 | **Silent production breakage** | If W1 is real, users hit a dead Tasmee' with no error surfaced; could already be happening unnoticed (no error monitoring) |
| T2 | **External-content decay** | Free CDNs/audio mirrors disappear (already happening). Each loss = a broken feature for all users |
| T3 | **Sustainability / bus factor** | Single maintainer, no monetization; hosting + content upkeep is ongoing volunteer effort. 447 MB repo worsens this |
| T4 | **Quran data integrity = trust** | Any error in mushaf text, ayah boundaries, or hadith authenticity is reputationally severe for a religious app — magnified by lack of automated data validation tests |
| T5 | **Browser API drift** | Web Speech API (Tasmee') support/behavior varies by browser/OS and can change; iOS Safari limitations on speech & background audio |
| T6 | **Storage pressure on device** | Audio cache (200 MB target) + offline mushaf + ONNX can exhaust mobile quota → eviction/instability without active cache budgeting |

---

## Action Plan (prioritized — complements `plan.md`)

### P0 — Production correctness (do first; blocks trust)

1. **Verify & fix the `.ts`-in-production bug (W1/W2).**
   - Confirm on the live site: open `pages/quran.html`, check console for a blocked/parse error on `tasmee-engine.ts`, and confirm Tasmee' actually runs.
   - Fix via **either**:
     - **(A, recommended) CI build + deploy:** add a Pages workflow that runs `npm ci && npm run build` and publishes `dist/`. Resolves W1, W2, and shrinks payloads. Update `sw.js` to reference built (hashed) assets, or generate the asset list at build time.
     - **(B, quick stopgap):** transpile the three `.ts` → `.js` (committed) and update the `<script src>` + `sw.js` references to `.js`. Keeps `.ts` as source of truth only if paired with a build step.
2. **Add lightweight error surfacing** so a future silent break is visible (a global `window.onerror` → non-blocking toast/log; optional opt-in error beacon). Mitigates T1.

### P1 — Repo hygiene & maintainability

3. **De-duplicate data (W3).** Pick one canonical location for hadith JSON (e.g. `assets/hadith/`), delete the root `muslim.json`/`nasai.json`/`tirmidhi.json` and the `json/` duplicates, update references. Saves ~30–40 MB tracked.
4. **Prune legacy pages/scripts (W4).** Audit links, then remove `quran2.html`, `azkar2.html`, `archive/`, and unused root scripts; or move dev-only scripts under `scripts/`.
5. **Right-size binaries.** Compress/relocate `og-image.png` (4 MB), `poster.png`, `splash.png`; consider Git LFS or generating them at build time.
6. **Fix doc drift (W7).** Rename `license`→`LICENSE` (or fix README link), correct page list, update "search" + test-count claims.

### P2 — Resilience & quality

7. **Unit-test the Tasmee' core (W6).** Vitest for `tasmee-matcher.ts` (normalization, fuzzy match) and `tasmee-store.ts` (schema/SM-2). Highest-value tests in the repo.
8. **Add a data-integrity test (T4).** Assert `quran.json` ayah counts per surah match `AYAH_COUNTS`, `QURAN_META` units are monotonic, and reciter/radio URLs return 2xx (scheduled link-rot check → feeds `docs/broken-urls.md`).
9. **Audio-fallback strategy (W5/T2/O7).** On a failed reciter/station URL, auto-fallback to a known-good mirror; surface "source unavailable, switching".
10. **SW asset-list generation (W9).** Generate `STATIC_ASSETS` from the build manifest instead of hand-editing.

### P3 — Growth (after the above; see `plan.md` Phase 5)

11. Finish background push (O5, `server/`), then i18n (O3), Hifz tracker (O2), Capacitor packaging (O4), asset optimization (O6, `plan.md` 3.4).

---

## Priority Matrix

| Priority | Theme | Items | Why now |
|----------|-------|-------|---------|
| **P0** | Production correctness | 1, 2 | Flagship feature may be dead in prod; users see nothing |
| **P1** | Repo hygiene | 3, 4, 5, 6 | 447 MB + duplication block maintainability |
| **P2** | Resilience & tests | 7, 8, 9, 10 | Protect Quran-data trust + core logic from regressions |
| **P3** | Growth | 11 | High-value, but only on a healthy base |

---

## Key Metrics to Move

| Metric | Current (scan) | Target |
|--------|----------------|--------|
| Tasmee' works on live GitHub Pages | ❓ likely **no** (W1) | ✅ verified yes |
| Production assets are built (minified/hashed/TS-transpiled) | No (serves root source) | Yes (deploy `dist/`) |
| Tracked repo size | ~447 MB | <150 MB (de-dupe + LFS/build assets) |
| Duplicate data copies | 2–3× hadith JSON | 1× canonical |
| Unit tests on Tasmee' core | 0 | matcher + store covered |
| Automated data-integrity / link-rot check | None | Scheduled CI job |
| Error visibility in prod | None | Global handler + optional beacon |

---

*Generated from a full repository scan. Pair with `plan.md` for feature sequencing; execute P0 before resuming Phase 4/5 work there.*
