// Audits a plan's clips for the defects that cost the most review rounds in walkthrough films:
//  1. Pointer rests. Every stretch where a pointer (.mc) stays still for 0.25 s or more, and every hold that starts
//     while the pointer is still moving (it reads as a stuck cursor).
//  2. One-frame jumps. Any element with an id whose box, opacity or text jumps for exactly one frame and comes
//     back – the signature of centring before the text changed, or of a caret re-inserted into the text. Boxes are
//     measured in their camera's own coordinates (the nearest #scene or .gw), so camera moves do not count, and a
//     frame counts only when it sits far off the line between its neighbours (smooth arcs and presses do not).
//  3. Stateless seek. A sample of frames is drawn again on a fresh page; any element whose text differs from the
//     frame reached by seeking through the clip means seek() depends on earlier frames. Renders seek through the
//     clip in order and single-frame previews do not, so this is the bug previews cannot show.
// Usage, from any directory: node <film>/audit.js plan-A.json [clip …]
// The page is the plan's "page" (default beats.html); PAGE=beats-v5.html audits another build. Every .mc element is a pointer.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(__dirname, 'pw.cjs'));
const fs = require('node:fs');
const HF = __dirname; const FPS = +process.env.FPS || 60;
const planArg = process.argv[2] || 'plan-A.json';
const planPath = [path.resolve(HF, planArg), path.resolve(planArg)].find(f => fs.existsSync(f));
if (!planPath) { console.error(`plan not found: ${planArg}`); process.exit(1); }
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const PAGE = process.env.PAGE || plan.page || 'beats.html';
const pageUrl = q => `${pathToFileURL(path.join(HF, PAGE)).href}?${q}`;
const want = process.argv.slice(3);
const f2 = x => x.toFixed(2);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: plan.w || 1920, height: plan.h || 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 160)));
  for (const c of plan.clips) {if ((c.dur === undefined || c.dur === null)) {
    await p.goto(pageUrl(new URLSearchParams({ ...plan.q, beat: c.beat, slow: plan.slow || 1.2 })));
    c.dur = (await p.evaluate(([a, z]) => window.clipDur(a, z), [c.toff || 0, c.tend])) + (c.tail || 0);
  }}
  let g = 0; for (const c of plan.clips) { c.g0 = g; g += c.dur - plan.xf; }
  let problems = 0;
  for (const c of plan.clips.filter(c => !want.length || want.includes(c.id))) {
    const q = new URLSearchParams({ ...plan.q, beat: c.beat, mode: c.mode || plan.mode, dur: c.dur, xf: plan.xf, g0: c.g0, toff: c.toff || 0, i: c.i || 0, slow: plan.slow || 1.2, ...(c.tail ? { tend: c.tend } : {}) });
    await p.goto(pageUrl(q));
    await p.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))]).then(() => window.READY));
    const n = Math.round(c.dur * FPS);
    const r = await p.evaluate(({ n, FPS }) => {
      const F = window.FILM || {}; const scene = t => F.warp ? F.warp(F.R0 + t) : null;
      const mcs = [...document.querySelectorAll('#stage .mc')]; const els = [...document.querySelectorAll('#stage [id]')].filter(e => !mcs.includes(e));
      const ptr = mcs.map(() => []), geo = els.map(() => []);
      const at = mc => { if (!mc.getClientRects().length) {return null;} const m = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/.exec(mc.style.transform || ''); return m ? [+m[1], +m[2], +(mc.style.opacity || 0)] : null; };
      const frameOf = els.map(e => e.parentElement && e.parentElement.closest('#scene, .gw'));   // the element's camera
      const snap = {}, every = Math.max(1, Math.floor(n / 24));   // text of every element at ~24 frames, for the stateless-seek check
      for (let i = 0; i < n; i++) {
        window.seek(i / FPS);
        mcs.forEach((mc, k) => ptr[k].push(at(mc)));
        if (i % every === 7 % every && i >= 7) {snap[i] = els.filter(e => e.getClientRects().length).map(e => [e.id, e.textContent.slice(0, 120)]);}   // visible only
        const fr = new Map();
        els.forEach((e, k) => {
          const f = frameOf[k]; if (f && !fr.has(f)) { const r = f.getBoundingClientRect(); fr.set(f, { x: r.x, y: r.y, k: r.width ? 1920 / r.width : 1 }); }
          const F = f ? fr.get(f) : { x: 0, y: 0, k: 1 };   // undo the camera
          const cs = getComputedStyle(e); const b = e.getBoundingClientRect();
          const vis = e.getClientRects().length > 0 && cs.visibility !== 'hidden' && b.width > 0;
          const x = (b.x - F.x) * F.k, y = (b.y - F.y) * F.k, bw = b.width * F.k, bh = b.height * F.k;
          geo[k].push(vis ? [x + bw / 2, y + bh / 2, bw, bh, +cs.opacity, e.childElementCount ? '' : e.textContent] : null);
        });
      }
      // pointer rests
      const rests = [];
      mcs.forEach((mc, k) => { let s = null; const P = ptr[k];
        for (let i = 1; i <= n; i++) {
          const a = P[i - 1], b2 = P[i]; const still = a && b2 && a[2] > .5 && b2[2] > .5 && Math.hypot(b2[0] - a[0], b2[1] - a[1]) < .05;
          if (still && s === null) {s = i - 1;} if (!still && s !== null) { if ((i - 1 - s) / FPS >= .25) {rests.push([s / FPS, (i - 1) / FPS, scene(s / FPS), scene((i - 1) / FPS), mc.id]);} s = null; }
        } });
      rests.sort((a, b) => a[0] - b[0]);
      // holds that freeze a moving pointer
      const holds = [];
      if (mcs.length && F.HOLDS) {for (const [hs] of (F.HOLDS[F.SC] || [])) {
        const tr = F.unwarp(hs) - F.R0; if (tr <= 0 || tr >= n / FPS) { continue; }
        window.seek(Math.max(0, tr - .06 * F.SLOW)); const a = mcs.map(at); window.seek(tr); const b2 = mcs.map(at);
        let moved = 0; mcs.forEach((_, k) => { if (a[k] && b2[k] && b2[k][2] > .5) { moved = Math.max(moved, Math.hypot(b2[k][0] - a[k][0], b2[k][1] - a[k][1])); } }); holds.push([hs, tr, moved]);
      }}
      // one-frame jumps
      const spikes = [];
      els.forEach((e, k) => { const v = geo[k]; for (let i = 1; i < n - 1; i++) {
        const a = v[i - 1], m = v[i], z = v[i + 1]; if (!a || !m || !z) {continue;}
        // an outlier: frame i sits far off the straight line between its neighbours, compared with how far they move
        const rev = (j, min) => { const dev = Math.abs(m[j] - (a[j] + z[j]) / 2); return dev >= Math.max(min, 3 * Math.abs(a[j] - z[j])); };
        for (let j = 0; j < 4; j++) {if (rev(j, 2)) { spikes.push([e.id, i / FPS, scene(i / FPS), ['x', 'y', 'width', 'height'][j], m[j] - a[j]]); break; }}
        if (rev(4, .25)) {spikes.push([e.id, i / FPS, scene(i / FPS), 'opacity', m[4] - a[4]]);}
        if (a[5] && a[5] === z[5] && m[5] !== a[5]) {spikes.push([e.id, i / FPS, scene(i / FPS), 'text', 0]);}
      } });
      return { rests, holds, spikes, hasPointer: mcs.length > 0, snap };
    }, { n, FPS });
    console.log(`\n${plan.name}/${c.id}  ${c.beat}  ${f2(c.dur)} s, ${n} frames`);
    if (r.hasPointer) {
      console.log('  pointer rests ≥ 0.25 s (clip s → scene s):');
      for (const [a, z, sa, sz, id] of r.rests) {console.log(`    ${f2(a)}–${f2(z)}  ${f2(z - a)} s   scene ${sa === null ? '?' : f2(sa)}–${sz === null ? '?' : f2(sz)}  #${id}${z - a > 1.2 ? '   ← long: typing, or a hold on purpose?' : ''}`);}
      for (const [hs, tr, moved] of r.holds) { const bad = moved > 1; problems += bad; console.log(`  hold at scene ${hs} (clip ${f2(tr)} s): ${bad ? `MOVING – the pointer travels ${moved.toFixed(1)} px in the 0.06 s before it` : 'pointer at rest'}`); }
    }
    // stateless seek: redraw the sampled frames on a fresh page and compare
    const drift = [];
    for (const [i, rows] of Object.entries(r.snap)) {
      await p.goto(pageUrl(q)); await p.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))]).then(() => window.READY));
      const fresh = await p.evaluate(({ i, FPS }) => { window.seek(i / FPS); return [...document.querySelectorAll('#stage [id]')].filter(e => !e.classList.contains('mc') && e.getClientRects().length).map(e => `${e.id}\u0001${e.textContent.slice(0, 120)}`); }, { i: +i, FPS });
      const fm = new Map(fresh.map(x => x.split('\u0001')));
      const bad = rows.filter(row => fm.has(row[0]) && fm.get(row[0]) !== row[1]).map(row => row[0]);
      if (bad.length) {drift.push([bad.slice(-3).join(' #'), +i / FPS]);}   // the innermost ids name the element best
    }
    for (const [id, t] of drift) {console.log(`  STATEFUL SEEK #${id}: its text at clip ${f2(t)} s differs between a fresh load and seeking through`);}
    problems += drift.length;
    problems += r.spikes.length;
    if (!r.spikes.length) {console.log('  one-frame jumps: none');}
    for (const [id, t, sc, what, d] of r.spikes) {console.log(`  ONE-FRAME JUMP #${id} ${what}${what === 'text' ? '' : ` ${d > 0 ? '+' : ''}${d.toFixed(what === 'opacity' ? 2 : 1)}`} at clip ${f2(t)} s (scene ${sc === null ? '?' : f2(sc)})`);}
  }
  console.log(`\n${problems ? `${problems} problem(s)` : 'clean'}`);
  await b.close(); process.exitCode = problems ? 1 : 0;
})();
