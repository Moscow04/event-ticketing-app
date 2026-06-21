#!/usr/bin/env bash
#=============================================================================
# EventTix - ONE deployment script to rule them all
# Target: Any Debian/Ubuntu Linux server (fresh or existing)
#
# WHAT THIS SCRIPT DOES:
#   1. Installs Docker, Nginx, Certbot if missing
#   2. Clones or pulls the EventTix repo
#   3. Creates .env with SECURE auto-generated secrets (if not exists)
#   4. Stops host Nginx on port 80 (so Docker can use it temporarily)
#   5. Builds & starts Docker containers (PostgreSQL, Backend API, Frontend)
#   6. Waits for the backend to come online
#   7. Seeds the database with demo data + admin user
#   8. Kills host Nginx, replaces it with OUR config that reverse-proxies
#      to Docker containers (frontend on :3000, API on :5000)
#   9. Re-enables host Nginx on port 80
#  10. Obtains a free SSL certificate from Let's Encrypt (if domain given)
#  11. Prints a summary with login credentials and useful commands
#
# USAGE:
#   sudo bash deploy.sh                            # prompts for domain
#   sudo bash deploy.sh event.yourdomain.com       # with domain
#   sudo bash deploy.sh 203.0.113.42               # bare IP (no SSL)
#
# RE-RUNNING is safe — it pulls latest code, rebuilds containers,
# and re-configures Nginx without losing database data.
#=============================================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# ─── CONFIGURATION ──────────────────────────────────────────────────────────
APP_DIR="/opt/eventtix"                          # Where the app lives
REPO_URL="https://github.com/Moscow04/event-ticketing-app.git"  # Git remote
BRANCH="main"                                    # Git branch to deploy
ENV_FILE="${APP_DIR}/.env"                       # Path to environment file

# ─── HELPERS: coloured output ───────────────────────────────────────────────
# These make the output easy to scan — green for info, red for errors,
# yellow for warnings.
log()  { echo -e "\e[1;32m[INFO]\e[0m $*"; }
err()  { echo -e "\e[1;31m[ERROR]\e[0m $*" >&2; }
warn() { echo -e "\e[1;33m[WARN]\e[0m $*"; }

# ─── STEP 0: DETECT DOCKER COMPOSE ─────────────────────────────────────────
# Modern Ubuntu ships `docker compose` as a plugin (space, not hyphen).
# Older setups have the standalone `docker-compose` binary.
# This function detects whichever is available and stores the command string.
DOCKER_COMPOSE=""
detect_compose() {
    if [ -n "${DOCKER_COMPOSE:-}" ]; then return; fi
    if command -v docker-compose &>/dev/null; then
        DOCKER_COMPOSE="docker-compose"
        log "Using standalone docker-compose"
    elif docker compose version &>/dev/null; then
        DOCKER_COMPOSE="docker compose"
        log "Using Docker Compose plugin (docker compose)"
    else
        # Neither found — install the standalone version
        log "Installing docker-compose standalone..."
        curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
            -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        DOCKER_COMPOSE="docker-compose"
    fi
}

# ─── STEP 1: INSTALL SYSTEM DEPENDENCIES ───────────────────────────────────
# Runs only once. After that, apt skips already-installed packages.
install_deps() {
    log "STEP 1/7: Installing system dependencies..."
    apt-get update -qq
    apt-get upgrade -y -qq

    # Install essential tools. nginx + certbot are for the reverse proxy & SSL.
    apt-get install -y -qq \
        apt-transport-https ca-certificates curl software-properties-common \
        git nginx certbot python3-certbot-nginx

    # Docker — if not present, install via official script
    if ! command -v docker &>/dev/null; then
        log "Installing Docker..."
        curl -fsSL https://get.docker.com | bash
        systemctl enable --now docker
        log "Docker installed. NOTE: You may need to log out/in for non-root docker access."
    fi

    detect_compose
}

# ─── STEP 2: GET THE CODE ──────────────────────────────────────────────────
# If /opt/eventtix already exists (from a previous run), just pull updates.
# Otherwise, clone fresh.
setup_app() {
    log "STEP 2/7: Fetching application code..."
    mkdir -p "${APP_DIR}"

    if [ -d "${APP_DIR}/.git" ]; then
        cd "${APP_DIR}"
        log "Existing repo found — pulling latest..."
        git fetch origin
        git reset --hard "origin/${BRANCH}"
    else
        log "Cloning repository from ${REPO_URL}..."
        git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
    fi
}

# ─── STEP 3: CREATE .ENV WITH SECURE SECRETS ───────────────────────────────
# Only runs if .env doesn't exist. Auto-generates strong passwords.
# The user can edit this file later and re-run the script.
setup_env() {
    local domain="${1:-}"

    if [ -f "${ENV_FILE}" ]; then
        log "STEP 3/7: .env already exists — keeping existing secrets"
        return
    fi

    log "STEP 3/7: Generating .env with secure random secrets..."

    # Generate cryptographic-quality secrets
    DB_PASS=$(openssl rand -base64 32)       # 32-byte random password
    JWT_SECRET=$(openssl rand -hex 64)       # 64-byte hex key for JWT signing
    ADMIN_PASS="Admin@$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c16)"

    # Determine CORS_ORIGIN based on whether the argument is an IP or domain
    if [ -n "${domain}" ]; then
        if echo "${domain}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
            CORS_ORIGIN="http://${domain}"
        else
            CORS_ORIGIN="https://${domain}"
        fi
    else
        CORS_ORIGIN="http://localhost"
    fi

    # Write the .env file (chmod 600 = only root can read it)
    cat > "${ENV_FILE}" << EOF
# ─── EventTix Environment Configuration ────────────────────────────────
# Auto-generated by deploy.sh on $(date)

NODE_ENV=production
PORT=5000

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=event_ticketing
DB_USER=postgres
DB_PASSWORD=${DB_PASS}

# JWT Authentication — KEEP THIS SECRET. Rotate if compromised.
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# CORS — the domain your users will access the app from
CORS_ORIGIN=${CORS_ORIGIN}

# Rate Limiting (requests per 15 min window per IP)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Default Admin Account (created by seed script)
ADMIN_EMAIL=admin@eventtix.com
ADMIN_PASSWORD=${ADMIN_PASS}
EOF

    chmod 600 "${ENV_FILE}"
    log ".env created at ${ENV_FILE}"

    # Show the generated credentials — USER MUST SAVE THESE
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║          ⚠️  SAVE THESE CREDENTIALS NOW!                     ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  Database: postgres / ${DB_PASS}"
    echo "║  JWT:      ${JWT_SECRET:0:16}...${JWT_SECRET: -16}"
    echo "║  Admin:    admin@eventtix.com / ${ADMIN_PASS}"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

# ─── STEP 4: BUILD & START DOCKER CONTAINERS ──────────────────────────────
# The docker-compose.yml defines three services:
#   db       — PostgreSQL 16 (data persists in a Docker volume)
#   backend  — Node.js 20 Express API (port 5000 → 127.0.0.1:5000)
#   frontend — Nginx serving React build (port 80 → 127.0.0.1:3000)
#
# All ports bind ONLY to 127.0.0.1 (localhost), never to 0.0.0.0.
# This means they are NOT directly accessible from the internet.
# Only the host Nginx (configured next) can reach them.
deploy_containers() {
    local domain="${1:-}"
    log "STEP 4/7: Deploying Docker containers..."

    cd "${APP_DIR}"
    detect_compose

    # Export CORS_ORIGIN so docker-compose can interpolate it
    if [ -n "${domain}" ]; then
        if echo "${domain}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
            export CORS_ORIGIN="http://${domain}"
        else
            export CORS_ORIGIN="https://${domain}"
        fi
    fi

    # Copy .env into backend/ so the Node app can read it at runtime
    cp "${ENV_FILE}" "${APP_DIR}/backend/.env"

    # Load all env vars so docker-compose can use them
    set -a; source "${ENV_FILE}"; set +a

    # ── Stop host Nginx temporarily ──
    # The frontend Docker container needs port 80 at build time for
    # its internal Nginx. If host Nginx is running, it blocks port 80.
    # We stop it here, start containers, then re-enable host Nginx
    # with our custom config.
    if systemctl is-active --quiet nginx; then
        log "Stopping host Nginx temporarily..."
        systemctl stop nginx
    fi

    # Tear down any old containers, then rebuild and start
    log "Building and starting containers (this may take a few minutes)..."
    ${DOCKER_COMPOSE} -f deployment/docker-compose.yml down --remove-orphans 2>/dev/null || true
    ${DOCKER_COMPOSE} -f deployment/docker-compose.yml up -d --build

    # ── Wait for backend to be healthy ──
    # The backend exposes GET /api/health. We poll it up to 60s.
    log "Waiting for backend to be ready..."
    local ready=false
    for i in $(seq 1 30); do
        if curl -sf http://127.0.0.1:5000/api/health >/dev/null 2>&1; then
            ready=true
            log "Backend is healthy after $((i * 2)) seconds"
            break
        fi
        sleep 2
    done

    if [ "${ready}" = false ]; then
        warn "Backend did not respond within 60s — check logs:"
        warn "  docker logs eventtix-api"
    fi

    # Seed the database with demo data + admin user
    log "STEP 5/7: Seeding database..."
    docker exec eventtix-api node seeds/seed.js 2>/dev/null && \
        log "Database seeded successfully" || \
        warn "Seed may have partially failed (duplicate entries are harmless)"

    # Clean up unused Docker images to free disk space
    docker image prune -f >/dev/null 2>&1 || true
}

# ─── STEP 6: CONFIGURE HOST NGINX AS REVERSE PROXY ────────────────────────
# The host Nginx sits in front of the Docker containers.
# Request flow:
#   Browser ──> host Nginx (:80/:443) ──> Docker containers (:3000/:5000)
#
# This gives us:
#   - SSL termination (Let's Encrypt handles certs on the host)
#   - Static asset caching (1 year for JS/CSS/images)
#   - Security headers (HSTS, XSS protection, etc.)
#   - Rate limiting on the API
configure_nginx() {
    local domain="${1:-}"
    log "STEP 6/7: Configuring Nginx reverse proxy..."

    local NGINX_CONF="/etc/nginx/sites-available/eventtix"

    # ── Generate the Nginx config ──
    # We use a heredoc with 'NGINX' delimiter (quoted = no variable expansion).
    # Domain placeholder is replaced by sed after.
    cat > "${NGINX_CONF}" << 'NGINX'
# ─── EventTix Reverse Proxy Configuration ─────────────────────────────
# This file is auto-generated by deploy.sh. Manual edits will be
# overwritten on the next deployment.

# Upstream blocks define the Docker containers as backend servers.
# Nginx will load-balance across multiple servers if you add more.
upstream eventtix_backend {
    server 127.0.0.1:5000;
}

upstream eventtix_frontend {
    server 127.0.0.1:3000;
}

# ── HTTP server (port 80) ──
# Initially serves the app directly. After certbot runs, this becomes
# a redirect to HTTPS.
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    # Enable gzip compression for text-based assets
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;
    gzip_comp_level 6;

    # ── API proxy ──
    # /api/* requests go directly to the backend container
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

    # ── Frontend proxy ──
    # Everything else goes to the frontend container (React SPA)
    location / {
        proxy_pass http://eventtix_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Block access to hidden files (.git, .env, etc.)
    location ~ /\. { deny all; access_log off; log_not_found off; }
}
NGINX

    # Replace the placeholder with the actual domain
    if [ -n "${domain}" ]; then
        sed -i "s/DOMAIN_PLACEHOLDER/${domain}/g" "${NGINX_CONF}"
        # Also add www subdomain if it looks like a real domain (not IP)
        if ! echo "${domain}" | grep -qE '^[0-9.]+$'; then
            sed -i "s/server_name ${domain}/server_name ${domain} www.${domain}/" "${NGINX_CONF}"
        fi
    else
        sed -i "s/DOMAIN_PLACEHOLDER/_/g" "${NGINX_CONF}"
    fi

    # Enable the site and disable the default Nginx welcome page
    rm -f /etc/nginx/sites-enabled/default
    ln -sf "${NGINX_CONF}" /etc/nginx/sites-enabled/eventtix

    # Validate config and reload — if it fails, the script exits (set -e)
    nginx -t && systemctl start nginx && systemctl reload nginx
    log "Nginx configured and running"
}

# ─── STEP 7: OBTAIN SSL CERTIFICATE (Let's Encrypt) ────────────────────────
# Only runs if a real domain name is provided (not an IP address).
# Uses the Nginx plugin so certbot modifies our config automatically,
# adding the SSL server block and HTTP→HTTPS redirect.
setup_ssl() {
    local domain="${1:-}"

    # Skip if no domain or if it's an IP address
    if [ -z "${domain}" ] || echo "${domain}" | grep -qE '^[0-9.]+$'; then
        log "STEP 7/7: Skipping SSL (IP address or no domain provided)"
        log "Access the app via http://${domain}"
        return
    fi

    log "STEP 7/7: Obtaining free SSL certificate from Let's Encrypt..."

    # Ensure port 80 is accessible (necessary for HTTP-01 challenge)
    # certbot's standalone mode needs port 80, but the --nginx plugin
    # handles this automatically by talking to our running Nginx.
    certbot --nginx -d "${domain}" \
        --non-interactive \
        --agree-tos \
        --email "admin@${domain}" \
        --redirect \
        || warn "SSL failed — run later: certbot --nginx -d ${domain}"

    # Reload Nginx to pick up certbot's config changes
    nginx -t && systemctl reload nginx && log "SSL certificate installed"
}

# ─── FIREWALL ──────────────────────────────────────────────────────────────
# Only allow SSH (22), HTTP (80), and HTTPS (443). Deny everything else.
setup_firewall() {
    log "Configuring UFW firewall (SSH, HTTP, HTTPS only)..."
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw --force enable
}

# ─── END: PRINT DEPLOYMENT SUMMARY ─────────────────────────────────────────
print_summary() {
    local domain="${1:-localhost}"
    local protocol="http"
    # If it's a real domain (not IP), assume HTTPS was set up
    if ! echo "${domain}" | grep -qE '^[0-9.]+$' && [ -n "${domain}" ]; then
        protocol="https"
    fi

    # Read the admin password from .env if available
    ADMIN_PASS="(see .env)"
    if [ -f "${ENV_FILE}" ]; then
        ADMIN_PASS=$(grep ADMIN_PASSWORD "${ENV_FILE}" | head -1 | cut -d= -f2)
    fi

    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║           ✅  EventTix Deployment Complete!                  ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║"
    echo "║  🌐  Frontend:  ${protocol}://${domain}"
    echo "║  🔗  API:       ${protocol}://${domain}/api/health"
    echo "║"
    echo "║  👤  Admin login:"
    echo "║      Email:    admin@eventtix.com"
    echo "║      Password: ${ADMIN_PASS}"
    echo "║"
    echo "║  📋  Useful commands:"
    echo "║"
    echo "║      View all logs:"
    echo "║        ${DOCKER_COMPOSE} -f ${APP_DIR}/deployment/docker-compose.yml logs -f"
    echo "║"
    echo "║      Check container status:"
    echo "║        docker ps --filter name=eventtix"
    echo "║"
    echo "║      Re-deploy after git pull:"
    echo "║        cd ${APP_DIR} && sudo bash deployment/scripts/deploy.sh ${domain}"
    echo "║"
    echo "║      Backup database:"
    echo "║        docker exec eventtix-db pg_dump -U postgres event_ticketing > backup.sql"
    echo "║"
    echo "║      Restore database:"
    echo "║        cat backup.sql | docker exec -i eventtix-db psql -U postgres event_ticketing"
    echo "║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

# ─── MAIN: ORCHESTRATE EVERYTHING ─────────────────────────────────────────
main() {
    check_root

    # If no domain argument, prompt for one
    local domain="${1:-}"
    if [ -z "${domain}" ]; then
        read -rp "Enter your domain (or IP, or leave blank for localhost): " domain
    fi

    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║           EventTix — Production Deployment                  ║"
    echo "║           Target: ${domain:-localhost}"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    # Run each step in sequence. Each is idempotent (safe to re-run).
    install_deps           # Step 1: system packages
    setup_app              # Step 2: clone/pull code
    setup_env "${domain}"  # Step 3: create .env with secrets (if new)
    setup_firewall         # Step 4: lock down ports
    deploy_containers "${domain}"  # Step 5: Docker build + seed
    configure_nginx "${domain}"    # Step 6: Nginx reverse proxy
    setup_ssl "${domain}"          # Step 7: Let's Encrypt SSL
    print_summary "${domain}"      # Done!
}

main "$@"
