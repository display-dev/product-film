# Paper collage films (Route D)

An illustrated cut-paper cast (jointed puppets, busts, a crowd of paper heads) tells a small story over **real
product UI**: screenshots rendered by the product's real code on fictional fixtures. Captions sit on torn typewriter
strips, marker labels and doodles boil on 3s, the cast moves in stop-motion steps on 2s, and the UI never wobbles.
Silent first, with synthesized pen-and-paper sound and empty voice and music tracks ready for a later pass.

The numbers and rules below come from a 59.6 s build that took five cuts; every rule closed a failure in that build
or a note from its review. The template's example is a 22.8 s Tidewell story that exercises every engine primitive.

| Read | When |
|---|---|
| This file | Before anything else |
| `paper-capture.md` | At the capture step, and before any new product screen |
| `paper-lessons.md` | Before you build scenes, and again before every review |
| `templates/paper/` | Start every film from it with `new-film.sh paper`; never from a blank file |

## When to use it

Use Route D when the film needs **people and product together**: a hero with a problem, the product as the turn, a
payoff that shows other people (teammates, clients, a crowd). It suits social cuts (45–60 s), pinned posts, launch
explainers and website films, for any feature, audience or length. The cast, story and product screens change per
film; the kit, engine, capture harnesses and tools stay.

Use another route when:

- one person walks through one flow with a pointer and no cast → Route C (`walkthrough.md`)
- the film is cinematic, with a 3D camera → Routes A and B (`camera-rig.md`)
- the film is fast and designed, with isolated UI at close range → `kinetic-style.md`
- the film is a screen recording of the app → not this skill

A photo cut-out hero from licensed footage was planned once but never built. If you build it, keep one real person
used the same way throughout, and treat the cut-outs as paper prints in the same kit.

## Settle the brief first

Resolve every item and write it under "Preflight" in `notes/DECISIONS.md`. Ask only when the user is there and the
answer cannot be inferred; otherwise decide, and log the decision with its reason.

1. **Audience.** Who, in priority order (from `PRODUCT.md` or the product's positioning, if the project has one), and
   what they do today instead (for the example product: PDFs by email, screenshots in chat).
2. **Takeaways.** The two or three things a viewer knows afterwards, the feeling to leave, and the ending (the
   wordmark, a call to action, the URL).
3. **Truth sheet.** Every claim the film may make, each with its source: the product's docs, changelog, pricing page,
   specs, the voice and naming rules in `VOICE.md` or a style guide if the project has one, the feature's UI copy, and
   the code itself. Product names can mislead: a feature's name may promise more than it does, so read what it does.
   Then the list of what the film must not show or imply (prices, plan names, unshipped features, third-party logos or
   characters, paid-plan features shown as universal). Recheck each line in the code: one truth sheet said "anyone who
   can view can comment", and the code only let signed-in members comment.
   **Stop rule:** if the feature as briefed does not exist, or its core promise differs from what the code and specs
   say, stop before any capture. Ask when the user can answer. When the run is unattended, make the nearest true film,
   and lead the final report with the re-scope and the source that forced it; never quietly make a different film.
4. **Story with a causal chain.** A hero; the problem inside the first 5 s; the product as the turn; the payoff.
   Every change on screen is caused by something the viewer saw. Each version keeps the earlier changes. A changed
   word is one the viewer has already read. Who does what matches the product's permissions (who may view, comment,
   edit).
5. **Formats and length.** 16:9 1920×1080; 9:16 1080×1920 recomposed, not cropped; 16:9 without captions plus an
   .srt; 4:5 1080×1350 optional. 30 fps. 45–60 s for social.
6. **Safe zones and thumbnail.** In 9:16, captions, labels and key UI stay out of the top 250, bottom 480 and right
   150 px. Frame 0 is the thumbnail, and the first 2 s read on their own.
7. **Sound.** SFX only, or silent. Voice and music stay empty tracks unless the user funds and asks for them.
8. **Spend and publishing.** Zero spend by default: no stock, no image, video or audio models. The only thing
   published is the review page, when the user asks. Nothing is published for capture.
9. **Names.** Fictional people and companies only (the template's fiction: Tidewell, Northfield Studio, Maya Chen,
   Sam Rivera, Priya Nair, Jordan Ellis, `@example.com`). Name third-party tools in text, never with their logos.
   Follow the project's naming rules (`VOICE.md`, `PRODUCT.md` or the brief).

## Procedure

Every script works from any directory with absolute `<film>/…` paths; Playwright loads through `<film>/pw.cjs`.
Re-rendering a version starts clean (`render-all.sh` clears that version's mix and checks); prefer a new version
number for every changed cut anyway, so earlier cuts stay archived. Each step ends with a gate; do not start the next
step until it passes.

0. **Folder.** `bash <skill>/templates/new-film.sh paper <folder>`. It copies the template and the shared tools,
   makes sure Playwright resolves, then runs `templates/paper/setup.sh`: fonts, a Python venv (numpy, Pillow), the
   engraved chart background and the per-format plates, the sound set, and the notes skeleton (`NOTES.md`,
   `notes/DECISIONS.md`, `notes/SCRIPT.md`, `notes/sources.md`). Use a folder that persists, outside temporary folders
   (they are pruned) and outside the product's repository. If the captures will run the product's dev server, save
   `git status --short` of its repository now; it must be the same at the end. Check the template runs before you
   change it: the commands `setup.sh` prints.
1. **Truth.** Read the sources in brief item 3, plus `VOICE.md`, `DESIGN.md` and `PRODUCT.md` if the project has them.
   Write the truth sheet under "Truth sheet" in `notes/DECISIONS.md`. *Gate: every planned claim has a source line.*
1b. **Beat sheet.** In `notes/SCRIPT.md`, list each beat with its caption draft, the shot it needs (which harness,
   which state, which viewport) and the character's pose. Block the film out with placeholder scenes in `film.js` (the
   engine draws a labeled placeholder for a missing shot) and preview it, so the capture list comes from the story and
   not the other way round. *Gate: every beat names its shot and harness.*
2. **Brand and fixture story.** Put the product's tokens in `film/timeline.json` `brand` and in the brand blocks of the
   capture templates. Write `capture/story.json` (people, org, page, versions, the change, the one-time code) and the
   fictional artifact (`capture/artifact/template.html`); build it with `build.py`; run `check-layout.mjs`. *Gate: no
   reflow between versions at 1280×800.*
3. **Capture** the real UI with the harnesses in `paper-capture.md`. *Gate: zero unmocked API calls, no blocked
   requests, no leak warnings, the product repository's `git status` unchanged, nothing published.* Write what the
   captures taught you under "Facts the captures surfaced": they change the film.
4. **Kit.** Add the cast to `CAST` in `kit/puppet.js` (the file header says how), and any poses. Only full-body
   characters take poses; busts change faces. New props (a lock, a door, a stamp) are paper pieces in
   `kit/export.html`. Run `node <film>/kit/build-kit.mjs`, then `build-sheet.mjs 0`, `1` and `2`. *Gate: each
   character reads as one character in every pose and boil variant; colors are muted; no garment shares the accent's
   hue.*
5. **Script.** Fill `film/timeline.json`: set `name`, `title`, `summary`, `formats` and `outputs` for this film (they
   flow into file names and the review page), the `copy` rules (§ Quality gates), then scenes with named cues,
   captions, labels, SFX cues, and list every harness manifest you captured under `manifests`. Replace the example
   constants at the top of `film/film.js`. Keep a caption table in `notes/SCRIPT.md` (caption, words, minimum hold,
   hold). *Gate: `python3 <film>/tools/check-copy.py` passes.*
6. **Script review.** An independent review of the script, storyboard, truth sheet and brief by another agent or model
   when one is available (a subagent or a second model). Adjudicate every finding in `DECISIONS.md` as adopted or not
   adopted, with the reason.
7. **Scenes.** Write `film/film.js`, one scene at a time, every format at once (`V({...})`). Preview with the guides
   on: `node <film>/film/preview.mjs 9x16 1,4,7 "" 1 1 1`. *Gate: no warnings in the preview output (a missing shot,
   box or cue is an error in the render).*
8. **Render.** `bash <film>/film/render-all.sh v1 [workers]` renders and assembles every output in `timeline.json`
   `"outputs"`. *Gate: each `out/v1/checks.txt` line has the exact frame count and zero timing jumps.*
9. **Self-review.** Transition strips are cut around scene starts and cues whose names match `review.markCues` in
   `timeline.json` (a regex; the default covers `in`, `zoom…`, `pan`, `back`, `swap`, `click`, `editor`, `out`,
   `v1`…); add your cue names there. Then, for each output: `<film>/.venv/bin/python <film>/tools/review.py
   <film>/out/v1/<name>-<fmt>-v1_master.mov <fmt> <film>/review/v1-<fmt>`; for full-size stills, `bash
   <film>/tools/stills.sh <master> <outdir> [step seconds] [width]`. Look at the phone sheet, every transition strip
   and the difference trace. Fix, re-render and repeat. *Gate: `python3 <film>/tools/gates.py v1` exits 0 and you have
   answered its judgment checklist in `DECISIONS.md`.*
10. **Independent review of the cut.** Another agent or model, when one is available, reviews the contact sheets,
    transition strips, difference trace and full-size stills (reviewers read frames, not video). Adjudicate, fix,
    re-render as the next version, and pass the gates again. Run at least two full improvement rounds.
11. **Deliver.** `bash <film>/tools/deliver.sh vN <poster seconds>`; complete `notes/sources.md` (every asset,
    source, license, spend, anything published or deleted for capture); `python3 <film>/tools/readme.py vN`.
12. **Review page.** Write `notes/review-vN.json` (what changed, what only the user can judge, decisions) and run
    `python3 <film>/tools/build-review.py vN`. It warns over 45 MB.
13. **Publish, only when asked.** Publish the review page wherever the team reviews work: one page, many versions,
    "What changed since vN" on top; never a new page per cut. Update `NOTES.md`: current cut, pipeline, what the user
    rejected and why.

For a change to the sound only, remix and remux: `bash <film>/tools/remux-audio.sh vN vN+1` copies the pictures bit
for bit, so every picture check carries over.

## The engine

`film/film.html` loads `film.js`, which imports `engine.js`. `window.seek(t)` draws frame `t` on one canvas,
deterministically, from `timeline.json`, the frozen kit and the captures. Scenes register in `SCENES[id]` with
`draw(tq, s, t)`, `shots()`, and optional `pre`/`post` overlap; `s.cue('name')` gives a cue's absolute time. The
example `film.js` shows every primitive in a five-scene story.

| Primitive | Use |
|---|---|
| `print({ shot, crop, x, y, w, url, kind })` | A capture in a clean window: `browser` (title bar, URL pill), `photo` (card), `raw` (the capture is the window, for the agent window). Returns a layout for `toWorld`/`boxWorld`. |
| `layoutBox(L, box)`, `box(file, name)` | World box of a named capture element, before drawing (cameras, labels). Boxes come from the capture manifests. |
| `phone({ shot, x, y, s })`, `phoneBox` | A clean black phone with a 390×844 capture on its screen. |
| `character(id, x, y, s, t, poses, { look, blinks, face })` | A full-body CAST puppet; `poses = [[t, 'pose', dur?], …]`, eased and stepped. |
| `bust(id, x, y, s, { face, look, tilt })` | Any CAST character as head and shoulders. |
| `hop(t, t0, d, from, to)` | Walk a character in stepped hops: how the hero crosses a cut. |
| `cam(zoomTo(t, in, out, box, s))`, `camOn`, `camFit`, `kf` | One zoom onto the item, a hold, and back. `kf` keys with `'hold'` keep a framing. |
| `captions(t)` | Automatic from the timeline: typewriter strips, one accent word, stepped drop-in. |
| `label(text, x, y, { size, write })`, `note(text, lx, ly, ax, ay, t, t0)` | Hand lettering that writes on; an arrow plus label. |
| `ink(doodle.circle/underline/cross/tick/question/arrow(...), { progress })` | Marker doodles that draw on and boil. |
| `cursor(x, y, { clickAt })`, `pathAt(t, keys)`, `tap(...)` | The paper pointer: straight moves, rests, clicks; taps on a phone. |
| `swapAt(t, [[t, shot, lift?], …])`, `stateAt(t, states)` | Replace a print (lift and land), or step UI states in place (`lift: false` for typing). |
| `slideIn`, `slideOut`, `piece(name, …)`, `wordmark(x, y, h, { align })` | Entrances and exits, any kit piece (speech bubbles, tags, tape), the text wordmark for the end card. |

Query flags: `fmt`, `cap=0` (no captions), `guides=1` (safe-zone box and camera area), `strict=1` (missing shot,
box or cue throws; the render sets it), `tl=<file>` (another timeline), `t0`/`t1` (preload only a range).

**Brand.** `timeline.json` `brand` is the film's one brand block: `accent`, `accentText`, `ink`, `plate`,
`wordmark` and `font`. The kit, the captions, the end card, the chart background and the review page read it. Take the
values from the product's tokens (`DESIGN.md`, `tokens.css`, a Tailwind config or CSS custom properties, if the
project has them; else ask). The capture templates (example app, agent window, terminal) each have their own marked
brand block. After a change, rebuild the kit and the background.

**Background.** The default plate is an engraved nautical chart in the accent and ink: a valley, dense in the bottom
corners and clear in the center, so product UI and text sit on a quiet plate. `node <film>/tools/make-chart-bg.mjs`
renders it from `tools/chart-background.html` into `backgrounds/` (16:9 on the plate, and a transparent lines-only
copy), reading the colors from `brand` (or `--accent`, `--ink`, `--plate`); `<film>/.venv/bin/python
<film>/tools/make-bg.py` composes `film/bg/bg-<fmt>.png` (9:16 and 4:5 lay the lines on the plate, anchored to the
bottom). `setup.sh` runs both. Without them the engine uses a flat plate, which is fine for previews but not for a cut.

## The numbers

These held in a 59.6 s build. Start here and change one at a time.

| What | Value |
|---|---|
| Frames | 30 fps; the canvas renders at device scale 2 (3840×2160 for 16:9), JPEG q95, downscaled once in the master |
| Stop motion | Motion on 2s (15 poses a second); marker lines and labels boil on 3s with 3 seeded variants; UI prints never boil |
| Captures | Desktop 1280×800 at DSF 3; phone 390×844 at DSF 3; popups at their real size (a share popup, for example 420×480) |
| Zoom | 1.12–1.9×, only onto the item the beat is about; in 0.45 s, hold, out 0.45 s; a label written during a zoom lands off screen |
| Holds | 0.5–1.0 s on each key moment with the pointer at rest; a newly opened panel about 2 s; full-screen text about 2.6 s; end card about 4 s |
| Captions | At most 7 words; hold ≥ 1.5 s + 0.3 s per word + 0.5 s margin; one accent word; about 60 words per minute of film (62 in 59.6 s) |
| Caption type | Geist Mono 500 (the accent word 600, in the brand accent) on torn strips: 16:9 56 px centered, bottom 1040; 9:16 58 px, left 34, bottom 1432; 4:5 54 px centered, bottom 1300 |
| Labels | Caveat Brush 44–58 px (46 typical, 52–56 for the key label), arrow 0.3 s, write-on 0.35 s |
| Pacing | Scene boundaries at least 1 s apart; each beat lands 0.5–1 s before the next section; problem inside 5 s |
| Entrances | Slides 0.4 s (ease-out in, ease-in out); hops 0.5 s; caption strips drop in two stepped poses |
| Phone | Scale 1.0 and zoom 1.7× in 16:9 (1.18× showed a phone as two black bars) |
| Cast | Full-body hero about 620 px tall at scale 1; 0.64–0.98 in 16:9, 0.42–0.64 in 9:16 |
| Masters | ProRes 422 HQ, 10-bit 4:2:2, BT.709 limited range with matching tags, PCM 48 kHz |
| Upload copies | H.264 High, level 4.1, CRF 18, faststart, AAC; VMAF ≥ 95 against the master (96.9 in both full builds) |
| Web set | One click-to-play H.264 for the site's video pipeline; AV1, HEVC and H.264 at VMAF ≥ 96, smallest first (4.7, 4.9 and 6.3 MB for 59.6 s). Check the order in `deliver/web/vmaf.txt` and adjust CRFs if it is wrong. |
| Sound | True peak ≤ −1.5 dBTP (mix.py scales to −2.0); integrated ≤ −14 LUFS; an SFX-only track sits at −20 to −23 LUFS, which is fine |
| SFX gains | Caption strip (tape) −17 dB; slide −10; place −9 to −13; circle −13; lettering −17 to −19; click −15; key −19; pop −13 |
| Render | One worker per two cores; about 145 ms per 4K frame per worker (the example's 684 frames × 3 outputs took 3 minutes on 10 cores, with assembly and checks) |

## Formats

Every layout value goes through `V({ '16x9': …, '9x16': …, '4x5': … })`; a missing format falls back to 16:9.
Recompose each format; never crop one into another.

- The camera centers targets on `FOCUS`, the middle of the area captions and platform UI leave free; `camFit` keeps a
  box inside `FREE`. Turn on `guides=1` to see both.
- 9:16 captions sit left (x 34) above the bottom band. Use a narrower agent window capture (`agentn-*`, 720 px) so its
  text reads on a phone. Where two halves of an exchange cannot share a readable frame (a comment and the change it
  caused), put one half beside the page as a taped cut-out.
- In 9:16, labels, tags and bubbles stay out of the right 150 px; a label on the URL bar sits beside the URL, not above
  it. A name tag and a speech bubble beside a phone stack in the column between the phone and the safe-zone edge.
- 4:5 has no platform bands: captions center, and the cast rises above the caption band.
- Check 9:16 zooms separately: a zoom that fits in 16:9 can push a window past the frame edge in 9:16. Check the end
  card too: a headline that fits 16:9 at one scale clips in 9:16.

## Carrying things across a cut

At any moment exactly one scene draws a given character or window.

- The outgoing scene sets `post: 0` (or stops drawing the carried thing at `s.end`); the incoming scene draws it from
  where it was and moves it (`hop` for a character, a stepped move and scale for a window).
- One window moved in place reads as one page; two windows cross-faded read as two pages.
- Clear everything (stepped) before a flat end card fades in.
- Check every cut in its transition strip: a double hero or a doubled window shows there and nowhere else.

## Quality gates

A cut is done when all of these hold. `tools/gates.py vN` checks the first group and prints the second. It exits 0
when every mechanical gate passes, 1 when one fails, and 2 when nothing failed but a gate could not be measured (VMAF
needs an ffmpeg built with libvmaf): report that, and do not call the cut checked.

**Mechanical (gates.py):**

- `check-copy.py` passes. Its rules are `timeline.json` `copy`: banned terms read at run time from `voiceFile` (the
  project's `VOICE.md` or style guide, if it has one) or else from `bannedTerms`; the film's `extraBanned` regexes;
  `spelling` (`us`, the default, flags UK spellings; `uk` flags US ones; `off`); `emDash` (`ban`, the default: the
  house style uses en dashes with spaces, or none); words per caption, holds, one accent word, caption spacing and
  scene spacing. The style-guide format it reads is in the script header.
- Every master: exact frame count, zero timing jumps, BT.709 tags with limited range, VMAF ≥ 95, true peak ≤ −1.5
  dBTP, loudness ≤ −14 LUFS.
- `review.py` has run on every output, and no difference spike is UNEXPLAINED (including runs of 4+ changing frames,
  which mean motion off the 2s grid).

**Judgment (answer each in `DECISIONS.md`):**

- Phone sheet: every caption and label reads at 390 px; nothing overlaps; no UI text is unreadable.
- 9:16: captions, labels, zoom targets and bubbles stay inside the safe-zone box.
- Transition strips: no character or window drawn twice, no pop, no one-frame flash.
- Every zoom lands on the item the beat is about, holds with the pointer at rest, and returns.
- Truth: every caption and on-screen claim matches the truth sheet; nothing shows what may not be shown.
- An independent review of the rendered cut has a recorded verdict, and every finding is adopted or answered.
- You would be proud to post it. Say in the final report what only the user can judge: the cast's charm, the
  caption pacing on a phone, and the sound, which an agent cannot hear.
