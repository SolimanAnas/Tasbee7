"""Original score + sound design for the commercial, synthesised from scratch
(additive piano, warm pads, filtered-noise textures, convolution reverb).
No samples or third-party music are used, so there is nothing to license.

    python scripts/make-score.py            -> audio/score.wav  (music + sfx)
    python scripts/make-score.py --no-music -> audio/ambience.wav (sfx/ambience only,
                                               for an instrument-free mix)

Cue sheet (seconds) matches src/timeline.js:
  0.0  dawn: low drone and air         2.3  "distractions": ticking, chatter, riser
  4.25 hush (cut to silence)           4.4  first piano note: the "space"
  8 / 15 / 22 / 29  soft transitions   35.2 brand reveal swell
  43.6 final resolving chord, tail to 45.0
"""
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
DUR = 45.0
N = int(SR * DUR)
ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def t_axis(n):
    return np.arange(n) / SR


def place(buf, x, start, gain=1.0, pan=0.0):
    """Mix mono x into stereo buf at start seconds with constant-power pan."""
    i = int(start * SR)
    if i >= N:
        return
    x = x[: N - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + len(x)] += x * l
    buf[1, i:i + len(x)] += x * r


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


# ---------------------------------------------------------------- instruments
def piano(m, vel=0.5, length=4.0):
    """Soft felt-piano-like tone: inharmonic partials, per-partial decay, hammer."""
    f0 = midi_hz(m)
    n = int(length * SR)
    t = t_axis(n)
    B = 0.0004
    x = np.zeros(n)
    for k in range(1, 12):
        fk = f0 * k * np.sqrt(1 + B * k * k)
        if fk > 16000:
            break
        amp = (vel ** (0.6 + 0.12 * k)) / (k ** 1.15)
        decay = (0.55 + 0.25 * (m - 40) / 40) * k ** 0.7 + 0.15
        x += amp * np.exp(-decay * t) * np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28))
    # two-stage decay (prompt + aftersound), felt softness via lowpass
    x *= 0.65 * np.exp(-1.6 * t) + 0.35 * np.exp(-0.35 * t)
    hammer = rng.standard_normal(int(0.012 * SR)) * np.exp(-np.linspace(0, 6, int(0.012 * SR)))
    x[: len(hammer)] += lp(hammer, 2500) * 0.04 * vel
    atk = int(0.004 * SR)
    x[:atk] *= np.linspace(0, 1, atk)
    rel = int(0.25 * SR)
    x[-rel:] *= np.linspace(1, 0, rel)
    return lp(x, 2200 + 3500 * vel) * 0.5


def pad(notes, length, attack=1.6, release=2.0, bright=1200):
    """Warm string/choir-like pad: three detuned additive voices per note."""
    n = int(length * SR)
    t = t_axis(n)
    x = np.zeros(n)
    for m in notes:
        f0 = midi_hz(m)
        for det in (-0.07, 0.0, 0.07):
            f = f0 * 2 ** (det / 12)
            vib = 1 + 0.0015 * np.sin(2 * np.pi * (0.18 + rng.uniform(0, 0.1)) * t + rng.uniform(0, 6))
            ph = 2 * np.pi * f * np.cumsum(vib) / SR
            for k in range(1, 7):
                x += (0.7 ** k) / k * np.sin(k * ph + rng.uniform(0, 6))
    x /= max(len(notes), 1) * 3
    env = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    env[:a] = (1 - np.cos(np.linspace(0, np.pi, a))) / 2
    env[-r:] *= (1 + np.cos(np.linspace(0, np.pi, r))) / 2
    return lp(x * env, bright, 2)


def noise(n):
    return rng.standard_normal(n)


def whoosh(length=1.4, lo=300, hi=5000, peak=0.55):
    """Filtered noise sweep with a soft swell; peaks at `peak` of its length."""
    n = int(length * SR)
    x = noise(n)
    out = np.zeros(n)
    blk = 1024
    for i in range(0, n, blk):
        p = i / n
        c = lo * (hi / lo) ** (p / peak if p < peak else 1 - (p - peak) / (1 - peak) * 0.6)
        out[i:i + blk] = bp(x[max(0, i - 256):i + blk], c * 0.7, min(c * 1.4, SR / 2 - 100), 1)[-len(out[i:i + blk]):]
    p = np.linspace(0, 1, n)
    env = np.where(p < peak, (p / peak) ** 2, ((1 - p) / (1 - peak)) ** 1.5)
    return out * env * 0.25


def reverb_ir(seconds=3.6, tone=5000):
    n = int(seconds * SR)
    t = t_axis(n)
    ir = np.stack([lp(noise(n), tone), lp(noise(n), tone)]) * np.exp(-t * 6.9 / seconds)
    ir[:, : int(0.012 * SR)] = 0  # pre-delay
    return ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))


def reverb(dry, wet=0.35, seconds=3.6):
    ir = reverb_ir(seconds)
    w = np.stack([fftconvolve(dry[0], ir[0])[:N], fftconvolve(dry[1], ir[1])[:N]])
    return dry * (1 - wet) + w * wet * 1.6


# ---------------------------------------------------------------- score
CHORDS = [  # start, end, pad voicing (MIDI)
    (4.40, 8.20, [38, 50, 57, 64, 65]),      # Dm9
    (8.00, 11.70, [34, 50, 53, 57, 60]),     # Bbmaj7
    (11.50, 15.20, [45, 53, 57, 60, 64]),    # Fmaj7/A
    (15.00, 17.20, [43, 50, 53, 57, 58]),    # Gm9
    (17.00, 19.20, [34, 50, 53, 57, 62]),    # Bbmaj7
    (19.00, 22.20, [36, 48, 55, 60, 62]),    # Csus2
    (22.00, 24.20, [38, 50, 57, 64, 65]),    # Dm9
    (24.00, 26.20, [34, 50, 57, 60, 65]),    # Bbmaj9
    (26.00, 29.20, [41, 53, 57, 60, 67]),    # Fadd9
    (29.00, 32.20, [34, 50, 53, 57, 62]),    # Bbmaj7
    (32.00, 35.40, [36, 48, 55, 60, 62]),    # Csus2
    (35.20, 38.70, [38, 50, 57, 64, 69]),    # Dm9
    (38.50, 41.70, [34, 50, 57, 62, 65]),    # Bbmaj9
    (41.50, 43.80, [36, 48, 55, 60, 64]),    # C
    (43.60, 45.00, [41, 53, 60, 64, 67, 69]),  # Fadd9 — resolution
]

# Piano: (start, end, step seconds, register shift, velocity)
PIANO_DENSITY = [
    (4.40, 8.0, 1.66, 12, 0.42),
    (8.0, 15.0, 0.83, 12, 0.40),
    (15.0, 22.0, 0.415, 12, 0.36),
    (22.0, 29.0, 0.415, 24, 0.34),
    (29.0, 35.0, 0.83, 12, 0.36),
    (35.2, 43.4, 0.83, 12, 0.38),
]


def chord_at(t):
    cur = CHORDS[0][2]
    for s, e, notes in CHORDS:
        if s <= t < e:
            cur = notes
    return cur


def build_music(buf):
    # pads
    for s, e, notes in CHORDS:
        bright = 900 if s < 15 else (1500 if 22 <= s < 29 else 1150)
        g = 0.20 if s < 35 else 0.24
        if s >= 43.6:
            g = 0.26
        place(buf, pad(notes, e - s + 2.0, attack=1.2, release=2.2, bright=bright), s - 0.05, g, 0.0)
        # sub/bass note an octave under the root
        place(buf, pad([notes[0] - 12], e - s + 1.5, attack=0.8, release=1.6, bright=300), s, 0.20)
    # piano arpeggios — a fixed contour through each chord's upper tones
    contour = [0, 2, 1, 3, 2, 4, 3, 1]
    for s, e, step, shift, vel in PIANO_DENSITY:
        t, i = s, 0
        while t < e - 0.05:
            notes = chord_at(t + 0.01)[1:]
            m = notes[contour[i % len(contour)] % len(notes)] + shift
            v = vel * (1.15 if i % 4 == 0 else 0.9) * rng.uniform(0.92, 1.05)
            place(buf, piano(m, v, 3.5), t + rng.uniform(-0.008, 0.008), 0.55, rng.uniform(-0.35, 0.35))
            t += step
            i += 1
    # the "space" note and the two rolled chords
    place(buf, piano(74, 0.55, 5.0), 4.40, 0.75, 0.1)
    for k, m in enumerate([50, 57, 62, 64, 69, 74]):
        place(buf, piano(m, 0.5, 5.0), 35.25 + k * 0.07, 0.55, -0.3 + k * 0.12)
    for k, m in enumerate([41, 53, 60, 64, 67, 72, 76]):
        place(buf, piano(m, 0.48, 6.0), 43.62 + k * 0.08, 0.6, -0.35 + k * 0.11)


def build_sfx(buf):
    t = t_axis(N)
    # dawn: low drone + air, swelling in, ducked away by the hush
    drone = pad([26, 38], 4.6, attack=1.5, release=0.3, bright=260)
    place(buf, drone, 0.0, 0.32)
    air = lp(hp(noise(int(4.4 * SR)), 900), 5000)
    env = np.minimum(t_axis(len(air)) / 1.8, 1.0) * np.clip((4.25 - t_axis(len(air))) / 0.05, 0, 1)
    place(buf, air * env * 0.018, 0.0, 1.0, -0.2)
    place(buf, air[::-1] * env * 0.014, 0.0, 1.0, 0.25)
    # distractions: irregular ticks + chatter pings + riser, hard-stopped at 4.25
    tt = 2.3
    while tt < 4.2:
        n = int(0.02 * SR)
        click = bp(noise(n), 1800, 6000) * np.exp(-np.linspace(0, 9, n))
        place(buf, click, tt, 0.10 + 0.10 * (tt - 2.3), rng.uniform(-0.8, 0.8))
        tt += rng.uniform(0.05, 0.16) * (1.25 - 0.35 * (tt - 2.3) / 1.9)
    for k in range(9):
        st = 2.45 + k * 0.19 + rng.uniform(0, 0.08)
        n = int(0.14 * SR)
        f = rng.choice([1318.5, 1567.98, 1975.5, 2349.3])
        ping = np.sin(2 * np.pi * f * t_axis(n)) * np.exp(-t_axis(n) * 28)
        place(buf, ping, st, 0.035 + 0.01 * k, rng.uniform(-0.9, 0.9))
    riser = whoosh(1.95, 200, 7000, peak=0.98)
    place(buf, riser, 2.3, 0.55, 0.0)
    # transition breaths
    for s in (7.7, 14.7, 21.7, 28.6):
        place(buf, whoosh(1.2, 250, 3500, 0.55), s, 0.30, 0.0)
    # brand reveal: low bloom + shimmer
    n = int(4.0 * SR)
    bt = t_axis(n)
    bloom = np.sin(2 * np.pi * 49 * bt) * np.exp(-bt * 1.1) * (1 - np.exp(-bt * 40))
    place(buf, bloom, 35.2, 0.28)
    shimmer = sum(np.sin(2 * np.pi * f * bt + rng.uniform(0, 6)) for f in (2349.3, 2793.8, 3520.0, 4698.6))
    shimmer *= np.minimum(bt / 1.2, 1) * np.exp(-bt * 0.9) * 0.012
    place(buf, shimmer, 34.8, 1.0, 0.0)
    place(buf, whoosh(1.6, 200, 6000, 0.75), 33.9, 0.32, 0.0)


def main():
    no_music = "--no-music" in sys.argv
    buf = np.zeros((2, N))
    if not no_music:
        build_music(buf)
    build_sfx(buf)
    # Ambience-only mix keeps a soft room tone under the whole piece.
    if no_music:
        room = lp(noise(N), 400) * 0.006
        buf += np.stack([room, np.roll(room, 3000)])
    out = reverb(buf, wet=0.38)
    # final fade
    f = int(1.2 * SR)
    out[:, -f:] *= np.linspace(1, 0, f) ** 1.5
    out /= np.max(np.abs(out)) + 1e-9
    out *= 0.89
    name = "ambience.wav" if no_music else "score.wav"
    (ROOT / "audio").mkdir(exist_ok=True)
    with wave.open(str(ROOT / "audio" / name), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((out.T * 32767).astype(np.int16).tobytes())
    print("wrote", name)


if __name__ == "__main__":
    main()
