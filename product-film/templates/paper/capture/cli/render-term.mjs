// Render CLI output in xterm.js, a real terminal emulator, and screenshot each typing state:
//   node <film>/capture/cli/render-term.mjs        renders every story.json cli.runs entry that has out-<name>.txt
// → ../shots/term-<name>-<NN>.png (device scale 3) and ../shots/manifest-term.json (one box per row, the cell size).
// capture.mjs runs the CLI and then calls this. xterm.js 5.5.0 is downloaded once into this folder.
// Prefer the agent window (capture/agent/) to show an AI agent at work: a terminal undersells how most people use one.
// Use a terminal when the film is about the CLI itself.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../tools/pw.mjs';
import { startStatic } from '../../tools/static.mjs';
const D = fileURLToPath(new URL('.', import.meta.url)); const story = JSON.parse(readFileSync(`${D}../story.json`, 'utf8')); const CLI = story.cli || {};
// ── BRAND: the terminal's colours and font. Replace with your product's terminal look if it has one. ──
const TERM = { background: '#151615', foreground: '#F2F3F1', prompt: '#8A8E8B', font: 'Geist Mono', fontSize: 22 };

export async function renderRuns(runs = CLI.runs || []) {
  for (const f of ['xterm.js', 'xterm.css']) {if (!existsSync(D + f)) {writeFileSync(D + f, Buffer.from(await (await fetch(`https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/${f === 'xterm.js' ? 'lib' : 'css'}/${f}`)).arrayBuffer()));}}
  writeFileSync(`${D}term.html`, `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="xterm.css">
<style>@font-face{font-family:"${TERM.font}";src:url(../../kit/fonts/geist-mono.woff2) format("woff2");font-weight:100 900}
html,body{margin:0;background:${TERM.background}}#t{padding:22px 26px}.xterm-cursor-layer{display:none}.xterm .xterm-viewport{overflow:hidden!important;background:${TERM.background}!important}</style>
<script src="xterm.js"></script></head><body><div id="t"></div></body></html>`);
  const hex = (h) => h.replace('#', '').match(/../g).map((x) => parseInt(x, 16)).join(';');
  const PROMPT = `\x1b[38;2;${hex(TERM.prompt)}m${CLI.prompt || '~'}\x1b[0m \x1b[38;2;${hex(TERM.foreground)}m$\x1b[0m `;
  const srv = await startStatic(); const b = await chromium.launch(); const manifest = [];
  for (const r of runs) {
    if (!existsSync(`${D}out-${r.name}.txt`)) { console.warn(`  no out-${r.name}.txt: run capture.mjs first`); continue; }
    const out = readFileSync(`${D}out-${r.name}.txt`, 'utf8').trimEnd().split('\n'); const cmd = r.typed || r.run; const n = r.typingSteps ?? 6;
    const typing = n > 0 ? Array.from({ length: n }, (_, k) => Math.round(cmd.length * (k + 1) / n)).map((c, k, a) => ({ write: cmd.slice(k ? a[k - 1] : 0, c), state: `typed "${cmd.slice(0, c)}"` })) : [];
    const steps = n > 0 ? [{ write: PROMPT, state: 'empty prompt' }, ...typing, { write: `\r\n${out.join('\r\n')}\r\n${PROMPT}`, state: `the CLI's own output for ${r.name}` }]
      : [{ write: `${PROMPT}${cmd}\r\n${out.join('\r\n')}\r\n${PROMPT}`, state: `the CLI's own output for ${r.name}` }];
    const p = await b.newPage({ viewport: { width: 1600, height: 600 }, deviceScaleFactor: 3 });
    await p.goto(`${srv.base}/capture/cli/term.html`); await p.evaluate((f) => document.fonts.load(`22px "${f}"`), TERM.font);
    await p.evaluate(([cols, rows, T]) => { window.term = new Terminal({ cols, rows, fontFamily: `"${T.font}"`, fontSize: T.fontSize, lineHeight: 1.35, cursorBlink: false, theme: { background: T.background, foreground: T.foreground, selectionBackground: '#00000000' } }); term.open(document.getElementById('t')); }, [r.cols || 60, r.rows || 6, TERM]);
    await p.waitForTimeout(300);
    const size = await p.evaluate(() => { const q = document.querySelector('.xterm-screen').getBoundingClientRect(); return [Math.ceil(q.width + 52), Math.ceil(q.height + 44)]; });
    await p.setViewportSize({ width: size[0], height: size[1] }); let i = 0;
    for (const s of steps) {
      await p.evaluate((d) => new Promise((ok) => term.write(d, ok)), s.write); await p.waitForTimeout(80);
      const file = `term-${r.name}-${String(i++).padStart(2, '0')}.png`; await p.screenshot({ path: `${D}../shots/${file}` });
      const cell = await p.evaluate(() => { const c = term._core._renderService.dimensions.css.cell; return [c.width, c.height]; });
      const rows = await p.evaluate(() => [...document.querySelectorAll('.xterm-rows > div')].map((d) => { const q = d.getBoundingClientRect(); return { text: d.textContent.replace(/\s+$/, ''), box: [q.x, q.y, q.width, q.height] }; }).filter((x) => x.text));
      manifest.push({ file, viewport: size, dsf: 3, state: s.state, cell, rows: rows.map((x) => ({ text: x.text, box: [x.box[0], x.box[1], x.text.length * cell[0], x.box[3]] })) });
    }
    await p.close();
  }
  writeFileSync(`${D}../shots/manifest-term.json`, `${JSON.stringify(manifest, null, 1)}\n`); await b.close(); srv.close();
  console.log(manifest.map((m) => m.file).join(' '));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {await renderRuns();}
