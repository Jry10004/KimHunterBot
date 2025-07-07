const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { getUser, formatNumber } = require('../common/utils');
const { calculateCombatPower } = require('../common/combatPower');

// PVP 메뉴 표시
async function showPVPMenu(interaction) {
    console.log('[PVP Menu] showPVPMenu called');
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.reply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
            flags: 64 
        });
    }

    // pvp 필드 초기화 (시스템 필드명에 맞춤)
    if (!user.pvpRating) user.pvpRating = 1000;
    if (!user.pvpTier) user.pvpTier = 'Bronze';
    if (!user.pvpWins) user.pvpWins = 0;
    if (!user.pvpLosses) user.pvpLosses = 0;
    if (!user.pvpTickets) user.pvpTickets = 20;
    await user.save();

    // 전투력 계산
    const combatPower = calculateCombatPower(user);
    
    const pvpEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('⚔️ PVP 대전장')
        .setDescription('다른 플레이어와 실력을 겨뤄보세요!')
        .addFields(
            { name: '⚔️ 전투력', value: `${formatNumber(combatPower)}`, inline: true },
            { name: '🎖️ 나의 레이팅', value: `${user.pvpRating}점`, inline: true },
            { name: '🏅 티어', value: user.pvpTier, inline: true },
            { name: '🎫 결투권', value: `${user.pvpTickets}개`, inline: true }
        );

    const pvpButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pvp_create_room')
                .setLabel('⚔️ 대전방 만들기')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('pvp_enhance')
                .setLabel('💎 공격 강화')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('pvp_ranking')
                .setLabel('🏆 PVP 랭킹')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('pvp_info')
                .setLabel('📖 PVP 정보')
                .setStyle(ButtonStyle.Secondary)
        );

    // interaction이 이미 defer된 경우와 아닌 경우를 구분하여 처리
    if (interaction.deferred || interaction.replied) {
        return await interaction.editReply({ 
            embeds: [pvpEmbed], 
            components: [pvpButtons]
        });
    } else {
        return await interaction.reply({ 
            embeds: [pvpEmbed], 
            components: [pvpButtons],
            flags: 64 
        });
    }
}

// PVP 공격 강화 메뉴
async function showPVPEnhance(interaction) {
    // Defer 처리
    if (!interaction.deferred && !interaction.replied) {
        if (interaction.isStringSelectMenu() || interaction.isButton()) {
            await interaction.deferUpdate().catch(console.error);
        } else {
            await interaction.deferReply({ flags: 64 }).catch(console.error);
        }
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!',
            embeds: [],
            components: []
        });
    }

    // pvpEnhancement 필드 초기화 (시스템 통합)
    if (!user.pvpEnhancement) {
        user.pvpEnhancement = {
            high: 0,
            middle: 0,
            low: 0
        };
        await user.save();
    }

    const enhanceLevels = user.pvpEnhancement;
    const enhanceCost = 500; // 강화 비용

    const enhanceEmbed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle('💎 PVP 공격 강화')
        .setDescription('각 위치의 공격력을 강화할 수 있습니다.\n강화 레벨당 공격력 +2% 증가')
        .addFields(
            {
                name: '⬆️ 상단 공격',
                value: `레벨: ${enhanceLevels.high}/10\n효과: +${enhanceLevels.high * 2}%`,
                inline: true
            },
            {
                name: '➡️ 중단 공격',
                value: `레벨: ${enhanceLevels.middle}/10\n효과: +${enhanceLevels.middle * 2}%`,
                inline: true
            },
            {
                name: '⬇️ 하단 공격',
                value: `레벨: ${enhanceLevels.low}/10\n효과: +${enhanceLevels.low * 2}%`,
                inline: true
            },
            {
                name: '💰 강화 비용',
                value: `각 ${formatNumber(enhanceCost)}G`,
                inline: false
            }
        )
        .setFooter({ text: `보유 골드: ${formatNumber(user.gold)}G` });

    const enhanceButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pvp_enhance_high')
                .setLabel('⬆️ 상단 강화')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(enhanceLevels.high >= 10 || user.gold < enhanceCost),
            new ButtonBuilder()
                .setCustomId('pvp_enhance_middle')
                .setLabel('➡️ 중단 강화')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(enhanceLevels.middle >= 10 || user.gold < enhanceCost),
            new ButtonBuilder()
                .setCustomId('pvp_enhance_low')
                .setLabel('⬇️ 하단 강화')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(enhanceLevels.low >= 10 || user.gold < enhanceCost),
            new ButtonBuilder()
                .setCustomId('pvp_menu')
                .setLabel('🔙 뒤로')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [enhanceEmbed],
        components: [enhanceButtons]
    });
}

// PVP 공격 강화 처리
async function processPVPEnhance(interaction, position) {
    // Defer 처리
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(console.error);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.followUp({ 
            content: '먼저 회원가입을 해주세요!', 
            flags: 64 
        });
    }

    const enhanceCost = 500;
    
    if (user.gold < enhanceCost) {
        await interaction.followUp({ 
            content: '💸 골드가 부족합니다!', 
            flags: 64 
        });
        return await showPVPEnhance(interaction);
    }

    if (!user.pvpEnhancement) {
        user.pvpEnhancement = { high: 0, middle: 0, low: 0 };
    }

    if (user.pvpEnhancement[position] >= 10) {
        await interaction.followUp({ 
            content: '⚠️ 이미 최대 레벨입니다!', 
            flags: 64 
        });
        return await showPVPEnhance(interaction);
    }

    // 강화 성공
    user.gold -= enhanceCost;
    user.pvpEnhancement[position]++;
    await user.save();

    const positionName = position === 'high' ? '상단' : position === 'middle' ? '중단' : '하단';
    
    await interaction.followUp({ 
        content: `✨ ${positionName} 공격 강화 성공! (레벨 ${user.pvpEnhancement[position]})`, 
        flags: 64 
    });

    // 메뉴 업데이트
    return await showPVPEnhance(interaction);
}

// PVP 랭킹 표시
async function showPVPRanking(interaction) {
    const User = require('../../models/User');
    
    try {
        const topUsers = await User.find({ 'pvp.totalDuels': { $gt: 0 } })
            .sort({ 'pvp.rating': -1 })
            .limit(10);
        
        if (topUsers.length === 0) {
            return await interaction.reply({ 
                content: '🏆 아직 PVP 기록이 없습니다!', 
                flags: 64 
            });
        }
        
        let rankingText = '';
        topUsers.forEach((user, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}위`;
            const tierEmoji = getTierEmoji(user.pvp.tier);
            rankingText += `${medal} **${user.nickname}** ${tierEmoji}\n`;
            rankingText += `   레이팅: ${user.pvp.rating} | 승률: ${((user.pvp.wins / user.pvp.totalDuels) * 100).toFixed(1)}%\n\n`;
        });
        
        const rankingEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 PVP 랭킹 TOP 10')
            .setDescription(rankingText)
            .setFooter({ text: '매시간 업데이트됩니다!' });
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pvp_menu')
                    .setLabel('🔙 뒤로')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        return await interaction.update({ 
            embeds: [rankingEmbed],
            components: [buttons]
        });
    } catch (error) {
        console.error('PVP 랭킹 조회 오류:', error);
        return await interaction.reply({ 
            content: '❌ 랭킹 조회 중 오류가 발생했습니다!', 
            flags: 64 
        });
    }
}

// 티어 이모지 헬퍼
function getTierEmoji(tier) {
    const emojis = {
        'Bronze': '🥉',
        'Silver': '🥈',
        'Gold': '🥇',
        'Platinum': '💎',
        'Master': '🏆',
        'Grandmaster': '👑',
        'Challenger': '🌟'
    };
    return emojis[tier] || '🥉';
}

module.exports = {
    showPVPMenu,
    showPVPEnhance,
    processPVPEnhance,
    showPVPRanking
};