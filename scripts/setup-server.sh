#!/usr/bin/env bash
# Runs ON THE SERVER (ryanweiss.net box, Fedora, native nginx + Postgres).
# Idempotent: safe to run on every deploy. Called by scripts/update.sh.
# Creates: data dir, Postgres role+db, /etc/demo-manager/demo-manager.env,
# systemd units, nginx vhost, Let's Encrypt cert.
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/demo-manager}"
DATA_DIR=/var/lib/demo-manager
ENV_FILE=/etc/demo-manager/demo-manager.env
DOMAIN=demos.ryanweiss.net
RUN_USER=rw3iss

# 1) Demo storage (outside /var/www: served by node, not nginx).
sudo mkdir -p "$DATA_DIR/demos"
sudo chown -R "$RUN_USER:$RUN_USER" "$DATA_DIR"

# 2) Postgres role + db (password generated once, kept in the env file).
if ! sudo test -f "$ENV_FILE"; then
  DB_PASS="$(openssl rand -hex 24)"
  sudo -u postgres psql -qtAc "SELECT 1 FROM pg_roles WHERE rolname='demo_manager'" | grep -q 1 \
    || sudo -u postgres psql -qc "CREATE ROLE demo_manager LOGIN PASSWORD '$DB_PASS'"
  sudo -u postgres psql -qc "ALTER ROLE demo_manager PASSWORD '$DB_PASS'"
  sudo -u postgres psql -qtAc "SELECT 1 FROM pg_database WHERE datname='demo_manager'" | grep -q 1 \
    || sudo -u postgres psql -qc "CREATE DATABASE demo_manager OWNER demo_manager"
  sudo mkdir -p "$(dirname "$ENV_FILE")"
  sudo tee "$ENV_FILE" >/dev/null <<ENV
NODE_ENV=production
PORT=4090
HOST=127.0.0.1
LOG_LEVEL=log
CORS_ORIGINS=https://$DOMAIN,https://demos.rw3iss.com
PUBLIC_BASE_URL=https://$DOMAIN
DEMOS_ROOT=$DATA_DIR/demos
CLIENT_DIST_PATH=$APP_DIR/client/dist
MANAGER_BASE_PATH=/manage
MAX_UPLOAD_MB=200
MAX_ZIP_ENTRIES=5000
MAX_UNCOMPRESSED_MB=500
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=demo_manager
DB_PASSWORD=$DB_PASS
DB_NAME=demo_manager
DB_SYNCHRONIZE=false
DB_RUN_MIGRATIONS=true
PAGELOOP_ENDPOINT=https://pageloop.dev
AUTH_ENABLED=false
ENV
  sudo chmod 600 "$ENV_FILE"
fi

# 3) systemd units (service + health-check timer).
changed=0
for u in demo-manager.service demo-manager-healthcheck.service demo-manager-healthcheck.timer; do
  if ! sudo cmp -s "$APP_DIR/deploy/systemd/$u" "/etc/systemd/system/$u"; then
    sudo install -m 644 "$APP_DIR/deploy/systemd/$u" "/etc/systemd/system/$u"; changed=1
  fi
done
[ "$changed" = 1 ] && sudo systemctl daemon-reload
sudo systemctl enable --quiet demo-manager.service demo-manager-healthcheck.timer
sudo systemctl start demo-manager-healthcheck.timer

# 4) TLS cert (HTTP-01 webroot; needs an HTTP-only vhost first).
VHOST=/etc/nginx/conf.d/$DOMAIN.conf
if ! sudo test -d "/etc/letsencrypt/live/$DOMAIN"; then
  sudo tee "$VHOST" >/dev/null <<NGX
server { listen 80; listen [::]:80; server_name $DOMAIN;
  location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
  location / { return 503; } }
NGX
  sudo nginx -t -q && sudo systemctl reload nginx
  sudo certbot certonly --webroot -w /var/www/letsencrypt -d "$DOMAIN" \
    --non-interactive --agree-tos -m rw3iss@gmail.com --keep-until-expiring
fi

# 5) nginx vhost.
if ! sudo cmp -s "$APP_DIR/deploy/nginx/$DOMAIN.conf" "$VHOST"; then
  sudo install -m 644 "$APP_DIR/deploy/nginx/$DOMAIN.conf" "$VHOST"
  sudo nginx -t -q && sudo systemctl reload nginx
fi
