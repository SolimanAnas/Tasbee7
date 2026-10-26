"""Soundtrack for the Ayah Video Maker promo (30 s, no music).

    python scripts/make-vm-audio.py             -> audio/mix-vm-ar.flac
    python scripts/make-vm-audio.py --lang=en   -> audio/mix-vm-en.flac (vo-vm.flac, Piper)

Layers:
- narration: audio/vo-ar-vm.flac (VoxCPM2, same designed narrator), processed
  like the main cut, loudness-matched to -16 LUFS;
- the exported clip's own audio (the recitation the app recorded), placed at
  exactly 13.4 s and matched to the same loudness; nothing else plays over it;
- non-tonal sound design (air, whooshes, two soft UI taps, a low impact on the
  end card), ducked under the narration and silent during the recitation.
Final mix: two-pass loudnorm to -14 LUFS, -1.5 dBTP.
"""
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
A, B = ROOT / "audio", ROOT / "build"
SR, DUR = 48000, 30.0
EN = "--lang=en" in sys.argv
LANG = "en" if EN else "ar"
VO = "vo-vm.flac" if EN else "vo-ar-vm.flac"
CLIP_AUDIO = "vm-clip-audio-en.wav" if EN else "vm-clip-audio.wav"
CLIP_T0, CLIP_LEN = 13.4, (303 if EN else 302) / 30   # frames of each export at 30 fps

spec = importlib.util.spec_from_file_location("score", ROOT / "scripts" / "make-score.py")
sc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sc)


def bed():
    n = int(DUR * SR)
    buf = np.zeros((2, n))
    sc.N = n  # make-score's place()/reverb() use its module-level length
    room = sc.lp(sc.noise(n), 400) * 0.006
    buf += np.stack([room, np.roll(room, 3000)])
    air = sc.lp(sc.hp(sc.noise(n), 900), 5000) * 0.004
    buf += np.stack([air, air[::-1]])
    for s, g in ((3.0, 0.22), (5.5, 0.18), (6.8, 0.16), (8.2, 0.18), (10.8, 0.18), (12.9, 0.34)):
        sc.place(buf, sc.whoosh(1.1, 250, 3800, 0.6), s, g)
    for s in (3.95, 11.05):  # soft UI taps (filtered noise, non-tonal)
        k = int(0.03 * SR)
        tap = sc.bp(sc.noise(k), 1500, 5000) * np.exp(-np.linspace(0, 10, k))
        sc.place(buf, tap, s, 0.18)
    sc.place(buf, sc.whoosh(1.4, 200, 5000, 0.7), CLIP_T0 + CLIP_LEN - 0.1, 0.28)
    k = int(3.0 * SR)
    bt = np.arange(k) / SR
    sc.place(buf, np.sin(2 * np.pi * 49 * bt) * np.exp(-bt * 1.3) * (1 - np.exp(-bt * 40)), 23.9, 0.22)
    out = sc.reverb(buf, wet=0.3)
    # silence the bed under the recitation: fade out just before the clip,
    # back in once it has finished
    t = np.arange(n) / SR
    clip_end = CLIP_T0 + CLIP_LEN
    gate = np.clip((CLIP_T0 + 0.1 - t) / 0.4, 0, 1) + np.clip((t - clip_end) / 0.4, 0, 1)
    out *= gate
    f = int(0.8 * SR)
    out[:, -f:] *= np.linspace(1, 0, f)
    return out / (np.max(np.abs(out)) + 1e-9) * 0.5


def write(path, x):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x.T, -1, 1) * 32767).astype(np.int16).tobytes())


def loudnorm2(inp, out, target, pre="", extra=()):
    """Two-pass linear loudnorm of one input (optional pre-filter chain)."""
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
        loudnorm2(A / VO, td / "vo.wav", "I=-16:TP=-2:LRA=11", vo_chain)
        # the clip's recitation, untouched apart from level, placed at CLIP_T0
        loudnorm2(B / CLIP_AUDIO, td / "clip.wav", "I=-16:TP=-2:LRA=11")
        d = int(CLIP_T0 * 1000)
        graph = (f"[0:a]asplit=2[vo][sc];[1:a]volume=0.7[bed];"
                 f"[bed][sc]sidechaincompress=threshold=0.04:ratio=5:attack=25:release=450[duck];"
                 f"[2:a]adelay={d}|{d},apad[clip];"
                 f"[duck][vo][clip]amix=inputs=3:normalize=0:duration=first,atrim=0:{DUR}")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(td / "vo.wav"), "-i", str(td / "bed.wav"),
                        "-i", str(td / "clip.wav"), "-filter_complex", graph, "-ar", str(SR), str(td / "sum.wav")], check=True)
        i = loudnorm2(td / "sum.wav", A / f"mix-vm-{LANG}.flac", "I=-14:TP=-1.5:LRA=11", extra=("-c:a", "flac", "-sample_fmt", "s32"))
        print(f"mix-vm-{LANG}.flac: measured {i} LUFS -> -14 LUFS")


if __name__ == "__main__":
    main()
