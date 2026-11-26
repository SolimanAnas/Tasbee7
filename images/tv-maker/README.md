# TV video maker assets

Pictures for the «فيديو طويل» (long video, 16:9) tab of `pages/video-maker.html`.

## Painted backgrounds (`backgrounds/`)

Complete 16:9 templates as supplied, with the two name plates painted in. Kept at full
quality: the PNGs are stored as **lossless** WebP (checked pixel for pixel against the
originals), the JPG and WebP files are the originals byte for byte. `thumbs/` holds
480×270 copies used only by the template picker.

| File | Size | Template | Surah plate (l, t, r, b %) | Reciter plate (l, t, r, b %) | Notes |
|---|---|---|---|---|---|
| `bg-01.webp` | 1670 × 941 | `dawn` — فجر فيروزي | 36.8, 12.2, 62.8, 21.8 | 28.8, 75.1, 71.1, 85.7 | pale sky: dark ayah text |
| `bg-02.webp` | 1670 × 941 | `moonlit` — ليلة مقمرة | 37.1, 12.3, 62.6, 21.8 | 29.5, 75.8, 70.4, 86.0 | |
| `bg-03.webp` | 1671 × 941 | `ivory` — عاجي | 37.9, 15.1, 61.8, 24.4 | 29.8, 75.2, 70.2, 84.0 | cream plates: dark names; dark ayah text |
| `bg-04.webp` | 1672 × 941 | `sunset` — غروب | 36.9, 12.3, 62.8, 21.9 | 29.1, 77.4, 71.0, 88.0 | pale sky: dark ayah text |
| `bg-05.jpg` | 2752 × 1536 | `violet` — ليل بنفسجي | 37.8, 12.5, 62.2, 23.2 | 29.2, 75.1, 70.8, 85.2 | silver plates |
| `bg-06.webp` | 1671 × 941 | `greenmist` — ضباب أخضر | 37.6, 12.3, 61.9, 21.7 | 29.1, 77.4, 70.6, 87.7 | pale sky: dark ayah text |
| `bg-07.webp` | 1671 × 941 | `mistfalls` — شلال الضباب | 37.6, 12.2, 61.9, 21.7 | 29.1, 77.4, 70.7, 87.6 | pale sky: dark ayah text |
| `bg-08.webp` | 1672 × 941 | `falls` — الشلال | 37.7, 12.4, 62.0, 21.8 | 29.2, 77.4, 70.7, 87.5 | busy scene: panel behind the ayah |
| `bg-09.webp` | 1671 × 941 | `dayfalls` — شلال النهار | 37.7, 12.5, 62.0, 21.9 | 29.2, 77.5, 70.7, 87.6 | busy scene: panel behind the ayah |
| `bg-10.webp` | 1536 × 864 | `crescent` — هلال | 37.6, 13.2, 62.4, 23.5 | 29.2, 74.7, 70.7, 84.7 | |

The plate boxes are the inside of each plate, found from its gold (or silver) border.
The surah name is written in the top plate, the reciter in the bottom one, and the ayah
in the open sky between them (`painted()` in `js/tv-templates.js`).

## Source sheets (`source/`)

The original sheets as supplied, kept unchanged (true PNG transparency, checked from
the alpha channel, not the preview). They are not loaded by the app.

| File | Size | Contents |
|---|---|---|
| `crown-sheet.png` | 2172 × 724 | one large crown ornament |
| `plates-sheet.png` | 1672 × 941 | five name plates |
| `arches-sheet.png` | 1536 × 1024 | ten arch ornaments |
| `dividers-sheet.png` | 2171 × 724 | seven horizontal dividers |

## Cut pieces (`ornaments/`)

Each piece was cut from its sheet along the alpha channel (soft glow kept, neighbouring
pieces masked out), trimmed to its visible pixels and saved as transparent WebP.
Pictures are always drawn at their own aspect ratio (`js/video-maker-long.js`).

| Piece | From | Description |
|---|---|---|
| `crown-01` | crown sheet | large blue and gold crown |
| `plate-01` | plates sheet, row 1 | blue plate, corner flourishes |
| `plate-02` | plates sheet, row 2 | green plate with a mosque emblem on the left |
| `plate-03` | plates sheet, row 3 | cream (parchment) plate, blue frame |
| `plate-04` | plates sheet, row 4 | blue plate with gold sweeps at both ends |
| `plate-05` | plates sheet, row 5 | blue plate with a notch and star at the top |
| `arch-01` … `arch-10` | arches sheet | arch ornaments, top to bottom, right to left |
| `divider-01` … `divider-07` | dividers sheet, rows 1–7 | horizontal dividers |

## Ornament templates (`js/tv-templates.js`)

| Template | Ornaments | Surah name | Reciter name |
|---|---|---|---|
| `royal` — أزرق ملكي | `divider-01` under the ayah | `plate-01`, top | `plate-05`, bottom |
| `mosque` — المسجد | `crown-01`, top | `plate-02`, bottom right | `plate-04`, bottom left |
| `parchment` — رَقّ | `arch-01` top, `divider-03` under the ayah | `plate-03`, top | plain text, bottom |
| `minimal` — بسيط | `divider-07` above and below the ayah | plain text, top | plain text, bottom |

To add a template, add an entry to `js/tv-templates.js` (positions are percentages of the
16:9 frame) and, for new pictures, put the WebP in `ornaments/` and list it here.
