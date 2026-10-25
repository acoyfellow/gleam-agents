# Catalog: agent shapes

A shape is one JSON file in `catalog/`. It says who the agent is. It does not say what the agent works on.

```json
{
  "name": "haiku45-native",
  "harness": "native",
  "model": "claude-haiku-4-5",
  "price_per_m": { "in": 1, "out": 5 },
  "max_turns": 30,
  "max_tokens": 16000,
  "tools": ["list_files", "read_file", "write_file", "edit_file", "grep", "run_tests", "done"]
}
```

| Field | Meaning |
|---|---|
| `name` | The id a plan uses |
| `harness` | The loop that drives the model: `pi` (the product harness) or `native` (the fixed control) |
| `model` | Model id sent to the Anthropic Messages API |
| `price_per_m` | List price per million tokens, for the cost column |
| `max_turns` | The run stops with `out_of_turns` after this many model calls |
| `max_tokens` | Output cap per call. Hitting it with no tool call ends the run as `ran_out_of_tokens` |
| `tools` | The tools this shape may call. A tool not on the list is refused |

## Tools

| Tool | What it does | Scope |
|---|---|---|
| `list_files` | Every file in the workspace | read |
| `read_file` | One file | read, inside the workspace |
| `write_file` | Create or replace one file | write list only |
| `edit_file` | Replace one exact, unique snippet | write list only |
| `grep` | Extended regex over the workspace | read |
| `run_tests` | The seat's `test_command` | runs in the workspace |
| `done` | Finish with a summary | — |

## Model endpoint

`fleet` calls `https://api.anthropic.com/v1/messages` with `ANTHROPIC_API_KEY`. Set `LLM_URL` to use a compatible gateway instead, and `LLM_TOKEN_FILE` for a gateway token file.

## Pi shapes

A `pi` shape runs [Pi](https://pi.dev) in the seat's workspace with `pi -p --mode json`. The seat gets no skills, no user extensions and no user MCP servers: only what the shape lists.

```json
{
  "name": "haiku45-pi-mcp",
  "harness": "pi",
  "model": "claude-haiku-4-5",
  "price_per_m": { "in": 1, "out": 5 },
  "max_turns": 10,
  "max_tokens": 8000,
  "max_minutes": 5,
  "tools": ["read", "write"],
  "pi": { "provider": "anthropic", "extensions": [] },
  "mcp": {
    "fixture": { "command": "node", "args": ["${FLEET_ROOT}/harness/mcp/fixture-server.mjs"], "exposure": "direct" }
  }
}
```

| Field | Meaning |
|---|---|
| `tools` | Passed to `pi --tools`. MCP tools of listed servers are added as `mcp__<server>__*` |
| `pi.provider` | A Pi provider name |
| `pi.extensions` | Extra Pi extensions for this shape, e.g. a provider or the ply workspace tools |
| `mcp` | Pi MCP server entries, written to a fresh agent dir for this seat only. Use `"exposure": "direct"` so the model sees the tools |
| `max_minutes` | Wall clock cap. The seat is killed after it and ends as `killed` |

Every Pi seat also loads `harness/pi/scope-guard.ts`. It blocks `write` and `edit` outside the seat's write list and logs every tool call to a ledger.

### Resume

Each seat has a fixed Pi session id and a session dir. If a seat dies, run it again with `FLEET_RESUME=1`. Pi reopens the same session and the agent continues with its full history. Receipt: `proof/resume-1/`.

### Edge workspaces

Add `harness/pi/ply-workspace.ts` to `pi.extensions` and set `tools` to `repo_list`, `repo_read`, `repo_edit`. The seat then has no local files: it reads and commits on its own branch of a git repo (for example a Cloudflare Artifacts repo) through [ply](https://github.com/ivarvong/ply). Set `FLEET_REMOTE`, `FLEET_REMOTE_TOKEN`, `FLEET_BRANCH`. Receipt: `proof/edge-1/`.
