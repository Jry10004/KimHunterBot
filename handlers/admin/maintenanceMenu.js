const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { isAdmin } = require('../common/utils');

// 점검 상태 파일 경로
const MAINTENANCE_FILE = path.join(__dirname, '../../data/maintenanceStatus.json');

// 점검 가능한 기능 목록
const FEATURES = {
    'game': '🎮 게임 전체',
    'hunting': '🏹 사냥',
    'dungeon': '🏰 던전',
    'pvp': '⚔️ PVP/결투',
    'minigame': '🎲 미니게임',
    'enhance': '🔨 강화',
    'shop': '🛍️ 상점',
    'trade': '💱 거래',
    'boss': '👹 보스레이드',
    'stock': '📈 주식',
    'quest': '📋 의뢰/퀘스트',
    'ranking': '🏆 랭킹',
    'daily': '🎁 일일보상',
    'gacha': '🎰 가챠/뽑기'
};

// 점검 상태 로드
async function loadMaintenanceStatus() {
    try {
        const data = await fs.readFile(MAINTENANCE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

// 점검 상태 저장
async function saveMaintenanceStatus(status) {
    await fs.writeFile(MAINTENANCE_FILE, JSON.stringify(status, null, 2));
}

// 점검 메인 메뉴 표시
async function showMaintenanceMenu(interaction) {
    if (!isAdmin(interaction.user.id)) {
        return await interaction.reply({ 
            content: '❌ 관리자만 접근할 수 있습니다!', 
            ephemeral: true 
        });
    }

    // defer 처리
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }

    const maintenanceStatus = await loadMaintenanceStatus();
    
    // 현재 점검 중인 기능들
    const activeMaintenances = Object.entries(maintenanceStatus)
        .filter(([_, info]) => info.active)
        .map(([feature, info]) => {
            const duration = Math.floor((Date.now() - new Date(info.startTime).getTime()) / 1000 / 60);
            return `${FEATURES[feature]}: ${duration}분 경과`;
        });

    const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🔧 점검 관리 시스템')
        .setDescription('게임 기능별 점검 모드를 관리합니다.')
        .addFields(
            { 
                name: '📊 현재 점검 상태', 
                value: activeMaintenances.length > 0 
                    ? activeMaintenances.join('\n') 
                    : '✅ 모든 기능 정상 작동 중', 
                inline: false 
            },
            { 
                name: '🛠️ 사용 방법', 
                value: '• 점검 시작: 기능을 선택하고 시작 버튼 클릭\n• 점검 종료: 점검 중인 기능을 선택하고 종료 버튼 클릭\n• 긴급 점검: 게임 전체를 즉시 점검 모드로 전환', 
                inline: false 
            }
        )
        .setFooter({ text: '점검 중에는 해당 기능을 사용할 수 없습니다.' })
        .setTimestamp();

    // 기능 선택 메뉴
    const featureSelect = new StringSelectMenuBuilder()
        .setCustomId('maintenance_feature_select')
        .setPlaceholder('점검할 기능을 선택하세요')
        .addOptions(
            Object.entries(FEATURES).map(([value, label]) => ({
                label: label,
                value: value,
                description: maintenanceStatus[value]?.active ? '🔴 점검 중' : '🟢 정상 작동',
                emoji: maintenanceStatus[value]?.active ? '🔴' : '🟢'
            }))
        );

    const selectRow = new ActionRowBuilder().addComponents(featureSelect);

    // 액션 버튼들
    const actionButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('maintenance_start')
                .setLabel('🔧 점검 시작')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('maintenance_end')
                .setLabel('✅ 점검 종료')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('maintenance_emergency')
                .setLabel('🚨 긴급 점검 (전체)')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('maintenance_status')
                .setLabel('📊 상세 현황')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('admin_panel')
                .setLabel('🔙 관리자 패널')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.editReply({
        embeds: [embed],
        components: [selectRow, actionButtons]
    });
}

// 점검 시작
async function startMaintenance(interaction, feature, reason, estimatedMinutes) {
    const maintenanceStatus = await loadMaintenanceStatus();
    
    maintenanceStatus[feature] = {
        active: true,
        reason: reason || '시스템 점검',
        startTime: new Date().toISOString(),
        estimatedMinutes: estimatedMinutes,
        admin: interaction.user.tag
    };

    await saveMaintenanceStatus(maintenanceStatus);

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔧 점검 모드 활성화')
        .setDescription(`**${FEATURES[feature]}** 기능이 점검 모드로 전환되었습니다.`)
        .addFields(
            { name: '점검 사유', value: reason || '시스템 점검', inline: false },
            { name: '시작 시간', value: new Date().toLocaleString('ko-KR'), inline: true }
        );

    if (estimatedMinutes) {
        embed.addFields({
            name: '예상 시간',
            value: `약 ${estimatedMinutes}분`,
            inline: true
        });
    }

    embed.setFooter({ text: `관리자: ${interaction.user.tag}` })
        .setTimestamp();

    console.log(`[점검] ${feature} 점검 시작 - 관리자: ${interaction.user.tag}`);

    return embed;
}

// 점검 종료
async function endMaintenance(interaction, feature) {
    const maintenanceStatus = await loadMaintenanceStatus();
    
    if (!maintenanceStatus[feature] || !maintenanceStatus[feature].active) {
        return null;
    }

    const maintenanceInfo = maintenanceStatus[feature];
    const duration = Math.floor((Date.now() - new Date(maintenanceInfo.startTime).getTime()) / 1000 / 60);

    maintenanceStatus[feature].active = false;
    maintenanceStatus[feature].endTime = new Date().toISOString();
    await saveMaintenanceStatus(maintenanceStatus);

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ 점검 모드 해제')
        .setDescription(`**${FEATURES[feature]}** 기능의 점검이 종료되었습니다.`)
        .addFields(
            { name: '점검 시간', value: `${duration}분`, inline: true },
            { name: '종료 시간', value: new Date().toLocaleString('ko-KR'), inline: true }
        )
        .setFooter({ text: `관리자: ${interaction.user.tag}` })
        .setTimestamp();

    console.log(`[점검] ${feature} 점검 종료 - 관리자: ${interaction.user.tag}`);

    return embed;
}

// 상세 현황
async function showDetailedStatus(interaction) {
    const maintenanceStatus = await loadMaintenanceStatus();
    
    const activeMaintenances = Object.entries(maintenanceStatus)
        .filter(([_, info]) => info.active)
        .map(([feature, info]) => {
            const duration = Math.floor((Date.now() - new Date(info.startTime).getTime()) / 1000 / 60);
            return {
                name: FEATURES[feature],
                value: `사유: ${info.reason}\n진행 시간: ${duration}분${info.estimatedMinutes ? `/${info.estimatedMinutes}분` : ''}\n관리자: ${info.admin}`,
                inline: false
            };
        });

    const embed = new EmbedBuilder()
        .setColor(activeMaintenances.length > 0 ? '#FFA500' : '#00FF00')
        .setTitle('🔧 점검 상세 현황')
        .setDescription(activeMaintenances.length > 0 
            ? `현재 ${activeMaintenances.length}개의 기능이 점검 중입니다.`
            : '현재 점검 중인 기능이 없습니다.')
        .setTimestamp();

    if (activeMaintenances.length > 0) {
        embed.addFields(activeMaintenances);
    }

    return embed;
}

module.exports = {
    showMaintenanceMenu,
    startMaintenance,
    endMaintenance,
    showDetailedStatus,
    FEATURES
};