#!/bin/bash

# Production Deployment Script
# This script syncs code and manages the production bot

echo "🚀 Starting Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PRODUCTION_DIR="/opt/kimhunter-production"
BACKUP_DIR="/opt/kimhunter-backups/production"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Function to print colored output
print_status() {
    echo -e "${2}${1}${NC}"
}

# Check if running as appropriate user
if [ "$EUID" -eq 0 ]; then 
   print_status "Error: Please don't run as root!" "$RED"
   exit 1
fi

# Parse command line arguments
COMMAND=${1:-deploy}

case $COMMAND in
    "deploy")
        print_status "📦 Preparing deployment..." "$YELLOW"
        
        # Create backup of current production
        if [ -d "$PRODUCTION_DIR" ]; then
            print_status "📁 Backing up current production..." "$YELLOW"
            mkdir -p "$BACKUP_DIR"
            cp -r "$PRODUCTION_DIR" "$BACKUP_DIR/backup_$TIMESTAMP"
        fi
        
        # Create production directory if it doesn't exist
        mkdir -p "$PRODUCTION_DIR"
        
        # Sync files (excluding development-specific files)
        print_status "🔄 Syncing code to production..." "$YELLOW"
        rsync -av --delete \
            --exclude 'node_modules' \
            --exclude '.env' \
            --exclude '.env.beta' \
            --exclude '.env.beta.example' \
            --exclude '.env.example' \
            --exclude '.git' \
            --exclude 'backup' \
            --exclude 'logs' \
            --exclude '*.log' \
            --exclude 'integrated-ide' \
            --exclude 'BETA_SETUP.md' \
            --exclude 'deploy-beta.sh' \
            --exclude 'scripts/start-beta.sh' \
            ./ "$PRODUCTION_DIR/"
        
        # Copy production environment file
        print_status "🔐 Setting up production environment..." "$YELLOW"
        cp .env.production "$PRODUCTION_DIR/.env"
        
        # Install dependencies
        print_status "📦 Installing dependencies..." "$YELLOW"
        cd "$PRODUCTION_DIR"
        npm ci --production
        
        # Run database migrations if any
        # print_status "🗃️ Running database migrations..." "$YELLOW"
        # node scripts/migrate-production.js
        
        # Restart production bot
        print_status "🔄 Restarting production bot..." "$YELLOW"
        pm2 restart kimhunter-prod
        
        print_status "✅ Production deployment complete!" "$GREEN"
        ;;
        
    "start")
        print_status "▶️ Starting production bot..." "$YELLOW"
        cd "$PRODUCTION_DIR"
        pm2 start ecosystem.config.js --only kimhunter-prod
        print_status "✅ Production bot started!" "$GREEN"
        ;;
        
    "stop")
        print_status "⏹️ Stopping production bot..." "$YELLOW"
        pm2 stop kimhunter-prod
        print_status "✅ Production bot stopped!" "$GREEN"
        ;;
        
    "restart")
        print_status "🔄 Restarting production bot..." "$YELLOW"
        pm2 restart kimhunter-prod
        print_status "✅ Production bot restarted!" "$GREEN"
        ;;
        
    "status")
        print_status "📊 Production bot status:" "$YELLOW"
        pm2 status kimhunter-prod
        ;;
        
    "logs")
        print_status "📜 Production bot logs:" "$YELLOW"
        pm2 logs kimhunter-prod --lines 50
        ;;
        
    "rollback")
        if [ -z "$2" ]; then
            print_status "Error: Please specify backup timestamp" "$RED"
            print_status "Available backups:" "$YELLOW"
            ls -la "$BACKUP_DIR"
            exit 1
        fi
        
        BACKUP_NAME="backup_$2"
        if [ ! -d "$BACKUP_DIR/$BACKUP_NAME" ]; then
            print_status "Error: Backup $BACKUP_NAME not found!" "$RED"
            exit 1
        fi
        
        print_status "⏮️ Rolling back to $BACKUP_NAME..." "$YELLOW"
        pm2 stop kimhunter-prod
        rm -rf "$PRODUCTION_DIR"
        cp -r "$BACKUP_DIR/$BACKUP_NAME" "$PRODUCTION_DIR"
        cd "$PRODUCTION_DIR"
        npm ci --production
        pm2 start ecosystem.config.js --only kimhunter-prod
        print_status "✅ Rollback complete!" "$GREEN"
        ;;
        
    *)
        print_status "Usage: $0 [deploy|start|stop|restart|status|logs|rollback <timestamp>]" "$YELLOW"
        exit 1
        ;;
esac