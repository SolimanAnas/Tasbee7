"""Mix narration over the score (sidechain-ducked) and normalise loudness.

    python scripts/mix-audio.py                 -> audio/mix.flac          (VO + score)
    python scripts/mix-audio.py --ambient       -> audio/mix-ambient.flac  (VO + sound design, no instruments)
    python scripts/mix-audio.py --ar [--ambient] -> audio/mix-ar.flac / mix-ambient-ar.flac (Arabic narration)

Two-pass EBU R128 loudnorm to -14 LUFS integrated, -1.5 dBTP (social platforms).
Requires ffmpeg on PATH.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

A = Path(__file__).resolve().parent.parent / "audio"
ambient = "--ambient" in sys.argv
ar = "--ar" in sys.argv
play = "--play" in sys.argv  # Google Play preview narration
bed = A / ("ambience.wav" if ambient else "score.wav")
vo = A / (("vo-ar" if ar else "vo") + ("-play" if play else "") + ".flac")
out = A / (("mix-ambient" if ambient else "mix") + ("-ar" if ar else "") + ("-play" if play else "") + ".flac")

# VO: clean low end, gentle compression, a touch of presence and room.
# Bed: ducked ~6 dB under the voice, then everything summed.
graph = (
    "[0:a]highpass=f=85,lowpass=f=12000,"
    "acompressor=threshold=0.12:ratio=3:attack=8:release=180:makeup=1.6,"
    "equalizer=f=220:t=q:w=1.2:g=-1.5,equalizer=f=3200:t=q:w=1.0:g=2,"
    "aecho=0.85:0.5:38|61:0.12|0.08,pan=stereo|c0=c0|c1=c0,asplit=2[vo][sc];"
    "[1:a]volume=0.5[bed];"
    "[bed][sc]sidechaincompress=threshold=0.04:ratio=5:attack=25:release=450:makeup=1[ducked];"
    "[ducked][vo]amix=inputs=2:normalize=0:weights=1 1.05,aresample=48000"
)
target = "I=-14:TP=-1.5:LRA=11"


def run(extra_filter, dest):
    cmd = ["ffmpeg", "-y", "-hide_banner", "-i", str(vo), "-i", str(bed),
           "-filter_complex", graph + extra_filter, "-t", "45", "-ar", "48000"] + dest
    return subprocess.run(cmd, capture_output=True, text=True, check=True)


# pass 1: measure
r = run(f",loudnorm={target}:print_format=json", ["-f", "null", "-"])
m = json.loads(re.findall(r"\{[^{}]*\}", r.stderr)[-1])
# pass 2: linear normalisation with measured values
lin = (f",loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
       f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
run(lin, ["-c:a", "flac", "-sample_fmt", "s32", str(out)])
print(f"{out.name}: measured {m['input_i']} LUFS -> -14 LUFS")
