# Zad Al-Muslim — Innovation & Feature Roadmap

Phase 5 of the November 2026 audit. Proposals only; nothing here has been built.

## Principles used to choose

1. **Finish before adding.** Several asked-for capabilities already exist and are half-connected
   (offline search code that no page loads, a reading-plan engine inside Thabat, English adhkar
   text that is never shown). Connecting them is cheaper and safer than new features.
2. **Device-first.** The app's promise is "free, no ads, no tracking, works offline". Every
   proposal states whether it keeps that promise.
3. **One source for sacred text.** Any feature that shows Quran text reads the verified local file.
4. **No generated religious content.** Software may *find* verified text; it must not compose
   rulings, tafsir or hadith.
5. **No new runtime dependency** unless a feature is impossible without it.

Complexity: **S** (days), **M** (1–2 weeks), **L** (several weeks) of focused work — relative
sizes, not commitments.

## What already exists (so it is not proposed again)

Prayer times and Qibla (local), Hijri date line, five interface languages, bookmarks and last
page, daily page count and streak, recitation checking with a speech model, spaced-review of
memorisation, ayah repetition, adhkar counters with sources and virtues, a private habit tracker
with a Quran wird, push reminders, share-as-image and ayah video export, an offline download.

---

## Tier 1 — Complete the core (highest value, lowest risk)

### F1. Fully offline text mushaf and Quran search

| | |
|---|---|
| User problem | Reading the Quran as text and searching it both stop without a connection, and depend on third-party APIs |
| Solution | Render pages from `data/quran.json` + the page map; wire in the existing `js/quran/local-search.js` (diacritic-insensitive search over `text_clean`) |
| Architecture | A small shared module `quran-data.js` (load once, index by surah:ayah and by page). No server |
| Dependencies | None new. Page→ayah map already exists in the coordinate database |
| Complexity | M |
| User value | Very high — the central act of the app becomes instant and reliable |
| Privacy | Improves: no reading activity is sent to any API |
| Offline | Full |

### F2. "Continue" and a personal home

| | |
|---|---|
| User problem | Home is a menu; it does not know what I was doing or what time of day it is |
| Solution | Top of home: next prayer with countdown; *continue reading* (last page); *continue listening*; the adhkar that fits the time (morning / evening / after prayer / sleep); today's wird progress |
| Architecture | Read existing `localStorage` keys and `PrayerService`; no new storage |
| Dependencies | None |
| Complexity | S–M |
| User value | High — fewer taps for the daily actions |
| Privacy | Local only |
| Offline | Full |

### F3. Daily adhkar routine

| | |
|---|---|
| User problem | Adhkar are five separate links; nothing shows what I have completed today |
| Solution | One "today" checklist tied to prayer times (morning, after each prayer, evening, sleep) with completion state, built on the existing per-dhikr counters; show translation/transliteration from the existing `english` field |
| Architecture | Merge `salah.html` and `sleeping.html` into the `azkar.html` reader; one dated record per day (pattern already used by `js/dhikr-stats.js`) |
| Dependencies | F2 for the home entry point |
| Complexity | M |
| User value | High — turns content into a habit |
| Privacy | Local only |
| Offline | Full |

### F4. Backup, export and restore

| | |
|---|---|
| User problem | Bookmarks, streaks, memorisation history and Thabat journeys are lost when site data is cleared or the phone changes |
| Solution | "Export my data" → one JSON file (optionally passphrase-encrypted with WebCrypto); "Import" restores it. Offer a reminder after milestones |
| Architecture | A registry of storage keys and the tasmee IndexedDB store; versioned file format |
| Dependencies | None |
| Complexity | M |
| User value | High for committed users; protects years of progress |
| Privacy | Excellent — the file never leaves the user's hands unless they share it |
| Offline | Full |

### F5. Offline-aware audio

| | |
|---|---|
| User problem | I cannot see what is saved, how much space it uses, or play only saved tracks |
| Solution | Saved mark on tracks, "available offline" filter, a storage screen (per reciter size, delete), download a whole reciter/juz in the background |
| Architecture | Uses the audio cache already in `sw.js`; a small index of cached URLs; Background Fetch API where available, plain queue otherwise |
| Dependencies | None |
| Complexity | M |
| User value | High for commuters and travellers |
| Privacy | Local only |
| Offline | That is the point |

---

## Tier 2 — Differentiate

### F6. Khatma and reading plans

| | |
|---|---|
| User problem | I want to finish the Quran in 30 days / in Ramadan / at 5 pages a day and see whether I am on track |
| Solution | Promote the Quran-wird engine from Thabat into a first-class plan: target date or daily amount, today's range opens in the mushaf, catch-up for missed days, khatma history |
| Architecture | Reuse `js/thabat.js` wird logic and the mushaf's page-read counter; mark pages read automatically after a dwell time |
| Dependencies | F2 (home card) |
| Complexity | M |
| User value | High; strongest retention driver in this category |
| Privacy | Local only |
| Offline | Full |

### F7. Bookmarks, notes and collections

| | |
|---|---|
| User problem | A bookmark is one page marker; I cannot keep a note on an ayah or group ayahs by theme |
| Solution | Ayah-level bookmarks with an optional note and colour tag; user-named collections ("patience", "du'a"); share a collection as text or image |
| Architecture | One IndexedDB store keyed by surah:ayah; surfaced in mushaf, text mushaf and search results |
| Dependencies | F1 (ayah-keyed text), F4 (so notes are backed up) |
| Complexity | M |
| User value | Medium–high for study use |
| Privacy | Local only; notes are personal — include in encrypted export |
| Offline | Full |

### F8. Hijri calendar and Islamic dates

| | |
|---|---|
| User problem | The app shows today's Hijri date but not the month, upcoming occasions or a way to correct the date for my country |
| Solution | Month view (Hijri/Gregorian), ±2-day user adjustment, white days, Mondays/Thursdays, Ramadan, the ten of Dhul-Hijjah, Arafah, Ashura, both Eids — each with a one-line sourced note; optional reminders through the existing notification schedule |
| Architecture | `Intl` `islamic-umalqura` calendar plus the adjustment; a small static table of occasions |
| Dependencies | Scholar review of the notes (content audit §9) |
| Complexity | M |
| User value | High, seasonal |
| Privacy | Local only |
| Offline | Full |

### F9. Ramadan mode

| | |
|---|---|
| User problem | In Ramadan my needs change: suhoor/iftar times, a khatma, taraweeh, the last ten nights |
| Solution | Automatic seasonal home layout: imsak and iftar countdowns, iftar du'a, a 30-day khatma preset (F6), daily checklist, last-ten-nights emphasis, zakat al-fitr reminder |
| Architecture | A theme of the home dashboard switched by Hijri month; no new engine |
| Dependencies | F2, F6, F8 |
| Complexity | M |
| User value | Very high for one month; a strong reason to install |
| Privacy | Local only |
| Offline | Full |

### F10. Bundled Quran translations

| | |
|---|---|
| User problem | Non-Arabic speakers get an Arabic-only reader |
| Solution | Optional download of one translation per interface language, shown under each ayah in the text mushaf and in the ayah sheet of the image mushaf |
| Architecture | One JSON per translation keyed by surah:ayah, in the optional-download list |
| Dependencies | **Licensing** — each translation needs an explicit licence that allows redistribution; choose with the owner. F1 |
| Complexity | M (engineering) + licensing work |
| User value | Very high for four of the five supported languages |
| Privacy | Local once downloaded |
| Offline | Full after download |

### F11. Accessibility mode

| | |
|---|---|
| User problem | Elderly users and users with low vision struggle with small controls; screen-reader users cannot operate the toolbars |
| Solution | Labels and roles everywhere (UX audit X5–X6), a "large and simple" setting (bigger type, fewer controls, high contrast), full keyboard operation, visible focus |
| Architecture | Tokens + shared components (UX audit §4) |
| Dependencies | Design-system work |
| Complexity | M |
| User value | High for an audience that skews older than most apps |
| Privacy | None |
| Offline | Full |

### F12. Search across everything

| | |
|---|---|
| User problem | Quran, hadith, adhkar and Hisn each have their own search |
| Solution | One search box on home; results grouped by source with the source always named |
| Architecture | Prebuilt compact indexes per corpus (built in CI, loaded on demand); Quran index always available, hadith indexes after their book is downloaded |
| Dependencies | F1; hadith lazy-loading (plan P2) |
| Complexity | L |
| User value | High |
| Privacy | Queries never leave the device |
| Offline | Full for downloaded corpora |

---

## Tier 3 — Advanced

### F13. Word-level follow-along recitation

| | |
|---|---|
| User problem | Learners want the word being recited to be highlighted |
| Solution | Use per-word timing data for a small set of reciters to drive the existing word rectangles |
| Architecture | Timing files per reciter/surah. The coordinate database already holds a rectangle for every word (88,246), which tasmee uses today. **An additional, optional layer — the existing highlight settings stay as they are** |
| Dependencies | A timing dataset with a usable licence; audio from the same recordings the timings were made for |
| Complexity | L |
| User value | High for learners and children |
| Privacy | None |
| Offline | After download |

### F14. Memorisation map (hifz tracker)

| | |
|---|---|
| User problem | Tasmee sessions are recorded, but I cannot see what I have memorised across the whole mushaf |
| Solution | A juz/surah/page map coloured by strength (from tasmee accuracy and review recency), with "what to revise today" |
| Architecture | Derived from the existing tasmee IndexedDB store |
| Dependencies | None |
| Complexity | M |
| User value | High for a niche the app already serves better than most |
| Privacy | Local only |
| Offline | Full |

### F15. Optional encrypted sync

| | |
|---|---|
| User problem | I use two devices |
| Solution | Opt-in, end-to-end-encrypted sync of the F4 export through a tiny key-value endpoint; pairing by QR code; no account, no email |
| Architecture | A third Cloudflare Worker storing opaque blobs under a random id; conflict resolution "newest wins" per key |
| Dependencies | F4 |
| Complexity | L |
| User value | Medium |
| Privacy | Server sees only ciphertext; still a new data-holding service — needs a policy update and a deletion path |
| Offline | Works offline, syncs when online |

### F16. Discovery by topic — with or without AI

| | |
|---|---|
| User problem | "What does the Quran say about patience?" — the user does not know the words to search |
| Solution, step 1 (no AI) | A curated topic index: a few hundred themes mapped to ayah references by a reviewer; browse and search by theme |
| Solution, step 2 (optional) | On-device semantic retrieval: precomputed embeddings of ayahs (and their translation), a small query encoder running in the browser; returns **existing ayahs with references**, never generated text |
| Architecture | Step 1: one JSON. Step 2: embeddings file (~10–25 MB) + an ONNX encoder; the app already ships an ONNX runtime path |
| Dependencies | Reviewer for the topic index; F1, F10 |
| Complexity | Step 1: M (mostly content). Step 2: L |
| User value | High if step 1 is good; step 2 is an enhancement |
| Privacy | Fully on-device in both steps |
| Offline | Full |
| Clear limits | No answers, no rulings, no summaries of religious meaning. A visible line: "results are matches from the text, not a fatwa". If a cloud model were ever proposed instead, it would break principles 2 and 4 and should be declined |

### F17. Short verified lessons

| | |
|---|---|
| User problem | New Muslims and children need structured basics (wudu, prayer, short surahs) |
| Solution | A small set of authored, reviewed lessons with sources |
| Architecture | Static content in the "book" page engine |
| Dependencies | An author and a reviewer — this is a content project, not an engineering one |
| Complexity | S (engineering), L (content) |
| User value | Medium–high for a specific audience |
| Privacy | None |
| Offline | Full |

---

## Explicitly not recommended

- **A framework rewrite** (React/Vue/Flutter). The app's reach, speed and longevity come from being
  plain files. Shared components can be plain custom elements or small modules.
- **Accounts and social features** (leaderboards, public streaks). They contradict the privacy
  promise and add moderation and security duties.
- **A chatbot that answers religious questions.** High risk of confident error on matters of
  worship; outside what this project can verify.
- **Ads, tracking analytics, or gamified pressure.** Streaks already exist; keep them gentle.
- **More mushaf variants or reciters** before the existing ones are fully reliable offline.

## Suggested order

F1 → F2 → F3 → F4 → F5, then F6 → F8 → F9 before the next Ramadan, then F7, F10, F11, F12, and
the advanced tier as capacity allows. The modernization plan places these among the technical
work they depend on.
