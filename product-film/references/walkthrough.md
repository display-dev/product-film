# Walkthrough films (Route C)

A pointer drives the product through one causal story: select, comment, publish, share, and so on. Captions or
full-screen cards name each step. This is the register for store-listing promos and feature launch films.

The rules below come from one store-listing promo that took seven published versions and about twenty renders. Each
rule closed one review note. Apply them from the first cut. `templates/walkthrough/` has the engine and pipeline with
every rule below built in.

## The look

The cinematic defaults of Routes A and B were rejected for this kind of film, one review round at a time.

| Rule | Why |
|---|---|
| Neutral plate `#F3F3F3` with a static background image. No color glows, particles, grain or vignette. | Color glows tinted the UI. |
| Default background: the engraved chart background (`tools/chart-background.html`; `node tools/make-chart-bg.mjs` renders it in the brand accent to `backgrounds/`, where `beats.html` picks it up). The alternative is a static halftone field in the brand accent. Either way, the center stays clear (valley shape), and the image is the same in every clip. | Chosen after 27 options. |
| Only the subject moves. No camera drift, no slow scale-up on cards or titles, no push while nothing happens, no tilt. | Floating items read as unsteady. |
| A 2D camera, not a 3D rig. | 3D perspective made text soft at 1.8×. |
| One base framing per scene. Zoom 1.4–1.9× only onto the item the step is about, then go back to base. Leave some steps wide. | The same zoom on every beat reads as a template; with no zooms the key items were lost. |
| Pointer and highlight move as one. A selection highlight's width comes from the pointer tip, and a drag is a straight line. | A highlight that trails the pointer reads as a bug. |
| Editing never shifts the layout. The caret is always in the DOM and blinks by opacity; edited text keeps a min-height. | The text flickered and jumped vertically while it was typed. |
| Slow enough to read (see the numbers). | Text and key items were not on screen long enough to read. |
| The UI is the current UI. | The film showed UI the product had already removed. |
| The pointer never stops in the middle of a move, and never waits long before the next one. | A pause mid-move, or before the next move, reads as a stuck pointer. |
| A newly opened panel stays on screen long enough to read. | A panel that closed at once could not be read. |

For a faster, designed register (white plate, isolated components at extreme close-up, morphs and kinetic
captions, scale instead of holds), read `kinetic-style.md`. It replaces the look rules above for that cut, and its
example engine, `templates/walkthrough/kinetic.html`, runs on the same pipeline. The pointer, flicker, current-UI and
true-claims rules still apply.

## Settle before building

1. **Persona and one causal story.** Who, which page, what they do, and who receives the result. For example: a
   product marketing consultant reviews a client's homepage, comments on three lines, publishes it privately to
   the client, an agent applies the comments, and the consultant trims the headline in-line. Every UI change on
   screen is caused by a visible click. State carries across scenes (v2 shows all three comment outcomes).
2. **Current UI.** Take strings and layout from the shipped code. Run `git log --since="1 month ago" -- <ui paths>`
   to catch recent redesigns before you mirror anything. Stale UI cost a full round.
3. **True claims.** Check every limit, client name and plan claim on screen against the product's truth sources:
   the docs, changelog, pricing page, specs and the code itself (for example a per-page comment limit, or which
   clients are documented as supported). Drop lines that do not help this audience ("Free to start" was cut as
   irrelevant).
4. **Closer copy from evidence.** A "No X. No Y." closer names what the audience does today. Research it first
   (for website feedback: email threads, screenshots, spreadsheets, PDFs, screen recordings).
5. **Say what it is.** For a browser extension, the title subline names what it is and whose it is ("The browser
   extension by <brand>"), and the first shot launches it from the browser's extensions menu.
6. **Fact-check real-world conventions** (charts, maps, code, legal text) before you show them. Reviewers check.

## Two cuts, one page

Build both from the same scenes, put them on one review page, and let the team pick.

- **A, captions.** One continuous take per scene. Captions sit in a band at the top, and a new caption cross-fades
  in at each chapter boundary inside the take. One build's cut A ran 47.7 s.
- **B, cards.** Full-screen text cards (116 px, one accent word, an optional 34 px subline) between product
  shots. The shots are cut from the same scene timelines with `toff`/`tend` and run in `mode=cards` (browser
  centered, no caption band). The same build's cut B ran 60.4 s.

A scene list that worked: title 2.4 · main take about 17 (scene seconds) · agent 4.2 · in-line edit 4.4 · closer
2.9 · end card 5.0. A length of 45–65 s was acceptable.

## The numbers

| What | Value |
|---|---|
| Frames | 1920×1080, device scale factor 2, 60 fps, JPEG q93; x264 CRF 15 per clip, CRF 14 master |
| Dissolve | 0.5 s (A), 0.45 s (B) |
| Global slowdown | scene time × 1.2 (`slow`) |
| Holds | 0.5–1.0 s on each thing worth reading, only where the pointer rests; 0.4 s after a state-changing click |
| New panel before a cut | ≥ 2 s on screen (use a plan `tail` to hold the last frame) |
| Cards | 2.6 s; 2.9 s with a subline. Title 2.4 s, end card 5 s |
| Caption | 76 px, weight 800, −0.045em, top 74 px; subline 28 px at 170 px; band 174 px solid + 20 px fade |
| Caption timing | First caption starts 0.3 s (scene) into the clip, after the dissolve midpoint. The last one fades out before the dissolve is half done. Text never dissolves into text. |
| Base framing | browser 1500×810 at (210, 228), camera m 1.1 |
| Zoom | 1.4–1.9×, 0.5–0.8 s cubic in-out, scale interpolated in log space, clamped so the browser fills the frame |
| Entrances | fade + 12–20 px rise + scale 0.98→1 over 0.3–0.5 s ease-out; chips pop 0.7→1 with a back-ease over 0.34 s |
| Ground | page blur 0.9 px and 5 % darker behind a popover or dialog |
| Pointer travel | 0.3–0.7 s for a hop, 1.1–1.7 s for a glide across the frame; slight arc (≤ 60 px) |
| Drag | straight, 0.35–0.7 s |
| Click | arrive, then press ≥ 0.05 s later; press dips to scale 0.84 over 0.08 s and releases over 0.16 s |
| Idle before the next move | about 0.5 s, unless a hold or typing is the point. Start the next move while the UI changes. |
| Typing | 25–32 characters per second of real time. Caret blink 2.2 Hz, 55 % on. |
| Closer ("No screenshots. No email threads.") | 116 px, line-height 1.36, strike bars 0.085em at 53 % |

## Engine patterns

All of these are in `templates/walkthrough/beats.html`, with comments. Its brand block (accent, ink, plate, grays,
fonts) is the one place to rebrand.

- **Holds by time warp.** Write scene timelines at authored speed. `HOLDS[scene] = [[sceneTime, realSeconds], …]`
  freezes the scene there. `warp(real) → scene` and `unwarp(scene) → real` apply the slowdown and the holds.
  `window.clipDur(a, b)` gives render.js the real length of any scene range, so plans list scene ranges and never
  real durations.
- **Plans.** `plan-A.json` / `plan-B.json` list clips as `{id, beat, toff, tend, tail?, i?, dur?}` with the plan's
  `xf`, `slow` and `mode`, and optionally `page`, `w`, `h` and `q` (extra query parameters). `tail` holds the frame
  at `tend` for extra real seconds. Cards give `dur` directly.
- **Camera.** `cam(t, [B0(t), Z(t, cx, cy, m), …])`: eased keyframes; `clampK` keeps the browser filling the
  frame; `#band` lets zoomed content pass under the caption.
- **Pointer.** `cursor(el, t, keyframes, presses, show)` returns the tip. Drive a highlight with
  `(tip.x − box.x) / box.w`. Put a hold only on a keyframe pair where the pointer rests.
- **Caret.** `caret(t, focus, typingEnd, off)`: solid while typing, blinking from the scene-time phase after that,
  with no one-frame flash before `off`. A blink phased on film time flashed for one frame in one cut and not in the
  other.
- **Film time.** Anything that must run continuously across a dissolve (a blinking cursor in a wordmark, a ticking
  clock) runs on film time, `g0 + t`, which render.js passes per clip.
- **Centring.** Set the text, then center (`centreText`). The reverse shows the element off-center for one frame.
  Give changing status text a fixed `min-width`.
- **Class names.** Scope classes per component. A toolbar `.eb` once restyled the page's eyebrow `.eb`.

## Check before every publish

1. `node <film>/audit.js plan-A.json` (and plan B). It lists pointer rests, flags any hold that freezes a moving
   pointer, flags any element that jumps for one frame (box, opacity or text), and flags a stateful `seek` (a frame
   whose visible text differs when reached from a fresh page). Fix every flag. Then look at each rest longer than
   about 1 s: is it typing or a deliberate hold? If not, start the next move sooner.
2. `node <film>/previewq.js out.jpg "beat=s1&dur=10.08@4.2" …` at each hold and each click, full size. Take `dur`
   from `plans.txt`: captions time their exit from it. The tiles land in `<film>/preview/`.
3. The contact sheet `assemble.sh` writes (1 fps), for continuity and framing.
4. Watch the 720p file once at real speed. Pacing notes come only from watching.

## Pipeline

Every script resolves its paths from its own folder, so it runs from any working directory.

```
PLANONLY=1 node <film>/render.js plan-A.json > <film>/plans.txt         # durations and film offsets
PLANONLY=1 node <film>/render.js plan-B.json >> <film>/plans.txt
python3 <film>/plan-jobs.py 5 plan-A.json:s0,s1,s2 plan-B.json:B02     # split across workers → jobs.sh
bash <film>/jobs.sh                                                     # about 1 worker per 2 cores
bash <film>/assemble.sh plan-A.json    # → film-A_master.mp4, film-A.mp4 (1080p60), film-A_720.mp4, poster-A.jpg, sheet-A.jpg
node <film>/render.js plan-A.json s1:600:780                            # re-render only a frame range of a clip
```

The whole A+B render took about 10 minutes on 5–6 workers. After a change to one scene, re-render only the clips
that use it.

**Review page.** One page for both cuts, published wherever the team reviews work: one page, many versions, "What
changed since vN" on top; never a new page per cut. Embed each cut once as base64, re-encoded at CRF 23 so the page
stays under the host's upload limit (50 MB fits most), each with its own poster (A: a caption over the product; B: a
card). A browser-extension store usually takes the promo as a video-host URL; upload `film-X_master.mp4` or
`film-X.mp4`.

## Gotchas already paid for

- Wait for fonts and image decode before the first screenshot (render.js does). For canvas text, call
  `document.fonts.load()` for each face first, or it falls back to serif.
- Under load a screenshot can stall; render.js reloads and retries the frame.
- Playwright `setContent` on `about:blank` cannot load `file://` images. Go to a `file://` page first.
- ffmpeg writing one image needs `-update 1` or `-frames:v 1`; a tile sheet with more frames than tiles needs
  `-frames:v 1`.
- zsh aborts a command chain on an unmatched glob (`rm frames/s*`). Use explicit paths or fresh folders.
- Removing a function with a range edit can take its neighbor with it. Keep a `beats-vN.html` backup per cut.
- `seek(t)` must not depend on earlier frames. Renders seek in order; previews load a fresh page per frame, so a
  stateful `seek` passes every preview and breaks the render. Look at the rendered contact sheet, not only previews.
- Size every container for its fullest state (three comments, the longest label). A list that overflows its panel
  shows the footer's border running through the last card, and a close-up makes it obvious.
- Take radii, borders and focus rings from the product's shipped CSS. At 2× zoom a 2px focus border next to 1px
  fields reads as a heavy double outline.
