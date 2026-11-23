"""Soundtrack for the "Your whole day" YouTube Shorts reel (43 s, no music).

    python scripts/make-reel-audio.py   -> audio/mix-reel.flac

- narration: audio/vo-reel.flac (Piper joe, scripts/make-voiceover.py --reel)
- non-tonal sound design only: soft ticks on the hook's rapid cuts, a breath of
  air at each time-of-day change, the three Masbaha taps, a low impact on the
  end card, room tone; ducked under the narration
- two-pass loudnorm to -14 LUFS, -1.5 dBTP
"""
import importlib.util
import json
import re
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "audio"
SR, DUR = 48000, 43.0

spec = importlib.util.spec_from_file_location("score", ROOT / "scripts" / "make-score.py")
sc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sc)

MONTAGE = [0.2 + 0.3 * i for i in range(8)]          # src/reel-scenes.js MONTAGE cuts
BEATS = [2.6, 5.6, 8.6, 12.8, 17.0, 21.4, 25.6, 29.4, 32.8]
SLIDES = [10.7, 23.5]                                  # screen changes inside a beat
TAPS = [18.7, 19.0, 19.3]                              # Masbaha 31, 32, 33


def bed():
    n = int(DUR * SR)
    sc.N = n
    buf = np.zeros((2, n))
    room = sc.lp(sc.noise(n), 400) * 0.006
    buf += np.stack([room, np.roll(room, 3000)])
    for t in MONTAGE:
        k = int(0.025 * SR)
        tick = sc.bp(sc.noise(k), 2500, 7000) * np.exp(-np.linspace(0, 9, k))
        sc.place(buf, tick, t, 0.12, np.random.default_rng(int(t * 10)).uniform(-0.4, 0.4))
    for t in BEATS:
        sc.place(buf, sc.whoosh(1.0, 300, 4200, 0.55), t - 0.45, 0.2)
    for t in SLIDES:
        sc.place(buf, sc.whoosh(0.7, 500, 5000, 0.5), t - 0.2, 0.11)
    for t in TAPS:
        k = int(0.03 * SR)
        tap = sc.bp(sc.noise(k), 1500, 5000) * np.exp(-np.linspace(0, 10, k))
        sc.place(buf, tap, t, 0.2)
    sc.place(buf, sc.whoosh(1.4, 200, 5000, 0.75), 34.5, 0.26)
    k = int(3.0 * SR)
    bt = np.arange(k) / SR
    sc.place(buf, np.sin(2 * np.pi * 49 * bt) * np.exp(-bt * 1.3) * (1 - np.exp(-bt * 40)), 35.4, 0.22)
    out = sc.reverb(buf, wet=0.28)
    f = int(0.8 * SR)
    out[:, -f:] *= np.linspace(1, 0, f)
    return out / (np.max(np.abs(out)) + 1e-9) * 0.5


def write(path, x):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x.T, -1, 1) * 32767).astype(np.int16).tobytes())


def loudnorm2(inp, out, target, pre="", extra=()):
    f = (pre + "," if pre else "")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(inp), "-af", f + f"loudnorm={target}:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True, check=True)
    m = json.loads(re.findall(r"\{[^{}]*\}", r.stderr)[-1])
    lin = (f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
           f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(inp), "-af", f + lin, "-ar", str(SR), *extra, str(out)], check=True)
    return float(m["input_i"])


def main():
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        write(td / "bed.wav", bed())
        vo_chain = ("highpass=f=85,lowpass=f=12000,acompressor=threshold=0.12:ratio=3:attack=8:release=180:makeup=1.6,"
                    "equalizer=f=220:t=q:w=1.2:g=-1.5,equalizer=f=3200:t=q:w=1.0:g=2,aecho=0.85:0.5:38|61:0.12|0.08,"
                    "pan=stereo|c0=c0|c1=c0")
        loudnorm2(A / "vo-reel.flac", td / "vo.wav", "I=-16:TP=-2:LRA=11", vo_chain)
        graph = ("[0:a]asplit=2[vo][sc];[1:a]volume=0.8[bed];"
                 "[bed][sc]sidechaincompress=threshold=0.04:ratio=5:attack=25:release=450[duck];"
                 f"[duck][vo]amix=inputs=2:normalize=0:duration=longest,atrim=0:{DUR}")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(td / "vo.wav"), "-i", str(td / "bed.wav"),
                        "-filter_complex", graph, "-ar", str(SR), str(td / "sum.wav")], check=True)
        i = loudnorm2(td / "sum.wav", A / "mix-reel.flac", "I=-14:TP=-1.5:LRA=11", extra=("-c:a", "flac", "-sample_fmt", "s32"))
        print(f"mix-reel.flac: measured {i} LUFS -> -14 LUFS")


if __name__ == "__main__":
    main()
