# Zad Al-Muslim — Functionality & UI/UX Audit

Phase 2 of the November 2026 audit. Read-only.

**Method.** All 26 reachable screens were opened in Chromium at a 390 × 844 phone viewport,
touch enabled, in four passes: light theme, dark theme, first run (empty storage) and English.
Each pass recorded a screenshot plus measurements (horizontal overflow, tap-target sizes, text
sizes, fonts, landmarks, language/direction attributes, console errors, transfer size). Findings
below are from those runs unless marked **Assumption**.

**Not tested:** real iOS Safari, real Android devices, screen readers, tablets and desktop
layouts. Anything about those is an inference from the code.

**Owner constraint:** the mushaf highlight settings and the mushaf image sizes are not to be
changed. No recommendation here touches them.

Impact and complexity use **H / M / L** and **S / M / L**.

---

## 1. Overall picture

The app is functionally rich and most individual screens are well made. The weakness is not any
one screen, it is that **the app is four visual products under one icon**:

| Family | Screens | Look |
|---|---|---|
| **A. Sky glass** | home, audio, radio, azkar, takrar, video-maker, notifications, howto, about, privacy | Light blue gradient, frosted cards, green accent |
| **B. Green book** | hisn, duaa, nawawi, qudsi, thabat | Cream paper, deep green hero, gold accents, own three-dot theme switch |
| **C. Paper library** | hadith, hadith-viewer, salah | Cream/brown manuscript styling |
| **D. Always dark** | masbaha, qibla, sleeping, tasmee-dashboard, tasmee-review | Navy, ignore the light theme |

A user moving home → hisn → masbaha → hadith sees four different headers, four button styles,
three places for the theme control and two accent colours.

Measured across the 26 screens:

- **No horizontal overflow anywhere** at 390 px. Good.
- **Tap targets under 40 px are common**: 17 of 22 visible controls on the mushaf toolbar, 18 of
  22 on takrar, 13 of 15 on the text mushaf, 9 of 15 on audio and on each book page.
- **Text under 12 px** appears on 15 screens; the smallest is 9.75 px on the home prayer card.
- **Semantic structure is thin**: 13 screens have no `<h1>`, 12 have no landmark element, and
  most icon buttons have no accessible name (mushaf: 80 buttons, 5 labelled; text mushaf: 32
  buttons, none labelled; masbaha: 12, none).
- **186 `backdrop-filter` declarations.** Frosted glass is the costliest effect on low-end
  Android GPUs and is used as the default surface in family A.

### The requested design direction

The brief asks for deep navy and sophisticated blues, ivory supporting colours, little gold,
elegant Arabic type, restraint. Measured against the current app:

- The **existing dark theme of family A is already navy** and is the closest thing in the app to
  the target. It is a foundation, not a blank page.
- Family A's light theme (bright sky gradient, saturated green, heavy glass) is the furthest from
  it.
- Family B is the best *crafted* family, but its identity is green and gold — exactly what the
  brief wants less of.
- Arabic typography is already a strength: Amiri for sacred text, Tajawal for interface, both
  bundled.

So the direction is a **rebrand of tokens, not a rebuild of screens**. Section 4 gives the path.

---

## 2. Cross-cutting findings

| # | Finding | Evidence | Impact | Cx |
|---|---|---|:-:|:-:|
| X1 | Four visual systems, no shared tokens or components | Section 1; each page defines its own `:root` palette inline | H | L |
| X2 | Theme does not follow the user everywhere: masbaha, qibla, sleeping and both tasmee pages are dark in light mode; the two mushaf readers have a separate theme setting | `data-theme` is absent or fixed on those pages | H | M |
| X3 | Theme control lives in three different places (header icon, three coloured dots, settings sheet) | Screenshots | M | S |
| X4 | Header layout differs per page: home button left or right, title centred or trailing, 2–6 icons | Screenshots | M | M |
| X5 | Small tap targets on the densest screens | Measurements above | H | M |
| X6 | Icon buttons without accessible names; many clickable `<div>`s (40 on home, 33 on mushaf) are not keyboard- or screen-reader-reachable | Static scan | H | M |
| X7 | English/Turkish/Urdu/Kurdish users get a translated shell around untranslated content: the mushaf toolbars, the masbaha target label, `hadith-viewer`, `salah`, `sleeping`, `tasmee-review` and `video` stay Arabic and RTL | English pass: 6 pages report `lang="ar"` | H | M |
| X8 | Four book pages keep `dir="rtl"` in English, so English paragraphs are right-aligned with punctuation on the wrong side | `hisn`, `duaa`, `nawawi`, `qudsi`, `thabat` report `lang=en, dir=rtl` | M | S |
| X9 | 26 blocking `alert()` / 6 `confirm()` dialogs, Arabic-only | Static scan | M | S |
| X10 | Loading states are plain text ("جاري التحميل…"); empty and error states are inconsistent between pages | Code review | M | M |
| X11 | Heavy first actions with no size warning: opening the hadith page downloads 47.6 MB; the mushaf transfers 9.1 MB; the video maker 16.5 MB | Measured | H | M |
| X12 | Western and Arabic-Indic digits are mixed on one screen (home: "١٤٤٨" beside "--:--"; hisn: "١٣٢" beside "٪٠") | Screenshots | L | S |
| X13 | Reduced-motion is respected in only some stylesheets (21 rules for ~40 animated screens) | Static scan | L | S |
| X14 | No search across the app; each module has its own search with different behaviour | Review | M | L |

---

## 3. Screen by screen

### 3.1 Home (`index.html`)

What works: clear hierarchy, the mushaf as the hero action, prayer card on top, bottom bar.

| Improvement | Impact | Cx |
|---|:-:|:-:|
| First run shows the language sheet over the page, then an empty prayer card with "--:--" and a small "tap to set location" line. Make the empty card itself the call to action (one button, one sentence) | H | S |
| The prayer strip shows six tiles at ~10 px with times hidden until location is set; once set, mark the next prayer and show a countdown as the largest element | H | S |
| The grid mixes daily actions (adhkar) with rarely used tools at equal weight. Order by use: "continue reading" (last page), today's adhkar by time of day, then the rest | H | M |
| Add a "continue" row: last mushaf page, last audio track, today's wird. The data already exists in `localStorage` | H | S |
| Bottom bar has language as a primary tab; it is a once-per-install choice. Move it into settings and give the slot to search or the mushaf | M | S |
| 40 clickable `<div>`s; convert cards to `<a>`/`<button>` | M | S |

### 3.2 Mushaf — page images (`pages/quran.html`)

The strongest screen: a faithful page, word highlighting, variants, tafsir, tasmee.
*Highlight behaviour and image sizing are excluded from change.*

| Improvement | Impact | Cx |
|---|:-:|:-:|
| First open immediately shows a "download the mushaf (65–70 MB)" modal before the user has seen a page. Show the page first; offer the download after a few page turns or from settings | H | S |
| Toolbar icons are ~30 px and unlabeled; five tools sit in one row with no text. Enlarge hit areas (not the icons) to 44 px and add `aria-label`s | H | S |
| Tafsir sheet fails without a connection although the tafsir book is local (see repository audit 3.3) | H | S |
| Recitation needs a connection; say so in the player instead of a late toast | M | S |
| The reader has its own theme system and ignores the app theme. Keep the paper themes, but default to the one matching the app theme | M | M |
| Settings sheet shows a non-functional "audio cache" block | M | S |
| No translated chrome (surah name, "page", "juz" stay Arabic in other languages) | M | M |
| No reading-progress indicator beyond the page number (juz/hizb progress, khatma) | M | M |

### 3.3 Mushaf — text (`pages/quran-text.html`)

Readable typography and a clean page. Functionally fragile: it needs two external APIs for every
new page (content audit).

| Improvement | Impact | Cx |
|---|:-:|:-:|
| Render from the local, verified `data/quran.json`; make it fully offline | H | M |
| 13 of 15 toolbar controls under 40 px; none labelled | H | S |
| Loading state is a line of text; add a page skeleton | L | S |
| Long-press menus are the only way to reach tafsir/share; add a visible affordance on first use | M | S |

### 3.4 Audio (`pages/audio.html`)

Polished: large artwork, clear transport, good error and buffering states, lock-screen controls.

| Improvement | Impact | Cx |
|---|:-:|:-:|
| The five secondary controls (repeat, download, favourite, shuffle, speed) are unlabeled 20 px glyphs in a row; add labels or a long-press hint, enlarge hit areas | M | S |
| Downloaded tracks are now kept for offline play but nothing in the list shows which ones; add a small "saved" mark and an "available offline" filter | H | M |
| Reciter and surah pickers are two equal cards under the fold on small phones; surface the current surah list directly | M | M |
| A probe for `json/audio-03.json` returns 404 on every load | L | S |

### 3.5 Radio (`pages/radio.html`)

Fits one screen, clear state pill, good reconnect logic. Minor: the station list (173 entries) is
behind one collapsed row — add favourites/recents as chips above it.

### 3.6 Adhkar (`pages/azkar.html`)

The reading card is excellent: large text, virtue under each dhikr, a clear counter.

| Improvement | Impact | Cx |
|---|:-:|:-:|
| Six header icons at ~36 px with no labels | M | S |
| No translation or transliteration shown although the data has an `english` field for every item | H | S |
| `user-scalable=no` is set on this page; pinch zoom is blocked (an accessibility failure), even though A−/A+ buttons exist | M | S |
| The counter ring is far from the thumb on tall phones when text is short; make the whole lower half tappable | M | S |
| `salah.html` and `sleeping.html` are separate, differently styled pages for the same kind of content; fold them into this reader | M | M |

### 3.7 Masbaha (`pages/masbaha.html`)

Focused and calm — close to the target aesthetic already.

| Improvement | Impact | Cx |
|---|:-:|:-:|
| Ignores the light theme | M | S |
| The count area is a ring in the middle; the tap target should be the whole screen below the header | H | S |
| "الهدف: 33" stays Arabic in other languages | L | S |
| Reset and night-mode buttons are small, unlabeled and close to the ring; move reset behind a long press or confirm | M | S |

### 3.8 Book pages (`hisn`, `duaa`, `nawawi`, `qudsi`)

The best-engineered screens: one engine, sources on every item, memorise/favourite/share, audio.

| Improvement | Impact | Cx |
|---|:-:|:-:|
| The green hero takes ~60 % of the first screen and repeats on every visit; collapse it after first use so content starts higher | M | S |
| Counters show "٠ / ١٣٢ (٪٠)" before any use — three empty stat tiles. Hide until non-zero | L | S |
| `dir="rtl"` in non-Arabic languages | M | S |
| Chips row scrolls horizontally with a clipped last chip and no fade hint | L | S |

### 3.9 Hadith library (`hadith.html`, `hadith-viewer.html`)

| Improvement | Impact | Cx |
|---|:-:|:-:|
| `hadith.html` downloads every collection (47.6 MB) on open to enable search. Load nothing until the user searches or picks a book; build a compact search index offline instead | H | M |
| The page title reads "قراءة الكتاب \| زاد المسلم" with "زاد المسلم" repeated beneath — looks like a template slip | L | S |
| `hadith-viewer.html` is not translated and shows full isnad at reading size with the matn only distinguished by colour; offer "matn only" | M | M |
| Muslim has 203 empty records, Nasa'i 86, Tirmidhi 74 (content audit) — the viewer hides them but numbering then jumps | M | M |

### 3.10 Qibla (`pages/qibla.html`)

Clear single action. Always dark; fine for a camera screen, but the intro card should follow the
theme. Explain *why* motion/camera permission is needed before the system prompt.

### 3.11 Notifications (`pages/notifications.html`)

Functionally complete. Visually the weakest of family A in light mode: a purple-to-blue gradient
behind the subtitle makes it unreadable, and the saturated green and blue blocks compete.
Flatten to one surface colour. Also explain the server-side schedule in one line (privacy).

### 3.12 Takrar (`pages/takrar.html`)

Powerful, but it opens as a settings form: reciter, range type, surah, two toggles, speed — then
the player. 18 of 22 controls are under 40 px. Put a sensible default (last used) behind one
"start" action and move the rest to a sheet.

### 3.13 Tasmee dashboard and review

Good information design (streak, accuracy, weekly bars, mistake classes). Always dark with a
purple nebula background unlike anything else in the app; align with the navy system. The review
page is Arabic-only.

### 3.14 Thabat (`pages/thabat.html`)

A distinctive, thoughtful feature with careful copy. Keep. Only: align tokens with the new system
and fix `dir` in LTR languages.

### 3.15 Video maker

Works, and is unusual among Islamic apps. It transfers 16.5 MB on open (all background previews);
lazy-load thumbnails and fetch full backgrounds on selection.

### 3.16 Howto / About / Privacy

Fine. The privacy text is out of date in three details (content audit).

---

## 4. A path to the navy / ivory direction without redrawing every screen

1. **One token file** (`css/tokens.css`): surfaces, text, accent, radius, spacing, elevation, type
   scale — light ("ivory") and dark ("navy") values. Suggested starting points, to be tuned on
   real screens: navy `#0B1730` / `#12213F`, ivory `#F7F3EA` / `#FFFDF8`, a single blue accent
   around `#2F5FBF`, gold kept only for ayah markers and one highlight role.
2. **Replace frosted glass with solid surfaces** and one soft shadow. This is the biggest visual
   step toward "premium and restrained" and also the biggest rendering win.
3. **One header component** (home, title, at most two actions, overflow menu) and **one sheet,
   one toast, one button set**, loaded from shared files.
4. **Migrate family by family**: D (already dark, smallest change) → A → C → B. Family B keeps its
   layout; only its green/gold tokens change.
5. **The mushaf page images stay exactly as they are.** Only the chrome around them changes.

Each step is shippable on its own; none requires a framework.

---

## 5. Ranked improvements

| Rank | Improvement | Impact | Cx |
|---:|---|:-:|:-:|
| 1 | Stop the 47.6 MB download when the hadith page opens | H | M |
| 2 | Shared design tokens + solid surfaces (navy/ivory) | H | L |
| 3 | 44 px hit areas and accessible names on all toolbars | H | M |
| 4 | Text mushaf from local data, fully offline | H | M |
| 5 | Home: "continue" row, next-prayer emphasis, actionable empty state | H | S–M |
| 6 | Theme follows the user on every screen | H | M |
| 7 | Show translation/transliteration for adhkar (data exists) | H | S |
| 8 | Defer the mushaf download modal; fix offline tafsir | H | S |
| 9 | One header, one sheet, one toast | M | M |
| 10 | Finish translating the six untranslated pages; fix `dir` on book pages | M | M |
| 11 | Replace `alert`/`confirm` with the shared sheet | M | S |
| 12 | Merge `salah`/`sleeping` into the adhkar reader | M | M |
| 13 | Offline marks in the audio list | M | M |
| 14 | Re-enable pinch zoom on adhkar; reduced-motion everywhere | M | S |
| 15 | Consistent digits per language | L | S |
