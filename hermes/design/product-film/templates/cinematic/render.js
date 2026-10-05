// Renders every product beat in beats.html (deterministic: window.seek(t); lengths from window.BEATS) to
// frames/<beat>/ at 1920x1080, device scale factor 2, 25 fps, then encodes seg/<beat>.mp4 (1080p, grain, vignette).
// Usage, from any directory: node <film>/render.js          (every beat)
//   ONLY=b2,b3 node <film>/render.js                        (a subset)
//   ONLY=b1 FRAMES=40:60 node <film>/render.js              (frames 40–59 only, no encode: for a quick look)
// Then: bash <film>/assemble.sh
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { chromium } = require(path.join(__dirname, 'pw.cjs'));
const HF = __dirname; const FPS = 25;
const page = pathToFileURL(path.join(HF, 'beats.html')).href;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 120)));
  await p.goto(page); const all = await p.evaluate(() => window.BEATS);
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const range = process.env.FRAMES ? process.env.FRAMES.split(':').map(Number) : null;
  for (const [id, T] of Object.entries(all).filter(([id]) => !only || only.includes(id))) {
    const dir = path.join(HF, 'frames', id);
    if (!range) { fs.rmSync(dir, { recursive: true, force: true }); }
    fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(path.join(HF, 'seg'), { recursive: true });
    await p.goto(`${page}?beat=${id}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
    const n = Math.round(T * FPS), [from, to] = range ? [range[0], Math.min(range[1], n)] : [0, n];
    for (let i = from; i < to; i++) { await p.evaluate(t => window.seek(t), i / FPS); await p.screenshot({ path: path.join(dir, `f_${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 94 }); }
    if (range) { console.log(id, `frames ${from}-${to} → frames/${id}/`); continue; }
    execFileSync('ffmpeg', ['-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f_%04d.jpg'), '-vf', 'scale=1920:1080:flags=lanczos,noise=alls=6:allf=t+u,vignette=PI/6:mode=backward,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-an', path.join(HF, 'seg', `${id}.mp4`), '-y']);
    console.log(id, n, `frames → seg/${id}.mp4`);
  }
  await b.close();
})();
