require('dotenv').config();
const { REST, Routes } = require('discord.js');

const command = {
    name: '사용자삭제',
    description: '특정 이메일 패턴을 가진 사용자를 삭제합니다 (관리자 전용)',
    options: [{
        name: '이메일패턴',
        description: '삭제할 이메일 패턴 (예: rla00823)',
        type: 3, // STRING
        required: true
    }]
};

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN || process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 사용자삭제 명령어를 등록하는 중...');

        // 글로벌 명령어로 등록
        const data = await rest.post(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: command },
        );

        console.log('✅ 사용자삭제 명령어가 성공적으로 등록되었습니다!');
        console.log('명령어 정보:', data);
        
    } catch (error) {
        console.error('❌ 명령어 등록 중 오류 발생:', error);
    }
})();