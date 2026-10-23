"""Write YouTube captions (SRT) from a voiceover timing file.

    python scripts/make-srt.py audio/vo-timing-ar-play.json output/google-play/ar/captions-ar.srt

Long lines are split at a comma near the middle so no caption row is longer
than ~42 characters (YouTube's readable width).
"""
import json
import sys
from pathlib import Path

MAX = 42


def ts(t):
    ms = round(t * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def wrap(text):
    if len(text) <= MAX:
        return text
    cuts = [i for i, ch in enumerate(text) if ch in "،,:." and 0 < i < len(text) - 1]
    i = min(cuts, key=lambda c: abs(c - len(text) / 2)) if cuts else text.rfind(" ", 0, len(text) // 2 + 6)
    return text[: i + 1].strip() + "\n" + text[i + 1:].strip()


def main(src, dst):
    lines = json.loads(Path(src).read_text())
    out = []
    for n, l in enumerate(lines, 1):
        nxt = lines[n]["start"] - 0.05 if n < len(lines) else l["end"] + 1.0
        end = min(l["end"] + 0.3, nxt)  # linger briefly, never overlap the next caption
        out.append(f"{n}\n{ts(l['start'])} --> {ts(end)}\n{wrap(l['text'])}\n")
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    Path(dst).write_text("\n".join(out), encoding="utf-8")
    print(f"{dst}: {len(lines)} captions")


if __name__ == "__main__":
    main(*sys.argv[1:3])
