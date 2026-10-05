// kit.js – the paper-collage kit (product-film Route D template).
// Every edge, grain, tape, marker stroke and halftone dot is drawn here from seeded noise,
// so one seed always makes the same piece. kit/export.html uses it to freeze the static pieces as PNGs;
// the film uses the same code at runtime for marker doodles, labels and caption strips.
// Brand: the ink, the plate, the one accent and the wordmark come from "brand" in film/timeline.json (the defaults
// below are the template's example product). Paper tones stay warm construction-paper shades. Garments stay muted and
// away from the accent's hue, so the accent remains the only signal colour on screen.

const TL_BRAND = await fetch(new URL('../film/timeline.json', import.meta.url)).then((r) => r.json()).then((t) => t.brand || {}).catch(() => ({}));
export const BRAND = { accent: '#0E8A7E', accentText: '#FFFFFF', ink: '#121212', plate: '#F3F3F3', wordmark: 'Tidewell', font: 'Geist', ...TL_BRAND };
// a colour at an alpha: hex → rgba(), anything else → color-mix()
export const alpha = (c, a) => { const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)?.[1]; if (!h) {return `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;} const f = h.length === 3 ? [...h].map((x) => x + x) : h.match(/../g); return `rgba(${f.map((x) => parseInt(x, 16)).join(',')},${a})`; };

export const C = {
  paper: 'oklch(0.995 0.003 85)',     // the background sheet
  ink: BRAND.ink,                     // marker ink, text
  plate: BRAND.plate,                 // the film's plate behind everything
  inkPaper: 'oklch(0.19 0.007 85)',   // black construction paper
  off: 'oklch(0.965 0.010 85)',       // off-white construction paper
  core: 'oklch(0.992 0.004 85)',      // the white core that shows on a torn edge
  grey: 'oklch(0.80 0.013 80)',       // warm grey construction paper (light)
  greyMid: 'oklch(0.66 0.014 80)',    // warm grey construction paper (mid)
  metal: 'oklch(0.74 0.018 85)',      // split pin
  accent: BRAND.accent,               // the one accent: caption accent word, key doodles and labels, the end-card pill
  accentText: BRAND.accentText,       // text on the accent
  muted: 'oklch(0.556 0.008 85)',
  tape: 'rgba(214,206,188,0.80)',     // masking tape
  tapeAccent: alpha(BRAND.accent, 0.82),
  strip: 'oklch(0.982 0.008 85)',     // typewriter strip paper
  // Cast colours: muted construction-paper shades. An ink-only cast read as colourless and was rejected in review.
  // Skin: five tones, light to dark order is skin3, skin1, skin4, skin2, skin5.
  skin1: 'oklch(0.80 0.065 55)', skin2: 'oklch(0.56 0.08 45)', skin3: 'oklch(0.88 0.045 60)',
  skin4: 'oklch(0.70 0.075 50)', skin5: 'oklch(0.44 0.06 40)',
  hairBrown: 'oklch(0.30 0.045 50)', hairAuburn: 'oklch(0.56 0.13 42)', hairBlack: 'oklch(0.19 0.007 85)', hairGrey: 'oklch(0.72 0.01 80)',
  // Garments: one colour per character, muted. Keep them away from the accent's hue (with a teal accent: no teal,
  // green or blue garments), or a garment competes with the accent for attention.
  mustard: 'oklch(0.80 0.135 85)', mustardDeep: 'oklch(0.73 0.14 78)',
  coral: 'oklch(0.69 0.135 35)', plum: 'oklch(0.47 0.10 340)', brick: 'oklch(0.52 0.11 30)', olive: 'oklch(0.62 0.07 110)',
  charcoal: 'oklch(0.32 0.012 70)', stripe: 'oklch(0.97 0.012 80)',
};

// ── seeded randomness ────────────────────────────────────────────────
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hashSeed = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// periodic 1D value noise with N lattice points on u∈[0,1)
function vnoise1(seed, N, periodic = true) {
  const r = rng(seed); const v = Array.from({ length: N + 1 }, () => r() * 2 - 1); if (periodic) {v[N] = v[0];}
  return (u) => { const x = (periodic ? (((u % 1) + 1) % 1) : Math.max(0, Math.min(0.999999, u))) * N; const i = Math.floor(x), f = x - i; const s = f * f * (3 - 2 * f); return v[i] + (v[i + 1] - v[i]) * s; };
}
export function fbm1(seed, N, oct = 5, gain = 0.55, periodic = true) {
  const ns = []; for (let k = 0; k < oct; k++) {ns.push(vnoise1(seed + k * 1013, Math.max(1, Math.round(N * 2 ** k)), periodic));}
  return (u) => { let s = 0, a = 1, n = 0; for (const f of ns) { s += f(u) * a; n += a; a *= gain; } return s / n; };
}

// ── geometry ────────────────────────────────────────────────────────
function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return [0, 1].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)); }
// smooth closed/open Catmull-Rom through control points, sampled every `step` px
export function spline(ctrl, closed = true, step = 1) {
  const n = ctrl.length, out = [];
  const P = (i) => closed ? ctrl[(i + n) % n] : ctrl[Math.max(0, Math.min(n - 1, i))];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p1 = P(i), p2 = P(i + 1); const m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < m; k++) {out.push(cr(P(i - 1), p1, p2, P(i + 2), k / m));}
  }
  if (!closed) {out.push(ctrl[n - 1].slice(0, 2));}
  return out;
}
// polygon with rounded corners (r per corner or one r), densified
export function roundPoly(pts, r = 6, step = 1) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n]; const rr = Array.isArray(r) ? r[i] : r;
    const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const k = Math.min(rr, d1 / 2, d2 / 2);
    const a = [p1[0] + (p0[0] - p1[0]) * k / d1, p1[1] + (p0[1] - p1[1]) * k / d1];
    const b = [p1[0] + (p2[0] - p1[0]) * k / d2, p1[1] + (p2[1] - p1[1]) * k / d2];
    const m = Math.max(2, Math.ceil(k * 1.6 / step));
    for (let j = 0; j <= m; j++) { const t = j / m; const q = [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * p1[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * p1[1] + t * t * b[1]]; out.push(q); }
    const nx = pts[(i + 1) % n]; const d3 = Math.hypot(nx[0] - p1[0], nx[1] - p1[1]); const kk = Math.min(Array.isArray(r) ? r[(i + 1) % n] : r, d3 / 2, d2 / 2);
    const s = b, e = [p2[0] + (p1[0] - p2[0]) * kk / d2, p2[1] + (p1[1] - p2[1]) * kk / d2];
    const L = Math.hypot(e[0] - s[0], e[1] - s[1]); const mm = Math.ceil(L / step);
    for (let j = 1; j < mm; j++) {out.push([s[0] + (e[0] - s[0]) * j / mm, s[1] + (e[1] - s[1]) * j / mm]);}
  }
  return out;
}
export function ellipsePts(cx, cy, rx, ry, step = 1, squash = 0) {
  const n = Math.max(24, Math.ceil(Math.PI * (rx + ry) / step)); const out = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const s = 1 + squash * Math.sin(a); out.push([cx + Math.cos(a) * rx * (1 + squash * 0.3 * Math.sin(a)), cy + Math.sin(a) * ry * s]); }
  return out;
}
function cum(pts, closed) { const c = [0]; for (let i = 1; i < pts.length; i++) {c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));} if (closed) {c.push(c[c.length - 1] + Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]));} return c; }
function signedArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
function normals(p, closed = true) {
  const s = closed ? Math.sign(signedArea(p)) || 1 : 1; const n = p.length;
  return p.map((_, i) => { const a = p[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = p[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; return [dy / L * s, -dx / L * s]; });
}
// displace a dense closed outline along its normals with fractal noise → a torn edge
export function tear(pts, seed, amp = 2.2, wave = 46, offset = 0) {
  const c = cum(pts, true), L = c[c.length - 1]; const f = fbm1(seed, Math.max(5, Math.round(L / wave)), 6, 0.56);
  const bite = fbm1(seed + 77, Math.max(3, Math.round(L / (wave * 4))), 2, 0.5);
  const nm = normals(pts, true);
  return pts.map((p, i) => { const u = c[i] / L; const b = Math.max(0, bite(u) - 0.35) * 2.2; const d = f(u) * amp * 2.1 - b * amp + offset; return [p[0] + nm[i][0] * d, p[1] + nm[i][1] * d]; });
}
export function bounds(pts) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
export function pathOf(pts) { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; }

// ── paper surfaces ──────────────────────────────────────────────────
// Add grain to whatever is already painted on ctx, only where alpha>0: fine noise + fibres + slow mottling.
export function grain(ctx, seed, { fine = 7, mottle = 0.06, flecks = 0.00025, dark = true, light = true, S = 1 } = {}) {
  const cv = ctx.canvas, W = cv.width, H = cv.height; if (!W || !H) {return;}
  const r = rng(seed);
  // slow mottling: a low-res random field drawn up with smoothing, multiplied softly
  const mw = Math.max(2, Math.ceil(W / (38 * S))), mh = Math.max(2, Math.ceil(H / (38 * S)));
  const m = document.createElement('canvas'); m.width = mw; m.height = mh; const mc = m.getContext('2d'); const md = mc.createImageData(mw, mh);
  for (let i = 0; i < mw * mh; i++) { const v = 128 + (r() - 0.5) * 255; md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = v; md.data[i * 4 + 3] = 255; }
  mc.putImageData(md, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = mottle; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(m, 0, 0, W, H); ctx.restore();
  // fibres: short curved hairs, slightly lighter and darker than the paper
  const n = Math.round(W * H * flecks);
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, a = r() * Math.PI * 2, l = (1.5 + r() * 5) * S, bend = (r() - 0.5) * 2 * S;
    const isDark = dark && (!light || r() < 0.55);
    ctx.strokeStyle = isDark ? `rgba(40,34,26,${0.05 + r() * 0.09})` : `rgba(255,253,246,${0.10 + r() * 0.16})`;
    ctx.lineWidth = (0.35 + r() * 0.5) * S; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l / 2 - Math.sin(a) * bend, y + Math.sin(a) * l / 2 + Math.cos(a) * bend, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.restore();
  // fine per-pixel noise (seeded)
  const id = ctx.getImageData(0, 0, W, H), d = id.data; const r2 = rng(seed ^ 0x9e3779b9);
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) {continue;} const v = (r2() - 0.5) * fine; d[i] = Math.max(0, Math.min(255, d[i] + v)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + v)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + v * 0.9)); }
  ctx.putImageData(id, 0, 0);
}

// A torn construction-paper piece. `outline` is a dense closed outline in piece units.
// Returns { canvas, x, y, w, h } where (x,y) is the piece-unit position of the canvas top-left, canvas is S× resolution.
export function paperPiece(outline, { color = C.off, seed = 1, S = 3, pad = 10, amp = 2.0, wave = 44, fibre = true, fibreWidth = 1.6, grainOpts = {}, draw = null, clipDraw = null } = {}) {
  const outer = tear(outline, seed, amp, wave, fibre ? fibreWidth * 0.55 : 0);
  const inner = fibre ? tear(outline, seed + 31, amp * 0.9, wave * 0.8, -fibreWidth * 0.45) : outer;
  const b = bounds(outer); const x = Math.floor(b.x0 - pad), y = Math.floor(b.y0 - pad);
  const cv = document.createElement('canvas'); cv.width = Math.ceil((b.w + 2 * pad) * S); cv.height = Math.ceil((b.h + 2 * pad) * S);
  const ctx = cv.getContext('2d'); ctx.setTransform(S, 0, 0, S, -x * S, -y * S);
  const r = rng(seed + 5);
  if (fibre) {
    ctx.fillStyle = C.core; ctx.fill(pathOf(outer));
    // fuzzy fibres standing off the torn edge
    const nm = normals(outer, true);
    for (let i = 0; i < outer.length; i += 1) {
      if (r() > 0.55) {continue;} const [px, py] = outer[i]; const [nx, ny] = nm[i];
      const ang = Math.atan2(ny, nx) + (r() - 0.5) * 1.3, l = 0.3 + r() * r() * 2.6;
      ctx.strokeStyle = `rgba(252,250,244,${0.35 + r() * 0.5})`; ctx.lineWidth = 0.18 + r() * 0.3;
      ctx.beginPath(); ctx.moveTo(px - nx * 0.4, py - ny * 0.4); ctx.lineTo(px + Math.cos(ang) * l, py + Math.sin(ang) * l); ctx.stroke();
    }
  }
  ctx.save(); ctx.clip(pathOf(inner)); ctx.fillStyle = color; ctx.fillRect(x, y, b.w + 2 * pad, b.h + 2 * pad);
  if (clipDraw) {clipDraw(ctx, r);} ctx.restore();
  // a faint darker line where the coloured layer ends (the tear catches light unevenly)
  if (fibre) { ctx.save(); ctx.strokeStyle = 'rgba(30,26,20,0.10)'; ctx.lineWidth = 0.35; ctx.stroke(pathOf(inner)); ctx.restore(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  grain(ctx, seed + 11, { S, ...grainOpts });
  if (draw) { ctx.setTransform(S, 0, 0, S, -x * S, -y * S); draw(ctx, r); ctx.setTransform(1, 0, 0, 1, 0, 0); }
  return { canvas: cv, x, y, w: cv.width / S, h: cv.height / S, S };
}

// Masking tape: translucent, crepe texture, torn zigzag ends.
export function tape(w, h, { seed = 1, color = C.tape, S = 3 } = {}) {
  const r = rng(seed);
  const zig = (x0, top, bot, dir) => { const n = Math.max(4, Math.round((bot - top) / 2.2)); const a = []; for (let i = 0; i <= n; i++) {a.push([x0 + dir * (r() * 2.4 - 0.6) + (i % 2 ? dir * 1.1 : 0), top + (bot - top) * i / n]);} return a; };
  const topEdge = [], botEdge = []; const m = Math.ceil(w / 6);
  for (let i = 1; i < m; i++) {topEdge.push([w * i / m, (r() - 0.5) * 0.5]);}
  for (let i = m - 1; i > 0; i--) {botEdge.push([w * i / m, h + (r() - 0.5) * 0.5]);}
  // clockwise: top edge L→R, right edge T→B, bottom R→L, left B→T
  const left = zig(0, 0, h, -1), right = zig(w, 0, h, 1);
  const outline = [...topEdge, ...right, ...botEdge, ...left.reverse()];
  const pad = 4; const cv = document.createElement('canvas'); cv.width = Math.ceil((w + 2 * pad) * S); cv.height = Math.ceil((h + 2 * pad) * S);
  const ctx = cv.getContext('2d'); ctx.setTransform(S, 0, 0, S, pad * S, pad * S);
  ctx.fillStyle = color; ctx.fill(pathOf(outline));
  ctx.save(); ctx.clip(pathOf(outline));
  for (let i = 0; i < w * 0.9; i++) { const x = r() * w; ctx.strokeStyle = `rgba(255,255,255,${0.04 + r() * 0.08})`; ctx.lineWidth = 0.3 + r() * 0.6; ctx.beginPath(); ctx.moveTo(x, -1); ctx.lineTo(x + (r() - 0.5) * 1.5, h + 1); ctx.stroke(); }
  for (let i = 0; i < w * 0.5; i++) { const x = r() * w; ctx.strokeStyle = `rgba(60,50,30,${0.03 + r() * 0.05})`; ctx.lineWidth = 0.3 + r() * 0.4; ctx.beginPath(); ctx.moveTo(x, -1); ctx.lineTo(x + (r() - 0.5) * 1.5, h + 1); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(0, 0, w, 1.2); ctx.fillRect(0, h - 1.2, w, 1.2);
  ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  grain(ctx, seed + 3, { S, fine: 5, mottle: 0.05, flecks: 0.0001 });
  return { canvas: cv, x: -pad, y: -pad, w: w + 2 * pad, h: h + 2 * pad, S };
}

// ── marker ink ──────────────────────────────────────────────────────
// A felt-tip stroke: wobble, pressure, overshoot and streaks. passes: array of point arrays (open polylines);
// each pass is composited separately so crossings darken like real marker. progress 0..1 draws on across passes.
// Each pass renders into an offscreen canvas sized to the stroke's device-space bounds, never the full frame:
// a full-frame canvas per stroke made 4K frames several seconds each.
export function marker(ctx, passes, { w = 5, color = C.ink, seed = 1, progress = 1, wobble = 1, alpha = 0.94, taperEnd = 0.25 } = {}) {
  const dense = passes.map((p) => spline(p.length === 2 ? [p[0], [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2], p[1]] : p, false, 0.8));
  const lens = dense.map((p) => cum(p, false)); const total = lens.reduce((s, c) => s + c[c.length - 1], 0); let budget = total * Math.max(0, Math.min(1, progress));
  dense.forEach((pts, k) => {
    const c = lens[k], L = c[c.length - 1]; if (budget <= 0.5 || L < 0.5) {return;} const drawL = Math.min(L, budget); budget -= L;
    const wob = fbm1(seed + k * 17, Math.max(2, Math.round(L / 40)), 3, 0.5, false); const pres = fbm1(seed + k * 17 + 5, Math.max(2, Math.round(L / 30)), 2, 0.5, false);
    const nm = normals(pts, false); const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      if (c[i] > drawL) {break;} const u = c[i] / L; const off = wob(u) * w * 0.45 * wobble;
      const start = Math.min(1, c[i] / (w * 0.9) + 0.55), end = 1 - taperEnd * Math.max(0, (c[i] - (L - w * 2.5)) / (w * 2.5));
      const hw = w / 2 * (0.88 + 0.16 * pres(u)) * start * end;
      const x = pts[i][0] + nm[i][0] * off, y = pts[i][1] + nm[i][1] * off; left.push([x + nm[i][0] * hw, y + nm[i][1] * hw]); right.push([x - nm[i][0] * hw, y - nm[i][1] * hw]);
    }
    if (left.length < 2) {return;}
    const T = ctx.getTransform(); let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (const [px, py] of [...left, ...right]) { const X = T.a * px + T.c * py + T.e, Y = T.b * px + T.d * py + T.f; bx0 = Math.min(bx0, X); by0 = Math.min(by0, Y); bx1 = Math.max(bx1, X); by1 = Math.max(by1, Y); }
    const mg = Math.ceil(w * Math.hypot(T.a, T.b) + 3); bx0 = Math.floor(bx0 - mg); by0 = Math.floor(by0 - mg); bx1 = Math.ceil(bx1 + mg); by1 = Math.ceil(by1 + mg);
    const off = document.createElement('canvas'); off.width = Math.max(1, bx1 - bx0); off.height = Math.max(1, by1 - by0); const o = off.getContext('2d'); o.setTransform(T.a, T.b, T.c, T.d, T.e - bx0, T.f - by0);
    const poly = [...left, ...right.reverse()]; const pth = pathOf(poly);
    o.fillStyle = color; o.fill(pth);
    // round caps
    const a = [(left[0][0] + right[right.length - 1][0]) / 2, (left[0][1] + right[right.length - 1][1]) / 2]; const ra = Math.hypot(left[0][0] - a[0], left[0][1] - a[1]);
    o.beginPath(); o.arc(a[0], a[1], ra, 0, Math.PI * 2); o.fill();
    const e = [(left[left.length - 1][0] + right[0][0]) / 2, (left[left.length - 1][1] + right[0][1]) / 2]; const re = Math.hypot(left[left.length - 1][0] - e[0], left[left.length - 1][1] - e[1]);
    o.beginPath(); o.arc(e[0], e[1], re, 0, Math.PI * 2); o.fill();
    // streaks: thin lighter lines along the stroke direction (felt tip drag)
    o.save(); o.globalCompositeOperation = 'destination-out'; const r = rng(seed + k * 3 + 9);
    for (let s = 0; s < 3; s++) { const f = (r() - 0.5) * 0.7; o.strokeStyle = `rgba(0,0,0,${0.10 + r() * 0.12})`; o.lineWidth = w * (0.06 + r() * 0.08); o.beginPath(); left.forEach(([lx, ly], i) => { const rr = right[right.length - 1 - i]; if (!rr) {return;} const x = (lx + rr[0]) / 2 + (lx - rr[0]) * f, y = (ly + rr[1]) / 2 + (ly - rr[1]) * f; if (i) { o.lineTo(x, y); } else { o.moveTo(x, y); } }); o.stroke(); }
    o.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= alpha; ctx.drawImage(off, bx0, by0); ctx.restore();
  });
}
// Common doodle paths (piece units). Each returns passes for marker().
export const doodle = {
  // hand-drawn ellipse around a box, with overshoot past the start
  circle(x, y, w, h, seed = 1, over = 0.16) {
    const r = rng(seed); const cx = x + w / 2, cy = y + h / 2, rx = w / 2 + 10 + r() * 6, ry = h / 2 + 8 + r() * 5; const a0 = -2.4 + r() * 0.5; const n = 60; const pts = [];
    for (let i = 0; i <= n * (1 + over); i++) { const t = i / n; const a = a0 + t * Math.PI * 2; const k = 1 + (t > 1 ? (t - 1) * 0.35 : 0) + 0.03 * Math.sin(t * 7 + r()); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k - t * 4]); }
    const cut = Math.round(n * 0.97); return [pts.slice(0, cut + 1), pts.slice(cut - 2)];
  },
  underline(x, y, w, seed = 1) { const r = rng(seed); return [[[x - 4, y + r() * 2], [x + w * 0.5, y + 2 + r() * 2], [x + w + 8, y - 1 + r() * 3]]]; },
  arrow(x0, y0, x1, y1, seed = 1, bend = 0.18, head = 20) {
    const r = rng(seed); const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; const dx = x1 - x0, dy = y1 - y0; const L = Math.hypot(dx, dy);
    const c = [mx - dy * bend + (r() - 0.5) * 6, my + dx * bend + (r() - 0.5) * 6];
    const shaft = []; for (let i = 0; i <= 24; i++) { const t = i / 24; shaft.push([(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * c[0] + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * c[1] + t * t * y1]); }
    const a = Math.atan2(y1 - shaft[21][1], x1 - shaft[21][0]); const h = Math.min(head, L * 0.4);
    const h1 = [[x1 + Math.cos(a + 2.55) * h, y1 + Math.sin(a + 2.55) * h], [x1 + 1, y1]], h2 = [[x1 + 1, y1], [x1 + Math.cos(a - 2.6) * h * 1.05, y1 + Math.sin(a - 2.6) * h * 1.05]];
    return [shaft, h1, h2];
  },
  cross(x, y, s, seed = 1) { const r = rng(seed); return [[[x - s / 2, y - s / 2 + r() * 4], [x + s / 2 + r() * 4, y + s / 2]], [[x + s / 2, y - s / 2 - r() * 3], [x - s / 2 - r() * 3, y + s / 2 + r() * 3]]]; },
  tick(x, y, s, seed = 1) { const r = rng(seed); return [[[x - s * 0.5, y - s * 0.05], [x - s * 0.12, y + s * 0.38 + r() * 2], [x + s * 0.55, y - s * 0.5 + r() * 3]]]; },
  question(x, y, s, seed = 1) { const r = rng(seed); const pts = []; for (let i = 0; i <= 20; i++) { const a = -2.8 + i / 20 * 3.9; pts.push([x + Math.cos(a) * s * 0.32, y - s * 0.32 + Math.sin(a) * s * 0.3]); } pts.push([x, y + s * 0.12 + r()]); return [pts, [[x, y + s * 0.38], [x + 0.6, y + s * 0.42]]]; },
  squiggle(x, y, w, seed = 1) { const r = rng(seed); const p = []; for (let i = 0; i <= 18; i++) {p.push([x + w * i / 18, y + Math.sin(i * 1.4 + r()) * 4]);} return [p]; },
  star(x, y, s, seed = 1) { const r = rng(seed); return [[[x, y - s], [x + (r() - .5) * 2, y + s]], [[x - s, y], [x + s, y + (r() - .5) * 2]], [[x - s * .7, y - s * .7], [x + s * .7, y + s * .7]]]; },
};

// Hand-lettered label: each glyph with seeded tilt/offset; variant changes the jitter (boil).
export function lettering(ctx, text, x, y, { size = 40, font = '"Caveat Brush"', color = C.ink, seed = 1, variant = 0, jitter = 1, align = 'left', weight = '400' } = {}) {
  ctx.save(); ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
  const widths = [...text].map((ch) => ctx.measureText(ch).width); const total = widths.reduce((a, b) => a + b, 0) * 1.0;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const r = rng(seed * 7 + variant * 101);
  [...text].forEach((ch, i) => { const rot = (r() - 0.5) * 0.07 * jitter, dy = (r() - 0.5) * size * 0.05 * jitter, dx = (r() - 0.5) * size * 0.02 * jitter; ctx.save(); ctx.translate(cx + dx, y + dy); ctx.rotate(rot); ctx.fillText(ch, 0, 0); ctx.restore(); cx += widths[i]; });
  ctx.restore(); return total;
}

// A typewriter strip (caption paper): torn left/right ends, slightly uneven top/bottom.
export function stripOutline(w, h, seed = 1) {
  const r = rng(seed); const top = [], right = [], bot = [], left = [];
  const nT = Math.ceil(w / 14); for (let i = 0; i <= nT; i++) {top.push([w * i / nT, (r() - 0.5) * 1.2]);}
  const nR = Math.ceil(h / 5); for (let i = 1; i < nR; i++) {right.push([w + (r() - 0.3) * 7, h * i / nR]);}
  for (let i = nT; i >= 0; i--) {bot.push([w * i / nT, h + (r() - 0.5) * 1.2]);}
  for (let i = nR - 1; i > 0; i--) {left.push([(r() - 0.7) * 7, h * i / nR]);}
  return spline([...top, ...right, ...bot, ...left], true, 1.2);
}

// ── halftone ───────────────────────────────────────────────────────
// Print-like dot screen in the accent, sized by field(x,y)∈[0,1]; plus a fine ink stipple. Static.
export function halftone(ctx, W, H, field, { cell = 15, angle = 0.26, seed = 5, color = C.accent, stipple = true, S = 1 } = {}) {
  const r = rng(seed); ctx.save(); ctx.fillStyle = color;
  const ca = Math.cos(angle), sa = Math.sin(angle); const R = Math.hypot(W, H);
  for (let v = -R; v < R; v += cell) {for (let u = -R; u < R; u += cell) {
    const x = W / 2 + u * ca - v * sa, y = H / 2 + u * sa + v * ca; if (x < -cell || y < -cell || x > W + cell || y > H + cell) {continue;}
    const f = field(x / W, y / H); if (f <= 0.02) {continue;} const rad = Math.min(cell * 0.62, cell * 0.62 * Math.sqrt(f)) * (0.94 + r() * 0.12);
    ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(x + (r() - 0.5) * 0.6, y + (r() - 0.5) * 0.6, rad, rad * (0.93 + r() * 0.1), r() * 3, 0, Math.PI * 2); ctx.fill();
  }}
  if (stipple) { ctx.fillStyle = C.ink; const n = Math.round(W * H / 55); for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H; const f = field(x / W, y / H); if (r() > f * 0.8) {continue;} ctx.globalAlpha = 0.18 + r() * 0.3; ctx.beginPath(); ctx.arc(x, y, (0.5 + r() * 0.9) * S, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
}

// Device frames are not paper: the engine draws clean browser windows and a clean phone. Paper on every surface read as
// a theme, not a story. A photo-paper print with a white border and grain was tried and rejected in review.
