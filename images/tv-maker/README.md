# TV video maker assets

Ornaments for the «فيديو طويل» (long video, 16:9) tab of `pages/video-maker.html`.

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

## Templates (`js/tv-templates.js`)

| Template | Ornaments | Surah name | Reciter name |
|---|---|---|---|
| `royal` — أزرق ملكي | `divider-01` under the ayah | `plate-01`, top | `plate-05`, bottom |
| `mosque` — المسجد | `crown-01`, top | `plate-02`, bottom right | `plate-04`, bottom left |
| `parchment` — رَقّ | `arch-01` top, `divider-03` under the ayah | `plate-03`, top | plain text, bottom |
| `minimal` — بسيط | `divider-07` above and below the ayah | plain text, top | plain text, bottom |

To add a template, add an entry to `js/tv-templates.js` (positions are percentages of the
16:9 frame) and, for new pictures, put the WebP in `ornaments/` and list it here.
