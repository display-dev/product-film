# Compose the per-format background plates: <film>/.venv/bin/python <film>/tools/make-bg.py
# Input: the engraved chart rendered by tools/make-chart-bg.mjs into backgrounds/ (16:9 on the plate, and lines only).
# 16:9 uses the full chart. The chart is drawn for 16:9 only, so 9:16 and 4:5 lay the lines-only copy on the plate
# colour (timeline.json brand.plate), scaled to the frame width and anchored to the bottom, so the valley frames the
# lower edge. Output: film/bg/bg-<fmt>.png at 2× (the engine's device scale). Without the chart files (or Pillow) the
# engine falls back to a flat plate in brand.plate, which is fine for previews but not for a cut.
import json, os, sys
from PIL import Image
F = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = os.path.join(F, 'backgrounds')
tl = json.load(open(os.path.join(F, 'film', 'timeline.json'))); SIZES = {'16x9': (1920, 1080), '9x16': (1080, 1920), '4x5': (1080, 1350)}
full_p, lines_p = os.path.join(SRC, 'engraved-chart-3840x2160.png'), os.path.join(SRC, 'engraved-chart-lines-3840x2160.png')
if not (os.path.exists(full_p) and os.path.exists(lines_p)):
    sys.exit(f'no chart in {SRC}: run  node "{F}/tools/make-chart-bg.mjs"  first (the engine uses a flat plate until then)')
hexc = tl.get('brand', {}).get('plate', '#F3F3F3').lstrip('#')
plate = tuple(int(hexc[i:i + 2], 16) for i in (0, 2, 4)) if len(hexc) == 6 else (243, 243, 243)
os.makedirs(os.path.join(F, 'film', 'bg'), exist_ok=True)
full = Image.open(full_p).convert('RGB'); lines = Image.open(lines_p).convert('RGBA')
for fmt in tl.get('formats', ['16x9', '9x16']):
    W, H = (v * 2 for v in SIZES[fmt])
    if W * 9 == H * 16: im = full.resize((W, H), Image.LANCZOS)
    else:
        im = Image.new('RGB', (W, H), plate); ln = lines.resize((W, round(W * lines.height / lines.width)), Image.LANCZOS)
        im.paste(ln, (0, H - ln.height), ln)
    im.save(os.path.join(F, 'film', 'bg', f'bg-{fmt}.png')); print('bg', fmt, im.size)
