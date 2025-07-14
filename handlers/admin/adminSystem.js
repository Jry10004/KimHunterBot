const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber, ADMIN_IDS } = require('../common/utils');
const adminRewardSystem = require('./adminRewardSystem');

// 관리자 확인
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

// 관리자 메뉴
async function showAdminMenu(interaction) {
    if (!isAdmin(interaction.user.id)) {
        return await interaction.reply({ 
            content: '❌ 관리자만 접근할 수 있습니다!', 
            flags: 64 
        });
    }
    
    // defer 처리
    if (!interaction.deferred && !interaction.replied) {
        if (interaction.isButton() || interaction.customId === 'admin_panel') {
            await interaction.deferUpdate();
        } else {
            await interaction.deferReply({ flags: 64 });
        }
    }

    const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('⚙️ 관리자 설정')
        .setDescription('게임 시스템 관리 메뉴입니다.')
        .addFields(
            { name: '👥 유저 관리', value: '레벨, 경험치, 계정 설정', inline: true },
            { name: '💰 경제 관리', value: '골드, 주식, 물가 조절', inline: true },
            { name: '🎮 게임 관리', value: '아이템, 엠블럼, 시스템', inline: true },
            { name: '🔧 점검 관리', value: '기능별 점검 모드 설정', inline: true }
        )
        .setFooter({ text: '신중하게 사용하세요! 모든 작업은 로그에 기록됩니다.' });
    
    const buttons1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_reward_menu')
                .setLabel('🎁 통합 보상 시스템')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('admin_emblem_menu')
                .setLabel('🏆 엠블럼 관리')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_give_item')
                .setLabel('🎁 아이템 지급')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_equipment_system')
                .setLabel('⚔️ 장비 생성')
                .setStyle(ButtonStyle.Primary)
        );
    
    const buttons2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_system_status')
                .setLabel('📈 시스템 상태')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('admin_announcement')
                .setLabel('📢 공지 발송')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('admin_reset_user')
                .setLabel('🔄 유저 초기화')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🔙 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    // 추가 관리자 버튼
    const buttons3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_user_manage')
                .setLabel('👥 유저 관리')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_economy')
                .setLabel('💰 경제 관리')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_stats')
                .setLabel('📊 통계')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('admin_backup')
                .setLabel('💾 백업')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('admin_maintenance')
                .setLabel('🔧 점검 관리')
                .setStyle(ButtonStyle.Danger)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons1, buttons2, buttons3]
    });
}

// 레벨/경험치 설정 모달
async function showLevelModal(interaction) {
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
        .setPlaceholder('설정할 레벨 (1-999)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const expInput = new TextInputBuilder()
        .setCustomId('exp')
        .setLabel('경험치')
        .setPlaceholder('설정할 경험치')
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
        .setLabel('골드 수량')
        .setPlaceholder('지급할 골드 수량 (음수 가능)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('지급 사유')
        .setPlaceholder('지급 사유를 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(userIdInput),
        new ActionRowBuilder().addComponents(amountInput),
        new ActionRowBuilder().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
}

// 아이템 지급 모달
async function showItemModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('admin_item_modal')
        .setTitle('아이템 지급');

    const userIdInput = new TextInputBuilder()
        .setCustomId('target_user_id')
        .setLabel('유저 ID')
        .setPlaceholder('Discord 유저 ID를 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const itemNameInput = new TextInputBuilder()
        .setCustomId('item_name')
        .setLabel('아이템 이름')
        .setPlaceholder('지급할 아이템 이름')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const quantityInput = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel('수량')
        .setPlaceholder('지급할 수량')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(userIdInput),
        new ActionRowBuilder().addComponents(itemNameInput),
        new ActionRowBuilder().addComponents(quantityInput)
    );

    await interaction.showModal(modal);
}

// 공지 발송 모달
async function showAnnouncementModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('admin_announcement_modal')
        .setTitle('공지 발송');

    const titleInput = new TextInputBuilder()
        .setCustomId('announcement_title')
        .setLabel('공지 제목')
        .setPlaceholder('공지 제목을 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const contentInput = new TextInputBuilder()
        .setCustomId('announcement_content')
        .setLabel('공지 내용')
        .setPlaceholder('공지 내용을 입력하세요')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const channelInput = new TextInputBuilder()
        .setCustomId('channel_id')
        .setLabel('채널 ID (선택사항)')
        .setPlaceholder('발송할 채널 ID (비워두면 현재 채널)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(contentInput),
        new ActionRowBuilder().addComponents(channelInput)
    );

    await interaction.showModal(modal);
}

// 시스템 상태 표시
async function showSystemStatus(interaction) {
    const totalUsers = await User.countDocuments({ registered: true });
    const activeUsers = await User.countDocuments({ 
        registered: true, 
        lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
    });
    const totalGold = await User.aggregate([
        { $match: { registered: true } },
        { $group: { _id: null, total: { $sum: '$gold' } } }
    ]);

    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('📈 시스템 상태')
        .setDescription('현재 게임 시스템 상태입니다.')
        .addFields(
            { name: '👥 총 유저 수', value: `${totalUsers}명`, inline: true },
            { name: '🟢 일일 활성 유저', value: `${activeUsers}명`, inline: true },
            { name: '💰 총 유통 골드', value: `${formatNumber(totalGold[0]?.total || 0)}G`, inline: true },
            { name: '🖥️ 서버 상태', value: '정상 작동중', inline: true },
            { name: '📊 메모리 사용률', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
            { name: '⏰ 업타임', value: `${Math.floor(process.uptime() / 3600)}시간`, inline: true }
        )
        .setTimestamp();

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_panel')
                .setLabel('🔙 관리자 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

// 유저 초기화 확인
async function confirmUserReset(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('⚠️ 유저 초기화 경고')
        .setDescription('**정말로 유저를 초기화하시겠습니까?**\n\n이 작업은 되돌릴 수 없습니다!')
        .addFields(
            { name: '삭제될 데이터', value: '• 모든 아이템\n• 모든 골드\n• 모든 레벨과 경험치\n• 모든 게임 기록', inline: false }
        );

    const modal = new ModalBuilder()
        .setCustomId('admin_reset_confirm_modal')
        .setTitle('유저 초기화 확인');

    const userIdInput = new TextInputBuilder()
        .setCustomId('target_user_id')
        .setLabel('유저 ID')
        .setPlaceholder('초기화할 Discord 유저 ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const confirmInput = new TextInputBuilder()
        .setCustomId('confirm_text')
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

// 엠블럼 관리 메뉴
async function showEmblemAdminMenu(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle('🏆 엠블럼 관리')
        .setDescription('엠블럼 시스템 관리 메뉴입니다.');

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_emblem_give')
                .setLabel('🎁 엠블럼 지급')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_emblem_set_level')
                .setLabel('📊 엠블럼 레벨 설정')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_emblem_reset')
                .setLabel('🔄 엠블럼 초기화')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('admin_panel')
                .setLabel('🔙 관리자 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
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