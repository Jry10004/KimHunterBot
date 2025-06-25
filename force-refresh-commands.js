const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.PRODUCTION_GUILD_ID;

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('🔍 현재 등록된 명령어 확인 중...');
        
        // 현재 등록된 명령어 확인
        const currentCommands = await rest.get(
            Routes.applicationGuildCommands(clientId, guildId)
        );
        
        console.log(`\n현재 ${currentCommands.length}개의 명령어가 등록되어 있습니다:`);
        currentCommands.forEach(cmd => {
            console.log(`- /${cmd.name} (ID: ${cmd.id})`);
        });
        
        // 글로벌 명령어도 확인
        console.log('\n🌍 글로벌 명령어 확인 중...');
        const globalCommands = await rest.get(
            Routes.applicationCommands(clientId)
        );
        
        if (globalCommands.length > 0) {
            console.log(`\n글로벌 명령어 ${globalCommands.length}개 발견:`);
            globalCommands.forEach(cmd => {
                console.log(`- /${cmd.name} (ID: ${cmd.id})`);
            });
            
            // 글로벌 명령어 삭제
            console.log('\n🧹 글로벌 명령어 삭제 중...');
            await rest.put(Routes.applicationCommands(clientId), { body: [] });
            console.log('✅ 글로벌 명령어 삭제 완료!');
        }
        
        // 특정 명령어만 다시 등록
        console.log('\n🔄 관리자 명령어 재등록 중...');
        
        const adminCommands = [
            {
                name: '말',
                description: '봇이 메시지를 전송합니다 (관리자 전용)',
                type: 1,
                default_member_permissions: '8',
                options: [
                    {
                        name: '메시지',
                        description: '봇이 전송할 메시지',
                        type: 3,
                        required: true
                    },
                    {
                        name: '채널',
                        description: '메시지를 전송할 채널 (비워두면 현재 채널)',
                        type: 7,
                        required: false,
                        channel_types: [0, 5]
                    }
                ]
            },
            {
                name: '공지작성',
                description: '프로페셔널 공지사항을 작성합니다 (관리자 전용)',
                type: 1,
                default_member_permissions: '8',
                options: [
                    {
                        name: '새공지',
                        description: '새로운 공지사항을 작성합니다',
                        type: 1,
                        options: [
                            {
                                name: '템플릿',
                                description: '공지 템플릿을 선택하세요',
                                type: 3,
                                required: true,
                                choices: [
                                    { name: '📢 기본 공지', value: 'basic' },
                                    { name: '🔧 점검 공지', value: 'maintenance' },
                                    { name: '🎉 이벤트 공지', value: 'event' },
                                    { name: '📋 업데이트 공지', value: 'update' }
                                ]
                            }
                        ]
                    },
                    {
                        name: '미리보기',
                        description: '저장된 공지를 미리보기합니다',
                        type: 1,
                        options: [
                            {
                                name: '공지id',
                                description: '미리보기할 공지 ID',
                                type: 3,
                                required: true
                            }
                        ]
                    },
                    {
                        name: '발송',
                        description: '저장된 공지를 발송합니다',
                        type: 1,
                        options: [
                            {
                                name: '공지id',
                                description: '발송할 공지 ID',
                                type: 3,
                                required: true
                            },
                            {
                                name: '채널',
                                description: '공지를 발송할 채널',
                                type: 7,
                                required: true,
                                channel_types: [0, 5]
                            },
                            {
                                name: '멘션',
                                description: '멘션 옵션',
                                type: 3,
                                required: false,
                                choices: [
                                    { name: '@everyone', value: 'everyone' },
                                    { name: '@here', value: 'here' },
                                    { name: '멘션 없음', value: 'none' }
                                ]
                            }
                        ]
                    },
                    {
                        name: '목록',
                        description: '저장된 공지 목록을 확인합니다',
                        type: 1
                    },
                    {
                        name: '삭제',
                        description: '저장된 공지를 삭제합니다',
                        type: 1,
                        options: [
                            {
                                name: '공지id',
                                description: '삭제할 공지 ID',
                                type: 3,
                                required: true
                            }
                        ]
                    }
                ]
            }
        ];
        
        // 개별적으로 등록
        for (const cmd of adminCommands) {
            try {
                const result = await rest.post(
                    Routes.applicationGuildCommands(clientId, guildId),
                    { body: cmd }
                );
                console.log(`✅ /${cmd.name} 명령어 등록 완료!`);
            } catch (error) {
                console.error(`❌ /${cmd.name} 등록 실패:`, error.message);
            }
        }
        
        console.log('\n✨ 작업 완료!');
        console.log('Discord를 재시작하고 1-2분 후에 다시 확인해보세요.');
        
    } catch (error) {
        console.error('오류:', error);
    }
})();