#!/usr/bin/env bash
set -euo pipefail

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
        apt-transport-https ca-certificates curl software-properties-common \
        git nginx certbot python3-certbot-nginx

    if ! command -v docker &>/dev/null; then
        curl -fsSL https://get.docker.com | bash
        systemctl enable --now docker
    fi

    if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
        curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
}

setup_app() {
    log "Setting up application directory at ${APP_DIR}..."
    mkdir -p "${APP_DIR}"

    if [ -d "${APP_DIR}/.git" ]; then
        cd "${APP_DIR}"
        git fetch origin
        git reset --hard "origin/${BRANCH}"
    else
        git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
    fi

    if [ ! -f "${ENV_FILE}" ]; then
        warn "No .env file found — creating from example"
        cp "${APP_DIR}/backend/.env.example" "${ENV_FILE}"
        chmod 600 "${ENV_FILE}"
        log "IMPORTANT: Edit ${ENV_FILE} with real secrets, then re-run this script"
        exit 1
    fi
}

configure_nginx() {
    local domain="${1:-}"
    cd "${APP_DIR}"

    # Create Nginx config from template
    local NGINX_CONF="/etc/nginx/sites-available/eventtix"

    cat > "${NGINX_CONF}" << 'NGINX'
upstream eventtix_backend {
    server 127.0.0.1:5000;
}

upstream eventtix_frontend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER www.DOMAIN_PLACEHOLDER;

    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;
    gzip_comp_level 6;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://eventtix_frontend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://eventtix_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    location / {
        proxy_pass http://eventtix_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location ~ /\. { deny all; access_log off; log_not_found off; }
}
NGINX

    if [ -n "${domain}" ]; then
        sed -i "s/DOMAIN_PLACEHOLDER/${domain}/g" "${NGINX_CONF}"
    else
        sed -i "s/DOMAIN_PLACEHOLDER/yourdomain.com/g" "${NGINX_CONF}"
    fi

    rm -f /etc/nginx/sites-enabled/default
    ln -sf "${NGINX_CONF}" /etc/nginx/sites-enabled/eventtix
    nginx -t && systemctl reload nginx
}

setup_ssl() {
    local domain="${1:-}"
    if [ -z "${domain}" ]; then
        warn "No domain provided — skipping SSL setup"
        warn "Run later: certbot --nginx -d yourdomain.com -d www.yourdomain.com"
        return
    fi

    log "Obtaining SSL certificate for ${domain}..."
    certbot --nginx -d "${domain}" -d "www.${domain}" \
        --non-interactive --agree-tos --email "admin@${domain}" || {
        warn "SSL cert failed — you can run it manually: certbot --nginx -d ${domain}"
    }
}

deploy_containers() {
    log "Deploying Docker containers..."
    cd "${APP_DIR}"

    cp "${ENV_FILE}" "${APP_DIR}/backend/.env"

    set -a
    source "${ENV_FILE}"
    set +a

    docker-compose -f deployment/docker-compose.yml down --remove-orphans || true
    docker-compose -f deployment/docker-compose.yml up -d --build

    # Wait for backend to be ready
    for i in $(seq 1 30); do
        if curl -s http://127.0.0.1:5000/api/health >/dev/null 2>&1; then
            break
        fi
        sleep 2
    done

    log "Running database seed..."
    docker exec eventtix-api node seeds/seed.js || warn "Seed may have partially failed"

    docker image prune -f
}

setup_firewall() {
    log "Configuring UFW firewall..."
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw --force enable
    ufw status
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
    echo "  If SSL wasn't set up, run:"
    echo "    certbot --nginx -d ${domain} -d www.${domain}"
    echo ""
    echo "  Admin login:"
    echo "    Email:    admin@eventtix.com"
    echo "    Password: (from .env ADMIN_PASSWORD)"
    echo ""
    echo "  Commands:"
    echo "    Logs:   docker-compose -f ${APP_DIR}/deployment/docker-compose.yml logs -f"
    echo "    Update: cd ${APP_DIR} && git pull && sudo bash deployment/scripts/deploy.sh"
    echo "    Backup: docker exec eventtix-db pg_dump -U postgres event_ticketing > backup.sql"
    echo "=============================================="
}

main() {
    check_root
    local domain="${1:-}"

    echo "=============================================="
    echo "  EventTix Production Deployment"
    echo "=============================================="
    echo ""

    install_deps
    setup_app
    setup_firewall
    deploy_containers
    configure_nginx "${domain}"
    setup_ssl "${domain}"
    print_summary "${domain}"
}

main "$@"
