#!/usr/bin/env bash
# Build a cut's review page and publish it as the film's recorded answer says (SKILL.md § Inputs, 6; references/publish.md).
# Every cut ends here: a cut is delivered only with its review page, the URL (or, with "no", the file's path) leading the reply.
# Usage, from any directory: bash <film>/tools/review.sh vN <film.mp4> ["Film title"] [--build-only]   (paper route: no film argument)
#   Builds review/review-vN.html (the paper route's tools/build-review.py when present, else tools/review-page.py), then
#   reads review/.publish, written once per film from FILM.md or the user's answer:
#     company | share:<email>,<email> | private | public   publish with the dsp CLI as a new version of the film's one
#                                                          page (its shortId is kept in review/.shortid)
#     anonymous   a 30-day preview with the skill's scripts/publish.sh (no account; claimable, not versionable)
#     no          build only
#   With no review/.publish it builds the page and stops (exit 3): ask the user once, write the answer, run it again.
#   --build-only stops after the build: use it when the host has a display.dev MCP publish tool (tier 1), then publish
#   the file with that tool as review/.publish says and write the returned shortId to review/.shortid.
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
if [ -n "$BUILD_ONLY" ]; then echo "built $F/$PAGE: publish it now as review/.publish says (references/publish.md, tier 1), then record the shortId in review/.shortid"; exit 0; fi
if [ ! -s review/.publish ]; then
  echo "built $F/$PAGE. Where should review pages go? Not settled for this film: use FILM.md's answer, or ask the user once"
  echo "(company, share:<emails>, private, public, anonymous, no), write it to $F/review/.publish and to NOTES.md, and run this again."
  exit 3
fi
MODE=$(tr -d '[:space:]' < review/.publish)
if [ "$MODE" = no ]; then echo "built $F/$PAGE (review/.publish: no, nothing published): give this path in the reply"; exit 0; fi
SRC=product-film-skill@0.3.0; ACTOR=${PRODUCT_FILM_ACTOR:-product-film-agent}
if [ "$MODE" = anonymous ]; then
  SKILL=${PRODUCT_FILM_SKILL_DIR:-$( [ -f .skill-dir ] && cat .skill-dir || true )}
  [ -n "$SKILL" ] && [ -f "$SKILL/scripts/publish.sh" ] || { echo "no skill dir (.skill-dir): publish $F/$PAGE by hand (references/publish.md)"; exit 1; }
  bash "$SKILL/scripts/publish.sh" "$PAGE" --name "$TITLE – review"
  echo "anonymous preview: later cuts need the CLI after the page is claimed (dsp login)"
else
  command -v dsp >/dev/null || { echo "no dsp CLI: install it (npm i -g @displaydev/cli) and run dsp login, or ask the user whether an anonymous preview is all right and write 'anonymous' to review/.publish"; exit 1; }
  case "$MODE" in
    company) VIS=(--company);;
    private|public) VIS=(--visibility "$MODE");;
    share:*) VIS=(--company --share-with "${MODE#share:}");;
    *) echo "review/.publish says '$MODE': use company, share:<emails>, private, public, anonymous or no"; exit 2;;
  esac
  if [ -s review/.shortid ]; then   # a later cut: a new version of the same page, which keeps its visibility
    ID=$(cat review/.shortid)
    BASE=$(dsp get-metadata "$ID" | python3 -c "import json,sys; print(json.load(sys.stdin)['currentVersion'])")
    OUT=$(dsp publish "$PAGE" --id "$ID" --base-version "$BASE" --client-source "$SRC" --actor-type agent --actor-name "$ACTOR" 2>&1)
  else
    OUT=$(dsp publish "$PAGE" --name "$TITLE – review" "${VIS[@]}" --client-source "$SRC" --actor-type agent --actor-name "$ACTOR" 2>&1)
    python3 -c "import re,sys; m=re.search(r'\(([A-Za-z0-9]{6,})\)', sys.argv[1]); m and open('review/.shortid','w').write(m.group(1))" "$OUT"
  fi
  echo "$OUT"
fi
echo "next: put the review page URL first in the reply; the next cut is: bash tools/review.sh v$(( ${V#v} + 1 )) <film.mp4>"
