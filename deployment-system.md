# Production/Test Server Separation System

## Overview
This system separates development and production environments to ensure stability while allowing continuous development.

## Architecture Components

### 1. Environment Configuration
```javascript
// config/environments.js
module.exports = {
    test: {
        botToken: process.env.TEST_BOT_TOKEN,
        applicationId: process.env.TEST_APP_ID,
        guildId: process.env.TEST_GUILD_ID,
        mongoUri: process.env.TEST_MONGO_URI,
        dbName: 'kimhunter_test',
        autoRestart: true,
        version: '2.0.0',
        environment: 'test'
    },
    production: {
        botToken: process.env.PROD_BOT_TOKEN,
        applicationId: process.env.PROD_APP_ID,
        guildId: process.env.PROD_GUILD_ID,
        mongoUri: process.env.PROD_MONGO_URI,
        dbName: 'kimhunter_prod',
        autoRestart: false,
        version: '1.0.0',
        environment: 'production'
    }
};
```

### 2. Database Separation
```javascript
// database/connection.js
const { MongoClient } = require('mongodb');
const config = require('../config/environments');

class DatabaseManager {
    constructor(environment) {
        this.env = environment;
        this.config = config[environment];
        this.client = null;
        this.db = null;
    }

    async connect() {
        this.client = new MongoClient(this.config.mongoUri);
        await this.client.connect();
        this.db = this.client.db(this.config.dbName);
        console.log(`Connected to ${this.env} database: ${this.config.dbName}`);
    }

    getCollection(name) {
        return this.db.collection(name);
    }
}
```

### 3. Deployment Command Implementation
```javascript
// commands/deploy.js
const { SlashCommandBuilder } = require('discord.js');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('본서버적용')
        .setDescription('테스트 서버의 코드를 프로덕션 서버에 배포합니다'),
    
    async execute(interaction) {
        // Admin check
        const ADMIN_IDS = ['YOUR_ADMIN_ID_HERE'];
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            await interaction.reply({ content: '권한이 없습니다.', ephemeral: true });
            return;
        }

        await interaction.deferReply();

        try {
            // 1. Create deployment package
            const deploymentSteps = [
                '📦 배포 패키지 생성 중...',
                '🔍 코드 검증 중...',
                '📤 프로덕션 서버로 전송 중...',
                '🔄 프로덕션 서버 업데이트 중...',
                '✅ 배포 완료!'
            ];

            const embed = new EmbedBuilder()
                .setTitle('🚀 프로덕션 배포')
                .setColor('#0099ff')
                .setDescription('테스트 서버 → 프로덕션 서버 배포를 시작합니다.')
                .addFields({ name: '진행 상황', value: deploymentSteps[0] });

            await interaction.editReply({ embeds: [embed] });

            // 2. Backup current production
            await this.backupProduction();
            
            // 3. Validate test server
            const validation = await this.validateTestServer();
            if (!validation.success) {
                throw new Error(`검증 실패: ${validation.error}`);
            }

            // 4. Deploy to production
            await this.deployToProduction();

            // 5. Update version info
            await this.updateVersionInfo();

            embed.setDescription('✅ 배포가 성공적으로 완료되었습니다!')
                .setColor('#00ff00')
                .addFields(
                    { name: '배포 버전', value: 'v2.0.0 → v1.0.0', inline: true },
                    { name: '배포 시간', value: new Date().toLocaleString('ko-KR'), inline: true }
                );

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Deployment error:', error);
            await interaction.editReply({
                content: `❌ 배포 중 오류가 발생했습니다: ${error.message}`,
                embeds: []
            });
        }
    },

    async backupProduction() {
        // Create backup of current production code and database
        const backupDir = `./backups/${Date.now()}`;
        await fs.mkdir(backupDir, { recursive: true });
        
        // Backup code
        await exec(`cp -r ./production/* ${backupDir}/code/`);
        
        // Backup database
        await exec(`mongodump --uri="${process.env.PROD_MONGO_URI}" --out="${backupDir}/db"`);
    },

    async validateTestServer() {
        // Run tests and validations
        const tests = [
            { name: 'Unit Tests', command: 'npm test' },
            { name: 'Lint Check', command: 'npm run lint' },
            { name: 'Database Migration', command: 'npm run migrate:dry-run' }
        ];

        for (const test of tests) {
            try {
                await exec(test.command);
            } catch (error) {
                return { success: false, error: `${test.name} failed` };
            }
        }

        return { success: true };
    },

    async deployToProduction() {
        // Copy test server code to production
        const deployScript = `
            # Stop production bot
            pm2 stop kimhunter-prod
            
            # Copy new code
            rsync -av --exclude='node_modules' --exclude='.env' ./test/ ./production/
            
            # Install dependencies
            cd ./production && npm install --production
            
            # Start production bot
            pm2 start kimhunter-prod
        `;

        await exec(deployScript);
    },

    async updateVersionInfo() {
        // Update version tracking
        const versionInfo = {
            version: '2.0.0',
            deployedAt: new Date().toISOString(),
            deployedBy: interaction.user.tag,
            previousVersion: '1.0.0'
        };

        await fs.writeFile('./production/version.json', JSON.stringify(versionInfo, null, 2));
    }
};
```

### 4. Process Management Setup
```javascript
// ecosystem.config.js (PM2 configuration)
module.exports = {
    apps: [
        {
            name: 'kimhunter-test',
            script: './index.js',
            env: {
                NODE_ENV: 'test',
                BOT_ENVIRONMENT: 'test'
            },
            watch: true,
            ignore_watch: ['node_modules', 'logs', 'backups'],
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s'
        },
        {
            name: 'kimhunter-prod',
            script: './index.js',
            env: {
                NODE_ENV: 'production',
                BOT_ENVIRONMENT: 'production'
            },
            watch: false,
            autorestart: false,
            instances: 1,
            exec_mode: 'fork'
        }
    ]
};
```

### 5. Environment Detection in Main Bot
```javascript
// index.js modification
const environment = process.env.BOT_ENVIRONMENT || 'test';
const config = require('./config/environments')[environment];

// Use environment-specific configuration
const client = new Client({ intents: [...] });
client.login(config.botToken);

// Display environment in status
client.once('ready', () => {
    console.log(`Bot is running in ${environment.toUpperCase()} mode`);
    client.user.setActivity(`${config.version} | ${environment}`, { type: 'PLAYING' });
});
```

### 6. Database Migration System
```javascript
// migrations/migrationManager.js
class MigrationManager {
    constructor(sourceDb, targetDb) {
        this.sourceDb = sourceDb;
        this.targetDb = targetDb;
    }

    async migrateUserData() {
        const collections = ['users', 'inventories', 'guilds'];
        
        for (const collection of collections) {
            const sourceCol = this.sourceDb.collection(collection);
            const targetCol = this.targetDb.collection(collection);
            
            const data = await sourceCol.find({}).toArray();
            
            if (data.length > 0) {
                await targetCol.insertMany(data, { ordered: false });
            }
        }
    }

    async validateMigration() {
        // Verify data integrity after migration
        const collections = ['users', 'inventories', 'guilds'];
        const results = {};
        
        for (const collection of collections) {
            const sourceCount = await this.sourceDb.collection(collection).countDocuments();
            const targetCount = await this.targetDb.collection(collection).countDocuments();
            
            results[collection] = {
                source: sourceCount,
                target: targetCount,
                match: sourceCount === targetCount
            };
        }
        
        return results;
    }
}
```

## Deployment Workflow

### 1. Development Phase (Test Server)
- Developers work on version 2 features
- Auto-restart enabled for quick testing
- Test database for experimental data
- All new features tested here first

### 2. Validation Phase
- Run automated tests
- Check for breaking changes
- Validate database migrations
- Performance testing

### 3. Deployment Phase
- Admin runs `/본서버적용` command
- System creates backup of production
- Validates test server code
- Deploys to production server
- Updates version information

### 4. Rollback Capability
```javascript
// commands/rollback.js
module.exports = {
    data: new SlashCommandBuilder()
        .setName('본서버롤백')
        .setDescription('이전 버전으로 롤백합니다')
        .addStringOption(option =>
            option.setName('backup_id')
                .setDescription('백업 ID')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        // Restore from backup
        const backupId = interaction.options.getString('backup_id');
        await restoreFromBackup(backupId);
    }
};
```

## Security Considerations

1. **Access Control**: Only authorized admins can deploy
2. **Backup System**: Automatic backups before deployment
3. **Validation**: Multiple validation steps before deployment
4. **Monitoring**: Log all deployment activities
5. **Rollback**: Quick rollback capability if issues arise

## Directory Structure
```
kimhunter/
├── test/                 # Test server code (v2)
│   ├── index.js
│   ├── commands/
│   └── ...
├── production/          # Production server code (v1)
│   ├── index.js
│   ├── commands/
│   └── ...
├── backups/            # Deployment backups
│   └── [timestamp]/
│       ├── code/
│       └── db/
├── config/
│   └── environments.js
└── ecosystem.config.js  # PM2 configuration
```

## Implementation Steps

1. **Set up separate bot applications** in Discord Developer Portal
2. **Configure separate MongoDB databases** for test and production
3. **Set up PM2** for process management
4. **Implement deployment command** with proper validation
5. **Test deployment workflow** thoroughly
6. **Document deployment procedures** for team

This system ensures that:
- Production remains stable with version 1
- Test server can be actively developed with version 2
- Deployment is controlled and validated
- Rollback is possible if issues occur
- User data is properly separated between environments