// Kit contact sheet: node <film>/kit/build-sheet.mjs [variant 0|1|2] → kit/kit-sheet-v<variant>.png
// Render all three boil variants and compare them: the cast must read as one character in every pose and variant.
import { fileURLToPath } from 'node:url';
import { chromium } from '../tools/pw.mjs';
import { startStatic } from '../tools/static.mjs';
const K = fileURLToPath(new URL('.', import.meta.url)); const v = process.argv[2] || '0';
const srv = await startStatic(); const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 3000, height: 2300 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
await p.goto(`${srv.base}/kit/kit.html?v=${v}`); await p.waitForFunction(() => document.title === 'ready', null, { timeout: 180000 });
await p.screenshot({ path: `${K}kit-sheet-v${v}.png` }); await b.close(); srv.close(); console.log('sheet', `${K}kit-sheet-v${v}.png`);
