# Zad Al-Muslim: promo production

This folder holds a code-generated 45-second commercial for **Zad Al-Muslim**, with the full pipeline to rebuild it. The app itself is not touched. Nothing outside `promo/` was changed.

## Deliverables (`output/`)

| File | What |
|---|---|
| `zad-al-muslim-hero.mp4` | Landscape master: 1920×1080, 30 fps, H.264 + AAC, 45 s |
| `zad-al-muslim-reel.mp4` | Vertical 1080×1920, recomposed for 9:16 (not cropped) |
| `zad-al-muslim-square.mp4` | Square 1080×1080, recomposed for 1:1 |
| `zad-al-muslim-poster.png` | Cover artwork, 1920×1080 |
| `zad-al-muslim-poster-vertical.png` | Cover artwork, 1080×1920 |
| `zad-al-muslim-hero-ar.mp4` | **Arabic cut**: 1920×1080 with Arabic voiceover, Arabic on-screen copy, the app's Arabic UI and a mirrored right-to-left composition |
| `zad-al-muslim-storyboard.md` | Final timings, voiceover, on-screen text and visual direction |
| `qa-report.md` | Automated checks of the files above (resolution, fps, codecs, loudness, QR decoded from the video) |

`audio/mix-ambient.flac` is an alternative mix with **narration and sound design only, no musical instruments**. Some audiences prefer this for Islamic content. To make an instrument-free cut, run `scripts/mux.sh landscape zad-al-muslim-hero-no-music.mp4 8M mix-ambient.flac`. The Arabic equivalent is `audio/mix-ambient-ar.flac`.

## How it is built

```
assets/screens/*.png  ← genuine captures of the real app   (scripts/capture-screens.cjs)
assets/brand/         ← app icon (from /icons), official Google Play badge, QR (scripts/make-qr.py)
src/                  ← the commercial as a deterministic HTML/CSS-3D/Canvas page
   lib.js     easing, keyframes, seeded RNG, kinetic type
   phone.js   3D phone mockup (layered thickness, metal frame, glass glare, screen stack)
   fx.js      dawn window + volumetric beam, dust, distraction storm, bokeh, desk texture, grain
   scenes.js  all 7 scenes and their landscape / vertical / square layouts
   main.js    format setup, preload, window.renderFrame(t)
   poster.html  cover artwork
audio/                ← vo.flac (Piper TTS), mix.flac, mix-ambient.flac, vo-timing.json
scripts/render.cjs    ← headless Chromium renders every frame, then FFmpeg encodes (parallel workers)
scripts/mux.sh        ← final H.264/AAC delivery encode
scripts/verify.py     ← QA report
```

Every frame is a pure function of time: `renderFrame(t)` sets all state from `t`. Frames can therefore be rendered in any order, split across workers, and re-rendered one at a time. To preview any moment in a browser, serve `promo/` and open `src/index.html?fmt=vertical&t=12.5`.

## Arabic cut

The same engine renders an Arabic version with `?lang=ar`. Everything else in the pipeline is unchanged.

- **Copy:** Arabic headlines are set in Amiri, and labels and chips in Tajawal. Arabic is never letter-spaced or upper-cased, because both would break the letter joining.
- **Layout:** the composition is mirrored for right-to-left reading. Type sits on the right, the phones and their yaw are mirrored, the dawn window and beam flip, the carousel advances leftward, and the brand block sits on the right of the end card.
- **Screens:** the app's own Arabic UI, captured as `*-ar.png` by `capture-screens.cjs`.
- **End card:** leads with **زادُ المسلم** and uses the official Arabic Google Play badge ("احصل عليه من Google Play").
- **Narration:** VoxCPM2 (open weights, Apache-2.0). The narrator is created by *voice design*, from a text description of a "mature Arab male narrator, warm, deep and calm…". No real person's voice is cloned. One anchor phrase fixes the voice, and every line is then generated in that voice. Measured median pitch is 89 Hz.
- **Pronunciation QA:** each line is generated in up to 3 takes. Every take is transcribed back with Whisper and scored by character error rate (CER) against the script, and the best take is kept. The final mean CER is **1.9%**, with per-line results in `audio/vo-ar-qa.json`. The finished MP4 was also transcribed end-to-end over the music.

```bash
python -m venv .venv-ar && .venv-ar/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu \
  && .venv-ar/bin/pip install -r requirements-ar.txt
.venv-ar/bin/python scripts/make-voiceover-ar.py --takes 3      # ~25 min on 4 CPU cores (4.7 GB model download)
.venv/bin/python scripts/mix-audio.py --ar && .venv/bin/python scripts/mix-audio.py --ar --ambient
node scripts/render.cjs --fmt=landscape --lang=ar && scripts/mux.sh landscape-ar zad-al-muslim-hero-ar.mp4 8M mix-ar.flac
```

Vertical and square Arabic cuts work the same way (`--fmt=vertical --lang=ar`, then mux `vertical-ar`).

**Qibla in the Arabic cut:** this cut shows the Qibla *start* screen, not the running compass. While the compass runs, the app's `#qibla-marker` element is positioned past the right edge of the screen (x ≈ 435–562 px on a 412 px viewport, so the page is 478 px wide). In LTR the overflow is harmless, but in Arabic (RTL) the whole page shifts and a white strip appears on the left. That is an app bug worth fixing, for example by keeping the marker inside the viewport or adding `overflow-x: hidden` on the compass container.

## Reproduce

Requirements: Node 18+, Python 3.10+, FFmpeg, and Chromium for Playwright. No network is needed at render time.

```bash
cd promo
npm install                                   # playwright (uses an installed Chromium)
python -m venv .venv && .venv/bin/pip install -r requirements.txt

# 1. genuine app screens (serves the repo root locally; sets only user preferences)
node scripts/capture-screens.cjs

# 2. QR code, verified to decode to the exact Play URL
.venv/bin/python scripts/make-qr.py

# 3. audio: narration (download the voice once), score, mixes
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx.json
.venv/bin/python scripts/make-voiceover.py --voice en_US-joe-medium.onnx --piper .venv/bin/piper
.venv/bin/python scripts/make-score.py            # audio/score.wav
.venv/bin/python scripts/make-score.py --no-music # audio/ambience.wav
.venv/bin/python scripts/mix-audio.py && .venv/bin/python scripts/mix-audio.py --ambient

# 4. picture (about 7–8 min per format on 4 CPU cores), then the delivery encode
node scripts/render.cjs --fmt=landscape && scripts/mux.sh landscape zad-al-muslim-hero.mp4 8M
node scripts/render.cjs --fmt=vertical  && scripts/mux.sh vertical  zad-al-muslim-reel.mp4 8M
node scripts/render.cjs --fmt=square    && scripts/mux.sh square    zad-al-muslim-square.mp4 5M
node scripts/poster.cjs

# 5. QA
.venv/bin/python scripts/verify.py
```

Useful flags: `render.cjs --stills=4.5,12,40` writes PNG stills to `build/stills/`, and `--from=8 --to=15` renders part of the timeline.

To edit the commercial, change copy, timings and layouts in `src/scenes.js`. Each scene's block is labelled S1–S7, and its timings match the storyboard. If you move a voiceover line, update `LINES` in `scripts/make-voiceover.py`.

## Authenticity of the app footage

- Every screen inside a phone is a screenshot of the real app, taken from this repository's own source by `capture-screens.cjs`. The script uses a 412×892 viewport at 3× scale and the English UI (plus Arabic, Kurdish, Urdu and Turkish for the language beat). It applies the dark theme, sets the prayer location to Makkah, and dismisses the first-run hints, as a returning user's app would be.
- Interactions are real. The Masbaha counts 30→33 are produced by real taps, and the confetti at 33 is the app's own. The Mushaf pages are pages 1 and 2 of the app's default Mushaf.
- **Qibla:** headless Chromium has no magnetometer, so for that one capture the device is placed in London and its compass is *emulated* (a `deviceorientationabsolute` event, as Chrome DevTools' Sensors panel would send). The direction, distance and "You are facing the Qibla" state are computed and drawn by the app.
- The status-bar band above each screen is part of the phone mockup: a strip filled with the screen's own top colour, so the camera island doesn't cover app UI. It is not app UI.
- All Arabic and Quranic text in the video is rendered by the app itself, inside its screenshots. The only Arabic typed by this production is the app name **زاد المسلم** (Amiri font).

## Licences and third-party assets

| Asset | Source | Licence / basis |
|---|---|---|
| App screens, app icon | this repository | project's own (MIT) |
| Google Play badge | play.google.com/intl/en_us/badges | Google Play badge guidelines (unaltered, used to link to the listing) |
| Cormorant Garamond, Manrope | Google Fonts (github.com/google/fonts) | SIL OFL 1.1 (`assets/fonts/OFL-*.txt`) |
| Amiri, Tajawal | this repository `/fonts` | SIL OFL 1.1 |
| Narration voice | Piper `en_US-joe-medium` (rhasspy/piper-voices) | model MIT; dataset CC0 |
| Arabic narration | VoxCPM2 (openbmb/VoxCPM2), voice designed from a text description | Apache-2.0 (commercial use permitted) |
| Arabic Google Play badge | play.google.com/intl/en_us/badges (`ar_badge_web_generic`) | Google Play badge guidelines (unaltered) |
| Speech-recognition QA | faster-whisper (Whisper `small`) | MIT; used only for checking, not in the output |
| Music and sound design | `scripts/make-score.py`, synthesised from scratch | original, no samples |
| QR code | generated by `scripts/make-qr.py` | — |

Creative technique was informed by the code-to-video approach in [awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos): HTML/Canvas/SVG animation rendered frame-by-frame. No composition, code or prompt was copied from it.

## Known limitations

- **Arabic voice:** the Piper Arabic voice (`ar_JO-kareem`) was deliberately not used. Its training dataset repository has no licence, which means all rights reserved, and that is unsafe for a commercial ad.

- The narration is synthetic (neural TTS). It is clear and natural, but a professional voice artist would add warmth. To swap in a recorded VO, replace `audio/vo.flac` (keep the line timings in `audio/vo-timing.json`) and re-run `mix-audio.py` and `mux.sh`. The picture does not need re-rendering.
- Piper sampling is slightly stochastic, so re-running `make-voiceover.py` can change line lengths by a few hundredths of a second.
- The score and mix were checked by measurement (spectrogram, loudness, voice-to-music ratio), not by a listening session. A human listen-through before paid placement is recommended.
- `scripts/capture-screens.cjs` captures the current state of the app. Prayer times and the countdown reflect the moment of capture.
