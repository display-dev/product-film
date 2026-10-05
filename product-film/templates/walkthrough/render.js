// Renders clips of a plan (plan-A.json, plan-B.json, plan-K.json) at FPS (default 60), DSF 2, into frames/<plan>/<clip>/.
// Usage, from any directory: node <film>/render.js plan-B.json B02 B04:0:120 ...   (no ids = every clip; id:from:to = a frame range)
// The plan is looked up in the film folder first, then relative to the working directory.
// Clips given as scene ranges get their real length (slowdown and holds included) from the page, and each gets its
// film-time offset (g0) so anything animated on film time stays continuous across dissolves.
// PLANONLY=1 prints each clip's duration and offset; save it as plans.txt for plan-jobs.py.
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(__dirname, 'pw.cjs'));
const HF = __dirname; const FPS = +process.env.FPS || 60;
const planArg = process.argv[2] || 'plan-A.json';
const planPath = [path.resolve(HF, planArg), path.resolve(planArg)].find(f => fs.existsSync(f));
if (!planPath) { console.error(`plan not found: ${planArg}`); process.exit(1); }
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const pageUrl = q => `${pathToFileURL(path.join(HF, plan.page || 'beats.html')).href}?${q}`;
const want = process.argv.slice(3);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: plan.w || 1920, height: plan.h || 1080 }, deviceScaleFactor: 2 });   // plan.w/h: 1080x1080 for a square cut
  // clips given as scene-time ranges (toff..tend) get their real duration – slowdown and holds included – from the page
  for (const c of plan.clips) {if ((c.dur === undefined || c.dur === null)) {
    await p.goto(pageUrl(new URLSearchParams({ ...plan.q, beat: c.beat, slow: plan.slow || 1.2 })));
    c.dur = +((await p.evaluate(([a, z]) => window.clipDur(a, z), [c.toff || 0, c.tend])) + (c.tail || 0)).toFixed(4);
  }}
  let g = 0; for (const c of plan.clips) { c.g0 = +g.toFixed(4); g += c.dur - plan.xf; }
  if (process.env.PLANONLY) { for (const c of plan.clips) {console.log(c.id, c.beat, c.dur, c.g0);} console.log('total', +(g + plan.xf).toFixed(4)); await b.close(); return; }
  const jobs = (want.length ? want : plan.clips.map(c => c.id)).map(a => { const [id, f, t] = a.split(':'); const c = plan.clips.find(x => x.id === id); if (!c) { throw new Error(`no clip ${id} in ${planArg}`); } const n = Math.round(c.dur * FPS); return { c, from: f ? +f : 0, to: t ? Math.min(+t, n) : n, n }; });
  p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 160)));
  for (const j of jobs) {
    const c = j.c, dir = path.join(HF, 'frames', plan.name, c.id); fs.mkdirSync(dir, { recursive: true });
    const q = new URLSearchParams({ ...plan.q, beat: c.beat, mode: c.mode || plan.mode, dur: c.dur, xf: plan.xf, g0: c.g0, toff: c.toff || 0, i: c.i || 0, slow: plan.slow || 1.2, ...(c.tail ? { tend: c.tend } : {}) });
    const load = async () => { await p.goto(pageUrl(q)); await p.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))]).then(() => window.READY)); await p.waitForTimeout(300); }; // window.READY: pages that mount captured UI in shadow roots expose it; their images are not in document.images
    await load();
    for (let i = j.from; i < j.to; i++) {
      for (let attempt = 1; ; attempt++) {   // a stalled screenshot under load reloads the page and retries the frame
        try { await p.evaluate(t => window.seek(t), i / FPS); await p.screenshot({ path: path.join(dir, `f_${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93, timeout: 120000 }); break; }
        catch (e) { if (attempt >= 3) {throw e;} console.log(c.id, 'frame', i, 'retry', attempt, e.message.split('\n')[0]); await load(); }
      }
    }
    console.log(c.id, `${j.from}-${j.to} of ${j.n}`);
  }
  await b.close();
})();
