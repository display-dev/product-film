// Put fonts on disk as local woff2 files, so renders never depend on the network.
//   node <film>/tools/fetch-fonts.mjs                                   → kit/fonts: Geist, Geist Mono, Caveat Brush
//   node <film>/tools/fetch-fonts.mjs --to capture/fonts anton-latin.woff2=Anton manrope-latin.woff2=Manrope:wght@200..800
//                                                                        → the example artifact's fonts
// Looks in FONT_CACHE (a folder of woff2 files, for offline work), then downloads the latin subset from Google Fonts.
// Use OFL fonts only and record each one's licence in notes/sources.md.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const F = fileURLToPath(new URL('..', import.meta.url)); const args = process.argv.slice(2);
const to = args[0] === '--to' ? args[1] : 'kit/fonts'; const OUT = join(F, to); mkdirSync(OUT, { recursive: true });
const FONTS = args[0] === '--to' ? args.slice(2).map((a) => a.split('=')) : [['geist.woff2', 'Geist:wght@100..900'], ['geist-mono.woff2', 'Geist+Mono:wght@100..900'], ['caveat-brush.woff2', 'Caveat+Brush']];
const CACHES = [process.env.FONT_CACHE].filter(Boolean);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
for (const [file, family] of FONTS) {
  if (existsSync(join(OUT, file))) { console.log('have', file); continue; }
  const hit = CACHES.find((c) => existsSync(join(c, file))); if (hit) { copyFileSync(join(hit, file), join(OUT, file)); console.log('copied', file, 'from', hit); continue; }
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}&display=swap`, { headers: { 'user-agent': UA } })).text();
  const blocks = css.split('@font-face').filter((b) => /U\+0000-00FF/.test(b));
  const url = (blocks[0] || css).match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!url) {throw new Error(`no woff2 url for ${family}`);}
  writeFileSync(join(OUT, file), Buffer.from(await (await fetch(url)).arrayBuffer())); console.log('downloaded', file);
}
