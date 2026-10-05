// Fixture API for the CLI harness: answers the CLI's calls from ../story.json, so the real CLI prints its own output
// with fictional data and nothing reaches a real server. EXAMPLE routes for the example CLI (tidewell.mjs); replace
// them with the calls your CLI makes (read its source or run it with this server and read api.log).
//   node <film>/capture/cli/fixture-api.mjs [port 9898]       standalone; capture.mjs starts it for you
// Every request is logged to api.log. An unanswered call returns 404 "not_mocked" and is listed as unmocked.
import http from 'node:http';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const story = JSON.parse(readFileSync(new URL('../story.json', import.meta.url), 'utf8'));
const LOG = fileURLToPath(new URL('./api.log', import.meta.url));
const page = (version) => ({ id: story.page.id, url: story.page.url, title: story.page.title, version, org: story.org.name });

// 'METHOD /path/:param' → (req, state, params) → [status, json]
export const ROUTES = {
  'POST /v1/pages': (req, st) => { st.version = 1; return [201, page(1)]; },
  'PUT /v1/pages/:id': (req, st, p) => (p.id === story.page.id ? [200, page(++st.version)] : [404, { error: 'not_found' }]),
};

export function startFixtureApi(port = 0) {
  const state = { version: 0 }; const misses = []; const calls = [];
  const routes = Object.entries(ROUTES).map(([k, fn]) => { const [m, path] = k.split(' '); const names = []; const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; })}$`); return { m, re, names, fn }; });
  const srv = http.createServer((req, res) => {
    const body = []; req.on('data', (c) => body.push(c)); req.on('end', () => {
      const url = new URL(req.url, 'http://x'); const call = `${req.method} ${url.pathname}`; calls.push(call);
      appendFileSync(LOG, `${new Date().toISOString()} ${call} bytes=${Buffer.concat(body).length} auth=${req.headers.authorization ? 'yes' : 'no'}\n`);
      const json = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      for (const r of routes) {
        const m = r.m === req.method && url.pathname.match(r.re); if (!m) {continue;}
        const [s, o] = r.fn({ method: req.method, url, headers: req.headers, body: Buffer.concat(body) }, state, Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])));
        return json(s, o);
      }
      misses.push(call); json(404, { error: 'not_mocked', message: `${call} is not answered by fixture-api.mjs` });
    });
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}`, misses, calls, close: () => srv.close() })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const api = await startFixtureApi(+(process.argv[2] || 9898)); console.log(`fixture API on ${api.url} (log: ${LOG})`);
}
