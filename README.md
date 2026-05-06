# Northstar

Self-hosted Trello-style project management for internal teams.

## Stack
Go (Chi) + React (Vite/TypeScript) + PostgreSQL + WebSockets + Tailwind. Deploys to Cloud Foundry.

## Get started — one command

```bash
./start.sh
```

That starts Docker (if needed), PostgreSQL, runs migrations automatically, and launches the backend on `:8080` and frontend on `:5273`. `Ctrl+C` stops everything.

`make up` does the same thing.

Open http://localhost:5273 in your browser.

## Other commands

| Command | What it does |
|---------|--------------|
| `make up` | Start everything (alias for `./start.sh`) |
| `make stop` | Stop PostgreSQL |
| `make logs` | Tail PostgreSQL logs |
| `make build` | Production build (Go binary + frontend bundle) |
| `make test` | Run backend + frontend tests |
| `make clean` | Remove build artifacts |

## Architecture

- **Single binary deploy**: in production, the React build is embedded into the Go binary via `embed.FS`. One artifact, one process, one health check.
- **Auto-migrations**: the backend runs migrations on startup. Set `SKIP_MIGRATIONS=true` to disable (e.g. in a multi-instance CF deployment where migrations should run once via `cf run-task`).
- **Real-time**: WebSocket hub broadcasts mutation events per-board. Frontend updates React Query cache directly on incoming messages.
- **Position-based ordering**: cards/lists use float positions with midpoint insertion (no O(n) renumbering on drag).
