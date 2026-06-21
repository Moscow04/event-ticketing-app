#!/usr/bin/env bash
#=============================================================================
# One-command EventTix setup for a fresh Ubuntu 22.04+ server.
#
# Usage:
#   curl -fsSL https://git.io/eventtix-setup | sudo bash
#   curl -fsSL https://git.io/eventtix-setup | sudo bash -s event.yourdomain.com
#
# This simply installs git, clones the repo, and hands off to deploy.sh
# which does everything else.
#=============================================================================
set -euo pipefail

REPO_URL="https://github.com/Moscow04/event-ticketing-app.git"
APP_DIR="/opt/eventtix"
DOMAIN="${1:-}"

# Must be root
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: Run with sudo: curl -fsSL https://git.io/eventtix-setup | sudo bash"
    exit 1
fi

# Install git, clean up any partial clone, clone fresh
apt-get update -qq && apt-get install -y -qq git
rm -rf "${APP_DIR}"
git clone --depth 1 "${REPO_URL}" "${APP_DIR}"

# Hand off to the real deployment script
exec bash "${APP_DIR}/deployment/scripts/deploy.sh" "${DOMAIN}"
