# Measure the sound set, because an agent cannot listen: .venv/bin/python sfx/measure.py [wav dir]
# Flags a sound as PITCHED (spectral flatness < 0.1: a tone, reads as a squeak or a buzz) or LOW (> 5 % of its energy
# below 300 Hz: a thump). Targets from the accepted set: 0 % below 300 Hz, centroid 4.7–6.7 kHz,
# flatness 0.2–0.35. Measurements do not replace a listen: say in the report that the sound is unheard.
import os, sys, wave, numpy as np
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wav')
def load(p):
    with wave.open(p) as w: n, sw, ch = w.getnframes(), w.getsampwidth(), w.getnchannels(); raw = w.readframes(n); sr = w.getframerate()
    if sw == 3: b = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(np.int32); x = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16); x = np.where(x >= 2 ** 23, x - 2 ** 24, x) / 2 ** 23
    else: x = np.frombuffer(raw, np.int16) / 32768
    return (x.reshape(-1, ch).mean(1) if ch > 1 else x), sr
bad = 0
print(f'{"sound":14} {"<300Hz":>7} {"centroid":>9} {"flatness":>8}')
for f in sorted(os.listdir(D)):
    if not f.endswith('.wav'): continue
    x, sr = load(os.path.join(D, f)); X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2; fr = np.fft.rfftfreq(len(x), 1 / sr)
    low = X[fr < 300].sum() / X.sum() * 100; cen = (fr * X).sum() / X.sum(); band = X[(fr > 200) & (fr < 12000)] + 1e-20
    flat = np.exp(np.mean(np.log(band))) / np.mean(band); flags = ('PITCHED ' if flat < 0.1 else '') + ('LOW' if low > 5 else '')
    bad += bool(flags); print(f'{f[:-4]:14} {low:6.1f}% {cen:8.0f}Hz {flat:8.2f}  {flags}')
print('flags', bad); sys.exit(1 if bad else 0)
