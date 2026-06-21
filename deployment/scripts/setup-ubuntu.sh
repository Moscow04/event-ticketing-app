#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Quick-start: one-command Ubuntu 22.04 fresh server setup
# curl -fsSL https://raw.githubusercontent.com/Moscow04/event-ticketing-app/main/deployment/scripts/setup-ubuntu.sh | bash
# ============================================================

REPO_URL="https://github.com/Moscow04/event-ticketing-app.git"
APP_DIR="/opt/eventtix"
DOMAIN="${1:-}"

if [ "$(id -u)" -ne 0 ]; then
    echo "Run with sudo: sudo bash $0 [your-domain.com]"
    exit 1
fi

# Install git
apt-get update -qq && apt-get install -y -qq git

# Clone and run deploy
git clone --depth 1 "${REPO_URL}" "${APP_DIR}" 2>/dev/null || {
    cd "${APP_DIR}" && git pull
}

cd "${APP_DIR}"
bash deployment/scripts/deploy.sh "${DOMAIN}"
