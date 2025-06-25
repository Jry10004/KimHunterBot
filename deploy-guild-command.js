const { REST, Routes } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = '1386384507032039558'; // 본서버 ID

const commands = [
    {
        name: '댕댕봇소환',
        description: '댕댕봇을 이 채널에 소환합니다 (개발자 전용)',
        type: 1
    }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('댕댕봇소환 명령어를 길드에 등록 중...');
        
        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        
        console.log(`✅ 성공적으로 ${data.length}개의 명령어를 길드에 등록했습니다!`);
        console.log('길드 명령어는 즉시 반영됩니다.');
    } catch (error) {
        console.error('명령어 등록 중 오류:', error);
    }
})();