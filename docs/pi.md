# Pi extension

The extension lets a Pi session run an eval and publish its report here.

## Install

```sh
pi install git:github.com/acoyfellow/gleam-agents
```

The package is the repo root. It points Pi at `pi/index.ts`.

## Sign in

In Pi, run `/gleam-agents login`. It prints a short code and a link. Open the link, sign in with Cloudflare, check the code, and approve. The extension saves a token in `~/.config/gleam-agents/token` (mode 600). The token lasts 30 days. Signing out on the site revokes every token.

`/gleam-agents whoami` shows who the token belongs to.

## Tools

| Tool | What it does |
|---|---|
| `gleam_agents_run` | Runs a plan with `scripts/smoke.sh` and returns the recomputed score |
| `gleam_agents_publish` | Uploads a run's `score.json` and a markdown report to `/reports` |
| `gleam_agents_reports` | Lists published reports |

Set `GLEAM_AGENTS_URL` to use another instance. Set `GLEAM_AGENTS_REPO` to the clone that `gleam_agents_run` uses (default: the installed package folder).

## What the extension sends

Only the report you publish: the recomputed `score.json` and its markdown. It sends no prompts, no code and no model keys.
