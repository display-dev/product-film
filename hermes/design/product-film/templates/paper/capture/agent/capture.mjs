// Render the agent window's states → ../shots/agent-<NN>.png (wide 1200×582) or agentn-<NN>.png (narrow 720×652,
// for 9:16, so its text stays readable on a phone), at device scale 3, transparent outside the window, plus
// manifest-agent[-narrow].json with boxes for the window, cards, result lines and the URL (Range box of the link text).
// node <film>/capture/agent/capture.mjs [narrow]     (served over http, because the window fetches agent.json)
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../tools/pw.mjs';
import { startStatic } from '../../tools/static.mjs';
const D = fileURLToPath(new URL('.', import.meta.url)); const NARROW = process.argv[2] === 'narrow';
const A = JSON.parse(readFileSync(`${D}agent.json`, 'utf8')); const maxS = Math.max(...A.items.map((i) => i.s));
const VW = NARROW ? 720 : 1200, VH = NARROW ? 652 : 582; const man = [];
const srv = await startStatic(); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3 });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
for (let s = 0; s <= maxS; s++) {
  await p.goto(`${srv.base}/capture/agent/agent-window.html?s=${s}${NARROW ? '&w=720&h=560' : ''}`); await p.waitForFunction(() => document.title === 'ready'); await p.waitForTimeout(100);
  const boxes = await p.evaluate(() => { const r2 = (n) => Math.round(n * 10) / 10; const out = {};
    const put = (k, e, range) => { if (!e) {return;} let b = e.getBoundingClientRect(); if (range) { const rg = document.createRange(); rg.selectNodeContents(e); b = rg.getBoundingClientRect(); } if (b.width) {out[k] = [r2(b.x), r2(b.y), r2(b.width), r2(b.height)];} };
    put('window', document.getElementById('win')); put('body', document.getElementById('body'));
    document.querySelectorAll('[id^=card],[id^=res]').forEach((e) => put(e.id.replace('res', 'result'), e)); document.querySelectorAll('[id^=url]').forEach((e) => put(e.id, e, true)); return out; });
  const file = `agent${NARROW ? 'n' : ''}-${String(s).padStart(2, '0')}.png`; await p.screenshot({ path: `${D}../shots/${file}`, omitBackground: true, clip: { x: 0, y: 0, width: VW, height: VH } });
  man.push({ file, viewport: [VW, VH], dsf: 3, state: `agent window state ${s}${NARROW ? ' (narrow, 9:16)' : ''}`, boxes });
}
writeFileSync(`${D}../shots/manifest-agent${NARROW ? '-narrow' : ''}.json`, JSON.stringify(man, null, 1)); await b.close(); srv.close(); console.log(man.map((m) => m.file).join(' '));
