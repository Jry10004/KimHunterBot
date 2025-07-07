const { 
    isAdmin, 
    showAdminMenu, 
    showLevelModal, 
    showGoldModal, 
    showItemModal, 
    showAnnouncementModal, 
    showSystemStatus, 
    confirmUserReset, 
    showEmblemAdminMenu 
} = require('./adminSystem');

const {
    handleLevelModal,
    handleGoldModal,
    handleItemModal,
    handleAnnouncementModal,
    handleResetModal,
    showEmblemGiveModal,
    handleEmblemGiveModal
} = require('./adminModals');

const {
    showUserManageMenu,
    showEconomyMenu,
    showServerStats,
    showBackupMenu
} = require('./adminExtended');

// 관리자 인터랙션 핸들러
async function handleAdminInteraction(interaction) {
    const customId = interaction.customId;
    
    // 관리자 권한 체크
    if (!isAdmin(interaction.user.id)) {
        return await interaction.reply({ 
            content: '❌ 관리자만 접근할 수 있습니다!', 
            flags: 64 
        });
    }
    
    // 메인 메뉴
    if (customId === 'admin_panel') {
        return await showAdminMenu(interaction);
    }
    
    // 레벨/경험치 설정
    else if (customId === 'admin_user_level') {
        return await showLevelModal(interaction);
    }
    
    // 골드 지급
    else if (customId === 'admin_give_gold') {
        return await showGoldModal(interaction);
    }
    
    // 아이템 지급
    else if (customId === 'admin_give_item') {
        return await showItemModal(interaction);
    }
    
    // 공지 발송
    else if (customId === 'admin_announcement') {
        return await showAnnouncementModal(interaction);
    }
    
    // 시스템 상태
    else if (customId === 'admin_system_status') {
        return await showSystemStatus(interaction);
    }
    
    // 유저 초기화
    else if (customId === 'admin_reset_user') {
        return await confirmUserReset(interaction);
    }
    
    // 엠블럼 관리
    else if (customId === 'admin_emblem_menu') {
        return await showEmblemAdminMenu(interaction);
    }
    
    // 엠블럼 지급
    else if (customId === 'admin_emblem_give') {
        return await showEmblemGiveModal(interaction);
    }
    
    // 엠블럼 레벨 설정
    else if (customId === 'admin_emblem_set_level') {
        const modal = new ModalBuilder()
            .setCustomId('admin_emblem_level_modal')
            .setTitle('엠블럼 레벨 설정');

        const userIdInput = new TextInputBuilder()
            .setCustomId('target_user_id')
            .setLabel('유저 ID')
            .setPlaceholder('Discord 유저 ID를 입력하세요')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const levelInput = new TextInputBuilder()
            .setCustomId('emblem_level')
            .setLabel('엠블럼 레벨')
            .setPlaceholder('설정할 엠블럼 레벨')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(userIdInput),
            new ActionRowBuilder().addComponents(levelInput)
        );

        await interaction.showModal(modal);
    }
    
    // 엠블럼 초기화
    else if (customId === 'admin_emblem_reset') {
        const modal = new ModalBuilder()
            .setCustomId('admin_emblem_reset_modal')
            .setTitle('엠블럼 초기화');

        const userIdInput = new TextInputBuilder()
            .setCustomId('target_user_id')
            .setLabel('유저 ID')
            .setPlaceholder('초기화할 유저의 Discord ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(userIdInput)
        );

        await interaction.showModal(modal);
    }
    
    // 새로운 관리자 기능들
    else if (customId === 'admin_user_manage') {
        return await showUserManageMenu(interaction);
    }
    else if (customId === 'admin_economy') {
        return await showEconomyMenu(interaction);
    }
    else if (customId === 'admin_stats') {
        return await showServerStats(interaction);
    }
    else if (customId === 'admin_backup') {
        return await showBackupMenu(interaction);
    }
}

// 관리자 모달 핸들러
async function handleAdminModal(interaction) {
    const customId = interaction.customId;
    
    // 관리자 권한 체크
    if (!isAdmin(interaction.user.id)) {
        return await interaction.reply({ 
            content: '❌ 관리자만 사용할 수 있습니다!', 
            flags: 64 
        });
    }
    
    // 레벨/경험치 설정
    if (customId === 'admin_level_modal') {
        return await handleLevelModal(interaction);
    }
    
    // 골드 지급
    else if (customId === 'admin_gold_modal') {
        return await handleGoldModal(interaction);
    }
    
    // 아이템 지급
    else if (customId === 'admin_item_modal') {
        return await handleItemModal(interaction);
    }
    
    // 공지 발송
    else if (customId === 'admin_announcement_modal') {
        return await handleAnnouncementModal(interaction);
    }
    
    // 유저 초기화 확인
    else if (customId === 'admin_reset_confirm_modal') {
        return await handleResetModal(interaction);
    }
    
    // 엠블럼 지급
    else if (customId === 'admin_emblem_give_modal') {
        return await handleEmblemGiveModal(interaction);
    }
    
    // 엠블럼 레벨 설정
    else if (customId === 'admin_emblem_level_modal') {
        return await handleEmblemLevelModal(interaction);
    }
    
    // 엠블럼 초기화
    else if (customId === 'admin_emblem_reset_modal') {
        return await handleEmblemResetModal(interaction);
    }
}

// 엠블럼 레벨 설정 처리
async function handleEmblemLevelModal(interaction) {
    const User = require('../../models/User');
    const { EmbedBuilder } = require('discord.js');
    
    const targetUserId = interaction.fields.getTextInputValue('target_user_id');
    const emblemLevel = parseInt(interaction.fields.getTextInputValue('emblem_level'));
    
    const targetUser = await User.findOne({ discordId: targetUserId });
    if (!targetUser) {
        return await interaction.reply({ 
            content: '❌ 해당 유저를 찾을 수 없습니다!', 
            flags: 64 
        });
    }
    
    if (!targetUser.emblem) {
        return await interaction.reply({ 
            content: '❌ 해당 유저는 엠블럼을 보유하고 있지 않습니다!', 
            flags: 64 
        });
    }
    
    targetUser.emblem.level = emblemLevel;
    await targetUser.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ 엠블럼 레벨 설정 완료')
        .setDescription(`**${targetUser.username}**님의 엠블럼 레벨을 설정했습니다.`)
        .addFields(
            { name: '🏆 엠블럼', value: targetUser.emblem.name, inline: true },
            { name: '📊 레벨', value: `Lv.${emblemLevel}`, inline: true }
        )
        .setFooter({ text: `관리자: ${interaction.user.username}` })
        .setTimestamp();
    
    return await interaction.reply({
        embeds: [embed],
        flags: 64
    });
}

// 엠블럼 초기화 처리
async function handleEmblemResetModal(interaction) {
    const User = require('../../models/User');
    const { EmbedBuilder } = require('discord.js');
    
    const targetUserId = interaction.fields.getTextInputValue('target_user_id');
    
    const targetUser = await User.findOne({ discordId: targetUserId });
    if (!targetUser) {
        return await interaction.reply({ 
            content: '❌ 해당 유저를 찾을 수 없습니다!', 
            flags: 64 
        });
    }
    
    const previousEmblem = targetUser.emblem ? targetUser.emblem.name : '없음';
    targetUser.emblem = null;
    await targetUser.save();
    
    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🔄 엠블럼 초기화 완료')
        .setDescription(`**${targetUser.username}**님의 엠블럼이 초기화되었습니다.`)
        .addFields(
            { name: '이전 엠블럼', value: previousEmblem, inline: true }
        )
        .setFooter({ text: `관리자: ${interaction.user.username}` })
        .setTimestamp();
    
    return await interaction.reply({
        embeds: [embed],
        flags: 64
    });
}

// 필요한 모듈 import
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    handleAdminInteraction,
    handleAdminModal,
    isAdmin
};