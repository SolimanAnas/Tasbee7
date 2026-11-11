# Zad Al-Muslim — Islamic Product & Content Quality Audit

Phase 4 of the November 2026 audit. Read-only. **No Quranic text, hadith text, diacritic, verse
order or reference was modified.**

## Scope and limits — please read first

This audit checks what software can check: completeness, internal consistency, agreement with a
published digital reference, presence of sources, and how the app handles sacred text between
storage and screen.

It **cannot certify religious authenticity.** Whether a hadith grading is correct, whether a
dhikr's stated virtue is soundly attributed, or whether a tafsir edition is reliable are
questions for a qualified scholar. Items that need that review are listed in section 9.

Three labels are used:

- **Verified** — checked mechanically in this audit; the method is stated.
- **Sourced, not verified** — the app states a source or grading; I confirmed it is present, not
  that it is right.
- **Unsourced** — no source is recorded in the data.

---

## 1. Quran text (`data/quran.json`) — Verified

| Check | Result |
|---|---|
| Ayah count | 6,236 |
| Ayahs per surah | All 114 match the Hafs (Kufan) count |
| Order | Strictly ascending by surah then ayah, no gaps or duplicates |
| Comparison with `api.alquran.cloud` edition `quran-uthmani` (Tanzil-derived Uthmani text, downloaded during this audit) | **6,236 of 6,236 identical, code point for code point**, apart from the item below |
| Stray characters | One U+FEFF (byte-order mark) at the very start of 1:1, in both `text_uthmani` and `text_clean` |
| Convention | The basmala is prefixed to ayah 1 of 112 surahs (all except 1 and 9). Documented in `scripts/build-quran-json.cjs`; consumers strip it where needed |

A second comparison against Tanzil's plain download showed differences only in optional
annotation marks (pause signs, small letters, hamza encoding) because that file was fetched with
default options; it is not evidence of any wording difference. **A final check against a Tanzil
export with matching options, or against the King Fahd Complex text, should be done once by the
owner** so the provenance statement in the app can name an exact source and version.

**Findings**

- **C-1 (Low).** The byte-order mark at 1:1 is not Quranic text. It is invisible but is a real
  character: it can break exact matching of the first word (search, tasmee). The build script's
  comment says it is stripped; the shipped file still contains it. Remove it by regenerating the
  file from the source, then re-run the 6,236-ayah comparison.
- **C-2 (Low).** The build script says the source is the Quran.com API, while the shipped text is
  identical to the alquran.cloud edition. Record the actual source, edition and retrieval date in
  `ATTRIBUTION.md`.

## 2. How Quran text reaches the screen

| Screen | Source of the text | Handling |
|---|---|---|
| Mushaf, image variants | Scanned/typeset page images (5 sets × 604) | Shown as images — the text cannot be altered by code |
| Tasmee, takrar, video maker, thabat | Local `data/quran.json` | Read-only |
| **Text mushaf** (`quran-text.html`) | **Live from `api.quran.com` and `api.alquran.cloud`** | Merged, regex-formatted, cached as HTML |
| Tafsir sheet (ayah quote) | Live from `api.alquran.cloud` (`quran-simple`) | Inserted as HTML |
| Search results | Live from `api.alquran.cloud` (`quran-simple-clean`) | Inserted as HTML |

**Findings**

- **C-3 (High).** The text mushaf shows Quran text that the project has not verified and does not
  control. `pages/quran-text.html:1216-1240` takes verse text from one API and verse numbering
  from another and pairs them **by position in the array** (`qpcAyahs[i]` with `metaAyahs[i]`). If
  the two services ever disagree on what a page contains — a different page break, a paging limit,
  a partial response — text is shown under the wrong ayah number with no error. The result is then
  cached. Recommendation: render from the verified local file and pair by surah:ayah key.
- **C-4 (Medium).** Display-time transformations of Quran text
  (`quran-text.html:1180-1189`): trailing digits and end-of-ayah marks are removed, spaces before
  annotation marks are removed, pause marks are wrapped in a `<span>`, and **the order of a short
  vowel and a following shadda is swapped**. The swap changes code-point order for font rendering,
  not the reading, but it is a modification of the stored sequence made silently on every render.
  It should be documented, covered by a test that proves the visible result is unchanged for all
  6,236 ayahs with the bundled fonts, or removed in favour of a font that needs no reordering.
- **C-5 (Medium).** The basmala is removed from first ayahs with a regular expression that deletes
  everything up to the first occurrence of "الرحيم" (`quran-text.html:1241`). It works for the
  data as served today. It is fragile by construction: it would delete real text if a source ever
  delivered a first ayah without the basmala prefix but containing that word. Replace with an
  exact-prefix check against the known basmala string.

## 3. Mushaf pages, navigation and indexing — Verified

| Check | Result |
|---|---|
| Page-coordinate database (`ayarects`) | 88,246 word rectangles covering all 6,236 ayahs on pages 1–604; every page present |
| Ayah order vs page order | Page number never decreases as ayahs advance |
| Surah start pages | `js/surah-map.js` agrees with the database for all 114 surahs; sampled values match the standard Madinah mushaf (e.g. Al-Baqarah 2, Al-Kahf 293, Ya-Sin 440, Al-Mulk 562, An-Naba 582) |
| Image sets | 604 pages in each of five variants (two folders hold a few extra non-page files) |

Not verified: that every rectangle sits exactly on its word in each of the five image sets (the
coordinates were authored for one layout; other variants reuse or scale them), and that the page
images themselves are complete and unaltered scans of their stated editions. *The highlight
settings and image sizes are excluded from change by the owner.*

- **C-6 (Low).** `js/juz-map.js` is not loaded by any page; juz navigation in the live reader comes
  from elsewhere. Confirm one source of truth for juz/hizb boundaries.
- **C-7 (Low, wording).** The end-of-mushaf message in `js/quran/audio.js:184` and `:264` reads
  «تم اختراق القرآن الكريم» ("the Quran has been breached"). It is almost certainly meant to be
  «تم ختم القرآن الكريم». This is interface text, not Quranic text; it should be corrected.

## 4. Audio

- **Surah recordings:** ~3,000 URLs across 250+ reciters in `json/audio-01.json` and `-02.json`.
  Earlier project notes (`docs/broken-urls.md`, service-worker changelog v84, v125) record repeated
  clean-ups of dead links and of **217 tracks that silently played a different reciter** because
  the host redirects missing files. That class of fault cannot be detected by the app at runtime.
  **Recommendation:** a scheduled link-and-identity check (HEAD request, final URL, content length)
  that reports drift, run weekly in CI.
- **Ayah-by-ayah recitation** in the mushaf is looked up through `api.alquran.cloud` and streamed
  from a host that sends no CORS headers; it cannot be stored for offline use as built.
- **Synchronised highlighting:** the image mushaf highlights the ayah being played (ayah-level
  sync, driven by one audio file per ayah). There is no word-level timing data in the repository.
- **Reciter attribution** is by name only; riwayah (Hafs, Warsh, Qalun…) is present in some track
  titles but not as structured data, so a user cannot filter by it and a Warsh recitation can play
  over a Hafs page. Not an error, but it should be labelled.

## 5. Adhkar and supplications

| Data file | Items | Arabic | Source field | Virtue field | English |
|---|---:|:-:|---|---|:-:|
| `azkar.json` — morning | 31 | ✓ | 31 / 31 | 31 / 31 | 31 |
| `azkar.json` — evening | 30 | ✓ | 30 / 30 | 30 / 30 | 30 |
| `azkar.json` — ruqyah | 34 | ✓ | 33 / 34 (**1 missing**) | 34 / 34 | 34 |
| `salah.json` | 13 | ✓ | 13 / 13 | 13 / 13 | 13 |
| `sleeping-zikr.json` | 13 | ✓ | 13 / 13 | 13 / 13 | 13 |
| `hisn-matn.json` (Hisn al-Muslim) | 132 chapters, 267 adhkar | ✓ | 267 / 267 (author's takhreej) | — | 264 / 267 |
| `duaa-book.json` | 15 chapters | ✓ | per item | — | — |

Status: **Sourced, not verified.** Sources are short attributions ("رواه أبو داود والترمذي");
the service-worker changelog says gradings were added and that weak narrations used for virtues
are labelled as such. I confirmed the fields exist, not their accuracy.

**Findings**

- **C-8 (Medium).** One ruqyah item has no source. Find and add it, or mark it explicitly.
- **C-9 (Medium).** The English text exists for every dhikr but the reader does not show it (UX
  audit 3.6). Non-Arabic users currently get Arabic only.
- **C-10 (Low).** Quranic passages inside adhkar (e.g. Ayat al-Kursi in `azkar.json`) are typed in
  a different orthography from the mushaf text (imla'i spelling with added "أعوذ بالله…" and a
  bracketed reference in the same string). Prefer referencing the ayah (2:255) and rendering it
  from `data/quran.json`, so Quran text has exactly one source in the app.
- **C-11 (Low).** Three unused legacy data files (`assets/hisn_complete.json`,
  `assets/part1…5.json`) hold older copies of the same content. Remove them so there is one
  authoritative copy.

## 6. Hadith library

| Collection | Records | Empty text | With grading | English |
|---|---:|---:|---:|:-:|
| Sahih al-Bukhari | 7,589 | 9 | — (sahih by collection) | — |
| Sahih Muslim | 7,563 | **203** | — (sahih by collection) | — |
| Sunan Abi Dawud | 5,274 | 2 | 5,274 | — |
| Jami` at-Tirmidhi | 3,998 | **74** | 3,954 | — |
| Sunan an-Nasa'i | 5,765 | **86** | 5,758 | — |
| Sunan Ibn Majah | 4,343 | 5 | 4,341 | — |
| Riyad as-Salihin | 1,896 | 0 | — | ✓ |
| Bulugh al-Maram | 1,767 | 0 | — | ✓ |
| Mishkat al-Masabih | 4,428 | 0 | — | ✓ |
| Al-Adab al-Mufrad | 1,326 | 0 | — | ✓ |
| Shama'il Muhammadiyah | 402 | 0 | — | ✓ |
| An-Nawawi's Forty | 42 | 0 | curated page has takhreej | ✓ |
| Forty Qudsi | 40 | 0 | per-hadith grade with the grader named | ✓ |

**Findings**

- **C-12 (Medium).** 379 records across the six books have no text. The viewer hides them, so
  numbering jumps and a reference such as "Muslim 1234" may lead nowhere. Establish whether these
  are gaps in the source dataset or intentional (cross-references), and either fill them from the
  source edition or show a "see hadith N" placeholder.
- **C-13 (Medium).** Five secondary collections (Riyad as-Salihin, Bulugh al-Maram, Mishkat,
  Al-Adab al-Mufrad, Shama'il) carry no grading data. In `hadith-viewer.html` the newer-format
  records are assigned `gradeText: 'غير محدد'` with `isOk: true`
  (`pages/hadith-viewer.html:683-686`) — i.e. *presented as acceptable without a grading*. Several
  of these books knowingly include weak narrations. Show "grading not available" neutrally rather
  than a positive state.
- **C-14 (Low).** The origin and edition of each dataset (numbering scheme, who graded) is not
  recorded in the repository. The grading objects in the six books do name their graders; surface
  that in the UI and document the datasets in `ATTRIBUTION.md`.
- **C-15 (Low).** The changelog (v119) records 75 corrupted characters repaired by hand in the six
  books. Keep the repair script and a checksum of the repaired files so the fix is reproducible
  and auditable.

## 7. Tafsir

| Book | Rows | Ayahs covered | Empty entries |
|---|---:|---:|---:|
| As-Sa'di | 6,236 | 6,236 | 107 |
| Al-Baghawi | 6,236 | 6,236 | 45 |
| Al-Qurtubi | **6,234** | 6,234 | 4 |
| Ibn Kathir | 6,236 | 6,236 | 89 |

- **C-16 (Medium).** Al-Qurtubi is missing two ayahs entirely and 245 entries across the four
  books are empty. Classical tafsirs often comment on several ayahs together, so many "empty"
  entries are probably ayahs explained under a neighbour. Today the reader shows "no tafsir found
  for this ayah". Better: fall back to the nearest preceding ayah's entry and say so.
- **C-17 (Low).** The editions (publisher, verification, whether abridged) are not stated.

## 8. Other content

- **Arabic rendering:** bundled Amiri, Scheherazade and several Uthmani fonts; no reliance on
  system fonts for sacred text. The interface font (Tajawal) lacks some Quranic marks and the
  Arabic-Indic zero, which the project already works around. Good practice; keep sacred text in
  the Quranic fonts only.
- **Honorifics** are spelled out where ligature glyphs were unreliable (changelog v118). Good.
- **Translations:** interface strings exist in five languages with enforced parity (1,237 keys).
  Content translation is partial and uneven: adhkar and several hadith books have English only;
  no content exists in Turkish, Urdu or Kurdish. Six screens are not translated at all. No Quran
  translation is bundled; one (Muhammad Asad, via API) is fetched in the text mushaf's tafsir
  menu, Arabic UI only.
- **Hijri date:** computed with the browser's `islamic` calendar (`index.html:1550-1575`), which is
  arithmetic and can differ by a day from Umm al-Qura and from local moon sighting. There is no
  user adjustment (±1/±2 days). For a date that decides fasting and Eid, add the adjustment and a
  one-line disclaimer.
- **Prayer times:** computed locally with adhan.js. The default method is "UAE/Dubai" for every
  user (`js/prayer-service.js:16`), wherever they are. Choose the default from the user's region
  and show the method in use next to the times. Asr (Shafi'i/Hanafi) is selectable.
- **Qibla:** great-circle bearing with magnetic-declination correction (WMM2025). Sound approach.
- **Bookmarks and progress:** mushaf bookmarks, last page, pages-read-today and a streak are
  stored locally only. Clearing site data or changing phone loses them; there is no export.
- **Thabat content** quotes verses "verbatim from `data/quran.json`" (file header) with hadith and
  duas carrying sources — Sourced, not verified.

## 9. Items that need a qualified reviewer

1. Gradings and virtue statements for all 121 adhkar items (`azkar.json`, `salah.json`,
   `sleeping-zikr.json`), especially those marked as weak-but-used-for-virtues.
2. The ruqyah collection as a whole (selection and attribution).
3. Gradings shown for Abu Dawud, Tirmidhi, Nasa'i and Ibn Majah, and the policy for the five
   ungraded collections.
4. The Forty Qudsi selection (it includes narrations graded weak by the named grader).
5. Tafsir editions and whether abridgement is acceptable for the stated titles.
6. The Hijri-date policy and default prayer-calculation methods per region.
7. Copy in Thabat (repentance guidance) and in the notification texts.

## 10. Offline availability of essential content

| Content | Offline today |
|---|---|
| Mushaf page images | After the in-app mushaf download (65–120 MB per variant), or pages already viewed |
| Quran text for tasmee/takrar | Yes, precached |
| **Text mushaf** | **Only pages previously opened online** |
| Tafsir books | Yes after "download everything" — but the sheet still fails offline (repository audit 3.3) |
| Adhkar, Hisn, duaa, Nawawi, Qudsi | Yes, precached (Nawawi/Qudsi data after first open or download-all) |
| Hadith books | After "download everything" or first open of each book |
| Bundled adhkar audio | After first full play or download-all |
| Surah audio | Tracks the user downloaded |
| Ayah audio, radio, search | No — online only |
| Prayer times, Qibla, masbaha, thabat | Yes |

The two gaps that matter most for an Islamic companion are the text mushaf and Quran search;
both can be closed with data already in the repository.
