const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.PRODUCTION_GUILD_ID;
const adminUserId = '424480594542592009';

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('🔧 명령어 권한 설정 중...\n');
        
        // 현재 명령어 가져오기
        const commands = await rest.get(
            Routes.applicationGuildCommands(clientId, guildId)
        );
        
        // 관리자 명령어 찾기
        const adminCommands = commands.filter(cmd => 
            cmd.default_member_permissions === '8' ||
            ['말', '공지작성'].includes(cmd.name)
        );
        
        console.log(`📋 관리자 명령어 목록 (${adminCommands.length}개):`);
        
        for (const cmd of adminCommands) {
            console.log(`\n/${cmd.name} (ID: ${cmd.id})`);
            
            try {
                // 명령어별 권한 설정 가져오기
                const permissions = await rest.get(
                    Routes.applicationCommandPermissions(clientId, guildId, cmd.id)
                ).catch(() => null);
                
                if (permissions) {
                    console.log('  현재 권한 설정:');
                    permissions.permissions?.forEach(perm => {
                        console.log(`    - ${perm.type === 1 ? '역할' : '유저'} ${perm.id}: ${perm.permission ? '허용' : '거부'}`);
                    });
                } else {
                    console.log('  현재 권한 설정: 없음 (기본값 사용)');
                }
                
                // 특정 사용자에게 권한 부여
                const newPermissions = {
                    permissions: [
                        {
                            id: adminUserId,
                            type: 2, // USER type
                            permission: true
                        }
                    ]
                };
                
                // 권한 설정 시도
                await rest.put(
                    Routes.applicationCommandPermissions(clientId, guildId, cmd.id),
                    { body: newPermissions }
                );
                
                console.log(`  ✅ 사용자 ${adminUserId}에게 권한 부여 완료`);
                
            } catch (error) {
                if (error.code === 10066) {
                    console.log('  ⚠️ 봇이 서버 관리자 권한이 없어 권한 설정 불가');
                } else {
                    console.log(`  ❌ 권한 설정 실패: ${error.message}`);
                }
            }
        }
        
        console.log('\n💡 해결 방법:');
        console.log('1. 서버 설정 > 통합 > 봇 선택');
        console.log('2. 각 명령어별로 권한 설정 가능');
        console.log('3. 또는 봇에게 "서버 관리" 권한 부여');
        console.log('\n🔗 직접 설정: https://discord.com/channels/' + guildId);
        
    } catch (error) {
        console.error('❌ 오류:', error);
    }
})();