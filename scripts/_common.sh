#!/usr/bin/env bash
# Shared config for local-side scripts (deploy.sh). Override any value via env.

SSH_KEY="${DEMO_SSH_KEY:-$HOME/Sites/ven/_keys/dev-admins.pem}"
SSH_HOST="${DEMO_SSH_HOST:-3.12.0.133}"
SSH_USER="${DEMO_SSH_USER:-ec2-user}"
REMOTE_DIR="${DEMO_REMOTE_DIR:-/home/ec2-user/apps/demo-manager}"
SERVICE="demo-manager"
HEALTH_URL="http://localhost:8092/healthz"

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
RSYNC_RSH="ssh ${SSH_OPTS[*]}"

ssh_run() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$SSH_HOST" "$@"; }
