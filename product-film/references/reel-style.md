# Reel style

A launch reel cut to music on flat brand plates. Each section is one claim and the real product doing it, and every
cut lands on the music's bar lines. Use it when a launch needs **breadth** in 25–35 s: a product or a release with
several capabilities, each shown once. For one flow told in depth, use the kinetic style (`kinetic-style.md`); for an
illustrated story, Route D.

It is a Route B film (product beats only) on the walkthrough pipeline: `templates/walkthrough/reel.html` with
`plan-R.json` renders, audits and assembles like the other walkthrough pages. The pointer and flicker rules in
`walkthrough.md` still apply.

The numbers below were measured on a 33.5 s reference reel at 1080p60 (4K masters), cut to a 126 BPM bed with no
voice, mixed to −14 LUFS.

## Structure

| Section | Bars | What happens |
|---|---|---|
| Range | 2 | A wall of the product's range (its templates, pages, designs) builds row by row, one row per beat. On the second bar the wall dims under a veil and a big claim types in at left, its second sentence in the accent. |
| Reveal | 2 | The drop. The wordmark focus-pulls in from blur (about 0.15 s), with a blinking caret. A mono feature line types word by word under it. On the second bar the wordmark shrinks to a small header and the tagline rises in, one line per half-beat, its second half in the accent. |
| The default | 2 | The problem as real artifacts, not words: the same generic result three times (or the same thing in three scattered places), stacked into a row and red-lined with small labels: code-like when the problem is technical (`font-family: Inter`), a handwritten red pen when it is human ("which version?"). The claim names the problem in one sentence. |
| Proof | 1 | One claim of proof ("We made this page with it", "Your client opens one link") with its key word tinted in the accent, and a real page sliding up in a browser window and scrolling. |
| Capabilities | 1–4 each | One section per capability: a mono kicker with the exact command or feature, a claim, and the product doing it. A section with several examples (three before-and-afters) gets 4 bars; a quick one gets 1. |
| Verbs | 1 | A list beat: the product's commands or options pop in one per half-beat; the newest is highlighted, the rest settle. |
| Setup | 2 | How to start: a command or prompt types in a field, a pointer clicks Copy → Copied ✓, and a status row shows the next state. The music drops back here. |
| End card | 2 | The hit. Wordmark with the caret, a mono tagline, a hairline, a mono feature line, a URL pill, and optionally a small maker line. |

The reference ran range, reveal, default, proof, four capability sections, setup, end. Keep the arc
(range → name → problem → proof → capabilities → start → end); the capability sections change per product.

## Timing on the music

| What | Value |
|---|---|
| Grid | One tempo for the whole film (126 BPM in the reference: beat 0.476 s, bar 1.905 s). Section boundaries fall on bar lines. |
| Section lengths | Main beats 2 bars, quick beats 1 bar, a multi-example beat up to 4 bars. The reference's bar lines fell at 0.005 s + n × 1.904 s; its cuts at 3.82, 22.87, 26.67 and 30.48 s sat on them and one (7.73 s) landed 0.11 s late. |
| Events inside a section | Wall rows on beats. Product state changes, list words and tagline lines on half-beats (0.24 s). Product clicks through options on half-beats too. |
| Drop and hit | The drop lands on the reveal (the wordmark); the second hit lands on the end card. Put a quieter stretch under the setup section so the end card has something to land on. |
| Track | Lay a track the user supplies (`kinetic-style.md` § Music for start point and loudness). Find its tempo and bar lines with `beatmap.py`, then set `BPM` and the offset at the top of `reel.html`. With no track yet, pick a tempo (120–128 BPM suits a launch) and cut to its grid, so a track can go under it later without re-timing. Composing music stays out of scope. |

A transition may start up to 0.1 s before the bar so that it lands on it. Never cut between beats.

## The look

| Rule | Why |
|---|---|
| Two flat brand plates, one dark and one light, alternating by section. No texture, grain, vignette, glows or particles. | The plate change is the reel's rhythm; texture fights the brand colours and the product screens. |
| Claims top-left, about 106 px from the left and 84 px from the top on a 1920×1080 frame, 64–72 px bold with tight tracking (−0.045em), one or two lines, ending with a period. | A fixed claim position lets the eye go straight to the product beside it in every section. |
| A mono kicker above each claim names the exact command or feature, in a faint pill on dark plates. | It ties each claim to something the viewer can type or find. |
| One accent: the second half of the tagline, one tinted word in a claim, the highlighted list word. | More accents compete with the product's own colours. |
| Product screens in clean windows with a soft shadow, at fidelity, playing their own loops where they have them. | The proof is the real product, not an illustration of it. |
| A small mono "Fictional brands" label bottom-right whenever made-up brands appear in product screens. | Viewers read polished fixtures as customers. |
| List words about 100 px; the range claim about 128 px, the reveal tagline about 106 px, the reveal wordmark about 230 px, the end-card wordmark about 190 px. | List beats read at a glance; the opening and the last frame belong to the name and the promise. |

## Motion and transitions

- **Text** rises in from a mask: clip the line box and translate the line up into it, one line per half-beat. No
  fades on text.
- **Typing** is a burst at about 50 characters per second with a caret, so a full setup prompt fits in one bar. This is
  faster than the kinetic style (16) or a walkthrough (25–32) because the reel never holds to read a prompt; the claim
  above it carries the meaning.
- **Lists** pop one word per half-beat; the newest word takes the accent (or a hand-drawn dashed box and a small
  sparkle), earlier words settle to the plate's text colour.
- **Pointer** only for a click that changes state (Copy → Copied ✓): arrive, press at scale 0.84, release.
- **Between sections:** a hard cut exactly on the bar for most boundaries. Between a light and a dark section inside a
  phrase: a plate wipe, the next plate rising from the bottom in 0.10–0.15 s. To leave a product section: a dive, the
  window scaling up to fill the frame over about 0.25 s, then the cut. No dissolves.

## Copy

- One claim per section, 3–6 words, a complete sentence with a period: "Comment on the exact line.", "Every version,
  same link.", "Start in one line." Claims come from the product's README, docs or landing page,
  checked against the truth sheet.
- The problem section's claim names what the audience lives with today ("Feedback lives in five places."); its artifacts
  prove it.
- The kicker is literal: the command, flag or menu item, as the product spells it.
- "Free" or "open source" qualifies exactly what is free or open; a reel moves too fast for footnotes.

## Template and commands

`templates/walkthrough/reel.html` (with `plan-R.json`) is a working Tidewell reel of 14 bars at 126 BPM (26.7 s):
range, reveal, default, proof, two capability sections, a verbs list, setup and the end card, with every device above.
Its first script holds `const BPM, OFFSET` and the `SECTIONS` table (id, bars, plate, entry `in: 'wipe'`, exit
`out: 'dive'`, kicker, claim, the "Fictional brands" flag); every time on the page derives from them, and
`window.SECTIONS` exposes the section times for previews and the review page's scene table.

```
python3 <film>/beatmap.py <track> [--start S] [--bars N] [--hits N]   # BPM, bar grid, strongest hits, a BPM/OFFSET line to paste
PAGE=reel.html node <film>/previewq.js out.jpg "beat=R@12.4"          # single frames
node <film>/audit.js plan-R.json                                      # pointer rests, one-frame jumps, stateful seeks
node <film>/render.js plan-R.json                                     # or PLANONLY + plan-jobs.py for parallel workers
bash <film>/assemble.sh plan-R.json                                   # film-R.mp4, film-R_master.mp4, film-R_720.mp4, poster-R.jpg, sheet-R.jpg
```

- `OFFSET` is the film time of the first bar line; before it the first section's plate holds as a lead-in.
  `beatmap.py` prints the track start point that makes it 0, and an ffmpeg line that lays the track under the film;
  level and fade it as in `kinetic-style.md` § Music.
- Times inside a section are beats from its bar line, and a dive counts back from the section's end, so giving a
  section more bars adds a hold at its end. Re-audit after any change to `BPM`, `OFFSET` or bars.
- Hard cuts need no marking for the audit: each section is its own element, hidden outside its bars.
- There is no square cut yet; recompose for 1:1 or 9:16 as a separate pass.

## Review page

Add a scene-by-scene table (time, section, what is on screen) under the player, then review notes and open questions.
A reel is too fast to discuss without timestamps, and reviewers comment against the table.

## Gotchas already paid for

- A product's preview or fixture stylesheet can override the colors a real user sees (dark previews rendered light).
  Check every captured screen against the shipped product before it goes on the wall.
- Captured internal tools carry internal names and real third-party product names (segment names in a title, an agent
  product named in mock comments). Scan every capture's visible text and replace them with fictional names.
- A 44 s first cut tightened to 24 s and settled at 33 s. Cut capabilities, not bars: a section shorter than one bar
  cannot be read, and the grid only works in whole bars.
