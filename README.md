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

## Deploy to Cloud Foundry

One-time setup per space:

```sh
cf create-service postgres <plan-name> northstar-db   # `cf marketplace` to find your plan
./deploy.sh
cf set-env northstar JWT_SECRET "$(openssl rand -hex 32)"
cf restage northstar
```

`deploy.sh` runs `make build` (which produces `northstar-linux-amd64` with the
frontend embedded) and then `cf push`. The manifest binds `northstar-db`,
mounts attachments at `/home/vcap/app/storage`, and exposes `/health`.

Optional — turn on Sign in with GitHub:

```sh
cf set-env northstar BASE_URL https://<route>
cf set-env northstar GITHUB_CLIENT_ID <id>
cf set-env northstar GITHUB_CLIENT_SECRET <secret>
cf restage northstar
```

Claiming the first admin account (one-time): the very first sign-up is
promoted to admin automatically. If you already registered before that
rule shipped — or you want to point a deployed instance at a specific
admin — set:

```sh
cf set-env northstar BOOTSTRAP_ADMIN_EMAIL you@example.com
cf restage northstar
```

On every startup, the backend promotes the matching email to
`role='admin'` and approves them. Idempotent and safe to leave set.

## Architecture

- **Single binary deploy**: in production, the React build is embedded into the Go binary via `embed.FS`. One artifact, one process, one health check.
- **Auto-migrations**: the backend runs migrations on startup. Set `SKIP_MIGRATIONS=true` to disable (e.g. in a multi-instance CF deployment where migrations should run once via `cf run-task`).
- **Real-time**: WebSocket hub broadcasts mutation events per-board. Frontend updates React Query cache directly on incoming messages.
- **Position-based ordering**: cards/lists use float positions with midpoint insertion (no O(n) renumbering on drag).
