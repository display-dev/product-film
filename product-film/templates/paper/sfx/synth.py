# Synthesize the film's pen-and-paper foley from physical models (no samples, no licences needed).
# .venv/bin/python sfx/synth.py  → sfx/wav/<name>.wav (48 kHz, mono, 24-bit). Every sound is seeded, so re-runs are identical.
#
# Rules (a first set was rejected in review as unpleasant and unlike writing; these closed it):
# no pitched tones anywhere (the rejected set had a stick-slip marker squeak at 0.8–1.2 kHz, pops sweeping 900 → 260 Hz,
# and low bodies under clicks and keys), and nothing below ~400 Hz (save() high-passes every sound at 420 Hz).
# Marker and label sounds are a pen scratching paper: granular fibre friction in the 1.5–9 kHz band, shaped as strokes.
# Target measurements: 0 % of energy below 300 Hz, spectral centroid 4.7–6.7 kHz, spectral flatness 0.2–0.35.
# Sound names used by timeline.json sfx cues: place1-4, slide1-3, tape1-3, marker1 (circle), marker2/3 (lettering),
# marker4 (an X), marker-long (long circle / highlighter), pop1-4 (pen-tip taps), click1-3, key1-6, stamp.
import numpy as np, wave, os
SR = 48000
OUT = os.path.join(os.path.dirname(__file__), 'wav'); os.makedirs(OUT, exist_ok=True)

def band(x, lo, hi, order=4):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = (1 / np.sqrt(1 + (f / hi) ** (2 * order))) * (1 - 1 / np.sqrt(1 + (f / max(lo, 1)) ** (2 * order)))
    return np.fft.irfft(X * g, len(x))
def fade(x, a=0.002, d=0.01):
    n = len(x); a = max(1, int(a * SR)); d = max(1, int(d * SR)); e = np.ones(n); e[:a] = np.linspace(0, 1, a); e[-d:] *= np.linspace(1, 0, d); return x * e
def norm(x, peak=0.9): m = np.max(np.abs(x)); return x * (peak / m) if m > 0 else x
def save(name, x):
    x = band(x, 420, 16000, 3)            # safety: nothing below ~400 Hz reaches the mix
    x = norm(fade(x)); x = np.concatenate([x, np.zeros(int(0.01 * SR))])
    d = (np.clip(x, -1, 1) * (2 ** 23 - 1)).astype(np.int32)
    b = np.zeros(len(d) * 3, dtype=np.uint8); b[0::3] = d & 255; b[1::3] = (d >> 8) & 255; b[2::3] = (d >> 16) & 255
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w: w.setnchannels(1); w.setsampwidth(3); w.setframerate(SR); w.writeframes(b.tobytes())

def grains(n, rate, rng, dec=(0.0003, 0.0012)):
    """Fibre friction: a dense train of tiny noise grains (the nib catching paper fibres). rate: events/s (array or scalar)."""
    x = np.zeros(n); t = 0.0; r_arr = np.broadcast_to(rate, (n,)) if np.ndim(rate) else None
    while True:
        r = r_arr[min(n - 1, int(t * SR))] if r_arr is not None else rate
        t += rng.exponential(1 / max(r, 1.0)); i = int(t * SR)
        if i >= n: break
        L = int(SR * 0.004); tt = np.arange(L) / SR; g = rng.standard_normal(L) * np.exp(-tt / rng.uniform(*dec)) * rng.uniform(0.25, 1.0)
        j = min(n, i + L); x[i:j] += g[:j - i]
    return x

def pen_stroke(rng, dur, speed_shape='swell', bright=1.0):
    """One pen stroke on paper: granular scratch + a little smooth hiss; loudness and brightness follow nib speed."""
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    if speed_shape == 'swell': speed = np.sin(np.pi * np.clip(u, 0, 1)) ** 0.8
    else: speed = np.clip(1 - np.abs(u - 0.35) * 1.4, 0.15, 1)
    speed = speed * (0.85 + 0.15 * np.sin(2 * np.pi * rng.uniform(5, 9) * t + rng.uniform(0, 6)))   # hand wobble
    scratch = grains(n, 900 + 2600 * speed, rng)
    lo, hi = 1500 * bright, 8500 * bright
    scratch = band(scratch, lo, hi, 3)
    hiss = band(rng.standard_normal(n), 2500 * bright, 9000, 3) * 0.18
    return (scratch + hiss) * (0.15 + 0.85 * speed)

def pen_write(seed, dur=0.34, strokes=None):
    """Hand-lettering: several short strokes with lifts between them (the rhythm of writing a word)."""
    rng = np.random.default_rng(seed); n = int(dur * SR); x = np.zeros(n); t = 0.004
    while t < dur - 0.03:
        d = rng.uniform(0.035, 0.09); s = pen_stroke(rng, d, 'dash', rng.uniform(0.9, 1.15)) * rng.uniform(0.6, 1.0)
        i = int(t * SR); j = min(n, i + len(s)); x[i:j] += s[:j - i]; t += d + rng.uniform(0.008, 0.03)
    return x
def pen_loop(seed, dur=0.5):
    """A drawn circle or underline: one continuous stroke that speeds up through the curve."""
    rng = np.random.default_rng(seed); x = pen_stroke(rng, dur, 'swell', 1.0)
    # two micro-hesitations where the hand turns the curve
    n = len(x); t = np.arange(n) / SR
    for c in rng.uniform(0.25, 0.75, 2): x *= 1 - 0.55 * np.exp(-((t - c * dur) / 0.012) ** 2)
    return x
def pen_cross(seed):
    """Two quick diagonal strokes (an X)."""
    rng = np.random.default_rng(seed); a = pen_stroke(rng, 0.11, 'dash', 1.1); b = pen_stroke(rng, 0.12, 'dash', 1.05) * 0.9
    gap = np.zeros(int(0.045 * SR)); return np.concatenate([a, gap, b])
def pen_tap(seed, dur=0.05, soft=1.0):
    """A pen tip tapping the page (replaces the pitched pops): a short, bright, toneless tick."""
    rng = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR
    tick = band(rng.standard_normal(n), 2200, 9000, 3) * np.exp(-t / (0.0022 * soft))
    tail = band(rng.standard_normal(n), 3000, 8000, 3) * np.exp(-t / 0.012) * 0.12
    return tick + tail
def paper_place(seed, dur=0.16):
    """A cut-out laid on the page: a soft, airy slap and a few fibre crackles – no low body."""
    rng = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR
    slap = band(rng.standard_normal(n), 900, 6000, 3) * np.exp(-t / 0.012)
    air = band(rng.standard_normal(n), 2000, 8000, 3) * np.exp(-t / 0.035) * 0.3
    crk = band(grains(n, 700 * np.exp(-t / 0.04), rng, (0.0002, 0.0008)), 2500, 9000, 3) * 0.35
    return slap + air + crk
def paper_slide(seed, dur=0.38):
    """A sheet pushed across paper: friction hiss rising and falling, a light tap as it settles."""
    rng = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR
    speed = np.sin(np.pi * np.clip(t / (dur * 0.8), 0, 1)) ** 1.5
    hiss = band(rng.standard_normal(n), 1200, 7000, 3) * speed * 0.55
    grit = band(grains(n, 300 + 1500 * speed, rng, (0.0002, 0.0008)), 2000, 8000, 3) * 0.3
    k = int(dur * 0.8 * SR); tap = np.zeros(n); tt = np.arange(n - k) / SR
    tap[k:] = band(rng.standard_normal(n - k), 1200, 6000, 3) * np.exp(-tt / 0.01) * 0.6
    return hiss + grit + tap
def tape(seed, dur=0.24):
    """Masking tape pressed on: an accelerating fine crackle, high and dry."""
    rng = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR
    rate = 300 + 2600 * (t / dur) ** 1.4
    crk = band(grains(n, rate, rng, (0.0002, 0.0009)), 1400, 7000, 3)
    return crk * (0.4 + 0.6 * t / dur)
def click(seed, dur=0.04):
    """Trackpad click: a crisp tick, no body."""
    rng = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR
    return band(rng.standard_normal(n), 2500, 8000, 3) * np.exp(-t / 0.0018)
def key(seed, dur=0.05):
    """Laptop key: a soft tick with a short plastic tail, no body."""
    rng = np.random.default_rng(seed); n = int(dur * SR); t = np.arange(n) / SR
    return band(rng.standard_normal(n), 1600, 6500, 3) * (np.exp(-t / 0.003) + 0.15 * np.exp(-t / 0.015))

for i in range(4): save(f'place{i+1}', paper_place(100 + i))
for i in range(3): save(f'slide{i+1}', paper_slide(200 + i))
for i in range(3): save(f'tape{i+1}', tape(300 + i))
# marker1 = circle, marker2/3 = lettering a label, marker4 = an X, marker-long = the highlighter / a long circle
save('marker1', pen_loop(401, 0.45)); save('marker2', pen_write(402, 0.34)); save('marker3', pen_write(403, 0.42)); save('marker4', pen_cross(404))
save('marker-long', pen_loop(410, 0.62))
for i in range(4): save(f'pop{i+1}', pen_tap(500 + i, 0.05, [1.0, 1.2, 0.9, 1.1][i]))
for i in range(3): save(f'click{i+1}', click(600 + i))
for i in range(6): save(f'key{i+1}', key(700 + i))
save('stamp', paper_place(800, 0.2))
print('written', len(os.listdir(OUT)), 'files')
