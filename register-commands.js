require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// 프로덕션 서버 ID
const GUILD_ID = '1386384507032039558'; // 프로덕션 서버 ID

const commands = [
    new SlashCommandBuilder()
        .setName('댕댕봇소환')
        .setDescription('댕댕봇을 이 채널에 소환합니다 (개발자 전용)')
        .setDefaultMemberPermissions(8)
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('댕댕봇소환 명령어 등록 중...');
        console.log('대상 서버:', GUILD_ID);
        
        // 특정 서버에 명령어 등록 (즉시 반영)
        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        
        console.log('✅ 댕댕봇소환 명령어가 등록되었습니다!');
        console.log('서버에 즉시 반영됩니다.');
        
    } catch (error) {
        console.error('❌ 명령어 등록 실패:', error);
        console.log('다른 서버 ID로 시도해보세요.');
    }
})();