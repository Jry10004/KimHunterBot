const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.PRODUCTION_GUILD_ID;

const rest = new REST({ version: '10' }).setToken(token);

console.log('🔧 특정 사용자 전용 명령어 배포\n');
console.log('📌 이제 관리자 명령어도 모두 볼 수 있습니다.');
console.log('단, index.js에서 사용자 ID를 체크하여 당신만 실행할 수 있습니다.\n');

(async () => {
    try {
        // 권한 제거된 명령어 가져오기
        const { productionCommands } = require('./commands/commands-for-user');
        
        console.log('🔄 명령어 재배포 중...');
        
        // 기존 명령어 삭제
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [] }
        );
        
        // 새 명령어 등록
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: productionCommands }
        );
        
        console.log(`✅ ${data.length}개 명령어 등록 완료!\n`);
        
        console.log('📋 등록된 명령어:');
        data.forEach((cmd, index) => {
            console.log(`${index + 1}. /${cmd.name} - ${cmd.description}`);
        });
        
        console.log('\n✨ 완료!');
        console.log('\n중요: index.js에서 관리자 명령어 권한 체크를 수정해야 합니다.');
        console.log('당신의 ID(424480594542592009)만 허용하도록 변경하겠습니다.');
        
    } catch (error) {
        console.error('❌ 오류:', error);
    }
})();