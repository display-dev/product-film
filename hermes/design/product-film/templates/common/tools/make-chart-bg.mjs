// Render the engraved chart background into the film folder (works from any working directory):
//   node <film>/tools/make-chart-bg.mjs [--accent <css colour>] [--ink <colour>] [--plate <colour>] [--font <family>]
// → <film>/backgrounds/engraved-chart-3840x2160.png        16:9 on the plate, for 4K and 1080p video
//   <film>/backgrounds/engraved-chart-lines-3840x2160.png  lines only, transparent: lay it on any plate, or on a 9:16
//                                                           or 4:5 frame scaled to the width and anchored to the bottom
// Colours: the arguments win. Otherwise the film's brand values: "brand" in film/timeline.json (Route D), else the
// --accent, --ink and --plate custom properties of the brand block in an HTML file at the film root (beats.html),
// else the template defaults. The soundings use kit/fonts/geist.woff2 when the film has it (no network), else
// Google Fonts. The drawing is chart-background.html next to this file; open it in a browser to see the parameters.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('../pw.cjs');
const TOOLS = dirname(fileURLToPath(import.meta.url)); const FILM = dirname(TOOLS);

const args = process.argv.slice(2); const arg = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
function filmBrand() {
  const tl = join(FILM, 'film', 'timeline.json');
  if (existsSync(tl)) { const b = JSON.parse(readFileSync(tl, 'utf8')).brand; if (b) {return { from: 'film/timeline.json', ...b };} }
  const pages = readdirSync(FILM).filter((n) => n.endsWith('.html')).sort((a, b) => (b === 'beats.html') - (a === 'beats.html'));   // the walkthrough's beats.html first
  for (const f of pages) {
    const css = readFileSync(join(FILM, f), 'utf8'); const v = (k) => css.match(new RegExp(`--${k}\\s*:\\s*([^;}]+)[;}]`))?.[1]?.trim();
    const b = { accent: v('accent'), ink: v('ink'), plate: v('plate') };
    for (const k of Object.keys(b)) {if (!b[k] || b[k].startsWith('var(')) {delete b[k];}}
    if (b.accent) {return { from: f, ...b };}
  }
  return { from: 'template defaults' };
}
const fb = filmBrand();
const brand = { accent: arg('accent') || fb.accent || '#0E8A7E', ink: arg('ink') || fb.ink || '#121212', plate: arg('plate') || fb.plate || '#F3F3F3', font: arg('font') || 'Geist' };
const fontFile = brand.font === 'Geist' ? [join(FILM, 'kit', 'fonts', 'geist.woff2'), join(FILM, 'fonts', 'geist.woff2')].find((p) => existsSync(p)) : undefined;
const OUT = join(FILM, 'backgrounds'); mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
async function render(transparent, file) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  if (fontFile) {await p.addInitScript((d) => { window.CHART_FONT = d; }, `data:font/woff2;base64,${readFileSync(fontFile).toString('base64')}`);}
  const q = new URLSearchParams({ accent: brand.accent, ink: brand.ink, plate: brand.plate, font: brand.font }); if (transparent) {q.set('transparent', '');}
  await p.goto(`${pathToFileURL(join(TOOLS, 'chart-background.html')).href}?${q}`);
  await p.waitForFunction(() => document.title === 'done', null, { timeout: 60000 });
  await p.screenshot({ path: join(OUT, file), omitBackground: transparent }); await p.close();
  console.log('wrote', join(OUT, file));
}
await render(false, 'engraved-chart-3840x2160.png');
await render(true, 'engraved-chart-lines-3840x2160.png');
await b.close();
console.log(`colours: accent ${brand.accent}, ink ${brand.ink}, plate ${brand.plate} (from ${arg('accent') ? 'arguments' : fb.from}); soundings font: ${fontFile ? 'film font file' : `${brand.font} from Google Fonts`}`);
