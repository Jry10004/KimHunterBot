require('dotenv').config();
const { REST, Routes } = require('discord.js');

const commands = [
    require('./commands/dogBotRescue.js').data.toJSON(),
    require('./commands/startRescueEvent.js').data.toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN || process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🐕 댕댕봇 구출 이벤트 명령어 등록 중...');

        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.PRODUCTION_GUILD_ID || '1371881456212639794'),
            { body: commands },
        );

        console.log(`✅ ${data.length}개의 명령어가 등록되었습니다!`);
        data.forEach(cmd => {
            console.log(`  - /${cmd.name}: ${cmd.description}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ 오류:', error);
        process.exit(1);
    }
})();