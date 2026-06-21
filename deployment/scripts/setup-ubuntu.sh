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

# Prompt for domain if not provided
if [ -z "${DOMAIN}" ]; then
    read -rp "Enter your domain (e.g. event.yourdomain.com): " DOMAIN
fi

# Generate .env if it doesn't exist
if [ ! -f "${APP_DIR}/.env" ]; then
    DB_PASS=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -hex 64)

    ADMIN_PASS="Admin@$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c16)"
    cat > "${APP_DIR}/.env" << EOF
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=event_ticketing
DB_USER=postgres
DB_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://${DOMAIN}
ADMIN_EMAIL=admin@eventtix.com
ADMIN_PASSWORD=${ADMIN_PASS}
EOF
    chmod 600 "${APP_DIR}/.env"
    echo "Created .env with auto-generated secrets"
fi

bash "${APP_DIR}/deployment/scripts/deploy.sh" "${DOMAIN}"
