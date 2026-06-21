#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/Moscow04/event-ticketing-app.git"
APP_DIR="/opt/eventtix"
DOMAIN="${1:-}"

if [ "$(id -u)" -ne 0 ]; then
    echo "Run with sudo: sudo bash $0 [your-domain.com]"
    exit 1
fi

apt-get update -qq && apt-get install -y -qq git

git clone --depth 1 "${REPO_URL}" "${APP_DIR}" 2>/dev/null || {
    cd "${APP_DIR}" && git pull
}

cd "${APP_DIR}"
echo ""
echo "============================================"
echo "  IMPORTANT: Edit .env file first!"
echo "============================================"
echo ""
echo "  Run:  nano ${APP_DIR}/.env"
echo ""
echo "  Set strong values for:"
echo "    DB_PASSWORD"
echo "    JWT_SECRET"
echo "    DOMAIN (your domain without https)"
echo ""
echo "  Then run:  sudo bash ${APP_DIR}/deployment/scripts/deploy.sh ${DOMAIN}"
echo ""
echo "  Or run all at once if .env is ready:"
echo "    sudo DOMAIN=${DOMAIN} bash ${APP_DIR}/deployment/scripts/deploy.sh ${DOMAIN}"
echo "============================================"
