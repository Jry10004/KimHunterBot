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
                }
            )
            //.setImage('https://i.imgur.com/YourIntroImage.png')
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

        // 3. 기본 시스템
        const basicSystemEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('⚔️ 기본 시스템')
            .addFields(
                {
                    name: '🗡️ 사냥',
                    value: '• 몬스터를 사냥하여 경험치와 골드 획득\n' +
                           '• 레벨이 오를수록 더 강한 사냥터 개방\n' +
                           '• 10분마다 사냥 가능',
                    inline: true
                },
                {
                    name: '📦 인벤토리',
                    value: '• 사냥으로 획득한 아이템 보관\n' +
                           '• 장비 장착 및 관리\n' +
                           '• 아이템 판매 가능',
                    inline: true
                },
                {
                    name: '⚒️ 강화',
                    value: '• 장비를 강화하여 능력치 상승\n' +
                           '• 강화 실패 시 파괴 위험\n' +
                           '• 보호 주문서로 안전 강화',
                    inline: true
                },
                {
                    name: '🏪 상점',
                    value: '• 장비, 포션, 강화 재료 구매\n' +
                           '• 매일 상품 갱신\n' +
                           '• 레벨별 상품 해금',
                    inline: true
                },
                {
                    name: '📊 스탯',
                    value: '• 레벨업 시 스탯 포인트 획득\n' +
                           '• 힘, 민첩, 지능, 체력 분배\n' +
                           '• 전투력에 직접 영향',
                    inline: true
                },
                {
                    name: '🎯 전투력',
                    value: '• 장비, 스탯, 강화도 종합\n' +
                           '• PVP 승률에 영향\n' +
                           '• 특정 콘텐츠 입장 조건',
                    inline: true
                }
            );

        // 4. PVP 시스템
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

        // 5. 미니게임
        const minigameEmbed = new EmbedBuilder()
            .setColor('#f39c12')
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

        // 6. 특수 콘텐츠
        const specialEmbed = new EmbedBuilder()
            .setColor('#e67e22')
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
                }
            );

        // 7. 일일 콘텐츠
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
                    name: '🏋️ 운동',
                    value: '• 매일 운동으로 스탯 강화\n' +
                           '• 운동 레벨 상승\n' +
                           '• 피로도 관리 필요',
                    inline: true
                },
                {
                    name: '🎯 일일 미션',
                    value: '• 매일 갱신되는 미션\n' +
                           '• 완료 시 보상 지급\n' +
                           '• 주간 미션도 확인',
                    inline: true
                }
            );

        // 8. 랭킹 시스템
        const rankingEmbed = new EmbedBuilder()
            .setColor('#fd79a8')
            .setTitle('🏆 랭킹 시스템')
            .setDescription('다양한 분야에서 최고가 되어보세요!')
            .addFields(
                {
                    name: '📊 랭킹 종류',
                    value: '• **레벨 랭킹** - 최고 레벨 도전\n' +
                           '• **전투력 랭킹** - 최강의 전투력\n' +
                           '• **강화 랭킹** - 최고 강화 아이템\n' +
                           '• **PVP 랭킹** - 결투장 최강자\n' +
                           '• **부자 랭킹** - 최고의 부자\n' +
                           '• **출석 랭킹** - 연속 출석왕\n' +
                           '• **운동 랭킹** - 운동 마니아\n' +
                           '• **유물 탐사 랭킹** - 최고의 탐사가',
                    inline: false
                }
            );

        // 9. 팁과 조언
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
                           '• PVP에서 패배해도 아이템을 잃지 않습니다\n' +
                           '• 티켓은 최대치까지만 누적됩니다\n' +
                           '• 사냥터별 드롭 아이템이 다릅니다\n' +
                           '• 인벤토리 공간은 50칸입니다',
                    inline: false
                }
            );

        // 10. 명령어 목록
        const commandEmbed = new EmbedBuilder()
            .setColor('#5f27cd')
            .setTitle('📝 주요 명령어')
            .addFields(
                {
                    name: '🎮 기본 명령어',
                    value: '`/회원가입` `/내정보` `/인벤토리` `/상점` `/사냥` `/강화`',
                    inline: false
                },
                {
                    name: '⚔️ 전투 명령어',
                    value: '`/결투` `/보스레이드` `/던전` `/댕댕봇구출`',
                    inline: false
                },
                {
                    name: '🎯 미니게임 명령어',
                    value: '`/게임` `/틱택토` `/lol내전`',
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

        // 메시지 전송
        await channel.send({ 
            embeds: [
                introEmbed, 
                startEmbed, 
                basicSystemEmbed, 
                pvpEmbed, 
                minigameEmbed, 
                specialEmbed, 
                dailyEmbed, 
                rankingEmbed, 
                tipsEmbed, 
                commandEmbed
            ] 
        });
        
        console.log('서버 가이드가 성공적으로 전송되었습니다!');
        
    } catch (error) {
        console.error('가이드 전송 중 오류 발생:', error);
    } finally {
        client.destroy();
        process.exit(0);
    }
});

client.login(process.env.BOT_TOKEN);