# Quality gates for a cut: python3 <film>/tools/gates.py vN
# Mechanical gates are checked here; judgement gates are printed as a checklist you must answer in DECISIONS.md.
# Exit 0: every mechanical gate passes. Exit 1: a gate failed. Exit 2: nothing failed, but a gate could not be
# measured (VMAF without an ffmpeg built with libvmaf): say so in the report; do not call the cut checked.
# Do not call a cut done, or publish it, before exit 0.
import json, os, re, subprocess, sys, glob
F = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); V = sys.argv[1] if len(sys.argv) > 1 else 'v1'
tl = json.load(open(f'{F}/film/timeline.json')); N = round(tl['duration'] * tl['fps']); fails = []; unmeasured = []
def gate(ok, msg): print(('PASS ' if ok else 'FAIL ') + msg); ok or fails.append(msg)
def not_measured(msg): print('N/M  ' + msg); unmeasured.append(msg)
r = subprocess.run([sys.executable, f'{F}/tools/check-copy.py'], capture_output=True, text=True)
gate(r.returncode == 0, 'copy: banned terms, spelling, dashes, caption words, holds, accents, scene spacing' + ('' if r.returncode == 0 else '\n     ' + (r.stdout + r.stderr).strip().replace('\n', '\n     ')))
lines = open(f'{F}/out/{V}/checks.txt').read().strip().splitlines() if os.path.exists(f'{F}/out/{V}/checks.txt') else []
gate(len(lines) >= len(tl.get('outputs', [])), f'masters: {len(lines)} checked of {len(tl.get("outputs", []))} outputs')
for l in lines:
    name = l.split('|')[0].strip(); fr = re.search(r'frames master (\d+), h264 (\d+)', l); j = re.search(r'timing jumps (\d+)', l)
    vm = re.search(r'VMAF score: ([\d.]+)', l); lu = re.search(r'I: (-?[\d.]+) LUFS', l); pk = re.search(r'Peak: (-?[\d.]+) dBFS', l)
    gate(bool(fr) and int(fr[1]) == N and int(fr[2]) == N, f'{name}: frames = {N}')
    gate(bool(j) and int(j[1]) == 0, f'{name}: zero timing jumps')
    if 'VMAF not measured' in l: not_measured(f'{name}: VMAF ≥ 95 – {re.search(r"VMAF not measured[^|]*", l)[0].strip()}; install an ffmpeg built with libvmaf and re-run check-master.sh')
    else: gate(bool(vm) and float(vm[1]) >= 95, f'{name}: VMAF ≥ 95 ({vm[1] if vm else "?"})')
    gate(bool(pk) and float(pk[1]) <= -1.5, f'{name}: true peak ≤ −1.5 dBTP ({pk[1] if pk else "?"})')
    gate(not lu or float(lu[1]) <= -14, f'{name}: loudness ≤ −14 LUFS ({lu[1] if lu else "silent"})')
    gate('bt709' in l and 'color_range=tv' in l, f'{name}: BT.709 tags, limited range')
spikes = glob.glob(f'{F}/review/{V}-*/diff-spikes.txt')
gate(len(spikes) >= 1, f'review tools run ({len(spikes)} outputs reviewed with tools/review.py)')
for p in spikes:
    txt = open(p).read(); n = txt.count('UNEXPLAINED'); gate(n == 0, f'{os.path.basename(os.path.dirname(p))}: {n} unexplained diff spikes')
print('\nJudgement gates – answer each in notes/DECISIONS.md before you call the cut done:')
for q in ['Phone sheet: every caption and label readable at 390 px; nothing overlaps; no UI text unreadable.',
          '9:16 sheet: captions, labels, zoom targets and bubbles inside the safe-zone box (top 250, bottom 480, right 150).',
          'Transition strips: no character or window drawn twice, no pop, no one-frame flash at any cut or swap.',
          'Every zoom lands on the item the beat is about, holds with the pointer at rest, and returns.',
          'Truth: every caption and on-screen claim checked against the truth sheet; nothing shows what may not be shown.',
          'Independent review of the rendered cut (another agent or model, when one is available): verdict recorded, every finding adopted or answered.',
          'You would be proud to post it.']: print('  [ ] ' + q)
if fails: print(f'\n{len(fails)} mechanical gate(s) failed'); sys.exit(1)
if unmeasured: print(f'\nno gate failed, but {len(unmeasured)} could not be measured: the cut is not fully checked'); sys.exit(2)
print('\nall mechanical gates pass'); sys.exit(0)
