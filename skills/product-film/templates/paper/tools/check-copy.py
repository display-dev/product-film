# Copy check: every caption, label and the .srt against banned terms, the film's extra bans, the spelling variant and
# the dash rule; plus the caption limits and scene spacing. python3 <film>/tools/check-copy.py [style guide file]
# Rules come from timeline.json "copy" (defaults in brackets):
#   voiceFile [null]   a style guide to read banned terms from at run time, so new entries apply at once; a path
#                      relative to the film folder (for example "../VOICE.md") or absolute. A file passed as the first
#                      argument wins. When there is none, bannedTerms applies.
#   bannedTerms        words and phrases, matched whole-word and case-insensitive (used when there is no voiceFile)
#   extraBanned [[]]   regexes for this film (a product's own naming rules)
#   allow [[]]         names masked before checking, such as a product name that contains a banned word
#   spelling ["us"]    "us" flags UK spellings, "uk" flags US spellings, "off" checks neither
#   emDash ["ban"]     "ban" flags em dashes (the house style uses en dashes with spaces, or none), "allow" does not
#   maxWords [7], minHold [1.5], perWord [0.3], margin [0.5]: a caption holds at least minHold + perWord × words +
#   margin seconds; exactly one accent word per caption; captions at least captionGap [0.14] s apart; scene boundaries
#   at least minSceneGap [1.0] s apart.
# Style-guide format (tolerant): under any heading that contains "banned" (for example "## Banned terms"), every
# table row and every bullet names one or more terms. Bold text wins (**a / b**); otherwise the first table cell, or
# the bullet text before a dash or colon. Terms split on "/" and ","; quotes are stripped; an em dash entry bans "—".
import json, re, sys, os
F = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
tl = json.load(open(f'{F}/film/timeline.json')); cfg = tl.get('copy', {})

def terms_from_guide(path):
    text = open(path, encoding='utf-8').read(); out = []; on = False; level = 0
    for line in text.splitlines():
        h = re.match(r'^(#{1,6})\s+(.*)', line)
        if h:
            if on and len(h[1]) <= level: on = False
            if 'banned' in h[2].lower(): on, level = True, len(h[1])
            continue
        if not on: continue
        cell = None
        if line.lstrip().startswith('|'):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if not cells or re.fullmatch(r':?-{2,}:?', cells[0] or '-') or cells[0].lower() in ('term', 'terms', 'banned', 'avoid', 'word', 'words', 'instead of', 'do not use'): continue
            cell = cells[0]
        elif re.match(r'^\s*[-*+]\s+', line): cell = re.sub(r'^\s*[-*+]\s+', '', line)
        if not cell: continue
        bold = re.findall(r'\*\*(.+?)\*\*', cell)
        raw = bold if bold else [re.split(r'\s+[–—-]\s+|:\s', cell, maxsplit=1)[0]]
        for b in raw:
            if '—' in b or 'em dash' in b.lower(): out.append('—'); continue
            for t in re.split(r'\s*/\s*|,\s+', b.strip('"“”`* ')):
                t = t.strip('"“”`., ').strip()
                if len(t) > 1: out.append(t)
    return out

guide = sys.argv[1] if len(sys.argv) > 1 else cfg.get('voiceFile')
if guide and not os.path.isabs(guide): guide = os.path.normpath(os.path.join(F, guide)) if len(sys.argv) < 2 else os.path.abspath(guide)
if guide and not os.path.exists(guide): sys.exit(f'style guide not found: {guide} (copy.voiceFile in timeline.json, or the first argument)')
terms = terms_from_guide(guide) if guide else cfg.get('bannedTerms', [])
src = f'{guide} ({len(terms)} terms)' if guide else f'timeline.json bannedTerms ({len(terms)} terms)'
def pattern(t):
    if t == '—': return '—'
    e = re.escape(t); return (r'\b' if t[0].isalnum() else '') + e + (r'\b' if t[-1].isalnum() else '')
pats = sorted({pattern(t) for t in terms}) + cfg.get('extraBanned', [])
UK = r'\bcolour|\bcentre\b|\bcentred\b|\borganis(e|ed|es|ing|ation)|\blicence\b|\bfavour|\bbehaviour|\banalys(e|ed|es|ing)\b|\bcatalogue\b|\btravelled\b|\bgrey\b'
US = r'\bcolor|\bcenter\b|\bcentered\b|\borganiz(e|ed|es|ing|ation)|\bfavor\b|\bfavorite|\bbehavior|\banalyz(e|ed|es|ing)\b|\bcatalog\b|\btraveled\b|\bgray\b'
spelling = cfg.get('spelling', 'us')
if spelling == 'us': pats.append(UK)
elif spelling == 'uk': pats.append(US)
if cfg.get('emDash', 'ban') == 'ban' and '—' not in pats: pats.append('—')

texts = [(c['id'], c['text']) for c in tl['captions']] + list(tl.get('labels', {}).items())
srt = f'{F}/out/{tl["name"]}.srt'
if os.path.exists(srt): texts.append(('srt', open(srt).read()))
bad = 0
for k, t in texts:
    masked = t
    for a in cfg.get('allow', []): masked = re.sub(re.escape(a), '#' * len(a), masked, flags=re.I)
    for pat in pats:
        for m in re.finditer(pat, masked, re.I):
            print(f'FLAG {k}: /{pat}/ …{t[max(0, m.start() - 20):m.end() + 20]}…'); bad += 1
mw, mh, pw, mg = cfg.get('maxWords', 7), cfg.get('minHold', 1.5), cfg.get('perWord', 0.3), cfg.get('margin', 0.5)
words = 0
for c in tl['captions']:
    w = len(c['text'].split()); words += w; hold = c['end'] - c['start']; need = mh + pw * w + mg
    if w > mw: print(f'FLAG {c["id"]}: {w} words (max {mw})'); bad += 1
    if hold < need - 1e-6: print(f'FLAG {c["id"]}: hold {hold:.2f}s < {need:.2f}s ({mh} + {pw}×{w} + {mg} margin)'); bad += 1
    if [re.sub(r'[.,?!:;]', '', x) for x in c['text'].split()].count(c['accent']) != 1: print(f'FLAG {c["id"]}: accent "{c["accent"]}" not found exactly once'); bad += 1
for a, b in zip(tl['captions'], tl['captions'][1:]):
    if b['start'] < a['end'] + cfg.get('captionGap', 0.14): print(f'FLAG {a["id"]}/{b["id"]} overlap'); bad += 1
cuts = sorted({s['start'] for s in tl['scenes']} | {s['end'] for s in tl['scenes']})
for a, b in zip(cuts, cuts[1:]):
    if b - a < cfg.get('minSceneGap', 1.0): print(f'FLAG scene boundaries {a} and {b} are {b - a:.2f}s apart'); bad += 1
print(f'banned terms from {src}; spelling {spelling}; em dash {cfg.get("emDash", "ban")}; {len(pats)} patterns; caption words {words}; flags {bad}')
sys.exit(1 if bad else 0)
