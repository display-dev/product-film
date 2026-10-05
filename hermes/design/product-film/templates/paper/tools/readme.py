# Build README.md from the timeline, the decisions log and the encode checks: python3 tools/readme.py vN
# Sections: summary, deliverables (from deliver/), checks, captions, labels, storyboard (each scene's "beat"),
# sources and licences (notes/sources.md, verbatim), decisions (notes/DECISIONS.md), rebuild commands.
import json, os, sys
F = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); V = sys.argv[1] if len(sys.argv) > 1 else 'v1'
tl = json.load(open(f'{F}/film/timeline.json')); NAME = tl['name']
rd = lambda p: open(p).read().strip() if os.path.exists(p) else ''
checks = rd(f'{F}/out/{V}/checks.txt').splitlines()
L = [f'# {tl.get("title", NAME)} – {V}', '', f'{tl.get("summary", "")} {tl["duration"]} s, {tl["fps"]} fps, BT.709. Empty voice and music tracks are ready in `film/timeline.json`.', '']
D = f'{F}/deliver'
if os.path.isdir(D):
    L += ['## Deliverables (in `deliver/`)', '']
    for root, _, files in sorted(os.walk(D)):
        for f in sorted(files): p = os.path.join(root, f); L.append(f'- `{os.path.relpath(p, D)}` ({os.path.getsize(p) / 1048576:.1f} MB)')
    L.append('')
L += ['## Checks', '', '```'] + checks + ['```', '', '## Captions', '', '| # | Time | Caption | Words |', '|---|---|---|---|']
for c in tl['captions']:
    L.append(f"| {c['id']} | {c['start']:.1f}–{c['end']:.1f} s | {c['text'].replace(c['accent'], '**' + c['accent'] + '**', 1)} | {len(c['text'].split())} |")
L += ['', f"{sum(len(c['text'].split()) for c in tl['captions'])} caption words; the accent word (bold) is in the brand accent.", '',
      'Hand-lettered labels: ' + ' · '.join(tl.get('labels', {}).values()) + '.', '', '## Storyboard', '']
for s in tl['scenes']: L.append(f"- **{s['start']:.1f}–{s['end']:.1f} s · {s['id']}** – {s.get('beat', '')}")
L += ['', '## Sources and licences', '', rd(f'{F}/notes/sources.md') or '(write notes/sources.md: every asset, its source and licence; spend; artifacts published or deleted for capture)', '',
      '## Decisions', '', rd(f'{F}/notes/DECISIONS.md'), '', '## Rebuild', '', '```',
      '# any working directory; Playwright loads through pw.cjs in the film folder',
      f'node "{F}/kit/build-kit.mjs"                 # freeze the kit to kit/png',
      f'node "{F}/film/preview.mjs" 16x9 1,5,9      # quick stills',
      f'bash "{F}/film/render-all.sh" vN             # frames → masters → checks',
      f'bash "{F}/tools/deliver.sh" vN <poster-s>    # deliverables', '```', '']
open(f'{F}/README.md', 'w').write('\n'.join(L)); print('wrote', f'{F}/README.md')
