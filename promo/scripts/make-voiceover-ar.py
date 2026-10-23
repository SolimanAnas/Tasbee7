"""Arabic narration with VoxCPM2 (Apache-2.0, open weights), placed on the
commercial's timeline, with automatic intelligibility QA.

    python scripts/make-voiceover-ar.py [--takes 3]

1. Voice design: VoxCPM2 creates the narrator from a text description, so no
   real person's voice is cloned. The anchor phrase it speaks is saved.
2. Every line is then generated in that same voice, using the anchor as the
   reference (prompt), so the narrator stays consistent across lines.
3. Each take is transcribed back with Whisper (faster-whisper) and scored by
   character error rate against the script (diacritics ignored); the best of
   N takes is kept. Scores go to audio/vo-ar-qa.json.

Writes audio/vo-ar.flac (48 kHz mono, 45 s) and audio/vo-timing-ar.json.
Needs: voxcpm, torch, soundfile, scipy, numpy, faster-whisper, ffmpeg.
"""
import argparse
import json
import re
import subprocess
import tempfile
import unicodedata
import wave
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
DURATION = 45.0

VOICE = ("(A mature Arab male narrator with a warm, deep and calm voice, reverent and sincere, "
         "speaking clearly and unhurriedly in eloquent Modern Standard Arabic, like a premium documentary)")
ANCHOR = "أهلًا بكم. هذا صوتُ الراوي، هادئٌ وواضحٌ ودافئ."

# (start second, text) — same beats as the English cut (src/scenes.js)
LINES = [
    (0.70, "الحياةُ تمضي سريعًا."),
    (2.55, "لكنَّ بعضَ اللحظاتِ تستحقُّ كلَّ اهتمامِنا."),
    (5.45, "امنحْ قَلْبَكَ مساحةً لما يهمُّ حقًّا."),
    (8.40, "جَدِّدْ صِلَتَكَ بِكِتابِ الله،"),
    (11.40, "واستمعْ إلى أجملِ التلاوات."),
    (15.25, "اجعلِ الذِّكرَ رَفِيقَكَ: أذكارُ اليوم، ومسبحةٌ ذكيّة، وأدواتٌ تُعِينُكَ على الحفظ."),
    (22.30, "تَصَفَّحِ الأَحادِيث، وَاعْرِفِ اتِّجاهَ القِبْلَة، وَاسْتَمِعْ إِلى إِذاعَةِ القُرْآن، بِلُغَتِكَ المُفَضَّلَة."),
    (29.40, "رَفِيقُكَ في كلِّ يوم، من الفجرِ حتى الليل."),
    (35.50, "زادُ المسلم. رَفِيقُكَ الإسلاميُّ المتكامل."),
    (39.35, "مَجّاني، بلا إعلانات، ويعمل دون إنترنت."),  # final ي without shadda, else read as "majjāniyya"
    (42.90, "حمِّلْه الآن من جوجل بلاي."),
]
# Google Play preview cut (--play): no pricing and no "download" call to action
# (Play preview-asset guidelines), so the narration ends on the feature line.
PLAY_LINES = LINES[:9] + [(39.35, "بلا إعلانات، ويعمل دون إنترنت.")]

# a line may run until this many seconds before the next one starts
GAP = 0.25


def norm(s):
    """Arabic text normalised for scoring: no diacritics/punctuation, unified letters."""
    s = unicodedata.normalize("NFKD", s)
    s = re.sub(r"[ً-ْٰـ]", "", s)          # harakat, dagger alif, tatweel
    s = re.sub(r"[إأآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[^ء-ي ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def cer(ref, hyp):
    r, h = norm(ref).replace(" ", ""), norm(hyp).replace(" ", "")
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
    return d[len(h)] / max(len(r), 1)


def trim(x, sr):
    idx = np.where(np.abs(x) > 0.012 * np.max(np.abs(x)) * 8)[0] if np.max(np.abs(x)) > 0 else []
    if len(idx) == 0:
        return x
    x = x[max(idx[0] - int(0.02 * sr), 0): idx[-1] + int(0.12 * sr)]
    f = int(0.01 * sr)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    return x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--takes", type=int, default=3)
    ap.add_argument("--whisper", default="small")
    ap.add_argument("--reuse", action="store_true", help="re-use takes already in build/vo-ar (re-place and re-score only)")
    ap.add_argument("--play", action="store_true", help="Google Play preview cut (outputs *-play files)")
    ap.add_argument("--redo", default="", help="with --reuse: comma-separated line numbers to regenerate (e.g. after a script edit)")
    args = ap.parse_args()
    redo = {int(n) for n in args.redo.split(",") if n.strip()}
    lines = PLAY_LINES if args.play else LINES
    suffix = "-play" if args.play else ""

    import torch
    from faster_whisper import WhisperModel
    from voxcpm import VoxCPM
    torch.manual_seed(1234)

    need_tts = not args.reuse or bool(redo)
    tts = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False) if need_tts else None
    vsr = tts.tts_model.sample_rate if tts else 48000
    asr = WhisperModel(args.whisper, device="cpu", compute_type="int8")

    def transcribe(x):
        # Whisper takes 16 kHz float audio directly (no file decoding needed)
        a16 = resample_poly(np.asarray(x, dtype=np.float32), 16000, vsr).astype(np.float32)
        segs, _ = asr.transcribe(a16, language="ar", beam_size=5)
        return " ".join(s.text for s in segs)

    work = ROOT / "build" / ("vo-ar" + suffix)
    if args.play and not work.exists():  # start from the main cut's takes; the edited line is redone
        import shutil
        shutil.copytree(ROOT / "build" / "vo-ar", work, ignore=shutil.ignore_patterns("line09-*", "line10-*"))
    work.mkdir(parents=True, exist_ok=True)
    anchor_wav = work / "anchor.wav"
    if not anchor_wav.exists():
        a = tts.generate(text=VOICE + ANCHOR, cfg_value=2.0, inference_timesteps=10)
        sf.write(anchor_wav, a, vsr)
        print("anchor:", transcribe(a), flush=True)

    track = np.zeros(int(DURATION * SR), dtype=np.float32)
    timing, qa = [], []
    for k, (start, text) in enumerate(lines):
        limit = (lines[k + 1][0] - GAP if k + 1 < len(lines) else DURATION - 0.4) - start
        best = None
        regen = not args.reuse or k in redo
        if regen:  # drop stale takes of an edited line
            for old in work.glob(f"line{k:02d}-take*.wav"):
                old.unlink()
        for take in range(args.takes):
            tf = work / f"line{k:02d}-take{take}.wav"
            if not regen and tf.exists():
                x, _ = sf.read(tf, dtype="float32")
            elif not regen:
                continue
            else:
                torch.manual_seed(1000 + k * 10 + take)
                x = tts.generate(text=text, prompt_wav_path=str(anchor_wav), prompt_text=ANCHOR,
                                 reference_wav_path=str(anchor_wav), cfg_value=2.0, inference_timesteps=10)
                x = trim(np.asarray(x, dtype=np.float32), vsr)
            hyp = transcribe(x)
            score = cer(text, hyp)
            dur = len(x) / vsr
            # penalise takes that would need heavy speed-up to fit
            fit = max(0.0, dur / limit - 1.0)
            print(f"[{k}] take {take}: CER {score:.3f}  {dur:.2f}s/{limit:.2f}s  «{hyp.strip()}»", flush=True)
            if regen:
                sf.write(tf, x, vsr)
            if best is None or score + fit * 2 < best[0]:
                best = (score + fit * 2, score, hyp, x, dur)
            if score <= 0.03 and fit == 0:
                break
        _, score, hyp, x, dur = best
        y = resample_poly(x, SR, vsr).astype(np.float32)
        if dur > limit:  # gentle time-compression (pitch-preserving), at most 12 %
            tempo = min(dur / limit, 1.12)
            with tempfile.TemporaryDirectory() as td:
                i, o = Path(td) / "i.wav", Path(td) / "o.wav"
                sf.write(i, y, SR)
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(i), "-af", f"atempo={tempo:.4f}", str(o)], check=True)
                y, _ = sf.read(o, dtype="float32")
            print(f"[{k}] time-compressed x{tempo:.3f}", flush=True)
        i0 = int(start * SR)
        y = y[: len(track) - i0]
        track[i0:i0 + len(y)] += y
        end = start + len(y) / SR
        timing.append({"start": start, "end": round(end, 2), "text": text})
        qa.append({"line": k, "text": text, "heard": hyp.strip(), "cer": round(score, 4)})
    track = track / (np.max(np.abs(track)) + 1e-9) * 0.89
    (ROOT / "audio").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "vo.wav"
        with wave.open(str(tmp), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((track * 32767).astype(np.int16).tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), str(ROOT / "audio" / f"vo-ar{suffix}.flac")], check=True)
    (ROOT / "audio" / f"vo-timing-ar{suffix}.json").write_text(json.dumps(timing, ensure_ascii=False, indent=2))
    (ROOT / "audio" / f"vo-ar{suffix}-qa.json").write_text(json.dumps(qa, ensure_ascii=False, indent=2))
    print("mean CER", round(sum(q["cer"] for q in qa) / len(qa), 4))


if __name__ == "__main__":
    main()
