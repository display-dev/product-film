// Loads Playwright for the film scripts. Nothing is installed into the skill itself.
// Search order: PLAYWRIGHT_DIR (any folder whose node_modules has playwright), then this film folder and its
// parents, then the current directory and its parents. new-film.sh installs it into the film folder when none has it.
//   CommonJS:  const { chromium } = require('<film>/pw.cjs')
//   ES module: const { chromium } = createRequire(import.meta.url)('<relative path>/pw.cjs')
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

function findUp(start) {
  for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'node_modules', 'playwright', 'package.json'))) { return dir; }
    if (path.dirname(dir) === dir) { return null; }
  }
}

const base = [process.env.PLAYWRIGHT_DIR, __dirname, process.cwd()].filter(Boolean).map(findUp).find(Boolean);
if (!base) {
  console.error(`Playwright not found. Once per film folder:
  cd "${__dirname}" && npm init -y >/dev/null && npm i -D playwright && npx playwright install chromium
or set PLAYWRIGHT_DIR to a folder whose node_modules has playwright.`);
  process.exit(2);
}
module.exports = createRequire(path.join(base, 'index.js'))('playwright');
