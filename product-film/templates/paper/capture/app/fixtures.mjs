// Fixture API for the app harness: every browser call to the app's API is answered here, so no database or backend
// runs and nothing reaches a real server. EXAMPLE answers for the example app (Tidewell); replace them with your
// product's. All people and values come from ../story.json.
//
// For your product: read the screen's components and note every API call it makes (method, path, body, headers such as
// ETag and If-Match) and its loading and error strings. Answer each call as your real API would: the same status, JSON
// shape and headers (an ETag on reads, 412 on a stale If-Match). capture.mjs lists every call per scene in
// last-run.json; "unmocked" must be empty. When a scene renders an error, read the API route in your code and fix the
// answer here; never let a call through to a real server.
//
// answer(req, tools, state) → { status?, json? | body?, contentType?, headers? } or null (unmocked).
//   req: { method, path, query, headers, body, json() }   tools: { hold(name), mark(name, value), events }
//   hold(name) waits on the scene's gate of that name, to capture an in-flight state ("Saving…", "Verifying…").
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export const story = JSON.parse(readFileSync(here('../story.json'), 'utf8'));
const A = story.artifact; const STEM = A.file.replace(/\.[^.]+$/, '');
// The built versions (capture/artifact/build.py): the app shows these exact bytes.
const source = Object.fromEntries(A.versions.map((v) => [v.v, readFileSync(here(`../artifact/${STEM}.v${v.v}.html`), 'utf8')]));
const AT = Object.fromEntries(A.versions.map((v) => [v.v, v.at]));
const PAGE = story.page.id;

// Per-scene mutable state; it moves as the real UI saves, exactly as the API would answer.
// persona: 'owner' (signed in), 'none' (signed out), 'client' (after the one-time code)
export function makeState({ persona = 'owner', version = 1, shared = [] } = {}) {
  return { persona, version, shared: [...shared] };
}

const person = (p, role) => ({ name: p.name, email: p.email, role });
const people = (state) => [
  person(story.owner, 'Owner'), ...story.teammates.map((t) => person(t, 'Can view')),
  ...state.shared.map((e) => (e === story.client.email ? person(story.client, 'Client') : { name: e, email: e, role: 'Can view' })),
];

export async function answer(req, { hold, mark }, state) {
  const { method, path } = req;
  const signedOut = state.persona === 'none';
  if (path === '/api/session') {
    if (signedOut) {return { status: 401, json: { error: 'signed_out' } };}
    const u = state.persona === 'client' ? story.client : story.owner;
    return { json: { user: { id: u.id, name: u.name, email: u.email }, org: story.org.name, role: state.persona } };
  }
  if (signedOut && path.startsWith('/api/pages/')) {return { status: 401, json: { error: 'signed_out' } };}
  if (path === `/api/pages/${PAGE}` && method === 'GET') {
    return { json: { id: PAGE, title: story.page.title, org: story.org.name, url: story.page.url, version: state.version, updatedAt: AT[state.version], updatedBy: story.owner.name, people: people(state), canShare: state.persona === 'owner' } };
  }
  if (path === `/api/pages/${PAGE}/content` && method === 'GET') {
    const v = Number(req.query.get('v') || state.version); if (!source[v]) {return { status: 404, json: { error: 'no_such_version' } };}
    return { contentType: 'text/html; charset=utf-8', headers: { etag: `"v${v}"` }, body: source[v] };
  }
  if (path === `/api/pages/${PAGE}/people` && method === 'GET') {return { json: { people: people(state) } };}
  if (path === `/api/pages/${PAGE}/share` && method === 'POST') {
    const body = req.json(); mark('shareBody', body); await hold('share');
    for (const e of body.emails || []) {if (!state.shared.includes(e)) {state.shared.push(e);}}
    return { json: { people: people(state) } };
  }
  if (path === '/api/auth/send-code' && method === 'POST') { mark('sendCodeBody', req.json()); await hold('sendCode'); return { json: { ok: true } }; }
  if (path === '/api/auth/verify' && method === 'POST') {
    const body = req.json(); mark('verifyBody', body); await hold('verify');
    if (body.code !== story.otp) {return { status: 400, json: { error: 'wrong_code' } };}
    state.persona = 'client'; return { json: { ok: true } };
  }
  return null;
}
