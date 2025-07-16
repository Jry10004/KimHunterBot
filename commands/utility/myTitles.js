const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

// 칭호 정보
const TITLE_INFO = {
    '댕댕봇 구출자': {
        description: '댕댕봇 구출 이벤트에서 가장 큰 기여를 한 영웅',
        effect: '없음',
        emoji: '🦸‍♂️',
        rarity: '전설'
    },
    '버그 사냥꾼': {
        description: '초기 버그 수정에 도움을 준 특별한 플레이어',
        effect: '골드 획득 +10%',
        emoji: '🔍',
        rarity: '영웅'
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('칭호')
        .setDescription('보유한 칭호를 확인합니다'),
    
    async execute(interaction) {
        try {
            // 먼저 defer 처리
            await interaction.deferReply();
        } catch (error) {
            if (error.code === 10062) {
                console.log('[MyTitles] Interaction expired');
                return;
            }
            console.error('[MyTitles] Defer error:', error);
            return;
        }

        const user = await User.findOne({ discordId: interaction.user.id });
        
        if (!user || !user.registered) {
            return await interaction.editReply({
                content: '❌ 먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.'
            });
        }

        const userTitles = user.titles || [];
        const equippedTitle = user.equippedTitle || null;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`🏅 ${user.nickname}님의 칭호 보유 현황`)
            .setDescription(userTitles.length > 0 
                ? `보유 칭호: **${userTitles.length}개**\n장착 중: ${equippedTitle ? `**${equippedTitle}**` : '없음'}`
                : '보유한 칭호가 없습니다.')
            .setTimestamp();

        if (userTitles.length > 0) {
            const titleFields = userTitles.map(title => {
                const info = TITLE_INFO[title] || { description: '설명 없음', effect: '효과 없음', emoji: '📜', rarity: '일반' };
                const equipped = title === equippedTitle ? ' ✅ **[장착중]**' : '';
                
                return {
                    name: `${info.emoji} ${title}${equipped}`,
                    value: `> **등급**: ${info.rarity}\n> **설명**: ${info.description}\n> **효과**: ${info.effect}`,
                    inline: false
                };
            });

            embed.addFields(titleFields);
        }

        embed.addFields({
            name: '📌 칭호 정보',
            value: '• 칭호는 특별한 업적 달성 시 획득\n• 일부 칭호는 특수 효과 제공\n• 한 번에 하나의 칭호만 장착 가능',
            inline: false
        });

        // 공개 임베드로 전송
        await interaction.editReply({
            embeds: [embed]
        });
    }
};