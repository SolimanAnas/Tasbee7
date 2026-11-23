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
