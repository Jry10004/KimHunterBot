const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const MissionHelper = require('../../utils/missionHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('돈지급')
        .setDescription('유저에게 골드를 지급합니다 (관리자 전용)')
        .addUserOption(option =>
            option.setName('유저')
                .setDescription('골드를 지급할 유저')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('금액')
                .setDescription('지급할 골드 금액')
                .setRequired(true)
                .setMinValue(1)),
    
    async execute(interaction) {
        console.log('[GiveMoney v2] Command executed by:', interaction.user.id, interaction.user.username);
        console.log('[GiveMoney v2] Interaction state - Deferred:', interaction.deferred, 'Replied:', interaction.replied);

        // 관리자 권한 확인
        const adminIds = ['424480594542592009', '295980447849250817', '532128778175619084'];
        if (!adminIds.includes(interaction.user.id)) {
            // defer 상태 확인
            if (interaction.deferred) {
                return await interaction.editReply({
                    content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!'
                });
            } else {
                return await interaction.reply({
                    content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!',
                    flags: 64
                });
            }
        }

        const targetUser = interaction.options.getUser('유저');
        const amount = interaction.options.getInteger('금액');

        // 타겟 유저 데이터 조회
        const userData = await User.findOne({ discordId: targetUser.id });
        if (!userData || !userData.registered) {
            if (interaction.deferred) {
                return await interaction.editReply({
                    content: '❌ 해당 유저는 게임에 등록되지 않았습니다!'
                });
            } else {
                return await interaction.reply({
                    content: '❌ 해당 유저는 게임에 등록되지 않았습니다!',
                    flags: 64
                });
            }
        }

        // 골드 지급
        const previousGold = userData.gold;
        userData.gold += amount;
        await userData.save();
        
        // 골드 획득 미션 업데이트
        await MissionHelper.updateGoldEarned(targetUser.id, amount);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💰 골드 지급 완료!')
            .setDescription(`**${targetUser.username}**님에게 **${amount.toLocaleString()}G**가 지급되었습니다!`)
            .addFields(
                { name: '이전 골드', value: `${previousGold.toLocaleString()}G`, inline: true },
                { name: '지급 금액', value: `+${amount.toLocaleString()}G`, inline: true },
                { name: '현재 골드', value: `${userData.gold.toLocaleString()}G`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `관리자: ${interaction.user.username}` });

        // defer 상태 확인
        if (interaction.deferred) {
            await interaction.editReply({
                embeds: [embed]
            });
        } else {
            await interaction.reply({
                embeds: [embed],
                flags: 64
            });
        }

        // 로그
        console.log(`[골드 지급] ${targetUser.username}(${targetUser.id})에게 ${amount}G 지급 - 관리자: ${interaction.user.username}`);
    }
};