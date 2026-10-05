// film.js – the scenes. EXAMPLE CONTENT: a five-scene Tidewell story (the plan sits in drafts → the agent publishes
// and shares it → the client opens it on a phone with a one-time code and asks for May → v2 at the same link → end
// card). Replace the scenes with your story; keep the patterns.
// Rules: positions are per format via V({...}); times come from timeline.json cues (s.cue('name')); words come from
// timeline labels (LB('key')); every shot a scene draws is listed in its shots() so it is preloaded.
//
// Primitives shown here:   print (browser / raw window)  phone  bust  character (poses, blinks, look)  captions
//   label  note (arrow + label)  ink(doodle.*)  piece (bubble, tag)  cursor + pathAt + click  tap  swapAt (lift and
//   land)  stateAt  cam / zoomTo / camOn (one camera move onto the item, then back)  hop (carry the hero across a cut)
//   slideIn / slideOut  wordmark (flat end card)
import { C, doodle } from '../kit/kit.js';
import { FMT, V, SCENES, ctx, E, ramp, stateAt, box, print, phone, phoneBox, character, bust, cursor, piece, label, ink,
  pathAt, cam, CAM0, zoomTo, layoutBox, boxWorld, LB, swapAt, tap, note, slideIn, slideOut, hop, wordmark, start } from './engine.js';

// ── EXAMPLE story constants (from capture/story.json) ──
const URL_PAGE = 'tidewell.example/p/r8Kd2m';
const URL_DRAFT = 'app.tidewell.example/drafts/spring-launch-plan';
const DRAFT = 'page-draft.png';                                      // the page as a raw draft, before publishing
const AG = FMT === '9x16' ? 'agentn' : 'agent';                      // the agent window has a narrow variant for 9:16
const agentShot = (i) => `${AG}-${String(i).padStart(2, '0')}.png`;
const VIEW_CROP = [0, 0, 1280, 720];

// ── S1 · hook and problem: the hero presents the draft, then wonders. Frame 0 is the thumbnail: it reads without motion. ──
const L1 = V({
  '16x9': { pr: { x: 780, y: 140, w: 1060 }, hero: [420, 676, 0.98] },
  '9x16': { pr: { x: 26, y: 300, w: 880 }, hero: [250, 1030, 0.64], pose: 'point' },
  '4x5': { pr: { x: 250, y: 90, w: 790 }, hero: [175, 760, 0.76] },
});
const draftWindow = (x, y, w) => print({ shot: DRAFT, crop: VIEW_CROP, x, y, w, url: URL_DRAFT, rot: -0.008 });
SCENES.s1 = {
  post: 0,                        // stop drawing at the cut: s2 carries the window and the hero from here
  shots: () => [DRAFT],
  draw(t, s) {
    cam(CAM0());
    draftWindow(L1.pr.x, L1.pr.y, L1.pr.w);
    const [hx, hy, hs] = L1.hero;
    character('hero', hx, hy, hs, t, [[0, L1.pose || 'present'], [s.cue('think'), 'think', 0.4]], { blinks: [s.cue('blink')], look: [0.6, -0.3] });
    ink(doodle.question(hx + 120 * hs, hy - 440 * hs, 96 * hs, 7), { w: 6, progress: ramp(t, s.cue('question'), 0.35), seed: 31 });
  },
};

// ── S2 · the agent publishes and shares it (a neutral agent window: no tool name, no logos) ──
const L2 = V({
  '16x9': { pr: { x: 330, y: 96, w: 1240, kind: 'raw', crop: [0, 0, 1200, 582] }, hero: [175, 720, 0.7], zU: 1.6 },
  '9x16': { pr: { x: 26, y: 270, w: 880, kind: 'raw', crop: [0, 0, 720, 652] }, hero: [150, 1215, 0.42], zU: 1.85, below: true },
  '4x5': { pr: { x: 40, y: 160, w: 1000, kind: 'raw', crop: [0, 0, 1200, 582] }, hero: [150, 1070, 0.48], zU: 1.4, below: true },
});
SCENES.s2 = {
  post: 0.5,
  shots: () => [DRAFT, ...[1, 2, 3, 4, 5].map(agentShot)],
  draw(t, s) {
    const A = L2.pr; const urlW = layoutBox(A, box(agentShot(5), 'url1'), 4);      // the URL's world box, before drawing
    cam(zoomTo(t, s.cue('zoom'), s.cue('zoomOut'), urlW, L2.zU));                    // one move onto the item, then back
    // CARRY: the s1 window is drawn by this scene only (s1 stopped at the cut). It leaves as the agent window arrives.
    if (t < s.start + 0.45) { const [ox] = slideOut(t, s.start, 0.4, [-2400, 0]); draftWindow(L1.pr.x + ox, L1.pr.y, L1.pr.w); }
    // The agent window slides in with the prompt already there (an empty window on screen reads as a mistake).
    const st = stateAt(t, [[0, agentShot(1)], [s.cue('typing'), agentShot(2)], [s.cue('pub'), agentShot(3)], [s.cue('done'), agentShot(4)], [s.cue('result'), agentShot(5)]]);
    const [dx, dy, r] = slideIn(t, s.start, 0.4, [2400, 0], 0.03); const out = slideOut(t, s.end, 0.4, [-2600, 0]);
    ctx.save(); ctx.translate(dx + out[0], dy); ctx.rotate(r);
    print({ shot: st, crop: A.crop, x: A.x, y: A.y, w: A.w, kind: 'raw' });
    if (FMT === '9x16') {ink(doodle.underline(urlW[0] + 2, urlW[1] + urlW[3] + 5, urlW[2] - 8, 12), { w: 7, color: C.accent, progress: ramp(t, s.cue('circle'), 0.35), seed: 61 });}
    else {ink(doodle.circle(urlW[0] - 6, urlW[1] - 2, urlW[2] + 12, urlW[3] + 4, 12), { w: 6, color: C.accent, progress: ramp(t, s.cue('circle'), 0.45), seed: 61 });}
    // The label lands outside the zoomed area, or the zoom crops it.
    if (L2.below) {note(LB('s2.one'), urlW[0] + urlW[2] - 150, urlW[1] + urlW[3] + 70, urlW[0] + urlW[2] - 60, urlW[1] + urlW[3] + 10, t, s.cue('one'), { size: 52, color: C.accent, bend: 0.2 });}
    else {note(LB('s2.one'), urlW[0] + urlW[2] + 120, urlW[1] + urlW[3] * 0.5, urlW[0] + urlW[2] + 26, urlW[1] + urlW[3] * 0.5, t, s.cue('one'), { size: 56, color: C.accent, bend: 0.12, side: 'right' });}
    ctx.restore();
    // CARRY: the same hero walks over (stepped hops) from where s1 left her, then leaves with the window.
    const [hx, hy, hs] = hop(t, s.start, 0.5, L1.hero, L2.hero);
    character('hero', hx + out[0], hy, hs, t, [[0, 'think'], [s.start + 0.2, 'stand'], [s.cue('circle'), 'point', 0.4]], { look: [0.6, -0.3], blinks: [s.cue('typing') + 1.1] });
  },
};

// ── S3 · the client opens the link on a phone: invited sign-in → one-time code (all six digits) → the page → a question ──
const L3 = V({
  '16x9': { ph: { x: 780, y: 80, s: 1.0 }, client: [1480, 1130, 1.2], z: 1.7, bubble: [1150, 380, 1.7], tag: [1610, 800, 1] },
  '9x16': { ph: { x: 230, y: 290, s: 1.0 }, client: [790, 1235, 0.78], z: 1.45, bubble: [662, 760, 1.1], tag: [668, 680, 0.85] },
  '4x5': { ph: { x: 380, y: 20, s: 1.02 }, client: [940, 1330, 0.95], z: 1.5, bubble: [440, 890, 1.45], tag: [830, 880, 0.85] },
});
const PH_STATES = (s) => [[0, 'phone-signin.png'], [s.cue('otp'), 'phone-otp-0.png'], [s.cue('d5'), 'phone-otp-5.png'], [s.cue('d6'), 'phone-otp-6.png'], [s.cue('verified'), 'phone-verified.png'], [s.cue('opening'), 'phone-opening.png'], [s.cue('open'), 'phone-page-v1.png']];
SCENES.s3 = {
  post: 0.5,
  shots: () => ['phone-signin.png', 'phone-otp-0.png', 'phone-otp-5.png', 'phone-otp-6.png', 'phone-verified.png', 'phone-opening.png', 'phone-page-v1.png'],
  draw(t, s) {
    const cb = box('phone-otp-5.png', 'card'); const card = phoneBox(L3.ph, [cb[0], cb[1] - 40, cb[2], cb[3] + 80]);
    cam(zoomTo(t, s.cue('zoom'), s.cue('zoomOut'), card, L3.z));
    const [dx, dy, r] = slideIn(t, s.start, 0.4, [1800, 0], 0.05); const out = slideOut(t, s.end, 0.4, [-2600, 0]);
    ctx.save(); ctx.translate(dx + out[0], dy);
    bust('client', ...L3.client, { face: t > s.cue('open') ? 'grin' : 'smile', look: [-0.8, -0.2] });
    const ph = { ...L3.ph, shot: stateAt(t, PH_STATES(s)), rot: r * 0.3 }; phone(ph);
    piece('client.handOpen', ph.x + 440 * ph.s, ph.y + 520 * ph.s, { rot: 1.75, s: 1.6 * ph.s, flip: true });   // the client's hand on the phone
    const send = phoneBox(ph, box('phone-signin.png', 'sendCode')); tap(send[0] + send[2] / 2, send[1] + send[3] / 2, t, s.cue('tap'));
    if (t >= s.cue('otp') && t < s.cue('verified')) { const c = phoneBox(ph, cb); label(LB('s3.noacct'), c[0] + c[2] / 2, c[1] + c[3] + 56, { size: 46, write: ramp(t, s.cue('noacct'), 0.35), rot: -0.02, align: 'center', color: C.accent }); }
    // A name tag tells the viewer who this is; it arrives after the zoom, so it never sits over the zoomed card.
    if (t >= s.cue('zoomOut') + 0.3) { const [tx, ty, ts] = L3.tag; piece('tag', tx, ty, { s: ts, rot: -0.03 }); label(LB('s3.tag'), tx + 22 * ts, ty + 48 * ts, { size: 38 * ts, rot: -0.03 }); }
    // The question that causes v2: a paper speech bubble with hand lettering, dropped in on two stepped poses.
    if (t >= s.cue('ask')) {
      const [bx, by, bs] = L3.bubble; const u = t - s.cue('ask'); const drop = u < 2 / 30 ? 14 : u < 4 / 30 ? 5 : 0;
      piece('bubbleB', bx, by + drop, { s: bs, rot: 0.02, lift: drop ? 1.6 : 1 });
      label(LB('s3.ask'), bx + 118 * bs, by + drop + 52 * bs, { size: 22 * bs, align: 'center', rot: 0.02, write: ramp(t, s.cue('ask') + 0.15, 0.4) });
    }
    ctx.restore();
  },
};

// ── S4 · v2 at the same link: the pointer clicks Refresh, the print is replaced (lift and land), zoom onto the change ──
const L4 = V({ '16x9': { x: 250, y: 110, w: 1300 }, '9x16': { x: -20, y: 290, w: 1700 }, '4x5': { x: 20, y: 150, w: 1040 } });
const urlEnd = (pr) => { ctx.save(); ctx.font = '500 16px "Geist Mono"'; const w = ctx.measureText(URL_PAGE).width; ctx.restore(); return [pr.ox + 130 + w, pr.oy - 23]; };
SCENES.s4 = {
  post: 0.35,
  shots: () => ['page-v1-refresh.png', 'page-v2.png'],
  draw(t, s) {
    const L = { ...L4, crop: VIEW_CROP };
    const dateW = layoutBox(L, box('page-v2.png', 'kickoffDateInk', 'kickoffDate'), 30);
    cam(zoomTo(t, s.cue('zoom'), s.cue('zoomOut'), dateW, FMT === '9x16' ? 1.45 : 1.7));
    const [dx, dy] = slideIn(t, s.start, 0.4, [0, 1300], 0.03);
    const gone = t >= s.end; if (gone && t >= s.end + 2 / 30) {return;}   // the window leaves (stepped) before the end card fades in
    const sw = swapAt(t, [[0, 'page-v1-refresh.png'], [s.cue('swap'), 'page-v2.png']]);
    ctx.save(); ctx.translate(dx, dy + (gone ? 30 : 0));
    const pr = print({ shot: sw.shot, crop: VIEW_CROP, x: L.x, y: L.y + sw.dy, w: L.w, url: URL_PAGE, lift: gone ? 1.6 : sw.lift });
    const rb = boxWorld(pr, box('page-v1-refresh.png', 'refreshButton'));
    if (t < s.cue('swap') + 0.3) { const [px, py] = pathAt(t, [[s.cue('in') + 0.3, rb[0] + rb[2] * 0.4, rb[1] + 200], [s.cue('click') - 0.1, rb[0] + rb[2] * 0.4, rb[1] + rb[3] * 0.6, 'io']]); cursor(px, py, { t, clickAt: s.cue('click') }); }
    if (t >= s.cue('swap')) {
      const dw = boxWorld(pr, box('page-v2.png', 'kickoffDateInk', 'kickoffDate'), 6);
      ink(doodle.circle(dw[0], dw[1], dw[2], dw[3], 21), { w: 7, color: C.accent, progress: ramp(t, s.cue('circle'), 0.4), seed: 71 });
      if (FMT === '9x16') { const [ex, uy] = urlEnd(pr); note(LB('s4.same'), ex + 70, uy + 6, ex + 8, uy + 2, t, s.cue('same'), { size: 46, bend: 0.1, side: 'right' }); }
      else { const ux = pr.ox + 260, uy = pr.oy - 26; note(LB('s4.same'), ux + 140, uy - 64, ux + 40, uy - 6, t, s.cue('same'), { size: 50, bend: 0.25 }); }
    }
    ctx.restore();
  },
};

// ── S5 · end card: flat (no paper card, no tape, no puppet) on the chart plate ──
const L5 = V({ '16x9': { cx: 960, cy: 470, s: 1.25 }, '9x16': { cx: 465, cy: 760, s: 1.1 }, '4x5': { cx: 540, cy: 600, s: 1.3 } });
SCENES.s5 = {
  pre: 0, post: 0,
  draw(t, s) {
    cam(CAM0());
    const u = E.out(ramp(t, s.start + 0.3, 0.35)); if (u <= 0) {return;} const { cx, cy, s: sc } = L5;
    ctx.save(); ctx.globalAlpha = u; ctx.translate(cx, cy + (1 - u) * 24); ctx.scale(sc, sc);
    wordmark(0, -250, 104, { align: 'center' });
    ctx.fillStyle = C.ink; ctx.font = '600 56px Geist'; ctx.letterSpacing = '-1.5px'; ctx.textAlign = 'center'; ctx.fillText(LB('s5.line'), 0, -50); ctx.letterSpacing = '0px';
    ctx.font = '600 40px Geist'; const pw = ctx.measureText(LB('s5.cta')).width + 112;
    ctx.fillStyle = C.accent; ctx.beginPath(); ctx.roundRect(-pw / 2, 10, pw, 96, 48); ctx.fill();
    ctx.fillStyle = C.accentText; ctx.fillText(LB('s5.cta'), 0, 72);
    ctx.fillStyle = C.muted; ctx.font = '500 34px "Geist Mono"'; ctx.fillText(LB('s5.url'), 0, 180); ctx.textAlign = 'left';
    ctx.restore();
  },
};

await start();
