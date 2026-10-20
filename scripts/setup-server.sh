#!/usr/bin/env bash
# Idempotent host bootstrap for demo-manager on ven-internal. Safe to run on
# every deploy — each step is skipped if already done. Run ON the server:
#   bash ~/apps/demo-manager/scripts/setup-server.sh
#
# Does: install Node → /opt/node, create /opt/demos, create the demo_manager
# DB on ven-postgres, write server/.env (DB password pulled from the running
# container — no secret in the repo), install the systemd unit + nginx vhost,
# and issue the TLS cert.
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.18.0}"
APP_DIR="${APP_DIR:-$HOME/apps/demo-manager}"
DEMOS_ROOT="${DEMOS_ROOT:-/opt/demos}"
DOMAIN="${DOMAIN:-demos.vendidit.com}"
CERT_EMAIL="${CERT_EMAIL:-ryan@vendidit.com}"
PG_CONTAINER="${PG_CONTAINER:-ven-postgres}"
PG_USER="${PG_USER:-twenty}"
DB_NAME="${DB_NAME:-demo_manager}"
SSL_DIR="/opt/ven-cms/nginx/ssl"
CONF_DIR="/opt/ven-cms/nginx/conf.d"

say() { echo "  → $*"; }

# ── 1. Node ────────────────────────────────────────────────────────────────
if [ ! -x /opt/node/bin/node ]; then
  say "Installing Node v$NODE_VERSION → /opt/node"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" -o /tmp/node.tar.xz
  sudo mkdir -p /opt/node
  sudo tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1
  rm -f /tmp/node.tar.xz
else
  say "Node present: $(/opt/node/bin/node -v)"
fi
# Symlink onto PATH so `node`/`npm` resolve everywhere (npm's #!/usr/bin/env
# node shebang needs `node` discoverable; systemd uses the absolute path).
sudo ln -sf /opt/node/bin/node /usr/local/bin/node
sudo ln -sf /opt/node/bin/npm /usr/local/bin/npm
sudo ln -sf /opt/node/bin/npx /usr/local/bin/npx

# ── 2. demos root ──────────────────────────────────────────────────────────
if [ ! -d "$DEMOS_ROOT" ]; then
  say "Creating $DEMOS_ROOT"
  sudo mkdir -p "$DEMOS_ROOT"
  sudo chown "$USER:$USER" "$DEMOS_ROOT"
fi

# ── 3. database ──────────────────────────────────────────────────────────
if ! sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -tAc \
      "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  say "Creating database $DB_NAME"
  sudo docker exec "$PG_CONTAINER" psql -U "$PG_USER" -c "CREATE DATABASE $DB_NAME"
else
  say "Database $DB_NAME exists"
fi

# ── 4. server/.env ───────────────────────────────────────────────────────
ENV_FILE="$APP_DIR/server/.env"
if [ ! -f "$ENV_FILE" ]; then
  say "Writing $ENV_FILE"
  PGPASS="$(sudo docker exec "$PG_CONTAINER" printenv POSTGRES_PASSWORD)"
  mkdir -p "$APP_DIR/server"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=8092
HOST=0.0.0.0
LOG_LEVEL=log
CORS_ORIGINS=*
PUBLIC_BASE_URL=https://$DOMAIN
DEMOS_ROOT=$DEMOS_ROOT
CLIENT_DIST_PATH=$APP_DIR/client/dist
MANAGER_BASE_PATH=/manage
MAX_UPLOAD_MB=200
MAX_ZIP_ENTRIES=5000
MAX_UNCOMPRESSED_MB=500
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=$PG_USER
DB_PASSWORD=$PGPASS
DB_NAME=$DB_NAME
DB_SYNCHRONIZE=false
DB_RUN_MIGRATIONS=true
AUTH_ENABLED=false
EOF
  chmod 600 "$ENV_FILE"
else
  say "server/.env exists (left untouched)"
fi

# ── 5. systemd unit ──────────────────────────────────────────────────────
say "Installing systemd unit"
sudo cp "$APP_DIR/deploy/systemd/demo-manager.service" /etc/systemd/system/demo-manager.service
sudo systemctl daemon-reload
sudo systemctl enable demo-manager >/dev/null 2>&1 || true

# ── 6. nginx vhost ───────────────────────────────────────────────────────
say "Installing nginx vhost"
sudo cp "$APP_DIR/deploy/nginx/$DOMAIN.conf" "$CONF_DIR/$DOMAIN.conf"
# Self-signed bootstrap so nginx validates before the real cert exists.
# Note: /etc/letsencrypt/live is root-only, so cert-existence checks MUST use
# `sudo test` — a plain `[ -f ]` as ec2-user silently reads false.
if ! sudo test -f "$SSL_DIR/demos-fullchain.pem"; then
  say "Generating temporary self-signed cert"
  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/demos-privkey.pem" -out "$SSL_DIR/demos-fullchain.pem" \
    -subj "/CN=$DOMAIN" 2>/dev/null
fi
sudo docker exec ven-nginx nginx -t && sudo docker exec ven-nginx nginx -s reload

# ── 7. TLS via certbot (only if not already issued) ──────────────────────
if ! sudo test -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem"; then
  say "Requesting Let's Encrypt cert for $DOMAIN"
  WEBROOT="$(sudo docker volume inspect ven-certbot-webroot -f '{{.Mountpoint}}')"
  sudo certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" \
    --non-interactive --agree-tos --email "$CERT_EMAIL" || say "certbot failed (check DNS); using self-signed for now"
fi
# Install the real cert into nginx's ssl dir whenever it differs from what's
# deployed (covers first issue + renewals run outside the deploy hook).
if sudo test -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem"; then
  say "Installing Let's Encrypt cert into nginx + reloading"
  sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/demos-fullchain.pem"
  sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/demos-privkey.pem"
  HOOK="/etc/letsencrypt/renewal-hooks/deploy/$DOMAIN.sh"
  sudo tee "$HOOK" >/dev/null <<'HK'
#!/bin/bash
set -euo pipefail
DOMAIN="demos.vendidit.com"; SSL_DIR="/opt/ven-cms/nginx/ssl"
[ "${RENEWED_LINEAGE:-}" = "/etc/letsencrypt/live/${DOMAIN}" ] || exit 0
cp "${RENEWED_LINEAGE}/fullchain.pem" "${SSL_DIR}/demos-fullchain.pem"
cp "${RENEWED_LINEAGE}/privkey.pem"   "${SSL_DIR}/demos-privkey.pem"
docker exec ven-nginx nginx -s reload
HK
  sudo chmod +x "$HOOK"
  sudo docker exec ven-nginx nginx -s reload
fi

echo "✓ setup-server.sh complete"
