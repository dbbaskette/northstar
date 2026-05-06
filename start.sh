#!/bin/bash
# Northstar — single-command dev startup
# Starts PostgreSQL (Docker), runs migrations, and launches backend + frontend.
set -e

cd "$(dirname "$0")"

echo "==> Checking Docker..."
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Starting Docker Desktop..."
  open -a Docker
  echo "Waiting for Docker to start (this can take ~30s)..."
  until docker info > /dev/null 2>&1; do sleep 2; done
  echo "Docker is ready."
fi

echo "==> Starting PostgreSQL..."
docker compose up -d postgres
echo "Waiting for PostgreSQL to accept connections..."
until docker compose exec -T postgres pg_isready -U northstar > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready."

echo "==> Installing frontend deps (if needed)..."
if [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install)
fi

echo "==> Starting backend (auto-migrates) and frontend..."
echo ""
echo "    Backend:  http://localhost:8180"
echo "    Frontend: http://localhost:5273"
echo "    Health:   http://localhost:8180/health"
echo ""
echo "    Ctrl+C to stop both."
echo ""

# Run both in parallel; kill children when we exit
trap 'kill 0' EXIT

(cd backend && go run ./cmd/northstar) &
(cd frontend && npm run dev) &
wait
