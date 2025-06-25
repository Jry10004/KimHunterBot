const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.PRODUCTION_GUILD_ID;

const rest = new REST({ version: '10' }).setToken(token);

console.log('🔒 비공개 관리자 명령어 설정\n');

// 일반 사용자용 명령어 (관리자 명령어 제외)
const publicCommands = [
    {
        name: '게임',
        description: '게임 메뉴를 엽니다',
        type: 1,
    },
    {
        name: '핑',
        description: '봇의 응답속도를 확인합니다',
        type: 1,
    },
    {
        name: '회원가입',
        description: '김헌터 게임에 회원가입합니다',
        type: 1,
    },
    {
        name: '강화',
        description: '장비를 강화합니다',
        type: 1,
    },
    {
        name: '주식',
        description: '주식 거래소를 엽니다',
        type: 1,
    },
    {
        name: '랭킹',
        description: '전체 랭킹을 확인합니다',
        type: 1,
    },
    {
        name: '의뢰',
        description: '랜덤 의뢰를 수행합니다',
        type: 1,
    },
    {
        name: '결투',
        description: 'PVP 결투를 시작합니다',
        type: 1,
    },
    {
        name: '독버섯',
        description: '독버섯 게임을 시작합니다',
        type: 1,
    },
    {
        name: '홀짝',
        description: '홀짝 게임을 시작합니다',
        type: 1,
    },
    {
        name: '에너지채굴',
        description: '에너지 조각을 채굴합니다',
        type: 1,
    },
    {
        name: '유물탐사',
        description: '유물 탐사를 시작합니다',
        type: 1,
    },
    {
        name: '사전강화',
        description: '오픈 전 강화 이벤트에 참여합니다',
        type: 1,
    }
];

// 숨겨진 관리자 명령어 (앞에 특수 접두사 추가)
const hiddenAdminCommands = [
    {
        name: 'ㅋ말',
        description: '[관리자] 봇이 메시지를 전송합니다',
        type: 1,
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
        name: 'ㅋ공지작성',
        description: '[관리자] 프로페셔널 공지사항을 작성합니다',
        type: 1,
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
    },
    {
        name: 'ㅋ카운트다운',
        description: '[관리자] 오픈 카운트다운을 관리합니다',
        type: 1,
        options: [
            {
                name: '시작',
                description: '카운트다운을 시작합니다',
                type: 1,
                options: [
                    {
                        name: '시간',
                        description: '카운트다운 시간 (시간 단위 또는 YYYY-MM-DD-HH:MM 형식)',
                        type: 3,
                        required: true
                    },
                    {
                        name: '채널',
                        description: '카운트다운을 표시할 채널',
                        type: 7,
                        required: false,
                        channel_types: [0, 5]
                    }
                ]
            },
            {
                name: '중지',
                description: '카운트다운을 중지합니다',
                type: 1
            }
        ]
    },
    {
        name: 'ㅋ보스',
        description: '[관리자] 보스 레이드를 관리합니다',
        type: 1,
        options: [
            {
                name: '스폰',
                description: '보스를 소환합니다',
                type: 1,
                options: [
                    {
                        name: '보스',
                        description: '소환할 보스를 선택하세요',
                        type: 3,
                        required: false,
                        choices: [
                            { name: '그림자 암살자', value: 'shadow_assassin' },
                            { name: '용암 골렘', value: 'lava_golem' },
                            { name: '얼음 여왕', value: 'ice_queen' },
                            { name: '폭풍의 지배자', value: 'storm_lord' },
                            { name: '어둠의 군주', value: 'dark_lord' }
                        ]
                    }
                ]
            },
            {
                name: '종료',
                description: '현재 보스를 제거합니다',
                type: 1
            },
            {
                name: '정보',
                description: '현재 보스 정보를 확인합니다',
                type: 1
            }
        ]
    },
    {
        name: 'ㅋ돈지급',
        description: '[관리자] 유저에게 골드를 지급합니다',
        type: 1,
        options: [
            {
                name: '유저',
                description: '골드를 지급할 유저',
                type: 6,
                required: true
            },
            {
                name: '금액',
                description: '지급할 골드 금액',
                type: 4,
                required: true,
                min_value: 1
            }
        ]
    },
    {
        name: 'ㅋip관리',
        description: '[관리자] IP 관련 정보를 관리합니다',
        type: 1,
        options: [
            {
                name: '조회',
                description: '유저의 IP 정보를 조회합니다',
                type: 1,
                options: [
                    {
                        name: '유저',
                        description: '조회할 유저',
                        type: 6,
                        required: true
                    }
                ]
            },
            {
                name: '이메일조회',
                description: '이메일로 연결된 모든 계정을 조회합니다',
                type: 1,
                options: [
                    {
                        name: '이메일',
                        description: '조회할 이메일 주소',
                        type: 3,
                        required: true
                    }
                ]
            },
            {
                name: '차단',
                description: 'IP를 차단 목록에 추가합니다',
                type: 1,
                options: [
                    {
                        name: 'ip',
                        description: '차단할 IP 주소',
                        type: 3,
                        required: true
                    },
                    {
                        name: '사유',
                        description: '차단 사유',
                        type: 3,
                        required: false
                    }
                ]
            }
        ]
    },
    {
        name: 'ㅋ매크로테스트',
        description: '[관리자] 매크로 방지 시스템을 테스트합니다',
        type: 1,
        options: [
            {
                name: '타입',
                description: '테스트 유형을 선택하세요',
                type: 3,
                required: true,
                choices: [
                    { name: '기본 검증', value: 'basic' },
                    { name: '빠른 클릭 패턴', value: 'rapid' },
                    { name: '반복 패턴', value: 'pattern' },
                    { name: '상태 확인', value: 'status' },
                    { name: '초기화', value: 'reset' }
                ]
            },
            {
                name: '대상',
                description: '테스트 대상 유저 (비워두면 자신)',
                type: 6,
                required: false
            }
        ]
    }
];

(async () => {
    try {
        console.log('🗑️ 기존 명령어 모두 삭제 중...');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [] }
        );
        
        console.log('📝 새 명령어 등록 중...');
        
        // 모든 명령어 합치기
        const allCommands = [...publicCommands, ...hiddenAdminCommands];
        
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: allCommands }
        );
        
        console.log(`\n✅ ${data.length}개 명령어 등록 완료!\n`);
        
        console.log('📋 일반 사용자가 볼 수 있는 명령어:');
        publicCommands.forEach(cmd => console.log(`  - /${cmd.name}`));
        
        console.log('\n🔒 숨겨진 관리자 명령어 (ㅋ 접두사):');
        hiddenAdminCommands.forEach(cmd => console.log(`  - /${cmd.name}`));
        
        console.log('\n💡 팁:');
        console.log('- 일반 사용자는 "ㅋ"로 시작하는 명령어를 잘 모릅니다');
        console.log('- 당신만 이 명령어들의 존재를 알고 있으면 됩니다');
        console.log('- index.js도 수정해서 새로운 명령어 이름을 인식하도록 해야 합니다');
        
    } catch (error) {
        console.error('❌ 오류:', error);
    }
})();