const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
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
        effect: '골드 획득 +20%, 경험치 획득 +20%, 드롭률 +10%',
        emoji: '🔍',
        rarity: '영웅'
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('칭호장착')
        .setDescription('보유한 칭호를 장착합니다'),
    
    async execute(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        
        if (!user || !user.registered) {
            return await interaction.reply({
                content: '❌ 먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
                ephemeral: true
            });
        }

        const userTitles = user.titles || [];
        
        if (userTitles.length === 0) {
            return await interaction.reply({
                content: '❌ 장착할 수 있는 칭호가 없습니다.',
                ephemeral: true
            });
        }

        // 선택 메뉴 생성
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_title')
            .setPlaceholder('장착할 칭호를 선택하세요')
            .addOptions([
                {
                    label: '칭호 해제',
                    description: '현재 장착 중인 칭호를 해제합니다',
                    value: 'none',
                    emoji: '❌'
                },
                ...userTitles.map(title => {
                    const info = TITLE_INFO[title] || { 
                        description: '설명 없음', 
                        effect: '효과 없음', 
                        emoji: '📜', 
                        rarity: '일반' 
                    };
                    return {
                        label: title,
                        description: info.effect,
                        value: title,
                        emoji: info.emoji
                    };
                })
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏅 칭호 장착')
            .setDescription(`현재 장착 중: ${user.equippedTitle ? `**${user.equippedTitle}**` : '없음'}\n\n아래에서 장착할 칭호를 선택해주세요.`)
            .setFooter({ text: '칭호는 한 번에 하나만 장착할 수 있습니다.' })
            .setTimestamp();

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });

        // 선택 대기 (30초)
        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 30000
        });

        collector.on('collect', async i => {
            const selectedTitle = i.values[0];
            
            // 칭호 업데이트
            if (selectedTitle === 'none') {
                user.equippedTitle = null;
            } else {
                user.equippedTitle = selectedTitle;
            }
            
            await user.save();

            const resultEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ 칭호 장착 완료!')
                .setTimestamp();

            if (selectedTitle === 'none') {
                resultEmbed.setDescription('칭호가 해제되었습니다.');
            } else {
                const info = TITLE_INFO[selectedTitle] || { 
                    description: '설명 없음', 
                    effect: '효과 없음', 
                    emoji: '📜', 
                    rarity: '일반' 
                };
                resultEmbed.setDescription(`**${info.emoji} ${selectedTitle}** 칭호를 장착했습니다!`)
                    .addFields(
                        { name: '등급', value: info.rarity, inline: true },
                        { name: '효과', value: info.effect, inline: true }
                    );
            }

            await i.update({
                embeds: [resultEmbed],
                components: []
            });

            collector.stop();
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({
                    content: '⏱️ 시간이 초과되었습니다.',
                    embeds: [],
                    components: []
                }).catch(() => {});
            }
        });
    }
};