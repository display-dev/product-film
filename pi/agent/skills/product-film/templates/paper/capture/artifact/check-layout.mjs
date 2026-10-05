// Layout gate for the fixture artifact: node <film>/capture/artifact/check-layout.mjs
// Renders every built version at the capture viewports (desktop 1280×800, phone 390×844) and compares the boxes and
// line counts of story.artifact.layoutCheck selectors. A version change must not reflow the page: in one build the
// edited headline wrapped to two lines at 1280 px while the old one fit on one, and the one-word edit made the page jump.
// Fix the artifact's own layout (widen the column, shorten the text), rebuild, and capture again. Exit 1 on a reflow in
// a viewport listed in story.artifact.swapViewports (where the film swaps versions in place; default desktop).
// Other viewports report reflows as INFO: fine only while the film never shows that version change in place there.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '../../tools/pw.mjs';
import { KINDS, MEASURE } from '../lib.mjs';
const C = fileURLToPath(new URL('..', import.meta.url)); const st = JSON.parse(readFileSync(join(C, 'story.json'), 'utf8')); const A = st.artifact;
const stem = A.file.replace(/\.[^.]+$/, ''); const b = await chromium.launch(); let bad = 0; const GATED = A.swapViewports || ['desktop'];
for (const kind of ['desktop', 'phone']) {
  const p = await b.newPage({ viewport: KINDS[kind].viewport, deviceScaleFactor: 1 }); const res = [];
  for (const v of A.versions) {
    await p.goto(pathToFileURL(join(C, 'artifact', `${stem}.v${v.v}.html`)).href); await p.evaluate(() => document.fonts.ready); await p.evaluate(MEASURE);
    res.push({ v: v.v, m: await p.evaluate((sels) => Object.fromEntries(sels.map((s) => [s, { box: window.__box(s), lines: window.__lines(s).length }])), A.layoutCheck) });
  }
  for (const s of A.layoutCheck) {
    const row = res.map((r) => `v${r.v} ${r.m[s].lines} line(s) ${JSON.stringify(r.m[s].box)}`); const [a] = res;
    const moved = res.some((r) => r.m[s].lines !== a.m[s].lines || !r.m[s].box || !a.m[s].box || Math.abs(r.m[s].box[0] - a.m[s].box[0]) > 1 || Math.abs(r.m[s].box[1] - a.m[s].box[1]) > 1 || Math.abs(r.m[s].box[3] - a.m[s].box[3]) > 1);
    if (moved && GATED.includes(kind)) {bad++;} console.log(`${moved ? (GATED.includes(kind) ? 'REFLOW' : 'INFO  ') : 'same  '} ${kind} ${s}: ${row.join(' | ')}`);
  }
  await p.close();
}
await b.close(); console.log(bad ? `${bad} reflow(s): fix the artifact layout before capturing` : 'no reflow between versions'); process.exit(bad ? 1 : 0);
