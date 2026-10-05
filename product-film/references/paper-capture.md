# Capturing real product UI (Route D)

Every product screen in a Route D film is **the product's real code rendering fictional data**: the web app on its
own dev server, the CLI, any other surface it ships. Route-fulfilled fixtures are fine; hand-built HTML replicas are
not. The two exceptions are the fictional artifact (a page written for the film) and the agent window, a neutral chat
window, because a real agent's UI brings third-party logos.

All harnesses live in `<film>/capture/`, read `capture/story.json`, write PNGs to `capture/shots/` and one manifest
per harness (`shots/manifest-<name>.json`, entries merged by file, so a partial run keeps the rest). They work from
any directory. Each ships with an example that runs as copied: Tidewell, a fictional shared-docs app, with its own
example web app and CLI.

| Harness | Renders | Command |
|---|---|---|
| `artifact/build.py` + `check-layout.mjs` | The fictional artifact's versions, one self-contained file each; the reflow gate | `python3 <film>/capture/artifact/build.py && node <film>/capture/artifact/check-layout.mjs` |
| `shoot-page.mjs` + `shoot.json` | Any local page with named boxes (the raw draft before it is published) | `node <film>/capture/shoot-page.mjs` |
| `agent/` | The agent window, every state, wide (1200×582) and narrow (720×652, for 9:16) | `node <film>/capture/agent/capture.mjs` and `… capture.mjs narrow` |
| `app/` | Your app on its own dev server, every API call answered by `fixtures.mjs` | `node <film>/capture/app/capture.mjs [scene …] [--dom]` |
| `cli/` | Your real CLI against a local fixture API, its output rendered in xterm.js | `node <film>/capture/cli/capture.mjs [run …]` |

Run them in that order: the agent window's card shows the draft screenshot, and the app and CLI serve the built
artifact versions. Fonts for the artifact go in `capture/fonts/`: `node <film>/tools/fetch-fonts.mjs --to
capture/fonts <file>=<Google family>` (OFL fonts only; record them in `notes/sources.md`). `setup.sh` fetched the
example's.

## Capture rules

- **Viewports.** Desktop 1280×800 at device scale 3; phone 390×844 at 3 with `isMobile` and `hasTouch`, so the app
  uses its real touch layout. The film zooms up to about 2.7× CSS size, and DSF 3 keeps text sharp there. Shoot a
  popup at its real popup size (`contextOptions('desktop', { viewport: { width: 420, height: 480 } })`).
- **Boxes from the live DOM**, measured just before each screenshot, in CSS px (`lib.mjs measure()`): `box:` for
  elements; `words:` for words, because an element box is not a word box (Range rects); `ink:` for glyph ink boxes,
  measured with canvas `measureText` in the element's own font, because a Range box spans the whole line box, much
  taller than headline capitals (one line only); `input:` for typed input values, which have no text node; `pixink:`
  for the ink box read from the screenshot's dark pixels, when the canvas measure is off. Zooms and circles target ink
  boxes. Boxes inside an iframe carry the iframe's offset (`_frames` in the app harness).
- **Clean frames.** No text caret, no dev overlay, no injected cursor: the film draws its own pointer. `INIT_SCRIPT`
  hides carets everywhere; `hygiene()` adds the clean-frame CSS as a CDP inspector stylesheet, not a `<style>` node, so
  pages that observe their own DOM do not react. Add the app's own fake carets in `story.json app.hygieneCss`. Park
  the real mouse off the page (`parkMouse()`) so no hover state shows.
- **Story clock.** Install the browser clock at the story's time (`page.clock.install({ time: story.clock })`; the app
  harness does it), so relative times read like the story ("2 min ago"). Fast-forward it to fire a poll instead of
  waiting (`clock.fastForward('00:31')`). Pause it to hold a timed state for a shot (`clock.pauseAt(…)`, then
  `resume()`); a paused clock also pauses `requestAnimationFrame`, so settle without it (`settle(page, ms, { raf:
  false })`).
- **In-flight states.** Hold a fixture response on a `gate()` to capture "Saving…", "Sending…" or "Verifying…"; open it
  for the next state.
- **Millisecond states.** A state that lasts milliseconds ("Saved. Opening…") is taken with `captureWhile()`: raw CDP
  polling, a screenshot the moment the text shows, and a check that it still showed. It warns when it misses; then cut
  from the state before to the state after.
- **Fiction only.** Names, emails and orgs come from `story.json`; avatars show initials. `assertCleanText()` warns on
  placeholder users, error strings and unrendered values ("Unknown user", "undefined", "Try again"…); add the real
  names that must never show to `app.leaks`.
- **Nothing reaches a real server.** `routeApi()` answers API calls from fixtures, lets the app's own hosts and
  `app.allowHosts` load, aborts `app.blockHosts` quietly (analytics, support widgets) and aborts and reports every
  other host. A run passes with zero unmocked calls and zero blocked requests. If the captures run your product's dev
  server, compare its repository's `git status --short` before and after a capture session: the dev server must write
  only ignored files. If a real publish ever becomes unavoidable, use a private throwaway item, delete it afterwards
  and list it in `notes/sources.md`.
- **Record what you learn.** The real code corrects the brief. Write each fact under "Facts the captures surfaced" in
  `notes/DECISIONS.md` and change the script to match, not the other way round.

## The fictional artifact

`capture/artifact/template.html` is a page written for the film, with its own fonts inlined. `story.json`
`artifact.versions[].fill` fills its placeholders per version. Story rules: every version keeps the earlier changes,
and a changed word is one the viewer has already read (the example moves the kickoff to "May 6" after the client asked
"Can we start in May?"). Avoid `vh` units in the artifact: the app shows it inside an iframe.

`check-layout.mjs` renders each version at 1280×800 and 390×844 and compares the boxes and visual line counts of
`artifact.layoutCheck` selectors. A reflow in a `swapViewports` viewport (default desktop) fails the gate: fix the
artifact's own layout and rebuild before any capture. Reflows elsewhere print as INFO; they are fine only while the
film never swaps versions in place in that viewport.

## Agent window

`agent/agent-window.html` draws a neutral chat window titled "Agent" from `agent/agent.json`: messages, typing dots,
tool cards (busy and done, with a preview of the page), a result line with the URL, and `scrollFrom` to drop the first
exchange when the second one starts. It has no tool name and no logo; `product` is your product's name as it appears
in the tool card. Its brand block holds only the accent. The film slides the window in at a state where the prompt is
already there. Its boxes include the URL as a Range box (`url1`), which is the zoom and circle target.

## App harness

`app/capture.mjs` opens your app on its own dev server and answers every API call from `app/fixtures.mjs`; no
backend or database runs. It writes `shots/manifest-app.json` and `app/last-run.json` (each scene's API calls, unmocked
calls, blocked requests and leak warnings) and exits 1 when anything is unmocked or blocked. `--dom` also saves a DOM
snapshot of each shot in `shots/dom/` (§ The capture library).

As shipped, `story.json app.baseUrl` is null and the harness serves the example app in `app/example-app/`. It is small
but has the traps real apps have: relative times, a version poll every 30 s, a one-time notice for a new browser, a
closed shadow root, CSSOM-only rules, a telemetry call to another host, a code form that submits itself on the last
digit and a status that shows for about 120 ms. Its scenes show the pattern for each: `share` (a share dialog: type an
address in three steps, tick an option, Save → Saving… → Saved), `page` (a new version while the tab is open: the poll
offers Refresh, one click loads v2 at the same URL) and `signin` (an invited sign-in on a phone: send the code, five
digits, then the sixth, which submits the form, so the "Verifying…" frame is the last one with all six digits; then
Verified, "Opening page…" over raw CDP, and the page).

To point it at your product:

1. Start your dev server. Point the server's own server-side API URL, if it has one, at a port nothing listens on:
   server-side fetches never pass through the browser, so a missed one must fail loudly instead of reaching a real
   backend. Stop the server when you finish.
2. Set `story.json app`: `baseUrl` (the dev server), `hostMap` (hostnames resolved to 127.0.0.1, when the app needs a
   real-looking host), `apiPrefixes` (where the browser sends API calls: a path on the app's origin or another origin),
   `allowHosts`, `blockHosts`, `testIdAttribute`, and `returningUser`: the localStorage keys that hide one-time notices
   for a returning browser. Grep your code for `localStorage`; the keys are often versioned.
3. Answer every call in `fixtures.mjs` and replace the example scenes at the bottom of `capture.mjs`.

## Writing a new capture flow

A new film usually needs new states. Build them from the real code, never as replicas.

1. Read the screen's components and note every test ID, every API call it makes (method, path, body, headers such as
   ETag and If-Match) and its loading and error strings. Take strings from the code, never from memory.
2. Add each call to `fixtures.mjs`, answering as the real API would: the status, the JSON shape, an ETag on reads, 412
   on a stale If-Match. Keep the values in `story.json` so every harness shares them.
3. Copy an example scene as the pattern: `newScene()` (kind, state, gates), open the route, act with trusted input
   (`typeSlow`, `clickCenter` on test IDs), use `gate()` for an in-flight state, and call `shot()` after each state
   with boxes for everything the film will point at or zoom into. Register it with `run('<name>', …)`.
4. Run it. `last-run.json` must list zero unmocked calls and zero blocked requests, and no leak warnings. Look at every
   PNG.

## CLI

`cli/capture.mjs` runs each `story.json cli.runs` entry in `cli/work/` (after copying its files there) with the CLI's
base-URL variable (`cli.baseUrlEnv`) pointing at `cli/fixture-api.mjs` and its key variable (`cli.keyEnv`) set to a
fake key, so the output is the CLI's own text with fictional data. `render-term.mjs` writes that output into xterm.js
5.5.0 (downloaded once) in Geist Mono and screenshots each typing state with row boxes. `typed` is what appears on
screen; `run` is what executes. The example runs `cli/tidewell.mjs`, a stand-in: set `run` to your CLI, answer the
calls it makes in `fixture-api.mjs` `ROUTES` (`api.log` lists every request), and check that the run reports zero
unmocked calls. A CLI with no base-URL variable cannot be captured safely; add one before filming it. Prefer the agent
window to show an AI agent at work; use a terminal when the film is about the CLI itself.

## The capture library

`capture/lib.mjs` is shared by every route (new-film.sh copies it into each film folder). It imports no Playwright:
harnesses pass in their page, context, CDP session and browser.

| Export | Use |
|---|---|
| `loadStory()`, `CAPTURE`, `FILM`, `SHOTS` | The story and the folders |
| `KINDS`, `contextOptions(kind, extra)` | The desktop and phone capture contexts (light, en-US, UTC, service workers blocked) |
| `INIT_SCRIPT` | Hides carets and forces every shadow root open; add it before the first navigation |
| `hygiene(cdp, css)`, `settle(page, ms)`, `parkMouse(page)` | Clean frames |
| `typeSlow`, `clickCenter` | Trusted input |
| `measure(frame, spec)`, `frameOffset(frame)`, `inkBoxes(browser, png, dsf, regions)`, `MEASURE` | Boxes |
| `manifest(name)` | A manifest merged by file |
| `routeApi(context, opts)`, `gate()` | Fixtures, host rules, in-flight states |
| `assertCleanText(page, extra)` | Leak warnings |
| `captureWhile(cdp, expression, opts)` | Millisecond states over raw CDP |
| `snapshot(page, file, opts)` | A static DOM copy of the page for live-DOM films |

`snapshot()` saves the page as one HTML file that renders like the live page when opened from disk: every stylesheet
inlined (linked, adopted, and CSSOM-only rules written back as text), open shadow roots as `<template
shadowrootmode="open">` (closed ones are forced open by `INIT_SCRIPT`), property state mirrored into attributes
(`checked`, `value`, textarea text, `selected`, scroll offsets as `data-snapshot-scroll="top,left"`), scripts and
inline handlers removed, iframes inlined as `srcdoc`, and assets inlined as `data:` URLs. It cannot save `:hover` or
`:focus` styles; pin those values inline before the snapshot.

## Facts captures surface

Captures correct the brief. These kinds of facts came up in real builds; look for them in every new film.

- **A form submits itself.** A one-time-code form submitted on the last digit, so the state after the last key showed
  "Verifying…", and the frame before it was missing a digit.
- **Relative times move.** "2 min ago" reads wrong unless the clock is pinned to the story's time.
- **Names resolve late.** A widget showed "Unknown user" until a profile poll ran a minute later.
- **A fresh browser sees one-time notices.** Policy, referral and changelog banners appear unless the returning-user
  keys are set.
- **Some states last milliseconds.** A "Saved. Opening…" status was gone before a normal screenshot finished.
- **Buttons do something other than their name.** An Edit button copied a prompt instead of opening the editor;
  check what each control the film shows does in the code.
- **Permissions differ from the brief.** A truth sheet said anyone could comment; only signed-in members could.
- **Third-party logos hide in standard flows.** A general sign-in page showed third-party sign-in buttons; an invited
  flow with one button did not.
- **Copy differs between steps.** One screen said "verification code" and the next "one-time password". The UI stays
  as it is; captions use one term.
- **Paid features look universal.** A version-history list was a paid-plan feature; the film showed version labels
  instead.
