#!/bin/bash
# Render one output across parallel workers: bash <film>/film/jobs.sh <fmt> <cap 1|0> [workers]
# About one worker per two cores. Works from any directory: Playwright loads through <film>/pw.cjs.
F="$(cd "$(dirname "$0")/.." && pwd)"
FMT=${1:-16x9}; CAP=${2:-1}; W=${3:-6}
N=$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(round(d['duration']*d['fps']))" "$F/film/timeline.json")
mkdir -p "$F/logs"
for i in $(seq 0 $((W-1))); do
  A=$(( N * i / W )); Z=$(( N * (i+1) / W ))
  node "$F/film/render.mjs" "$FMT" "$CAP" $A $Z > "$F/logs/render-$FMT-$CAP-$i.log" 2>&1 &
done
wait
grep -h "done\|PAGEERROR\|Error" "$F"/logs/render-$FMT-$CAP-*.log
ls "$F/frames/$FMT$([ "$CAP" = 0 ] && echo -nocap)" | grep -c '^f_.*\.jpg$' | xargs echo "frames:"; echo "expected: $N"
