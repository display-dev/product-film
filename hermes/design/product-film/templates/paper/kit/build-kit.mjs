// Freeze the kit: node <film>/kit/build-kit.mjs → kit/png/*.png + kit/png/manifest.json
// Re-run after every change to kit.js or puppet.js; the film only ever loads the frozen files.
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../tools/pw.mjs';
import { startStatic } from '../tools/static.mjs';
const K = fileURLToPath(new URL('.', import.meta.url)); rmSync(`${K}png`, { recursive: true, force: true }); mkdirSync(`${K}png`, { recursive: true });
const srv = await startStatic(); const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(`${srv.base}/kit/export.html`); await p.waitForFunction(() => document.title === 'ready' || document.title === 'error', null, { timeout: 180000 });
const err = await p.evaluate(() => window.KITERR); if (err) { console.error(err); process.exit(1); }
const out = await p.evaluate(() => window.KITOUT); const man = {};
for (const [name, o] of Object.entries(out)) { writeFileSync(`${K}png/${name}.png`, Buffer.from(o.png.split(',')[1], 'base64')); const { png: _png, ...meta } = o; man[name] = meta; }
writeFileSync(`${K}png/manifest.json`, JSON.stringify(man, null, 1)); await b.close(); srv.close(); console.log(Object.keys(man).length, 'pieces →', `${K}png`);
