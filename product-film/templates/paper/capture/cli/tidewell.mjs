#!/usr/bin/env node
// tidewell – a tiny FICTIONAL CLI that stands in for your product's real CLI, so the CLI harness runs as shipped.
//   tidewell publish <file> [--page <id>]       reads TIDEWELL_API_URL and TIDEWELL_API_KEY
// Point the harness at your real CLI instead (story.json cli.runs[].run): never film a replica of a CLI.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
const [cmd, file, ...rest] = process.argv.slice(2); const page = rest[rest.indexOf('--page') + 1];
const API = process.env.TIDEWELL_API_URL || 'https://api.tidewell.example'; const KEY = process.env.TIDEWELL_API_KEY;
const c = process.stdout.isTTY || process.env.FORCE_COLOR ? { ok: '\x1b[38;2;14;138;126m', dim: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' } : { ok: '', dim: '', b: '', x: '' };
if (cmd !== 'publish' || !file) { console.error('usage: tidewell publish <file> [--page <id>]'); process.exit(2); }
if (!KEY) { console.error('error: set TIDEWELL_API_KEY'); process.exit(2); }
const res = await fetch(`${API}/v1/pages${rest.includes('--page') ? `/${page}` : ''}`, {
  method: rest.includes('--page') ? 'PUT' : 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'text/html', 'x-file-name': basename(file) }, body: readFileSync(file),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`error: ${res.status} ${out.error || ''} ${out.message || ''}`.trim()); process.exit(1); }
console.log(`${c.ok}✓${c.x} Published ${c.b}${out.title}${c.x} ${c.dim}v${out.version}${c.x}`);
console.log(`  ${out.url}`);
console.log(`${c.dim}  ${out.version > 1 ? 'Same link; open tabs offer the new version.' : `Everyone at ${out.org} can open it.`}${c.x}`);
