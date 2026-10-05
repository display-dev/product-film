// engine.js – deterministic paper-collage renderer (product-film Route D). window.seek(t) draws frame t.
// Rules built in: motion is stepped on 2s (15 poses a second), marker lines and labels boil on 3s, UI screenshots never
// boil – a print moves only as a whole, with 2D transforms, so its text re-rasters sharp from the 3× capture at any zoom.
// Query: ?fmt=16x9|9x16|4x5  &cap=0 (no captions)  &strict=1 (missing shot/box/cue = error; render.mjs sets it)
//        &guides=1 (draw the 9:16 platform bands and the camera FREE area)  &t0=&t1= (preload only that range)
import { BRAND, C, marker, doodle, lettering, stripOutline, paperPiece, hashSeed, rng } from '../kit/kit.js';
import { drawCharacter, drawBust, mixPose, withShadow } from '../kit/rig.js';
import { POSES } from '../kit/puppet.js';

export const Q = new URLSearchParams(location.search);
export const FMT = Q.get('fmt') || '16x9';
export const CAP = Q.get('cap') !== '0';
export const STRICT = Q.get('strict') === '1';
const GUIDES = Q.get('guides') === '1';
export const SIZES = { '16x9': [1920, 1080], '9x16': [1080, 1920], '4x5': [1080, 1350] };
export const [W, H] = SIZES[FMT];
export const DPR = window.devicePixelRatio || 1;
export const TL = await (await fetch(Q.get('tl') || 'timeline.json')).json();
export const FPS = TL.fps;
export const WARN = (window.WARN = []);
const warn = (m) => { if (STRICT) {throw new Error(m);} if (!WARN.includes(m)) { WARN.push(m); console.warn(m); } };
export const LB = (k) => { const v = TL.labels?.[k]; if (v === undefined || v === null) {throw new Error(`label ${k}`);} return v; };
export const V = (o) => (o[FMT] ?? o['16x9']);            // per-format value: V({ '16x9': …, '9x16': …, '4x5': … })

// ── fonts (local files only: renders never depend on the network). Brand font, caption mono, hand lettering. ──
// To use your product's font, put its woff2 in kit/fonts (tools/fetch-fonts.mjs), list it here and set brand.font.
for (const [f, u, w] of [['Geist', 'geist.woff2', '100 900'], ['Geist Mono', 'geist-mono.woff2', '100 900'], ['Caveat Brush', 'caveat-brush.woff2', '400']]) {
  const ff = new FontFace(f, `url(../kit/fonts/${u})`, { weight: w }); await ff.load(); document.fonts.add(ff);
}

// ── assets ────────────────────────────────────────────────────────
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`img ${src}`)); i.src = src; });
const KM = await (await fetch('../kit/png/manifest.json')).json();
export const P = {};
await Promise.all(Object.entries(KM).map(async ([name, meta]) => { P[name] = { img: await loadImg(`../kit/png/${name}.png`), meta }; }));
const SHOTS = {}; const SHOTDIR = '../capture/shots/';
export async function preload(names) {
  await Promise.all(names.filter((n) => !(n in SHOTS)).map(async (n) => { try { SHOTS[n] = await loadImg(SHOTDIR + n); } catch  { SHOTS[n] = null; warn(`shot missing: ${n}`); } }));
}
export const shot = (n) => SHOTS[n];
const MAN = {};
for (const f of TL.manifests || []) { try { for (const e of await (await fetch(SHOTDIR + f)).json()) {MAN[e.file] = e;} } catch { warn(`manifest missing: ${f}`); } }
export const man = (file) => MAN[file];
// A named element box [x, y, w, h] in the shot's CSS px, measured from the live DOM at capture. First name found wins.
export const box = (file, ...names) => {
  for (const n of names) { const b = MAN[file]?.boxes?.[n]; if (b) {return b;} }
  warn(`box ${names.join('|')} missing in ${file}`); const vp = MAN[file]?.viewport || [1280, 800]; return [vp[0] / 2 - 120, vp[1] / 2 - 30, 240, 60];
};

// ── time ──────────────────────────────────────────────────────────
export let F = 0, T = 0, TQ = 0;
export const q2 = (t) => Math.floor(t * FPS / 2 + 1e-6) * 2 / FPS;   // motion on 2s
export const boil = () => Math.floor(F / 3) % 3;                     // lines boil on 3s (3 seeded variants)
// scene(id).cue(name) = absolute time of a named cue. A cue name that is not in timeline.json is an error.
export const scene = (id) => { const s = TL.scenes.find((x) => x.id === id); return { ...s, cue: (c) => { const v = s.cues?.[c]; if (v === undefined || v === null) {throw new Error(`cue ${id}.${c} missing in timeline.json`);} return s.start + v; } }; };
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const E = {
  lin: (u) => u, io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2), out: (u) => 1 - Math.pow(1 - u, 3), in: (u) => u * u * u,
  back: (u) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
};
// keyframes: [[t, value, ease?], …]; value number | array | object of numbers; ease applies to the segment ending at
// that key; 'hold' keeps the previous value until that key (use it for camera holds).
export function kf(t, keys) {
  if (t <= keys[0][0]) {return keys[0][1];} const last = keys[keys.length - 1]; if (t >= last[0]) {return last[1];}
  for (let i = 1; i < keys.length; i++) {if (t < keys[i][0]) {
    const [t0, a] = keys[i - 1], [t1, b, e = 'io'] = keys[i]; if (e === 'hold') {return a;}
    const u = E[e]((t - t0) / (t1 - t0)); return lerp(a, b, u);
  }}
  return last[1];
}
export function lerp(a, b, u) {
  if (typeof a === 'number') {return a + (b - a) * u;}
  if (Array.isArray(a)) {return a.map((v, i) => v + (b[i] - v) * u);}
  const o = {}; for (const k in a) {o[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * u : (u < 0.5 ? a[k] : b[k]);} return o;
}
// last state at or before t: states = [[t, value], …]
export const stateAt = (t, states) => { let v = states[0][1]; for (const [ts, s] of states) {if (t >= ts - 1e-6) {v = s;}} return v; };
export const ramp = (t, t0, d) => clamp((t - t0) / d);
// slide a piece in from an offset (ease-out) or out to one (ease-in); returns [dx, dy, rot]
export const slideIn = (t, t0, d = 0.4, from = [0, 900], rot0 = 0.05) => { const u = E.out(clamp((t - t0) / d)); return [from[0] * (1 - u), from[1] * (1 - u), rot0 * (1 - u)]; };
export const slideOut = (t, t0, d = 0.4, to = [-2200, 0], rot1 = -0.05) => { const u = E.in(clamp((t - t0) / d)); return [to[0] * u, to[1] * u, rot1 * u]; };
// A character walking from one spot to another in stepped hops (carry one character across a cut with this).
// from/to = [x, y, scale]; returns [x, y, scale].
export function hop(t, t0, d, from, to, { hops = 2, height = 14 } = {}) {
  const u = E.io(ramp(t, t0, d)); const p = from.map((v, i) => v + (to[i] - v) * u);
  if (u > 0 && u < 1) {p[1] -= Math.abs(Math.sin(u * Math.PI * hops)) * height;} return p;
}

// ── canvas ────────────────────────────────────────────────────────
const cv = document.getElementById('c'); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = `${W}px`; cv.style.height = `${H}px`;
export const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high';
// Background plate (film/bg/bg-<fmt>.png, made by tools/make-bg.py), drawn once per frame from one cached canvas.
const bg = document.createElement('canvas'); bg.width = W * DPR; bg.height = H * DPR;
{ const b = bg.getContext('2d'); b.fillStyle = C.plate; b.fillRect(0, 0, bg.width, bg.height);
  try { const im = await loadImg(`bg/bg-${FMT}.png`); b.imageSmoothingQuality = 'high'; b.drawImage(im, 0, 0, bg.width, bg.height); } catch { warn(`background bg/bg-${FMT}.png missing (flat plate)`); } }

// ── camera ────────────────────────────────────────────────────────
// cam = {x, y, s}: the world point shown at FOCUS, and zoom. World = format stage px.
// FOCUS = where a camera target lands: the centre of the area that captions and platform UI leave free.
export const FOCUS = V(TL.camera?.focus || { '16x9': [960, 500], '9x16': [465, 745], '4x5': [540, 600] });
export const FREE = V(TL.camera?.free || { '16x9': [1860, 900], '9x16': [900, 960], '4x5': [1020, 1100] });
export let camS = 1;
export function cam(c) { camS = c.s; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.translate(FOCUS[0], FOCUS[1]); ctx.scale(c.s, c.s); ctx.translate(-c.x, -c.y); }
export const CAM0 = () => ({ x: FOCUS[0], y: FOCUS[1], s: 1 });
export const camOn = (bx, s) => ({ x: bx[0] + bx[2] / 2, y: bx[1] + bx[3] / 2, s });                        // centre box at zoom s
export const camFit = (bx, maxS = 1.9) => camOn(bx, Math.min(maxS, FREE[0] / bx[2], FREE[1] / bx[3]));     // fit box inside FREE
// Zoom onto a box and back: [[in, CAM0], [in+d, on], [out, on, 'hold'], [out+d, CAM0]] as one call.
export const zoomTo = (t, tIn, tOut, bx, s, d = 0.45) => kf(t, [[tIn, CAM0()], [tIn + d, camOn(bx, s)], [tOut, camOn(bx, s), 'hold'], [tOut + d, CAM0()]]);

// ── drawing helpers ───────────────────────────────────────────────
export function piece(name, x, y, { s = 1, rot = 0, lift = 1, alpha = 1, shadow = true, flip = false } = {}) {
  const p = P[name]; if (!p) {throw new Error(`kit piece ${name} missing (rebuild the kit)`);}
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(flip ? -s : s, s); ctx.globalAlpha *= alpha;
  const draw = () => ctx.drawImage(p.img, p.meta.x, p.meta.y, p.meta.w, p.meta.h);
  if (shadow) {withShadow(ctx, DPR * camS * s, draw, { lift });} else {draw();} ctx.restore();
}
// Hand-lettered label, boiling on 3s. write = 0..1 reveals left→right like a pen.
export function label(text, x, y, { size = 44, color = C.ink, rot = 0, write = 1, align = 'left', seed } = {}) {
  if (write <= 0) {return;} ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `400 ${size}px "Caveat Brush"`; const w = ctx.measureText(text).width; const x0 = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
  if (write < 1) { ctx.beginPath(); ctx.rect(x0 - 10, -size * 1.2, (w + 20) * write, size * 1.8); ctx.clip(); }
  lettering(ctx, text, 0, 0, { size, color, seed: seed ?? hashSeed(text), variant: boil(), align }); ctx.restore();
}
// Marker doodle: passes from doodle.* (circle, underline, arrow, cross, tick, question, squiggle, star); progress draws on.
export function ink(passes, { w = 6, color = C.ink, progress = 1, seed = 1, alpha = 0.94 } = {}) {
  if (progress <= 0) {return;} marker(ctx, passes, { w, color, progress, seed: seed + boil() * 7919, alpha });
}
// Marker arrow + hand-lettered label pointing at a point (ax, ay) from the label at (lx, ly).
export function note(text, lx, ly, ax, ay, t, t0, { size = 46, color = C.ink, rot = -0.02, bend = 0.2, align = 'left', side = null } = {}) {
  ink(doodle.arrow(lx, ly, ax, ay, hashSeed(text) % 97, bend, 18), { w: 5, color, progress: ramp(t, t0, 0.3), seed: hashSeed(text) % 997 });
  if (side === 'right') { label(text, lx + 14, ly + size * 0.3, { size, color, rot, write: ramp(t, t0 + 0.15, 0.35) }); return; }
  const tx = align === 'right' ? lx - 12 : align === 'center' ? lx : lx + 12; label(text, tx, ly + (ly > ay ? size * 0.75 : -size * 0.25), { size, color, rot, write: ramp(t, t0 + 0.15, 0.35), align });
}

// Product shots sit in CLEAN windows: the real UI is not paper. kind: 'browser' = title bar with traffic
// lights + URL pill; 'photo' = a clean rounded card, no bar; 'raw' = the image already is a window (agent window).
export const FRAME = { browser: { bar: 46 }, photo: { bar: 0 }, raw: { bar: 0 } };
const PAPER = 'oklch(0.995 0.003 85)', BORDER = 'oklch(0.90 0.006 85)', SURF = 'oklch(0.965 0.006 85)';
function windowShadow(k, lift = 1) { ctx.shadowColor = `rgba(20,18,14,${0.13 + 0.05 * (lift - 1)})`; ctx.shadowBlur = 34 * k * lift; ctx.shadowOffsetY = 12 * k * lift; ctx.shadowOffsetX = 0; }
// o: { shot, crop:[x,y,w,h] css px, x, y, w (content width, world px), rot, url, kind, lift, over(ctx-space callback) }
// Returns the layout used to map shot boxes to world coords (toWorld/boxWorld). In non-strict mode a missing
// shot draws a labelled placeholder, so a film can be blocked out (animatic) before the captures exist.
export function print(o) {
  const img = shot(o.shot); if (!img) {warn(`shot not loaded: ${o.shot}`);}
  const m = man(o.shot); const vw = m?.viewport?.[0] || 1280, vh = m?.viewport?.[1] || 800;
  const dsf = o.dsf || m?.dsf || (img ? img.width / vw : 3);
  const crop = o.crop || [0, 0, img ? img.width / dsf : vw, img ? img.height / dsf : vh]; const sc = o.w / crop[2]; const ch = crop[3] * sc;
  const kind = o.kind || 'browser'; const bar = FRAME[kind].bar; const R = kind === 'raw' ? 16 * sc : 12;
  const k = DPR * camS;
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0);
  const pixels = (x, y, w, h) => { if (img) { ctx.drawImage(img, crop[0] * dsf, crop[1] * dsf, crop[2] * dsf, crop[3] * dsf, x, y, w, h); return; }
    ctx.fillStyle = 'oklch(0.93 0.01 85)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = C.muted; ctx.font = `500 ${Math.max(14, w / 40)}px "Geist Mono"`; ctx.textAlign = 'center'; ctx.fillText(`[${o.shot}]`, x + w / 2, y + h / 2); ctx.textAlign = 'left'; };
  if (kind === 'raw') {
    ctx.save(); windowShadow(k, o.lift || 1); pixels(0, 0, o.w, ch); ctx.restore();
  } else {
    const h = ch + bar;
    ctx.save(); windowShadow(k, o.lift || 1); ctx.fillStyle = PAPER; ctx.beginPath(); ctx.roundRect(0, 0, o.w, h, R); ctx.fill(); ctx.restore();
    if (bar) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, o.w, bar + 1, [R, R, 0, 0]); ctx.fillStyle = SURF; ctx.fill(); ctx.restore();
      [['#ff5f57', 0], ['#febc2e', 1], ['#28c840', 2]].forEach(([c, i]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(22 + i * 20, bar / 2, 6, 0, Math.PI * 2); ctx.fill(); });
      if (o.url) { const px = 96, pw = o.w - 192, ph = 30, py = (bar - ph) / 2; ctx.fillStyle = PAPER; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 15); ctx.fill(); ctx.strokeStyle = BORDER; ctx.lineWidth = 1; ctx.stroke();
        const lx = px + 18, ly = py + ph / 2; ctx.strokeStyle = 'oklch(0.45 0.01 85)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(lx, ly - 3, 4, Math.PI, 0); ctx.stroke(); ctx.fillStyle = 'oklch(0.45 0.01 85)'; ctx.fillRect(lx - 5.5, ly - 2, 11, 8);
        ctx.fillStyle = 'oklch(0.3 0.008 85)'; ctx.font = '500 16px "Geist Mono"'; ctx.textBaseline = 'middle'; ctx.fillText(o.url, px + 34, py + ph / 2 + 1); ctx.textBaseline = 'alphabetic'; }
      ctx.fillStyle = BORDER; ctx.fillRect(0, bar, o.w, 1);
    }
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, bar ? bar + 1 : 0, o.w, ch - (bar ? 1 : 0), bar ? [0, 0, R, R] : R); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; pixels(0, bar, o.w, ch); ctx.restore();
    ctx.strokeStyle = BORDER; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(0.5, 0.5, o.w - 1, h - 1, R); ctx.stroke();
  }
  if (o.over) {o.over({ sc, cx: 0, cy: bar, crop });}
  ctx.restore();
  return { sc, ox: o.x, oy: o.y + bar, crop, fw: o.w, fh: ch + bar };
}
// map a CSS-px point or box in a shot to world coords, given print()'s result (unrotated prints only)
export const toWorld = (pr, px, py) => [pr.ox + (px - pr.crop[0]) * pr.sc, pr.oy + (py - pr.crop[1]) * pr.sc];
export const boxWorld = (pr, b, pad = 0) => { const [x, y] = toWorld(pr, b[0] - pad, b[1] - pad); return [x, y, (b[2] + pad * 2) * pr.sc, (b[3] + pad * 2) * pr.sc]; };
// the same before drawing (cameras are set before the print is drawn): L = { x, y, w, crop, kind }
export function layoutBox(L, b, pad = 0) { const crop = L.crop || [0, 0, 1280, 800]; const sc = L.w / crop[2]; const bar = FRAME[L.kind || 'browser'].bar; return [L.x + (b[0] - pad - crop[0]) * sc, L.y + bar + (b[1] - pad - crop[1]) * sc, (b[2] + pad * 2) * sc, (b[3] + pad * 2) * sc]; }
export const unionBox = (a, b) => { const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), x1 = Math.max(a[0] + a[2], b[0] + b[2]), y1 = Math.max(a[1] + a[3], b[1] + b[3]); return [x0, y0, x1 - x0, y1 - y0]; };

// Phone: a clean black phone with a 390×844 capture on its screen. o: { shot, x, y, s, rot, crop, over }
export const PHONE = { screen: [18, 22, 390, 844], radius: 40, size: [426, 890] };
export function phone(o) {
  const img = shot(o.shot); if (!img) {warn(`shot not loaded: ${o.shot}`);} const [sx, sy, sw, sh] = PHONE.screen; const [pw, ph] = PHONE.size;
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0); ctx.scale(o.s, o.s);
  ctx.save(); windowShadow(DPR * camS * o.s); ctx.fillStyle = '#121211'; ctx.beginPath(); ctx.roundRect(0, 0, pw, ph, 58); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(3, 3, pw - 6, ph - 6, 55); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, PHONE.radius); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, sw, sh);
  if (img) { const m = man(o.shot); const dsf = m?.dsf || img.width / 390; const crop = o.crop || [0, 0, 390, 844]; ctx.drawImage(img, crop[0] * dsf, crop[1] * dsf, crop[2] * dsf, crop[3] * dsf, sx, sy, sw, sw * crop[3] / crop[2]); }
  else { ctx.fillStyle = C.muted; ctx.font = '500 18px "Geist Mono"'; ctx.textAlign = 'center'; ctx.fillText(`[${o.shot}]`, sx + sw / 2, sy + sh / 2); ctx.textAlign = 'left'; }
  if (o.over) {o.over({ sx, sy, sc: sw / 390 });}
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(pw / 2 - 30, 8, 60, 7, 3.5); ctx.fill();
  ctx.restore();
}
// world box of a CSS box inside the phone's screen
export const phoneBox = (o, b) => [o.x + (PHONE.screen[0] + b[0]) * o.s, o.y + (PHONE.screen[1] + b[1]) * o.s, b[2] * o.s, b[3] * o.s];

// A full-body CAST character at (x, y) = hip point, scale s. poses: [[t, 'pose', dur?], …] eased between keys, stepped.
export function character(id, x, y, s, t, poses, { look = [0, 0], blinks = [], face, rot = 0 } = {}) {
  let pose = POSES[poses[0][1]];
  for (let i = 1; i < poses.length; i++) { const [t1, name, d = 0.33] = poses[i]; if (t >= t1) { const u = E.io(clamp((t - t1) / d)); pose = mixPose(poses[i - 1][1], name, u); if (u >= 1) {pose = POSES[name];} } }
  if (face) {pose = { ...pose, face };}
  const blink = blinks.some((b) => t >= b && t < b + 0.13);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); drawCharacter(ctx, P, id, pose, { k: DPR * camS * s, variant: boil(), look, blink }); ctx.restore();
}
// A CAST character as a bust, origin at the bottom centre of the shoulders.
export function bust(id, x, y, s, { face = 'smile', look = [0, 0], blink = false, rot = 0, tilt = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); drawBust(ctx, P, id, { k: DPR * camS * s, face, variant: boil(), look, blink, headTilt: tilt }); ctx.restore();
}
// Paper pointer with its tip at (x,y). clickAt → pressed look + a small marker burst for 0.4 s.
export function cursor(x, y, { s = 1.15, clickAt = null, t = 0 } = {}) {
  const pressed = clickAt !== null && clickAt !== undefined && t >= clickAt && t < clickAt + 0.14;
  if (clickAt !== null && clickAt !== undefined && t >= clickAt && t < clickAt + 0.4) {
    const u = (t - clickAt) / 0.4; const passes = [[[x - 14, y - 14], [x - 26 - u * 8, y - 26 - u * 8]], [[x - 18, y + 2], [x - 34 - u * 8, y + 4]], [[x + 2, y - 18], [x + 4, y - 34 - u * 8]]];
    ink(passes, { w: 3.6, seed: 77 });
  }
  piece('cursor', x, y, { s: pressed ? s * 0.9 : s, lift: pressed ? 0.6 : 1.3 });
}
// Pointer path: keys [[t, x, y, ease?], …], straight moves; 'hold' rests until that key.
export function pathAt(t, keys) { return kf(t, keys.map(([tt, x, y, e]) => [tt, [x, y], e])); }
// A tap on a touch screen: marker rays for 0.4 s.
export function tap(x, y, t, at, { w = 3.6, color = C.ink } = {}) {
  if (t < at || t >= at + 0.4) {return;} const u = (t - at) / 0.4;
  const rays = [[-1, -1], [0, -1.3], [1, -1], [-1.3, 0], [1.3, 0]].map(([dx, dy]) => [[x + dx * 16, y + dy * 16], [x + dx * (28 + u * 10), y + dy * (28 + u * 10)]]);
  ink(rays, { w, seed: 91, color });
}
// Stop-motion replacement of a print: states [[t, shot, lift?], …] → { shot, lift, dy }. A change lifts the print
// for one step first (lift=false for in-place UI changes such as typing, where the window must not move).
export function swapAt(t, states, { lift = true } = {}) {
  let cur = states[0][1], liftAmt = 1, dy = 0;
  for (let i = 1; i < states.length; i++) {
    const [ts, s] = states[i];
    if (t >= ts) {cur = s;}
    if (lift && states[i][2] !== false) { if (t >= ts - 2 / FPS && t < ts) { liftAmt = 1.9; dy = -7; } else if (t >= ts && t < ts + 2 / FPS) { liftAmt = 1.4; dy = -3; } }
  }
  return { shot: cur, lift: liftAmt, dy };
}

// The text wordmark for the flat end card: brand.wordmark in brand.font 600 at −0.04em, in ink. (x, y) = top-left
// (align 'left') or top-centre (align 'center'); h = font size. No logo files: a product with a logo it has the
// right to show draws it here instead. Returns the drawn width.
export function wordmark(x, y, h, { align = 'left', color = C.ink } = {}) {
  ctx.save(); ctx.font = `600 ${h}px "${BRAND.font}"`; ctx.letterSpacing = `${-0.04 * h}px`; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(BRAND.wordmark).width; ctx.fillText(BRAND.wordmark, align === 'center' ? x - w / 2 : x, y + h * 0.82);
  ctx.letterSpacing = '0px'; ctx.restore(); return w;
}

// ── captions: Geist Mono on torn typewriter strips, one accent word ──
const CAPCFG = V({
  '16x9': { size: 56, maxW: 1780, x: 'center', bottom: 1040, lineGap: 10 },
  '9x16': { size: 58, maxW: 880, x: 34, bottom: 1432, lineGap: 10 },    // inside the platform-safe area
  '4x5': { size: 54, maxW: 1000, x: 'center', bottom: 1300, lineGap: 10 },
  ...TL.captionStyle,
});
const stripCache = {};
function capLines(text) {
  ctx.save(); ctx.font = `500 ${CAPCFG.size}px "Geist Mono"`; const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const tryL = cur ? `${cur} ${w}` : w; if (ctx.measureText(tryL).width > CAPCFG.maxW - 80 && cur) { lines.push(cur); cur = w; } else {cur = tryL;} }
  lines.push(cur); ctx.restore(); return lines;
}
export function captions(t) {
  if (!CAP) {return;}
  // Caption steps run on the same 2-frame grid as all other motion (a caption starting on an odd frame would
  // otherwise step between the motion steps and read as a 1-frame cadence next to the 3-frame boil).
  const tq = q2(t);
  for (const c of TL.captions) {
    const cs = q2(c.start), ce = q2(c.end);
    if (tq < cs || tq >= ce + 4 / FPS) {continue;}
    const u = tq - cs; const out = tq >= ce;
    const lines = capLines(c.text); const S = CAPCFG.size; const h = Math.round(S * 1.62);
    lines.forEach((line, li) => {
      ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.font = `500 ${S}px "Geist Mono"`;
      const tw = ctx.measureText(line).width; const w = Math.round(tw + S * 1.3);
      const key = c.id + li + FMT; if (!stripCache[key]) {stripCache[key] = paperPiece(stripOutline(w, h, hashSeed(key) % 9973), { color: C.strip, seed: hashSeed(key) % 991, S: DPR * 1.5, amp: 0.55, fibreWidth: 1.1, wave: 30 });}
      const st = stripCache[key]; const r = rng(hashSeed(key));
      const nL = lines.length; const y = CAPCFG.bottom - (nL - li) * h - (nL - 1 - li) * CAPCFG.lineGap;
      const x = CAPCFG.x === 'center' ? Math.round(W / 2 - w / 2) : CAPCFG.x + li * 18;
      // enter: two stepped poses (drop in), exit: one lifted pose, then gone
      const inStep = u < 2 / FPS ? 0 : u < 4 / FPS ? 1 : 2; const drop = [16, 6, 0][inStep], extraRot = [-0.012, -0.004, 0][inStep];
      const rot = (r() - 0.5) * 0.012 + extraRot; const lift = out ? 1.8 : [1.8, 1.3, 1][inStep];
      ctx.translate(x + w / 2, y + h / 2 + drop - (out ? 5 : 0)); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
      withShadow(ctx, DPR, () => ctx.drawImage(st.canvas, st.x, st.y, st.w, st.h), { lift });
      ctx.textBaseline = 'middle'; let cx = Math.round(S * 0.65);
      for (const word of line.split(' ')) {
        const bare = word.replace(/[.,?!]/g, ''); const acc = bare === c.accent;
        ctx.font = `${acc ? 600 : 500} ${S}px "Geist Mono"`; ctx.fillStyle = acc ? C.accent : C.ink; ctx.fillText(word, cx, h / 2 + S * 0.04);
        cx += ctx.measureText(`${word} `).width;
      }
      ctx.restore();
    });
  }
}

// ── guides (preview only): 9:16 platform bands and the camera FREE area ──
function guides() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.save(); ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
  const z = TL.safeZones?.[FMT]; if (z) { ctx.strokeStyle = 'rgba(255,0,180,0.9)'; ctx.strokeRect(z.left || 0, z.top || 0, W - (z.left || 0) - (z.right || 0), H - (z.top || 0) - (z.bottom || 0)); }
  ctx.strokeStyle = 'rgba(0,150,255,0.7)'; ctx.strokeRect(FOCUS[0] - FREE[0] / 2, FOCUS[1] - FREE[1] / 2, FREE[0], FREE[1]); ctx.restore();
}

// ── frame ─────────────────────────────────────────────────────────
// SCENES[id] = { draw(tq, s, t), pre?, post?, shots?: () => [file, …] }. draw gets the stepped time tq, the scene
// (with s.cue()), and the unstepped time t. A scene draws from start − pre until end + post, so it can overlap its
// neighbour for a hand-over; whatever is carried across a cut must be drawn by exactly one scene at any time.
export const SCENES = {};
export function frame(t) {
  F = Math.round(t * FPS); T = F / FPS; TQ = q2(T);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bg, 0, 0);
  for (const s of TL.scenes) {
    const S = SCENES[s.id]; if (!S) {continue;} const pre = S.pre ?? 0, post = S.post ?? 0.5;
    if (T < s.start - pre || T >= s.end + post) {continue;}
    ctx.save(); camS = 1; S.draw(TQ, scene(s.id), T); ctx.restore();
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); captions(T);
  if (GUIDES) {guides();}
}
// Call start() at the end of film.js: preloads the shots the scenes in [t0, t1] declare, then signals ready.
export async function start() {
  const t0 = +(Q.get('t0') ?? 0), t1 = +(Q.get('t1') ?? TL.duration); const need = new Set();
  for (const sc of TL.scenes) {if (sc.end + 0.6 >= t0 && sc.start - 0.6 <= t1) {for (const f of SCENES[sc.id]?.shots?.() || []) {need.add(f);}}}
  await preload([...need]);
  window.seek = (t) => { frame(t); return F; };
  window.duration = TL.duration; window.fps = FPS;
  document.title = 'ready';
}
