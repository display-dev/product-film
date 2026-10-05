# Build the review page: python3 <film>/tools/build-review.py vN  → review/review-vN.html (videos inlined as base64)
# Content comes from notes/review-vN.json (write it per cut; see the keys below); the videos, captions and the checks
# table come from out/vN/ and the timeline; colours and the wordmark from timeline.json "brand".
# Publish it only when the user asks, on display.dev (references/publish.md): one page per film, a new version per cut
# (dsp publish --id <shortId> --base-version <n>), "What changed since vN" on top. Keep it under 50 MB.
# notes/review-vN.json: {"lede": "…", "changesTitle": "Your notes, and what changed", "changes": [["note", "what changed"]],
#   "judge": [["question only a person can answer", "why"]], "decisions": [["Topic", "decision and reason"]],
#   "files": ["<film>/deliver/ – masters, upload copies, .srt, web set, poster"], "sound": "…", "spend": "None"}
import base64, html, json, os, subprocess, sys
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); V = sys.argv[1] if len(sys.argv) > 1 else 'v1'
tl = json.load(open(f'{F}/film/timeline.json')); NAME = tl['name']; TL_TITLE = tl.get('title', NAME)
BR = {'accent': '#0E8A7E', 'accentText': '#FFFFFF', 'wordmark': NAME, **tl.get('brand', {})}
R = json.load(open(f'{F}/notes/review-{V}.json')) if os.path.exists(f'{F}/notes/review-{V}.json') else {}
out = f'{F}/review/{V}'; os.makedirs(out, exist_ok=True)
M = lambda fmt: f'{F}/out/{V}/{NAME}-{fmt}-{V}_master.mov'
C = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
def enc(src, dst, vf, crf, ab='96k'):
    if not os.path.exists(src): return None
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src): subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', src, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', *C, '-c:a', 'aac', '-b:a', ab, '-movflags', '+faststart', dst], check=True)
    return dst
v720 = enc(M('16x9'), f'{out}/film-720.mp4', 'scale=1280:720:flags=lanczos', 24)
v1080 = enc(M('16x9'), f'{out}/film-1080.mp4', 'null', 22, '128k')
v916 = enc(M('9x16'), f'{out}/film-9x16.mp4', 'scale=540:960:flags=lanczos', 25)
v45 = enc(M('4x5'), f'{out}/film-4x5.mp4', 'scale=540:676:flags=lanczos', 25)
poster = f'{out}/poster.jpg'
subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', '0', '-i', M('16x9'), '-frames:v', '1', '-vf', 'scale=1280:720:flags=lanczos:out_color_matrix=bt709:out_range=pc', '-q:v', '4', poster], check=True)
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
mb = lambda p: os.path.getsize(p) / 1048576
checks = [l for l in open(f'{F}/out/{V}/checks.txt').read().strip().splitlines()] if os.path.exists(f'{F}/out/{V}/checks.txt') else []
def row(line):
    parts = [p.strip() for p in line.split('|')]; name = parts[0]
    g = lambda key: next((p for p in parts if p.startswith(key)), '')
    return name, parts[1].replace('frames ', ''), parts[2].replace('timing jumps ', ''), g('VMAF').replace('VMAF score: ', ''), parts[-1].replace('audio ', '').replace('I:', '').strip()
caps = ''.join(f'<li><button data-t="{c["start"]}"><span class="tc">{int(c["start"] // 60)}:{c["start"] % 60:04.1f}</span><span class="cap">{html.escape(c["text"]).replace(html.escape(c["accent"]), "<em>" + html.escape(c["accent"]) + "</em>", 1)}</span></button></li>' for c in tl['captions'])
crow = ''.join(f'<tr><th scope="row">{html.escape(n.replace(NAME + "-", "").replace("-" + V, ""))}</th><td>{html.escape(fr)}</td><td>{html.escape(j)}</td><td class="num">{html.escape("not measured" if "not measured" in vm else vm[:5])}</td><td>{html.escape(a)}</td></tr>' for n, fr, j, vm, a in map(row, checks))
chg = ''.join(f'<li><p class="q">{html.escape(q)}</p><p>{html.escape(a)}</p></li>' for q, a in R.get('changes', []))
jud = ''.join(f'<li><p class="q">{html.escape(q)}</p><p>{html.escape(a)}</p></li>' for q, a in R.get('judge', []))
dec = ''.join(f'<div class="dec"><dt>{html.escape(k)}</dt><dd>{html.escape(v)}</dd></div>' for k, v in R.get('decisions', []))
FORMATS = ' · '.join(f'{f.replace("x", ":")}{" without captions" if c == 0 else ""}' for f, c in tl.get('outputs', [])) + ' + .srt'
DESC = f'Cut {V[1:]} of {TL_TITLE}: ' + tl.get('summary', '')
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(TL_TITLE)} – review {V}</title>
<meta name="description" content="{html.escape(DESC)}">
<meta property="og:title" content="{html.escape(TL_TITLE)} – review {V}"><meta property="og:description" content="{html.escape(DESC)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='10' fill='%23{BR["accent"].lstrip("#")}'/%3E%3Cpath d='M19 14l16 10-16 10z' fill='%23fff'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{{color-scheme:light;--background:oklch(0.995 0.003 85);--foreground:oklch(0.145 0.006 85);--primary:{BR['accent']};--primary-foreground:{BR['accentText']};--muted:oklch(0.97 0.006 85);--muted-foreground:oklch(0.556 0.008 85);--border:oklch(0.922 0.006 85);--surface-1:oklch(0.97 0.006 85);--surface-2:oklch(0.94 0.006 85);--font-sans:'Geist',ui-sans-serif,system-ui,sans-serif;--font-mono:'Geist Mono',ui-monospace,monospace}}
[data-theme="dark"]{{color-scheme:dark;--background:oklch(0.145 0.005 85);--foreground:oklch(0.985 0.004 85);--primary:{BR['accent']};--primary-foreground:{BR['accentText']};--muted:oklch(0.269 0.006 85);--muted-foreground:oklch(0.708 0.008 85);--border:oklch(0.3 0.006 85);--surface-1:oklch(0.205 0.006 85);--surface-2:oklch(0.25 0.006 85)}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]):not([data-theme="dark"]){{color-scheme:dark;--background:oklch(0.145 0.005 85);--foreground:oklch(0.985 0.004 85);--primary:{BR['accent']};--primary-foreground:{BR['accentText']};--muted:oklch(0.269 0.006 85);--muted-foreground:oklch(0.708 0.008 85);--border:oklch(0.3 0.006 85);--surface-1:oklch(0.205 0.006 85);--surface-2:oklch(0.25 0.006 85)}}}}
*{{box-sizing:border-box;margin:0}}
body{{background:var(--background);color:var(--foreground);font-family:var(--font-sans);font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1180px;margin:0 auto;padding:40px 24px 80px}}
.wm{{font-weight:600;letter-spacing:-.04em;font-size:18px}}
header{{margin:28px 0 24px;max-width:780px}}
h1{{font-size:clamp(2rem,4.4vw,3.2rem);line-height:1.06;letter-spacing:-.045em;font-weight:800}}
.lede{{margin-top:12px;font-size:1.0625rem;color:var(--muted-foreground);max-width:62ch}}
dl.meta{{display:flex;flex-wrap:wrap;gap:6px 24px;margin-top:16px;font-size:.875rem}}dl.meta div{{display:flex;gap:6px}}dl.meta dt{{color:var(--muted-foreground)}}dl.meta dd{{font-weight:500}}
.stage{{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;align-items:start}}
video{{display:block;width:100%;border-radius:12px;background:#000}}
.film{{border:1px solid var(--border);border-radius:14px;padding:8px;background:var(--surface-1)}}
.dl{{display:flex;gap:16px;align-items:center;margin-top:12px;font-size:.875rem;color:var(--muted-foreground)}}
.dl a{{display:inline-flex;align-items:center;gap:8px;background:var(--primary);color:var(--primary-foreground);text-decoration:none;font-weight:600;border-radius:999px;padding:8px 16px;white-space:nowrap}}
.script h2,.sec h2{{font-size:.8125rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted-foreground);font-weight:600;margin-bottom:10px}}
.script ol{{list-style:none;padding:0;display:flex;flex-direction:column;gap:2px}}
.script button{{all:unset;display:grid;grid-template-columns:52px 1fr;gap:8px;width:100%;padding:7px 10px;border-radius:8px;cursor:pointer;font-family:var(--font-mono);font-size:.8125rem;line-height:1.45}}
.script button:hover,.script button.on{{background:var(--surface-2)}}.script .tc{{color:var(--muted-foreground)}}.script em{{font-style:normal;color:var(--primary);font-weight:600}}
.sec{{margin-top:56px}}
.two{{display:grid;grid-template-columns:260px minmax(0,1fr);gap:40px;align-items:start}}
.v916{{width:260px}}
ul.notes{{list-style:none;padding:0;display:flex;flex-direction:column;gap:18px;max-width:70ch}}ul.notes .q{{font-weight:600}}ul.notes p+p{{color:var(--foreground)}}
table{{border-collapse:collapse;width:100%;font-size:.9375rem}}caption{{text-align:left;font-size:.875rem;color:var(--muted-foreground);margin-bottom:8px}}
th,td{{text-align:left;padding:9px 12px;border-bottom:1px solid var(--border);vertical-align:top}}thead th{{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-foreground);font-weight:600}}
tbody th{{font-weight:600;font-family:var(--font-mono);font-size:.8125rem}}td.num{{font-family:var(--font-mono)}}
.tablewrap{{overflow-x:auto}}
.decs{{display:grid;grid-template-columns:1fr 1fr;gap:28px 40px}}.dec dt{{font-weight:700;margin-bottom:4px}}.dec dd{{color:var(--foreground)}}
.files{{font-family:var(--font-mono);font-size:.8125rem;color:var(--muted-foreground);line-height:1.8}}
footer{{margin-top:64px;font-size:.8125rem;color:var(--muted-foreground)}}
@media (max-width:880px){{.stage{{grid-template-columns:1fr}}.two{{grid-template-columns:1fr}}.v916{{width:min(260px,70vw)}}.decs{{grid-template-columns:1fr}}.wrap{{padding:24px 16px 64px}}}}
</style></head><body><div class="wrap">
<div class="wm">{html.escape(BR["wordmark"])}</div>
<header><h1>{html.escape(TL_TITLE)} – cut {V[1:]}</h1>
<p class="lede">{html.escape(R.get("lede", ""))}</p>
<dl class="meta"><div><dt>Length</dt><dd>{tl["duration"]:.1f} s, {tl["fps"]} fps</dd></div><div><dt>Formats</dt><dd>{html.escape(FORMATS)}</dd></div><div><dt>Sound</dt><dd>{html.escape(R.get("sound", "Pen and paper SFX, no voice or music"))}</dd></div><div><dt>Spend</dt><dd>{html.escape(R.get("spend", "None"))}</dd></div></dl></header>
<section class="stage"><div><div class="film"><video id="v" controls playsinline preload="metadata" poster="data:image/jpeg;base64,{b64(poster)}" src="data:video/mp4;base64,{b64(v720)}"></video></div>
<p class="dl"><a download="{NAME}-{V}-1080p.mp4" href="data:video/mp4;base64,{b64(v1080)}">Download 1080p</a><span>720p above · 1080p download {mb(v1080):.0f} MB</span></p></div>
<nav class="script" aria-label="Captions"><h2>Captions – select one to jump there</h2><ol>{caps}</ol></nav></section>
<section class="sec two"><div>{('<h2>9:16</h2><video class="v916" controls playsinline preload="metadata" src="data:video/mp4;base64,' + b64(v916) + '"></video>') if v916 else ''}{('<h2 style="margin-top:28px">4:5</h2><video class="v916" controls playsinline preload="metadata" src="data:video/mp4;base64,' + b64(v45) + '"></video>') if v45 else ''}</div>
<div><h2>{html.escape(R.get("changesTitle", "What changed since the last cut"))}</h2><ul class="notes">{chg}</ul></div></section>
<section class="sec"><h2>Only you can judge</h2><ul class="notes">{jud}</ul></section>
<section class="sec"><h2>Checks</h2><div class="tablewrap"><table><caption>Every master is measured after it is encoded. VMAF compares the H.264 upload copy with the master.</caption><thead><tr><th scope="col">Output</th><th scope="col">Frames</th><th scope="col">Timing jumps</th><th scope="col">VMAF</th><th scope="col">Loudness · peak</th></tr></thead><tbody>{crow}</tbody></table></div></section>
<section class="sec"><h2>Decisions</h2><dl class="decs">{dec}</dl></section>
<section class="sec"><h2>Files</h2><p class="files">{"<br>".join(html.escape(x) for x in R.get("files", []))}</p></section>
<footer>Cut {V[1:]} · built from film/timeline.json</footer>
</div><script>
const v=document.getElementById('v');const bs=[...document.querySelectorAll('.script button')];
bs.forEach(b=>b.addEventListener('click',()=>{{v.currentTime=+b.dataset.t+0.05;v.play();}}));
const caps={json.dumps([[c["start"],c["end"]] for c in tl["captions"]])};
v.addEventListener('timeupdate',()=>{{const t=v.currentTime;bs.forEach((b,i)=>b.classList.toggle('on',t>=caps[i][0]&&t<caps[i][1]));}});
</script></body></html>'''
dst = f'{F}/review/review-{V}.html'; open(dst, 'w').write(page)
size = os.path.getsize(dst) / 1048576
print(dst, f'{size:.1f} MB', f'(720p {mb(v720):.1f}, 1080p {mb(v1080):.1f} MB)')
print('publish: see references/publish.md (first cut: dsp publish <page> --company; later cuts: --id <shortId> --base-version <n>)')
if size > 45: print('WARNING: over 45 MB; display.dev caps a page at 50 MB. Raise the CRF of the embedded copies.')
