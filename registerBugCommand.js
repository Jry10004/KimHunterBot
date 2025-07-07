require('dotenv').config();
const { REST, Routes } = require('discord.js');
const path = require('path');

// 버그발견 명령어만 등록
const qaCommand = require('./commands/utility/qa.js');

const commands = [qaCommand.data.toJSON()];

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN || process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 /버그발견 명령어를 등록하는 중...');

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('✅ /버그발견 명령어가 성공적으로 등록되었습니다!');
        console.log('📋 등록된 명령어:', data[0]?.name);
        
    } catch (error) {
        console.error('❌ 명령어 등록 중 오류 발생:', error);
    }
})();