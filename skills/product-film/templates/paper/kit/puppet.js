// puppet.js – the cut-paper cast: part outlines, the CAST registry, poses and faces.
// Units: puppet px at scale 1 (a full-body character is about 620 tall). Root = hip centre. y points down.
// Angles in degrees, clockwise positive. An arm at 0° hangs straight down.
//
// ADD A CHARACTER: add one entry to CAST, run `node <film>/kit/build-kit.mjs`, and look at
// the contact sheet (`node <film>/kit/build-sheet.mjs`). Every piece is named `<id>.<part>`, so two characters can
// never overwrite each other's pieces (export.html also refuses duplicate names).
//   kind:    'full' = jointed full body that takes POSES (the hero); 'bust' = head and shoulders (supporting cast)
//   skin:    one of C.skin1…C.skin5; hair: [style, colour] with style from HAIR (bob, long, curls, short)
//   top:     garment colour; sleeves (full only, defaults to top); legs, shoes (full only)
//   pattern: optional [kind, colour]: 'stripes' | 'vneck'
//   glasses: marker glasses on the face; seed: base seed (keep each character's seed 100 apart)
// ADD A POSE: add joint angles to POSES (shL/shR shoulders, elL/elR elbows, wrL/wrR wrists, head, torso,
// legL/legR, hand shapes handOpen | handPoint | handFist, and a face from FACES). Check it on the contact sheet.
// Give a character muted colour; faces, glasses and hands' details stay marker ink.
import { C, spline, roundPoly, ellipsePts, paperPiece, marker, rng } from './kit.js';

// ── outlines ────────────────────────────────────────────────────────
export const OUT = {
  torso: () => spline([[0, -195], [30, -201], [70, -190], [86, -168], [82, -128], [70, -76], [66, -34], [72, 6], [0, 10], [-72, 6], [-66, -34], [-70, -76], [-82, -128], [-86, -168], [-70, -190], [-30, -201]], true, 1),
  neck: () => roundPoly([[-15, -30], [15, -30], [16, 8], [-16, 8]], 5),
  head: () => spline([[0, -150], [44, -140], [64, -100], [62, -56], [48, -20], [22, 0], [0, 4], [-22, 0], [-48, -20], [-62, -56], [-64, -100], [-44, -140]], true, 1),
  upperArm: () => roundPoly([[-21, -18], [21, -18], [19, 106], [-19, 106]], [16, 16, 12, 12]),
  foreArm: () => roundPoly([[-19, -14], [19, -14], [17, 96], [-17, 96]], [12, 12, 8, 8]),
  leg: () => roundPoly([[-27, -6], [27, -6], [24, 214], [-22, 214]], [6, 6, 4, 4]),
  shoe: () => spline([[-14, -6], [16, -8], [24, 4], [22, 20], [-40, 22], [-50, 14], [-44, 2], [-26, -2]], true, 1),
  handOpen: () => spline([[-14, -6], [14, -6], [18, 12], [26, 18], [30, 28], [22, 32], [16, 28], [16, 40], [8, 52], [-8, 54], [-16, 44], [-18, 20]], true, 1),
  handPoint: () => spline([[-14, -6], [14, -6], [16, 16], [8, 30], [6, 58], [0, 66], [-6, 60], [-8, 38], [-16, 36], [-18, 18]], true, 1),
  handFist: () => spline([[-15, -6], [15, -6], [19, 14], [18, 30], [8, 38], [-10, 38], [-19, 28], [-19, 12]], true, 1),
  bust: () => spline([[0, -226], [30, -232], [72, -218], [96, -184], [104, -120], [106, -60], [0, -58], [-106, -60], [-104, -120], [-96, -184], [-72, -218], [-30, -232]], true, 1),
  pin: () => ellipsePts(0, 0, 7.5, 7.5, 0.6),
};
// Hair in head space (head origin = neck point). back = behind the head, front = over it. null = none.
export const HAIR = {
  bob: {
    back: () => spline([[-70, -112], [-60, -150], [0, -166], [60, -150], [72, -110], [74, -50], [66, -22], [44, -30], [-44, -30], [-68, -22], [-76, -50]], true, 1),
    front: () => spline([[-68, -104], [-58, -146], [-10, -170], [44, -158], [70, -120], [70, -84], [56, -106], [34, -130], [12, -123], [-18, -127], [-40, -121], [-58, -98], [-66, -70]], true, 1),
  },
  long: {
    back: () => spline([[-66, -118], [-54, -156], [0, -170], [54, -156], [68, -118], [76, -40], [84, 26], [60, 46], [30, 30], [-30, 30], [-60, 46], [-84, 26], [-76, -40]], true, 1),
    front: () => spline([[-66, -100], [-52, -150], [0, -170], [52, -152], [66, -104], [58, -96], [30, -128], [-6, -132], [-40, -116], [-60, -86]], true, 1),
  },
  curls: {
    back: null,
    front: (seed = 71) => { const pts = []; const r = rng(seed); for (let i = 0; i < 18; i++) { const a = Math.PI * 0.92 + i / 17 * Math.PI * 1.16; const R = 78 + (i % 2 ? 10 : -2) + r() * 6; pts.push([Math.cos(a) * R, -88 + Math.sin(a) * R * 0.92]); } pts.push([60, -54], [36, -104], [-30, -110], [-62, -54]); return spline(pts, true, 1); },
  },
  short: {
    back: null,
    front: () => spline([[-66, -92], [-62, -138], [-22, -166], [28, -165], [62, -140], [68, -92], [58, -106], [40, -126], [10, -133], [-24, -129], [-50, -113]], true, 1),
  },
};

// ── the cast (EXAMPLE: the example story's three characters, named by role: hero = Maya, teammate, client = Jordan) ──
export const CAST = {
  hero: { kind: 'full', skin: C.skin1, hair: ['bob', C.hairBrown], top: C.mustard, sleeves: C.mustardDeep, legs: C.charcoal, shoes: C.off, glasses: true, seed: 100 },
  teammate: { kind: 'bust', skin: C.skin2, hair: ['long', C.hairBlack], top: C.coral, pattern: ['stripes', C.stripe], glasses: false, seed: 200 },
  client: { kind: 'bust', skin: C.skin3, hair: ['curls', C.hairAuburn], top: C.plum, pattern: ['vneck', 'oklch(0.9 0.01 85)'], glasses: false, seed: 300 },
};

// ── pieces a kit build freezes to PNG ────────────────────────────────
// name → { out, color, seed, draw?, clipDraw?, fibre?, amp? }; draw adds marker details that belong to the paper.
const handDetails = {
  handOpen: (c, s) => marker(c, [[[-6, 38], [-7, 48]], [[2, 40], [1, 50]]], { w: 1.6, seed: s, alpha: 0.7 }),
  handPoint: (c, s) => marker(c, [[[-10, 30], [-2, 32]]], { w: 1.6, seed: s, alpha: 0.7 }),
  handFist: (c, s) => marker(c, [[[-10, 22], [12, 22]], [[-8, 30], [10, 30]]], { w: 1.6, seed: s, alpha: 0.7 }),
};
function topPattern(ch) {
  const [kind, col] = ch.pattern || [];
  if (kind === 'stripes') {return { clipDraw: (c) => { for (let y = -214; y < 12; y += 22) {marker(c, [[[-110, y], [110, y + 2]]], { w: 7, seed: ch.seed + 300 + y, color: col, alpha: 0.9, wobble: 0.6 });} } };}
  if (kind === 'vneck') {return { draw: (c) => marker(c, [[[-30, -226], [0, -200], [30, -226]]], { w: 3, seed: ch.seed + 16, color: col }) };}
  return {};
}
export function castPieces() {
  const out = {};
  const add = (name, spec) => { if (out[name]) {throw new Error(`duplicate kit piece ${name}`);} out[name] = spec; };
  for (const [id, ch] of Object.entries(CAST)) {
    const s = ch.seed; const [hairStyle, hairCol] = ch.hair; const H = HAIR[hairStyle]; if (!H) {throw new Error(`${id}: unknown hair ${hairStyle}`);}
    add(`${id}.head`, { out: OUT.head, color: ch.skin, seed: s + 3 });
    if (H.back) {add(`${id}.hairBack`, { out: H.back, color: hairCol, seed: s + 4 });}
    add(`${id}.hairFront`, { out: () => H.front(s + 71), color: hairCol, seed: s + 5 });
    for (const [k, i] of [['handOpen', 10], ['handPoint', 11], ['handFist', 12]]) {add(`${id}.${k}`, { out: OUT[k], color: ch.skin, seed: s + i, draw: (c) => handDetails[k](c, s + i) });}
    add(`${id}.bust`, { out: OUT.bust, color: ch.top, seed: s + 1, ...topPattern(ch) });   // every character can appear as a bust
    if (ch.kind === 'bust') {continue;}
    const pat = topPattern(ch);
    add(`${id}.torso`, { out: OUT.torso, color: ch.top, seed: s + 1, clipDraw: pat.clipDraw, draw: (c) => { marker(c, [[[-26, -194], [0, -181], [26, -194]]], { w: 2.6, seed: s + 5 }); marker(c, [[[-44, -34], [-12, -32]], [[12, -32], [44, -34]]], { w: 2.2, seed: s + 6, alpha: 0.55 }); } });
    add(`${id}.neck`, { out: OUT.neck, color: ch.skin, seed: s + 2 });
    const sl = ch.sleeves || ch.top;
    add(`${id}.upperArmL`, { out: OUT.upperArm, color: sl, seed: s + 6 }); add(`${id}.upperArmR`, { out: OUT.upperArm, color: sl, seed: s + 16 });
    add(`${id}.foreArmL`, { out: OUT.foreArm, color: sl, seed: s + 7, draw: (c) => marker(c, [[[-16, 80], [16, 80]]], { w: 2, seed: s + 7, alpha: 0.5 }) });
    add(`${id}.foreArmR`, { out: OUT.foreArm, color: sl, seed: s + 17, draw: (c) => marker(c, [[[-16, 80], [16, 80]]], { w: 2, seed: s + 8, alpha: 0.5 }) });
    add(`${id}.legL`, { out: OUT.leg, color: ch.legs || C.charcoal, seed: s + 8 }); add(`${id}.legR`, { out: OUT.leg, color: ch.legs || C.charcoal, seed: s + 18 });
    const shoeDraw = (k) => (c) => { marker(c, [[[-46, 14], [20, 14]]], { w: 2.2, seed: s + 9 + k }); marker(c, [[[-12, 0], [-4, 6]], [[-4, -2], [4, 4]]], { w: 1.8, seed: s + 10 + k }); };
    add(`${id}.shoeL`, { out: OUT.shoe, color: ch.shoes || C.off, seed: s + 9, draw: shoeDraw(0) }); add(`${id}.shoeR`, { out: OUT.shoe, color: ch.shoes || C.off, seed: s + 19, draw: shoeDraw(2) });
  }
  add('pin', { out: OUT.pin, color: C.metal, seed: 113, fibre: false, amp: 0.25, draw: (c) => { c.save(); c.strokeStyle = 'rgba(60,54,44,0.55)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-4.4, 1.2); c.lineTo(4.4, -1.2); c.stroke(); c.strokeStyle = 'rgba(255,255,250,0.7)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 5.8, 3.6, 5.2); c.stroke(); c.strokeStyle = 'rgba(50,44,36,0.35)'; c.lineWidth = 0.8; c.beginPath(); c.arc(0, 0, 7.2, 0, Math.PI * 2); c.stroke(); c.restore(); } });
  return out;
}
export function buildPiece(spec, S = 3) {
  return paperPiece(spec.out(), { color: spec.color, seed: spec.seed, S, draw: spec.draw, clipDraw: spec.clipDraw, fibre: spec.fibre !== false, amp: spec.amp ?? 2.0 });
}

// ── poses: joint angles + hand shapes + face. L = the arm on screen left. ──
export const POSES = {
  stand:   { shL: 7, elL: -5, shR: -7, elR: 5, head: 0, torso: 0, handL: 'handOpen', handR: 'handOpen', wrL: 0, wrR: 0, face: 'smile' },
  present: { shL: 7, elL: -5, shR: -58, elR: -38, head: 3, torso: -1, handL: 'handOpen', handR: 'handOpen', wrL: 0, wrR: -30, face: 'grin' },
  point:   { shL: 7, elL: -5, shR: -118, elR: -12, head: 4, torso: -1.5, handL: 'handOpen', handR: 'handPoint', wrL: 0, wrR: 0, face: 'smile' },
  shrug:   { shL: 40, elL: 100, shR: -40, elR: -100, head: 7, torso: 0, handL: 'handOpen', handR: 'handOpen', wrL: 150, wrR: -150, face: 'worried' },
  think:   { shL: 7, elL: -5, shR: 34, elR: 138, head: -6, torso: 1, handL: 'handOpen', handR: 'handFist', wrL: 0, wrR: 0, face: 'hmm' },
  cheer:   { shL: 152, elL: 12, shR: -152, elR: -12, head: -3, torso: 0, handL: 'handOpen', handR: 'handOpen', wrL: 170, wrR: -170, face: 'grin' },
  wave:    { shL: 7, elL: -5, shR: -142, elR: -26, head: 3, torso: 0, handL: 'handOpen', handR: 'handOpen', wrL: 0, wrR: 180, face: 'grin' },
};

// Faces: marker details drawn in head space (the face centre is about y −78).
export const FACES = {
  smile:   { brows: [[-38, -100, -14, -104], [14, -104, 38, -100]], mouth: [[-15, -40], [0, -32], [15, -40]] },
  grin:    { brows: [[-38, -104, -14, -108], [14, -108, 38, -104]], mouth: [[-17, -42], [0, -28], [17, -42]], open: true },
  flat:    { brows: [[-38, -100, -14, -100], [14, -100, 38, -100]], mouth: [[-12, -36], [12, -36]] },
  worried: { brows: [[-38, -98, -14, -106], [14, -106, 38, -98]], mouth: [[-14, -34], [-5, -38], [5, -33], [14, -37]] },
  hmm:     { brows: [[-38, -104, -14, -102], [14, -106, 38, -110]], mouth: [[-4, -36], [12, -38]] },
  o:       { brows: [[-38, -108, -14, -112], [14, -112, 38, -108]], mouth: 'o' },
};
// variant = boil index (0–2), look = [dx,dy] gaze in −1..1, blink draws closed eyes
export function drawFace(ctx, kind, { variant = 0, look = [0, 0], glasses = true, seed = 900, blink = false } = {}) {
  const F = FACES[kind] || FACES.smile; const s = seed + variant * 13;
  const eyeY = -74, ex = 23;
  if (glasses) {
    for (const sx of [-1, 1]) { const pts = []; for (let i = 0; i <= 40; i++) { const a = -2.2 + i / 40 * Math.PI * 2.08; pts.push([sx * ex + Math.cos(a) * 17, eyeY + Math.sin(a) * 15.5]); } marker(ctx, [pts], { w: 2.8, seed: s + sx * 3 }); }
    marker(ctx, [[[-6, eyeY - 3], [0, eyeY - 6], [6, eyeY - 3]]], { w: 2.4, seed: s + 7 });
  }
  if (blink) { marker(ctx, [[[-ex - 6, eyeY], [-ex + 6, eyeY]], [[ex - 6, eyeY], [ex + 6, eyeY]]], { w: 3, seed: s + 5 }); }
  else { ctx.save(); ctx.fillStyle = C.ink; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * ex + look[0] * 5, eyeY + look[1] * 4, 4.6, 5.2, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  for (const b of F.brows) {marker(ctx, [[[b[0], b[1]], [(b[0] + b[2]) / 2, Math.min(b[1], b[3]) - 3], [b[2], b[3]]]], { w: 3.2, seed: s + b[0] });}
  marker(ctx, [[[-1, -64], [-5, -52], [2, -50]]], { w: 2.4, seed: s + 21 }); // nose
  if (F.mouth === 'o') { const pts = []; for (let i = 0; i <= 26; i++) { const a = i / 26 * Math.PI * 2.1; pts.push([Math.cos(a) * 6, -36 + Math.sin(a) * 7.5]); } marker(ctx, [pts], { w: 2.8, seed: s + 30 }); }
  else if (F.open) { ctx.save(); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(F.mouth[0][0], F.mouth[0][1]); ctx.quadraticCurveTo(0, -18, F.mouth[2][0], F.mouth[2][1]); ctx.quadraticCurveTo(0, -36, F.mouth[0][0], F.mouth[0][1]); ctx.fill(); ctx.restore(); marker(ctx, [F.mouth.map((p, i) => i === 1 ? [p[0], p[1] + 1] : p)], { w: 2.6, seed: s + 31 }); }
  else {marker(ctx, [F.mouth], { w: 2.8, seed: s + 32 });}
}
