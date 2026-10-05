#!/usr/bin/env node
// bin/transform.mjs — mirror canonical `product-film/` to the three distribution channels (npm skills, Hermes, Pi).
//
// The mirrors are byte-identical copies of canonical: product-film has no per-host placeholders. File modes are
// preserved; files present in a mirror but absent from canonical are deleted in write mode and reported in --check.
//
// Usage:
//   node bin/transform.mjs                        # write the mirrors
//   node bin/transform.mjs --check                # CI gate: exit 1 on drift
//   node bin/transform.mjs --output-root <path>   # write the mirrors under another root

import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { join, dirname, relative, resolve, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

// Frontmatter fields canonical SKILL.md must carry, exactly.
const EXPECTED_FRONTMATTER_FIELDS = ['name', 'version', 'license', 'user-invocable', 'argument-hint', 'allowed-tools', 'description'];

const MIRRORS = [
  { path: 'skills/product-film', displayName: 'npm skills' },
  { path: 'hermes/design/product-film', displayName: 'Hermes' },
  { path: 'pi/agent/skills/product-film', displayName: 'Pi' },
];

const IGNORED = new Set(['.DS_Store']);

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CANONICAL = join(ROOT, 'product-film');

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

function listFiles(dir) {
  const files = new Set();
  if (existsSync(dir)) for (const f of walk(dir)) files.add(relative(dir, f));
  return files;
}

function frontmatterFields(content, label) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`${label} is missing YAML frontmatter`);
  return match[1].split(/\r?\n/).map((line) => line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):/)?.[1]).filter(Boolean);
}

function assertFrontmatter(content, label) {
  const actual = new Set(frontmatterFields(content, label));
  const missing = EXPECTED_FRONTMATTER_FIELDS.filter((f) => !actual.has(f));
  const extras = [...actual].filter((f) => !EXPECTED_FRONTMATTER_FIELDS.includes(f));
  if (missing.length || extras.length) {
    const parts = [missing.length && `missing: ${missing.join(', ')}`, extras.length && `extras: ${extras.join(', ')}`].filter(Boolean);
    throw new Error(`${label} frontmatter field-set drift — ${parts.join('; ')}`);
  }
}

function syncMirror({ path: mirrorPath, displayName }, outputRoot, checkMode) {
  const mirrorDir = join(outputRoot, mirrorPath);
  const canonicalFiles = listFiles(CANONICAL);
  let drift = 0;
  let written = 0;

  for (const rel of canonicalFiles) {
    const src = join(CANONICAL, rel);
    const dst = join(mirrorDir, rel);
    const mode = statSync(src).mode & 0o777;
    const bytes = readFileSync(src);
    if (checkMode) {
      if (!existsSync(dst)) { console.error(`missing in ${mirrorPath}: ${rel}`); drift++; continue; }
      if (!readFileSync(dst).equals(bytes)) { console.error(`drift in ${mirrorPath}: ${rel}`); drift++; }
      else if ((statSync(dst).mode & 0o777) !== mode) { console.error(`mode drift in ${mirrorPath}: ${rel}`); drift++; }
    } else {
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, bytes);
      chmodSync(dst, mode);
      written++;
    }
  }

  for (const rel of listFiles(mirrorDir)) {
    if (canonicalFiles.has(rel)) continue;
    if (checkMode) { console.error(`stale in ${mirrorPath}: ${rel}`); drift++; }
    else rmSync(join(mirrorDir, rel), { force: true });
  }

  return { displayName, mirrorPath, written, drift };
}

function parseArgs(argv) {
  const args = { checkMode: false, outputRoot: ROOT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') args.checkMode = true;
    else if (argv[i] === '--output-root') {
      if (!argv[i + 1]) throw new Error('--output-root requires a path argument');
      args.outputRoot = resolve(argv[++i]);
    } else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  const rel = relative(CANONICAL, args.outputRoot);
  if (!(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))) {
    throw new Error(`--output-root must not point inside canonical (${CANONICAL}); got ${args.outputRoot}`);
  }
  return args;
}

function main() {
  const { checkMode, outputRoot } = parseArgs(process.argv.slice(2));
  assertFrontmatter(readFileSync(join(CANONICAL, 'SKILL.md'), 'utf8'), 'product-film/SKILL.md');

  let totalWritten = 0;
  let totalDrift = 0;
  for (const mirror of MIRRORS) {
    const result = syncMirror(mirror, outputRoot, checkMode);
    totalWritten += result.written;
    totalDrift += result.drift;
    if (!checkMode) console.log(`✓ ${result.displayName}: ${result.written} files → ${result.mirrorPath}/`);
  }

  if (checkMode) {
    if (totalDrift) {
      console.error('\nMirror drift detected. Run `bin/sync-mounts.sh` (no --check) to regenerate.');
      process.exit(1);
    }
    console.log(`OK · ${MIRRORS.length} mirrors match canonical`);
  } else {
    console.log(`Wrote ${totalWritten} files across ${MIRRORS.length} mirrors`);
  }
}

try {
  main();
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(1);
}
