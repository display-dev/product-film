#!/bin/bash
# Render and assemble every output the timeline lists ("outputs": [[fmt, cap], …]): bash <film>/film/render-all.sh vN [workers]
# Works from any directory. Old frames of each output are removed first, so a shorter cut leaves no strays.
F="$(cd "$(dirname "$0")/.." && pwd)"; V=${1:?version, e.g. v1}; W=${2:-6}
# a re-render of the same version starts clean: fresh SFX mix (cues may have moved) and fresh checks (no stale failures)
rm -f "$F/out/$V/sfx.wav" "$F/out/$V/checks.txt"
while read -r FMT CAP; do
  rm -rf "$F/frames/$FMT$([ "$CAP" = 0 ] && echo -nocap)"
  bash "$F/film/jobs.sh" "$FMT" "$CAP" "$W" < /dev/null && bash "$F/film/assemble.sh" "$FMT" "$CAP" "$V" < /dev/null || { echo "FAILED $FMT $CAP"; exit 1; }
done < <(python3 -c "import json,sys;[print(f,c) for f,c in json.load(open(sys.argv[1]))['outputs']]" "$F/film/timeline.json")
echo ALL-DONE
