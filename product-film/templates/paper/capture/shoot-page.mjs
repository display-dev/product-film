// Screenshot local pages that are not product UI – the fixture artifact before it is published (the raw draft), or
// any self-contained page – with named element boxes, into shots/ and a manifest.
//   node <film>/capture/shoot-page.mjs [file …]          (jobs in capture/shoot.json; no arguments = every job)
// shoot.json: [{ "page": "capture/artifact/<stem>.v1.html" (or an http URL), "file": "page-draft.png",
//   "kind": "desktop" | "phone", "manifest": "page", "state": "what the frame shows",
//   "boxes": { "headline": "box:main h1", "headlineInk": "ink:main h1", "word": "words:main h1|plan", "lines": "lines:main h1" } }]
// Box kinds are the ones lib.mjs measure() takes (box, words, lines, ink, input).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '../tools/pw.mjs';
import { CAPTURE, FILM, INIT_SCRIPT, KINDS, SHOTS, contextOptions, manifest, measure } from './lib.mjs';
const jobs = JSON.parse(readFileSync(join(CAPTURE, 'shoot.json'), 'utf8')); const want = new Set(process.argv.slice(2));
const b = await chromium.launch();
for (const j of jobs.filter((x) => !want.size || want.has(x.file))) {
  const ctx = await b.newContext(contextOptions(j.kind)); await ctx.addInitScript(INIT_SCRIPT); const p = await ctx.newPage();
  await p.goto(/^https?:/.test(j.page) ? j.page : pathToFileURL(join(FILM, j.page)).href); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  const { boxes } = await measure(p.mainFrame(), j.boxes || {});
  await p.screenshot({ path: join(SHOTS, j.file), caret: 'hide' });
  const vp = KINDS[j.kind].viewport; manifest(j.manifest).put({ file: j.file, url: j.page, viewport: [vp.width, vp.height], dsf: KINDS[j.kind].deviceScaleFactor, state: j.state || '', boxes });
  console.log('shot', j.file, Object.keys(boxes).filter((k) => boxes[k]).join(',')); await ctx.close();
}
await b.close();
