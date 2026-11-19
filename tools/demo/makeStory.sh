#!/usr/bin/env bash
# Records the Instagram story (1080×1920, Greek captions) and encodes it as H.264 MP4.
# Requires ffmpeg. Output: tools/demo/out/story/candt4cyprus-story.mp4
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=tools/demo/out/story
[ "${SKIP_RECORD:-0}" = 1 ] || npx playwright test -c tools/demo/playwright.story.config.ts "$@"
# Variable-rate screencast frames -> constant 30 fps; a silent AAC track for platform compatibility.
ffmpeg -loglevel error -y -f concat -safe 0 -i "$OUT/frames.txt" \
  -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
  -vf "scale=1080:1920:flags=lanczos,fps=30,format=yuv420p" \
  -c:v libx264 -profile:v high -preset slow -crf 18 -c:a aac -b:a 64k -shortest \
  -movflags +faststart "$OUT/candt4cyprus-story.mp4"
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,codec_name \
  -of compact "$OUT/candt4cyprus-story.mp4"
