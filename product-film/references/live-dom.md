# Live product UI from captured DOM (Routes B and C)

Use this when a film shows product UI at close range that must also move: text typed into it, a hover state, a
menu opening, a version chip changing. Route D composes screenshots; screenshots go soft past about 2.7× and cannot
be typed into. Here the film mounts the product's own markup and CSS, captured from the running code with fictional
fixtures, and animates it like any other DOM.

One feature launch film was built this way: everything on screen was the product's real editor shell, toolbar, live
preview and page header; only the fictional document was written for the film. The steps are capture, extract and
mount; the mounting page is a kinetic or walkthrough engine page (`templates/walkthrough/`).

## 1. Capture

Follow `paper-capture.md` for the shared harness rules: the app on its dev server with every API call answered by
fixtures, fictional names only, nothing published, the user's repo unchanged (`git status` before and after). Then,
for each state the film needs, save a **DOM snapshot** as well as a PNG with `snapshot(page, file)` from
`capture/lib.mjs`. The paper template's app harness is a working harness of this kind: copy
`templates/paper/capture/app/` and `templates/paper/capture/story.json` into the film's `capture/` folder, point
`story.json` `app` at your dev server, and run `node <film>/capture/app/capture.mjs --dom` to save a snapshot of every
shot. A snapshot is one static HTML file that renders like the live page:

- `outerHTML` of the page with every stylesheet inlined as `<style>`, including rules a library inserted through the
  CSSOM (editors do this), written back as text. Scripts are removed.
- Open shadow roots serialized as `<template shadowrootmode="open">`. A **closed** shadow root (a component that
  closes its root in production) must be forced open for the capture: add the library's `INIT_SCRIPT` to the
  context before the page loads.
- State that lives in properties, not attributes, mirrored into attributes: checkbox `checked`, input `value`, scroll
  offsets (`data-snapshot-scroll="top,left"`). A `:hover` style cannot be saved; pin the hovered values inline.
- Chrome your server injects into a page (a header bar, a viewer frame) can be rendered by calling the real server
  function with fixture data and serving the result through Playwright routes.
- For a sequence (select → command → result), capture one snapshot per state in **one continuous session**, so each
  state keeps the earlier changes.

Write what the capture teaches into a notes file next to the snapshots: exact strings ("Save changes", never
"Save"), toolbar order, which command lives in which menu, hover values, scroll positions, and anything broken. One
capture found that a menu command was disabled outside the context the script assumed, that images rendered at
their natural width, and a real bug in the product (a trailing space dropped the next keystrokes).

## 2. Extract

A script, written per product because it depends on the product's DOM, reads the snapshots and writes one
`parts.js` with the pieces the film mounts: for example the header, the toolbar, a whole editor shell, a header bar,
and each state's styles. Replace `:root` with `:host` in every stylesheet, so the product's tokens apply inside a
shadow root. Re-run it whenever the snapshots change.

## 3. Mount

- One shadow root per product surface (editor chrome, page header, each captured state), so an app's 120 KB of
  CSS never touches the film's own styles. A toolbar that lived in its own shadow root gets a nested one.
- The film's fictional document sits in light DOM under the chrome, so the film controls its text directly.
- A sequence of states is a stack of shadow hosts in one window; show one at a time and switch on a click or
  under a whip. Unchanged regions are identical, so only the changed part appears to change.
- Drive state with small setters that set every property on every frame (version text, unsaved dot, Save
  disabled, a "Saving…" strip, which mode button is pressed), never with toggles that depend on the previous frame.

## Gotchas this build paid for

- **Fixed popovers.** Menus are `position: fixed` in the app, so in the film they anchor to the nearest transformed
  ancestor: the whole shot, not the app window. Give the window `transform: translate(0,0)` to make it the
  containing block, as the viewport is in the app.
- **Images in shadow roots are not in `document.images`.** Decode them yourself and expose the promise as
  `window.READY`; the walkthrough template's `render.js`, `previewq.js` and `audit.js` await it. Without it an
  inserted image rendered blank in some frames.
- **Fonts.** `@font-face` rules inside a shadow root are ignored; load the product's fonts in the document.
- **Scroll.** A hidden layer loses its scroll position. Apply snapshot scroll offsets as `translateY` on the
  scroller's children instead of `scrollTop`.
- **Positions.** `offsetParent` chains stop at a shadow boundary. Measure world coordinates from
  `getBoundingClientRect` relative to the shot's world layer, divided by its scale, after the fonts load.
- **Hidden shots keep typed text.** A shot that typed into the DOM and is now hidden must reset that text, or a frame
  reached by seeking differs from one reached on a fresh page and `audit.js` reports a stateful seek.
- **Large captures.** Text that must stay readable at 3× needs a 3× capture or live DOM; a 2× PNG at 3× is soft.

## Stills from the same captures

Marketing stills come out of the same session: a tighter viewport (1120×720 at DSF 3) frames the header and the
content together, which 1600-wide captures cannot. When one value in a still has to change later (one build
replaced a phone extension with a shift time), change it in the saved DOM snapshot and re-render it, rather than
running the capture again.
