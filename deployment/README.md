# EventTix Production Deployment Guide

This guide covers **end-to-end deployment** of EventTix on a Linux server (Ubuntu 22.04 LTS recommended).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [One-Command Setup](#2-one-command-setup)
3. [Manual Step-by-Step Setup](#3-manual-step-by-step-setup)
4. [Environment Configuration](#4-environment-configuration)
5. [Nginx + SSL Setup](#5-nginx--ssl-setup)
6. [Database Backups](#6-database-backups)
7. [Monitoring & Maintenance](#7-monitoring--maintenance)
8. [Updating the Application](#8-updating-the-application)
9. [CI/CD Pipeline](#9-cicd-pipeline)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

- **Linux Server** (Ubuntu 22.04 LTS or Debian 12)
- **Domain name** pointing to your server's IP address
- **Ports 80 and 443** open (HTTP/HTTPS)
- **Port 22** open for SSH

### Recommended Server Specs

| Traffic Level  | vCPUs | RAM   | Storage |
|----------------|-------|-------|---------|
| Low (trial)    | 1     | 1 GB  | 20 GB   |
| Medium         | 2     | 4 GB  | 50 GB   |
| High           | 4     | 8 GB  | 100 GB  |

---

## 2. One-Command Setup

SSH into your server and run:

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/Moscow04/event-ticketing-app/main/deployment/scripts/setup-ubuntu.sh)" -- yourdomain.com
```

This single command will:
1. Install Docker, Docker Compose, Nginx, Certbot
2. Clone the repository
3. Configure UFW firewall
4. Deploy all containers (PostgreSQL, Backend API, Frontend)
5. Obtain SSL certificate via Let's Encrypt
6. Seed the database with demo data

**After the script completes**, you must edit the `.env` file:

```bash
sudo nano /opt/eventtix/.env
```

Set strong values for `DB_PASSWORD` and `JWT_SECRET`, then re-deploy:

```bash
cd /opt/eventtix && sudo bash deployment/scripts/deploy.sh
```

---

## 3. Manual Step-by-Step Setup

### Step 1: Connect to Your Server

```bash
ssh user@your-server-ip
```

### Step 2: Install Dependencies

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common git nginx certbot python3-certbot-nginx

# Install Docker
curl -fsSL https://get.docker.com | sudo bash
sudo systemctl enable --now docker

# Install Docker Compose
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 3: Clone the Repository

```bash
sudo mkdir -p /opt/eventtix
sudo git clone https://github.com/Moscow04/event-ticketing-app.git /opt/eventtix
```

### Step 4: Configure Environment

```bash
sudo cp /opt/eventtix/backend/.env.example /opt/eventtix/.env
sudo nano /opt/eventtix/.env
```

Generate a strong JWT secret:

```bash
openssl rand -hex 64
```

### Step 5: Configure Firewall

```bash
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw --force enable
```

### Step 6: Deploy with Docker Compose

```bash
cd /opt/eventtix
sudo cp .env backend/.env
sudo -E docker-compose -f deployment/docker-compose.yml up -d --build
```

### Step 7: Seed the Database

```bash
sudo docker exec eventtix-api node seeds/seed.js
```

### Step 8: Set Up SSL

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com --non-interactive --agree-tos --email admin@yourdomain.com
```

### Step 9: Verify Deployment

```bash
curl https://yourdomain.com/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

Visit `https://yourdomain.com` in your browser.

---

## 4. Environment Configuration

### Variables (`.env`)

| Variable          | Required | Description                          | Example                               |
|-------------------|----------|--------------------------------------|---------------------------------------|
| `DB_PASSWORD`     | Yes      | PostgreSQL password                  | `Correct-Horse-Battery-Staple`        |
| `JWT_SECRET`      | Yes      | 64-char hex key for JWT signing      | `(run: openssl rand -hex 64)`         |
| `CORS_ORIGIN`     | Yes      | Frontend URL for CORS                | `https://yourdomain.com`              |
| `ADMIN_EMAIL`     | No       | Admin account email                  | `admin@eventtix.com`                  |
| `ADMIN_PASSWORD`  | No       | Admin account password               | `ChangeMe123!`                        |
| `DB_NAME`         | No       | Database name (default: event_ticketing) |                                    |
| `DB_USER`         | No       | Database user (default: postgres)    |                                       |

### Security Best Practices

```bash
# Generate secure values
DB_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -hex 64)

echo "DB_PASSWORD=$DB_PASSWORD"
echo "JWT_SECRET=$JWT_SECRET"

# Add to .env
echo "DB_PASSWORD=$DB_PASSWORD" | sudo tee -a /opt/eventtix/.env
echo "JWT_SECRET=$JWT_SECRET" | sudo tee -a /opt/eventtix/.env
```

---

## 5. Nginx + SSL Setup

### Production Nginx Config

The file `deployment/nginx/default.conf` contains the production Nginx configuration with:

- HTTP -> HTTPS redirect
- SSL with modern ciphers
- Security headers (HSTS, XSS, etc.)
- Static asset caching (1 year)
- API reverse proxy with timeouts
- Gzip compression
- Rate limiting

### Applying the Config

If deploying **without Docker** (bare-metal PM2 approach):

```bash
sudo cp /opt/eventtix/deployment/nginx/default.conf /etc/nginx/sites-available/eventtix
sudo sed -i 's/yourdomain.com/your-actual-domain.com/g' /etc/nginx/sites-available/eventtix
sudo ln -sf /etc/nginx/sites-available/eventtix /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### SSL Auto-Renewal

Let's Encrypt certificates expire after 90 days. Certbot sets up a systemd timer automatically:

```bash
sudo systemctl status certbot.timer
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

---

## 6. Database Backups

### Automated Backups via Cron

The backup script is at `deployment/scripts/backup-db.sh`.

Set up a daily cron job:

```bash
sudo crontab -e
# Add this line to run at 3 AM daily:
0 3 * * * /opt/eventtix/deployment/scripts/backup-db.sh
```

### Manual Backup

```bash
sudo docker exec eventtix-db pg_dump -U postgres event_ticketing > backup_$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
cat backup.sql | sudo docker exec -i eventtix-db psql -U postgres event_ticketing
```

### Off-site Backup Strategy

```bash
# Example: rsync backups to another server
rsync -avz /opt/eventtix/backups/ user@backup-server:/backups/eventtix/

# Or use rclone for cloud storage (S3, GCS, etc.)
```

---

## 7. Monitoring & Maintenance

### Container Health

```bash
docker ps --filter "name=eventtix" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### View Logs

```bash
# All containers
docker-compose -f /opt/eventtix/deployment/docker-compose.yml logs -f

# Specific service
docker logs -f --tail 100 eventtix-api
docker logs -f --tail 100 eventtix-db
```

### Resource Usage

```bash
docker stats --no-stream eventtix-api eventtix-db eventtix-web
```

### Server-Level Monitoring

```bash
# Quick system check
htop

# Disk usage
df -h

# Docker disk usage
docker system df
```

---

## 8. Updating the Application

```bash
cd /opt/eventtix
sudo git pull
sudo bash deployment/scripts/deploy.sh
```

The deploy script will:
1. Pull latest code
2. Rebuild containers with zero-downtime
3. Re-seed if needed

---

## 9. CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml` in the repository:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/eventtix
            git pull
            sudo bash deployment/scripts/deploy.sh
```

Add the following secrets in your GitHub repository:
- `HOST` - your server IP
- `USERNAME` - SSH user
- `SSH_PRIVATE_KEY` - your private key

---

## 10. Troubleshooting

### Containers won't start

```bash
# Check logs
docker logs eventtix-api
docker logs eventtix-db

# Verify .env has all required values
cat /opt/eventtix/.env

# Restart fresh
docker-compose -f /opt/eventtix/deployment/docker-compose.yml down -v
docker-compose -f /opt/eventtix/deployment/docker-compose.yml up -d --build
```

### Database connection refused

```bash
# Check if DB is running
docker ps | grep eventtix-db

# Test connection from backend container
docker exec eventtix-api sh -c "nc -zv db 5432"

# Verify environment variables in backend container
docker exec eventtix-api env | grep DB_
```

### SSL certificate issues

```bash
# Force renewal
sudo certbot renew --force-renewal

# Check certificate expiry
sudo certbot certificates

# Test Nginx config
sudo nginx -t
```

### 502 Bad Gateway

```bash
# Backend might be down
docker logs --tail 50 eventtix-api

# Check if backend is running on port 5000
docker exec eventtix-api wget -qO- http://localhost:5000/api/health
```

### Performance Issues

```bash
# Check PostgreSQL query performance
docker exec eventtix-db psql -U postgres -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Add indexes if needed
docker exec eventtix-db psql -U postgres -d event_ticketing -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS ...;"
```

---

## Architecture Overview

```
                         Internet
                            |
                         [Nginx :443]
                         /           \
                   [Static]        [/api/*]
                   (React)       [Proxy Pass]
                       |              |
                  [Frontend]      [Backend]
                  (nginx:80)    (Express:5000)
                      |              |
                      +------+-------+
                             |
                       [PostgreSQL:5432]
```

---

## License

MIT
