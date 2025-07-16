const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('강화석지급')
        .setDescription('유저에게 엠블럼 강화석을 지급합니다 (관리자 전용)')
        .addUserOption(option =>
            option.setName('유저')
                .setDescription('강화석을 지급할 유저')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('수량')
                .setDescription('지급할 강화석 수량')
                .setRequired(true)
                .setMinValue(1)),
    
    async execute(interaction) {
        console.log('[GiveEmblemStone] Command executed by:', interaction.user.id, interaction.user.username);

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
        const amount = interaction.options.getInteger('수량');

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

        // 강화석 지급
        if (!userData.items) userData.items = {};
        const previousStones = userData.items.emblemEnhanceStone || 0;
        userData.items.emblemEnhanceStone = previousStones + amount;
        await userData.save();

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('💎 엠블럼 강화석 지급 완료!')
            .setDescription(`**${targetUser.username}**님에게 **${amount}개**의 강화석이 지급되었습니다!`)
            .addFields(
                { name: '이전 강화석', value: `${previousStones}개`, inline: true },
                { name: '지급 수량', value: `+${amount}개`, inline: true },
                { name: '현재 강화석', value: `${userData.items.emblemEnhanceStone}개`, inline: true }
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
        console.log(`[강화석 지급] ${targetUser.username}(${targetUser.id})에게 ${amount}개 지급 - 관리자: ${interaction.user.username}`);
    }
};