const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.PRODUCTION_GUILD_ID;
const adminUserId = '424480594542592009'; // 당신의 Discord ID

const rest = new REST({ version: '10' }).setToken(token);

console.log('🔧 특정 사용자에게만 관리자 명령어 표시 설정\n');

(async () => {
    try {
        // commands.js 가져오기
        const { productionCommands } = require('./commands/commands');
        
        // 관리자 명령어와 일반 명령어 분리
        const adminCommands = productionCommands.filter(cmd => 
            cmd.default_member_permissions === '8'
        );
        const normalCommands = productionCommands.filter(cmd => 
            !cmd.default_member_permissions
        );
        
        console.log(`📋 관리자 명령어 (${adminCommands.length}개):`);
        adminCommands.forEach(cmd => console.log(`  - /${cmd.name}`));
        
        console.log(`\n📋 일반 명령어 (${normalCommands.length}개):`);
        normalCommands.forEach(cmd => console.log(`  - /${cmd.name}`));
        
        // 관리자 명령어에 특정 사용자만 볼 수 있도록 설정
        const modifiedAdminCommands = adminCommands.map(cmd => ({
            ...cmd,
            default_member_permissions: '0', // 기본적으로 아무도 못 봄
            dm_permission: false
        }));
        
        // 모든 명령어 재등록
        console.log('\n🔄 명령어 재등록 중...');
        
        // 기존 명령어 삭제
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [] }
        );
        
        // 새로 등록
        const allCommands = [...normalCommands, ...modifiedAdminCommands];
        const registeredCommands = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: allCommands }
        );
        
        console.log(`✅ ${registeredCommands.length}개 명령어 등록 완료!\n`);
        
        // 관리자 명령어에 대해 특정 사용자 권한 설정
        console.log('🔐 특정 사용자에게만 관리자 명령어 권한 부여 중...');
        
        for (const cmd of registeredCommands) {
            // 관리자 명령어인 경우만
            if (adminCommands.some(ac => ac.name === cmd.name)) {
                try {
                    // 특정 사용자에게만 권한 부여
                    await rest.put(
                        Routes.applicationCommandPermissions(clientId, guildId, cmd.id),
                        {
                            body: {
                                permissions: [
                                    {
                                        id: adminUserId,
                                        type: 2, // USER 타입
                                        permission: true // 허용
                                    }
                                ]
                            }
                        }
                    );
                    console.log(`  ✅ /${cmd.name} - 사용자 ${adminUserId}에게만 표시`);
                } catch (error) {
                    if (error.code === 10066) {
                        console.log(`  ⚠️ /${cmd.name} - 봇에 권한 설정 권한 없음`);
                    } else {
                        console.log(`  ❌ /${cmd.name} - 오류: ${error.message}`);
                    }
                }
            }
        }
        
        console.log('\n✨ 설정 완료!');
        console.log('\n📌 결과:');
        console.log('- 일반 명령어: 모든 사용자가 볼 수 있음');
        console.log('- 관리자 명령어: 오직 당신만 볼 수 있음');
        console.log('\n⚠️ 주의: 봇에 "서버 관리" 권한이 없으면 권한 설정이 작동하지 않을 수 있습니다.');
        console.log('그런 경우 서버 설정 > 통합 > 봇에서 수동으로 설정해야 합니다.');
        
    } catch (error) {
        console.error('❌ 오류:', error);
    }
})();