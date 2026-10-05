// CLI harness: your real CLI against a local fixture API, its own output rendered in xterm.js.
//   node <film>/capture/cli/capture.mjs [run …]       every story.json cli.runs entry, or the named ones
// For each run: copy its files into capture/cli/work/, start fixture-api.mjs, execute `run` there with the CLI's
// base-URL variable (cli.baseUrlEnv) pointing at the fixture API and its key variable (cli.keyEnv) set to a fake key,
// save the output as out-<name>.txt, then render every run with render-term.mjs. Exit 1 on an unmocked call or a
// failed run. Find the base-URL variable in your CLI's README or source; a CLI with no such variable cannot be
// captured safely, so add one (or a --api-url flag) before filming it.
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFixtureApi } from './fixture-api.mjs';
import { renderRuns } from './render-term.mjs';
const D = fileURLToPath(new URL('.', import.meta.url)); const FILM = join(D, '..', '..');
const story = JSON.parse(readFileSync(join(D, '..', 'story.json'), 'utf8')); const CLI = story.cli || {};
const want = new Set(process.argv.slice(2)); const runs = (CLI.runs || []).filter((r) => !want.size || want.has(r.name));
const WORK = join(D, 'work'); mkdirSync(WORK, { recursive: true });
const api = await startFixtureApi(); let failed = 0;
for (const r of runs) {
  for (const [to, from] of Object.entries(r.files || {})) {copyFileSync(join(FILM, from), join(WORK, to));}
  const cmd = r.run.replaceAll('{cli}', D.replace(/\/$/, '')).replaceAll('{film}', FILM);
  const env = { ...process.env, [CLI.baseUrlEnv]: api.url, [CLI.keyEnv]: CLI.fakeKey, FORCE_COLOR: '1', COLUMNS: String(r.cols || 60) };
  let out;
  // async on purpose: the fixture API runs in this process and must keep answering while the CLI waits on it
  try { out = (await promisify(exec)(cmd, { cwd: WORK, env, timeout: 60000 })).stdout; }
  catch (e) { failed++; out = `${e.stdout || ''}${e.stderr || ''}`; console.warn(`  run ${r.name} failed (exit ${e.code}):\n${out}`); }
  writeFileSync(join(D, `out-${r.name}.txt`), out); console.log(`  ${r.name}: ${out.trim().split('\n').length} lines → out-${r.name}.txt`);
}
api.close();
console.log(`API calls: ${api.calls.join(', ') || 'none'}; unmocked: ${api.misses.length ? api.misses.join(', ') : 0}`);
await renderRuns(runs);
process.exit(api.misses.length || failed ? 1 : 0);
