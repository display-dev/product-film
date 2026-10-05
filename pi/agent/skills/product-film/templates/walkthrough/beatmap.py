#!/usr/bin/env python3
"""Find a track's tempo and bar lines, to cut a reel (reel.html) to its grid. Standard library only; needs ffmpeg.

Usage, from any directory:
  python3 <film>/beatmap.py <audio or video file> [--start S] [--bars N] [--hits N]
    --start S   where the film starts in the track, in seconds (default 0). Film time = track time - S.
    --bars N    how many bar lines to print from the film start (default 16).
    --hits N    how many of the strongest hits to list (default 8).

It prints the tempo (BPM), the beat and bar periods, the first downbeat, a bar grid in track and film time, the
strongest hits with their nearest bar line, and the line to paste at the top of reel.html:
  const BPM = 126.00, OFFSET = 0.000;
OFFSET is the film time of the first bar line. For OFFSET 0, start the film on the downbeat it suggests. To land a hit
(a drop) on a section, start the film that many bars before the hit: --start = hit - bars * bar.

How it works: ffmpeg decodes to mono 11025 Hz. Energy flux in 20 ms hops, full band (mostly bass and kick) plus a
first-difference band (snares, hats), gives an onset envelope. Autocorrelation over 80-170 BPM picks the tempo;
folding the envelope at nearby periods refines it (the sharpest fold wins) and gives the beat phase. The downbeat is
the beat of the bar where the bass gets louder (bars and sections start there). It assumes a steady tempo and 4/4, which holds
for most library and electronic tracks; check a live recording by ear. If the reported tempo feels twice or half the
music's pulse, use the alternative it prints.
"""
import argparse
import array
import math
import shutil
import subprocess
import sys
from operator import mul

SR = 11025
HOP = 220                 # samples per hop: 19.95 ms
HS = HOP / SR             # hop in seconds
LAT = 0.5                 # onset latency in hops: an attack shows in the hop after the one it starts in, on average
BPM_LO, BPM_HI = 80.0, 170.0


def decode(path):
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg is not on PATH')
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                       capture_output=True)
    if r.returncode or not r.stdout:
        sys.exit(f'ffmpeg could not decode {path}: {r.stderr.decode(errors="replace").strip()[:300]}')
    a = array.array('h')
    a.frombytes(r.stdout[:len(r.stdout) // 2 * 2])
    if sys.byteorder == 'big':
        a.byteswap()
    return a


def envelopes(a):
    """Per-hop energy of the signal (low end dominates) and of its first difference (high end)."""
    lo, hi = [], []
    for i in range(0, len(a) - HOP, HOP):
        c = a[i:i + HOP + 1]
        x, y = c[1:], c[:-1]
        e = sum(map(mul, x, x))
        lo.append(float(e))
        ey = e - c[-1] * c[-1] + c[0] * c[0]                 # sum of y^2 from the sum of x^2
        hi.append(max(0.0, float(e + ey - 2 * sum(map(mul, x, y)))))   # sum (x[n] - x[n-1])^2
    return lo, hi


def flux(e):
    """Half-wave rectified rise in log energy, normalized to mean 1."""
    m = sum(e) / len(e) or 1.0
    eps = 1e-3 * m
    lg = [math.log(v + eps) for v in e]
    o = [0.0] + [max(0.0, lg[i] - max(lg[i - 1], lg[i - 2] if i > 1 else lg[i - 1])) for i in range(1, len(lg))]
    mo = sum(o) / len(o) or 1.0
    return [v / mo for v in o]


def autocorr(o, maxlag):
    m = sum(o) / len(o)
    c = [v - m for v in o]
    n = len(c)
    return [0.0] + [sum(map(mul, c[:n - L], c[L:])) / (n - L) for L in range(1, maxlag + 1)]


def ac_at(ac, x):
    i = int(x)
    if i + 1 >= len(ac):
        return 0.0
    f = x - i
    return ac[i] * (1 - f) + ac[i + 1] * f


def tempo_ac(ac):
    """Coarse tempo: autocorrelation at the beat lag and its multiples, with a mild prior around 120 BPM."""
    best, scores = None, []
    b = BPM_LO
    while b <= BPM_HI + 1e-9:
        P = 60.0 / (b * HS)
        s = ac_at(ac, P) + .5 * ac_at(ac, 2 * P) + .5 * ac_at(ac, 4 * P)
        s *= math.exp(-.5 * (math.log2(b / 120.0) / 1.0) ** 2)
        scores.append((s, b))
        if best is None or s > best[0]:
            best = (s, b)
        b += .1
    return best[1]


def fold(peaks, P, bins=64):
    """Fold onset peaks (frame, weight) at period P frames; return peakiness and phase (frames) of the strongest bin."""
    h = [0.0] * bins
    for n, w in peaks:
        h[int(((n + LAT) % P) / P * bins) % bins] += w
    sm = [h[i - 1] + 2 * h[i] + h[(i + 1) % bins] for i in range(bins)]
    k = max(range(bins), key=sm.__getitem__)
    a, b, c = sm[k - 1], sm[k], sm[(k + 1) % bins]
    d = a - 2 * b + c
    off = .5 * (a - c) / d if d else 0.0       # parabolic peak
    total = sum(sm) or 1.0
    return b / total, ((k + .5 + off) / bins * P) % P


def main():
    ap = argparse.ArgumentParser(description='Tempo, bar grid and strongest hits of a track, for reel.html.')
    ap.add_argument('file')
    ap.add_argument('--start', type=float, default=0.0, help='where the film starts in the track (s)')
    ap.add_argument('--bars', type=int, default=16, help='bar lines to print')
    ap.add_argument('--hits', type=int, default=8, help='strongest hits to list')
    args = ap.parse_args()

    a = decode(args.file)
    dur = len(a) / SR
    if dur < 8:
        sys.exit(f'{args.file}: {dur:.1f} s is too short to find a tempo (need 8 s or more)')
    lo_e, hi_e = envelopes(a)
    olo, ohi = flux(lo_e), flux(hi_e)
    o = [x + y for x, y in zip(olo, ohi)]
    n = len(o)

    # coarse tempo by autocorrelation, then refine by folding the strongest onsets at nearby periods
    ac = autocorr(o, int(4 * 60.0 / (BPM_LO * HS)) + 3)
    b0 = tempo_ac(ac)
    thr = sorted(o)[int(n * .85)]
    peaks = [(i, o[i]) for i in range(1, n - 1) if o[i] >= thr and o[i] >= o[i - 1] and o[i] >= o[i + 1]]
    best = None
    for lo, hi, step in ((b0 - 1.5, b0 + 1.5, .01), (-.012, .012, .001)):   # 0.01 BPM steps, then 0.001 around the best
        if best:
            lo, hi = best[1] + lo, best[1] + hi
        b = lo
        while b <= hi + 1e-9:
            s, ph = fold(peaks, 60.0 / (b * HS))
            if best is None or s > best[0]:
                best = (s, b, ph)
            b += step
    _, bpm, ph = best
    beat = 60.0 / bpm
    bar = 4 * beat
    phase = ph * HS                           # first beat time in [0, beat)

    # downbeat: the beat of four where the bass gets louder for the beat that follows (bars and sections start there),
    # with bass-over-treble onsets as a small tiebreaker (kicks fall on 1 and 3, snares and claps on 2 and 4)
    def near(env, t):
        i = int(round(t / HS - LAT))
        return max(env[j] for j in range(max(0, i - 1), min(len(env), i + 2))) if 0 <= i < len(env) else 0.0
    beats = []
    t = phase
    while t + beat < dur:
        beats.append(t)
        t += beat
    def beat_energy(t):
        i0, i1 = int(t / HS), max(int(t / HS) + 1, int((t + beat) / HS))
        return math.log(1.0 + sum(lo_e[i0:i1]) / (i1 - i0))
    el = [beat_energy(bt) for bt in beats]
    rise, tilt = [0.0] * 4, [0.0] * 4
    for k, bt in enumerate(beats):
        if k:
            rise[k % 4] += max(0.0, el[k] - el[k - 1])
        tilt[k % 4] += near(olo, bt) - near(ohi, bt)
    rs, ts = sum(rise) or 1e-9, sum(abs(x) for x in tilt) or 1e-9
    score = [rise[i] / rs + .2 * tilt[i] / ts for i in range(4)]
    j = max(range(4), key=score.__getitem__)
    rest = sorted(score, reverse=True)
    conf = rest[0] / rest[1] if rest[1] > 0 else 9.99
    down0 = beats[j] if j < len(beats) else phase   # first downbeat in the track

    # bar grid from the film start
    S = args.start
    k0 = math.ceil((S - down0) / bar - 1e-9)
    first = down0 + k0 * bar                   # first bar line at or after S
    offset = first - S
    prev = first - bar if offset > 1e-6 else first

    # strongest hits: local maxima of the onset envelope, at least 0.5 s apart
    W = int(.15 / HS)
    cand = [i for i in range(W, n - W) if o[i] == max(o[i - W:i + W + 1]) and o[i] > 0]
    cand.sort(key=lambda i: -o[i])
    hits = []
    for i in cand:
        if all(abs(i - h) * HS >= .5 for h in hits):
            hits.append(i)
        if len(hits) >= args.hits:
            break
    mean = sum(o) / n or 1e-9

    print(f'track      {args.file}  ({dur:.1f} s)')
    print(f'tempo      {bpm:.2f} BPM   beat {beat:.4f} s   bar {bar:.4f} s (4/4)'
          f'   half {bpm / 2:.2f} / double {bpm * 2:.2f} if the pulse feels wrong')
    print(f'downbeat   first at {down0:.3f} s (track time)   confidence {conf:.2f}'
          f'{"   (low: check by ear; the downbeat may be a beat or two off)" if conf < 1.15 else ""}')
    print(f'film start --start {S:.3f} s   first bar line at {first:.3f} s   OFFSET {offset:.3f}')
    if offset > 1e-6:
        print(f'           for OFFSET 0 start the film at {first:.3f} s' + (f' or {prev:.3f} s' if prev >= 0 else ''))
    print(f'\nbar grid (film time = track time - {S:.3f})')
    print('   bar    track s     film s')
    for k in range(args.bars):
        tt = first + k * bar
        if tt > dur:
            break
        print(f'  {k:4d}  {tt:9.3f}  {tt - S:9.3f}')
    print('\nstrongest hits (bar.beat on the grid above; a drop belongs on beat 1)')
    print('   track s     film s   strength   bar.beat   off beat   nearest bar line (film s)')
    for i in sorted(hits):
        th = i * HS + LAT * HS
        kb = round((th - first) / beat)
        kl = round((th - first) / bar)
        print(f'  {th:8.3f}  {th - S:9.3f}   {o[i] / mean:6.1f}x   {kb // 4:5d}.{kb % 4 + 1}   {1000 * (th - first - kb * beat):+6.0f} ms'
              f'   bar {kl} at {first + kl * bar - S:.3f}')
    print('\npaste at the top of reel.html:')
    print(f'  const BPM = {bpm:.2f}, OFFSET = {offset:.3f};')
    print('lay the track under the silent film (from the film folder):')
    print(f'  ffmpeg -i film-R.mp4 -ss {S:.3f} -i "<track>" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest film-R-music.mp4')


if __name__ == '__main__':
    main()
