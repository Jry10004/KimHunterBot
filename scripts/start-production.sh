#!/bin/bash

# Production Bot Startup Script
echo "🚀 Starting Kimhunter Production Bot..."

# Set production environment
export NODE_ENV=production
export ENV_TYPE=production

# Load production environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo "❌ Error: .env.production file not found!"
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Please install it first: npm install -g pm2"
    exit 1
fi

# Start the production bot
echo "📦 Starting production bot with PM2..."
pm2 start ecosystem.config.js --only kimhunter-prod

# Save PM2 configuration
pm2 save

# Show status
echo "✅ Production bot started successfully!"
echo "📊 Current status:"
pm2 status kimhunter-prod

echo ""
echo "📝 Useful commands:"
echo "  pm2 logs kimhunter-prod     - View logs"
echo "  pm2 restart kimhunter-prod  - Restart bot"
echo "  pm2 stop kimhunter-prod     - Stop bot"
echo "  pm2 monit                   - Monitor bot"