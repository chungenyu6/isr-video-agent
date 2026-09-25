#!/usr/bin/env bash
# Re-encode the twelve Against-Traffic clips as browser-playable H.264 proxies.
#
# The source clips are MPEG-4 Part 2 (mp4v), which browsers do not decode. The
# proxies keep 960x540, 10 fps and every frame, because the viewer maps video time
# to frame index and draws ground-truth boxes in source pixel coordinates. The
# frame count of every proxy is checked against ITS OWN SOURCE; a mismatch is a hard
# failure. It used to be checked against a literal 349, which is the frame count of a
# dataset that was replaced on 2026-09-22 by a 199-frame regeneration.
#
# Usage: bash tools/make_proxies.sh [output_dir]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
SRC="${EXPERIMENT_ROOT:-/home/isr-video-agent}/Test_Against_Traffic"
OUT="${1:-app/public/video}"
mkdir -p "$OUT"

for dir in "$SRC"/*/; do
  clip="$(basename "$dir")"
  [ -f "$dir/video.mp4" ] || continue
  dest="$OUT/$clip.mp4"
  ffmpeg -nostdin -y -loglevel error -i "$dir/video.mp4" \
    -c:v libx264 -pix_fmt yuv420p -preset slow -crf 24 -r 10 -g 10 \
    -movflags +faststart -an "$dest"
  n="$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$dest")"
  want="$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$dir/video.mp4")"
  if [ "$n" != "$want" ]; then echo "FAIL $clip: $n frames, source has $want" >&2; exit 1; fi
  printf "  ok  %-18s %s frames %6s KB\n" "$clip" "$n" "$(( $(stat -c%s "$dest") / 1024 ))"
done
echo "total: $(du -sh "$OUT" | cut -f1)"
