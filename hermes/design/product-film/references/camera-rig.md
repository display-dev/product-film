# Camera rig and choreography reference

Extracted from the beat engine of a hero film after sixteen cuts. Numbers are the tuned values; the code is the working code. `templates/cinematic/beats.html` carries all of it.

This rig is for Routes A and B. Do not use it for a Route C walkthrough: the 3D camera softens text, and the drift, tilt, particles and glows were rejected there. See `walkthrough.md`.

## The numbers

These held across sixteen cuts. Start here; change one at a time and re-render only the beat you changed.

**Pacing**

- Route A: footage cuts 0.75–1.8 s (median 1.5 s), product beats 2.5–3.8 s, half the running time each. Five cuts per ten seconds, always short–short–long. Every product beat holds its end state ≥ 0.5 s.
- Route B: beats 2.5–5 s, joined by the plate; one idea per beat; captions change on beat boundaries.
- The longest hold goes on the text-heaviest beat. The first product beat carries the most text.

**Camera**

- Perspective world, `perspective:1500px`; the camera translates on z (a dolly), never a 2D scale. Magnification of a plane at depth z is `1500/(1500 − z_cam − z_obj)`.
- One move per beat, cubic ease-in-out over the whole beat: z from about −80 to +180…+500. Under it, residual drift `x += 6·sin(0.9t)`, `y += 4·sin(1.25t)` so a hold never freezes.
- Rotation only on hand-held objects (popovers, dialogs, phones): settle from 7°/−9° to 1.5°/−2° plus ±0.6–1.2° sine. Never on screen-fixed objects (composer, card); tilt there reads as a bug.
- Subject forward, ground back: the subject moves to z 260–280 and scales 1.45–1.7×; the ground scales 0.98, dims to 0.86, and the focus plane follows the subject so the ground blurs ≤ 1.6 px. The ground is never removed.
- Depth of field: `blur = clamp((|z − focus| − 90)/110, 0, 3.5)` px, opacity × (1 − 0.1·blur/3.5).

**Entrances**

- Every element has an entrance: y +44→0, scale 0.94→1, opacity 0→1, 0.3–0.6 s, cubic ease-out. Stagger siblings 60–140 ms in reading order. Chips and avatars pop with a back-ease (1.4→1).
- Text is typed, not faded: prompts at about 45 characters per second with a caret that follows; the camera tracks the caret.
- Unfolds use max-height 0→N with ease-out, not opacity alone.

**Plate and texture**

- Two soft color blobs on an off-white plate, 150–200 seeded particles drifting; on the publish beat they converge into the card as it lands.
- Glass panels: `background: rgba(255,255,255,.7)` with `backdrop-filter: blur(22px)`. Comments, pills and dialogs are solid white with a border and a deep shadow.
- Encode every beat with `noise=alls=6:allf=t+u` and `vignette=PI/6:mode=backward` so it sits with footage.

**Footage (Route A)**

- One shoot for every people shot; one protagonist; one mild grade (`eq=saturation=0.92:contrast=1.03`).
- Each product beat is preceded by the human action that motivates it.
- A wide exterior opens and closes the film so the loop seams.
- License at the highest tier and pull the largest file. Scaling footage up and refitting it does not make a zoom; a real push-in is `zoompan` on an 8K upscale.

## Stage

```html
<div id="stage">                                   <!-- 1920×1080, overflow hidden -->
  <div id="plate"><i id="bl1"></i><i id="bl2"></i></div>   <!-- two blurred colour blobs -->
  <canvas id="pf" width="3840" height="2160"></canvas>      <!-- particles, drawn at DSF 2 -->
  <div id="world"><div id="cam">                             <!-- perspective + camera -->
    <div class="beat" id="b1">…</div>
  </div></div>
</div>
```

```css
#world{position:absolute;inset:0;perspective:1500px;perspective-origin:50% 46%}
#cam{position:absolute;inset:0;transform-origin:50% 50%;transform-style:preserve-3d;will-change:transform}
.beat{position:absolute;inset:0;display:none;transform-style:preserve-3d}.beat.on{display:block}
.p3{transform-style:preserve-3d;will-change:transform,opacity}
/* glass */
.glass{background:rgba(255,255,255,.70)!important;backdrop-filter:blur(22px) saturate(1.15);border:1px solid rgba(255,255,255,.85)!important;box-shadow:0 44px 100px rgba(30,28,20,.12),0 2px 8px rgba(0,0,0,.04),inset 0 1px 0 rgba(255,255,255,.95)!important}
/* solid (comments, pills, dialogs) */
.solid{background:#fff!important;border:1px solid var(--border)!important;box-shadow:0 44px 100px rgba(30,28,20,.16),0 2px 8px rgba(0,0,0,.06)!important}
```

## Helpers

```js
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), lerp=(a,b,u)=>a+(b-a)*u, seg=(t,a,b)=>clamp((t-a)/(b-a),0,1);
const eo=u=>1-Math.pow(1-u,3);                       // ease-out cubic: entrances
const ei=u=>u*u*u;                                   // ease-in cubic: particles converging
const eio=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;     // ease-in-out cubic: camera
const bo=u=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(u-1,3)+c1*Math.pow(u-1,2);}; // back-out: chips
```

## Camera

```js
const CAM={x:0,y:0,z:0,rx:0,ry:0};
// one move over the beat, plus residual drift; rot=false on beats whose objects are screen-fixed
function cam3(t,a,b,dur,rot=true){
  const u=eio(seg(t,0,dur)); for(const k of ['x','y','z','rx','ry']) CAM[k]=lerp(a[k]??0,b[k]??0,u);
  CAM.x+=6*Math.sin(t*.9+1.2); CAM.y+=4*Math.sin(t*1.25+.4);
  if(rot){CAM.ry+=.4*Math.sin(t*.7); CAM.rx+=.3*Math.sin(t*.55+2);}
  $('cam').style.transform=`translate3d(${-CAM.x}px,${-CAM.y}px,${CAM.z}px) rotateX(${-CAM.rx}deg) rotateY(${-CAM.ry}deg)`;
}
// keyframed camera for beats with several moves (typing → lift → land)
function camK(t,K,rot=false){
  let a=K[0],b=K[K.length-1]; for(let i=0;i<K.length-1;i++){ if(t>=K[i].t&&t<=K[i+1].t){a=K[i];b=K[i+1];break;} } if(t>b.t)a=b;
  const u=b.t>a.t?eio(seg(t,a.t,b.t)):1; for(const k of ['x','y','z','rx','ry']) CAM[k]=lerp(a[k]??0,b[k]??0,u);
  CAM.x+=6*Math.sin(t*.9+1.2); CAM.y+=4*Math.sin(t*1.25+.4); if(rot){CAM.ry+=.4*Math.sin(t*.7);CAM.rx+=.3*Math.sin(t*.55+2);}
  $('cam').style.transform=`translate3d(${-CAM.x}px,${-CAM.y}px,${CAM.z}px) rotateX(${-CAM.rx}deg) rotateY(${-CAM.ry}deg)`;
}
```

Magnification of a plane: `m = 1500 / (1500 − z_cam − z_obj)`. Camera z 180 on a ground at z 0 gives 1.14×; the same camera on a popover at z 260 gives 1.42×, and the popover's own `scale(1.5)` makes it 2.1×. That differential is the "pull-out".

## Placing objects with depth of field

```js
// z = depth, focus = the plane that is sharp; blur grows 1px per 110px beyond a 90px dead zone, capped at 3.5px
function put(el,o){
  const z=o.z??0, f=o.focus??z, d=Math.abs(z-f); const blur=clamp((d-90)/110,0,3.5);
  el.style.transform=`translate3d(${o.x??0}px,${o.y??0}px,${z}px) rotateX(${o.rx??0}deg) rotateY(${o.ry??0}deg) scale(${o.s??1})`;
  el.style.filter=blur>0.05?`blur(${blur.toFixed(2)}px)`:'';
  el.style.opacity=(o.op??1)*(1-0.10*clamp(blur/3.5,0,1));
}
// entrance: rises 44px, scales .94→1, fades in; tilt settles from 7°/−9° to 1.5°/−2° with a sine under it
function p3(el,t,t0,dur,extra='',o={}){
  const u=eo(seg(t,t0,t0+dur));
  put(el,{x:o.x??0,y:(o.y??0)+lerp(44,0,u),z:o.z??0,focus:o.focus,
    rx:o.tilt===false?0:lerp(7,1.5,u)+.6*Math.sin(.9*t), ry:o.tilt===false?0:lerp(-9,-2,u)+1.1*Math.sin(.7*t+1),
    s:lerp(.94,1,u)*(o.s??1), op:u*(o.op??1)});
  return u;
}
```

Blurred panels must not contain the sharp objects in front of them: a CSS `filter` on a parent blurs every child. Make popovers, pills and toasts siblings of the panel and position them absolutely.

## Particles

```js
let s=1337; const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};   // seeded: identical every render
const P=[]; for(let i=0;i<170;i++) P.push({bx:rnd()*1920,by:rnd()*1080,r:1.2+rnd()*3.6,d:.35+rnd()*.65,ph:rnd()*6.283,g:rnd()<.16});
// ACC: the brand accent as "r,g,b" (the template reads it from --accent); about 16 % of the particles carry it
function particles(t,coalesce){ cx.setTransform(2,0,0,2,0,0); cx.clearRect(0,0,1920,1080);
  const u=coalesce?ei(seg(t,1.35,2.35)):0, fade=coalesce?1-seg(t,2.05,2.65):1;
  for(const p of P){ let x=p.bx+22*p.d*Math.sin(.35*t+p.ph), y=((p.by-14*p.d*t)%1080+1080)%1080;
    if(coalesce){x=lerp(x,960+(p.bx-960)*.06,u); y=lerp(y,560+(p.by-560)*.06,u);}   // converge on the card
    const a=(.32+.4*p.d)*fade, c=p.g?ACC:'255,255,255'; const g=cx.createRadialGradient(x,y,0,x,y,p.r*2.2);
    g.addColorStop(0,`rgba(${c},${a})`); g.addColorStop(1,`rgba(${c},0)`);
    cx.fillStyle=g; cx.beginPath(); cx.arc(x,y,p.r*2.2,0,6.283); cx.fill(); } }
```

## Five beats of one hero film, as choreography

The template implements Publish, Comment → v2 and Share as `b1`–`b3`.

| Beat | Length | Camera | Choreography |
|---|---|---|---|
| Publish | 3.8 s | `camK` keyframes: (0 s) x −300 z 40 → (0.15) z 250 → (1.35) x +210 z 350 → (1.95) x −10 y −60 z 20 → (2.75) z 210 → (3.8) z 240. No rotation. | Prompt types 0.15–1.35 s (56 chars), caret blinks until 1.42; composer lifts 1.42–1.95 (y −330, scale .86, opacity .65, focus moves so it blurs 1 px); thinking dots 1.5–1.85; card enters 1.9–2.5 at z 200 (p3, no tilt, scale 1.1); preview unfolds 2.15–2.7 (height 0→400); title 2.3–2.55; three stat tiles from 2.35, 80 ms apart; five bars from 2.5, 60 ms apart; status flips 2.75; two buttons from 2.8, 80 ms apart. Particles converge 1.35–2.35, fade 2.05–2.65. |
| Comment → v2 | 3.2 s | `cam3` x −40→60, y 0→−16, z −20→180, ry −2→2 | Page: focus 0→260, scale .98, opacity .86 over 0.2–0.9. Comment enters 0.15–0.75 (tilt on), z 40→260, scale 1→1.5 over the same pull. Reply 0.85–1.25. Headline swap at 1.6 with a 5% scale pulse 1.45–1.8. v2 chip at 1.55, back-ease 1.4→1. Separator bar scaleY 1.6–2.1. Republish pill 1.85–2.25: y 18→0, z 60→200, scale 1→1.25. "Resolved" 2.2–2.45. |
| Teammates | 2.5 s | `cam3` x 40→−40, y 10→−10, z −10→190, ry 3→−3 | Same page pull 0.1–0.8. Comment A enters 0.1, z 40→260, scale →1.45. Avatar pops 0.55–0.9 (back-ease 1.5→1). Comment B enters 0.9, z 140→280, scale 1.15→1.45 over 0.9–1.5. |
| Share | 3.2 s | `cam3` x 0→30, y −10→20, z −40→220, ry 2→−2 | Dialog enters 0–0.55 at z 40, base scale 1.7, tilt on. Email types 0.3–1.45 (17 chars). Button hover 1.7, press pulse 1.85–2.05 (scale .92). Added row unfolds 2.0–2.45 (max-height 0→80, y −8→0). |
| Phone | 2.8 s | `cam3` to the email body's measured center, z −80→500, rotation on | Phone already in at the cut (enter −0.3–0.2: y 30→0, rx 5→1.5, ry −10→−3, both with sine). Body unfolds 0.35–1.0 (max-height 0→700). Reply pills 1.1–1.5. Link underline 2.1. Three resolved cards enter from 0.75, 140 ms apart, at z 170; scroll 1.15–2.45 by two card gaps; per card z 170→30, scale 1→.94, opacity ×(1−.5k), blur to 3.5 px by distance k from the focus line. |

## Render and encode

```
viewport 1920×1080, deviceScaleFactor 2 → JPEG q94 per frame at 25 fps
ffmpeg -framerate 25 -i f_%04d.jpg -vf "scale=1920:1080:flags=lanczos,noise=alls=6:allf=t+u,vignette=PI/6:mode=backward,format=yuv420p" -c:v libx264 -preset medium -crf 17 -an seg/<beat>.mp4
```

`templates/cinematic/render.js` does both for every beat in `window.BEATS`; `ONLY=b2` renders one beat, and `ONLY=b2 FRAMES=40:60` writes only those frames, without encoding, for a quick look.

## Removed after trying

- Rotational camera wobble on the publish beat (read as a tilt on flat UI).
- Glass (translucent) comment boxes over a softened page (read as a transparency bug).
- Floating mono labels, dust and a grid floor around the UI (competed with the product).
- `zoompan` push-ins computed at 1080p (pixel-snapped jitter).
- Product beats under 2.5 s and end holds under 0.5 s (illegible).
