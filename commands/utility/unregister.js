const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('탈퇴')
        .setDescription('계정을 영구적으로 삭제합니다. 모든 데이터가 삭제되며 복구할 수 없습니다.'),
    
    async execute(interaction) {
        // 유저 확인
        const user = await User.findOne({ discordId: interaction.user.id });
        
        if (!user) {
            return await interaction.reply({
                content: '❌ 등록된 계정이 없습니다.',
                flags: 64
            });
        }

        // 탈퇴 확인 메시지
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⚠️ 계정 탈퇴 경고')
            .setDescription(`**${user.nickname}**님, 정말로 탈퇴하시겠습니까?`)
            .addFields(
                { name: '📊 현재 정보', value: `레벨: ${user.level}\n골드: ${user.gold.toLocaleString()}G`, inline: true },
                { name: '⚠️ 삭제될 내용', value: '• 모든 캐릭터 정보\n• 인벤토리 및 장비\n• 전투 기록\n• 보유 재화', inline: true }
            )
            .addFields({
                name: '🚨 중요 경고',
                value: '**탈퇴 후에는 어떠한 방법으로도 데이터를 복구할 수 없습니다!**\n다시 시작하려면 처음부터 새로 가입해야 합니다.',
                inline: false
            })
            .setFooter({ text: '이 작업은 되돌릴 수 없습니다!' })
            .setTimestamp();

        // 확인 버튼
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('unregister_confirm')
                    .setLabel('예, 탈퇴합니다')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⚠️'),
                new ButtonBuilder()
                    .setCustomId('unregister_cancel')
                    .setLabel('아니오, 취소합니다')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );

        const response = await interaction.reply({
            embeds: [embed],
            components: [buttons],
            flags: 64,
            fetchReply: true
        });

        // 버튼 응답 대기 (30초)
        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.customId === 'unregister_confirm') {
                try {
                    // 유저 데이터 삭제
                    await User.deleteOne({ discordId: interaction.user.id });
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('✅ 탈퇴 완료')
                        .setDescription('계정이 성공적으로 삭제되었습니다.')
                        .addFields({
                            name: '안녕히 가세요',
                            value: '그동안 이용해주셔서 감사합니다.\n언제든 다시 `/회원가입`으로 새로 시작할 수 있습니다.'
                        })
                        .setTimestamp();

                    await i.update({
                        embeds: [successEmbed],
                        components: []
                    });

                    console.log(`[Unregister] User ${user.nickname} (${user.discordId}) has been deleted.`);
                    
                } catch (error) {
                    console.error('[Unregister] Error deleting user:', error);
                    await i.update({
                        content: '❌ 탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                        embeds: [],
                        components: []
                    });
                }
            } else if (i.customId === 'unregister_cancel') {
                const cancelEmbed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('✅ 탈퇴 취소')
                    .setDescription('탈퇴가 취소되었습니다. 계속 플레이하실 수 있습니다!')
                    .setTimestamp();

                await i.update({
                    embeds: [cancelEmbed],
                    components: []
                });
            }
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⏰ 시간 초과')
                    .setDescription('30초 동안 응답이 없어 탈퇴가 자동으로 취소되었습니다.')
                    .setTimestamp();

                await interaction.editReply({
                    embeds: [timeoutEmbed],
                    components: []
                });
            }
        });
    }
};