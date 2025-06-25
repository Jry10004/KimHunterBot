const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.PRODUCTION_GUILD_ID;

const rest = new REST({ version: '10' }).setToken(token);

console.log('🔧 임시로 관리자 권한 요구사항 제거하기\n');
console.log('⚠️ 주의: 이렇게 하면 모든 사용자가 관리자 명령어를 볼 수 있게 됩니다!');
console.log('나중에 다시 권한을 설정해야 합니다.\n');

(async () => {
    try {
        // commands.js 가져오기
        const { productionCommands } = require('./commands/commands');
        
        // 관리자 권한 제거한 버전 만들기
        const modifiedCommands = productionCommands.map(cmd => {
            if (cmd.default_member_permissions === '8') {
                console.log(`📝 /${cmd.name} - 관리자 권한 제거`);
                return {
                    ...cmd,
                    default_member_permissions: undefined // 권한 제거
                };
            }
            return cmd;
        });
        
        console.log('\n🔄 명령어 재등록 중...');
        
        // 기존 명령어 모두 삭제
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [] }
        );
        
        // 수정된 명령어 등록
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: modifiedCommands }
        );
        
        console.log(`\n✅ ${data.length}개 명령어 등록 완료!`);
        console.log('\n이제 모든 사용자가 다음 명령어를 볼 수 있습니다:');
        console.log('- /말');
        console.log('- /공지작성');
        console.log('- /카운트다운');
        console.log('- /보스');
        console.log('- /돈지급');
        console.log('- /ip관리');
        console.log('- /매크로테스트');
        
        console.log('\n⚠️ 보안 주의사항:');
        console.log('1. 이 명령어들을 실제로 실행하려면 여전히 관리자 권한이 필요합니다');
        console.log('2. index.js에서 권한 체크를 하고 있으므로 안전합니다');
        console.log('3. 하지만 가능한 빨리 다시 권한을 설정하세요!');
        
    } catch (error) {
        console.error('❌ 오류:', error);
    }
})();