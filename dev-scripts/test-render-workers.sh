#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FAILED=0

run_case() {
  local name="$1"
  local failures="$2"
  local expected="$3"
  local prefill="${4:-0}"
  local dir="$TMP/$name"
  local status=0

  mkdir -p "$dir/film" "$dir/frames/16x9"

  cp "$ROOT/product-film/templates/paper/film/jobs.sh" \
    "$dir/film/jobs.sh"

  printf '{"duration":1,"fps":6}\n' \
    > "$dir/film/timeline.json"

  cat > "$dir/film/render.mjs" <<'JS'
import fs from 'node:fs';

const [, , fmt, cap, from, to] = process.argv;
const failures = (process.env.FAIL_WORKERS || '').split(',');

if (failures.includes(from)) {
  console.error(`Error: worker ${from} failed`);
  process.exit(1);
}

await new Promise(resolve => setTimeout(resolve, 150));

for (let i = Number(from); i < Number(to); i++) {
  const name = String(i).padStart(5, '0');
  fs.writeFileSync(
    new URL(`../frames/${fmt}/f_${name}.jpg`, import.meta.url),
    ''
  );
}

console.log(`done ${from}`);
JS

  if [ "$prefill" = 1 ]; then
    for i in 0 1 2 3 4 5; do
      touch "$dir/frames/16x9/f_$(printf '%05d' "$i").jpg"
    done
  fi

  FAIL_WORKERS="$failures" \
    bash "$dir/film/jobs.sh" 16x9 1 3 \
    > "$dir/result.log" 2>&1 || status=$?

  if { [ "$expected" = success ] && [ "$status" -ne 0 ]; } ||
     { [ "$expected" = failure ] && [ "$status" -eq 0 ]; }; then
    echo "FAIL: $name (exit $status, expected $expected)"
    cat "$dir/result.log"
    FAILED=1
  else
    echo "PASS: $name"
  fi

  if [ "$expected" = success ]; then
    for i in 0 1 2 3 4 5; do
      if [ ! -f "$dir/frames/16x9/f_$(printf '%05d' "$i").jpg" ]; then
        echo "FAIL: $name missing frame $i"
        FAILED=1
      fi
    done
  fi

  for start in 0 2 4; do
    case ",$failures," in
      *",$start,"*) continue ;;
    esac

    if ! grep -q "^done $start$" "$dir/result.log"; then
      echo "FAIL: $name did not finish worker $start"
      FAILED=1
    fi
  done
}

run_case "all workers succeed" "" success
run_case "first worker fails" "0" failure
run_case "last worker fails" "4" failure
run_case "multiple workers fail" "0,2" failure
run_case "all workers fail" "0,2,4" failure
run_case "existing frames with failed worker" "0" failure 1

exit "$FAILED"
