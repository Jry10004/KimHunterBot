const { showMaintenanceMenu, startMaintenance, endMaintenance, showDetailedStatus } = require('./maintenanceMenu');
const adminRewardSystem = require('./adminRewardSystem');
const adminRewardSelectSystem = require('./adminRewardSelectSystem');
const adminEquipmentSystem = require('./adminEquipmentSystem');
const adminBulkRewardSystem = require('./adminBulkRewardSystem');

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
    
    // 점검 관련 처리
    if (customId === 'admin_maintenance') {
        return await showMaintenanceMenu(interaction);
    }
    else if (customId === 'maintenance_start') {
        // 선택된 기능 가져오기
        const selectedFeature = interaction.message.components[0]?.components[0]?.data?.options?.find(opt => opt.default)?.value;
        if (!selectedFeature) {
            return await interaction.reply({ content: '❌ 점검할 기능을 선택해주세요!', ephemeral: true });
        }
        
        // 모달 표시
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
            .setCustomId(`maintenance_start_modal_${selectedFeature}`)
            .setTitle('점검 시작');
            
        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('점검 사유')
            .setPlaceholder('시스템 업데이트, 버그 수정 등')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);
            
        const timeInput = new TextInputBuilder()
            .setCustomId('time')
            .setLabel('예상 시간 (분)')
            .setPlaceholder('30')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);
            
        modal.addComponents(
            new ActionRowBuilder().addComponents(reasonInput),
            new ActionRowBuilder().addComponents(timeInput)
        );
        
        return await interaction.showModal(modal);
    }
    else if (customId === 'maintenance_end') {
        const selectedFeature = interaction.message.components[0]?.components[0]?.data?.options?.find(opt => opt.default)?.value;
        if (!selectedFeature) {
            return await interaction.reply({ content: '❌ 종료할 점검 기능을 선택해주세요!', ephemeral: true });
        }
        
        const embed = await endMaintenance(interaction, selectedFeature);
        if (!embed) {
            return await interaction.reply({ content: '❌ 선택한 기능은 점검 중이 아닙니다!', ephemeral: true });
        }
        
        await interaction.reply({ embeds: [embed] });
        return await showMaintenanceMenu(interaction);
    }
    else if (customId === 'maintenance_emergency') {
        const embed = await startMaintenance(interaction, 'game', '긴급 점검', null);
        await interaction.reply({ embeds: [embed] });
        return await showMaintenanceMenu(interaction);
    }
    else if (customId === 'maintenance_status') {
        const embed = await showDetailedStatus(interaction);
        return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    else if (customId === 'maintenance_feature_select') {
        // 선택된 기능 업데이트
        await interaction.deferUpdate();
        return;
    }
    
    // 메인 메뉴
    else if (customId === 'admin_panel') {
        return await showAdminMenu(interaction);
    }
    
    // 통합 보상 시스템 (선택식)
    else if (customId === 'admin_reward_menu') {
        return await adminRewardSelectSystem.showRewardMenu(interaction);
    }
    
    // 선택식 보상 시스템
    else if (customId === 'admin_reward_gold_select') {
        return await adminRewardSelectSystem.showGoldSelectMenu(interaction);
    }
    else if (customId === 'admin_reward_item_select') {
        return await adminRewardSelectSystem.showItemSelectMenu(interaction);
    }
    else if (customId === 'admin_reward_exp_select') {
        return await adminRewardSelectSystem.showExpSelectMenu(interaction);
    }
    else if (customId === 'admin_reward_ticket_select') {
        return await adminRewardSelectSystem.showTicketSelectMenu(interaction);
    }
    else if (customId === 'admin_ticket_confirm') {
        return await adminRewardSelectSystem.processReward(interaction, 'ticket');
    }
    else if (customId === 'admin_gold_confirm') {
        return await adminRewardSelectSystem.processReward(interaction, 'gold');
    }
    else if (customId === 'admin_item_confirm') {
        return await adminRewardSelectSystem.processReward(interaction, 'item');
    }
    else if (customId === 'admin_exp_confirm') {
        return await adminRewardSelectSystem.processReward(interaction, 'exp');
    }
    else if (customId === 'admin_item_back') {
        return await adminRewardSelectSystem.showItemSelectMenu(interaction);
    }
    
    // 선택 메뉴 핸들러
    else if (customId.includes('_select') && customId.includes('admin')) {
        return await adminRewardSelectSystem.handleSelectMenu(interaction);
    }
    
    // 3단어 장비 생성 시스템
    else if (customId === 'admin_equip_menu') {
        return await adminEquipmentSystem.showEquipmentMenu(interaction);
    }
    else if (customId === 'admin_equip_create') {
        return await adminEquipmentSystem.showCreateStep1(interaction);
    }
    else if (customId === 'admin_equip_next_step') {
        return await adminEquipmentSystem.showCreateStep2(interaction);
    }
    else if (customId === 'admin_equip_stats_step') {
        return await adminEquipmentSystem.showCreateStep3(interaction);
    }
    else if (customId === 'admin_equip_confirm') {
        return await adminEquipmentSystem.createAndGiveEquipment(interaction);
    }
    else if (customId === 'admin_equip_word_step') {
        return await adminEquipmentSystem.showCreateStep2(interaction);
    }
    else if (customId.includes('admin_equip_') && customId.includes('_select')) {
        return await adminEquipmentSystem.handleSelectMenu(interaction);
    }
    else if (customId === 'admin_reward_gold') {
        return await adminRewardSystem.showGoldModal(interaction);
    }
    else if (customId === 'admin_reward_exp') {
        return await adminRewardSystem.showExpModal(interaction);
    }
    else if (customId === 'admin_reward_item') {
        return await adminRewardSystem.showItemModal(interaction);
    }
    else if (customId === 'admin_reward_stats') {
        return await adminRewardSystem.showStatsModal(interaction);
    }
    else if (customId === 'admin_reward_ticket') {
        return await adminRewardSystem.showTicketModal(interaction);
    }
    else if (customId === 'admin_reward_custom_item') {
        return await adminRewardSystem.showCustomItemModal(interaction);
    }
    else if (customId === 'admin_reward_bulk') {
        return await adminRewardSystem.showBulkRewardModal(interaction);
    }
    
    // 전체 지급 시스템
    else if (customId === 'admin_bulk_menu') {
        return await adminBulkRewardSystem.showBulkRewardMenu(interaction);
    }
    else if (customId === 'admin_bulk_all') {
        return await adminBulkRewardSystem.setupAllUsersReward(interaction);
    }
    else if (customId === 'admin_bulk_level') {
        return await adminBulkRewardSystem.setupLevelRangeReward(interaction);
    }
    else if (customId === 'admin_bulk_active') {
        return await adminBulkRewardSystem.setupActiveUsersReward(interaction);
    }
    else if (customId === 'admin_bulk_confirm') {
        return await adminBulkRewardSystem.processBulkReward(interaction);
    }
    else if (customId.startsWith('admin_bulk_') && customId.includes('_select')) {
        return await adminBulkRewardSystem.handleSelectMenu(interaction);
    }
    else if (customId.startsWith('admin_bulk_') && (customId.includes('_amount') || customId.includes('_type'))) {
        return await adminBulkRewardSystem.handleSelectMenu(interaction);
    }
    
    // 레벨/경험치 설정
    else if (customId === 'admin_user_level') {
        return await showLevelModal(interaction);
    }
    
    // 골드 지급
    else if (customId === 'admin_give_gold') {
        return await showGoldModal(interaction);
    }
    
    // 아이템 지급 (선택 메뉴 방식)
    else if (customId === 'admin_give_item') {
        return await adminRewardSelectSystem.showMainMenu(interaction);
    }
    
    // 장비 생성 시스템
    else if (customId === 'admin_equipment_system') {
        return await adminEquipmentSystem.showEquipmentMenu(interaction);
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
    
    // 선택 메뉴 핸들러 (모달에서도 처리)
    else if (customId.includes('_select') && customId.includes('admin')) {
        return await adminRewardSelectSystem.handleSelectMenu(interaction);
    }
    
    // 점검 시작 모달
    else if (customId.startsWith('maintenance_start_modal_')) {
        const feature = customId.replace('maintenance_start_modal_', '');
        const reason = interaction.fields.getTextInputValue('reason') || '시스템 점검';
        const time = interaction.fields.getTextInputValue('time');
        const estimatedMinutes = time ? parseInt(time) : null;
        
        const embed = await startMaintenance(interaction, feature, reason, estimatedMinutes);
        await interaction.reply({ embeds: [embed] });
        return await showMaintenanceMenu(interaction);
    }
    
    // 통합 보상 시스템 모달
    else if (customId === 'admin_gold_modal') {
        const data = {
            targetUser: interaction.fields.getTextInputValue('target_user'),
            amount: interaction.fields.getTextInputValue('gold_amount'),
            reason: interaction.fields.getTextInputValue('reason')
        };
        return await adminRewardSystem.processReward(interaction, 'gold', data);
    }
    else if (customId === 'admin_exp_modal') {
        const data = {
            targetUser: interaction.fields.getTextInputValue('target_user'),
            type: interaction.fields.getTextInputValue('exp_type'),
            amount: interaction.fields.getTextInputValue('exp_amount'),
            reason: interaction.fields.getTextInputValue('reason')
        };
        return await adminRewardSystem.processReward(interaction, 'exp', data);
    }
    else if (customId === 'admin_stats_modal') {
        const data = {
            targetUser: interaction.fields.getTextInputValue('target_user'),
            type: interaction.fields.getTextInputValue('stat_type'),
            amount: interaction.fields.getTextInputValue('stat_amount'),
            reason: interaction.fields.getTextInputValue('reason')
        };
        return await adminRewardSystem.processReward(interaction, 'stats', data);
    }
    else if (customId === 'admin_ticket_modal') {
        const data = {
            targetUser: interaction.fields.getTextInputValue('target_user'),
            type: interaction.fields.getTextInputValue('ticket_type'),
            amount: interaction.fields.getTextInputValue('ticket_amount')
        };
        return await adminRewardSystem.processReward(interaction, 'ticket', data);
    }
    else if (customId === 'admin_custom_item_modal') {
        const data = {
            targetUser: interaction.fields.getTextInputValue('target_user'),
            name: interaction.fields.getTextInputValue('item_name'),
            type: interaction.fields.getTextInputValue('item_type'),
            stats: interaction.fields.getTextInputValue('item_stats'),
            description: interaction.fields.getTextInputValue('item_desc')
        };
        return await adminRewardSystem.processReward(interaction, 'custom_item', data);
    }
    
    // 전체 지급 모달 처리
    else if (customId === 'admin_bulk_level_modal') {
        const minLevel = parseInt(interaction.fields.getTextInputValue('min_level'));
        const maxLevel = parseInt(interaction.fields.getTextInputValue('max_level'));
        
        const users = await User.countDocuments({ 
            registered: true,
            level: { $gte: minLevel, $lte: maxLevel }
        });
        
        const bulk = adminBulkRewardSystem.pendingBulkRewards.get(interaction.user.id) || {};
        bulk.type = 'level';
        bulk.minLevel = minLevel;
        bulk.maxLevel = maxLevel;
        bulk.targetCount = users;
        bulk.rewardType = null;
        bulk.rewardData = {};
        
        adminBulkRewardSystem.pendingBulkRewards.set(interaction.user.id, bulk);
        
        const embed = new EmbedBuilder()
            .setColor('#00bfff')
            .setTitle('📊 레벨 범위 보상 지급')
            .setDescription(`레벨 **${minLevel}~${maxLevel}** 범위의 **${users}명**에게 보상을 지급합니다.`)
            .addFields(
                { name: '대상 인원', value: `${users}명`, inline: true },
                { name: '레벨 범위', value: `Lv.${minLevel} ~ Lv.${maxLevel}`, inline: true },
                { name: '선택된 보상', value: '없음', inline: true }
            );
            
        const rewardTypeSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_bulk_reward_type')
            .setPlaceholder('🎁 지급할 보상 종류를 선택하세요')
            .addOptions([
                { label: '골드', value: 'gold', emoji: '💰' },
                { label: '경험치', value: 'exp', emoji: '✨' },
                { label: '티켓', value: 'ticket', emoji: '🎫' },
                { label: '아이템', value: 'item', emoji: '🎁' },
                { label: '복합 보상', value: 'mixed', emoji: '📦' }
            ]);
            
        await interaction.reply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(rewardTypeSelect),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('admin_bulk_confirm')
                        .setLabel('✅ 지급 시작')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('admin_bulk_menu')
                        .setLabel('❌ 취소')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }
    else if (customId === 'admin_bulk_mixed_modal') {
        const adminId = interaction.user.id;
        const bulk = adminBulkRewardSystem.pendingBulkRewards.get(adminId);
        
        if (!bulk) {
            return await interaction.reply({
                content: '❌ 보상 설정 정보를 찾을 수 없습니다.',
                ephemeral: true
            });
        }
        
        const goldAmount = interaction.fields.getTextInputValue('gold_amount');
        const expAmount = interaction.fields.getTextInputValue('exp_amount');
        const ticketAmount = interaction.fields.getTextInputValue('ticket_amount');
        const message = interaction.fields.getTextInputValue('reward_message');
        
        bulk.rewardData = { message };
        
        if (goldAmount) bulk.rewardData.gold = parseInt(goldAmount);
        if (expAmount) bulk.rewardData.exp = parseInt(expAmount);
        if (ticketAmount) {
            bulk.rewardData.tickets = {
                hunting: parseInt(ticketAmount),
                dungeon: parseInt(ticketAmount),
                pvp: parseInt(ticketAmount),
                minigame: parseInt(ticketAmount)
            };
        }
        
        // 바로 지급 시작
        await interaction.deferReply();
        return await adminBulkRewardSystem.processBulkReward(interaction);
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