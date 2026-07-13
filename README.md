# fantasy-football

An informational fantasy-football **stats & insights** app — pick a player and an AI **research
analyst** fetches current data and gives a fantasy outlook, with the live research trace and cited
sources. Not a league/head-to-head platform.

Built on the **[`agent-harness`](../agent-harness)**: this repo owns the fantasy-football domain
(tools, prompt, data, UI); the harness owns the model/agent machinery. You bring your own model
(any OpenAI-compatible endpoint).

**Status:** v1 working (a deliberately bare-bones probe).

## What it does

- **Search** an NFL player → see a **stat card** (from a local nflverse snapshot).
- **Evaluate** → the analyst does consent-gated web research (`web_search` + `fetch_url`) and streams
  a season-outlook verdict with sources. The event trace and Approve/Deny consent are shown live.

## Prerequisites

- **Node 22+** and **pnpm**.
- The **`agent-harness`** repo checked out as a sibling (`../agent-harness`) and **built** (run
  `pnpm build` in that repo so its `dist/` exists; the app links it via `file:../agent-harness`).
- A running **OpenAI-compatible model** endpoint with **tool-calling** enabled (see [Model notes](#model-notes)).
- A running **SearXNG** instance for `web_search` (e.g. `docker run -d -p 8888:8080 searxng/searxng`),
  reachable at `http://127.0.0.1:8888` by default.

## Setup

```bash
pnpm install
pnpm ingest        # one-time: downloads a public nflverse snapshot into data/ (gitignored)
```

## Run (two terminals)

```bash
pnpm serve         # sidecar: the app's stats HTTP API + the harness WebSocket server
pnpm dev           # the web UI — open the localhost URL it prints
```

Then, in the UI: search a player → select → **Evaluate** → approve the tool-call consent prompts →
watch the verdict stream in.

## Configuration

All optional — sensible local defaults are used if unset. Set them in your shell or a local `.env`
(the repo ignores `.env`; never commit real keys).

| Variable | Default | Purpose |
| --- | --- | --- |
| `MODEL_BASE_URL` | auto-detected | Your model's OpenAI-compatible base URL. If unset, it's probed on `MODEL_PORT` (the WSL→Windows gateway is handled automatically). |
| `MODEL_PORT` | `5174` | Port used when auto-detecting the model URL. |
| `MODEL_NAME` | `local` | Model name/alias sent to the endpoint. |
| `MODEL_API_KEY` | _(none)_ | Only if your endpoint requires a key. |
| `SEARXNG_URL` | `http://127.0.0.1:8888` | Your SearXNG instance for `web_search`. |
| `HARNESS_PORT` | `4000` | Harness WebSocket port. |
| `APP_API_PORT` | `4100` | App stats HTTP API port (the UI proxies `/api` here). |
| `HARNESS_TOKEN` | `dev-token` | Local handshake token (dev only — not a secret). |
| `SEASON` | `2025` | Season for `pnpm ingest`. |

## Model notes

- The model **must support tool-calling**, and your server must be started with tool-calling enabled
  (for `llama.cpp`'s `llama-server`, that's the `--jinja` flag).
- **Reasoning models:** use a chat template that emits tool calls in the structured format. Some
  templates let the model draft tool calls *inside* its reasoning, where the server won't parse them —
  swap in a tool-calling-aware chat template (`--chat-template-file`) or disable thinking for the task.

## Architecture

- **Sidecar (Node, `pnpm serve`):** one process running the app's stats HTTP API (deterministic
  nflverse facts) **and** the harness server hosting the analyst agent + its tools + consent + the
  event stream.
- **UI (browser, `pnpm dev`):** a `HarnessClient` over a localhost WebSocket; renders the chat,
  live trace, consent prompt, and the streamed verdict.
- **Data split:** structured player stats come from the app (a frozen nflverse snapshot); current,
  qualitative info comes from the agent's live web research.

## Scripts

```bash
pnpm ingest        # pull the nflverse snapshot into data/
pnpm serve         # run the sidecar (app API + harness server)
pnpm dev           # run the Vite UI
pnpm test          # unit tests (vitest)
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
pnpm build         # production build of the UI
```
