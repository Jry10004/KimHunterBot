const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.PRODUCTION_GUILD_ID;

if (!token || !clientId || !guildId) {
    console.error('❌ Missing BOT_TOKEN, CLIENT_ID, or PRODUCTION_GUILD_ID');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('🧹 본서버 명령어 초기화 중...');
        
        // 먼저 모든 길드 명령어 삭제
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [] },
        );
        
        console.log('✅ 명령어 초기화 완료!');
        console.log('🔄 새 명령어 등록 중...');
        
        // commands.js에서 명령어 가져오기
        const { productionCommands } = require('./commands/commands');
        
        // 새로 등록
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: productionCommands },
        );
        
        console.log(`✅ ${data.length}개의 명령어가 본서버에 등록되었습니다!`);
        
        // 등록된 명령어 목록 출력
        console.log('\n📋 등록된 명령어 목록:');
        data.forEach((cmd, index) => {
            console.log(`${index + 1}. /${cmd.name} - ${cmd.description}`);
        });
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    }
})();