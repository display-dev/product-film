// App harness: your app on its own dev server, every API call answered by ./fixtures.mjs (no backend, no database,
// nothing reaches a real server). Output: ../shots/*.png, ../shots/manifest-app.json (merged by file) and
// ./last-run.json (the API calls of each scene; "unmocked" and "blocked" must both be empty).
//   node <film>/capture/app/capture.mjs                 all scenes
//   node <film>/capture/app/capture.mjs share signin    a subset (replaces only its own manifest entries)
//   … --dom                                             also save a DOM snapshot of each shot in ../shots/dom/
// With story.json app.baseUrl null it serves the EXAMPLE app (./example-app/) on a local port, so it runs as shipped.
// For your product:
//  1. Start your dev server (and stop it when you finish). Point the server's own server-side API URL, if it has one,
//     at a port nothing listens on: server-side fetches never pass through the browser, so a missed one must fail
//     loudly instead of reaching a real backend.
//  2. In story.json app: baseUrl (your dev server), hostMap (hostnames to resolve to 127.0.0.1, if the app needs a
//     real-looking host), apiPrefixes (where the browser sends API calls), allowHosts (other hosts that may load,
//     such as a font CDN), blockHosts (analytics and support widgets), returningUser (the localStorage keys that hide
//     one-time notices for a returning browser: grep your code for localStorage; they are often versioned).
//  3. Answer every call in fixtures.mjs. Replace the EXAMPLE scenes at the bottom with your own on the same pattern.
// Before a new scene, read the screen's components: its test IDs, its API calls, its exact strings. Take strings from
// the code, never from memory.
import { createRequire } from 'node:module';
import http from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILM, SHOTS, INIT_SCRIPT, assertCleanText, captureWhile, clickCenter, contextOptions, gate, hygiene, inkBoxes, manifest, measure, parkMouse, routeApi, settle, snapshot, typeSlow } from '../lib.mjs';
import { answer, makeState, story } from './fixtures.mjs';
const { chromium } = createRequire(import.meta.url)('../../pw.cjs');
const HERE = dirname(fileURLToPath(import.meta.url));

const APP = story.app || {};
const args = process.argv.slice(2); const DOM = args.includes('--dom'); const want = new Set(args.filter((a) => !a.startsWith('--')));
const TID = APP.testIdAttribute || 'data-testid';
const sel = (id) => `[${TID}="${id}"]`;
const tid = (page, id) => page.locator(sel(id));

// The example app: static files with an index.html fallback for any path; /fonts/ comes from the film's kit/fonts.
function serveExampleApp() {
  const ROOT = join(HERE, 'example-app'), FONTS = join(FILM, 'kit', 'fonts');
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  return new Promise((ok) => {
    const srv = http.createServer(async (req, res) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = p.startsWith('/fonts/') ? join(FONTS, basename(p)) : join(ROOT, normalize(p));
      if (!file.startsWith(ROOT + sep) && !file.startsWith(FONTS + sep) && file !== ROOT) { res.writeHead(403); return res.end(); }
      try { if (!(await stat(file)).isFile()) {throw new Error('dir');} } catch { file = join(ROOT, 'index.html'); }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(await readFile(file));
    });
    srv.listen(0, '127.0.0.1', () => ok({ port: srv.address().port, close: () => srv.close() }));
  });
}
const server = APP.baseUrl ? null : await serveExampleApp();
const HOSTMAP = APP.hostMap || {};
const BASE = APP.baseUrl || `http://${Object.keys(HOSTMAP)[0] || '127.0.0.1'}:${server.port}`;
const appHosts = [new URL(BASE).hostname, ...Object.keys(HOSTMAP)];
const API = (APP.apiPrefixes || ['/api/']).map((p) => new URL(p, BASE).href);
const isApi = (url) => API.some((p) => url.href.startsWith(p));
const rules = Object.entries(HOSTMAP).map(([h, ip]) => `MAP ${h} ${ip}`).join(', ');
const browser = await chromium.launch(rules ? { args: [`--host-resolver-rules=${rules}`] } : {});
const man = manifest('app'); const report = {};

// A scene = one browser context: fixtures installed, carets hidden, shadow roots forced open, returning-user storage
// set, the story clock installed (Date.now() reads like the story; fastForward() fires polls instead of waiting).
async function newScene({ kind = 'desktop', viewport, state = makeState(), gates = {}, returning = true, clock = story.clock } = {}) {
  const opts = contextOptions(kind, viewport ? { viewport } : {}); const context = await browser.newContext(opts);
  await context.addInitScript(INIT_SCRIPT);
  if (returning && APP.returningUser) {await context.addInitScript((e) => { try { for (const [k, v] of Object.entries(e)) {localStorage.setItem(k, v);} } catch { /* no storage in this frame */ } }, APP.returningUser);}
  const fx = await routeApi(context, { isApi, answer: (req, tools) => answer(req, tools, state), appHosts, allowHosts: APP.allowHosts || [], blockHosts: APP.blockHosts || [], gates });
  const page = await context.newPage();
  if (clock) {await page.clock.install({ time: new Date(clock) });}
  page.on('pageerror', (e) => console.warn('  pageerror:', e.message.slice(0, 200)));
  const cdp = await context.newCDPSession(page);
  return { context, page, cdp, fx, state, vp: opts.viewport, dsf: opts.deviceScaleFactor, leaks: [] };
}

// Boxes for a spec (see lib.mjs measure()); `_frames: { '<iframe selector>': { name: spec } }` measures inside iframes.
async function measureSpec(scene, spec) {
  const { _frames = {}, ...main } = spec; const out = await measure(scene.page.mainFrame(), main);
  for (const [s, sub] of Object.entries(_frames)) {
    const f = await (await scene.page.locator(s).elementHandle())?.contentFrame();
    if (!f) { console.warn(`  frame ${s} not found`); continue; }
    const r = await measure(f, sub); Object.assign(out.boxes, r.boxes); Object.assign(out.inkRegions, r.inkRegions);
  }
  return out;
}
function record(scene, file, state, boxes, extra) {
  man.put({ file, url: scene.page.url(), viewport: [scene.vp.width, scene.vp.height], dsf: scene.dsf, state, boxes, ...(extra ? { extra } : {}) });
  console.log(`  ✓ ${file}  (${Object.values(boxes).filter(Boolean).length} boxes)`);
}
// One state: hygiene CSS, a leak check of the visible text, boxes measured from the live DOM, the screenshot, ink boxes
// from its pixels, the manifest entry and, with --dom, a DOM snapshot. spec may be a function (measured late).
async function shot(scene, file, state, spec = {}, extra) {
  const { page } = scene;
  await hygiene(scene.cdp, APP.hygieneCss || '');
  const leaks = await assertCleanText(page, APP.leaks || []); if (leaks.length) {scene.leaks.push(`${file}: ${leaks.join(', ')}`);}
  const { boxes, inkRegions } = await measureSpec(scene, typeof spec === 'function' ? await spec() : spec);
  const png = await page.screenshot({ path: join(SHOTS, file) });
  Object.assign(boxes, await inkBoxes(browser, png, scene.dsf, inkRegions));
  record(scene, file, state, boxes, extra);
  if (DOM) { const s = await snapshot(page, join(SHOTS, 'dom', file.replace(/\.png$/, '.html'))); if (s.warnings.length) {console.warn('  snapshot:', s.warnings.join('; '));} }
  return boxes;
}
async function closeScene(scene, name) {
  report[name] = { apiCalls: [...new Set(scene.fx.calls)], unmocked: scene.fx.misses, blocked: scene.fx.blocked, leaks: scene.leaks, events: scene.fx.events };
  await scene.context.close();
}
async function run(name, fn) {
  if (want.size && !want.has(name)) {return;}
  console.log(name); try { await fn(); } catch (e) { report[name] = { ...(report[name] || {}), error: e.message.split('\n')[0] }; console.error(`  FAILED ${name}: ${e.message.split('\n')[0]}`); }
}

// ── EXAMPLE scenes (the example app). Replace them with your product's; keep the patterns. ───────────────────────────
const PAGE = story.page.id, CLIENT = story.client.email, OTP = story.otp;
const FRAME = sel('page-frame');
const pageBoxes = { headline: 'box:main h1', headlineInk: 'ink:main h1', kickoff: 'box:.kickoff', kickoffDate: 'box:.kickoff b', kickoffDateInk: 'ink:.kickoff b', kickoffDatePix: 'pixink:.kickoff b', plan: 'box:.plan' };
const header = { title: `box:${sel('page-title')}`, version: `box:${sel('version')}`, updated: `box:${sel('updated')}`, shareButton: `box:${sel('share-open')}`, frame: `box:${FRAME}` };
const openPage = async (scene, hash = '') => {
  await scene.page.goto(`${BASE}/p/${PAGE}${hash}`);
  if (!hash) { await scene.page.waitForFunction((s) => document.querySelector(s)?.contentDocument?.querySelector('h1'), FRAME); }
  await settle(scene.page, 600); await parkMouse(scene.page);
};

// 1. The share dialog: type the client's address in three steps, tick the email option, Save → Saving… → Saved.
await run('share', async () => {
  const share = gate();
  const sc = await newScene({ state: makeState({ persona: 'owner', version: 1 }), gates: { share } }); const { page } = sc;
  await openPage(sc);
  await shot(sc, 'page-v1.png', `The owner's view of v1: header (title, v1, "Updated … by ${story.owner.name}"), Share button, the page.`, { ...header, _frames: { [FRAME]: pageBoxes } });
  await clickCenter(page, tid(page, 'share-open')); await tid(page, 'share-dialog').waitFor(); await settle(page, 300); await parkMouse(page);
  const dialog = { dialog: `box:${sel('share-dialog')}`, list: `box:${sel('share-list')}`, emailInput: `box:${sel('share-email')}`, typedText: `input:${sel('share-email')}`, notify: `box:${sel('share-notify')}`, saveButton: `box:${sel('share-save')}` };
  await shot(sc, 'share-1.png', 'Share dialog open: three people, an empty email field, Save disabled.', dialog);
  await clickCenter(page, tid(page, 'share-email'));
  let typed = '';
  for (const [chunk, tag] of [['jor', 'a'], ['dan@exa', 'b'], [CLIENT.slice(10), 'c']]) {
    await typeSlow(page, chunk); typed += chunk; await settle(page, 200);
    await shot(sc, `share-2${tag}.png`, `Typing the client's address: "${typed}".`, dialog);
  }
  await clickCenter(page, tid(page, 'share-notify')); await parkMouse(page); await settle(page, 150);
  await shot(sc, 'share-3.png', 'Email option ticked; Save enabled.', dialog);
  await clickCenter(page, tid(page, 'share-save')); await page.getByText('Saving…').waitFor(); await settle(page, 150);
  await shot(sc, 'share-4-saving.png', 'Save pressed: the request is held open, the button reads "Saving…".', dialog, { request: sc.fx.events.shareBody });
  share.open(); await tid(page, 'share-save').filter({ hasText: 'Saved' }).waitFor(); await parkMouse(page); await settle(page, 200);
  await shot(sc, 'share-5-saved.png', `Saved: ${story.client.name} is in the list as "Client"; the list scrolled to show the new row.`, dialog);
  await closeScene(sc, 'share');
});

// 2. A new version while the tab is open: the 30 s poll shows "Refresh"; one click loads v2 at the same URL.
await run('page', async () => {
  const sc = await newScene({ state: makeState({ persona: 'owner', version: 1 }) }); const { page } = sc;
  await openPage(sc);
  sc.state.version = 2;                                   // the agent publishes v2 while this tab is open
  await page.clock.fastForward('00:31');                  // fire the poll now instead of waiting 30 s
  await tid(page, 'refresh').waitFor(); await settle(page, 300);
  await shot(sc, 'page-v1-refresh.png', 'v1 is still on screen; the bar under the header offers v2 with a Refresh button.', { ...header, newVersion: `box:${sel('new-version')}`, refreshButton: `box:${sel('refresh')}`, _frames: { [FRAME]: pageBoxes } });
  await clickCenter(page, tid(page, 'refresh'));
  await page.waitForFunction((s) => document.querySelector(s)?.contentDocument?.body?.textContent.includes('May 6'), FRAME);
  await parkMouse(page); await settle(page, 400);
  await shot(sc, 'page-v2.png', 'v2 at the same URL: the kickoff reads May 6; the header reads v2.', { ...header, _frames: { [FRAME]: pageBoxes } });
  await closeScene(sc, 'page');
});

// 3. The client on a phone: invited sign-in → Send code → six digits (the sixth submits the form) → Verified →
//    "Opening page…" (about 120 ms, taken over raw CDP) → the page.
await run('signin', async () => {
  const sendCode = gate(), verify = gate();
  const sc = await newScene({ kind: 'phone', state: makeState({ persona: 'none' }), gates: { sendCode, verify } }); const { page, cdp } = sc;
  await openPage(sc, `#invited=${encodeURIComponent(CLIENT)}`); await tid(page, 'signin-card').waitFor(); await settle(page, 300);
  const card = { card: `box:${sel('signin-card')}`, title: `box:${sel('signin-card')} h1`, email: `words:${sel('signin-card')}|${CLIENT}`, sendCode: `box:${sel('send-code')}` };
  await shot(sc, 'phone-signin.png', `Invited sign-in: one button, "Send code to ${CLIENT}"; no third-party sign-in buttons.`, card);
  await tid(page, 'send-code').tap(); await page.getByText('Sending…').waitFor(); await settle(page, 150);
  await shot(sc, 'phone-signin-sending.png', 'Send code tapped: "Sending…" while the request is held open.', card, { request: sc.fx.events.sendCodeBody });
  sendCode.open(); await tid(page, 'otp-1').waitFor(); await settle(page, 400);
  const otp = { card: `box:${sel('signin-card')}`, otp: `box:${sel('otp')}`, verifyButton: `box:${sel('verify')}`, ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [`otp${i}`, `box:${sel(`otp-${i}`)}`])) };
  await shot(sc, 'phone-otp-0.png', 'Check your email: six empty slots, Verify disabled.', otp);
  await typeSlow(page, OTP.slice(0, 5), 110); await settle(page, 300);
  await shot(sc, 'phone-otp-5.png', `Five digits entered (${OTP.slice(0, 5)}_).`, otp);
  await page.keyboard.type(OTP[5]); await page.getByText('Verifying…').waitFor(); await settle(page, 200);
  await shot(sc, 'phone-otp-6.png', `All six digits (${OTP}): the sixth submitted the form, the button reads "Verifying…". This is the last frame with all six digits.`, otp, { request: sc.fx.events.verifyBody });
  // Verified shows for 900 ms: pause the page clock so its timer cannot fire mid-shot (a paused clock also pauses rAF).
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 50));
  verify.open(); await tid(page, 'verified').waitFor(); await settle(page, 200, { raf: false });
  const doneBoxes = await shot(sc, 'phone-verified.png', 'Code accepted: the check mark and "Verified".', { card: `box:${sel('signin-card')}`, check: `box:${sel('verified')}` });
  const flashing = captureWhile(cdp, `document.querySelector('${sel('done-text')}')?.textContent.includes('Opening page')`, { viewport: [sc.vp.width, sc.vp.height], dsf: sc.dsf });
  await page.clock.resume(); const flash = await flashing;
  report.signinOpeningCaptured = Boolean(flash?.still);
  if (flash?.still) { writeFileSync(join(SHOTS, 'phone-opening.png'), flash.png); record(sc, 'phone-opening.png', '"Opening page…" (shows for about 120 ms), taken over raw CDP while the text was on screen.', doneBoxes, { capturedVia: 'CDP Page.captureScreenshot' }); }
  else {console.warn('  ! "Opening page…" was gone before a frame could be taken; run `signin` again, or cut from Verified to the page.');}
  await page.waitForFunction((s) => document.querySelector(s)?.contentDocument?.querySelector('h1'), FRAME); await settle(page, 600);
  await shot(sc, 'phone-page-v1.png', `${story.client.name}'s view of v1 on the phone: no Share button.`, { title: `box:${sel('page-title')}`, version: `box:${sel('version')}`, frame: `box:${FRAME}`, _frames: { [FRAME]: pageBoxes } });
  await closeScene(sc, 'signin');
});

// ── report ──
const reportPath = join(HERE, 'last-run.json');
const previous = existsSync(reportPath) && want.size ? JSON.parse(readFileSync(reportPath, 'utf8')) : {};
const all = { ...previous, ...report }; writeFileSync(reportPath, `${JSON.stringify(all, null, 2)}\n`);
await browser.close(); server?.close();
const count = (k) => Object.values(all).reduce((n, s) => n + (Array.isArray(s?.[k]) ? s[k].length : 0), 0);
const failed = Object.values(all).filter((s) => s?.error).length;
console.log(`manifest ${man.path}\nreport ${reportPath}: unmocked ${count('unmocked')}, blocked ${count('blocked')}, leak warnings ${count('leaks')}, failed scenes ${failed}`);
process.exit(count('unmocked') || count('blocked') || failed ? 1 : 0);
