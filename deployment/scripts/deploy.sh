#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# EventTix - Production Deployment Script
# Target: Ubuntu 22.04 LTS / Debian 12
# ============================================================

APP_DIR="/opt/eventtix"
REPO_URL="https://github.com/Moscow04/event-ticketing-app.git"
BRANCH="main"

ENV_FILE="${APP_DIR}/.env"

log()  { echo -e "\e[1;32m[INFO]\e[0m $*"; }
err()  { echo -e "\e[1;31m[ERROR]\e[0m $*" >&2; }
warn() { echo -e "\e[1;33m[WARN]\e[0m $*"; }

check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        err "This script must be run as root (use sudo)"
        exit 1
    fi
}

install_deps() {
    log "Updating system packages..."
    apt-get update -qq
    apt-get upgrade -y -qq

    log "Installing Docker, Docker Compose, git, certbot, nginx..."
    apt-get install -y -qq \
        apt-transport-https \
        ca-certificates \
        curl \
        software-properties-common \
        git \
        nginx \
        certbot \
        python3-certbot-nginx

    # Install Docker
    if ! command -v docker &>/dev/null; then
        curl -fsSL https://get.docker.com | bash
        systemctl enable --now docker
    fi

    # Install Docker Compose plugin
    if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
        log "Installing Docker Compose..."
        curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
            -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
}

setup_app() {
    log "Setting up application directory at ${APP_DIR}..."
    mkdir -p "${APP_DIR}"

    if [ -d "${APP_DIR}/.git" ]; then
        log "Updating existing repository..."
        cd "${APP_DIR}"
        git fetch origin
        git reset --hard "origin/${BRANCH}"
    else
        log "Cloning repository..."
        git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
    fi

    if [ ! -f "${ENV_FILE}" ]; then
        warn "No .env file found at ${ENV_FILE}"
        warn "Creating from example - YOU MUST EDIT THIS FILE!"
        cp "${APP_DIR}/backend/.env.example" "${ENV_FILE}"
        chmod 600 "${ENV_FILE}"
        log "IMPORTANT: Edit ${ENV_FILE} with your real secrets before continuing"
    fi
}

deploy_containers() {
    log "Deploying Docker containers..."
    cd "${APP_DIR}"

    # Copy env to backend for build context
    cp "${ENV_FILE}" "${APP_DIR}/backend/.env"

    # Export env vars for docker-compose
    set -a
    source "${ENV_FILE}"
    set +a

    docker-compose -f deployment/docker-compose.yml down --remove-orphans || true
    docker-compose -f deployment/docker-compose.yml pull
    docker-compose -f deployment/docker-compose.yml up -d --build

    log "Running database seed..."
    docker exec eventtix-api node seeds/seed.js || warn "Seed may have partially failed (duplicates ok)"

    log "Cleaning up old images..."
    docker image prune -f
}

setup_ssl() {
    local domain="${1:-}"
    if [ -z "${domain}" ]; then
        warn "No domain provided for SSL. Skipping Let's Encrypt setup."
        warn "Run manually later: certbot --nginx -d yourdomain.com -d www.yourdomain.com"
        return
    fi

    log "Obtaining SSL certificate for ${domain}..."
    certbot --nginx -d "${domain}" -d "www.${domain}" --non-interactive --agree-tos --email "admin@${domain}" || {
        warn "SSL cert failed. You can run it manually later."
    }
}

setup_firewall() {
    log "Configuring UFW firewall..."
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw --force enable
    ufw status
}

monitoring() {
    log "Setting up Docker auto-restart policy..."
    # Already set in docker-compose.yml as 'unless-stopped'
    log "Container status:"
    docker ps --filter "name=eventtix" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

print_summary() {
    local domain="${1:-yourdomain.com}"
    echo ""
    echo "=============================================="
    echo "  EventTix Deployment Complete!"
    echo "=============================================="
    echo ""
    echo "  Frontend: https://${domain}"
    echo "  API:      https://${domain}/api/health"
    echo ""
    echo "  Admin login:"
    echo "    Email:    admin@eventtix.com"
    echo "    Password: (set in .env ADMIN_PASSWORD)"
    echo ""
    echo "  Useful commands:"
    echo "    View logs:      docker-compose -f ${APP_DIR}/deployment/docker-compose.yml logs -f"
    echo "    Restart:        docker-compose -f ${APP_DIR}/deployment/docker-compose.yml restart"
    echo "    Update:         cd ${APP_DIR} && git pull && sudo ./deployment/scripts/deploy.sh"
    echo "    DB backup:      docker exec eventtix-db pg_dump -U postgres event_ticketing > backup.sql"
    echo ""
    echo "  IMPORTANT: Set up regular database backups via cron!"
    echo "=============================================="
}

main() {
    check_root

    local domain="${1:-}"

    echo "=============================================="
    echo "  EventTix Deployment Script"
    echo "=============================================="
    echo ""

    install_deps
    setup_app
    setup_firewall
    deploy_containers
    setup_ssl "${domain}"
    monitoring
    print_summary "${domain}"
}

main "$@"
