const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { formatNumber } = require('../common/utils');
const fs = require('fs').promises;
const path = require('path');

// 유저 관리 메뉴
async function showUserManageMenu(interaction) {
    await interaction.deferUpdate();
    
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ 
        lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
    });
    const bannedUsers = await User.countDocuments({ banned: true });
    
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('👥 유저 관리')
        .setDescription('유저 관련 관리 기능입니다.')
        .addFields(
            { name: '📊 전체 유저', value: `${totalUsers}명`, inline: true },
            { name: '✅ 활성 유저', value: `${activeUsers}명`, inline: true },
            { name: '⛔ 정지 유저', value: `${bannedUsers}명`, inline: true }
        );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_search_user')
                .setLabel('🔍 유저 검색')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_ban_user')
                .setLabel('⛔ 유저 정지')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('admin_unban_user')
                .setLabel('✅ 정지 해제')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('admin_user_list')
                .setLabel('📋 유저 목록')
                .setStyle(ButtonStyle.Secondary)
        );
    
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_panel')
                .setLabel('🔙 관리자 패널')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.editReply({
        embeds: [embed],
        components: [buttons, backButton]
    });
}

// 경제 관리 메뉴
async function showEconomyMenu(interaction) {
    await interaction.deferUpdate();
    
    const totalGold = await User.aggregate([
        { $group: { _id: null, total: { $sum: '$gold' } } }
    ]);
    
    const richestUser = await User.findOne().sort({ gold: -1 }).limit(1);
    
    const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('💰 경제 관리')
        .setDescription('서버 경제 관리 기능입니다.')
        .addFields(
            { name: '💵 총 통화량', value: `${formatNumber(totalGold[0]?.total || 0)} G`, inline: true },
            { name: '🤑 최고 부자', value: richestUser ? `${richestUser.nickname} (${formatNumber(richestUser.gold)}G)` : '없음', inline: true }
        );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_give_gold')
                .setLabel('💰 골드 지급')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_set_inflation')
                .setLabel('📈 인플레이션 조절')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_stock_control')
                .setLabel('📊 주식 관리')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('admin_shop_control')
                .setLabel('🛒 상점 관리')
                .setStyle(ButtonStyle.Success)
        );
    
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_panel')
                .setLabel('🔙 관리자 패널')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.editReply({
        embeds: [embed],
        components: [buttons, backButton]
    });
}

// 서버 통계
async function showServerStats(interaction) {
    await interaction.deferUpdate();
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 통계 수집
    const stats = {
        totalUsers: await User.countDocuments(),
        newUsersToday: await User.countDocuments({ createdAt: { $gte: today } }),
        activeToday: await User.countDocuments({ lastActive: { $gte: today } }),
        totalGold: await User.aggregate([{ $group: { _id: null, total: { $sum: '$gold' } } }]),
        averageLevel: await User.aggregate([{ $group: { _id: null, avg: { $avg: '$level' } } }]),
        highestLevel: await User.findOne().sort({ level: -1 }).limit(1)
    };
    
    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('📊 서버 통계')
        .setDescription('서버 전체 통계 정보입니다.')
        .addFields(
            { name: '👥 전체 유저', value: `${stats.totalUsers}명`, inline: true },
            { name: '🆕 오늘 가입', value: `${stats.newUsersToday}명`, inline: true },
            { name: '✅ 오늘 활동', value: `${stats.activeToday}명`, inline: true },
            { name: '💰 총 통화량', value: `${formatNumber(stats.totalGold[0]?.total || 0)} G`, inline: true },
            { name: '📊 평균 레벨', value: `Lv.${Math.floor(stats.averageLevel[0]?.avg || 0)}`, inline: true },
            { name: '🏆 최고 레벨', value: stats.highestLevel ? `${stats.highestLevel.nickname} (Lv.${stats.highestLevel.level})` : '없음', inline: true }
        )
        .setTimestamp();
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_export_stats')
                .setLabel('📤 통계 내보내기')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_panel')
                .setLabel('🔙 관리자 패널')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 백업 메뉴
async function showBackupMenu(interaction) {
    await interaction.deferUpdate();
    
    const backupDir = path.join(process.cwd(), 'backups');
    let backupFiles = [];
    
    try {
        const files = await fs.readdir(backupDir);
        backupFiles = files.filter(f => f.endsWith('.json')).slice(-5); // 최근 5개
    } catch (error) {
        console.error('백업 파일 읽기 오류:', error);
    }
    
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('💾 백업 관리')
        .setDescription('데이터 백업 및 복구 기능입니다.')
        .addFields(
            { name: '📁 백업 위치', value: backupDir, inline: false },
            { name: '📋 최근 백업', value: backupFiles.length > 0 ? backupFiles.join('\n') : '백업 없음', inline: false }
        );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_create_backup')
                .setLabel('💾 백업 생성')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('admin_restore_backup')
                .setLabel('📥 백업 복구')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('admin_auto_backup')
                .setLabel('🔄 자동 백업 설정')
                .setStyle(ButtonStyle.Secondary)
        );
    
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('admin_panel')
                .setLabel('🔙 관리자 패널')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.editReply({
        embeds: [embed],
        components: [buttons, backButton]
    });
}

module.exports = {
    showUserManageMenu,
    showEconomyMenu,
    showServerStats,
    showBackupMenu
};