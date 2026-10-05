// Render frames: node <film>/film/render.mjs <fmt> <cap 1|0> <from> <to>
// → frames/<fmt>[-nocap]/f_00000.jpg …, 2× supersampled JPEG q95, strict mode (a missing shot, box or cue stops the
// render). Each worker preloads only the shots its frame range needs. A stalled frame reloads the page and retries.
// SKIP_EXISTING=1 keeps frames already on disk (resume after a crash).
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../tools/pw.mjs';
import { startStatic } from '../tools/static.mjs';
const D = fileURLToPath(new URL('.', import.meta.url)); const [fmt = '16x9', cap = '1', from = '0', to = '-1'] = process.argv.slice(2);
const size = { '16x9': [1920, 1080], '9x16': [1080, 1920], '4x5': [1080, 1350] }[fmt];
const out = `${D}../frames/${fmt}${cap === '0' ? '-nocap' : ''}`; mkdirSync(out, { recursive: true });
const srv = await startStatic(); const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
let fps = 30, N = 0;
const load = async (a, z) => { await p.goto(`${srv.base}/film/film.html?fmt=${fmt}&cap=${cap}&strict=1&t0=${a / fps}&t1=${z / fps}`); await p.waitForFunction(() => document.title === 'ready', null, { timeout: 180000 }); };
await load(0, 0); fps = await p.evaluate(() => window.fps); N = Math.round(await p.evaluate(() => window.duration) * fps);
const a = +from, z = +to < 0 ? N : Math.min(N, +to); await load(a, z);
const t0 = Date.now();
for (let i = a; i < z; i++) {
  const f = `${out}/f_${String(i).padStart(5, '0')}.jpg`; if (process.env.SKIP_EXISTING && existsSync(f)) {continue;}
  for (let attempt = 1; ; attempt++) {
    try { await p.evaluate((t) => window.seek(t), i / fps); await p.screenshot({ path: f, type: 'jpeg', quality: 95, timeout: 120000 }); break; }
    catch (e) { if (attempt >= 3) {throw e;} console.log('frame', i, 'retry', attempt, e.message.split('\n')[0]); await load(a, z); }
  }
  if ((i - a) % 60 === 0) {console.log(fmt, cap, i, `${((Date.now() - t0) / Math.max(1, i - a + 1)).toFixed(0)} ms/frame`);}
}
await b.close(); srv.close(); console.log('done', fmt, cap, a, z, N);
