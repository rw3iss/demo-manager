#!/usr/bin/env bash
# Build locally, ship to production, (idempotently) bootstrap the host, and
# restart the service. Run from the repo root or anywhere:
#   bash scripts/deploy.sh
#
# Env overrides: DEMO_SSH_KEY, DEMO_SSH_HOST, DEMO_SSH_USER, DEMO_REMOTE_DIR.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=_common.sh
source "$ROOT/scripts/_common.sh"

echo "▶ Building server + client…"
( cd "$ROOT/server" && npm ci && npm run build )
( cd "$ROOT/client" && npm ci && npm run build )

echo "▶ Ensuring remote dirs…"
ssh_run "mkdir -p '$REMOTE_DIR/server' '$REMOTE_DIR/client'"

echo "▶ Syncing artifacts → $SSH_USER@$SSH_HOST:$REMOTE_DIR …"
# Compiled server (replace stale files; never touch .env or node_modules).
rsync -az --delete -e "${RSYNC_RSH}" "$ROOT/server/dist/" "$SSH_USER@$SSH_HOST:$REMOTE_DIR/server/dist/"
rsync -az -e "${RSYNC_RSH}" "$ROOT/server/package.json" "$ROOT/server/package-lock.json" "$SSH_USER@$SSH_HOST:$REMOTE_DIR/server/"
# Built manager SPA.
rsync -az --delete -e "${RSYNC_RSH}" "$ROOT/client/dist/" "$SSH_USER@$SSH_HOST:$REMOTE_DIR/client/dist/"
# Deploy assets (systemd unit, nginx vhost) + scripts (setup-server.sh).
rsync -az -e "${RSYNC_RSH}" "$ROOT/deploy" "$ROOT/scripts" "$SSH_USER@$SSH_HOST:$REMOTE_DIR/"

echo "▶ Bootstrapping host (idempotent) + installing prod deps + restarting…"
ssh_run bash -s <<EOF
set -euo pipefail
export PATH="/opt/node/bin:\$PATH"
# Idempotent host setup: node, /opt/demos, db, .env, systemd unit, nginx, SSL.
bash "$REMOTE_DIR/scripts/setup-server.sh"
# Production dependencies for the compiled server (pure-JS; no build step).
cd "$REMOTE_DIR/server" && npm ci --omit=dev
sudo systemctl restart $SERVICE
EOF

echo "▶ Health check (waiting for the service to come up)…"
# The service restarts asynchronously; poll for up to ~20s before failing.
if ssh_run "for i in \$(seq 1 20); do curl -sf $HEALTH_URL >/dev/null && exit 0; sleep 1; done; exit 1"; then
  echo "✅ Deploy complete — https://demos.ryanweiss.net/manage/"
else
  echo "❌ Health check failed. Inspect: ssh … 'sudo journalctl -u $SERVICE -n 100 --no-pager'"
  exit 1
fi
