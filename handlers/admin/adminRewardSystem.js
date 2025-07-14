const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber, isAdmin } = require('../common/utils');
const { items: itemDatabase } = require('../../data/items');

class AdminRewardSystem {
    constructor() {
        this.pendingRewards = new Map(); // 보상 대기 목록
    }

    // 통합 보상 메뉴
    async showRewardMenu(interaction) {
        if (!isAdmin(interaction.user.id)) {
            return await interaction.reply({ 
                content: '❌ 관리자만 접근할 수 있습니다!', 
                flags: 64 
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('🎁 관리자 보상 시스템')
            .setDescription('유저에게 다양한 보상을 지급할 수 있습니다.')
            .addFields(
                { name: '💰 골드', value: '골드 지급/차감', inline: true },
                { name: '✨ 경험치', value: '경험치 지급/레벨 설정', inline: true },
                { name: '🎁 아이템', value: '아이템 생성 및 지급', inline: true },
                { name: '💎 전투력', value: '스탯 포인트 지급', inline: true },
                { name: '🎫 티켓', value: '각종 티켓 지급', inline: true },
                { name: '🏆 엠블럼', value: '엠블럼 지급/회수', inline: true }
            )
            .setFooter({ text: '모든 보상 지급은 로그에 기록됩니다.' });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_reward_gold')
                    .setLabel('💰 골드 관리')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_reward_exp')
                    .setLabel('✨ 경험치/레벨')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_reward_item')
                    .setLabel('🎁 아이템 지급')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_reward_stats')
                    .setLabel('💎 스탯/전투력')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_reward_ticket')
                    .setLabel('🎫 티켓 지급')
                    .setStyle(ButtonStyle.Primary)
            );

        const buttons2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_reward_emblem')
                    .setLabel('🏆 엠블럼 관리')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('admin_reward_custom_item')
                    .setLabel('🔧 커스텀 아이템')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_reward_bulk')
                    .setLabel('📦 일괄 지급')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_reward_history')
                    .setLabel('📜 지급 내역')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('admin_panel')
                    .setLabel('🔙 관리자 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [buttons, buttons2]
        });
    }

    // 골드 관리 모달
    async showGoldModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_gold_modal')
            .setTitle('💰 골드 지급/차감');

        const userInput = new TextInputBuilder()
            .setCustomId('target_user')
            .setLabel('대상 유저 (닉네임 또는 Discord ID)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const amountInput = new TextInputBuilder()
            .setCustomId('gold_amount')
            .setLabel('골드 금액 (음수 입력시 차감)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 10000 또는 -5000')
            .setRequired(true);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('사유')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('지급/차감 사유를 입력하세요')
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(userInput),
            new ActionRowBuilder().addComponents(amountInput),
            new ActionRowBuilder().addComponents(reasonInput)
        );

        await interaction.showModal(modal);
    }

    // 경험치/레벨 관리 모달
    async showExpModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_exp_modal')
            .setTitle('✨ 경험치/레벨 관리');

        const userInput = new TextInputBuilder()
            .setCustomId('target_user')
            .setLabel('대상 유저 (닉네임 또는 Discord ID)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const typeInput = new TextInputBuilder()
            .setCustomId('exp_type')
            .setLabel('타입 (exp 또는 level)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('exp: 경험치 지급, level: 레벨 설정')
            .setRequired(true);

        const amountInput = new TextInputBuilder()
            .setCustomId('exp_amount')
            .setLabel('수치')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 5000 (exp) 또는 50 (level)')
            .setRequired(true);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('사유')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(userInput),
            new ActionRowBuilder().addComponents(typeInput),
            new ActionRowBuilder().addComponents(amountInput),
            new ActionRowBuilder().addComponents(reasonInput)
        );

        await interaction.showModal(modal);
    }

    // 커스텀 아이템 생성 모달
    async showCustomItemModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_custom_item_modal')
            .setTitle('🔧 커스텀 아이템 생성');

        const nameInput = new TextInputBuilder()
            .setCustomId('item_name')
            .setLabel('아이템 이름')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 관리자의 축복')
            .setRequired(true);

        const typeInput = new TextInputBuilder()
            .setCustomId('item_type')
            .setLabel('아이템 타입')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('weapon, armor, consumable, special')
            .setRequired(true);

        const statsInput = new TextInputBuilder()
            .setCustomId('item_stats')
            .setLabel('스탯 (JSON 형식)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('{"attack": 100, "defense": 50, "hp": 500}')
            .setRequired(true);

        const descInput = new TextInputBuilder()
            .setCustomId('item_desc')
            .setLabel('아이템 설명')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const targetInput = new TextInputBuilder()
            .setCustomId('target_user')
            .setLabel('지급할 유저 (닉네임 또는 Discord ID)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(typeInput),
            new ActionRowBuilder().addComponents(statsInput),
            new ActionRowBuilder().addComponents(descInput),
            new ActionRowBuilder().addComponents(targetInput)
        );

        await interaction.showModal(modal);
    }

    // 스탯/전투력 관리 모달
    async showStatsModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_stats_modal')
            .setTitle('💎 스탯/전투력 관리');

        const userInput = new TextInputBuilder()
            .setCustomId('target_user')
            .setLabel('대상 유저 (닉네임 또는 Discord ID)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const typeInput = new TextInputBuilder()
            .setCustomId('stat_type')
            .setLabel('스탯 타입')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('points(스탯포인트), str, vit, int, agi, luk, all(모든스탯)')
            .setRequired(true);

        const amountInput = new TextInputBuilder()
            .setCustomId('stat_amount')
            .setLabel('수치')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 10')
            .setRequired(true);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('사유')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(userInput),
            new ActionRowBuilder().addComponents(typeInput),
            new ActionRowBuilder().addComponents(amountInput),
            new ActionRowBuilder().addComponents(reasonInput)
        );

        await interaction.showModal(modal);
    }

    // 티켓 지급 모달
    async showTicketModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_ticket_modal')
            .setTitle('🎫 티켓 지급');

        const userInput = new TextInputBuilder()
            .setCustomId('target_user')
            .setLabel('대상 유저 (닉네임 또는 Discord ID)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const typeInput = new TextInputBuilder()
            .setCustomId('ticket_type')
            .setLabel('티켓 종류')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('hunting, dungeon, pvp, all')
            .setRequired(true);

        const amountInput = new TextInputBuilder()
            .setCustomId('ticket_amount')
            .setLabel('수량')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 10')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(userInput),
            new ActionRowBuilder().addComponents(typeInput),
            new ActionRowBuilder().addComponents(amountInput)
        );

        await interaction.showModal(modal);
    }

    // 일괄 지급 모달
    async showBulkRewardModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_bulk_modal')
            .setTitle('📦 일괄 보상 지급');

        const targetsInput = new TextInputBuilder()
            .setCustomId('target_users')
            .setLabel('대상 유저들 (쉼표로 구분)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('닉네임1, 닉네임2, 닉네임3')
            .setRequired(true);

        const rewardsInput = new TextInputBuilder()
            .setCustomId('rewards')
            .setLabel('보상 내용 (JSON 형식)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('{"gold": 10000, "exp": 5000, "tickets": {"hunting": 5}}')
            .setRequired(true);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('사유')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 이벤트 보상')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(targetsInput),
            new ActionRowBuilder().addComponents(rewardsInput),
            new ActionRowBuilder().addComponents(reasonInput)
        );

        await interaction.showModal(modal);
    }

    // 보상 처리
    async processReward(interaction, type, data) {
        try {
            let targetUser = await this.findUser(data.targetUser);
            if (!targetUser) {
                return await interaction.reply({
                    content: '❌ 유저를 찾을 수 없습니다.',
                    flags: 64
                });
            }

            let resultMessage = '';
            const adminName = interaction.user.username;
            const reason = data.reason || '사유 없음';

            switch (type) {
                case 'gold':
                    const goldAmount = parseInt(data.amount);
                    const oldGold = targetUser.gold;
                    targetUser.gold += goldAmount;
                    await targetUser.save();
                    
                    resultMessage = `✅ 골드 ${goldAmount >= 0 ? '지급' : '차감'} 완료\n` +
                        `대상: ${targetUser.nickname}\n` +
                        `금액: ${formatNumber(Math.abs(goldAmount))}G\n` +
                        `변경: ${formatNumber(oldGold)} → ${formatNumber(targetUser.gold)}`;
                    break;

                case 'exp':
                    if (data.type === 'level') {
                        const newLevel = parseInt(data.amount);
                        const oldLevel = targetUser.level;
                        targetUser.level = newLevel;
                        targetUser.exp = 0;
                        await targetUser.save();
                        
                        resultMessage = `✅ 레벨 설정 완료\n` +
                            `대상: ${targetUser.nickname}\n` +
                            `변경: Lv.${oldLevel} → Lv.${newLevel}`;
                    } else {
                        const expAmount = parseInt(data.amount);
                        targetUser.exp += expAmount;
                        
                        // 레벨업 체크
                        let levelUps = 0;
                        while (targetUser.exp >= targetUser.level * 100) {
                            targetUser.exp -= targetUser.level * 100;
                            targetUser.level++;
                            targetUser.statPoints += 5;
                            levelUps++;
                        }
                        
                        await targetUser.save();
                        
                        resultMessage = `✅ 경험치 지급 완료\n` +
                            `대상: ${targetUser.nickname}\n` +
                            `경험치: +${formatNumber(expAmount)} EXP`;
                        if (levelUps > 0) {
                            resultMessage += `\n레벨업: +${levelUps} (현재 Lv.${targetUser.level})`;
                        }
                    }
                    break;

                case 'stats':
                    const statType = data.type;
                    const statAmount = parseInt(data.amount);
                    
                    if (statType === 'points') {
                        targetUser.statPoints = (targetUser.statPoints || 0) + statAmount;
                    } else if (statType === 'all') {
                        targetUser.stats.strength += statAmount;
                        targetUser.stats.vitality += statAmount;
                        targetUser.stats.intelligence += statAmount;
                        targetUser.stats.agility += statAmount;
                        targetUser.stats.luck += statAmount;
                    } else {
                        const statMap = {
                            'str': 'strength',
                            'vit': 'vitality',
                            'int': 'intelligence',
                            'agi': 'agility',
                            'luk': 'luck'
                        };
                        const statKey = statMap[statType];
                        if (statKey) {
                            targetUser.stats[statKey] += statAmount;
                        }
                    }
                    
                    await targetUser.save();
                    
                    resultMessage = `✅ 스탯 지급 완료\n` +
                        `대상: ${targetUser.nickname}\n` +
                        `타입: ${statType}\n` +
                        `수치: +${statAmount}`;
                    break;

                case 'ticket':
                    const ticketType = data.type;
                    const ticketAmount = parseInt(data.amount);
                    
                    if (ticketType === 'all') {
                        targetUser.huntingTickets = Math.min(20, (targetUser.huntingTickets || 0) + ticketAmount);
                        targetUser.dungeonTickets = Math.min(5, (targetUser.dungeonTickets || 0) + ticketAmount);
                        targetUser.pvpTickets = Math.min(10, (targetUser.pvpTickets || 0) + ticketAmount);
                    } else if (ticketType === 'hunting') {
                        targetUser.huntingTickets = Math.min(20, (targetUser.huntingTickets || 0) + ticketAmount);
                    } else if (ticketType === 'dungeon') {
                        targetUser.dungeonTickets = Math.min(5, (targetUser.dungeonTickets || 0) + ticketAmount);
                    } else if (ticketType === 'pvp') {
                        targetUser.pvpTickets = Math.min(10, (targetUser.pvpTickets || 0) + ticketAmount);
                    }
                    
                    await targetUser.save();
                    
                    resultMessage = `✅ 티켓 지급 완료\n` +
                        `대상: ${targetUser.nickname}\n` +
                        `종류: ${ticketType}\n` +
                        `수량: +${ticketAmount}`;
                    break;

                case 'custom_item':
                    const customItem = {
                        id: `custom_${Date.now()}`,
                        name: data.name,
                        type: data.type,
                        stats: JSON.parse(data.stats),
                        description: data.description,
                        rarity: 'legendary',
                        tradeable: false,
                        adminItem: true,
                        createdBy: adminName,
                        createdAt: new Date()
                    };
                    
                    if (!targetUser.inventory) targetUser.inventory = [];
                    targetUser.inventory.push(customItem);
                    await targetUser.save();
                    
                    resultMessage = `✅ 커스텀 아이템 생성 및 지급 완료\n` +
                        `대상: ${targetUser.nickname}\n` +
                        `아이템: ${customItem.name}\n` +
                        `타입: ${customItem.type}`;
                    break;
            }

            // 로그 기록
            await this.logReward({
                admin: adminName,
                target: targetUser.nickname,
                type: type,
                data: data,
                reason: reason,
                timestamp: new Date()
            });

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎁 관리자 보상 지급')
                .setDescription(resultMessage)
                .addFields(
                    { name: '관리자', value: adminName, inline: true },
                    { name: '사유', value: reason, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: 64 });

        } catch (error) {
            console.error('보상 처리 오류:', error);
            await interaction.reply({
                content: '❌ 보상 처리 중 오류가 발생했습니다.',
                flags: 64
            });
        }
    }

    // 유저 찾기
    async findUser(identifier) {
        // Discord ID로 찾기
        let user = await User.findOne({ discordId: identifier });
        if (user) return user;

        // 닉네임으로 찾기
        user = await User.findOne({ nickname: identifier });
        if (user) return user;

        // 부분 닉네임으로 찾기
        user = await User.findOne({ 
            nickname: { $regex: identifier, $options: 'i' } 
        });
        
        return user;
    }

    // 보상 로그 기록
    async logReward(data) {
        // TODO: 로그 시스템 구현
        console.log('[관리자 보상]', data);
    }
}

module.exports = new AdminRewardSystem();