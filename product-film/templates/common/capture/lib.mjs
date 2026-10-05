// capture/lib.mjs – shared capture helpers for every route. new-film.sh copies it into each film folder.
// Every product screen is the product's real code rendering fictional fixtures: never a hand-built replica, never a
// real person's data, never a real publish. What this file enforces where it can:
//  - desktop 1280×800 and phone 390×844, both at device scale 3 (the phone with isMobile and hasTouch): text stays
//    sharp when a film zooms to about 2.7× CSS size
//  - light scheme, en-US, UTC; the story clock is pinned by the harness (context.clock)
//  - no text caret, no dev overlay, no injected cursor: the film draws its own pointer
//  - boxes come from the live DOM just before each screenshot, in CSS px (measure())
//  - one manifest per harness (shots/manifest-<name>.json), entries merged by file, so a partial run keeps the rest
//  - every API call is answered by fixtures (routeApi()); an unanswered call or an unexpected host is reported
// Playwright is not imported here: harnesses pass in their own page, context, CDP session and browser.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CAPTURE = dirname(fileURLToPath(import.meta.url));   // fileURLToPath, not .pathname: paths may contain spaces
export const FILM = dirname(CAPTURE);
export const SHOTS = join(CAPTURE, 'shots');

// capture/story.json: the single source of fictional facts (people, org, artifact, fixtures). {} when absent.
export function loadStory(file = join(CAPTURE, 'story.json')) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
export const KINDS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 3, userAgent: CHROME_UA },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: PHONE_UA },
};
// A popup at its real size: contextOptions('desktop', { viewport: { width: 420, height: 480 } }).
// Service workers are blocked so every request passes through the context's routes.
export const contextOptions = (kind = 'desktop', extra = {}) => ({
  ...KINDS[kind], colorScheme: 'light', locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'no-preference', serviceWorkers: 'block', ...extra,
});

// Add with context.addInitScript(INIT_SCRIPT) before the first navigation. It hides text carets everywhere (shadow
// roots included) and forces every shadow root open: Element.prototype.attachShadow is patched so mode 'closed'
// becomes 'open', which lets measure() and snapshot() reach controls inside closed components. Neither changes layout
// or paint. A declarative <template shadowrootmode="closed"> in server HTML does not call attachShadow and stays closed.
export const INIT_SCRIPT = `(() => {
  const sheet = new CSSStyleSheet(); sheet.replaceSync('*{caret-color:transparent!important}');
  const orig = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) { const root = orig.call(this, Object.assign({}, init, { mode: 'open' })); try { root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]; } catch (_) {} return root; };
  const add = () => { try { document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; } catch (_) {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();`;

// Clean-frame hygiene: hidden carets (native, CodeMirror's cursor layer) and framework dev overlays. Pages that observe
// their own DOM (editors, frameworks that re-render on mutation) must not get a <style> node, so hygiene() injects the
// CSS as a CDP inspector stylesheet into every frame. Pass the app's own fake carets and overlays as extraCss.
export const HYGIENE_CSS = `*{caret-color:transparent!important}
.cm-cursorLayer,.cm-cursor,.cm-dropCursor{display:none!important}
nextjs-portal,vite-error-overlay,#webpack-dev-server-client-overlay{display:none!important}`;
export async function hygiene(cdp, extraCss = '') {
  await cdp.send('DOM.enable').catch(() => {}); await cdp.send('CSS.enable').catch(() => {});
  const { frameTree } = await cdp.send('Page.getFrameTree'); const ids = [];
  (function walk(t) { ids.push(t.frame.id); (t.childFrames || []).forEach(walk); })(frameTree);
  for (const frameId of ids) {
    try { const { styleSheetId } = await cdp.send('CSS.createStyleSheet', { frameId }); await cdp.send('CSS.setStyleSheetText', { styleSheetId, text: `${HYGIENE_CSS}\n${extraCss}` }); } catch { /* detached frame */ }
  }
}

// Wait for fonts in every frame, then a fixed time. raf: also wait two animation frames (skip it while the page clock is
// paused: a paused clock also pauses requestAnimationFrame).
export async function settle(page, ms = 450, { raf = true } = {}) {
  for (const f of page.frames()) { try { await f.evaluate(() => document.fonts.ready.then(() => true)); } catch { /* detached */ } }
  await page.waitForTimeout(ms);
  if (raf) {await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {});}
}

// Park the real mouse in the bottom-left corner, off every control, so no hover state shows. The film draws its pointer.
export async function parkMouse(page) { const vp = page.viewportSize(); await page.mouse.move(4, (vp?.height || 800) - 4); }

// Trusted typing, one key at a time, so the app sees real key events and any per-key UI (suggestions, auto-advance).
export async function typeSlow(page, text, delay = 70) { for (const ch of text) { await page.keyboard.type(ch); await page.waitForTimeout(delay); } }

// A trusted click (or double-click) at a locator's centre, after a short pointer move: hover styles and
// pointer-driven handlers behave as for a person. Use test IDs: page.locator('[data-testid="share-save"]').
export async function clickCenter(page, locator, { dbl = false, steps = 4 } = {}) {
  const b = await locator.boundingBox(); if (!b) {throw new Error(`clickCenter: no box for ${locator}`);}
  const x = b.x + b.width / 2, y = b.y + b.height / 2; await page.mouse.move(x, y, { steps });
  if (dbl) {await page.mouse.dblclick(x, y);} else {await page.mouse.click(x, y);}
}

// In-page measuring helpers, installed in a frame by measure() (or page.addInitScript(MEASURE)).
// __box(sel) → [x,y,w,h]; __words(sel, word, n) → Range box of the n-th occurrence of word; __lines(sel) → one box per
// visual line; __ink(sel, word) → glyph ink box via canvas measureText in the element's own font (a Range box spans the
// whole line box, which for headline typefaces is much taller than the capitals: zoom and circle targets need ink boxes;
// it measures one line, so for a wrapped element use 'lines:' or 'pixink:');
// __inputText(sel) → box of a typed input value, which has no text node.
export const MEASURE = `(() => {
  if (window.__box) return;
  const r2 = (n) => Math.round(n * 10) / 10; const B = (r) => (r && r.width > 0 && r.height > 0 ? [r2(r.x), r2(r.y), r2(r.width), r2(r.height)] : null);
  const union = (rs) => { rs = [...rs].filter((r) => r.width > 0 && r.height > 0); if (!rs.length) return null; const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top)); return { x, y, width: Math.max(...rs.map((r) => r.right)) - x, height: Math.max(...rs.map((r) => r.bottom)) - y }; };
  const q = (sel) => (typeof sel === 'string' ? document.querySelector(sel) : sel);
  const find = (root, word, n = 0) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let seen = 0; for (let t = w.nextNode(); t; t = w.nextNode()) { let i = t.data.indexOf(word); while (i >= 0) { if (seen++ === n) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + word.length); return r; } i = t.data.indexOf(word, i + 1); } } return null; };
  const font = (cs) => cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
  window.__box = (sel) => { const e = q(sel); return e ? B(e.getBoundingClientRect()) : null; };
  window.__words = (sel, word, n = 0) => { const e = q(sel); const r = e && find(e, word, n); return r ? B(union(r.getClientRects())) : null; };
  window.__lines = (sel) => { const e = q(sel); if (!e) return []; const r = document.createRange(); r.selectNodeContents(e); const lines = [];
    for (const b of [...r.getClientRects()].filter((b) => b.width > 0 && b.height > 0).sort((a, b) => a.top - b.top)) { const c = (b.top + b.bottom) / 2; const L = lines.find((l) => c > l.top && c < l.bottom); if (L) L.rects.push(b); else lines.push({ top: b.top, bottom: b.bottom, rects: [b] }); }
    return lines.map((l) => B(union(l.rects))); };
  window.__ink = (sel, word) => { const e = q(sel); if (!e) return null; const r = word ? find(e, word) : (() => { const x = document.createRange(); x.selectNodeContents(e); return x; })(); if (!r) return null;
    const sc = r.startContainer; const host = sc.nodeType === 3 ? sc.parentElement : sc; const cs = getComputedStyle(host); const c = document.createElement('canvas').getContext('2d'); c.font = font(cs); if (cs.letterSpacing !== 'normal') c.letterSpacing = cs.letterSpacing;
    let text = r.toString(); if (cs.textTransform === 'uppercase') text = text.toUpperCase(); const rect = r.getClientRects()[0]; if (!rect) return null; const m = c.measureText(text); const base = rect.top + m.fontBoundingBoxAscent;
    return B({ x: rect.left - m.actualBoundingBoxLeft, y: base - m.actualBoundingBoxAscent, width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent }); };
  window.__inputText = (sel) => { const el = q(sel); if (!el || !el.value) return null; const cs = getComputedStyle(el); const c = document.createElement('canvas').getContext('2d'); c.font = font(cs); const b = el.getBoundingClientRect(); const lh = parseFloat(cs.fontSize) * 1.25; return B({ x: b.x + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth) - el.scrollLeft, y: b.y + (b.height - lh) / 2, width: c.measureText(el.value).width, height: lh }); };
})();`;

// Offset and scale of a frame's content box in main-viewport CSS px ({0,0,1} for the main frame).
export async function frameOffset(frame) {
  const el = await frame.frameElement().catch(() => null); if (!el) {return { x: 0, y: 0, s: 1 };}
  const bb = await el.boundingBox(); const m = await el.evaluate((e) => ({ cl: e.clientLeft, ct: e.clientTop, ow: e.offsetWidth }));
  const s = m.ow ? bb.width / m.ow : 1; const up = await frameOffset(frame.parentFrame());
  return { x: bb.x + m.cl * s, y: bb.y + m.ct * s, s: s * up.s };
}

// Measure named boxes in a frame (page.mainFrame() or an iframe's frame) in main-viewport CSS px. spec values:
//   'box:<sel>'  'words:<sel>|<word>[|n]'  'lines:<sel>'  'ink:<sel>[|<word>]'  'input:<sel>'  'pixink:<sel>[|<word>]'
// 'pixink' is the ink box measured from the screenshot (dark pixels inside the element or word box): use it when the
// canvas ink box is off (synthetic bold, icon fonts). measure() returns its region; inkBoxes() turns it into a box.
export async function measure(frame, spec = {}) {
  await frame.evaluate(MEASURE); const o = await frameOffset(frame); const boxes = {}, inkRegions = {};
  const shift = (b) => (b && typeof b[0] === 'number' ? [r2(o.x + b[0] * o.s), r2(o.y + b[1] * o.s), r2(b[2] * o.s), r2(b[3] * o.s)] : b);
  for (const [name, v] of Object.entries(spec)) {
    const i = v.indexOf(':'); const how = v.slice(0, i); const [sel, word, n] = v.slice(i + 1).split('|');
    const raw = await frame.evaluate(([h, s, w, k]) => {
      if (h === 'box') {return window.__box(s);} if (h === 'words') {return window.__words(s, w, +(k || 0));}
      if (h === 'lines') {return window.__lines(s);} if (h === 'ink') {return window.__ink(s, w);}
      if (h === 'input') {return window.__inputText(s);} if (h === 'pixink') {return w ? window.__words(s, w) : window.__box(s);}
      throw new Error(`measure: unknown kind ${h}`);
    }, [how, sel, word, n]);
    if (how === 'lines') {boxes[name] = (raw || []).map(shift);} else if (how === 'pixink') { if (raw) {inkRegions[name] = [shift(raw)];} } else {boxes[name] = shift(raw);}
  }
  return { boxes, inkRegions };
}
const r2 = (n) => Math.round(n * 10) / 10;

// Ink boxes from a screenshot: the tight bounds of dark pixels (max RGB channel < threshold) inside each region.
// regions: { name: [[x,y,w,h], …] } in CSS px; png: Buffer; dsf: the capture's device scale. → { name: [x,y,w,h] }
const decoders = new WeakMap();
export async function inkBoxes(browser, png, dsf, regions, { threshold = 96 } = {}) {
  if (!regions || !Object.keys(regions).length) {return {};}
  if (!decoders.has(browser)) {decoders.set(browser, await browser.newPage());}
  return decoders.get(browser).evaluate(async ({ b64, dsf, regions, threshold }) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height); const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0); const out = {};
    for (const [name, rects] of Object.entries(regions)) {
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      for (const [x, y, w, h] of rects.filter(Boolean)) {
        const X0 = Math.max(0, Math.floor(x * dsf)), Y0 = Math.max(0, Math.floor(y * dsf)), X1 = Math.min(bmp.width, Math.ceil((x + w) * dsf)), Y1 = Math.min(bmp.height, Math.ceil((y + h) * dsf));
        if (X1 <= X0 || Y1 <= Y0) {continue;} const W = X1 - X0, d = ctx.getImageData(X0, Y0, W, Y1 - Y0).data;
        for (let j = 0; j < Y1 - Y0; j++) {for (let i = 0; i < W; i++) { const k = (j * W + i) * 4; if (Math.max(d[k], d[k + 1], d[k + 2]) < threshold) { x0 = Math.min(x0, X0 + i); x1 = Math.max(x1, X0 + i); y0 = Math.min(y0, Y0 + j); y1 = Math.max(y1, Y0 + j); } }}
      }
      const r = (n) => Math.round(n * 100) / 100; out[name] = x1 < 0 ? null : [r(x0 / dsf), r(y0 / dsf), r((x1 + 1 - x0) / dsf), r((y1 + 1 - y0) / dsf)];
    }
    return out;
  }, { b64: png.toString('base64'), dsf, regions, threshold });
}

// Manifest with entries merged by file. entry: { file, url?, viewport:[w,h], dsf, state, boxes:{name:[x,y,w,h]}, extra? }
export function manifest(name) {
  mkdirSync(SHOTS, { recursive: true }); const path = join(SHOTS, `manifest-${name}.json`); const list = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  return { path, list, put(entry) { entry.boxes = Object.fromEntries(Object.entries(entry.boxes || {}).filter(([, v]) => v)); const i = list.findIndex((e) => e.file === entry.file); if (i >= 0) {list[i] = entry;} else {list.push(entry);} writeFileSync(path, `${JSON.stringify(list, null, 1)}\n`); } };
}

// Visible text that means a fixture leaked: placeholder users, error strings, unrendered values. Add the real names
// that must never show (story.json app.leaks) through `extra`. Checks every frame and every open shadow root.
export const LEAKS = ['Unknown user', 'Deleted user', 'undefined', 'NaN', '[object Object]', 'Something went wrong', 'Could not load', 'Try again', 'Failed to', 'Not found'];
export async function assertCleanText(page, extra = []) {
  let text = '';
  for (const f of page.frames()) {
    try { text += await f.evaluate(() => { const out = [document.body?.innerText || '']; const walk = (n) => { for (const e of n.querySelectorAll('*')) { if (e.shadowRoot) { out.push(e.shadowRoot.textContent); walk(e.shadowRoot); } } }; walk(document); return out.join(' '); }); } catch { /* detached */ }
  }
  const bad = [...LEAKS, ...extra].filter((w) => text.includes(w));
  if (bad.length) {console.warn(`  WARNING: visible text contains ${bad.join(', ')}`);} return bad;
}

// A promise with an external resolve. Hold a fixture response on it to capture an in-flight state ("Saving…",
// "Verifying…"), then call open() for the next state.
export function gate() { let open; const promise = new Promise((r) => { open = r; }); return { promise, open }; }

// Answer every API call from fixtures and keep everything else off the network.
//   isApi(url, request) → true for calls the fixtures answer
//   answer(req, tools) → { status?, json? | body?, contentType?, headers? } or null when unmocked. req: { method, url,
//     path, query, headers, body, buffer, json() }; tools: { hold(name), mark(name, value), events }
//   appHosts: hosts of the app itself (its dev server): continue. allowHosts: other hosts that may load (a font CDN).
//   blockHosts: hosts aborted quietly (analytics, support widgets). Any other host is aborted and reported as blocked.
//   gates: { name: gate() }: hold(name) waits on that gate.
// Cross-origin API calls get CORS headers for the requesting origin, and preflights are answered.
// Returns { calls, misses, blocked, events }: misses (unmocked calls) and blocked must both end empty.
const hostIn = (host, list) => list.some((h) => host === h || host.endsWith(`.${h}`) || (h.startsWith('*.') && host.endsWith(h.slice(1))));
export async function routeApi(context, { isApi, answer, appHosts = [], allowHosts = [], blockHosts = [], gates = {}, log = false }) {
  const calls = [], misses = [], blocked = [], events = {};
  const hold = async (name) => { if (gates[name]) {await (gates[name].promise || gates[name]);} };
  const mark = (name, value = true) => { events[name] = value; };
  await context.route('**/*', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    try {
      if (isApi(url, req)) {
        const origin = req.headers().origin;
        const cors = origin ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': req.headers()['access-control-request-headers'] || 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'ETag', vary: 'Origin' } : {};
        if (method === 'OPTIONS') {return await route.fulfill({ status: 204, headers: cors });}
        const call = `${method} ${url.pathname}${url.search}`; calls.push(call); if (log) {console.log('  API', call);}
        const r = await answer({ method, url, path: url.pathname, query: url.searchParams, headers: req.headers(), body: req.postData(), buffer: req.postDataBuffer(), json: () => JSON.parse(req.postData() || '{}') }, { hold, mark, events });
        if (!r) { misses.push(call); console.warn('  unmocked API call:', call); return await route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'not_mocked', message: `${call} is not answered by the fixtures` }) }); }
        const isJson = r.json !== undefined;
        return await route.fulfill({ status: r.status ?? 200, headers: { ...cors, ...(r.headers || {}) }, contentType: r.contentType ?? (isJson ? 'application/json' : 'text/plain; charset=utf-8'), body: isJson ? JSON.stringify(r.json) : (r.body ?? '') });
      }
      const host = url.hostname;
      if (hostIn(host, blockHosts)) {return await route.abort();}
      if (appHosts.includes(host) || hostIn(host, allowHosts)) {return await route.continue();}
      blocked.push(`${method} ${url.href}`); console.warn('  blocked request:', method, url.href);
      return await route.abort('blockedbyclient');
    } catch { /* the page closed while the request was held */ }
  });
  return { calls, misses, blocked, events };
}

// A state that lasts milliseconds ("Saved. Opening…"): poll over raw CDP and screenshot the moment `expression` (a JS
// expression evaluated in the page) is truthy, then confirm it still holds, so the frame shows that state.
// clip defaults to the whole viewport at the device scale (raw CDP captures at CSS scale without it).
// → { png: Buffer, still: boolean } or null when the state never showed within `timeout` ms.
export async function captureWhile(cdp, expression, { viewport, dsf = 3, timeout = 5000, every = 4 } = {}) {
  const ev = async (e) => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true })).result.value;
  const clip = viewport ? { x: 0, y: 0, width: viewport[0], height: viewport[1], scale: dsf } : undefined;
  for (const t0 = Date.now(); Date.now() - t0 < timeout;) {
    if (await ev(expression)) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) });
      return { png: Buffer.from(data, 'base64'), still: Boolean(await ev(expression)) };
    }
    await new Promise((r) => setTimeout(r, every));
  }
  return null;
}

// ── DOM snapshots (live-DOM films) ───────────────────────────────────────────────────────────────────────────────
// snapshot(page, file, opts) saves the page as one static HTML file that renders like the live page when opened:
//  - outerHTML with every stylesheet inlined as <style>: linked sheets (fetched, or read from the CSSOM), adopted
//    sheets (document and shadow roots), and CSSOM-only rules (insertRule into a <style>, as CodeMirror does) written
//    back as text
//  - open shadow roots serialized as <template shadowrootmode="open">. Closed roots are invisible to any script: add
//    INIT_SCRIPT to the context before the page loads, which forces every attachShadow() open
//  - state that lives in properties mirrored into attributes: checkbox and radio `checked`, input `value`, textarea
//    text, select `selected`, scroll offsets as data-snapshot-scroll="top,left" on the scrolled element
//  - scripts, inline event handlers, nonces and CSP meta tags removed; canvases replaced by <img> of their pixels
//  - iframes inlined as srcdoc, each serialized the same way
//  - opts.inlineAssets (default true): url() references in CSS and image sources fetched and inlined as data: URLs,
//    so the file needs no server; what cannot be fetched (no CORS) stays absolute and is listed in `warnings`
//  - opts.restoreScroll (default true): one tiny script applies data-snapshot-scroll on load. Films that mount the
//    snapshot in a hidden layer apply the offsets as translateY instead (a hidden scroller loses scrollTop).
// Not saved: :hover and :focus styles (pin the values inline), fonts added only through the FontFace API (load them
// in the page that mounts the snapshot), top-layer state of modal <dialog>s.
// → { file, bytes, shadowRoots, frames, warnings }
export async function snapshot(page, file, { inlineAssets = true, restoreScroll = true } = {}) {
  const res = await serializeFrameTree(page.mainFrame(), { inlineAssets, restoreScroll });
  mkdirSync(dirname(file), { recursive: true });
  const doc = `${res.doctype}<html${res.attrs} data-snapshot="static copy, scripts removed">${res.html}</html>\n`;
  writeFileSync(file, doc);
  return { file, bytes: Buffer.byteLength(doc), shadowRoots: res.shadowRoots, frames: res.frames, warnings: res.warnings };
}
const attrEsc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
async function serializeFrameTree(frame, opts) {
  const kids = [];
  for (const child of frame.childFrames()) {
    const el = await child.frameElement().catch(() => null); if (!el) {continue;}
    const i = kids.length; await el.evaluate((e, n) => e.setAttribute('data-snapshot-frame', String(n)), i); kids.push({ child, el, i });
  }
  let r;
  try { r = await frame.evaluate(serializeDocument, opts); } finally { for (const k of kids) {await k.el.evaluate((e) => e.removeAttribute('data-snapshot-frame')).catch(() => {});} }
  let html = r.html; const warnings = [...r.warnings]; let shadowRoots = r.shadowRoots, frames = 0;
  for (const { child, i } of kids) {
    let sub;
    try { sub = await serializeFrameTree(child, opts); } catch (e) { warnings.push(`frame ${i} not serialized: ${e.message.split('\n')[0]}`); continue; }
    frames += 1 + sub.frames; shadowRoots += sub.shadowRoots; warnings.push(...sub.warnings.map((w) => `frame ${i}: ${w}`));
    const srcdoc = attrEsc(`${sub.doctype}<html${sub.attrs}>${sub.html}</html>`);
    html = html.replace(new RegExp(`<iframe\\b([^>]*?)\\sdata-snapshot-frame="${i}"([^>]*)>`), (_m, a, b) => `<iframe${`${a}${b}`.replace(/\s(?:srcdoc|src)="[^"]*"/g, '')} srcdoc="${srcdoc}">`);
  }
  return { ...r, html, warnings, shadowRoots, frames };
}
// Runs inside the page (Playwright serializes it): every change it makes for the serializer is undone before it returns.
async function serializeDocument({ inlineAssets, restoreScroll }) {
  const warnings = []; const undo = [];
  const cssText = (sheet) => { try { return [...sheet.cssRules].map((x) => x.cssText).join('\n'); } catch { return null; } };
  const roots = []; const walk = (n) => { for (const el of n.querySelectorAll('*')) { if (el.shadowRoot) { roots.push(el.shadowRoot); walk(el.shadowRoot); } } }; walk(document);
  const scopes = [document, ...roots];
  const all = (sel) => scopes.flatMap((s) => [...s.querySelectorAll(sel)]);
  const setAttr = (el, name, value) => { const prev = el.getAttribute(name); undo.push(() => (prev === null ? el.removeAttribute(name) : el.setAttribute(name, prev))); if (value === null) {el.removeAttribute(name);} else {el.setAttribute(name, value);} };
  const setText = (el, text) => { const prev = el.textContent; undo.push(() => { el.textContent = prev; }); el.textContent = text; };
  const swap = (oldNode, newNode) => { oldNode.replaceWith(newNode); undo.push(() => newNode.replaceWith(oldNode)); };
  const detach = (node) => { const p = node.parentNode, next = node.nextSibling; node.remove(); undo.push(() => p.insertBefore(node, next)); };
  const add = (parent, node) => { parent.append(node); undo.push(() => node.remove()); };
  const absUrls = (text, base) => text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => { if (/^(data:|#|blob:)/.test(u)) {return m;} try { return `url("${new URL(u, base).href}")`; } catch { return m; } });
  try {
    // 1. CSSOM-only rules: a <style> whose live sheet differs from what its text parses to
    for (const st of all('style')) {
      if (!st.sheet) {continue;} const live = cssText(st.sheet); if (live === null) {continue;}
      let n = -1; try { const p = new CSSStyleSheet(); p.replaceSync(st.textContent); n = p.cssRules.length; } catch { /* @import or invalid: keep the text */ }
      if (n !== -1 && n !== st.sheet.cssRules.length) {setText(st, live);}
    }
    // 2. linked stylesheets → <style>, with url()s made absolute against the sheet
    for (const link of all('link[rel~="stylesheet"]')) {
      if (link.disabled) { detach(link); continue; }
      let text = null;
      try { const res = await fetch(link.href, { cache: 'force-cache' }); if (res.ok) {text = await res.text();} } catch { /* no CORS */ }
      if (text === null && link.sheet) {text = cssText(link.sheet);}
      if (text === null) { warnings.push(`stylesheet not inlined: ${link.href}`); continue; }
      const st = document.createElement('style'); st.setAttribute('data-snapshot-href', link.href); if (link.media) {st.media = link.media;} st.textContent = absUrls(text, link.href); swap(link, st);
    }
    // 3. adopted sheets come after a scope's own sheets in the cascade, so their <style> goes last
    const docAdopted = document.adoptedStyleSheets.map(cssText).filter(Boolean).join('\n');
    if (docAdopted) { const st = document.createElement('style'); st.setAttribute('data-snapshot', 'adopted'); st.textContent = docAdopted; add(document.body || document.documentElement, st); }
    for (const r of roots) { const t = r.adoptedStyleSheets.map(cssText).filter(Boolean).join('\n'); if (t) { const st = document.createElement('style'); st.setAttribute('data-snapshot', 'adopted'); st.textContent = t; add(r, st); } }
    // 4. property state → attributes
    for (const el of all('input, textarea, select')) {
      if (el.type === 'checkbox' || el.type === 'radio') {setAttr(el, 'checked', el.checked ? '' : null);}
      else if (el.tagName === 'TEXTAREA') {setText(el, el.value);}
      else if (el.tagName === 'SELECT') {for (const o of el.options) {setAttr(o, 'selected', o.selected ? '' : null);}}
      else if (el.type !== 'file' && el.type !== 'password') {setAttr(el, 'value', el.value);}
    }
    let scrolled = 0;
    for (const el of all('*')) { if (el.scrollTop || el.scrollLeft) { setAttr(el, 'data-snapshot-scroll', `${Math.round(el.scrollTop)},${Math.round(el.scrollLeft)}`); scrolled++; } }
    // 5. canvases → images of their current pixels
    for (const cv of all('canvas')) {
      try { const img = document.createElement('img'); img.src = cv.toDataURL('image/png'); img.className = cv.className; img.setAttribute('style', `${cv.getAttribute('style') || ''};width:${cv.clientWidth}px;height:${cv.clientHeight}px`); swap(cv, img); } catch { warnings.push('a canvas could not be read (tainted)'); }
    }
    // 6. nothing that runs: scripts, preloads of scripts, inline handlers, CSP meta tags
    for (const s of all('script, link[rel="modulepreload"], link[rel="preload"][as="script"], meta[http-equiv="Content-Security-Policy" i]')) {detach(s);}
    for (const el of all('*')) { for (const a of [...el.attributes]) { if (/^on/i.test(a.name)) {setAttr(el, a.name, null);} } }
    // 7. assets → data: URLs
    if (inlineAssets) {
      const cache = new Map();
      const dataUrl = async (u) => {
        if (!cache.has(u)) {cache.set(u, (async () => { try { const res = await fetch(u); if (!res.ok) {return null;} const b = await res.blob(); return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(b); }); } catch { return null; } })());}
        const v = await cache.get(u); if (!v) {warnings.push(`asset not inlined: ${u}`);} return v;
      };
      const inlineCss = async (text, base) => { const urls = [...new Set([...text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => m[2]).filter((u) => !/^(data:|#|blob:)/.test(u)))]; for (const u of urls) { let abs; try { abs = new URL(u, base).href; } catch { continue; } const d = await dataUrl(abs); if (d) {text = text.split(u).join(d);} } return text; };
      for (const st of all('style')) { const t = st.textContent; if (/url\(/.test(t)) { const n = await inlineCss(t, st.getAttribute('data-snapshot-href') || document.baseURI); if (n !== t) {setText(st, n);} } }
      for (const el of all('[style*="url("]')) { const t = el.getAttribute('style'); setAttr(el, 'style', await inlineCss(t, document.baseURI)); }
      for (const img of all('img[src], img[srcset]')) { const u = img.currentSrc || img.src; if (u && !u.startsWith('data:')) { const d = await dataUrl(u); if (d) { setAttr(img, 'src', d); setAttr(img, 'srcset', null); } } }
      for (const s of all('picture source[srcset]')) {setAttr(s, 'srcset', null);}
      for (const v of all('video[poster]')) { const d = await dataUrl(v.poster); if (d) {setAttr(v, 'poster', d);} }
      for (const im of all('image[href]')) { const d = await dataUrl(new URL(im.getAttribute('href'), document.baseURI).href); if (d) {setAttr(im, 'href', d);} }
    }
    if (restoreScroll && scrolled) {
      const s = document.createElement('script'); s.textContent = "/* snapshot: restore scroll offsets */for(const e of document.querySelectorAll('[data-snapshot-scroll]')){const[t,l]=e.getAttribute('data-snapshot-scroll').split(',').map(Number);e.scrollTop=t;e.scrollLeft=l;}";
      add(document.body || document.documentElement, s);
    }
    let html = document.documentElement.getHTML({ shadowRoots: roots });
    html = html.replace(/\snonce="[^"]*"/g, '');
    const attrs = [...document.documentElement.attributes].map((a) => ` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');
    return { html, attrs, doctype: document.compatMode === 'BackCompat' ? '' : '<!doctype html>\n', shadowRoots: roots.length, warnings };
  } finally { for (const f of undo.reverse()) { try { f(); } catch { /* node gone */ } } }
}
