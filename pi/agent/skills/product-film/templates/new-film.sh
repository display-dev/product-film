#!/usr/bin/env bash
# Start a film folder from a template:
#   bash <skill>/templates/new-film.sh <cinematic|walkthrough|paper> <film folder>
# Copies the route's template and the shared helpers (common/), makes sure Playwright and its Chromium resolve from
# the folder (installing them there once if they do not), then runs the route's own setup.sh if it has one.
# Safe to re-run: it never overwrites a file that already exists.
set -euo pipefail
T="$(cd "$(dirname "$0")" && pwd)"
ROUTE=${1:?route: cinematic, walkthrough or paper}
DST=${2:?film folder}
[ -d "$T/$ROUTE" ] && [ "$ROUTE" != common ] || { echo "unknown route: $ROUTE (cinematic, walkthrough or paper)"; exit 1; }
mkdir -p "$DST"; DST="$(cd "$DST" && pwd)"
if [ -z "${PRODUCT_FILM_ALLOW_TMP:-}" ]; then
  case "$DST" in /tmp/*|/private/tmp/*|/private/var/folders/*|/var/folders/*|*/scratchpad*)
    rmdir "$DST" 2>/dev/null || true; echo "refusing: $DST is a temporary folder. A film takes several sessions; use a folder that persists."; exit 1;;
  esac
fi

rsync -a --ignore-existing --exclude setup.sh "$T/$ROUTE/" "$DST/"
rsync -a --ignore-existing "$T/common/" "$DST/"

cd "$DST"
if ! node -e "require('./pw.cjs')" >/dev/null 2>&1; then
  echo "Playwright: installing into $DST (once per film folder)"
  [ -f package.json ] || npm init -y >/dev/null
  npm i -D --silent playwright
fi
if ! node -e "const { chromium } = require('./pw.cjs'); process.exit(require('node:fs').existsSync(chromium.executablePath()) ? 0 : 1)" 2>/dev/null; then
  echo "Playwright: downloading Chromium (once per machine)"
  PW_PKG=$(node -e "console.log(require.resolve('playwright/package.json', { paths: [process.env.PLAYWRIGHT_DIR || process.cwd()] }))")
  node "$(dirname "$PW_PKG")/cli.js" install chromium
fi
command -v ffmpeg >/dev/null || echo "warning: ffmpeg is not on PATH; rendering needs it (with libx264)"

if [ -f "$T/$ROUTE/setup.sh" ]; then bash "$T/$ROUTE/setup.sh" "$DST"; fi
echo "ready: $DST ($ROUTE)"
