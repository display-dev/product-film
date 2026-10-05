# Build the fixture artifact's versions: python3 capture/artifact/build.py → capture/artifact/<file stem>.v<N>.html
# Fills each version's __KEY__ placeholders from story.json and inlines __FONT:<file>__ from capture/fonts/ as base64,
# so every version is one self-contained file (the app, the phone and the CLI all use the same bytes).
# Story rule: each version keeps every earlier change, and an edited word is one the viewer has already seen.
import base64, json, os, re
C = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); F = os.path.join(C, '..')
st = json.load(open(f'{C}/story.json')); A = st['artifact']
t = open(os.path.join(F, A.get('template', 'capture/artifact/template.html'))).read()
t = re.sub(r'__FONT:([\w.-]+)__', lambda m: base64.b64encode(open(f'{C}/fonts/{m[1]}', 'rb').read()).decode(), t)
stem = os.path.splitext(A['file'])[0]
for ver in A['versions']:
    out = t
    for k, v in ver['fill'].items(): out = out.replace(k, v)
    left = re.findall(r'__[A-Z0-9_]+__', out)
    if left: raise SystemExit(f'v{ver["v"]}: unfilled placeholders {sorted(set(left))}')
    open(f'{C}/artifact/{stem}.v{ver["v"]}.html', 'w').write(out); print('built', f'{stem}.v{ver["v"]}.html')
