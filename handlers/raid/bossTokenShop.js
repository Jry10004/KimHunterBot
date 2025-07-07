const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const BOSS_REWARDS = require('../../data/bossRewards');
const BOSS_ACCESSORIES = require('../../data/bossAccessories');
const { getUser, formatNumber } = require('../common/utils');

// 토큰 상점 메인 메뉴 (장신구 세트 전용)
async function showTokenShopMenu(interaction) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            if (interaction.isButton()) {
                await interaction.deferUpdate();
            } else {
                await interaction.deferReply();
            }
        }

        const user = await getUser(interaction.user.id);
        if (!user) {
            return await interaction.editReply({ 
                content: '먼저 회원가입을 해주세요!',
                embeds: [],
                components: []
            });
        }

        // 유저 토큰 정보 가져오기
        const userTokens = {};
        user.bossTokens.forEach((amount, tokenId) => {
            userTokens[tokenId] = amount;
        });

        // 토큰 보유 현황 생성
        let tokenDisplay = '';
        let totalTokens = 0;
        for (const [tokenId, tokenData] of Object.entries(BOSS_REWARDS.tokens)) {
            const amount = userTokens[tokenData.id] || 0;
            if (amount > 0) {
                tokenDisplay += `${tokenData.emoji} ${tokenData.name}: ${amount}개\n`;
                totalTokens += amount;
            }
        }

        if (!tokenDisplay) {
            tokenDisplay = '보유한 토큰이 없습니다.';
        }

        // 현재 장착된 세트 확인
        const equippedSets = {};
        if (user.equippedAccessories) {
            Object.values(user.equippedAccessories).forEach(item => {
                if (item && item.setId) {
                    equippedSets[item.setId] = (equippedSets[item.setId] || 0) + 1;
                }
            });
        }

        let setDisplay = '';
        Object.entries(equippedSets).forEach(([setId, count]) => {
            const setData = BOSS_ACCESSORIES.sets[setId];
            if (setData) {
                setDisplay += `${setData.name} (${count}/4개)\n`;
            }
        });

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💎 보스 장신구 상점')
            .setDescription('보스별 테마 장신구 세트를 구매할 수 있습니다.')
            .addFields(
                { 
                    name: '🪙 보유 토큰', 
                    value: tokenDisplay,
                    inline: true 
                },
                {
                    name: '💍 장착 중인 세트',
                    value: setDisplay || '장착된 세트가 없습니다.',
                    inline: true
                }
            )
            .setFooter({ text: '보스를 선택하여 해당 세트를 확인하세요.' })
            .setTimestamp();

        // 보스별 세트 옵션 생성
        const setOptions = [];
        const bossSets = [
            { id: 'goblin', emoji: '👺', tier: 1 },
            { id: 'skeleton', emoji: '💀', tier: 1 },
            { id: 'shadow', emoji: '🌑', tier: 2 },
            { id: 'earth', emoji: '🪨', tier: 2 },
            { id: 'frost', emoji: '❄️', tier: 3 },
            { id: 'fire', emoji: '🔥', tier: 3 },
            { id: 'demon', emoji: '👹', tier: 4 }
        ];

        for (const boss of bossSets) {
            const setData = BOSS_ACCESSORIES.sets[boss.id];
            if (setData) {
                // 해당 보스 토큰 보유량 확인
                const bossToken = Object.values(BOSS_REWARDS.tokens).find(t => t.boss === boss.id + '_' + (boss.id === 'goblin' ? 'chief' : boss.id === 'skeleton' ? 'lord' : boss.id === 'shadow' ? 'assassin' : boss.id === 'earth' ? 'golem' : boss.id === 'frost' ? 'witch' : boss.id === 'fire' ? 'dragon' : 'lord'));
                const tokenAmount = bossToken ? (userTokens[bossToken.id] || 0) : 0;
                
                setOptions.push({
                    label: setData.name,
                    description: `${setData.theme} (보유 토큰: ${tokenAmount}개)`,
                    value: boss.id,
                    emoji: boss.emoji
                });
            }
        }

        const setSelect = new StringSelectMenuBuilder()
            .setCustomId('token_shop_set')
            .setPlaceholder('보스 세트 선택')
            .addOptions(setOptions);

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('accessory_inventory')
                    .setLabel('🎒 장신구 인벤토리')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('boss_raid_menu')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(setSelect),
                buttons
            ]
        });
    } catch (error) {
        console.error('[Token Shop] Menu error:', error);
        return await interaction.editReply({ 
            content: '❌ 토큰 상점을 표시하는 중 오류가 발생했습니다.', 
            embeds: [],
            components: []
        });
    }
}

// 세트별 장신구 표시
async function showSetAccessories(interaction, setId) {
    try {
        await interaction.deferUpdate();

        const user = await getUser(interaction.user.id);
        const userTokens = {};
        user.bossTokens.forEach((amount, tokenId) => {
            userTokens[tokenId] = amount;
        });

        const setData = BOSS_ACCESSORIES.sets[setId];
        if (!setData) {
            return await interaction.editReply({
                content: '❌ 존재하지 않는 세트입니다.',
                embeds: [],
                components: []
            });
        }

        // 세트 효과 계산
        const setBonus = BOSS_ACCESSORIES.calculateSetBonus(user.equippedAccessories || {});

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`${setData.emoji || '💎'} ${setData.name} 세트`)
            .setDescription(`${setData.theme}\n\n**세트 효과:**`)
            .setTimestamp();

        // 세트 효과 표시
        if (BOSS_ACCESSORIES.setEffects[2][setId]) {
            let effect2 = '**2세트:** ';
            Object.entries(BOSS_ACCESSORIES.setEffects[2][setId]).forEach(([stat, value]) => {
                effect2 += `${stat}: +${value} `;
            });
            embed.addFields({ name: '2️⃣ 2세트 효과', value: effect2, inline: false });
        }

        if (BOSS_ACCESSORIES.setEffects[3][setId]) {
            let effect3 = '**3세트:** ';
            Object.entries(BOSS_ACCESSORIES.setEffects[3][setId]).forEach(([stat, value]) => {
                effect3 += `${stat}: +${value} `;
            });
            embed.addFields({ name: '3️⃣ 3세트 효과', value: effect3, inline: false });
        }

        if (BOSS_ACCESSORIES.setEffects[4][setId]) {
            const effect4 = BOSS_ACCESSORIES.setEffects[4][setId];
            embed.addFields({ 
                name: '4️⃣ 4세트 효과', 
                value: `**${effect4.ability}:** ${effect4.description}`, 
                inline: false 
            });
        }

        // 아이템 목록 생성
        const itemOptions = [];
        const tier = setData.tier;
        const tokenCosts = BOSS_ACCESSORIES.tokenCosts[tier];
        
        // 해당 보스 토큰 찾기
        const bossMap = {
            'goblin': 'goblin_chief',
            'skeleton': 'skeleton_lord',
            'shadow': 'shadow_assassin',
            'earth': 'earth_golem',
            'frost': 'frost_witch',
            'fire': 'fire_dragon',
            'demon': 'demon_lord'
        };
        
        const bossToken = Object.values(BOSS_REWARDS.tokens).find(t => t.boss === bossMap[setId]);
        const tokenAmount = bossToken ? (userTokens[bossToken.id] || 0) : 0;

        // 각 아이템 표시
        ['ring', 'necklace', 'bracelet', 'earring'].forEach(slotType => {
            const item = setData.items[slotType];
            const cost = tokenCosts[slotType];
            const canPurchase = tokenAmount >= cost;

            let statsText = '';
            Object.entries(item.stats).forEach(([stat, value]) => {
                statsText += `${stat}: +${value}\n`;
            });

            embed.addFields({
                name: `${item.emoji} ${item.name}`,
                value: `${item.description}\n**능력치:** ${statsText}**비용:** ${bossToken?.emoji || '🪙'} ${cost}개\n${canPurchase ? '✅ 구매 가능' : `❌ 토큰 부족 (${tokenAmount}/${cost})`}`,
                inline: true
            });

            itemOptions.push({
                label: item.name,
                description: `${bossToken?.name || '토큰'} ${cost}개`,
                value: `${setId}_${slotType}`,
                emoji: item.emoji
            });
        });

        const itemSelect = new StringSelectMenuBuilder()
            .setCustomId('token_shop_accessory')
            .setPlaceholder('구매할 장신구 선택')
            .addOptions(itemOptions);

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('boss_token_shop')
                    .setLabel('🔙 세트 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(itemSelect),
                buttons
            ]
        });
    } catch (error) {
        console.error('[Token Shop] Category error:', error);
        return await interaction.editReply({ 
            content: '❌ 카테고리를 표시하는 중 오류가 발생했습니다.', 
            embeds: [],
            components: []
        });
    }
}

// 아이템 구매 확인
async function confirmPurchase(interaction, itemData) {
    try {
        await interaction.deferUpdate();

        const [category, indexStr] = itemData.split('_');
        const index = parseInt(indexStr);
        const item = BOSS_REWARDS.shopItems[category][index];

        if (!item) {
            return await interaction.editReply({
                content: '❌ 존재하지 않는 아이템입니다.',
                embeds: [],
                components: []
            });
        }

        const user = await getUser(interaction.user.id);
        const userTokens = {};
        user.bossTokens.forEach((amount, tokenId) => {
            userTokens[tokenId] = amount;
        });

        const canPurchase = BOSS_REWARDS.canPurchase(userTokens, item);

        // 아이템 상세 정보 임베드
        const embed = new EmbedBuilder()
            .setColor(canPurchase ? '#00FF00' : '#FF0000')
            .setTitle(`${item.emoji} ${item.name}`)
            .setDescription(item.description);

        // 스탯 표시
        if (item.stats) {
            let statsText = '';
            for (const [stat, value] of Object.entries(item.stats)) {
                const statNames = {
                    attack: '⚔️ 공격력',
                    defense: '🛡️ 방어력',
                    hp: '❤️ 체력',
                    critical: '💥 치명타',
                    speed: '💨 속도',
                    dodge: '🏃 회피',
                    luck: '🍀 행운',
                    all_stats: '📊 모든 스탯',
                    regen: '💚 재생'
                };
                statsText += `${statNames[stat] || stat}: +${value}\n`;
            }
            embed.addFields({ name: '📊 능력치', value: statsText, inline: true });
        }

        // 효과 표시
        if (item.effect) {
            let effectText = '';
            for (const [effect, value] of Object.entries(item.effect)) {
                if (effect === 'title') effectText += `칭호: "${value}"\n`;
                else if (effect === 'boss_damage') effectText += `보스 추가 데미지: +${value}%\n`;
                else if (effect === 'speed') effectText += `이동 속도: +${value}%\n`;
                else if (effect === 'companion') effectText += `동료 펫 획득\n`;
                else if (effect === 'stats_boost') effectText += `모든 스탯: +${value}%\n`;
                else if (effect === 'hp_restore') effectText += `체력 회복: ${value}\n`;
                else if (effect === 'buff_duration') effectText += `버프 지속: ${value/3600}시간\n`;
                else if (effect === 'attack_boost') effectText += `공격력 증가: +${value}%\n`;
                else if (effect === 'defense_boost') effectText += `방어력 증가: +${value}%\n`;
                else if (effect === 'exp_boost') effectText += `경험치 증가: +${value}%\n`;
                else if (effect === 'gold_boost') effectText += `골드 증가: +${value}%\n`;
                else if (effect === 'duration') effectText += `지속 시간: ${value/3600}시간\n`;
            }
            embed.addFields({ name: '✨ 효과', value: effectText, inline: true });
        }

        // 비용 표시
        let costText = '';
        if (item.cost.token_type === 'any') {
            costText = `티어 ${item.cost.tier} 이상 토큰 ${item.cost.amount}개`;
            
            // 사용 가능한 토큰 표시
            let availableTokens = '';
            for (const [tokenId, amount] of Object.entries(userTokens)) {
                const token = Object.values(BOSS_REWARDS.tokens).find(t => t.id === tokenId);
                if (token && token.tier >= item.cost.tier && amount > 0) {
                    availableTokens += `${token.emoji} ${token.name}: ${amount}개\n`;
                }
            }
            if (availableTokens) {
                embed.addFields({ name: '🪙 사용 가능 토큰', value: availableTokens, inline: false });
            }
        } else {
            costText = item.cost.tokens.map(t => {
                const tokenData = Object.values(BOSS_REWARDS.tokens).find(tok => tok.id === t.id);
                const userAmount = userTokens[t.id] || 0;
                return `${tokenData.emoji} ${tokenData.name}: ${userAmount}/${t.amount}개`;
            }).join('\n');
        }
        embed.addFields({ name: '💰 비용', value: costText, inline: false });

        const buttons = new ActionRowBuilder();
        
        if (canPurchase) {
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`token_buy_${itemData}`)
                    .setLabel('💳 구매하기')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );
        }

        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`token_category_${category}`)
                .setLabel('🔙 목록으로')
                .setStyle(ButtonStyle.Secondary)
        );

        return await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('[Token Shop] Confirm error:', error);
        return await interaction.editReply({ 
            content: '❌ 아이템 정보를 표시하는 중 오류가 발생했습니다.', 
            embeds: [],
            components: []
        });
    }
}

// 아이템 구매 처리
async function processPurchase(interaction, itemData) {
    try {
        await interaction.deferUpdate();

        const [category, indexStr] = itemData.split('_');
        const index = parseInt(indexStr);
        const item = BOSS_REWARDS.shopItems[category][index];

        if (!item) {
            return await interaction.editReply({
                content: '❌ 존재하지 않는 아이템입니다.',
                embeds: [],
                components: []
            });
        }

        const user = await getUser(interaction.user.id);
        
        // 토큰 확인
        const userTokens = {};
        user.bossTokens.forEach((amount, tokenId) => {
            userTokens[tokenId] = amount;
        });

        if (!BOSS_REWARDS.canPurchase(userTokens, item)) {
            return await interaction.editReply({
                content: '❌ 토큰이 부족합니다!',
                embeds: [],
                components: []
            });
        }

        // 토큰 차감
        if (item.cost.token_type === 'any') {
            // 티어별로 차감 (높은 티어부터)
            let remaining = item.cost.amount;
            const sortedTokens = Object.entries(BOSS_REWARDS.tokens)
                .filter(([_, token]) => token.tier >= item.cost.tier)
                .sort((a, b) => b[1].tier - a[1].tier);

            for (const [_, token] of sortedTokens) {
                if (remaining <= 0) break;
                const userAmount = user.bossTokens.get(token.id) || 0;
                if (userAmount > 0) {
                    const deduct = Math.min(userAmount, remaining);
                    user.bossTokens.set(token.id, userAmount - deduct);
                    remaining -= deduct;
                }
            }
        } else {
            // 특정 토큰 차감
            for (const req of item.cost.tokens) {
                const current = user.bossTokens.get(req.id) || 0;
                user.bossTokens.set(req.id, current - req.amount);
            }
        }

        // 아이템 지급
        if (!user.inventory) user.inventory = [];
        
        const newItem = {
            id: item.id,
            name: item.name,
            emoji: item.emoji,
            type: item.type,
            tier: item.tier,
            stats: item.stats || {},
            effect: item.effect || {},
            quantity: 1,
            obtainedAt: new Date()
        };

        // 소모품인 경우 수량 증가
        if (item.type === 'consumable') {
            const existingItem = user.inventory.find(i => i.id === item.id);
            if (existingItem) {
                existingItem.quantity = (existingItem.quantity || 1) + 1;
            } else {
                user.inventory.push(newItem);
            }
        } else {
            user.inventory.push(newItem);
        }

        await user.save();

        const successEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ 구매 완료!')
            .setDescription(`${item.emoji} **${item.name}**을(를) 구매했습니다!`)
            .setFooter({ text: '인벤토리에서 확인할 수 있습니다.' })
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('boss_token_shop')
                    .setLabel('🛍️ 상점으로')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('boss_raid_menu')
                    .setLabel('🔙 보스 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.editReply({
            embeds: [successEmbed],
            components: [buttons]
        });
    } catch (error) {
        console.error('[Token Shop] Purchase error:', error);
        return await interaction.editReply({ 
            content: '❌ 구매 처리 중 오류가 발생했습니다.', 
            embeds: [],
            components: []
        });
    }
}

// 인터랙션 핸들러
async function handleTokenShopInteraction(interaction) {
    const customId = interaction.customId;

    if (customId === 'boss_token_shop') {
        return await showTokenShopMenu(interaction);
    }
    else if (customId === 'token_shop_category') {
        const category = interaction.values[0];
        return await showCategoryItems(interaction, category);
    }
    else if (customId === 'token_shop_item') {
        const itemData = interaction.values[0];
        return await confirmPurchase(interaction, itemData);
    }
    else if (customId.startsWith('token_buy_')) {
        const itemData = customId.replace('token_buy_', '');
        return await processPurchase(interaction, itemData);
    }
    else if (customId.startsWith('token_category_')) {
        const category = customId.replace('token_category_', '');
        return await showCategoryItems(interaction, category);
    }
}

module.exports = {
    showTokenShopMenu,
    handleTokenShopInteraction
};