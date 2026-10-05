// rig.js – draws a jointed paper character or a bust with a consistent top-left light.
// Pieces come from the frozen kit (kit/png + manifest) as { img, meta } keyed `<id>.<part>`.
import { CAST, POSES, drawFace } from './puppet.js';
const D2R = Math.PI / 180;
// Paper shadow: small offset down-right, soft. Offsets are in device px, so pass the current device scale k
// (DPR × camera scale × piece scale); a fixed k makes shadows shrink when the camera zooms.
export function withShadow(ctx, k, fn, { lift = 1 } = {}) {
  ctx.save(); ctx.shadowColor = `rgba(24,20,14,${0.20 + 0.06 * (lift - 1)})`; ctx.shadowBlur = 5 * k * lift; ctx.shadowOffsetX = 1.6 * k * lift; ctx.shadowOffsetY = 3.2 * k * lift; fn(); ctx.restore();
}
export function drawPiece(ctx, pc, k, opts = {}) {
  if (!pc) {return;} withShadow(ctx, k, () => ctx.drawImage(pc.img, pc.meta.x, pc.meta.y, pc.meta.w, pc.meta.h), opts);
}
// lerp two poses (angles only; discrete keys such as hand shapes and faces switch at u >= 0.5)
export function mixPose(a, b, u) {
  const A = POSES[a] || a, B = POSES[b] || b; const out = {};
  for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) { const va = A[key] ?? B[key], vb = B[key] ?? A[key]; out[key] = typeof va === 'number' ? va + (vb - va) * u : (u < 0.5 ? va : vb); }
  return out;
}
// The full-body rig. Each node: piece (or hand/face slot), parent, attach point in parent space, z, joint angle key.
const RIGS = {};
export function fullRig(id) {
  if (RIGS[id]) {return RIGS[id];} const p = (n) => `${id}.${n}`;
  return (RIGS[id] = [
    { id: 'hairBack', piece: p('hairBack'), parent: 'head', at: [0, 0], z: 1 },
    { id: 'legL', piece: p('legL'), parent: 'root', at: [-27, -4], z: 2, ang: 'legL' },
    { id: 'legR', piece: p('legR'), parent: 'root', at: [27, -4], z: 2, ang: 'legR' },
    { id: 'shoeL', piece: p('shoeL'), parent: 'legL', at: [-2, 210], z: 3 },
    { id: 'shoeR', piece: p('shoeR'), parent: 'legR', at: [2, 210], z: 3, flip: true },
    { id: 'torso', piece: p('torso'), parent: 'root', at: [0, 0], z: 4, ang: 'torso' },
    { id: 'neck', piece: p('neck'), parent: 'torso', at: [0, -192], z: 5 },
    { id: 'head', piece: p('head'), parent: 'torso', at: [0, -194], z: 6, ang: 'head', scale: 1.16 },
    { id: 'hairFront', piece: p('hairFront'), parent: 'head', at: [0, 0], z: 8 },
    { id: 'face', face: true, parent: 'head', at: [0, 0], z: 9 },
    { id: 'upperL', piece: p('upperArmL'), parent: 'torso', at: [-74, -172], z: 10, ang: 'shL' },
    { id: 'upperR', piece: p('upperArmR'), parent: 'torso', at: [74, -172], z: 10, ang: 'shR' },
    { id: 'foreL', piece: p('foreArmL'), parent: 'upperL', at: [0, 92], z: 11, ang: 'elL' },
    { id: 'foreR', piece: p('foreArmR'), parent: 'upperR', at: [0, 92], z: 11, ang: 'elR' },
    { id: 'handL', hand: 'L', parent: 'foreL', at: [0, 90], z: 12, ang: 'wrL' },
    { id: 'handR', hand: 'R', parent: 'foreR', at: [0, 90], z: 12, ang: 'wrR', flip: true },
    { id: 'pinSL', piece: 'pin', parent: 'upperL', at: [0, 0], z: 13 },
    { id: 'pinSR', piece: 'pin', parent: 'upperR', at: [0, 0], z: 13 },
    { id: 'pinEL', piece: 'pin', parent: 'foreL', at: [0, 0], z: 13 },
    { id: 'pinER', piece: 'pin', parent: 'foreR', at: [0, 0], z: 13 },
  ]);
}
// Draw a full-body character with its hip centre at the current origin. pose = POSES key or a pose object.
export function drawCharacter(ctx, pieces, id, pose, { k = 1, variant = 0, look = [0, 0], blink = false } = {}) {
  const ch = CAST[id]; if (!ch || ch.kind !== 'full') {throw new Error(`drawCharacter: ${id} is not a full-body CAST entry`);}
  const P = typeof pose === 'string' ? POSES[pose] : pose; const rig = fullRig(id); const M = {};
  const base = ctx.getTransform();
  const node = (n) => {
    if (M[n.id]) {return M[n.id];}
    const parent = n.parent === 'root' ? base : node(rig.find((x) => x.id === n.parent));
    let m = DOMMatrix.fromMatrix(parent).translate(n.at[0], n.at[1]).rotate((P[n.ang] || 0)); if (n.scale) {m = m.scale(n.scale, n.scale);}
    M[n.id] = m; return m;
  };
  rig.forEach(node);
  for (const n of [...rig].sort((a, b) => a.z - b.z)) {
    ctx.save(); ctx.setTransform(M[n.id]); if (n.flip) {ctx.scale(-1, 1);}
    if (n.face) {drawFace(ctx, P.face || 'smile', { variant, look, blink, glasses: !!ch.glasses, seed: ch.seed + 800 });}
    else {drawPiece(ctx, pieces[n.hand ? `${id}.${n.hand === 'L' ? P.handL : P.handR}` : n.piece], k);}
    ctx.restore();
  }
}
// Bust (head and shoulders), origin at the bottom centre of the shoulders: hair behind, shoulders, head, hair, face.
export function drawBust(ctx, pieces, id, { k = 1, face = 'smile', variant = 0, look = [0, 0], blink = false, headTilt = 0 } = {}) {
  const ch = CAST[id]; if (!ch) {throw new Error(`drawBust: no CAST entry ${id}`);}
  const part = (n) => pieces[`${id}.${n}`];
  const head = () => { ctx.save(); ctx.translate(0, -228); ctx.rotate(headTilt * D2R); };
  if (part('hairBack')) { head(); drawPiece(ctx, part('hairBack'), k); ctx.restore(); }
  drawPiece(ctx, part('bust'), k);
  head(); drawPiece(ctx, part('head'), k); drawPiece(ctx, part('hairFront'), k);
  drawFace(ctx, face, { variant, look, blink, glasses: !!ch.glasses, seed: ch.seed + 800 }); ctx.restore();
}
