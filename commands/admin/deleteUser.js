const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('사용자삭제')
        .setDescription('특정 이메일 패턴을 가진 사용자를 삭제합니다 (관리자 전용)')
        .addStringOption(option =>
            option.setName('이메일패턴')
                .setDescription('삭제할 이메일 패턴 (예: rla00823)')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        // 관리자 권한 확인
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', 
                flags: 64 
            });
        }

        const emailPattern = interaction.options.getString('이메일패턴');
        
        try {
            await interaction.deferReply({ flags: 64 });
        } catch (error) {
            if (error.code === 10062) {
                console.log('[DeleteUser] Interaction expired');
                return;
            }
            console.error('[DeleteUser] Defer error:', error);
            return;
        }

        try {
            // 패턴과 일치하는 사용자 찾기
            const users = await User.find({
                email: { $regex: emailPattern, $options: 'i' }
            });

            if (users.length === 0) {
                return await interaction.editReply({
                    content: `❌ "${emailPattern}"이(가) 포함된 이메일을 가진 사용자를 찾을 수 없습니다.`
                });
            }

            // 사용자 정보 표시
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🗑️ 사용자 삭제 확인')
                .setDescription(`"${emailPattern}"이(가) 포함된 이메일을 가진 ${users.length}명의 사용자를 찾았습니다.`)
                .setTimestamp();

            const userList = users.slice(0, 10).map((user, index) => {
                return `**${index + 1}.** ${user.nickname || 'N/A'} (Lv.${user.level})\n` +
                       `   📧 ${user.email || 'N/A'}\n` +
                       `   💰 ${user.gold.toLocaleString()}G | ID: ${user.discordId}`;
            }).join('\n\n');

            embed.addFields({
                name: '👥 삭제될 사용자',
                value: userList || '없음'
            });

            if (users.length > 10) {
                embed.setFooter({ text: `외 ${users.length - 10}명...` });
            }

            // 확인 버튼
            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`delete_users_confirm_${emailPattern}`)
                        .setLabel('✅ 삭제 확인')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('delete_users_cancel')
                        .setLabel('❌ 취소')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.editReply({
                embeds: [embed],
                components: [confirmRow]
            });

            // 버튼 응답 대기
            const filter = i => i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ 
                filter, 
                time: 60000,  // 60초로 연장
                max: 1 
            });

            collector.on('collect', async i => {
                if (i.customId === 'delete_users_cancel') {
                    await i.update({
                        content: '❌ 사용자 삭제가 취소되었습니다.',
                        embeds: [],
                        components: []
                    });
                } else if (i.customId.startsWith('delete_users_confirm_')) {
                    await i.deferUpdate();

                    // 사용자 삭제 실행
                    let deletedCount = 0;
                    const deleteResults = [];

                    for (const user of users) {
                        try {
                            await User.deleteOne({ _id: user._id });
                            deletedCount++;
                            deleteResults.push(`✅ ${user.email} - 삭제 완료`);
                        } catch (error) {
                            deleteResults.push(`❌ ${user.email} - 삭제 실패: ${error.message}`);
                        }
                    }

                    // 결과 표시
                    const resultEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('✅ 사용자 삭제 완료')
                        .setDescription(`총 ${deletedCount}/${users.length}명의 사용자가 삭제되었습니다.`)
                        .setTimestamp();

                    if (deleteResults.length <= 20) {
                        resultEmbed.addFields({
                            name: '📋 삭제 결과',
                            value: deleteResults.join('\n').substring(0, 1000) || '없음'
                        });
                    }

                    await i.editReply({
                        embeds: [resultEmbed],
                        components: []
                    });
                }
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    try {
                        await interaction.editReply({
                            content: '⏰ 시간이 초과되어 사용자 삭제가 취소되었습니다.',
                            embeds: [],
                            components: []
                        });
                    } catch (error) {
                        console.error('[DeleteUser] Timeout message error:', error);
                    }
                }
            });

        } catch (error) {
            console.error('[사용자삭제] 오류:', error);
            await interaction.editReply({
                content: '❌ 사용자 삭제 중 오류가 발생했습니다.'
            });
        }
    }
};