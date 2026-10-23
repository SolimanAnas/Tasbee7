"""Generate the Google Play QR code and prove it decodes to the exact URL.

    python scripts/make-qr.py   (needs: qrcode, pillow, opencv-python-headless)
"""
import sys
from pathlib import Path

import cv2
import numpy as np
import qrcode
from PIL import Image

URL = "https://play.google.com/store/apps/details?id=io.github.solimananas.twa"
OUT = Path(__file__).resolve().parent.parent / "assets" / "brand"


def make(path, fg, bg):
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q, box_size=24, border=2)
    qr.add_data(URL)
    qr.make(fit=True)
    qr.make_image(fill_color=fg, back_color=bg).convert("RGB").save(path)
    return path


def decode(path):
    img = cv2.imread(str(path))
    data, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    if data:
        return data
    # Retry at a smaller scale (detector prefers modest sizes).
    small = cv2.resize(img, None, fx=0.4, fy=0.4, interpolation=cv2.INTER_AREA)
    data, _, _ = cv2.QRCodeDetector().detectAndDecode(small)
    return data


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    # Deep midnight-green modules on warm ivory: on-brand yet high contrast.
    p = make(OUT / "qr-google-play.png", (6, 31, 26), (250, 246, 236))
    got = decode(p)
    print("decoded:", got)
    if got != URL:
        sys.exit("QR verification FAILED")
    if len(sys.argv) > 1:  # optional: decode a rendered video frame
        print("frame decoded:", decode(Path(sys.argv[1])))
    print("QR verification OK")
