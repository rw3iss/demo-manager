#!/usr/bin/env bash
# Shared config for local-side scripts (deploy.sh). Override any value via env.

SSH_HOST="${DEMO_SSH_HOST:-162.35.181.92}"
SSH_USER="${DEMO_SSH_USER:-rw3iss}"
REMOTE_DIR="${DEMO_REMOTE_DIR:-/var/www/demo-manager}"
SERVICE="demo-manager"
HEALTH_URL="http://127.0.0.1:4090/healthz"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
[ -n "${DEMO_SSH_KEY:-}" ] && SSH_OPTS+=(-i "$DEMO_SSH_KEY")

ssh_run() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "$@"; }
