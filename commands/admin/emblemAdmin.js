const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 관리자 ID 목록
const ADMIN_IDS = ['424480594542592009', '295980447849250817', '532128778175619084'];

function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('엠블럼관리')
        .setDescription('관리자 전용 엠블럼 관리 명령어'),

    async execute(interaction) {
        console.log(`[EmblemAdmin] Execute called - Deferred: ${interaction.deferred}, Replied: ${interaction.replied}, User: ${interaction.user.id}`);
        
        // 관리자 권한 체크
        if (!isAdmin(interaction.user.id)) {
            console.log(`[EmblemAdmin] Non-admin user attempted access: ${interaction.user.id}`);
            // 이미 deferred 상태라면 editReply 사용
            if (interaction.deferred) {
                return await interaction.editReply({ 
                    content: '❌ 관리자만 사용할 수 있는 명령어입니다!'
                });
            } else if (!interaction.replied) {
                return await interaction.reply({ 
                    content: '❌ 관리자만 사용할 수 있는 명령어입니다!', 
                    flags: 64 
                });
            }
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 엠블럼 관리')
            .setDescription('엠블럼 관련 관리 기능을 선택하세요.')
            .addFields(
                { name: '📊 기능 목록', value: '• 엠블럼 지급\n• 엠블럼 레벨 설정\n• 엠블럼 초기화', inline: false }
            )
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_emblem_give')
                    .setLabel('🎁 엠블럼 지급')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_emblem_set_level')
                    .setLabel('📊 레벨 설정')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_emblem_reset')
                    .setLabel('🔄 엠블럼 초기화')
                    .setStyle(ButtonStyle.Danger)
            );

        try {
            console.log(`[EmblemAdmin] Attempting to send emblem menu - Deferred: ${interaction.deferred}, Replied: ${interaction.replied}`);
            
            // 이미 응답했는지 다시 한 번 확인
            if (interaction.replied) {
                console.log(`[EmblemAdmin] Interaction already replied, skipping`);
                return;
            }
            
            // interaction이 이미 deferred 상태라면 editReply 사용
            if (interaction.deferred) {
                await interaction.editReply({
                    embeds: [embed],
                    components: [buttons]
                });
                console.log(`[EmblemAdmin] Successfully edited reply`);
            } else {
                await interaction.reply({
                    embeds: [embed],
                    components: [buttons],
                    flags: 64
                });
                console.log(`[EmblemAdmin] Successfully replied`);
            }
        } catch (error) {
            console.error(`[EmblemAdmin] Error replying:`, error.code, error.message);
            throw error;
        }
    }
};