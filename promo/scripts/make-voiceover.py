"""Synthesise the narration with Piper (offline neural TTS) and lay each line
on the commercial's timeline.

    python scripts/make-voiceover.py --voice <model.onnx>

Writes audio/vo.flac (48 kHz mono, 45 s) and audio/vo-timing.json.
Voice used for the delivered cut: en_US-joe-medium (dataset licence CC0).
"""
import argparse
import json
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
DURATION = 45.0

# (start second, text, length_scale) — start times follow the edit in src/timeline.js
# Arabic loanwords get explicit IPA ([[ ... ]] is Piper's inline-phoneme syntax);
# the plain-English text in vo-timing.json is what appears in the storyboard.
SAY = {
    "Quran,": "[[ kʊɹˈɑːn, ]]",
    "Quran": "[[ kʊɹˈɑːn ]]",
    "adhkar,": "[[ ʌðkˈɑːɹ, ]]",
    "tasbeeh,": "[[ tæsbˈiːh, ]]",
    "hadith,": "[[ hædˈiːθ, ]]",
    "qibla,": "[[ kˈɪblə, ]]",
    "Zad Al-Muslim.": "[[ zˈɑːd ælmˈʊslɪm. ]]",
    "ayah.": "[[ ˈɑːjə. ]]",
    "Ayah": "[[ ˈɑːjə ]]",
}

# (start second, text, length_scale) — start times follow the edit in src/timeline.js
LINES = [
    (0.70, "Life moves quickly.", 1.08),
    (2.55, "But some moments deserve our full attention.", 1.06),
    (5.45, "Make space for what matters.", 1.10),
    (8.40, "Reconnect with the words of the Quran,", 1.04),
    (11.40, "and listen to beautiful recitation.", 1.04),
    (15.25, "Keep remembrance close. Daily adhkar, a smart tasbeeh, and tools to help you memorise.", 1.0),
    (22.30, "Explore hadith, find the qibla, and tune in to Quran radio, in your own language.", 1.0),
    (29.40, "Beautifully designed for your everyday journey.", 1.06),
    (35.50, "Meet Zad Al-Muslim. Your all-in-one Islamic companion.", 1.04),
    (39.70, "Free. Ad-free. And it works offline.", 1.04),
    (42.45, "Download it on Google Play.", 1.06),
]


def spoken(text):
    for k in sorted(SAY, key=len, reverse=True):
        text = text.replace(k, SAY[k])
    return text


def synth(model, text, length_scale, piper):
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "line.wav"
        subprocess.run([piper, "-m", model, "-f", str(out), "--length-scale", str(length_scale),
                        "--noise-scale", "0.55", "--noise-w-scale", "0.7"],
                       input=spoken(text).encode(), check=True, capture_output=True)
        with wave.open(str(out)) as w:
            sr = w.getframerate()
            x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    x = resample_poly(x, SR, sr).astype(np.float32)
    # Trim leading/trailing silence so start times are exact.
    idx = np.where(np.abs(x) > 0.01)[0]
    x = x[max(idx[0] - 240, 0): idx[-1] + 2400]
    fade = int(0.01 * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x


# Ayah Video Maker promo (--vm, 30 s, src/vm-scenes.js?lang=en): every line
# ends before the exported clip's recitation (13.4–23.5 s).
VM_DURATION = 30.0
VM_LINES = [
    (0.50, "Make your status an ayah.", 1.06),
    (3.30, "Pick the verses you love,", 1.04),
    (5.70, "choose a reciter and a background,", 1.0),
    (8.40, "and the right size for your status or story.", 1.0),
    (11.00, "Then create your video in one tap.", 1.02),
    (24.20, "Ayah Video Maker. In Zad Al-Muslim.", 1.04),
    (27.00, "Download it on Google Play.", 1.06),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--piper", default="piper")
    ap.add_argument("--vm", action="store_true", help="Ayah Video Maker promo narration (outputs *-vm files)")
    args = ap.parse_args()
    lines, suffix = (VM_LINES, "-vm") if args.vm else (LINES, "")
    track = np.zeros(int((VM_DURATION if args.vm else DURATION) * SR), dtype=np.float32)
    timing = []
    prev_end = 0
    for start, text, ls in lines:
        x = synth(args.voice, text, ls, args.piper)
        i = int(start * SR)
        end = start + len(x) / SR
        if start < prev_end:
            print(f"WARNING overlap: '{text}' starts {start:.2f} before previous ends {prev_end:.2f}")
        track[i:i + len(x)] += x[: len(track) - i]
        timing.append({"start": round(start, 2), "end": round(end, 2), "text": text})
        print(f"{start:6.2f}-{end:6.2f}  {text}")
        prev_end = end
    peak = np.max(np.abs(track))
    track = track / peak * 0.89
    (ROOT / "audio").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "vo.wav"
        with wave.open(str(tmp), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((track * 32767).astype(np.int16).tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), str(ROOT / "audio" / f"vo{suffix}.flac")], check=True)
    (ROOT / "audio" / f"vo-timing{suffix}.json").write_text(json.dumps(timing, indent=2))


if __name__ == "__main__":
    main()
