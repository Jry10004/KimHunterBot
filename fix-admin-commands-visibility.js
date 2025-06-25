const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.PRODUCTION_GUILD_ID;

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('🔧 관리자 명령어 가시성 수정 중...\n');
        
        // 현재 명령어 가져오기
        const commands = await rest.get(
            Routes.applicationGuildCommands(clientId, guildId)
        );
        
        // 관리자 명령어 찾기
        const adminCommands = commands.filter(cmd => 
            cmd.default_member_permissions === '8' ||
            ['말', '공지작성'].includes(cmd.name)
        );
        
        console.log(`📋 수정할 관리자 명령어 (${adminCommands.length}개):`);
        adminCommands.forEach(cmd => {
            console.log(`- /${cmd.name}`);
        });
        
        // 명령어별로 권한 수정
        for (const cmd of adminCommands) {
            try {
                // 권한을 제거하여 모든 사용자가 볼 수 있게 함
                const updatedCommand = {
                    ...cmd,
                    default_member_permissions: null, // 권한 제거
                    dm_permission: false // DM에서는 사용 불가
                };
                
                await rest.patch(
                    Routes.applicationGuildCommand(clientId, guildId, cmd.id),
                    { body: updatedCommand }
                );
                
                console.log(`✅ /${cmd.name} 명령어 가시성 수정 완료`);
            } catch (error) {
                console.error(`❌ /${cmd.name} 수정 실패:`, error.message);
            }
        }
        
        console.log('\n🔄 작업 완료!');
        console.log('Discord 클라이언트를 새로고침해주세요 (Ctrl+R)');
        
    } catch (error) {
        console.error('❌ 오류:', error);
    }
})();