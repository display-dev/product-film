# Publish and review on display.dev

Every film is reviewed on one display.dev page: the review page (cut, poster, what changed, scene table) is published
there, each new cut becomes a new version of the same page, and feedback arrives as comments on it. This is the only
step that reaches an external service, so where it goes is settled once per film (`SKILL.md` § Inputs, 6): the
project's `FILM.md` answers it, or the agent asks once at kickoff. The answer lives in `review/.publish`:

| `review/.publish` | What every cut does |
|---|---|
| `company` | Publish for the team (company visibility). The default answer to offer. |
| `share:<email>,<email>` | Company visibility plus the named reviewers. |
| `private` / `public` | That visibility. `public` only when the user chose it. |
| `anonymous` | A 30-day preview link with no account behind it (tier 3). Only on an explicit yes; it cannot be versioned. |
| `no` | Build the page and publish nothing; the reply gives the file's path. |

With an answer recorded, every cut follows it without asking again. `tools/review.sh` in every film folder reads it and
does the build and the publish in one step (tiers 2 and 3 below; `--build-only` for tier 1); with no answer recorded it
builds the page and stops so the agent asks. `assemble.sh` prints it as its last line.

## Transport: the first one available wins

Detect at run time, in this order. Do not retry across tiers.

1. **MCP.** If the host's tool list has a display.dev `publish` tool (an OAuth-connected remote server, or a local
   stdio bridge), call it. Remote MCP takes `content` (the HTML string); local MCP takes `content` or `file_path`.
   Both need `name`; pass `visibility` when the user named one.
2. **CLI.** If `dsp` is on `PATH` (or `npx -y @displaydev/cli` works), use it. It is the tier for versions,
   visibility, sharing and comments:

   ```sh
   dsp publish <film>/review/review-vN.html --name "<Film title> – review" --company --client-source product-film-skill@0.3.0
   ```

3. **Anonymous helper.** With neither, run the bundled helper. It needs no account: it returns a 30-day preview URL and
   a claim URL the user can sign up against. It cannot version, share or read comments; after the user claims the
   page, later cuts go through the CLI.

   ```sh
   bash $SKILL_DIR/scripts/publish.sh <film>/review/review-vN.html --name "<Film title> – review"
   ```

   `scripts/_common.sh` resolves the bundled jq (`bin/`), the API URL (`DISPLAYDEV_API_URL`, production by default)
   and attribution.

If the host has no shell, go straight from tier 1 to telling the user where the file is.

## One page per film, one version per cut

`tools/review.sh vN <film.mp4> "<title>"` follows these rules: the first run publishes with the recorded visibility and
keeps the page's shortId in `review/.shortid`; every later run reads the current version and publishes the new cut onto
it (the page keeps its visibility).

- **First cut:** publish with company visibility (`--company`, the CLI default) unless the user named another;
  reviewers are usually the team. Use `--share-with <emails>` to add outside reviewers by name, `--visibility public`
  only when asked.
- **Every later cut:** a new version of the same page, never a new page:

  ```sh
  dsp get-metadata <shortId>            # read currentVersion first
  dsp publish <film>/review/review-vN.html --id <shortId> --base-version <currentVersion> --client-source product-film-skill@0.3.0
  ```

  `--base-version` must equal the current version; a mismatch means someone else published since, so read the page
  before overwriting it.
- Record the shortId in the film's `NOTES.md`, next to the current cut.

## The review page

Self-contained HTML, one file: transports publish a single file and do not upload a separate video, poster or image,
so embed them as base64. Keep it under 50 MB (the routes' review builders re-encode the review copy to fit, and
`build-review.py` warns over 45 MB). On top: the player and poster, then "What changed since vN", then a scene-by-scene
table (time, section, what is on screen), then decisions and what only the user can judge (taste, the sound). Offer
the MP4 as a download from the page and send it as a file too.

## Loop on comments

Reviewers comment on the page, anchored to the part they mean. Read and answer them there:

```sh
dsp comment list --artifact <shortId> --status open --actor-name <agent-name>
dsp comment add --artifact <shortId> --parent <rootCommentId> --body "Changed in v4: ..." --actor-name <agent-name>
dsp thread resolve <rootCommentId> --actor-name <agent-name>
```

Batch a round of changes into one new version rather than many small publishes; each publish is a version reviewers
see in the history. Reply to each thread with what changed and in which version, resolve it once the new version is
up, and leave taste calls the change did not settle open for the user. Record durable notes in the project's
`FILM.md`. Pass `--actor-name` on every call so the agent's work is attributed to the agent, not to the person whose
login the CLI uses.

## After a publish

Tell the user, in plain prose:

- the URL, first;
- the shortId (the handle for the next version);
- one line on what was published (the film and the cut);
- for an anonymous publish, the claim URL and that the preview expires in 30 days unless claimed;
- one question about the next step.

Leave out transport details, headers and analytics fields. On failure, say what to do next (sign in with `dsp login`,
retry, check the network) instead of pasting the raw error.
