const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { formatNumber, isAdmin } = require('../common/utils');
const { items, allItems, createItem, rarityColors, rarityEmojis } = require('../../data/items');
const adminEquipmentSystem = require('./adminEquipmentSystem');

class AdminRewardSelectSystem {
    constructor() {
        this.pendingRewards = new Map(); // 진행 중인 보상 선택
    }

    // 메인 메뉴 (showRewardMenu의 별칭)
    async showMainMenu(interaction) {
        return await this.showRewardMenu(interaction);
    }

    // 통합 보상 메뉴
    async showRewardMenu(interaction) {
        if (!isAdmin(interaction.user.id)) {
            return await interaction.reply({ 
                content: '❌ 관리자만 접근할 수 있습니다!', 
                flags: 64 
            });
        }
        
        // deferUpdate 추가
        await interaction.deferUpdate().catch(() => {});

        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('🎁 관리자 보상 시스템 (선택식)')
            .setDescription('선택 메뉴를 통해 쉽게 보상을 지급할 수 있습니다.')
            .addFields(
                { name: '💰 골드', value: '드롭다운으로 선택', inline: true },
                { name: '🎁 아이템', value: '카테고리별 선택', inline: true },
                { name: '✨ 경험치', value: '프리셋 선택', inline: true },
                { name: '🎫 티켓', value: '종류별 선택', inline: true },
                { name: '💎 스탯', value: '타입별 선택', inline: true },
                { name: '📦 세트', value: '미리 정의된 세트', inline: true }
            )
            .setFooter({ text: '모든 보상 지급은 로그에 기록됩니다.' });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_reward_gold_select')
                    .setLabel('💰 골드 지급')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_reward_item_select')
                    .setLabel('🎁 아이템 지급')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_reward_exp_select')
                    .setLabel('✨ 경험치/레벨')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_reward_ticket_select')
                    .setLabel('🎫 티켓 지급')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_reward_stats_select')
                    .setLabel('💎 스탯 포인트')
                    .setStyle(ButtonStyle.Primary)
            );
            
        const buttons1_5 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_equip_menu')
                    .setLabel('🛡️ 3단어 장비 생성')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🆕')
            );

        const buttons2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_reward_set')
                    .setLabel('📦 세트 보상')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_bulk_menu')
                    .setLabel('👥 전체 지급')
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
            components: [buttons, buttons1_5, buttons2]
        });
    }

    // 골드 지급 선택 메뉴
    async showGoldSelectMenu(interaction) {
        await interaction.deferUpdate().catch(() => {});
        // 상위 25명 유저 가져오기
        const users = await User.find({ registered: true })
            .sort({ level: -1 })
            .limit(25);

        const userOptions = users.map(user => ({
            label: `${user.nickname} (Lv.${user.level})`,
            description: `현재 골드: ${formatNumber(user.gold)}G`,
            value: user.discordId
        }));

        const userSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_gold_user_select')
            .setPlaceholder('👥 대상 유저를 선택하세요')
            .addOptions(userOptions);

        const amountSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_gold_amount_select')
            .setPlaceholder('💰 골드 금액을 선택하세요')
            .addOptions([
                { label: '+1,000G', value: '1000', emoji: '💵' },
                { label: '+5,000G', value: '5000', emoji: '💵' },
                { label: '+10,000G', value: '10000', emoji: '💵' },
                { label: '+50,000G', value: '50000', emoji: '💰' },
                { label: '+100,000G', value: '100000', emoji: '💰' },
                { label: '+500,000G', value: '500000', emoji: '💎' },
                { label: '+1,000,000G', value: '1000000', emoji: '💎' },
                { label: '────────────', value: 'divider', description: '차감 옵션' },
                { label: '-10,000G', value: '-10000', emoji: '📉' },
                { label: '-50,000G', value: '-50000', emoji: '📉' },
                { label: '-100,000G', value: '-100000', emoji: '📉' }
            ]);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💰 골드 지급 (선택식)')
            .setDescription('대상 유저와 금액을 선택해주세요.')
            .addFields(
                { name: '선택된 유저', value: '없음', inline: true },
                { name: '선택된 금액', value: '없음', inline: true }
            );

        const confirmButton = new ButtonBuilder()
            .setCustomId('admin_gold_confirm')
            .setLabel('✅ 지급하기')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const cancelButton = new ButtonBuilder()
            .setCustomId('admin_reward_menu')
            .setLabel('❌ 취소')
            .setStyle(ButtonStyle.Secondary);

        await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(userSelect),
                new ActionRowBuilder().addComponents(amountSelect),
                new ActionRowBuilder().addComponents(confirmButton, cancelButton)
            ]
        });

        // 선택 상태 초기화
        this.pendingRewards.set(interaction.user.id, {
            type: 'gold',
            targetUser: null,
            targetUserName: null,
            amount: null
        });
    }

    // 아이템 지급 선택 메뉴
    async showItemSelectMenu(interaction) {
        await interaction.deferUpdate().catch(() => {});
        const users = await User.find({ registered: true })
            .sort({ level: -1 })
            .limit(25);

        const userOptions = users.map(user => ({
            label: `${user.nickname} (Lv.${user.level})`,
            description: `인벤토리: ${user.inventory?.length || 0}개 아이템`,
            value: user.discordId
        }));

        const userSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_item_user_select')
            .setPlaceholder('👥 대상 유저를 선택하세요')
            .addOptions(userOptions);

        const categorySelect = new StringSelectMenuBuilder()
            .setCustomId('admin_item_category_select')
            .setPlaceholder('📦 아이템 카테고리를 선택하세요')
            .addOptions([
                { label: '무기', value: 'weapons', emoji: '⚔️' },
                { label: '방어구', value: 'armors', emoji: '🛡️' },
                { label: '소비 아이템', value: 'consumables', emoji: '🧪' },
                { label: '특수 아이템', value: 'special', emoji: '✨' },
                { label: '관리자 전용', value: 'admin', emoji: '👑' }
            ]);

        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🎁 아이템 지급 (선택식)')
            .setDescription('대상 유저와 아이템 카테고리를 선택해주세요.')
            .addFields(
                { name: '선택된 유저', value: '없음', inline: true },
                { name: '선택된 카테고리', value: '없음', inline: true },
                { name: '선택된 아이템', value: '없음', inline: true }
            );

        await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(userSelect),
                new ActionRowBuilder().addComponents(categorySelect),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('admin_reward_menu')
                        .setLabel('❌ 취소')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });

        this.pendingRewards.set(interaction.user.id, {
            type: 'item',
            targetUser: null,
            targetUserName: null,
            category: null,
            itemId: null
        });
    }

    // 아이템 목록 표시
    async showItemList(interaction, category) {
        await interaction.deferUpdate().catch(() => {});
        const categoryItems = items[category];
        if (!categoryItems) return;

        const itemOptions = Object.entries(categoryItems).slice(0, 25).map(([id, item]) => {
            const emoji = rarityEmojis[item.rarity] || '⚪';
            let description = item.description.substring(0, 50);
            if (item.stats) {
                const statsList = Object.entries(item.stats)
                    .slice(0, 2)
                    .map(([stat, value]) => `${stat}: +${value}`)
                    .join(', ');
                description = statsList;
            }

            return {
                label: `${item.name}`,
                description: description,
                value: id,
                emoji: emoji
            };
        });

        const itemSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_item_select')
            .setPlaceholder('🎁 지급할 아이템을 선택하세요')
            .addOptions(itemOptions);

        const reward = this.pendingRewards.get(interaction.user.id);
        const embed = interaction.message.embeds[0];
        
        // 선택된 카테고리 업데이트
        embed.data.fields[1].value = category;

        await interaction.update({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(itemSelect),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('admin_item_back')
                        .setLabel('🔙 뒤로')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('admin_item_confirm')
                        .setLabel('✅ 지급하기')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                )
            ]
        });
    }

    // 티켓 지급 선택 메뉴
    async showTicketSelectMenu(interaction) {
        await interaction.deferUpdate().catch(() => {});
        const users = await User.find({ registered: true })
            .sort({ level: -1 })
            .limit(25);

        const userOptions = users.map(user => ({
            label: `${user.nickname} (Lv.${user.level})`,
            description: `현재 티켓 보유량 확인`,
            value: user.discordId
        }));

        const userSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_ticket_user_select')
            .setPlaceholder('👥 대상 유저를 선택하세요')
            .addOptions(userOptions);

        const ticketTypeSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_ticket_type_select')
            .setPlaceholder('🎫 티켓 종류를 선택하세요')
            .addOptions([
                { label: '사냥 티켓', value: 'hunting', emoji: '🏹', description: '최대 20장' },
                { label: '던전 티켓', value: 'dungeon', emoji: '🏰', description: '최대 5장' },
                { label: 'PVP 티켓', value: 'pvp', emoji: '⚔️', description: '최대 20장' },
                { label: '미니게임 티켓', value: 'minigame', emoji: '🎮', description: '최대 20장' },
                { label: '가위바위보 봇 티켓', value: 'rpsBot', emoji: '🤖', description: '최대 20장' },
                { label: '가위바위보 유저 티켓', value: 'rpsUser', emoji: '👥', description: '최대 20장' },
                { label: '레이드 티켓', value: 'raid', emoji: '🐲', description: '최대 3장 (재생성 없음)' },
                { label: '모든 티켓', value: 'all', emoji: '🌐', description: '재생성 티켓 전부' }
            ]);

        const amountSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_ticket_amount_select')
            .setPlaceholder('🔢 지급할 수량을 선택하세요')
            .addOptions([
                { label: '+1장', value: '1' },
                { label: '+5장', value: '5' },
                { label: '+10장', value: '10' },
                { label: '+20장', value: '20' },
                { label: '최대 충전', value: 'max' }
            ]);

        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🎫 티켓 지급 (선택식)')
            .setDescription('대상 유저와 티켓 종류, 수량을 선택해주세요.')
            .addFields(
                { name: '선택된 유저', value: '없음', inline: true },
                { name: '선택된 티켓', value: '없음', inline: true },
                { name: '선택된 수량', value: '없음', inline: true }
            );

        const confirmButton = new ButtonBuilder()
            .setCustomId('admin_ticket_confirm')
            .setLabel('✅ 지급하기')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const cancelButton = new ButtonBuilder()
            .setCustomId('admin_reward_menu')
            .setLabel('❌ 취소')
            .setStyle(ButtonStyle.Secondary);

        await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(userSelect),
                new ActionRowBuilder().addComponents(ticketTypeSelect),
                new ActionRowBuilder().addComponents(amountSelect),
                new ActionRowBuilder().addComponents(confirmButton, cancelButton)
            ]
        });

        this.pendingRewards.set(interaction.user.id, {
            type: 'ticket',
            targetUser: null,
            targetUserName: null,
            ticketType: null,
            amount: null
        });
    }

    // 경험치/레벨 선택 메뉴
    async showExpSelectMenu(interaction) {
        await interaction.deferUpdate().catch(() => {});
        const users = await User.find({ registered: true })
            .sort({ level: -1 })
            .limit(25);

        const userOptions = users.map(user => ({
            label: `${user.nickname}`,
            description: `Lv.${user.level} (${user.exp}/${user.level * 100} EXP)`,
            value: user.discordId
        }));

        const userSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_exp_user_select')
            .setPlaceholder('👥 대상 유저를 선택하세요')
            .addOptions(userOptions);

        const typeSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_exp_type_select')
            .setPlaceholder('✨ 지급 타입을 선택하세요')
            .addOptions([
                { label: '경험치 +1,000', value: 'exp_1000', emoji: '✨' },
                { label: '경험치 +5,000', value: 'exp_5000', emoji: '✨' },
                { label: '경험치 +10,000', value: 'exp_10000', emoji: '✨' },
                { label: '경험치 +50,000', value: 'exp_50000', emoji: '⭐' },
                { label: '레벨 +1', value: 'level_1', emoji: '📈' },
                { label: '레벨 +5', value: 'level_5', emoji: '📈' },
                { label: '레벨 +10', value: 'level_10', emoji: '📈' },
                { label: '레벨 설정 10', value: 'set_10', emoji: '🎯' },
                { label: '레벨 설정 30', value: 'set_30', emoji: '🎯' },
                { label: '레벨 설정 50', value: 'set_50', emoji: '🎯' },
                { label: '레벨 설정 100', value: 'set_100', emoji: '🎯' }
            ]);

        const embed = new EmbedBuilder()
            .setColor('#9966ff')
            .setTitle('✨ 경험치/레벨 지급 (선택식)')
            .setDescription('대상 유저와 지급 타입을 선택해주세요.')
            .addFields(
                { name: '선택된 유저', value: '없음', inline: true },
                { name: '선택된 타입', value: '없음', inline: true }
            );

        await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(userSelect),
                new ActionRowBuilder().addComponents(typeSelect),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('admin_exp_confirm')
                        .setLabel('✅ 지급하기')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('admin_reward_menu')
                        .setLabel('❌ 취소')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });

        this.pendingRewards.set(interaction.user.id, {
            type: 'exp',
            targetUser: null,
            targetUserName: null,
            expType: null,
            amount: null
        });
    }

    // 선택 메뉴 핸들러
    async handleSelectMenu(interaction) {
        const customId = interaction.customId;
        const adminId = interaction.user.id;
        const reward = this.pendingRewards.get(adminId);

        if (!reward) return;

        // 골드 유저 선택
        if (customId === 'admin_gold_user_select') {
            const userId = interaction.values[0];
            const user = await User.findOne({ discordId: userId });
            
            reward.targetUser = userId;
            reward.targetUserName = user.nickname;
            
            const embed = interaction.message.embeds[0];
            embed.data.fields[0].value = `${user.nickname} (현재: ${formatNumber(user.gold)}G)`;
            
            // 확인 버튼 활성화 체크
            const confirmButton = interaction.message.components[2].components[0];
            confirmButton.data.disabled = !reward.amount;
            
            await interaction.update({ embeds: [embed], components: interaction.message.components });
        }

        // 골드 금액 선택
        else if (customId === 'admin_gold_amount_select') {
            const amount = interaction.values[0];
            if (amount === 'divider') return interaction.deferUpdate();
            
            reward.amount = parseInt(amount);
            
            const embed = interaction.message.embeds[0];
            embed.data.fields[1].value = `${amount > 0 ? '+' : ''}${formatNumber(amount)}G`;
            
            // 확인 버튼 활성화
            const components = interaction.message.components;
            components[2].components[0].data.disabled = !reward.targetUser;
            
            await interaction.update({ embeds: [embed], components: components });
        }

        // 아이템 유저 선택
        else if (customId === 'admin_item_user_select') {
            const userId = interaction.values[0];
            const user = await User.findOne({ discordId: userId });
            
            reward.targetUser = userId;
            reward.targetUserName = user.nickname;
            
            const embed = interaction.message.embeds[0];
            embed.data.fields[0].value = user.nickname;
            
            await interaction.update({ embeds: [embed] });
        }

        // 아이템 카테고리 선택
        else if (customId === 'admin_item_category_select') {
            const category = interaction.values[0];
            reward.category = category;
            
            if (reward.targetUser) {
                await this.showItemList(interaction, category);
            } else {
                await interaction.reply({
                    content: '❌ 먼저 대상 유저를 선택해주세요!',
                    ephemeral: true
                });
            }
        }

        // 아이템 선택
        else if (customId === 'admin_item_select') {
            const itemId = interaction.values[0];
            const item = allItems[itemId];
            
            reward.itemId = itemId;
            
            const embed = interaction.message.embeds[0];
            embed.data.fields[2].value = `${rarityEmojis[item.rarity]} ${item.name}`;
            
            // 확인 버튼 활성화
            const components = interaction.message.components;
            components[1].components[1].data.disabled = false;
            
            await interaction.update({ embeds: [embed], components: components });
        }

        // 경험치 유저 선택
        else if (customId === 'admin_exp_user_select') {
            const userId = interaction.values[0];
            const user = await User.findOne({ discordId: userId });
            
            reward.targetUser = userId;
            reward.targetUserName = user.nickname;
            
            const embed = interaction.message.embeds[0];
            embed.data.fields[0].value = `${user.nickname} (Lv.${user.level})`;
            
            // 확인 버튼 활성화 체크
            const components = interaction.message.components;
            components[2].components[0].data.disabled = !reward.expType;
            
            await interaction.update({ embeds: [embed], components: components });
        }

        // 티켓 유저 선택
        else if (customId === 'admin_ticket_user_select') {
            const userId = interaction.values[0];
            const user = await User.findOne({ discordId: userId });
            
            reward.targetUser = userId;
            reward.targetUserName = user.nickname;
            
            const embed = interaction.message.embeds[0];
            embed.data.fields[0].value = user.nickname;
            
            // 확인 버튼 활성화 체크
            const components = interaction.message.components;
            components[3].components[0].data.disabled = !(reward.ticketType && reward.amount);
            
            await interaction.update({ embeds: [embed], components: components });
        }

        // 티켓 타입 선택
        else if (customId === 'admin_ticket_type_select') {
            const ticketType = interaction.values[0];
            reward.ticketType = ticketType;
            
            const embed = interaction.message.embeds[0];
            const ticketNames = {
                'hunting': '사냥 티켓',
                'dungeon': '던전 티켓',
                'pvp': 'PVP 티켓',
                'minigame': '미니게임 티켓',
                'rpsBot': 'RPS 봇 티켓',
                'rpsUser': 'RPS 유저 티켓',
                'raid': '레이드 티켓',
                'all': '모든 티켓'
            };
            embed.data.fields[1].value = ticketNames[ticketType];
            
            // 확인 버튼 활성화 체크
            const components = interaction.message.components;
            components[3].components[0].data.disabled = !(reward.targetUser && reward.amount);
            
            await interaction.update({ embeds: [embed], components: components });
        }

        // 티켓 수량 선택
        else if (customId === 'admin_ticket_amount_select') {
            const amount = interaction.values[0];
            reward.amount = amount;
            
            const embed = interaction.message.embeds[0];
            embed.data.fields[2].value = amount === 'max' ? '최대 충전' : `+${amount}장`;
            
            // 확인 버튼 활성화
            const components = interaction.message.components;
            components[3].components[0].data.disabled = !(reward.targetUser && reward.ticketType);
            
            await interaction.update({ embeds: [embed], components: components });
        }

        // 경험치 타입 선택
        else if (customId === 'admin_exp_type_select') {
            const type = interaction.values[0];
            reward.expType = type;
            
            const embed = interaction.message.embeds[0];
            const [action, amount] = type.split('_');
            
            if (action === 'exp') {
                embed.data.fields[1].value = `경험치 +${formatNumber(amount)}`;
                reward.amount = parseInt(amount);
            } else if (action === 'level') {
                embed.data.fields[1].value = `레벨 +${amount}`;
                reward.amount = parseInt(amount);
            } else if (action === 'set') {
                embed.data.fields[1].value = `레벨 설정: ${amount}`;
                reward.amount = parseInt(amount);
            }
            
            // 확인 버튼 활성화
            const components = interaction.message.components;
            components[2].components[0].data.disabled = !reward.targetUser;
            
            await interaction.update({ embeds: [embed], components: components });
        }
    }

    // 보상 처리
    async processReward(interaction, type) {
        const adminId = interaction.user.id;
        const reward = this.pendingRewards.get(adminId);
        
        if (!reward) return;

        try {
            const targetUser = await User.findOne({ discordId: reward.targetUser });
            if (!targetUser) {
                return await interaction.reply({
                    content: '❌ 유저를 찾을 수 없습니다.',
                    ephemeral: true
                });
            }

            let resultMessage = '';

            switch (type) {
                case 'gold':
                    const oldGold = targetUser.gold;
                    targetUser.gold += reward.amount;
                    await targetUser.save();
                    
                    resultMessage = `💰 **골드 ${reward.amount > 0 ? '지급' : '차감'} 완료**\n` +
                        `대상: ${targetUser.nickname}\n` +
                        `금액: ${formatNumber(Math.abs(reward.amount))}G\n` +
                        `${formatNumber(oldGold)}G → ${formatNumber(targetUser.gold)}G`;
                    break;

                case 'item':
                    const item = createItem(reward.itemId, 1, 0);
                    if (!targetUser.inventory) targetUser.inventory = [];
                    targetUser.inventory.push(item);
                    await targetUser.save();
                    
                    resultMessage = `🎁 **아이템 지급 완료**\n` +
                        `대상: ${targetUser.nickname}\n` +
                        `아이템: ${rarityEmojis[item.rarity]} ${item.name}`;
                    break;

                case 'ticket':
                    const ticketType = reward.ticketType;
                    const ticketAmount = reward.amount === 'max' ? 999 : parseInt(reward.amount);
                    let actualAmount = 0;
                    
                    if (ticketType === 'all') {
                        const oldHunting = targetUser.huntingTickets || 0;
                        const oldDungeon = targetUser.dungeonTickets || 0;
                        const oldPvp = targetUser.pvpTickets || 0;
                        const oldMinigame = targetUser.minigameTickets || 0;
                        const oldRpsBot = targetUser.rpsGameData?.botTickets || 0;
                        const oldRpsUser = targetUser.rpsGameData?.userTickets || 0;
                        
                        targetUser.huntingTickets = Math.min(20, oldHunting + ticketAmount);
                        targetUser.dungeonTickets = Math.min(5, oldDungeon + ticketAmount);
                        targetUser.pvpTickets = Math.min(20, oldPvp + ticketAmount);
                        targetUser.minigameTickets = Math.min(20, oldMinigame + ticketAmount);
                        
                        if (!targetUser.rpsGameData) targetUser.rpsGameData = {};
                        targetUser.rpsGameData.botTickets = Math.min(20, oldRpsBot + ticketAmount);
                        targetUser.rpsGameData.userTickets = Math.min(20, oldRpsUser + ticketAmount);
                        
                        await targetUser.save();
                        
                        resultMessage = `🎫 **모든 티켓 지급 완료**\n` +
                            `대상: ${targetUser.nickname}\n` +
                            `사냥: ${oldHunting} → ${targetUser.huntingTickets}\n` +
                            `던전: ${oldDungeon} → ${targetUser.dungeonTickets}\n` +
                            `PVP: ${oldPvp} → ${targetUser.pvpTickets}\n` +
                            `미니게임: ${oldMinigame} → ${targetUser.minigameTickets}\n` +
                            `RPS 봇: ${oldRpsBot} → ${targetUser.rpsGameData.botTickets}\n` +
                            `RPS 유저: ${oldRpsUser} → ${targetUser.rpsGameData.userTickets}`;
                    } else {
                        let oldValue = 0;
                        let newValue = 0;
                        let maxValue = 20;
                        
                        switch(ticketType) {
                            case 'hunting':
                                oldValue = targetUser.huntingTickets || 0;
                                targetUser.huntingTickets = Math.min(20, oldValue + ticketAmount);
                                newValue = targetUser.huntingTickets;
                                break;
                            case 'dungeon':
                                oldValue = targetUser.dungeonTickets || 0;
                                maxValue = 5;
                                targetUser.dungeonTickets = Math.min(5, oldValue + ticketAmount);
                                newValue = targetUser.dungeonTickets;
                                break;
                            case 'pvp':
                                oldValue = targetUser.pvpTickets || 0;
                                targetUser.pvpTickets = Math.min(20, oldValue + ticketAmount);
                                newValue = targetUser.pvpTickets;
                                break;
                            case 'minigame':
                                oldValue = targetUser.minigameTickets || 0;
                                targetUser.minigameTickets = Math.min(20, oldValue + ticketAmount);
                                newValue = targetUser.minigameTickets;
                                break;
                            case 'rpsBot':
                                if (!targetUser.rpsGameData) targetUser.rpsGameData = {};
                                oldValue = targetUser.rpsGameData.botTickets || 0;
                                targetUser.rpsGameData.botTickets = Math.min(20, oldValue + ticketAmount);
                                newValue = targetUser.rpsGameData.botTickets;
                                break;
                            case 'rpsUser':
                                if (!targetUser.rpsGameData) targetUser.rpsGameData = {};
                                oldValue = targetUser.rpsGameData.userTickets || 0;
                                targetUser.rpsGameData.userTickets = Math.min(20, oldValue + ticketAmount);
                                newValue = targetUser.rpsGameData.userTickets;
                                break;
                            case 'raid':
                                oldValue = targetUser.raidTickets || 0;
                                maxValue = 3;
                                targetUser.raidTickets = Math.min(3, oldValue + ticketAmount);
                                newValue = targetUser.raidTickets;
                                break;
                        }
                        
                        actualAmount = newValue - oldValue;
                        
                        await targetUser.save();
                        
                        const ticketName = {
                            'hunting': '사냥',
                            'dungeon': '던전',
                            'pvp': 'PVP',
                            'minigame': '미니게임',
                            'rpsBot': 'RPS 봇',
                            'rpsUser': 'RPS 유저',
                            'raid': '레이드'
                        }[ticketType];
                        
                        resultMessage = `🎫 **티켓 지급 완료**\n` +
                            `대상: ${targetUser.nickname}\n` +
                            `종류: ${ticketName} 티켓\n` +
                            `${oldValue} → ${newValue} (+${actualAmount})\n` +
                            `최대: ${maxValue}장`;
                    }
                    break;

                case 'exp':
                    const [action] = reward.expType.split('_');
                    
                    if (action === 'exp') {
                        targetUser.exp += reward.amount;
                        
                        // 레벨업 체크
                        let levelUps = 0;
                        while (targetUser.exp >= targetUser.level * 100) {
                            targetUser.exp -= targetUser.level * 100;
                            targetUser.level++;
                            targetUser.statPoints += 5;
                            levelUps++;
                        }
                        
                        await targetUser.save();
                        
                        resultMessage = `✨ **경험치 지급 완료**\n` +
                            `대상: ${targetUser.nickname}\n` +
                            `경험치: +${formatNumber(reward.amount)} EXP`;
                        if (levelUps > 0) {
                            resultMessage += `\n레벨업: +${levelUps} (현재 Lv.${targetUser.level})`;
                        }
                    } else if (action === 'level') {
                        const oldLevel = targetUser.level;
                        targetUser.level += reward.amount;
                        targetUser.statPoints += reward.amount * 5;
                        await targetUser.save();
                        
                        resultMessage = `📈 **레벨 증가 완료**\n` +
                            `대상: ${targetUser.nickname}\n` +
                            `Lv.${oldLevel} → Lv.${targetUser.level} (+${reward.amount})`;
                    } else if (action === 'set') {
                        const oldLevel = targetUser.level;
                        targetUser.level = reward.amount;
                        targetUser.exp = 0;
                        await targetUser.save();
                        
                        resultMessage = `🎯 **레벨 설정 완료**\n` +
                            `대상: ${targetUser.nickname}\n` +
                            `Lv.${oldLevel} → Lv.${targetUser.level}`;
                    }
                    break;
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ 보상 지급 완료')
                .setDescription(resultMessage)
                .setFooter({ text: `관리자: ${interaction.user.username}` })
                .setTimestamp();

            await interaction.update({
                embeds: [embed],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('admin_reward_menu')
                            .setLabel('🔙 보상 메뉴로')
                            .setStyle(ButtonStyle.Primary)
                    )
                ]
            });

            // 보상 정보 삭제
            this.pendingRewards.delete(adminId);

            // 로그 기록 (나중에 구현)
            console.log(`[관리자 보상] ${interaction.user.username} → ${targetUser.nickname}: ${type} ${JSON.stringify(reward)}`);

        } catch (error) {
            console.error('보상 처리 오류:', error);
            await interaction.reply({
                content: '❌ 보상 처리 중 오류가 발생했습니다.',
                ephemeral: true
            });
        }
    }
}

module.exports = new AdminRewardSelectSystem();