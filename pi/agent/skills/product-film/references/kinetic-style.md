# Kinetic style

The default register for Route C walkthroughs and feature launches, and an option for a Route B film that should feel
made rather than demonstrated: isolated UI at extreme close-up on white, morphs instead of cuts, kinetic captions,
almost no holds. It changes the look and the pacing. It does not change the pointer rules or the flicker rules in
`walkthrough.md`.

The numbers below were measured on a studied reference: a 65 s product launch film at 1080p24, with a music bed and
no voice. `templates/walkthrough/kinetic.html` is a working example engine (§ Engine notes).

## What it does, measured

| Measure | Value |
|---|---|
| Hard cuts | 4 in 65 s. Every other change is a morph, a whip or a focus pull. |
| Still frames | 6 %. The only hold is the end card (2.6 s). No hold anywhere else. |
| Ideas | about 17 in 62 s, 2.5–5 s each |
| Rhythm | a slow move while you read (1–3 s), then a fast transition (0.3–0.6 s), then repeat |
| Typing | about 16 characters per second, with the text 60–100 px tall |
| Plate | pure white, no texture, no browser frame |
| Loudness | steady music bed at about −16 dBFS; it has no voice and nothing depends on sound |

It stays readable with almost no holds because of the way it frames text. Few words are on screen at a time and
they are very large. The camera follows the reading point, so the eye never has to search. A walkthrough fixes
readability with holds; this style fixes it with scale.

## Beat list of the reference

| Time (s) | Beat |
|---|---|
| 0–1.5 | A two-brand lockup builds letter by letter. |
| 1.5–4.5 | Close-up of an empty chat prompt. The cursor clicks and types a three-word command. |
| 4.5–6.5 | The text slides off. The app icon and wordmark build, then the wordmark leaves. |
| 7–8.5 | A ring of halftone dots in the brand color opens around the icon and reveals the chat window (iris). |
| 8.6–9 | The camera dives from the window into the prompt box, to one "@" character. |
| 9–18 | A long, multi-step command is typed at huge size and the camera tracks the caret. |
| 18.5–20.5 | The send button is pressed and breaks into squares in the brand colors (pixel burst). They re-form as the message card with "Working…". |
| 21–23.5 | A whip with horizontal motion blur. Real avatars fly past at several depths, tagged "Analysing lead…". |
| 24–26 | One avatar lands, and its profile card fills in field by field. |
| 26.5–28 | Caption: "Brings the right context into every message". It exits with motion blur. |
| 29–35.5 | A messaging app's chat. A greeting, then a push-in to one huge bubble, then typing dots. |
| 35.5–37 | The "Launch" button multiplies into brand-color blocks, and the blocks turn into avatars. |
| 37.5–39 | "Right here" with mixed sizes and baselines. A gap opens, a pill drops into it, and the line ends with the host app's name. |
| 39.5–40.5 | The pill morphs into the prompt, where the next command is typed. |
| 41–44.5 | A caption names the next step. The prospect replies; a chip reads "Thinking of the best reply". |
| 44.5–46 | The reply is sent. A focus pull: the chat blurs while a green check pops sharp in front. |
| 46.5–48 | Calendar close-up; the meeting block draws in under the cursor. |
| 48–51.5 | A caption names the host app as the interface. Its pill outline becomes a line, then a node, then three branches, one per capability. |
| 52–54 | "From one prompt". Then the prospect's confirmation. |
| 54.5–60 | An install button is clicked. The last prompt is typed huge and sent. |
| 60–65 | A spark, then the logo builds with the tagline. Hold 2.6 s. |

## Techniques to reuse

1. **Isolated UI at extreme close-up.** Show one component (a prompt box, a chat card, a profile card, a calendar
   block) on white, not a whole browser. Show the full window for 1 s or less to set the scene, then dive in.
   Body text is 60–100 px on a 1080 frame, and the component may run off the frame edge.
2. **Fade to white at the edges.** Anything that leaves the frame, or trails behind the caret, fades into white
   instead of being clipped. Use a mask on the stage, the inverse of a dark vignette.
3. **Caret-tracking ticker.** For a long prompt, the camera x follows the caret. Only about 15–20 characters are in
   frame, and the words behind the caret fade out.
4. **Wet-ink accent.** A new word arrives in the accent color (the reference used an orange-to-red gradient) and
   settles to ink in about 0.5 s. The accent marks what is new, not a fixed keyword.
5. **Kinetic captions as their own beats.** 2–6 words, 60–110 px, not an overlay band. Words enter one at a time,
   from blurred to sharp, sometimes at mixed sizes and baselines. They exit with motion blur along the direction
   of travel.
6. **Transitions without cuts.**
   - *Morph:* the last object of one beat becomes the first object of the next (a button to squares to a card, a
     pill to a prompt, blocks to avatars, an outline to a line to a node diagram).
   - *Whip:* a 0.2–0.35 s move with directional motion blur.
   - *Focus pull:* the outgoing beat blurs from 0 to about 12 px while the incoming subject pops in sharp in front.
   - *Halftone iris:* a ring of brand-color dots opens and reveals the next shot inside it.
   - *Pixel burst:* the clicked control breaks into brand-color squares that re-form as the result.
7. **Real content as particles.** Fly avatars and cards past at several depths, with size, blur and speed set by
   depth. Never abstract dots or glows.
8. **Flat surfaces.** Cards are white with a faint warm tint and a hairline edge, and have little or no shadow.
   The product's own colors (a messaging app's blue, a calendar block) carry the color.
9. **A large cursor** (about 60–70 px on a 1080 frame). A click is what starts each morph.
10. **End card.** The logo builds, the tagline follows, then the only hold in the film.

## Fitting it to the walkthrough rules

- **Move with purpose; never float.** Walkthrough reviews rejected slow drift, several objects floating on their
  own, and the same zoom on every beat. This style moves all the time, but every move goes to the next subject, is
  fast and eased, and ends. Nothing drifts in place.
- **Scale instead of holds.** In this style, get readability from size and a camera that follows the reading
  point. Keep holds for the end card and for any real waiting state.
- **Show results on the product itself.** When an agent changes something, show the change happening in the
  artifact (its header, version chip and page), not as a floating before and after. A centered, struck-through
  headline on white reads as commentary, not as the product. Kinetic captions are for claims, not for product state.
- **Default to this style.** For a walkthrough or a feature launch, build the kinetic cut. The plain look with a
  caption band or text cards (`#F3F3F3`, the engraved chart, a browser frame, 1.4–1.9× zooms; `walkthrough.md`
  § Captions or cards) does not mix with this one; build it only when the user asks for it.
- **Sound.** The reference gets part of its energy from the music. A kinetic cut must still work with the sound off:
  everything on screen carries the meaning. When the user supplies a track, lay it as a bed (see § Music); composing
  music or a voice-over stays out of scope.
- **Brand.** Use the product's accent as the wet-ink accent and follow the product's own wordmark rules. Do not copy
  a reference film's palette.

## Feature launch films

The second kinetic build was a feature launch film: five cuts, all kept. Each row closed one review note.

| Rule | Why |
|---|---|
| Say the promise in words at the start and at the end. The opening types the feature's name ("Introducing <Feature>"); then the name shrinks into the start of the value-proposition sentence and the rest types in (4.6 s). The end card is the same sentence, then the brand line and one scope line. | The first cut showed the feature without saying what it does for the viewer. |
| When two things belong together (a figure in the lede and the same figure in a tile), frame both with one push. Never pan to one, then the other, then back. | Panning to one and back read as a left-to-right flicker. |
| A changed value needs different digits, not transposed ones (94.6 → 96.4 read as unchanged). Shoot it at 3.3–3.7× and hold the new value in the accent for about 1.4 s (`ink(…, settle)`). | The change was not obvious. |
| Show the path the audience will take. Drop capabilities they won't use, even when they exist, from the film and the copy. | An option the audience would not use took screen time. |
| The struck-through "No X. No Y." closer is optional; default it off for feature launches. | It read as filler in a feature launch; a walkthrough promo kept it. |
| After the main flow, give two or three features a one-word caption beat ("Checklists.") and a short shot of the real UI doing it. Then a slot reel spins through the rest and lands on "And more." Every word on the reel must be a feature that works today. | One flow undersold what the feature can do. |
| Fixture data must look real at a glance. | "ext. 214" read as a placeholder; a shift time ("06:00–14:00") did not. |
| Close-ups on a control show its real hover state before the press. Take the hover values from the capture. | At 3× a header that differs from the shipped one is obvious. |

Beats that worked and were kept through every cut:

- **Morph out of the pressed control.** The next surface (an editor) starts inside the pressed button's screen rect
  and grows to fill the frame (0.5 s, log-space scale, clip opening from the button's height).
- **Burst from the saved state into the next surface.** The saved version chip breaks into squares that re-form as
  the version pill on the published page.
- **Menus in one direction.** Camera on the open menu, pointer lands on the item, one whip to where the result lands.
  No return trip.

**The reel.** Words at 150 px in a window that shows one word, with neighbors squashed and faded above and below and
two hairlines at the window edges. Motion: rest while the whip lands (0.32 s), spin up over 0.2 s, cruise at 7.2 words
a second, a quadratic ease-out that overshoots the last word by a quarter word, then a 0.26 s settle onto it, and a
5 % scale pop. The first version front-loaded an ease-out cubic, so most words flew past during the whip; readable
passing words need the cruise. Vertical motion blur from the reel's speed, as for camera moves.

**Length.** The final cut ran 38.9 s against a planned 20–25 s. With an opening sentence, one hero flow, three feature
beats, the reel and a 4.4 s end card, 35–40 s is the honest length; cut features, not holds, to go shorter.

### Square cut from the same engine

`?sq=1` sets the frame to 1080×1080 in the same page, so both cuts come from one timeline:

- The world stays 1920 wide; each camera needs a square framing (usually a smaller `m` or a center nearer the
  subject).
- Captions are laid out in the frame (`left:0; width: VW`), never `left:0; right:0` inside the 1920 world. Scale
  caption type by about 0.74, and let long sentences take two left-aligned lines.
- Anything read must sit inside the faded edge; at 1080 wide a 120 px sentence reached it and dropped to 98 px.
- Plans carry `"w": 1080, "h": 1080, "q": {"sq": "1"}` (`plan-Ksq.json`); `render.js`, `audit.js` and `assemble.sh`
  read them. For previews: `VW=1080 PAGE=kinetic.html node <film>/previewq.js sq.jpg "beat=K&sq=1@9.2"`.

### Music

When the user supplies a track and a start point ("from second 30, the drop"):

- Find the hit, not the second: an RMS envelope in 0.1 s windows shows the dip before the drop and the transient
  (in one track the first hit sat at exactly 30.0 s).
- Start the film on the hit, with a 30 ms fade-in only against a click, and a 2 s fade-out on the end card.
- Level the bed with `loudnorm` to −16 LUFS integrated and −1.5 dBTP true peak, then check with `ebur128`.
- Mux into copies (`film-*-music.mp4`) and keep the silent films for surfaces that autoplay muted.
- Note where the track came from and that its license allows commercial use before the film is published.

```
# RMS per 0.1 s from 28 s on (44.1 kHz: 4410 samples per window)
ffmpeg -v error -ss 28 -t 4 -i track.wav -af "asetnsamples=4410,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-" -f null - \
  | awk -v s=28 -F'pts_time:|=' '/pts_time/{t=$2} /RMS_level/{printf "%.1f s  %6.1f dB\n", s+t, $2}'
# the bed: from the hit, film length L, levelled, then the fades
ffmpeg -ss 30.0 -i track.wav -t $L -af "loudnorm=I=-16:TP=-1.5,afade=t=in:d=0.03,afade=t=out:st=$(awk "BEGIN{print $L-2}"):d=2" -ar 48000 bed.wav
ffmpeg -nostats -i bed.wav -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary/,$p'
ffmpeg -i film-K.mp4 -i bed.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart film-K-music.mp4
```

## Engine notes

`templates/walkthrough/kinetic.html` is the example engine: a 21 s Tidewell film (lockup, a prompt typed as a
ticker, a burst into the result, a caption, an iris into the page, an in-line edit with a version change, the reel,
the end card). `new-film.sh walkthrough` copies it with the rest of the walkthrough template. It runs on the same
pipeline as `beats.html`: `plan-K.json` (`"page": "kinetic.html"`, one clip, `xf` 0) and `plan-Ksq.json` for the
square cut, with `render.js`, `audit.js`, `plan-jobs.py`, `assemble.sh`, and `previewq.js` with `PAGE=kinetic.html`.
Replace the shots and keep the engine. It mounts hand-built UI; when the UI must be the product's own at close range,
mount captured DOM instead (`live-dom.md`). Keep the two registers in separate pages: do not add these effects to
`beats.html`.

Its patterns:

- **One timeline, one camera per shot.** Each shot is a group (`.g` > `.gw`) with its own 2D camera and a time window.
  `DUR[]` holds the shot lengths and the section starts `ST[]` follow from it, so pacing changes in one place. Shots
  hand over through group-level transitions (`tin`/`tout`): a pan of one frame width in 0.4 s (sideways, or vertical
  with `up`), or a focus pull in 0.45 s.
- **Motion blur without extra frames.** An SVG `feGaussianBlur` per group, with separate x and y deviations set
  every frame from the camera's or the pan's speed: `blur = min(40, 0.18 × px per frame)` (about a 180° shutter).
  A factor of 0.45 smeared ordinary camera moves.
- **Wet ink.** `ink(el, text, t, t0, 16 cps, settle)` builds one span per word; a finished word goes from the accent
  to ink over 0.5 s. Mix in **oklab**: in oklch the hue swings through other hues on its way to the ink (a green
  accent passed through olive).
- **Caret-tracking ticker.** The camera x follows a continuous caret position (canvas `measureText` of the typed
  prefix, interpolated within the current character), with the text starting at about 300 px and the caret kept
  left of about 1250 px. Put the placeholder after the caret in the DOM, or it shifts the measured text start.
- **Iris and burst on one canvas** above the groups, both in the brand accent. The iris clips the incoming group with
  `clip-path: circle()` and draws a halftone ring of accent dots just outside it. Pass the burst plain
  `{x, y, w, h}` objects (`rr()`), not `DOMRect`s (they have `width`/`height`, and the burst silently drew nothing).
- **Measure hidden layout inside `seek`**, after the fonts have loaded, by showing the group for a moment.
  Measuring at load uses the fallback font's widths.
- **Hidden shots reset typed text** (`RESET`), so a frame never depends on the frames before it.
- **Pointers live in screen space**, drawn through their shot's camera, and fade out before the shot's transition:
  a pointer does not travel with its group. `audit.js` measures rests in screen space, so a pointer resting while
  the camera pushes does not list as a rest; check those moments in previews.

Bugs the builds found, now caught or fixed:

- **Stateful seek.** A render seeks through frames in order, a single-frame preview does not. Replacing an element's
  text wiped out the spans a helper had cached, so the edited headline was blank in the render and fine in every
  preview. `audit.js` now redraws sampled frames on a fresh page and flags any visible text that differs.
- **One-clip plans.** `assemble.sh` looped with `seq 1 0`, which counts down on macOS.
- **Borders.** Take radii, border widths and focus rings from the product's shipped CSS. At 2–3× zoom any mismatch
  shows: a 2px focus border read as a heavy double outline next to 1px fields. Scale radii with the film's larger
  controls (one build used 12px and 10px).
- **Frame edges.** Anything that has to be read, such as a send button, must sit inside the 6 % faded edge.
