const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import production commands from commands.js
const { productionCommands } = require('./commands');

// Production bot credentials
const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
    console.error('❌ Missing BOT_TOKEN or CLIENT_ID in .env.production');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`🚀 Production bot (${clientId}) 슬래시 커맨드 등록 시작...`);
        console.log(`📝 총 ${productionCommands.length}개의 커맨드를 등록합니다.`);

        // Register commands globally for production
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: productionCommands },
        );

        console.log(`✅ 성공적으로 ${data.length}개의 프로덕션 커맨드를 등록했습니다!`);
        console.log('📌 글로벌 커맨드는 모든 서버에서 사용 가능합니다.');
        console.log('⏰ 글로벌 커맨드는 최대 1시간까지 반영이 지연될 수 있습니다.');
    } catch (error) {
        console.error('❌ 커맨드 등록 중 오류 발생:', error);
        process.exit(1);
    }
})();