#!/usr/bin/env bash
# Deploy the current origin/main to production (ryanweiss.net box).
#   bash scripts/deploy.sh
# The box pulls from GitHub and builds itself (scripts/update.sh), so push first.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=_common.sh
source "$ROOT/scripts/_common.sh"

if [ -n "$(git -C "$ROOT" status --porcelain)" ] || [ "$(git -C "$ROOT" rev-parse HEAD)" != "$(git -C "$ROOT" rev-parse @{u} 2>/dev/null)" ]; then
  echo "⚠ Local changes or unpushed commits — the server deploys origin/main only."
fi

ssh_run "bash $REMOTE_DIR/scripts/update.sh"
