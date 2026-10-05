# Paper collage: lessons and pitfalls (Route D)

Every failure a full paper build hit, plus the few found while turning it into `templates/paper/`, with what caused
each and the fix that held. Most fixes are built into the template; the rest are rules to apply by hand. Read this
before building scenes and before every review.

## House look rules

They came out of review rounds on real cuts and override a brief where they conflict.

| Rule | Why |
|---|---|
| Give the cast muted color: one skin tone, one hair color and one garment color each (mustard, coral, plum, charcoal trousers; never the accent's hue). Faces, glasses and hand details stay marker ink. | An ink, off-white and gray cast read as colorless and was rejected. |
| Paper only where it tells the story: the cast, caption strips, marker labels and doodles, speech bubbles, problem vignettes, tags, the crowd. | Paper on every surface read as a theme, not a story. |
| Product UI in clean windows: rounded, traffic-light bar, URL pill, soft shadow; no photo border, grain or tape. A clean black phone. | Prints on photo paper with tape made the product look like a prop. |
| A flat end card: the wordmark, a headline, a plain accent pill, the URL, on the plate. No paper card, tape or puppet. | A paper end card buried the call to action. |
| Show an AI agent as a neutral agent chat window, not a terminal, with no tool names or logos. | A terminal undersold how most people use an agent, and a real agent's UI brings third-party branding. |
| Background: the engraved chart (`tools/make-chart-bg.mjs`), not dot fields. | Dot fields and a halftone border read as a frame around the film. |
| Show every digit of a one-time code. | A frame with five of six digits read as a mistake. |
| Sound like a pen writing: toneless, high-passed, no thumps. | Pitched pops and low bodies read as unpleasant, not as paper. |
| No glows, particles or constant drift; things hold still between deliberate moves. | Floating items read as unsteady, and glows tinted the UI. |
| Zoom only onto the item the beat is about, then return. Leave some beats wide. | The same zoom on every beat reads as a template. |
| Hold 0.5–1.0 s on each key moment with the pointer at rest. When in doubt, slower. | Viewers could not read the text in two earlier films. |
| The jitter belongs to the collage. UI text never boils, wobbles or blurs. | The product must read as the real product. |

## Workspace and tooling

| Symptom | Cause | Fix |
|---|---|---|
| Work lost mid-run | A temporary folder was wiped by a session restart | Build in a folder that persists; `new-film.sh` refuses temporary folders |
| `fetch()` fails, the film page never loads | `file://` pages cannot fetch the timeline or the kit manifest | Serve the film folder over http (`tools/static.mjs`); every script already does |
| A script cannot find a file in a folder with a space in its path | `new URL(…).pathname` percent-encodes spaces | Use `fileURLToPath` (the templates do) and quote shell variables |
| `require('playwright')` fails from a film folder | Playwright is not installed where the script runs | Every script loads it through `<film>/pw.cjs`; `new-film.sh` installs it once per folder, or set `PLAYWRIGHT_DIR` |
| `pip install` refused | PEP 668 | The film's `.venv` (numpy, Pillow), made by `setup.sh` |
| No burned-in timecodes | Some ffmpeg builds have no `drawtext` | Name frames by index; review sheets label times with Pillow |
| VMAF missing from the checks | The ffmpeg has no libvmaf | `check-master.sh` writes "VMAF not measured" and `gates.py` exits 2; install an ffmpeg built with libvmaf |
| A reference-library connector unavailable | It needs an interactive sign-in an unattended session cannot do | Fall back to open references and note it |
| The second reviewer model unavailable | Out of quota | Use another available model or a subagent, and record which |
| The CLI harness hung | A synchronous child process blocked the fixture API in the same process | Run the CLI asynchronously (the template does) |

## Capture

| Symptom | Cause | Fix |
|---|---|---|
| The one-word edit made the page jump | At 1280 px the new headline wrapped to two lines, the old one did not | Fix the artifact's layout (a wider text column) and re-shoot; `check-layout.mjs` gates it |
| Zoomed UI text soft | Captured at DSF 2 at 1440 px | Desktop 1280×800 at DSF 3, phone at DSF 3 |
| The film claimed a click opened the editor | The button copied a prompt; the editor lived at its own URL | Read what each control does in the code; show the editor print replacing the page print with no click |
| The truth sheet said anyone can comment | Only signed-in members could comment | Only a member comments on screen, labeled "teammate"; the client only views |
| Third-party logos on screen | A general sign-in page showed third-party sign-in buttons; a demo had a rail of tool logos | Use a flow without them (an invited sign-in with one button); leave the rail out; name tools in text |
| The one-time code missed its last digit | The form auto-submits on the last digit, so the state after five digits was the last full frame | Capture the "Verifying…" frame: it shows every digit |
| A reply showed "Unknown user" | The widget resolved new authors on a 60 s profile poll | Fast-forward the clock past the poll before the shot; `assertCleanText` warns |
| A banner in the first app shot | One-time notices (policy, referral, changelog) for a new browser | Set the returning-user localStorage keys (`app.returningUser`); they are versioned, re-read them |
| "Saved. Opening…" missing | The status lasted milliseconds before the next page replaced it | `captureWhile()` polls over raw CDP and screenshots while the text is present; accept the settled state if it misses |
| Zoom and circle targets too tall | Range boxes span the whole line box, far taller than headline capitals | Use glyph ink boxes (`ink:`, or `pixink:` from the screenshot) |
| A circle landed beside the word | The canvas ink box was measured in the parent element's font | Measure in the element that holds the text (fixed in `lib.mjs`); compare `ink:` with `pixink:` when in doubt |
| A DOM snapshot lost a focus ring | `:focus` and `:hover` are live states, not markup | Pin those values inline before `snapshot()`, or accept the unfocused state |

## Kit and engine

| Symptom | Cause | Fix |
|---|---|---|
| A piece silently changed shape | Two kit pieces shared a name and the second overwrote the first | Names are `<character>.<part>`; `export.html` throws on a duplicate |
| 4K frames took seconds each | Each marker stroke drew into a full-frame offscreen canvas | Stroke-sized offscreen canvases in device space (`kit.js marker`) |
| Every render worker held every capture in memory | All shots preloaded in each of 6–7 workers | Scenes declare `shots()`; a worker preloads only its range (`t0`/`t1`) |
| A mistyped cue drew at the scene start without any error | `cue()` fell back to 0 for an unknown name | An unknown cue, shot or box is an error in the render (strict mode) and a warning with a placeholder in preview |
| Captions stepped between motion steps (a "1 s cadence") | Caption steps ran from each caption's start, often an odd frame | Caption steps use the same 2-frame grid as motion |

## Story and cuts

| Symptom | Cause | Fix |
|---|---|---|
| The hero drawn twice for a few frames at two cuts | The outgoing scene slid the hero out while the incoming scene drew the hero again | Carry one character: the outgoing scene stops drawing; the incoming one `hop`s the character from where it was |
| The same page window drawn twice in the late transitions | Each scene drew its own copy of the window | Carry one window and move or scale it in place (on 2s); clear everything before the end card |
| An empty agent window at the turn | It slid in before its first message | Slide it in with the prompt already there |
| A caption said something the screen did not show | "The agent reads the comment" with no reading on screen | Add the beat (the agent window returns and quotes the comment) or cut the claim |
| Viewers read the client as the commenter | Two new faces in a row with no names | A name tag ("Priya · teammate") and a label on the client ("client") |
| A later edit felt arbitrary | The new word had no cause | The comment or question contains the new word; the new version keeps the earlier change |
| A plan claim ("unlimited X on every plan") risked implying plans | Plan claims in a pinned film | Say what the product does; no prices, no plan names |

## Layout and formats

| Symptom | Cause | Fix |
|---|---|---|
| Labels, "same URL" or bubbles under platform UI in 9:16 | Placed in the top 250, bottom 480 or right 150 px | `guides=1` in preview; the review sheet draws the safe-zone box; move labels beside the target |
| A window clipped at the frame edge in 9:16 | A zoom that fits 16:9 overshoots in a narrow frame | 9:16 zooms less, or the agent window stays at base framing |
| A label cropped by the zoom | The label was written during the zoom | Write it after the zoom-out, or inside the zoomed area |
| A name tag sat over a button in 9:16 | The tag stayed during the zoom | The tag leaves when the zoom starts, or arrives after it |
| A name tag hidden under the caption | Placed in the caption band | Keep tags and bubbles above the caption strips in every format |
| Captions hard to read on a phone | 50 px captions at 390 px width | 56 px in 16:9, 58 px in 9:16; check the 390 px sheet |
| The halftone read as a frame | A dense accent-color dot border | Toned down, then replaced by the engraved chart |
| The agent window's text unreadable in 9:16 | The 1200 px window scaled down | A 720 px narrow capture for 9:16 |
| The comment and its change could not share a readable 9:16 frame | The page is too wide | Show the thread as a taped cut-out beside the page |
| The end-card headline clipped in 9:16 | The 16:9 scale was reused | A smaller end-card scale in 9:16 |

## Review, encode and deliver

| Symptom | Cause | Fix |
|---|---|---|
| Flicker and double draws missed in stills | You read frames, not video | Transition strips (every frame ±0.5 s) and the difference trace; every spike must match a timeline event |
| Frames dropped, audio drifted | Joining H.264 chunks by stream copy | One ffmpeg pass over numbered frames into ProRes; check exact frame count and zero timing jumps |
| VMAF misaligned frames for AV1 | A WebM's 1 ms timebase | AV1 in MP4 (1/30 s timebase) |
| Colors shifted between players | Tags that did not match the pixels | Convert with `scale=out_color_matrix=bt709:out_range=tv` and tag bt709 primaries, transfer and matrix |
| The web set was not ordered by size | CRFs not tuned for this content | Read `deliver/web/vmaf.txt`; at VMAF ≥ 96 the order should be AV1 < HEVC < H.264 |
| A review page over the host's upload limit | Videos are embedded as base64 | 720p CRF 24, a 1080p CRF 22 download, 9:16 at 540×960 CRF 25; `build-review.py` warns over 45 MB (50 MB fits most hosts) |
| ffmpeg in a loop ate the loop's input | ffmpeg reads stdin | `-nostdin` everywhere (the templates have it) |

## Sound

The first set was rejected in review as unpleasant and unlike writing. Measured cause: a stick-slip marker squeak
with 50–60 % of its energy at 300–1,200 Hz and spectral flatness 0.05; pops sweeping 900 → 260 Hz (flatness 0.007);
clicks, keys and an end-card stamp with 48–98 % of their energy below 300 Hz. The v2 set in `sfx/synth.py` has no
pitched tones and is high-passed at about 420 Hz: labels are 3–5 short pen strokes with lifts, circles one continuous
scratch that speeds through the curve, Xs two quick strokes, pops toneless pen-tip taps. Measured: 0 % below 300 Hz,
centroid 4.7–6.7 kHz, flatness 0.2–0.35. A crowd's 23 taps were thinned to 12. `sfx/measure.py` flags PITCHED and LOW
sounds.

An agent cannot listen. Measure every sound, and tell the user the sound is unheard and needs their ears.
