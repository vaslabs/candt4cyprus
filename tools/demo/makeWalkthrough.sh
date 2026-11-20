#!/usr/bin/env bash
# Records the policy-maker walkthrough (1920×1080, English captions) and encodes it for the web.
# Requires ffmpeg. Outputs, all committed and served by the app:
#   public/media/policy-walkthrough.mp4   H.264, no audio track, faststart
#   public/media/policy-walkthrough.jpg   poster frame
#   src/content/policyWalkthrough.json    timed transcript shown under the video
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=tools/demo/out/walkthrough
[ "${SKIP_RECORD:-0}" = 1 ] || npx playwright test -c tools/demo/playwright.walkthrough.config.ts "$@"
mkdir -p public/media src/content
# Variable-rate screencast frames -> constant 30 fps. Screen content compresses well at CRF 30.
ffmpeg -loglevel error -y -f concat -safe 0 -i "$OUT/frames.txt" \
  -vf "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p" \
  -c:v libx264 -profile:v high -preset slow -crf 30 -tune stillimage -an \
  -movflags +faststart public/media/policy-walkthrough.mp4
# Poster: the opening question card.
ffmpeg -loglevel error -y -ss 3 -i public/media/policy-walkthrough.mp4 -frames:v 1 \
  -vf "scale=1280:-2" -q:v 4 public/media/policy-walkthrough.jpg
cp "$OUT/transcript.json" src/content/policyWalkthrough.json
npx prettier --write src/content/policyWalkthrough.json >/dev/null
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,codec_name \
  -of compact public/media/policy-walkthrough.mp4
ls -l public/media/policy-walkthrough.jpg
