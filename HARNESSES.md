# HARNESSES.md — per-host install paths and the supported-harness matrix

`product-film` ships in four mounts so every major AI coding agent host can pick it up. This file pins the install path per host and any quirks worth knowing.

## Mount layout

| Mount | Distribution channel | Install command |
|---|---|---|
| `product-film/` | canonical (this repo) | clone the repo |
| `skills/product-film/` | [`vercel-labs/skills`](https://github.com/vercel-labs/skills) | `npx skills add display-dev/product-film --skill product-film` |
| `hermes/design/product-film/` | [Hermes well-known](https://hermes.run) | discovered automatically by Hermes |
| `pi/agent/skills/product-film/` | Pi-coding-agent + OpenClaw and other Pi-built frameworks | Pi's `pi install` |

The mirrors are byte-identical to the canonical mount. `bin/sync-mounts.sh --check` runs in CI and fails on drift.

## Supported hosts

| Host | Discovery file |
|---|---|
| Claude Code | `~/.claude/skills/` (installed via `npx skills add`) |
| Cursor | `.cursor-plugin/plugin.json` (this repo's root) |
| OpenAI Codex | `.codex-plugin/plugin.json` (this repo's root) |
| GitHub Copilot Coding Agent | `AGENTS.md` |
| OpenCode | `AGENTS.md` |
| Hermes | `hermes/design/product-film/SKILL.md` |
| Pi / OpenClaw | `pi/agent/skills/product-film/SKILL.md` |
| Claude.ai | upload the canonical mount as a skill zip |

## Host requirements

The skill renders films on the machine the agent runs on. The host needs a shell and:

- Node 18 or later, with npm (Playwright is installed once per film folder by `templates/new-film.sh`);
- ffmpeg with libx264 (Route D masters also use ProRes; its VMAF gate needs an ffmpeg built with libvmaf and reports "not measured" without it);
- Python 3 (Route D makes a per-film virtual environment with numpy and Pillow).

Hosts without a local shell (Claude.ai, hosted chat) can read the skill and plan a film, but cannot render one.

## Per-host quirks

- **Claude Code.** Invoke with `/product-film`, or describe the film in plain language.
- **Cursor, Codex.** The manifests live at the repo root; the logo path is `./assets/logo.svg`, relative to the repo root.
- **Hermes.** The skill surfaces in the `design` category.
- **Pi / OpenClaw.** The Pi mount is rooted at `pi/agent/skills/product-film/` so frameworks built on Pi can pick it up without per-framework adapters.
