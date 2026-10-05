#!/usr/bin/env node
// Renders assets/cover.html to assets/cover.png (1280×640 at 2×). Needs Playwright: set PLAYWRIGHT_DIR to any folder
// whose node_modules has it (a film folder made by templates/new-film.sh works).
// The four frames in assets/frames/ are stills from the templates' example renders; refresh them when an example changes.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const { chromium } = createRequire(import.meta.url)(join(ROOT, 'product-film/templates/common/pw.cjs'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(join(ROOT, 'assets/cover.html')).href);
await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode())]));
await page.screenshot({ path: join(ROOT, 'assets/cover.png') });
await browser.close();
console.log('assets/cover.png');
