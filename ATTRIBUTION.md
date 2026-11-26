# Attribution

## Quran Speech Recognition (Tarteel)

### Model
- **Model**: NVIDIA FastConformer Arabic CTC (quantized ONNX, uint8)
- **Base**: `nvidia/stt_ar_fastconformer_hybrid_large_pcd_v1.0`
- **Size**: ~131 MB (quantized)
- **License**: CC-BY-4.0 ([NVIDIA model card](https://huggingface.co/nvidia/stt_ar_fastconformer_hybrid_large_pcd_v1.0))
- **Source**: [yazinsai/offline-tarteel](https://github.com/yazinsai/offline-tarteel) (v0.1.0 release)
- **Original Author**: Yazin Insai ([@yazinsai](https://github.com/yazinsai))

### Data Files
- `data/vocab.json` — CTC vocabulary (token ID to character mapping)
- `data/quran.json` — 6,236 Quran verses (uthmani text + cleaned text)

### Quran text (`data/quran.json`)
- **Text:** Uthmani script, Hafs 'an 'Asim, 6,236 ayahs. `text_uthmani` is identical,
  character for character, to the `quran-uthmani` edition served by
  [alquran.cloud](https://alquran.cloud) (the [Tanzil](https://tanzil.net) Uthmani text),
  compared ayah by ayah in November 2026.
- **Convention:** the basmala is prefixed to ayah 1 of every surah except Al-Fatihah
  (where it is ayah 1) and At-Tawbah (which has none). `text_clean` is derived from
  `text_uthmani` for search and recitation matching only and is never shown as the Quran.
- **Integrity:** the file's SHA-256 is recorded in `data/quran.sha256` and checked in CI
  (`scripts/verify-quran.cjs`) together with the ayah count, the per-surah counts and the
  order. The text is never edited by hand; it changes only by regenerating it from the
  source and re-running the comparison.

### License Compliance (CC-BY-4.0)
Per the Creative Commons Attribution 4.0 license, you must:
1. **Credit** — Give appropriate credit to the original author
2. **Link** — Provide a link to the license
3. **Indicate changes** — State if changes were made

### How to Credit
When distributing this software, include the following:

```
Quran speech recognition powered by NVIDIA FastConformer Arabic CTC model,
originally developed by Yazin Insai (https://github.com/yazinsai/offline-tarteel).
Licensed under CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/).
```

## Reciter photos

- `images/reciters/*.webp` — reciter photos used as album art in the Quran audio player,
  taken from [way2quran.com](https://way2quran.com) (الطريق إلى القرآن), cropped square and
  resized to at most 320 px. The pictures remain the property of their owners.

## Quran fonts and text

- `data/quran-qpc.json` — the King Fahd Complex "QPC Hafs" encoding of the Quran text, as served
  by the Quran.com API, verified letter for letter against `data/quran.json`
  (`scripts/build-quran-qpc.cjs`). Drawn with the KFGQPC Hafs font in the video maker, takrar and
  the offline text mushaf.
- `data/translations/*.json` — Quran translations from the [Tanzil Project](https://tanzil.net/trans/),
  stored as published (`scripts/build-translations.cjs`): Saheeh International (`en.sahih`),
  Diyanet İşleri (`tr.diyanet`), Muhammad Junagarhi (`ur.junagarhi`), Burhan Muhammad-Amin
  (`ku.asan`; its published text has no translation for 108:3, shown as such) and al-Tafsir
  al-Muyassar (`ar.muyassar`). Tanzil's terms: non-commercial use only (this app is free, with no
  ads or payments); apps using more than three of them link back to https://tanzil.net/trans/ —
  the text mushaf's settings do.

## Reading fonts for «تعلم التجويد»

- `fonts/extra/*.woff2` — Cairo, Almarai, IBM Plex Sans Arabic, El Messiri, Noto Naskh Arabic and
  Markazi Text, from the `@fontsource` npm packages 5.3.0 (Google Fonts builds), regular and bold,
  Arabic and Latin files. All under the SIL Open Font License 1.1; each font's licence is kept
  beside it as `fonts/extra/OFL-<font>.txt`. Declared in `css/tajweed-fonts.css` and served from the
  repo (never from Google Fonts), fetched only when chosen in the page's settings.
## PDF books (pages/books.html)

- `data/books/risala.json` — 19 books chosen from «رسالة الحرمين» (https://risala.prh.gov.sa), the
  guidance material of the Presidency of Religious Affairs at the Masjid al-Haram and the Masjid
  an-Nabawi. Titles, authors and summaries as published there (one author name given in full:
  ثلاثة الأصول — الشيخ محمد بن عبد الوهاب التميمي, «الشيخ محمد التميمي» on the site). Each PDF
  was downloaded and checked: a valid PDF whose cover shows that title and author; pages and
  size measured. The PDFs are downloaded from the publisher's site; `images/books/*.webp` are
  small copies of the publisher's covers, shown with the source credited on the page.

## Tajweed mutun (pages/tajweed.html)

- `data/tajweed/tuhfa.json` — تحفة الأطفال للجمزوري, text and the short notes of Sheikh Ali Muhammad
  al-Dabba' (d. 1380 AH / 1961), from al-Maktaba al-Shamela, book 9632 (https://shamela.ws/book/9632);
  checked against the OpenITI copy of the same book (letter for letter except four known readings).
- `data/tajweed/jazariyya.json` — المقدمة الجزرية, text from the qiraat-api repository
  (https://github.com/QZTA/qiraat-api, `data/jazariyyah.txt`), identical to the critical edition in
  al-Maktaba al-Shamela, book 581, whose chapter headings are used.
- The simple explanation of each bayt was written for the app from the classical commentaries named on
  the page (al-Dabba', al-Jamzuri's «فتح الأقفال», Ibn al-Nazim's «الحواشي المفهمة», al-Qari's
  «المنح الفكرية»); it is marked on the page for review with a qualified teacher.
- Recitations: «مكتبة قرآني» on archive.org (https://archive.org/details/qurani-tohfat-alatfal,
  https://archive.org/details/qurani-matn-al-jazariyyah), streamed, with the published per-bayt timings
  of the Tuhfa recordings.

## Grammar mutun (pages/nahw.html)

- `data/nahw/ajurrumiyya.json` — المقدمة الآجرومية لابن آجُرُّوم. The text follows «متن الآجرومية» (دار الصميعي)
  in al-Maktaba al-Shamela, book 11371 (https://shamela.ws/book/11371), vowelled for the app and checked
  letter for letter against it (four documented differences, listed in `scripts/build-nahw.cjs`), and against
  the quotations in «التحفة السنية بشرح المقدمة الآجرومية» of Muhammad Muhyi al-Din Abd al-Hamid.
- The simple explanation of each passage was written for the app, drawing on that commentary; it is marked on
  the page for review with a qualified teacher.
- `data/nahw/kids.json` — «تعلم النحو خطوة خطوة» (pages/nahw-kids.html): lessons, examples, parents' notes and
  questions written for the app from the standard rules taught in school grammars and the mutun (the Ajurrumiyya
  and its commentaries). Quranic examples are taken by reference from `data/quran.json`, never retyped.

## Ayah video maker — long video tab (pages/video-maker.html)

- `js/vendor/mp4-muxer.js` — mp4-muxer 5.2.2 by Vanilagy (https://github.com/Vanilagy/mp4-muxer),
  MIT License, unmodified build. Writes the MP4 file from the WebCodecs encoder output.
- `images/tv-maker/` — painted backgrounds, ornaments and name plates supplied for the app; the original
  ornament sheets are kept in `images/tv-maker/source/`, and every file is listed in `images/tv-maker/README.md`.
