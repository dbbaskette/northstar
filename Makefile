DATABASE_URL ?= postgres://northstar:northstar@localhost:5432/northstar?sslmode=disable
BINARY_NAME  ?= northstar

.PHONY: up stop logs build build-frontend build-backend build-local test clean

# ---------- The only commands you need day-to-day ----------

up:
	./start.sh

stop:
	docker compose down

logs:
	docker compose logs -f postgres

# ---------- Build (production: single binary with embedded frontend) ----------

build: build-frontend build-backend

build-frontend:
	cd frontend && npm ci && npm run build
	rm -rf backend/internal/static/dist
	cp -r frontend/dist backend/internal/static/dist

build-backend:
	cd backend && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o ../$(BINARY_NAME)-linux-amd64 ./cmd/northstar

# Local production-style build: native binary with embedded frontend.
build-local:
	cd frontend && npm run build
	rm -rf backend/internal/static/dist
	cp -r frontend/dist backend/internal/static/dist
	cd backend && go build -o ../$(BINARY_NAME) ./cmd/northstar

test:
	cd backend && go test ./... -race
	cd frontend && npm test

clean:
	rm -f $(BINARY_NAME) $(BINARY_NAME)-linux-amd64
	rm -rf frontend/dist
	rm -rf backend/internal/static/dist
	mkdir -p backend/internal/static/dist
	touch backend/internal/static/dist/.gitkeep
