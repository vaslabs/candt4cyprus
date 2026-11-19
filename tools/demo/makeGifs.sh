#!/usr/bin/env bash
# Records the captioned demo walkthroughs with Playwright and converts them to README GIFs.
# Requires ffmpeg. Usage: npm run demo:gifs [-- <test-name-filter>]
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=tools/demo/out
MEDIA=docs/media
WIDTH=${GIF_WIDTH:-800}
FPS=${GIF_FPS:-7}
COLORS=${GIF_COLORS:-64}
mkdir -p "$MEDIA"
# SKIP_RECORD=1 re-encodes existing recordings without running the browser again.
[ "${SKIP_RECORD:-0}" = 1 ] || npx playwright test -c tools/demo/playwright.demo.config.ts "$@"
for json in "$OUT"/*.json; do
  name=$(basename "$json" .json)
  start=$(node -p "require('./$json').start")
  end=$(node -p "require('./$json').end")
  dur=$(node -p "Math.max(1, $end - $start).toFixed(2)")
  ffmpeg -loglevel error -y -ss "$start" -t "$dur" -i "$OUT/$name.webm" \
    -vf "fps=$FPS,scale=$WIDTH:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=$COLORS:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
    "$MEDIA/$name.gif"
  echo "$MEDIA/$name.gif ($(du -h "$MEDIA/$name.gif" | cut -f1), ${dur}s)"
done
