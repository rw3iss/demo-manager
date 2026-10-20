#!/usr/bin/env bash
# Runs ON THE SERVER. Pull origin/main, build server + client, apply host
# config (idempotent), restart, and health-gate.
#   bash /var/www/demo-manager/scripts/update.sh
# Wrapped in main() so bash parses the whole file before running it: the
# `git reset` below rewrites this very script mid-run.
main() {
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/demo-manager}"
HEALTH_URL="http://127.0.0.1:4090/healthz"

cd "$APP_DIR"
echo "▶ git pull"
git fetch --quiet origin main
git reset --hard --quiet origin/main

echo "▶ build server"
( cd server && npm ci --no-audit --no-fund && npm run build )
echo "▶ build client"
( cd client && npm ci --no-audit --no-fund && npm run build )

echo "▶ host config (idempotent)"
bash "$APP_DIR/scripts/setup-server.sh"

echo "▶ restart"
sudo systemctl restart demo-manager
for i in $(seq 1 30); do
  if curl -sf "$HEALTH_URL" >/dev/null; then
    echo "✅ demo-manager $(git rev-parse --short HEAD) is up — https://demos.ryanweiss.net/manage/"
    exit 0
  fi
  sleep 1
done
echo "❌ health check failed — sudo journalctl -u demo-manager -n 100 --no-pager"
exit 1
}
main "$@"
