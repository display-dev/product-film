#!/usr/bin/env python3
"""Build a cut's review page: review/review-vN.html, one self-contained file (references/publish.md).
Usage: python3 <film>/tools/review-page.py vN <film.mp4> [--title "Film title"] [--poster p.jpg] [--sheet s.jpg] [--accent #0E8A7E]
Content comes from review/notes-vN.md, written per cut. Its "## " sections render in order; the usual ones are
"## What changed since vN-1", "## Scene by scene" (a pipe table: time | section | on screen) and "## Decisions for you".
Lists, pipe tables, **bold** and `code` render; anything else is a paragraph. The film is embedded as base64 with a
download button; a copy over 40 MB is re-encoded to fit display.dev's 50 MB page limit. The routes' assemble.sh print
the poster and sheet names; they are optional."""
import base64, html, os, re, subprocess, sys
args = sys.argv[1:]
if len(args) < 2: sys.exit(__doc__)
V, FILM = args[0].lstrip('v'), args[1]
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
F = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = lambda p: p if os.path.isabs(p) else os.path.join(F, p)
TITLE, ACC = opt('--title', os.path.basename(F)), opt('--accent', '#0E8A7E')
film = path(FILM)
if not os.path.exists(film): sys.exit(f'no film: {film}')
base = os.path.splitext(os.path.basename(film))[0].replace('-music', '').replace('_master', '')
poster = path(opt('--poster', f'poster-{base.split("film-")[-1]}.jpg' if 'film-' in base else 'poster.jpg'))
sheet = path(opt('--sheet', f'sheet-{base.split("film-")[-1]}.jpg' if 'film-' in base else 'sheet.jpg'))
os.makedirs(path('review'), exist_ok=True)
if os.path.getsize(film) > 40 * 1048576:   # fit the page limit
    small = path(f'review/v{V}-page.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', film, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', small], check=True); film = small
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', film], capture_output=True, text=True).stdout or 0)
notes_p = path(f'review/notes-v{V}.md')
if not os.path.exists(notes_p):
    open(notes_p, 'w').write(f'## What changed since v{int(V) - 1}\n\n- (fill in)\n\n## Scene by scene\n\n| Time | Section | On screen |\n|---|---|---|\n\n## Decisions for you\n\n1. (fill in)\n')
    print(f'wrote a stub {notes_p}: fill it in and run again')
inline = lambda t: re.sub(r'`([^`]+)`', r'<code>\1</code>', re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', html.escape(t, quote=False)))
def md(src):
    out, lst, tbl = [], None, []
    def flush():
        nonlocal lst, tbl
        if lst: out.append(f'</{lst}>'); lst = None
        if tbl:
            rows = [r for r in tbl if not re.match(r'^\|[\s:|-]+\|$', r)]
            cells = [[c.strip() for c in r.strip('|').split('|')] for r in rows]
            out.append('<div class="tw"><table>' + ''.join('<tr>' + ''.join(f'<{"th" if i == 0 else "td"}>{inline(c)}</{"th" if i == 0 else "td"}>' for c in r) + '</tr>' for i, r in enumerate(cells)) + '</table></div>'); tbl = []
    for line in src.splitlines():
        if line.startswith('|'): tbl.append(line.strip()); continue
        m = re.match(r'^\s*(?:(-|\*)|(\d+)\.)\s+(.*)', line)
        if m:
            kind = 'ul' if m.group(1) else 'ol'
            if tbl: flush()
            if lst != kind:
                if lst: out.append(f'</{lst}>')
                out.append(f'<{kind}>'); lst = kind
            out.append(f'<li>{inline(m.group(3))}</li>'); continue
        flush()
        if line.startswith('## '): out.append(f'<h2>{inline(line[3:])}</h2>')
        elif line.strip(): out.append(f'<p>{inline(line)}</p>')
    flush(); return '\n'.join(out)
body = md(open(notes_p).read())
vid = b64(film)
post = f'poster="data:image/jpeg;base64,{b64(poster)}"' if os.path.exists(poster) else ''
sh = f'<h2>Contact sheet</h2><img alt="Contact sheet at one frame per second" src="data:image/jpeg;base64,{b64(sheet)}">' if os.path.exists(sheet) else ''
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(TITLE)} – review</title>
<style>
:root{{--bg:#F3F3F3;--fg:#121212;--muted:#5B5B5B;--surface:#fff;--border:rgba(18,18,18,.12);--accent:{ACC}}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#121212;--fg:#EDEDED;--muted:#A3A3A3;--surface:#1B1B1B;--border:rgba(255,255,255,.12)}}}}
:root[data-theme="dark"]{{--bg:#121212;--fg:#EDEDED;--muted:#A3A3A3;--surface:#1B1B1B;--border:rgba(255,255,255,.12)}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,sans-serif}}
.w{{max-width:1080px;margin:0 auto;padding:44px 16px 96px}}.k{{font:500 13px ui-monospace,monospace;color:var(--muted);letter-spacing:.06em}}
h1{{font-size:clamp(28px,5vw,42px);letter-spacing:-.04em;line-height:1.08;margin:8px 0 22px}}h2{{font-size:21px;letter-spacing:-.02em;margin:40px 0 12px}}
video{{width:100%;border-radius:12px;background:#000;display:block}}img{{width:100%;border-radius:10px;display:block}}
.bar{{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;align-items:center}}.btn{{display:inline-flex;align-items:center;height:38px;padding:0 16px;border-radius:9px;background:var(--accent);color:#fff;font-weight:600;text-decoration:none}}
.pill{{font:500 13px ui-monospace,monospace;color:var(--muted);border:1px solid var(--border);border-radius:8px;padding:6px 10px}}
ul,ol{{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 22px 16px 40px;margin:0}}li{{margin:6px 0}}
.tw{{overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface)}}table{{border-collapse:collapse;width:100%;min-width:620px;font-size:14.5px}}
td,th{{text-align:left;padding:10px 14px;border-bottom:1px solid var(--border);vertical-align:top}}th{{font:500 12px ui-monospace,monospace;color:var(--muted);letter-spacing:.05em}}
td:first-child{{font-family:ui-monospace,monospace;white-space:nowrap;color:var(--accent)}}tr:last-child td{{border-bottom:0}}code{{font:13.5px ui-monospace,monospace}}
</style></head><body><div class="w"><div class="k">REVIEW · CUT V{V}</div><h1>{html.escape(TITLE)}</h1>
<video controls playsinline preload="metadata" {post} src="data:video/mp4;base64,{vid}"></video>
<div class="bar"><a class="btn" download="{html.escape(base)}-v{V}.mp4" href="data:video/mp4;base64,{vid}">Download MP4</a><span class="pill">{dur:.1f} s</span></div>
{body}{sh}</div></body></html>'''
dst = path(f'review/review-v{V}.html'); open(dst, 'w').write(page)
size = os.path.getsize(dst) / 1048576
print(dst, f'{size:.1f} MB'); size > 45 and print('WARNING: over 45 MB; display.dev caps a page at 50 MB.')
