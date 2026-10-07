#!/usr/bin/env bash
# Build and publish a cut's review page in one step (references/publish.md). Every cut ends here: a cut is delivered
# only when its review page is published and its URL leads the reply.
# Usage, from any directory: bash <film>/tools/review.sh vN <film.mp4> ["Film title"] [--build-only]   (paper route: no film argument)
#   Builds review/review-vN.html (the paper route's tools/build-review.py when present, else tools/review-page.py), then
#   publishes it: with the dsp CLI as a new version of the film's one page (its shortId is kept in review/.shortid), or,
#   without the CLI, as an anonymous 30-day preview with the skill's scripts/publish.sh (claimable, not versionable).
#   --build-only stops after the build: use it when the host has a display.dev MCP publish tool (tier 1), then publish
#   the file with that tool and write the returned shortId to review/.shortid.
set -euo pipefail
F="$(cd "$(dirname "$0")/.." && pwd)"
V=${1:?vN}; V=v${V#v}; shift
FILM=; TITLE=; BUILD_ONLY=
for a in "$@"; do case "$a" in --build-only) BUILD_ONLY=1;; *.mp4|*.mov) FILM=$a;; *) TITLE=$a;; esac; done
TITLE=${TITLE:-$(basename "$F")}
cd "$F"
[ -f tools/build-review.py ] || [ -n "$FILM" ] || { echo "usage: review.sh vN <film.mp4> [\"title\"] [--build-only]"; exit 2; }
if [ -f tools/build-review.py ]; then python3 tools/build-review.py "$V"; else python3 tools/review-page.py "$V" "$FILM" --title "$TITLE"; fi
PAGE="review/review-$V.html"; [ -f "$PAGE" ] || { echo "no $PAGE"; exit 1; }
if [ -n "$BUILD_ONLY" ]; then echo "built $F/$PAGE: publish it now (references/publish.md, tier 1), then record the shortId in review/.shortid"; exit 0; fi
SRC=product-film-skill@0.3.0; ACTOR=${PRODUCT_FILM_ACTOR:-product-film-agent}
if command -v dsp >/dev/null; then
  if [ -s review/.shortid ]; then
    ID=$(cat review/.shortid)
    BASE=$(dsp get-metadata "$ID" | python3 -c "import json,sys; print(json.load(sys.stdin)['currentVersion'])")
    OUT=$(dsp publish "$PAGE" --id "$ID" --base-version "$BASE" --client-source "$SRC" --actor-type agent --actor-name "$ACTOR" 2>&1)
  else
    OUT=$(dsp publish "$PAGE" --name "$TITLE – review" --company --client-source "$SRC" --actor-type agent --actor-name "$ACTOR" 2>&1)
    python3 -c "import re,sys; m=re.search(r'\(([A-Za-z0-9]{6,})\)', sys.argv[1]); m and open('review/.shortid','w').write(m.group(1))" "$OUT"
  fi
  echo "$OUT"
else
  SKILL=${PRODUCT_FILM_SKILL_DIR:-$( [ -f .skill-dir ] && cat .skill-dir || true )}
  [ -n "$SKILL" ] && [ -f "$SKILL/scripts/publish.sh" ] || { echo "no dsp CLI and no skill dir (.skill-dir): publish $F/$PAGE by hand (references/publish.md)"; exit 1; }
  bash "$SKILL/scripts/publish.sh" "$PAGE" --name "$TITLE – review"
  echo "anonymous preview: later cuts need the CLI after the page is claimed (dsp login)"
fi
echo "next: put the review page URL first in the reply; the next cut is: bash tools/review.sh v$(( ${V#v} + 1 )) <film.mp4>"
