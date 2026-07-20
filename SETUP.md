# Setup & reproducible dev flow

Fantasy-football app + its `agent-harness` library. This is the full, reproducible sequence — no
hidden steps. (Placed at the repo root, unlike the local planning docs under `docs/`, since a setup
guide is meant to be committed and reproducible.)

## Topology

- **agent-harness** — a TypeScript library, built with tsup to `dist/`, consumed by this app via a
  `file:../agent-harness` dependency (a sibling directory).
- **fantasy-football** — the app:
  - **sidecar** (`pnpm serve`) — a Node process (run via `tsx`) that hosts the stats HTTP API **and**
    the harness WebSocket server (the agents).
  - **UI** (`pnpm dev`) — Vite + React.
- **External services you run yourself:**
  - an **OpenAI-compatible model** endpoint (local llama-server, or a gateway like OpenRouter).
  - **SearXNG** (for `web_search`) on `:8888`.

```
 [browser UI]  --ws-->  [sidecar: harness WS :4000 + stats API :4100]  --http-->  [model]
      \__ http /api __/                                                 \__http__>  [SearXNG :8888]
                          imports  agent-harness (file: dep, built dist)
```

## Prerequisites
- Node (with a WebSocket global — Node 22+, or the sidecar's `ws`), `pnpm`.
- `agent-harness` checked out as a **sibling** of this repo (`../agent-harness`).
- A running model endpoint and a running SearXNG container.

## One-time setup

```bash
# 1. agent-harness (the library) — install its deps, then BUILD its dist (FF imports the built dist)
cd ../agent-harness
pnpm install
pnpm build

# 2. fantasy-football (this app)
cd -                 # back to fantasy-football
pnpm install         # resolves the file: harness dep (copies its built dist into pnpm's store)
pnpm ingest          # pulls the frozen nflverse snapshot -> data/snapshot.json (one-time)
```

## Run the app (each session)

```bash
# start these first (your own setup):
#   - the model server (e.g. llama-server on :5174, alias "local")
#   - SearXNG on :8888

pnpm serve           # sidecar: stats API (:4100) + harness WS server (:4000)
pnpm dev             # Vite UI  (open the printed localhost URL)
```

### Relevant env vars (all optional; sensible defaults)
| Var | Default | What |
|-----|---------|------|
| `HARNESS_PORT` | `4000` | sidecar WebSocket port |
| `APP_API_PORT` | `4100` | stats API port |
| `HARNESS_TOKEN` | `dev-token` | client auth token |
| `HARNESS_DB` | `data/harness.sqlite` | session store path |
| `MODEL_PORT` | `5174` | port `resolveModelUrl` probes for the local model |
| `MODEL_BASE_URL` | (auto) | override to point at a specific model / gateway (e.g. OpenRouter) |
| `MODEL_NAME` | `local` | model id sent to the endpoint |
| `MODEL_API_KEY` | — | set for a gateway |
| `SEARXNG_URL` | `http://localhost:8888` | SearXNG base for `web_search` |

## Iterating — two loops

### A. You changed **fantasy-football** source
- `src/web/*` (UI): Vite HMR picks it up — just save (refresh browser if needed).
- `src/server/*` (sidecar): **restart `pnpm serve`** — it runs via `tsx` with no watch, so a running
  sidecar keeps the old code.

### B. You changed **agent-harness** source (cross-repo — the easily-missed loop)
The app imports the harness's **built dist**, and pnpm **copies** the `file:` dep into its store. So a
harness source edit does NOT reach the app until you rebuild + re-copy + restart:

```bash
# 1. rebuild the harness dist
cd ../agent-harness && pnpm build

# 2. force the app to re-copy the new dist (see gotcha below)
cd -                 # back to fantasy-football
pnpm install --force

# 3. restart the sidecar (it loaded the OLD harness server code at startup)
#    (stop pnpm serve, start it again)

# 4. if the harness CLIENT changed, refresh the browser so the UI bundle picks up the new dist
```

### The `--force` gotcha
pnpm copies a `file:` dependency into its content-addressed store at install time and **caches by
version**. The harness version is always `0.0.0`, so plain `pnpm install` sometimes **skips** the
re-copy and you keep resolving the stale dist. `pnpm install --force` re-copies reliably. (Verify with:
`grep -c <new-symbol> "$(readlink -f node_modules/agent-harness)/dist/index.js"`.)

## Verification (safe to run anytime)
```bash
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
pnpm build       # vite production build of the UI
# harness (in ../agent-harness): pnpm test / pnpm typecheck / pnpm build
```

## Production hardening (TODO — the `file:` + `--force` dance is a dev hack)
For a reproducible/production dependency on the harness, replace the copy dance with one of:
- a **pnpm workspace / monorepo** (harness symlinked live; add `tsup --watch` so loop B collapses to
  "rebuild is automatic, just restart the sidecar"), or
- **publish** the harness as a versioned package (npm or a private registry) and pin it in this app.

This is backlog item "kill the pnpm `file:` gotcha" — the thing standing between this and a
reproducible production setup.
