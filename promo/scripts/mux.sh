#!/usr/bin/env bash
# Combine a rendered (silent) video with the final mix into a delivery MP4.
#   scripts/mux.sh landscape zad-al-muslim-hero.mp4 [8M] [mix.flac]
set -euo pipefail
cd "$(dirname "$0")/.."
FMT=$1; NAME=$2; CAP=${3:-8M}; MIX=${4:-mix.flac}
# H.264 High, CRF 19 with a bitrate cap (8 Mb/s for 1080p): near-identical
# to a 12 Mb/s encode (SSIM -0.004) at two thirds of the size. AAC 192 kb/s.
ffmpeg -y -loglevel error -i "build/video-$FMT.mp4" -i "audio/$MIX" \
  -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset slow -crf 19 -maxrate "$CAP" -bufsize "$(( ${CAP%M} * 2 ))M" -profile:v high -level 4.2 \
  -pix_fmt yuv420p -r 30 -g 60 -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart -shortest -metadata title="Zad Al-Muslim — Make space for what matters" \
  "output/$NAME"
ls -la "output/$NAME"
