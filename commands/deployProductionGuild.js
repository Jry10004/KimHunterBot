const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './.env.production.private' });

// Production bot credentials
const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.PRODUCTION_GUILD_ID;

if (!token || !clientId || !guildId) {
    console.error('❌ Missing BOT_TOKEN, CLIENT_ID, or PRODUCTION_GUILD_ID');
    process.exit(1);
}

// Load commands from deployProductionCommands.js
const { productionCommands } = require('./commands');

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`🚀 본서버 (${guildId})에 명령어 등록 시작...`);
        console.log(`📝 총 ${productionCommands.length}개의 커맨드를 등록합니다.`);

        // Register commands for specific guild (instant)
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: productionCommands },
        );

        console.log(`✅ 성공적으로 ${data.length}개의 명령어를 본서버에 등록했습니다!`);
        console.log('📌 서버별 명령어는 즉시 사용 가능합니다!');
    } catch (error) {
        console.error('❌ 커맨드 등록 중 오류 발생:', error);
        process.exit(1);
    }
})();