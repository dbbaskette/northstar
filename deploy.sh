#!/usr/bin/env bash
# One-shot CF deploy: build the single-binary artifact then `cf push`.
#
# First-time setup (do this once per CF space):
#   cf create-service postgres on-demand-postgres-db northstar-db
#   ./deploy.sh
#   cf set-env northstar JWT_SECRET "$(openssl rand -hex 32)"
#   cf restage northstar
#
# Service plan name will vary by tile — `cf marketplace` to find yours.

set -euo pipefail

cd "$(dirname "$0")"

if ! command -v cf >/dev/null; then
  echo "cf CLI not found. Install it first: https://docs.cloudfoundry.org/cf-cli/install-go-cli.html" >&2
  exit 1
fi

if ! cf target >/dev/null 2>&1; then
  echo "Not logged in / no target. Run \`cf login\` (or \`cf target -o ORG -s SPACE\`) first." >&2
  exit 1
fi

echo "==> Building frontend + Linux binary..."
make build

if [[ ! -f northstar-linux-amd64 ]]; then
  echo "Build did not produce ./northstar-linux-amd64" >&2
  exit 1
fi

echo "==> Pushing to Cloud Foundry..."
cf push

echo
echo "Done. Set required env vars if you haven't yet:"
echo "    cf set-env northstar JWT_SECRET \"\$(openssl rand -hex 32)\""
echo "    cf restage northstar"
echo
echo "Optional SSO:"
echo "    cf set-env northstar BASE_URL https://<route>"
echo "    cf set-env northstar GITHUB_CLIENT_ID <id>"
echo "    cf set-env northstar GITHUB_CLIENT_SECRET <secret>"
echo "    cf restage northstar"
