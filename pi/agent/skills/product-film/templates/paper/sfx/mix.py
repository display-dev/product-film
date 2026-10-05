# Mix the film's audio from timeline.json: .venv/bin/python sfx/mix.py [out.wav]
# Cue refs: "sN.cue" (a scene cue), "sN.start", "sN.end", or a caption id ("C4" = its start); plus optional "offset".
# voice and music items ({start, file, gain}) mix in too, so a later pass adds them without restructuring anything.
# Peak control keeps true peak ≤ −2.0 dBFS (margin under the −1.5 dBTP limit). An SFX-only track sits well under
# −14 LUFS; do not push it up to reach −14.
import json, os, sys, wave, numpy as np
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); SR = 48000
tl = json.load(open(f'{F}/film/timeline.json')); N = int(round(tl['duration'] * SR))
def load(path):
    with wave.open(path) as w:
        n, ch, sw = w.getnframes(), w.getnchannels(), w.getsampwidth(); raw = w.readframes(n)
    if sw == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(np.int32); x = (b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)); x = np.where(x >= 2 ** 23, x - 2 ** 24, x) / 2 ** 23
    else: x = np.frombuffer(raw, np.int16) / 32768
    return x.reshape(-1, ch).mean(1) if ch > 1 else x
def when(ref):
    if ref.startswith('C'): return next(c['start'] for c in tl['captions'] if c['id'] == ref)
    sid, cue = ref.split('.'); s = next(x for x in tl['scenes'] if x['id'] == sid)
    if cue in ('start', 'end'): return s[cue]
    if cue not in s.get('cues', {}): sys.exit(f'sfx cue {ref} not in timeline.json')
    return s['start'] + s['cues'][cue]
L = np.zeros(N); R = np.zeros(N); rng = np.random.default_rng(1)
for e in tl['sfx']:
    x = load(f'{F}/sfx/wav/{e["sfx"]}.wav') * 10 ** (e['gain'] / 20); t = when(e['cue']) + e.get('offset', 0); i = int(round(t * SR))
    if i >= N: continue
    pan = rng.uniform(-0.25, 0.25); gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    j = min(N, i + len(x)); L[i:j] += x[:j - i] * gl * 1.41; R[i:j] += x[:j - i] * gr * 1.41
for trk in ('voice', 'music'):
    for e in tl.get(trk, []):
        x = load(f'{F}/{e["file"]}') * 10 ** (e.get('gain', 0) / 20); i = int(round(e['start'] * SR)); j = min(N, i + len(x)); L[i:j] += x[:j - i]; R[i:j] += x[:j - i]
MASTER_DB = tl.get('audio', {}).get('masterDb', 4.0)   # +4 dB keeps an SFX-only track audible on phone speakers
st = np.stack([L, R], 1) * 10 ** (MASTER_DB / 20)
# 4× oversampled true-peak estimate; scale so true peak <= -2.0 dBFS
up = np.fft.irfft(np.pad(np.fft.rfft(st, axis=0), ((0, len(st) * 3 // 2), (0, 0))), len(st) * 4, axis=0) * 4
tp = np.max(np.abs(up)); target = 10 ** (-2.0 / 20)
if tp > target: st *= target / tp
out = sys.argv[1] if len(sys.argv) > 1 else f'{F}/sfx/sfx-mix.wav'
d = (np.clip(st, -1, 1) * 32767).astype(np.int16)
with wave.open(out, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())
print('mixed', len(tl['sfx']), 'cues', f'{N / SR:.2f}s', 'peak before scaling', f'{20 * np.log10(max(tp, 1e-9)):.1f} dBFS', '→', out)
