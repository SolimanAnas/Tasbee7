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
