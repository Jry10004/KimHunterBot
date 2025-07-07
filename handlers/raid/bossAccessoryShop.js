const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const BOSS_REWARDS = require('../../data/bossRewards');
const BOSS_ACCESSORIES = require('../../data/bossAccessories');
const { getUser, formatNumber } = require('../common/utils');

// 보스 장신구 상점 메인 메뉴
async function showAccessoryShopMenu(interaction) {
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
                const bossMap = {
                    'goblin': 'goblin_chief',
                    'skeleton': 'skeleton_lord',
                    'shadow': 'shadow_assassin',
                    'earth': 'earth_golem',
                    'frost': 'frost_witch',
                    'fire': 'fire_dragon',
                    'demon': 'demon_lord'
                };
                
                const bossToken = Object.values(BOSS_REWARDS.tokens).find(t => t.boss === bossMap[boss.id]);
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
            .setCustomId('accessory_shop_set')
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
        console.error('[Accessory Shop] Menu error:', error);
        return await interaction.editReply({ 
            content: '❌ 장신구 상점을 표시하는 중 오류가 발생했습니다.', 
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
            .setCustomId('accessory_shop_item')
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
        console.error('[Accessory Shop] Set error:', error);
        return await interaction.editReply({ 
            content: '❌ 세트를 표시하는 중 오류가 발생했습니다.', 
            embeds: [],
            components: []
        });
    }
}

// 장신구 구매 확인
async function confirmAccessoryPurchase(interaction, itemData) {
    try {
        await interaction.deferUpdate();

        const [setId, slotType] = itemData.split('_');
        const setData = BOSS_ACCESSORIES.sets[setId];
        const item = setData?.items[slotType];

        if (!item || !setData) {
            return await interaction.editReply({
                content: '❌ 존재하지 않는 장신구입니다.',
                embeds: [],
                components: []
            });
        }

        const user = await getUser(interaction.user.id);
        const userTokens = {};
        user.bossTokens.forEach((amount, tokenId) => {
            userTokens[tokenId] = amount;
        });

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
        const cost = BOSS_ACCESSORIES.tokenCosts[setData.tier][slotType];
        const canPurchase = tokenAmount >= cost;

        // 장신구 상세 정보 임베드
        const embed = new EmbedBuilder()
            .setColor(canPurchase ? '#00FF00' : '#FF0000')
            .setTitle(`${item.emoji} ${item.name}`)
            .setDescription(`**${setData.name} 세트**\n${item.description}`);

        // 스탯 표시
        let statsText = '';
        for (const [stat, value] of Object.entries(item.stats)) {
            const statNames = {
                goldBonus: '💰 골드 획득률',
                luck: '🍀 행운',
                dropRate: '🎁 드롭률',
                attack: '⚔️ 공격력',
                shopBonus: '🏪 상점 판매가',
                speed: '💨 이동속도',
                dungeonReward: '🏰 던전 보상',
                dodge: '🏃 회피',
                resurrect: '👼 부활',
                hp: '❤️ 체력',
                hpRegen: '💚 HP 재생',
                defense: '🛡️ 방어력',
                damageReduction: '🛡️ 데미지 감소',
                stunResist: '💫 기절 저항',
                pvpDefense: '⚔️ PVP 방어력',
                mp: '🔮 MP',
                criticalChance: '💥 치명타 확률',
                criticalDamage: '💥 치명타 데미지',
                pvpDamage: '⚔️ PVP 데미지',
                firstStrike: '🥊 선공 확률',
                skillCooldown: '⏰ 스킬 쿨타임',
                nightBonus: '🌙 밤 시간 보너스',
                energyRegen: '⚡ 에너지 재생',
                miningBonus: '⛏️ 채굴 보너스',
                blockChance: '🛡️ 블록 확률',
                thorns: '🌹 반사 데미지',
                knockbackResist: '🌪️ 넉백 저항',
                energyEfficiency: '⚡ 에너지 효율',
                fragmentBonus: '💎 조각 획득',
                intelligence: '🧠 지능',
                freezeChance: '❄️ 빙결 확률',
                slowEffect: '🐢 속도 감소',
                magicDamage: '🔮 마법 공격력',
                iceShield: '🧊 얼음 방패',
                mpRegen: '🔮 MP 재생',
                weatherBonus: '🌦️ 날씨 보너스',
                fishingBonus: '🎣 낚시 성공률',
                burnDamage: '🔥 화상 데미지',
                attackSpeed: '⚔️ 공격속도',
                burnChance: '🔥 화상 확률',
                penetration: '🗡️ 방어력 관통',
                burnSpread: '🔥 화상 전파',
                combatRegen: '⚔️ 전투 중 회복',
                berserker: '😡 버서커',
                explosionDamage: '💥 폭발 데미지',
                enhanceSuccess: '🔨 강화 성공률',
                allStats: '📊 모든 스탯',
                bossDamage: '👹 보스 데미지',
                lifesteal: '🩸 흡혈',
                killRegen: '💀 처치 회복',
                executeDamage: '☠️ 처형 데미지',
                multiStrike: '⚔️ 다중 타격',
                bossDefense: '👹 보스 방어력',
                darkPower: '🌙 어둠 속성',
                darkShield: '🌙 어둠 보호막',
                expBonus: '⭐ 경험치 보너스',
                intimidation: '😨 위협',
                stealthDuration: '🥷 은신 지속시간',
                criticalSteal: '🩸 치명타 흡혈',
                gatheringSpeed: '⛏️ 채집 속도',
                miningSpeed: '⛏️ 채굴 속도',
                oreBonus: '💎 광석 보너스',
                frozenDuration: '❄️ 빙결 지속시간',
                shield: '🛡️ 보호막',
                spellPower: '🔮 특수 공격력',
                shieldRegen: '🛡️ 보호막 재생'
            };
            statsText += `${statNames[stat] || stat}: +${value}${stat.includes('Bonus') || stat.includes('Rate') || stat.includes('Chance') || stat.includes('Resist') ? '%' : ''}\n`;
        }
        embed.addFields({ name: '📊 능력치', value: statsText, inline: false });

        // 비용 표시
        embed.addFields({ 
            name: '💰 비용', 
            value: `${bossToken?.emoji || '🪙'} ${bossToken?.name || '토큰'}: ${tokenAmount}/${cost}개`, 
            inline: true 
        });

        // 세트 효과 미리보기
        embed.addFields({
            name: '🏆 세트 효과 미리보기',
            value: `2세트, 3세트, 4세트 착용 시 추가 효과가 발동합니다.`,
            inline: false
        });

        const buttons = new ActionRowBuilder();
        
        if (canPurchase) {
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`accessory_buy_${itemData}`)
                    .setLabel('💳 구매하기')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );
        }

        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`accessory_set_${setId}`)
                .setLabel('🔙 세트 목록')
                .setStyle(ButtonStyle.Secondary)
        );

        return await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('[Accessory Shop] Confirm error:', error);
        return await interaction.editReply({ 
            content: '❌ 장신구 정보를 표시하는 중 오류가 발생했습니다.', 
            embeds: [],
            components: []
        });
    }
}

// 장신구 구매 처리
async function processPurchase(interaction, itemData) {
    try {
        await interaction.deferUpdate();

        const [setId, slotType] = itemData.split('_');
        const setData = BOSS_ACCESSORIES.sets[setId];
        const item = setData?.items[slotType];

        if (!item || !setData) {
            return await interaction.editReply({
                content: '❌ 존재하지 않는 장신구입니다.',
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
        const cost = BOSS_ACCESSORIES.tokenCosts[setData.tier][slotType];

        if (tokenAmount < cost) {
            return await interaction.editReply({
                content: '❌ 토큰이 부족합니다!',
                embeds: [],
                components: []
            });
        }

        // 토큰 차감
        user.bossTokens.set(bossToken.id, tokenAmount - cost);

        // 장신구 인벤토리에 추가
        if (!user.accessoryInventory) user.accessoryInventory = [];
        
        const newAccessory = {
            id: item.id,
            name: item.name,
            emoji: item.emoji,
            slotType: item.slotType,
            setId: setId,
            setName: setData.name,
            tier: setData.tier,
            stats: item.stats,
            description: item.description,
            obtainedAt: new Date()
        };

        user.accessoryInventory.push(newAccessory);
        await user.save();

        const successEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ 구매 완료!')
            .setDescription(`${item.emoji} **${item.name}**을(를) 구매했습니다!`)
            .addFields(
                { name: '세트', value: setData.name, inline: true },
                { name: '타입', value: item.slotType, inline: true }
            )
            .setFooter({ text: '장신구 인벤토리에서 장착할 수 있습니다.' })
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('accessory_inventory')
                    .setLabel('🎒 장신구 인벤토리')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('boss_token_shop')
                    .setLabel('🛍️ 상점으로')
                    .setStyle(ButtonStyle.Secondary),
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
        console.error('[Accessory Shop] Purchase error:', error);
        return await interaction.editReply({ 
            content: '❌ 구매 처리 중 오류가 발생했습니다.', 
            embeds: [],
            components: []
        });
    }
}

// 인터랙션 핸들러
async function handleAccessoryShopInteraction(interaction) {
    const customId = interaction.customId;

    if (customId === 'boss_token_shop') {
        return await showAccessoryShopMenu(interaction);
    }
    else if (customId === 'accessory_shop_set') {
        const setId = interaction.values[0];
        return await showSetAccessories(interaction, setId);
    }
    else if (customId === 'accessory_shop_item') {
        const itemData = interaction.values[0];
        return await confirmAccessoryPurchase(interaction, itemData);
    }
    else if (customId.startsWith('accessory_buy_')) {
        const itemData = customId.replace('accessory_buy_', '');
        return await processPurchase(interaction, itemData);
    }
    else if (customId.startsWith('accessory_set_')) {
        const setId = customId.replace('accessory_set_', '');
        return await showSetAccessories(interaction, setId);
    }
}

module.exports = {
    showAccessoryShopMenu,
    handleAccessoryShopInteraction
};