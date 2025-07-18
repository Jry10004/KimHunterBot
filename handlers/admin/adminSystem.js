const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');

// 관리자 ID 목록
const ADMIN_IDS = ['424480594542592009', '295980447849250817', '532128778175619084'];

// 관리자 권한 체크
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

// 관리자 메인 메뉴
async function showAdminMenu(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🛠️ 관리자 패널')
        .setDescription('관리자 기능을 선택하세요.')
        .setTimestamp();

    const buttons1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_user_level')
                .setLabel('📊 레벨/경험치 설정')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_give_gold')
                .setLabel('💰 골드 지급')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_give_item')
                .setLabel('🎁 아이템 지급')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_emblem_menu')
                .setLabel('🏆 엠블럼 관리')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_announcement')
                .setLabel('📢 공지 발송')
                .setStyle(ButtonStyle.Primary)
        );

    const buttons2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_system_status')
                .setLabel('📊 시스템 상태')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('admin_reset_user')
                .setLabel('🔄 유저 초기화')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('admin_user_manage')
                .setLabel('👥 유저 관리')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('admin_economy')
                .setLabel('💎 경제 관리')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('admin_maintenance')
                .setLabel('🔧 점검 모드')
                .setStyle(ButtonStyle.Danger)
        );

    const buttons3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_reward_menu')
                .setLabel('🎁 통합 보상 시스템')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('admin_equipment_system')
                .setLabel('⚔️ 장비 생성 시스템')
                .setStyle(ButtonStyle.Success)
        );

    if (interaction.deferred || interaction.replied) {
        return await interaction.editReply({ embeds: [embed], components: [buttons1, buttons2, buttons3] });
    } else {
        return await interaction.reply({ embeds: [embed], components: [buttons1, buttons2, buttons3], flags: 64 });
    }
}

// 엠블럼 관리 메뉴
async function showEmblemAdminMenu(interaction) {

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
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('admin_panel')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );

    // 응답 처리
    if (interaction.isButton() && interaction.customId === 'admin_emblem_menu') {
        // 관리자 패널에서 엠블럼 관리 클릭 시 - 기존 메시지 수정
        try {
            return await interaction.update({
                embeds: [embed],
                components: [buttons]
            });
        } catch (error) {
            console.error('[EmblemAdmin] Error updating:', error);
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({
                    embeds: [embed],
                    components: [buttons],
                    flags: 64
                });
            }
        }
    } else {
        // 명령어나 다른 경우 - 새로운 메시지로 응답
        try {
            return await interaction.reply({
                embeds: [embed],
                components: [buttons],
                flags: 64
            });
        } catch (error) {
            console.error('[EmblemAdmin] Error replying:', error);
        }
    }
}

// 레벨 설정 모달
async function showLevelModal(interaction) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    
    const modal = new ModalBuilder()
        .setCustomId('admin_level_modal')
        .setTitle('레벨/경험치 설정');

    const userIdInput = new TextInputBuilder()
        .setCustomId('target_user_id')
        .setLabel('유저 ID')
        .setPlaceholder('Discord 유저 ID를 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const levelInput = new TextInputBuilder()
        .setCustomId('level')
        .setLabel('레벨')
        .setPlaceholder('설정할 레벨 (예: 50)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const expInput = new TextInputBuilder()
        .setCustomId('exp')
        .setLabel('경험치')
        .setPlaceholder('설정할 경험치 (예: 1000)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(userIdInput),
        new ActionRowBuilder().addComponents(levelInput),
        new ActionRowBuilder().addComponents(expInput)
    );

    await interaction.showModal(modal);
}

// 골드 지급 모달
async function showGoldModal(interaction) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    
    const modal = new ModalBuilder()
        .setCustomId('admin_gold_modal')
        .setTitle('골드 지급');

    const userIdInput = new TextInputBuilder()
        .setCustomId('target_user_id')
        .setLabel('유저 ID')
        .setPlaceholder('Discord 유저 ID를 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('골드 금액')
        .setPlaceholder('지급할 골드 금액 (예: 10000)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(userIdInput),
        new ActionRowBuilder().addComponents(amountInput)
    );

    await interaction.showModal(modal);
}

// 아이템 지급 모달
async function showItemModal(interaction) {
    // 선택 메뉴 방식으로 변경됨
    return await interaction.reply({
        content: '아이템 지급 시스템을 사용하려면 통합 보상 시스템을 이용해주세요.',
        flags: 64
    });
}

// 공지 발송 모달
async function showAnnouncementModal(interaction) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    
    const modal = new ModalBuilder()
        .setCustomId('admin_announcement_modal')
        .setTitle('공지 발송');

    const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('공지 제목')
        .setPlaceholder('공지 제목을 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const contentInput = new TextInputBuilder()
        .setCustomId('content')
        .setLabel('공지 내용')
        .setPlaceholder('공지 내용을 입력하세요')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(contentInput)
    );

    await interaction.showModal(modal);
}

// 시스템 상태
async function showSystemStatus(interaction) {
    const totalUsers = await User.countDocuments({ registered: true });
    const activeUsers = await User.countDocuments({ 
        registered: true, 
        lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
    });

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('📊 시스템 상태')
        .setDescription('현재 게임 시스템 상태입니다.')
        .addFields(
            { name: '👥 총 가입자', value: `${totalUsers}명`, inline: true },
            { name: '🟢 활성 유저', value: `${activeUsers}명`, inline: true },
            { name: '📊 활성률', value: `${((activeUsers / totalUsers) * 100).toFixed(1)}%`, inline: true }
        )
        .setTimestamp();

    return await interaction.reply({ embeds: [embed], flags: 64 });
}

// 유저 초기화 확인
async function confirmUserReset(interaction) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    
    const modal = new ModalBuilder()
        .setCustomId('admin_reset_confirm_modal')
        .setTitle('⚠️ 유저 초기화 확인');

    const userIdInput = new TextInputBuilder()
        .setCustomId('target_user_id')
        .setLabel('유저 ID')
        .setPlaceholder('초기화할 유저의 Discord ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const confirmInput = new TextInputBuilder()
        .setCustomId('confirm')
        .setLabel('확인 문구')
        .setPlaceholder('초기화를 확인하려면 "RESET" 입력')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(userIdInput),
        new ActionRowBuilder().addComponents(confirmInput)
    );

    await interaction.showModal(modal);
}

module.exports = {
    isAdmin,
    showAdminMenu,
    showLevelModal,
    showGoldModal,
    showItemModal,
    showAnnouncementModal,
    showSystemStatus,
    confirmUserReset,
    showEmblemAdminMenu
};