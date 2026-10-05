// Quick look at single frames, each drawn on a fresh page, tiled 2 columns at 960 px into preview/<out>.
// Usage, from any directory: node <film>/previewq.js out.jpg "beat=s1&mode=overlay@1.3" "beat=card&i=0&dur=1.5@0.8" ...
// Each spec is <query>@<clip seconds>. PAGE=kinetic.html for another engine page; VW=1080 for a square cut.
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { chromium } = require(path.join(__dirname, 'pw.cjs'));
const HF = __dirname;
const [out, ...specs] = process.argv.slice(2);
if (!out || !specs.length) { console.error('usage: node previewq.js out.jpg "<query>@<seconds>" ...'); process.exit(1); }
const dir = path.join(HF, 'preview'); fs.mkdirSync(dir, { recursive: true });
const page = pathToFileURL(path.join(HF, process.env.PAGE || 'beats.html')).href;
(async () => { const b = await chromium.launch(); const VWW = +(process.env.VW || 1920); const p = await b.newPage({ viewport: { width: VWW, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 200)));
  const files = [];
  for (const [k, sp] of specs.entries()) { const at = sp.lastIndexOf('@'); const q = sp.slice(0, at), t = sp.slice(at + 1);
    await p.goto(`${page}?${q}`); await p.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))]).then(() => window.READY)); await p.waitForTimeout(250);
    await p.evaluate(x => window.seek(x), +t); const f = path.join(dir, `q_${k}.jpg`); await p.screenshot({ path: f, type: 'jpeg', quality: 85 }); files.push(f); }
  await b.close();
  const n = files.length, cols = 2;
  const layout = files.map((_, i) => `${(i % cols) * VWW}_${Math.floor(i / cols) * 1080}`).join('|');
  const dest = path.isAbsolute(out) ? out : path.join(dir, out);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap(f => ['-i', f]), '-filter_complex', `${n > 1 ? `xstack=inputs=${n}:layout=${layout}:fill=white,` : ''}scale=1920:-1`, '-frames:v', '1', '-update', '1', dest]);
  console.log(dest);
})();
