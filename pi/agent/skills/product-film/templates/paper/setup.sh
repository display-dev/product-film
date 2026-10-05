#!/usr/bin/env bash
# Route D setup, run by templates/new-film.sh after it copies the template:  bash <skill>/templates/paper/setup.sh <film>
# Fetches the fonts (kit and example artifact), makes a Python venv with numpy and Pillow, renders the engraved chart
# background and the per-format plates, synthesizes the sound set, and writes the notes skeleton.
# Safe to re-run: it never overwrites a file that already exists.
set -uo pipefail
DST=${1:?film folder}; DST="$(cd "$DST" && pwd)" && cd "$DST" || { echo "setup: cannot enter $1"; exit 1; }
mkdir -p capture/shots capture/fonts notes/checks out review deliver logs

[ -f NOTES.md ] || cat > NOTES.md <<'MD'
# Film notes

Keep this current before every session ends: the next session starts here.

- **Current cut:** (none yet)
- **Pipeline:** `film/render-all.sh vN`, then `tools/gates.py vN`; see notes/DECISIONS.md for why things are as they are.
- **Review page:** (where the team reviews this film: one page, many versions)
- **Rejected, and why:**
MD
[ -f notes/DECISIONS.md ] || cat > notes/DECISIONS.md <<'MD'
# Decisions log

Running log, newest at the bottom of each section. Every decision with its reason. tools/readme.py folds it into README.md.

## Preflight

## Truth sheet

## Story data

## Real product captures

## Facts the captures surfaced

## Script review (independent) – adjudication

## Build decisions

## Rough cut (self-review) – what changed

## Final review (independent) – adjudication
MD
[ -f notes/SCRIPT.md ] || cat > notes/SCRIPT.md <<'MD'
# Script

## Beat sheet

| Beat | Caption draft | Shot (harness, state, viewport) | Cast and pose |
|---|---|---|---|

## Captions

| Caption | Words | Minimum hold | Hold |
|---|---|---|---|
MD
[ -f notes/sources.md ] || cat > notes/sources.md <<'MD'
| Asset | Source | Licence |
|---|---|---|
| Product UI | The product's own code on fictional fixtures (`capture/`) | The product's own |
| Fictional artifact | Written for the film (`capture/artifact/`) | Made for the film |
| Fonts | Geist, Geist Mono (Vercel); Caveat Brush (Impallari Type); artifact fonts in `capture/fonts/` | OFL 1.1 |
| Background | The engraved chart, drawn in code (`tools/chart-background.html`) | Made for the film |
| Cast, paper, tape, marker, doodles | Drawn in code with seeded noise (`kit/`) | Made for the film |
| Sound effects | Synthesized in `sfx/synth.py` | Made for the film |

**Spend:** none

**Published for capture:** nothing
MD

echo "fonts"
node tools/fetch-fonts.mjs || echo "fonts: download failed; put geist.woff2, geist-mono.woff2 and caveat-brush.woff2 in kit/fonts (or set FONT_CACHE)"
node tools/fetch-fonts.mjs --to capture/fonts anton-latin.woff2=Anton manrope-latin.woff2=Manrope:wght@200..800 || echo "fonts: the example artifact's fonts did not download (capture/fonts)"

echo "python venv (numpy, Pillow)"
if [ ! -x .venv/bin/python ]; then python3 -m venv .venv && .venv/bin/pip install -q numpy pillow || echo "venv: pip install failed; install numpy and pillow into $DST/.venv by hand"; fi

echo "background"
node tools/make-chart-bg.mjs && .venv/bin/python tools/make-bg.py || echo "background: not composed (the engine falls back to a flat plate)"

echo "sound"
.venv/bin/python sfx/synth.py || echo "sound: not synthesized (needs numpy in .venv)"

cat <<TXT
Route D ready: $DST
Next: references/paper-collage.md § Procedure, from step 1 (truth sheet, beat sheet, fixture story, capture).
Check the template runs before you change it (any working directory):
  python3 "$DST/capture/artifact/build.py" && node "$DST/capture/artifact/check-layout.mjs"
  node "$DST/kit/build-kit.mjs" && node "$DST/kit/build-sheet.mjs"
  node "$DST/film/preview.mjs" 16x9 1,5,10,15,20 "" 1 1 1
TXT
