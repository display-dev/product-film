#!/usr/bin/env python3
"""Split a render across N parallel workers into jobs.sh (about 1 worker per 2 cores).
Usage: PLANONLY=1 node <film>/render.js plan-A.json > <film>/plans.txt   (>> for the next plan)
       python3 <film>/plan-jobs.py N plan-A.json:s1,s2 [plan-B.json:B02,...]   then, from any directory: bash <film>/jobs.sh"""
import sys, os
H = os.path.dirname(os.path.abspath(__file__)); N = int(sys.argv[1]); FPS = int(os.environ.get('FPS', 60))
durs = {}
for line in open(os.path.join(H, 'plans.txt')):
    p = line.split()
    if p and p[0] != 'total': durs[p[0]] = float(p[2])
clips = []
for spec in sys.argv[2:]:
    plan, ids = spec.split(':'); clips += [(plan, i, round(durs[i] * FPS)) for i in ids.split(',')]
total = sum(c[2] for c in clips); per = total / N; bins = [[] for _ in range(N)]; b = 0; acc = 0
for plan, cid, n in clips:
    start = 0
    while start < n:
        room = per * (b + 1) - acc if b < N - 1 else n - start
        take = int(min(n - start, max(1, round(room)))); bins[b].append((plan, cid, start, start + take)); start += take; acc += take
        if acc >= per * (b + 1) - 0.5 and b < N - 1: b += 1
cmds = ['(' + ' && '.join(f'node "$H/render.js" {pl} {c}:{a}:{z}' for pl, c, a, z in bn) + f') > "$H/w{i+1}.log" 2>&1' for i, bn in enumerate(bins) if bn]
q = H.replace('\\', '\\\\').replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')
open(os.path.join(H, 'jobs.sh'), 'w').write(f'#!/usr/bin/env bash\n# run from any directory: bash "{q}/jobs.sh"; each worker logs to w<N>.log\nH="{q}"\n' + ' &\n'.join(cmds) + ' &\nwait\n')
print('frames', total, 'per worker', round(per))
