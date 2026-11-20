#!/usr/bin/env bash
# Downloads the walkthrough video and poster for the release named in
# src/content/policyWalkthrough.json into a built site (default dist/media), replacing the
# committed fallback copied there from public/media. Public release URLs: no token needed.
# If the download fails, the fallback stays and a warning is printed; the build does not fail.
set -euo pipefail
cd "$(dirname "$0")/../.."
DEST=${1:-dist/media}
REPO=${GITHUB_REPOSITORY:-vaslabs/candt4cyprus}
RELEASE=$(node -p "require('./src/content/policyWalkthrough.json').release")
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
ok=1
for f in policy-walkthrough.mp4 policy-walkthrough.jpg; do
  curl -fsSL --retry 3 -o "$TMP/$f" "https://github.com/$REPO/releases/download/$RELEASE/$f" || ok=0
done
if [ "$ok" = 1 ] && head -c 8 "$TMP/policy-walkthrough.mp4" | tail -c 4 | grep -q ftyp; then
  mkdir -p "$DEST"
  mv "$TMP"/policy-walkthrough.* "$DEST/"
  echo "walkthrough: using release $RELEASE"
else
  echo "::warning::walkthrough release $RELEASE could not be downloaded; serving the committed fallback video"
fi
