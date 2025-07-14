const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.once('ready', async () => {
    console.log(`${client.user.tag}으로 로그인했습니다!`);
    
    try {
        const channelId = '1393397812359598162';
        const channel = await client.channels.fetch(channelId);
        
        if (!channel) {
            console.error('채널을 찾을 수 없습니다!');
            process.exit(1);
        }

        // 기존 메시지 모두 삭제
        const messages = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(messages);

        // 1. 김헌터 소개
        const introEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🎮 김헌터 게임 월드에 오신 것을 환영합니다!')
            .setDescription('김헌터는 디스코드 기반의 종합 RPG 게임봇입니다.\n캐릭터를 성장시키고, 다양한 콘텐츠를 즐기며, 다른 유저들과 경쟁해보세요!')
            .addFields(
                {
                    name: '📖 게임 스토리',
                    value: '평범한 일상을 보내던 당신은 어느 날 갑자기 이세계로 소환됩니다.\n' +
                           '이곳은 몬스터와 마법이 존재하는 판타지 세계!\n' +
                           '당신은 "김헌터"라는 이름의 초보 모험가가 되어,\n' +
                           '최강의 헌터를 목표로 모험을 시작합니다.',
                    inline: false
                },
                {
                    name: '🎯 게임 목표',
                    value: '• **만렙 달성**: 100레벨 도달\n' +
                           '• **최강 장비**: 30강 장비 세트 완성\n' +
                           '• **계급 상승**: 김헌터 신이 되기\n' +
                           '• **랭킹 1위**: 다양한 랭킹에서 정상 차지',
                    inline: false
                }
            )
            .setFooter({ text: '김헌터 - 당신의 모험이 시작됩니다' });

        // 2. 시작하기
        const startEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🚀 시작하기')
            .addFields(
                {
                    name: '1️⃣ 회원가입',
                    value: '```/회원가입```\n김헌터 세계의 시민이 되어보세요!',
                    inline: false
                },
                {
                    name: '2️⃣ 게임 시작',
                    value: '```/게임```\n다양한 미니게임과 사냥을 즐겨보세요!',
                    inline: false
                },
                {
                    name: '3️⃣ 일일 보상 받기',
                    value: '```/출석체크```\n매일 접속하여 보상을 받으세요!',
                    inline: false
                }
            );

        // 3. 기본 정보
        const basicInfoEmbed = new EmbedBuilder()
            .setColor('#00d2d3')
            .setTitle('📊 기본 게임 정보')
            .addFields(
                {
                    name: '🎮 게임 기본 정보',
                    value: '• **최대 레벨**: 100레벨\n' +
                           '• **시작 골드**: 1,000G\n' +
                           '• **인벤토리**: 50칸\n' +
                           '• **사냥 티켓**: 20분마다 1장 재생성\n' +
                           '• **최대 강화**: 30강',
                    inline: true
                },
                {
                    name: '📈 레벨업 정보',
                    value: '• **경험치 공식**: 레벨×100 + (레벨-1)×50\n' +
                           '• **스탯 포인트**: 레벨업당 5포인트\n' +
                           '• **스탯 초기화**: 1,000만 골드\n' +
                           '• **레벨 보너스**: 전투력 +10/레벨',
                    inline: true
                }
            );

        // 4. 스탯 시스템
        const statEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('💪 스탯 시스템')
            .setDescription('각 직업별 주요 스탯을 선택하여 캐릭터를 육성하세요!')
            .addFields(
                {
                    name: '📊 스탯 종류',
                    value: '• **💪 힘 (STR)**: 전사 주스탯, 물리 공격력 증가\n' +
                           '• **🏃 민첩 (AGI)**: 궁수 주스탯, 치명타 및 회피율 증가\n' +
                           '• **🧠 지능 (INT)**: 마법사 주스탯, 마법 공격력 증가\n' +
                           '• **❤️ 체력 (VIT)**: 수호자 주스탯, 최대 HP 및 방어력 증가\n' +
                           '• **🍀 행운 (LUK)**: 도적 주스탯, 크리티컬 및 강화 성공률 증가',
                    inline: false
                },
                {
                    name: '⚖️ 전투력 계산',
                    value: '• 힘 ×2, 민첩 ×1.5, 지능 ×1.2, 체력 ×1.8, 행운 ×0.5\n' +
                           '• 장비 공격력 ×2, 방어력 ×1.5\n' +
                           '• 강화 레벨당 +10\n' +
                           '• 엠블럼 강화당 +20',
                    inline: false
                }
            );

        // 5. 사냥터 정보
        const huntingEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🗺️ 사냥터 정보')
            .addFields(
                {
                    name: '🌸 꽃잎 마을 근처 (Lv.1-20)',
                    value: '• **요구 레벨**: 1\n' +
                           '• **드롭율**: 15%\n' +
                           '• **주요 드롭**: 슬라임 젤리, 토끼발, 버섯 포자',
                    inline: true
                },
                {
                    name: '🌈 무지개 초원 (Lv.18-35)',
                    value: '• **요구 레벨**: 18\n' +
                           '• **드롭율**: 20%\n' +
                           '• **주요 드롭**: 무지개 꽃잎, 크리스탈 뿔, 유니콘 갈기',
                    inline: true
                },
                {
                    name: '🌳 속삭이는 숲 (Lv.30-50)',
                    value: '• **요구 레벨**: 30\n' +
                           '• **드롭율**: 25%\n' +
                           '• **주요 드롭**: 올빼미 깃털, 나무정령 정수, 현자곰 꿀',
                    inline: true
                },
                {
                    name: '💎 반짝 크리스탈 동굴 (Lv.45-70)',
                    value: '• **요구 레벨**: 45\n' +
                           '• **드롭율**: 30%\n' +
                           '• **주요 드롭**: 크리스탈 조각, 다이아 가루, 다이아몬드 왕관',
                    inline: true
                }
            );

        // 6. 계급 시스템 (1부)
        const rankEmbed1 = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('🏆 계급 시스템 (1부)')
            .setDescription('강화를 통해 계급을 올려 김헌터 신이 되어보세요!')
            .addFields(
                {
                    name: '📋 계급 목록 (0-15계급)',
                    value: '`0계급` 무계급\n' +
                           '`1계급` 신입 헌터 (1,000G)\n' +
                           '`2계급` 견습 헌터 (2,000G)\n' +
                           '`3계급` 초급 헌터 (5,000G)\n' +
                           '`4계급` 중급 헌터 (8,000G)\n' +
                           '`5계급` 상급 헌터 (10,000G)\n' +
                           '`6계급` 숙련 헌터 (15,000G)\n' +
                           '`7계급` 전문 헌터 (20,000G)\n' +
                           '`8계급` 엘리트 헌터 (30,000G)\n' +
                           '`9계급` 베테랑 헌터 (50,000G)\n' +
                           '`10계급` 마스터 헌터 (80,000G)\n' +
                           '`11계급` 그랜드마스터 (120,000G)\n' +
                           '`12계급` 챔피언 헌터 (180,000G)\n' +
                           '`13계급` 히어로 헌터 (250,000G)\n' +
                           '`14계급` 레전드 헌터 (350,000G)\n' +
                           '`15계급` 신화 헌터 (500,000G)',
                    inline: false
                }
            );

        // 7. 계급 시스템 (2부)
        const rankEmbed2 = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('🏆 계급 시스템 (2부)')
            .addFields(
                {
                    name: '📋 계급 목록 (16-30계급)',
                    value: '`16계급` 초월 헌터 (700,000G)\n' +
                           '`17계급` 불멸 헌터 (1,000,000G)\n' +
                           '`18계급` 천상 헌터 (1,500,000G)\n' +
                           '`19계급` 신성 헌터 (2,000,000G)\n' +
                           '`20계급` 우주 헌터 (3,000,000G)\n' +
                           '`21계급` 차원 헌터 (4,500,000G)\n' +
                           '`22계급` 시공 헌터 (6,000,000G)\n' +
                           '`23계급` 무한 헌터 (8,000,000G)\n' +
                           '`24계급` 창조 헌터 (10,000,000G)\n' +
                           '`25계급` 파멸 헌터 (15,000,000G)\n' +
                           '`26계급` 심판 헌터 (20,000,000G)\n' +
                           '`27계급` 운명 헌터 (30,000,000G)\n' +
                           '`28계급` 영원 헌터 (50,000,000G)\n' +
                           '`29계급` 절대 헌터 (80,000,000G)\n' +
                           '`30계급` **김헌터 신** (100,000,000G)',
                    inline: false
                }
            );

        // 8. 승급 확률표
        const upgradeEmbed = new EmbedBuilder()
            .setColor('#e67e22')
            .setTitle('📊 승급 확률표')
            .setDescription('계급이 높아질수록 성공률은 낮아지고 파괴 확률이 생깁니다!')
            .addFields(
                {
                    name: '✅ 1-14계급',
                    value: '• 성공률: 95% → 35%\n' +
                           '• 실패률: 5% → 65%\n' +
                           '• **파괴 없음**',
                    inline: true
                },
                {
                    name: '⚠️ 15-20계급',
                    value: '• 성공률: 30% → 15%\n' +
                           '• 실패률: 67.9% → 76.5%\n' +
                           '• 파괴율: 2.1% → 8.5%',
                    inline: true
                },
                {
                    name: '☠️ 21-30계급',
                    value: '• 성공률: 30% → 1%\n' +
                           '• 실패률: 59.5% → 79.2%\n' +
                           '• 파괴율: 10.5% → 19.8%',
                    inline: true
                }
            )
            .setFooter({ text: '💡 팁: 높은 계급에서는 보호 주문서 사용을 권장합니다!' });

        // 9. 미니게임
        const minigameEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🎯 미니게임')
            .setDescription('`/게임` 명령어로 다양한 미니게임을 즐겨보세요!')
            .addFields(
                {
                    name: '🎮 /게임 메뉴',
                    value: '`/게임` 명령어를 입력하면 다음 게임들을 선택할 수 있습니다:\n\n' +
                           '• **👾 몬스터 배틀** - 몬스터와 전투하며 베팅\n' +
                           '• **🍄 독버섯 게임** - 운빨로 버섯을 선택\n' +
                           '• **🎰 슬롯머신** - 3개의 릴을 돌려 대박 도전\n' +
                           '• **✊ 가위바위보** - 전략적 선택 게임\n' +
                           '• **🔤 워드게임** - 끝말잇기와 초성게임\n' +
                           '• **⭕ 틱택토** - AI와 대결하는 3목 게임\n' +
                           '• **🎮 LOL 내전** - 실제 LOL 게임으로 베팅',
                    inline: false
                },
                {
                    name: '🎫 미니게임 티켓',
                    value: '• 게임 참가 시 1장 소모\n' +
                           '• 60분마다 1장 재생성 (최대 10장)\n' +
                           '• 모든 미니게임 공통 사용',
                    inline: false
                }
            );

        // 10. PVP 시스템
        const pvpEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('⚔️ PVP 시스템')
            .setDescription('다른 유저와 실시간 대전을 펼쳐보세요!')
            .addFields(
                {
                    name: '🎮 결투장',
                    value: '• `/결투` - 다른 유저와 1:1 대전\n' +
                           '• 레이팅 시스템으로 실력 측정\n' +
                           '• 티어별 보상 지급',
                    inline: false
                },
                {
                    name: '🏆 티어 시스템',
                    value: '`🥉 브론즈` → `🥈 실버` → `🥇 골드` → `💎 플래티넘` → `💠 다이아몬드` → `👑 마스터`',
                    inline: false
                },
                {
                    name: '🎫 PVP 티켓',
                    value: '• 결투 참가 시 1장 소모\n' +
                           '• 30분마다 1장 재생성 (최대 20장)\n' +
                           '• `/내티켓`으로 확인 가능',
                    inline: false
                }
            );

        // 11. 특수 콘텐츠
        const specialEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🌟 특수 콘텐츠')
            .addFields(
                {
                    name: '🏰 던전',
                    value: '• 다양한 난이도의 던전 탐험\n' +
                           '• 특별한 보상과 아이템 획득\n' +
                           '• 레벨별 입장 제한\n' +
                           '• 던전 티켓 필요 (30분마다 재생성)',
                    inline: true
                },
                {
                    name: '🐉 보스 레이드',
                    value: '• 3명이 협력하여 보스 도전\n' +
                           '• 주기적으로 등장하는 월드 보스\n' +
                           '• 기여도에 따른 보상',
                    inline: true
                },
                {
                    name: '🏺 유물 탐사',
                    value: '• 고대 유물을 발굴\n' +
                           '• 희귀 유물로 대박 노리기\n' +
                           '• 곡괭이 강화 시스템',
                    inline: true
                },
                {
                    name: '🎣 낚시',
                    value: '• 평화로운 낚시 생활\n' +
                           '• 다양한 물고기와 보물 획득\n' +
                           '• 낚시 레벨에 따라 더 좋은 물고기\n' +
                           '• 상인 등장 시 높은 가격에 판매',
                    inline: true
                },
                {
                    name: '💰 주식',
                    value: '• 가상 회사 주식 거래\n' +
                           '• 실시간 시세 변동\n' +
                           '• 배당금 지급',
                    inline: true
                },
                {
                    name: '🏋️ 운동',
                    value: '• 매일 운동으로 스탯 강화\n' +
                           '• 운동 레벨 상승\n' +
                           '• 피로도 관리 필요',
                    inline: true
                }
            );

        // 12. 일일 콘텐츠
        const dailyEmbed = new EmbedBuilder()
            .setColor('#1abc9c')
            .setTitle('📅 일일 콘텐츠')
            .addFields(
                {
                    name: '✅ 출석체크',
                    value: '• 매일 골드 보상\n' +
                           '• 연속 출석 보너스\n' +
                           '• 주간 개근 추가 보상',
                    inline: true
                },
                {
                    name: '🎯 일일/주간 미션',
                    value: '• 매일 갱신되는 미션\n' +
                           '• 완료 시 보상 지급\n' +
                           '• 주간 미션도 확인',
                    inline: true
                },
                {
                    name: '💼 일일 제한',
                    value: '• 일하기: 10회\n' +
                           '• 퀘스트: 5회\n' +
                           '• PVP: 20회\n' +
                           '• 던전: 3회',
                    inline: true
                }
            );

        // 13. 주요 명령어
        const commandEmbed = new EmbedBuilder()
            .setColor('#5f27cd')
            .setTitle('📝 주요 명령어')
            .addFields(
                {
                    name: '🎮 기본 명령어',
                    value: '`/회원가입` `/게임` `/내정보` `/인벤토리` `/상점` `/강화`',
                    inline: false
                },
                {
                    name: '⚔️ 전투 명령어',
                    value: '`/결투` `/보스레이드` `/던전`',
                    inline: false
                },
                {
                    name: '🎯 미니게임 명령어',
                    value: '`/게임` `/틱택토` `/lol내전` `/출석체크` `/운동`',
                    inline: false
                },
                {
                    name: '💰 경제 명령어',
                    value: '`/송금` `/주식` `/유물탐사` `/낚시`',
                    inline: false
                },
                {
                    name: '📊 정보 명령어',
                    value: '`/랭킹` `/내티켓` `/강화랭킹` `/결투정보` `/내전투력`',
                    inline: false
                }
            )
            .setFooter({ text: '더 많은 명령어는 /도움말 로 확인하세요!' });

        // 14. 팁과 조언
        const tipsEmbed = new EmbedBuilder()
            .setColor('#00d2d3')
            .setTitle('💡 초보자 팁')
            .addFields(
                {
                    name: '🌟 효율적인 성장법',
                    value: '1. 매일 출석체크와 운동을 빠뜨리지 마세요\n' +
                           '2. 사냥 쿨타임(10분)마다 꾸준히 사냥하세요\n' +
                           '3. 강화는 신중하게, 10강 이상은 보호 주문서 사용\n' +
                           '4. 미니게임으로 추가 골드 획득\n' +
                           '5. 일일/주간 미션 완료하기\n' +
                           '6. 보스 레이드는 3명이 모여야 시작 가능',
                    inline: false
                },
                {
                    name: '⚠️ 주의사항',
                    value: '• 10강 이상 강화 실패 시 장비가 파괴될 수 있습니다\n' +
                           '• 15계급 이상 승급 실패 시 계급이 파괴될 수 있습니다\n' +
                           '• PVP에서 패배해도 아이템을 잃지 않습니다\n' +
                           '• 티켓은 최대치까지만 누적됩니다\n' +
                           '• 사냥터별 드롭 아이템이 다릅니다\n' +
                           '• 인벤토리 공간은 50칸입니다',
                    inline: false
                }
            );

        // 메시지를 나누어서 전송 (Discord는 한 메시지에 최대 10개의 embed만 허용)
        await channel.send({ 
            embeds: [
                introEmbed,
                startEmbed,
                basicInfoEmbed,
                statEmbed,
                huntingEmbed,
                rankEmbed1,
                rankEmbed2,
                upgradeEmbed,
                minigameEmbed,
                pvpEmbed
            ] 
        });

        await channel.send({ 
            embeds: [
                specialEmbed,
                dailyEmbed,
                commandEmbed,
                tipsEmbed
            ] 
        });
        
        console.log('완전한 서버 가이드가 성공적으로 전송되었습니다!');
        
    } catch (error) {
        console.error('가이드 전송 중 오류 발생:', error);
    } finally {
        client.destroy();
        process.exit(0);
    }
});

client.login(process.env.BOT_TOKEN);