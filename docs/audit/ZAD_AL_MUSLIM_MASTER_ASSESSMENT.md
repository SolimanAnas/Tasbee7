# Zad Al-Muslim — Master Assessment

November 2026. Synthesis of a six-phase, read-only audit. **No application code was changed to
produce these reports, and none of the recommendations has been implemented.**

| Phase | Report |
|---|---|
| 1 | [Repository audit](ZAD_REPOSITORY_AUDIT.md) |
| 2 | [UI/UX audit](ZAD_UX_AUDIT.md) |
| 3 | [Security & performance audit](ZAD_SECURITY_PERFORMANCE_AUDIT.md) |
| 4 | [Content quality audit](ZAD_CONTENT_QUALITY_AUDIT.md) |
| 5 | [Product roadmap](ZAD_PRODUCT_ROADMAP.md) |
| 6 | [Modernization plan](ZAD_MODERNIZATION_PLAN.md) |

**Baseline:** branch `ccr-4dafda5f-ubdbgo` (main plus the unmerged offline work).
**Evidence:** code reading, `npm audit`, 26 screens driven in Chromium at phone size in four
passes, and a code-point comparison of the Quran text against a published edition.
**Limits:** no real-device testing, no screen-reader testing, no probing of live services, and no
judgement of religious authenticity — those are stated where they matter.

---

## 1. Executive summary

Zad Al-Muslim is a broad, genuinely useful Islamic companion built as plain static files: a
five-variant mushaf with word highlighting and four tafsir books, a text mushaf, a 250-reciter
audio player, radio, adhkar, Hisn al-Muslim, fifteen hadith collections, a tasbeeh, Qibla,
prayer-time notifications, speech-checked memorisation, a private steadfastness tracker and an
ayah video maker — free, without ads, accounts or tracking, in five interface languages.

Its foundations are better than its surface suggests. The Quran data is complete and matches a
published Uthmani edition exactly. Prayer times and Qibla are computed on the device. There are
no runtime dependencies, there is a real offline layer, and CI guards the things that most often
break.

Its problems are those of an app that grew feature by feature:

1. **The text mushaf does not use the verified local text.** It assembles each page from two
   third-party APIs at read time and inserts the result as HTML. For this product that is the most
   important thing to fix.
2. **It looks like four different apps**, and several screens ignore the chosen theme.
3. **A few screens are extremely heavy** — the hadith page downloads 47.6 MB on open.
4. **The repository publishes ~830 MB of files no screen uses** and is at the hosting limit.
5. **Most code lives inline in HTML**, which blocks reuse, linting and a security policy.

None of this needs a rewrite. The recommended path is: secure the integrity of the text, unify
the design through shared tokens and components, cut the weight, then build the features that the
existing data already makes possible.

**No critical security issue was found.** There are no credentials in the repository and no user
accounts to compromise.

## 2. Maturity assessment

| Dimension | Level | Basis |
|---|:-:|---|
| Feature breadth | **Strong** | 24 reachable screens covering reading, listening, memorising, remembrance, reference and tools |
| Content data integrity (Quran) | **Strong** | 6,236 / 6,236 ayahs identical to reference; page and surah indexes consistent |
| Content sourcing (adhkar, hadith) | **Fair** | Sources present almost everywhere; gradings uneven; 379 empty hadith records; needs scholar review |
| Privacy | **Strong** | No analytics, coarse local location, minimal server data |
| Security | **Fair** | Small surface and a careful push worker; no CSP, unescaped remote text in three places |
| Offline | **Good** | Precache, download-all, range audio; text mushaf and search still online-only |
| Performance | **Uneven** | Most screens 0.3–1.4 MB; three outliers of 9–48 MB |
| Visual consistency | **Weak** | Four design families; theme not global |
| Accessibility | **Weak** | Unlabelled controls, small targets, missing structure |
| Internationalisation | **Fair** | Interface keys complete; six screens and most content untranslated |
| Code structure | **Fair** | Newer modules are clean; ~13,000 lines of inline script remain |
| Testing and CI | **Good** | 367 Playwright cases, guards for precache, references and translations |
| Release and operations | **Weak** | Manual versioning, no staging, no error visibility, push dispatcher will not scale |

Overall: **a feature-complete, trustworthy-at-the-core application at late-beta engineering
maturity.** The distance to production grade is consolidation, not invention.

## 3. Architecture and technology

A multi-page static PWA on GitHub Pages (also wrapped for Google Play), vanilla JavaScript with
shared globals, `localStorage`/IndexedDB/Cache Storage for state, two Cloudflare Workers (push
scheduling, a radio CORS proxy) and no content backend. The Vite build runs in CI but is not what
is deployed.

**Keep:** static files, zero runtime dependencies, local computation, the service-worker design,
the CI guards, the shared "book" engine.
**Change:** inline code, per-page UI re-implementations, hand-maintained release metadata, the
dependence of sacred text on external APIs, the per-minute full scan in the push worker.

Details: repository audit §3, §10–§12.

## 4. Feature inventory

Mushaf (5 image variants + text view), text mushaf, tafsir (Sa'di, Baghawi, Qurtubi, Ibn Kathir),
search, bookmarks, tasmee with an on-device speech model, memorisation dashboard and spaced review,
takrar, surah audio (250+ reciters) with continuous playback and download, 173 radio stations,
adhkar (morning, evening, ruqyah, after prayer, sleep) with counters, sources and virtues, Hisn
al-Muslim, Bustan ad-Du'a, An-Nawawi's Forty, Forty Qudsi, a 15-collection hadith library, masbaha
with custom dhikr and statistics, Thabat journeys with a Quran wird and PIN, Qibla, prayer times
with push notifications, Hijri date, weekly statistics, share cards, ayah video maker, offline
download, five interface languages, three themes.

Absent: accounts, sync, backup, Quran translations, Hijri calendar, reading plans outside Thabat,
global search.

## 5. UI/UX

Individual screens are often good — the adhkar reader, the audio player, the masbaha and the book
pages in particular. The whole is inconsistent: four visual families, three theme-control
placements, differing headers. Measured issues: tap targets under 40 px on the densest screens,
unlabelled icon buttons, text down to 9.75 px, six screens untranslated, heavy use of frosted
glass.

The requested direction — deep navy, ivory, little gold, restraint — fits: the existing dark theme
is already navy. It should be reached by introducing shared tokens and solid surfaces and
migrating screen families one at a time, leaving the mushaf pages and their highlighting exactly
as they are. Details and a ranked list: UX audit §4–§5.

## 6. Security and performance

| Severity | Findings |
|---|---|
| Critical | None |
| High | Remote Quran text rendered as HTML and cached (H-1) · 47.6 MB hadith page (H-2) · push dispatcher scaling (H-3) · published site size (H-4) |
| Medium | No CSP / inline code · unescaped remote text in search and tafsir · CDN scripts without integrity · indefinite cache staleness · `localStorage` as a page cache · page weight · accessibility · no rate limit on push subscribe |
| Low | Dev-tool advisories, outdated privacy text, production logging, tracked test artefacts, manual release metadata, and similar |

Full evidence and remediation: security & performance audit.

## 7. Islamic content integrity

- **Quran text: verified.** Complete, correctly ordered, identical to the reference edition; one
  stray byte-order mark to remove; provenance to be recorded and protected by a checksum gate.
- **Risk is in presentation, not storage.** The text mushaf bypasses the verified file, pairs text
  to ayah numbers by array position across two APIs, and applies regex transformations at display
  time (content audit C-3 to C-5).
- **Indexing: verified.** All 6,236 ayahs mapped to pages 1–604; surah start pages correct.
- **Adhkar: sourced, not verified.** 120 of 121 items carry a source and all carry a virtue note.
- **Hadith: mixed.** Six books with gradings and named graders; five without, currently shown in
  a positive state; 379 empty records.
- **Tafsir:** four complete-looking books with 245 empty entries and two missing ayahs in one.
- **Needs a qualified reviewer:** gradings, virtue statements, the ruqyah selection, Hijri-date
  policy and default prayer methods (content audit §9).

## 8. Major opportunities

1. **Make reading the Quran fully offline and fully under the project's control** — the data is
   already in the repository.
2. **A home screen that knows the time of day and what the user was doing.**
3. **A daily adhkar routine and a khatma planner** built from pieces that already exist.
4. **Backup and restore** — protects users' progress without accounts.
5. **Translations** for the four non-Arabic audiences the interface already addresses.
6. **Ramadan mode and a Hijri calendar** — the strongest seasonal reasons to install.
7. **Memorisation**: tasmee with an on-device speech model is rare; a hifz map on top of it would
   be distinctive.

## 9. Prioritized roadmap

| Priority | Theme | Headline tasks |
|---|---|---|
| **P0** | Integrity and safety | Text mushaf from local data · escape remote text · offline tafsir · Quran checksum gate · content-presentation fixes · repository size · push reliability guard |
| **P1** | Core UX and structure | Tokens and navy/ivory theme · shared header/sheet/toast · touch targets and labels · personal home · language completeness · first-run flow · inline-code extraction · retire dead pages |
| **P2** | Performance and reliability | Hadith on demand · generated precache and version · lighter mushaf start-up · cache policy · vendored CDN + CSP · push redesign · audio link monitor · opt-in diagnostics |
| **P3** | Features | Offline search · adhkar routine · backup · offline-aware audio · khatma plans · Hijri calendar · Ramadan mode · notes and collections · translations · accessibility mode |
| **P4** | Advanced | Unified search · memorisation map · topic index and optional on-device semantic retrieval · word-level follow-along · optional encrypted sync · verified lessons |

Every task with files, dependencies, complexity, acceptance criteria and tests: modernization plan.

## 10. Recommended target architecture

The same kind of application, organised:

```
index.html, pages/*.html      markup only — no inline script or style
css/tokens.css                colours, type, spacing, radius (ivory / navy)
css/ui.css                    shared components
js/ui/                        header, sheet, toast, dialog, states  (dependency-free)
js/core/                      theme, i18n, storage registry, prayer service, dom-safe
js/quran/                     reader modules + quran-data.js (single source of Quran text)
js/features/                  one module per screen
data/                         verified text with checksum; prebuilt search indexes
sw.js                         generated precache list and content-hash version
server/                       one push worker (time-bucketed), one stream proxy
```

- Still static files, still no framework, still no runtime dependency.
- **One source of Quran text**, protected by a CI integrity gate.
- Heavy content split so a screen loads only what it shows.
- A storage registry so backup, restore and "factory reset" know every key.
- A host-restricting CSP once inline code is gone.
- Marketing assets and store screenshots live outside the published site.

## 11. Implementation sequence

1. P0 small fixes (escape, offline tafsir, wording, ungraded display) → Quran integrity gate →
   text mushaf on local data. Owner decisions on repository clean-up in parallel.
2. Accessibility of controls and first-run flow (no design decisions needed).
3. Palette approval on two sample screens → tokens → migrate screen families, extracting inline
   code from each page as it is touched; hadith on-demand loading and mushaf start-up in parallel.
4. Release mechanics, cache policy, CSP stage 1, push redesign; personal home; language work.
5. Features in dependency order, with the khatma planner, Hijri calendar and Ramadan mode stable
   a month before Ramadan.
6. Advanced tier.

## 12. Testing and release strategy

- **Keep and extend the existing suite**: add the offline spec to CI, a transfer-size budget per
  screen, the accessibility scan used in this audit, a contrast check, and the Quran checksum gate.
- **Quran formatter test**: every ayah passes through any display transformation with its letters
  and marks preserved.
- **Mock external APIs** in tests so results do not depend on third parties.
- **Real devices before each release**: one Android phone, one iPhone — install, go offline, read,
  listen, receive a notification.
- **Preview deployments** for pull requests (a second Pages environment or any static preview
  host) so changes are seen before `main`.
- **Small releases**, each with a version bump and a changelog entry; content changes name their
  reviewer.
- **Rollback**: because the app is static, reverting the commit and bumping the version is a
  complete rollback — document it.

---

## Professional verdict

**What is already good?**
The breadth and usefulness of the app; the integrity of the stored Quran text and its indexes;
local prayer times and Qibla; the privacy stance; having no runtime dependencies; the offline
layer; the newer book pages and Thabat as engineering and as design; the tasmee feature; the CI
guards.

**What must be fixed immediately?**
The text mushaf's reliance on unverified remote text inserted as HTML; unescaped remote text in
search and tafsir; tafsir failing offline; ungraded hadith shown as authenticated; the mistaken
end-of-mushaf message; the repository size; and a check on the push server's limits.

**What should be redesigned?**
The visual system as a whole (one set of tokens, navy and ivory, solid surfaces), the shared
chrome (header, sheets, toasts), the home screen, the hadith library's loading model, the
first-run experience, and the release mechanics.

**What should be added?**
Offline text mushaf and search, a time-aware home, a daily adhkar routine, backup and restore,
khatma plans, a Hijri calendar with adjustment, Ramadan mode, translations, ayah notes, and an
accessibility mode.

**What should NOT be changed?**
- The mushaf **highlight settings** and the mushaf **image sizes** (owner instruction).
- The Quranic text, its diacritics, order and references — except by regeneration from a named
  source with full comparison.
- The static, dependency-free architecture.
- Local computation of prayer times and Qibla.
- The no-accounts, no-ads, no-tracking model.
- The Arabic typography choices (Amiri and the Uthmani fonts for sacred text).
- The book-page engine and Thabat's tone and copy.

**What would make Zad Al-Muslim stand out?**
Not more features than its competitors — it already has more than most. It would stand out by
being the Islamic app that is **completely trustworthy and completely yours**: every word of the
Quran from a verified, checksummed source; every dhikr and hadith with its source and grading
visible; everything working with no connection; nothing collected, nothing sold, your progress
exportable as a file you own; and one calm, consistent interface. Add its rare on-device
recitation checking with a memorisation map, and it offers something the large commercial apps,
built around accounts and engagement, are not positioned to match.
