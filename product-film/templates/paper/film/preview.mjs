// Quick look: node <film>/film/preview.mjs <fmt> <t1,t2,…> [out.jpg] [dsf 1] [cap 1] [guides 0] [tl]
// Tiles the frames into one sheet (default notes/checks/preview-<fmt>.jpg) and prints any engine warnings
// (missing shots, boxes or backgrounds). Each run loads a fresh page, like a render worker does.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../tools/pw.mjs';
import { startStatic } from '../tools/static.mjs';
const D = fileURLToPath(new URL('.', import.meta.url));
const [fmt = '16x9', times = '0', outArg, dsf = '1', cap = '1', guides = '0', tl = 'timeline.json'] = process.argv.slice(2);
const out = outArg || `${D}../notes/checks/preview-${fmt}.jpg`;
const size = { '16x9': [1920, 1080], '9x16': [1080, 1920], '4x5': [1080, 1350] }[fmt];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: +dsf });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
const srv = await startStatic(); await p.goto(`${srv.base}/film/film.html?fmt=${fmt}&cap=${cap}&guides=${guides}&tl=${tl}`); await p.waitForFunction(() => document.title === 'ready', null, { timeout: 180000 });
const tmp = `${D}../notes/checks/pv-${fmt}`; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const ts = times.split(',').map(Number); let i = 0;
for (const t of ts) { const t0 = Date.now(); await p.evaluate((t) => window.seek(t), t); await p.screenshot({ path: `${tmp}/f${String(i++).padStart(3, '0')}.png` }); if (i === 1) {console.log('frame ms', Date.now() - t0);} }
const warns = await p.evaluate(() => window.WARN); if (warns.length) {console.log(`WARN\n  ${warns.join('\n  ')}`);}
await b.close(); srv.close();
const cols = Math.min(ts.length, fmt === '16x9' ? 3 : 5); const tw = fmt === '16x9' ? 960 : 432;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${tmp}/f%03d.png`, '-vf', `scale=${tw}:-1:flags=lanczos,tile=${cols}x${Math.ceil(ts.length / cols)}:padding=6:color=white`, '-frames:v', '1', '-q:v', '3', out]);
console.log('sheet', out, `(full-size frames in ${tmp})`);
