# Kimhunter Production Bot Setup Guide

## 🚀 Production Bot Configuration

This guide covers the setup and deployment of the Kimhunter production bot.

### 📋 Production Bot Credentials

**⚠️ SENSITIVE INFORMATION - KEEP SECURE**

- **Application ID**: `1385688101422371077`
- **Public Key**: `7db45d21fc9f1d81cb65512ff714641010c42b6ce6b3044cd2fa94faedf483a0`
- **Token**: Stored in `.env.production` (marked as sensitive)

### 🔧 Initial Setup

1. **Environment File**
   - The `.env.production` file has been created with all necessary credentials
   - **DO NOT** commit this file to version control
   - Keep backups in a secure location

2. **Deploy Commands**
   ```bash
   # Register slash commands for production bot
   node commands/deployProductionCommands.js
   ```

3. **Start Production Bot**
   ```bash
   # Using PM2
   pm2 start ecosystem.config.js --only kimhunter-prod
   
   # Or using the script
   ./scripts/start-production.sh
   
   # On Windows
   deploy-production.bat
   ```

### 📦 Deployment Process

#### Linux/Mac Deployment
```bash
# Make deployment script executable
chmod +x deploy-production.sh

# Deploy to production
./deploy-production.sh deploy

# Other commands
./deploy-production.sh start    # Start bot
./deploy-production.sh stop     # Stop bot
./deploy-production.sh restart  # Restart bot
./deploy-production.sh status   # Check status
./deploy-production.sh logs     # View logs
./deploy-production.sh rollback <timestamp>  # Rollback to backup
```

#### Windows Deployment
1. Run `deploy-production.bat`
2. Choose from the menu options
3. Follow the prompts

### 🛡️ Production Safety Features

1. **No Auto-Updates**: Production bot has `AUTO_UPDATE=false` to prevent automatic code updates
2. **Cluster Mode**: Runs with 2 instances for high availability
3. **Memory Limits**: 4GB memory limit with automatic restart
4. **File Watching Disabled**: No automatic restarts on file changes
5. **Separate Database**: Uses `kimhunter_production` database/collection

### 📊 PM2 Configuration

The production bot runs with these PM2 settings:
- **Name**: `kimhunter-prod`
- **Instances**: 2 (cluster mode)
- **Max Memory**: 4GB
- **Auto Restart**: Yes (with limits)
- **Log Files**: `./logs/prod-error.log` and `./logs/prod-out.log`

### 🔍 Monitoring

1. **Check Status**
   ```bash
   pm2 status kimhunter-prod
   ```

2. **View Logs**
   ```bash
   pm2 logs kimhunter-prod
   ```

3. **Monitor Resources**
   ```bash
   pm2 monit
   ```

### 🚨 Troubleshooting

1. **Bot Won't Start**
   - Check `.env.production` exists and has correct values
   - Verify MongoDB connection string
   - Check PM2 logs: `pm2 logs kimhunter-prod --err`

2. **Commands Not Working**
   - Re-register commands: `node commands/deployProductionCommands.js`
   - Wait up to 1 hour for global command propagation
   - Verify bot has proper permissions in Discord

3. **Memory Issues**
   - Check PM2 monitoring: `pm2 monit`
   - Adjust memory limit in `ecosystem.config.js`
   - Review logs for memory leaks

### 🔄 Rollback Procedure

If you need to rollback to a previous version:

```bash
# List available backups
ls -la /opt/kimhunter-backups/production

# Rollback to specific backup
./deploy-production.sh rollback 20250622_143000
```

### 📝 Best Practices

1. **Always test in beta** before deploying to production
2. **Create backups** before major updates
3. **Monitor logs** after deployment for errors
4. **Document changes** in deployment logs
5. **Keep credentials secure** and rotate regularly

### 🔐 Security Notes

- The production token is marked as `# SENSITIVE` in `.env.production`
- Never share or commit the `.env.production` file
- Use environment-specific MongoDB databases
- Regularly audit bot permissions and access

### 📞 Support

For production issues:
1. Check logs first: `pm2 logs kimhunter-prod`
2. Review this documentation
3. Contact the development team with error details