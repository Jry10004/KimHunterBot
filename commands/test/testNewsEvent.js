const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const newsSystem = require('../systems/newsSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('뉴스이벤트테스트')
        .setDescription('뉴스 이벤트를 수동으로 발생시킵니다 (관리자 전용)')
        .addStringOption(option =>
            option.setName('이벤트')
                .setDescription('테스트할 뉴스 이벤트')
                .setRequired(true)
                .addChoices(
                    { name: '강화 성공', value: 'enhancement_success' },
                    { name: '강화 파괴', value: 'enhancement_destroy' },
                    { name: '전설 아이템 드롭', value: 'legendary_drop' },
                    { name: '희귀 재료 획득', value: 'rare_material' },
                    { name: '보스 최초 처치', value: 'boss_first_kill' },
                    { name: '보스 단독 처치', value: 'boss_solo_kill' },
                    { name: '대규모 거래', value: 'huge_transaction' },
                    { name: '시장 조작', value: 'market_manipulation' },
                    { name: 'PVP 연승', value: 'pvp_streak' },
                    { name: 'PVP 격파', value: 'pvp_upset' },
                    { name: '길드 레벨업', value: 'guild_level_up' },
                    { name: '신기록', value: 'speed_record' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        const eventType = interaction.options.getString('이벤트');
        
        // 뉴스 시스템 상태 확인
        console.log('뉴스 시스템 상태:', {
            initialized: newsSystem.isInitialized,
            channelCount: newsSystem.newsChannels.size,
            channels: Array.from(newsSystem.newsChannels)
        });
        
        // 테스트 데이터 생성
        const testData = {
            enhancement_success: {
                player: interaction.user.username,
                item: '전설의 검',
                level: 20
            },
            enhancement_destroy: {
                player: interaction.user.username,
                item: '신화의 갑옷',
                level: 25
            },
            legendary_drop: {
                player: interaction.user.username,
                location: '용의 둥지',
                item: '용왕의 비늘'
            },
            rare_material: {
                player: interaction.user.username,
                item: '별빛 정수',
                amount: 15
            },
            boss_first_kill: {
                player: interaction.user.username,
                boss: '암흑의 군주'
            },
            boss_solo_kill: {
                player: interaction.user.username,
                boss: '불사조'
            },
            huge_transaction: {
                player: interaction.user.username,
                amount: '50,000,000'
            },
            market_manipulation: {
                player: interaction.user.username,
                item: '마나 포션',
                change: 75
            },
            pvp_streak: {
                player: interaction.user.username,
                streak: 15
            },
            pvp_upset: {
                winner: interaction.user.username,
                rank: 1,
                loser: '최강자'
            },
            guild_level_up: {
                guild: '테스트길드',
                level: 50
            },
            speed_record: {
                player: interaction.user.username,
                dungeon: '시련의 탑',
                time: '5분 32초'
            }
        };
        
        // 뉴스 생성
        const news = newsSystem.addNews(eventType, testData[eventType]);
        
        if (news) {
            await interaction.editReply({
                content: `✅ 뉴스 이벤트가 생성되었습니다!\n\n` +
                         `**유형**: ${eventType}\n` +
                         `**내용**: ${news.content}\n` +
                         `**속보 여부**: ${news.isBreaking ? '✅ 속보' : '❌ 일반 뉴스'}\n` +
                         `**카테고리**: ${news.category}\n\n` +
                         `뉴스 채널 수: ${newsSystem.newsChannels.size}개`
            });
            
            if (newsSystem.newsChannels.size === 0) {
                await interaction.followUp({
                    content: '⚠️ 뉴스 채널이 설정되지 않아 실제로 발송되지 않았습니다.\n' +
                            '`/뉴스채널설정` 명령어로 채널을 설정해주세요.',
                    flags: 64
                });
            }
        } else {
            await interaction.editReply({
                content: '❌ 뉴스 생성에 실패했습니다.'
            });
        }
    }
};