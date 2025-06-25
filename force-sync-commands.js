const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: '.env.production.private' });

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('기존 명령어 삭제 중...');
        
        // 글로벌 명령어 모두 삭제
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        
        console.log('✅ 모든 명령어가 삭제되었습니다.');
        console.log('이제 봇을 재시작하면 명령어가 다시 등록됩니다.');
        
    } catch (error) {
        console.error('오류:', error);
    }
})();