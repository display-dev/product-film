# Review tools for a master (you read frames, not video, so measure motion):
#   .venv/bin/python tools/review.py <master.mov> <fmt> <outdir>
#  1. sheet-phone.jpg  – a frame every 2 s at phone width (390 px); 9:16 gets the platform safe-zone box
#                        (timeline "safeZones"), so captions, labels and zooms in the bands show at a glance
#  2. trans-<n>.jpg    – every frame for 0.5 s either side of each scene boundary and each camera/swap cue
#  3. diff-trace.png   – mean absolute difference between consecutive frames, scene boundaries and captions marked
#     diff-spikes.txt  – every spike labelled with the nearest timeline event, or UNEXPLAINED; plus runs of 4+
#                        changing frames (motion that is not on 2s; counted as UNEXPLAINED)
# Every UNEXPLAINED spike is a defect until a transition strip proves otherwise (a pop, a double draw, a flash).
import json, os, re, subprocess, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
master, fmt, out = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(out, exist_ok=True)
tl = json.load(open(f'{F}/film/timeline.json')); FPS = tl['fps']; N = round(tl['duration'] * FPS)
W, H = {'16x9': (1920, 1080), '9x16': (1080, 1920), '4x5': (1080, 1350)}[fmt]
MARK = re.compile(tl.get('review', {}).get('markCues', r'^(in|zoom\w*|pan|back|swap|click|editor|out|v\d)$'))
try: FONT = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)
except Exception: FONT = ImageFont.load_default()

def frames(w, h, select=None):
    vf = f'scale={w}:{h}:flags=area' + (f',select={select}' if select else '')
    p = subprocess.Popen(['ffmpeg', '-nostdin', '-v', 'error', '-i', master, '-vf', vf, '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE); sz = w * h * 3
    while True:
        b = p.stdout.read(sz)
        if len(b) < sz: break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)

# 1. phone-size contact sheet, every 2 s
pw = 390; ph = round(H * pw / W); step = 2 * FPS; idx = list(range(0, N, step)); tiles = []; z = tl.get('safeZones', {}).get(fmt)
for k, fr in enumerate(frames(pw, ph, f"'not(mod(n\\,{step}))'")):
    im = Image.fromarray(fr.copy()); d = ImageDraw.Draw(im)
    if z: s = pw / W; d.rectangle([z.get('left', 0) * s, z.get('top', 0) * s, (W - z.get('right', 0)) * s, (H - z.get('bottom', 0)) * s], outline=(255, 0, 180), width=2)
    d.rectangle([0, 0, 62, 18], fill=(0, 0, 0)); d.text((4, 2), f'{idx[k] / FPS:05.1f}s', fill=(255, 255, 255), font=FONT); tiles.append(im)
cols = 6 if fmt == '16x9' else 8; rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (pw + 6), rows * (ph + 6)), 'white')
for i, im in enumerate(tiles): sheet.paste(im, ((i % cols) * (pw + 6), (i // cols) * (ph + 6)))
sheet.save(f'{out}/sheet-phone.jpg', quality=88)

# 3. difference trace (small grey frames)
sw, sh = (320, 180) if fmt == '16x9' else (180, 320) if fmt == '9x16' else (216, 270)
prev = None; mad = []
for fr in frames(sw, sh):
    g = fr.astype(np.float32).mean(2)
    if prev is not None: mad.append(float(np.abs(g - prev).mean()))
    prev = g
mad = np.array(mad)  # mad[i] = change from frame i to i+1
events = []
for s in tl['scenes']:
    events += [(s['start'], f"{s['id']} start"), (s['end'], f"{s['id']} end")]
    for c, v in s.get('cues', {}).items(): events.append((s['start'] + v, f"{s['id']}.{c}"))
for c in tl['captions']: events += [(c['start'], f"{c['id']} in"), (c['end'], f"{c['id']} out")]
events.sort()
def nearest(t):
    best = min(events, key=lambda e: abs(e[0] - t)); return best if abs(best[0] - t) <= 0.5 else None
thr = max(6.0, float(np.percentile(mad, 99)))
spikes = [(i, v) for i, v in enumerate(mad) if v >= thr]; unexplained = 0
with open(f'{out}/diff-spikes.txt', 'w') as fh:
    fh.write(f'threshold {thr:.2f} (mean {mad.mean():.2f}, median {np.median(mad):.2f})\n')
    for i, v in spikes:
        t = (i + 1) / FPS; e = nearest(t); unexplained += e is None
        fh.write(f'{t:6.2f}s  mad {v:6.2f}  ' + (f'near {e[1]} ({e[0]:.2f}s)' if e else 'UNEXPLAINED') + '\n')
    # Motion on 2s plus boil on 3s changes at most 3 frames in a row (frames 2, 3, 4 of every 6). A run of 4 or
    # more means something moves every frame: a slide or camera driven by unstepped time, or a caption off the grid.
    run = 0
    for i, v in enumerate(mad):
        run = run + 1 if v > 0.4 else 0
        if run == 4: fh.write(f'{(i + 1) / FPS:6.2f}s  UNEXPLAINED: 4+ consecutive changing frames (motion not on 2s)\n'); unexplained += 1
PW, PH = 2400, 520; img = Image.new('RGB', (PW, PH), 'white'); d = ImageDraw.Draw(img)
top = max(mad.max(), 1); X = lambda i: 40 + i * (PW - 60) / len(mad); Y = lambda v: PH - 40 - v / top * (PH - 80)
for s in tl['scenes']: x = X(s['start'] * FPS); d.line([x, 20, x, PH - 40], fill=(120, 120, 255), width=2); d.text((x + 3, 22), s['id'], fill=(60, 60, 200), font=FONT)
for c in tl['captions']: d.rectangle([X(c['start'] * FPS), PH - 36, X(c['end'] * FPS), PH - 28], fill=(60, 170, 90))
d.line([(X(i), Y(v)) for i, v in enumerate(mad)], fill=(20, 20, 20), width=1)
d.line([40, Y(thr), PW - 20, Y(thr)], fill=(230, 60, 60), width=1)
for t in range(0, int(tl['duration']) + 1, 5): d.text((X(t * FPS) - 6, PH - 22), f'{t}s', fill=(0, 0, 0), font=FONT)
img.save(f'{out}/diff-trace.png')

# 2. transition strips: every frame ±0.5 s around each scene boundary and each camera/swap cue
marks = sorted({round(s['start'], 2) for s in tl['scenes'] if s['start'] > 0} | {round(s['start'] + v, 2) for s in tl['scenes'] for c, v in s.get('cues', {}).items() if MARK.match(c)})
half = FPS // 2; want = set()
for m in marks: want |= set(range(max(0, round(m * FPS) - half), min(N, round(m * FPS) + half + 1)))
tw = 240; th = round(H * tw / W); got = {}
for i, fr in enumerate(frames(tw, th)):
    if i in want: got[i] = fr.copy()
for k, m in enumerate(marks):
    ids = [i for i in range(round(m * FPS) - half, round(m * FPS) + half + 1) if i in got]; cols = 8; rows = (len(ids) + cols - 1) // cols
    strip = Image.new('RGB', (cols * (tw + 4), rows * (th + 4)), 'white')
    for j, i in enumerate(ids):
        im = Image.fromarray(got[i]); dd = ImageDraw.Draw(im); dd.rectangle([0, 0, 50, 14], fill=(0, 0, 0)); dd.text((2, 1), f'{i}', fill=(255, 255, 255), font=FONT)
        strip.paste(im, ((j % cols) * (tw + 4), (j // cols) * (th + 4)))
    strip.save(f'{out}/trans-{k:02d}-{m:05.2f}s.jpg', quality=85)
print(f'sheet, trace; spikes {len(spikes)}, UNEXPLAINED {unexplained}; transition strips {len(marks)} → {out}')
