const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const BOSS_FRAGMENTS = require('../../data/bossFragments');

// 조각 교환소 메인 메뉴
async function showFragmentExchangeMenu(interaction) {
    try {
        // defer 처리
        if (!interaction.deferred && !interaction.replied) {
            if (interaction.isButton()) {
                await interaction.deferUpdate();
            } else {
                await interaction.deferReply();
            }
        }
        
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            return await interaction.editReply({ 
                content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
                embeds: [],
                components: []
            });
        }

        // 보유 조각 정리
        const fragmentSummary = {};
        for (const [fragmentId, amount] of user.bossFragments) {
            const [type, , rarity] = fragmentId.split('_');
            if (!fragmentSummary[rarity]) {
                fragmentSummary[rarity] = {};
            }
            fragmentSummary[rarity][type] = amount;
        }

        // 임베드 생성
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💎 보스 조각 교환소')
            .setDescription('보스 레이드에서 획득한 조각을 목걸이로 교환할 수 있습니다.\n각 목걸이는 5종류의 조각을 각각 5개씩 필요로 합니다.')
            .setFooter({ text: '조각 합성: 하위 등급 10개 → 상위 등급 1개' });

        // 보유 조각 표시
        let fragmentText = '';
        for (const [rarityId, rarity] of Object.entries(BOSS_FRAGMENTS.rarities)) {
            const fragments = fragmentSummary[rarityId] || {};
            const typeCount = Object.keys(BOSS_FRAGMENTS.fragmentTypes).map(type => {
                const amount = fragments[type] || 0;
                return `${BOSS_FRAGMENTS.fragmentTypes[type].emoji}${amount}`;
            }).join(' ');
            
            fragmentText += `${rarity.emoji} **${rarity.name}**: ${typeCount}\n`;
        }

        embed.addFields({
            name: '📦 보유 조각',
            value: fragmentText || '보유한 조각이 없습니다.',
            inline: false
        });

        // 교환 가능 목걸이 확인
        const availableNecklaces = [];
        for (const [necklaceId, necklace] of Object.entries(BOSS_FRAGMENTS.necklaces)) {
            if (BOSS_FRAGMENTS.canExchangeNecklace(user.bossFragments, necklaceId)) {
                availableNecklaces.push(necklaceId);
            }
        }

        if (availableNecklaces.length > 0) {
            embed.addFields({
                name: '✅ 교환 가능',
                value: availableNecklaces.map(id => {
                    const necklace = BOSS_FRAGMENTS.necklaces[id];
                    return `${necklace.emoji} ${necklace.name}`;
                }).join('\n'),
                inline: true
            });
        }

        // 현재 장착 목걸이
        if (user.equippedNecklace) {
            embed.addFields({
                name: '📿 장착 중',
                value: user.equippedNecklace.name,
                inline: true
            });
        }

        // 버튼 생성
        const buttons1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('fragment_exchange_list')
                    .setLabel('📿 목걸이 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('fragment_synthesis')
                    .setLabel('🔄 조각 합성')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('fragment_inventory')
                    .setLabel('💎 조각 상세')
                    .setStyle(ButtonStyle.Secondary)
            );

        const buttons2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('boss_raid_menu')
                    .setLabel('👹 보스 레이드')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.editReply({
            embeds: [embed],
            components: [buttons1, buttons2]
        });

    } catch (error) {
        console.error('[Fragment Exchange] Menu error:', error);
        if (!interaction.replied && !interaction.deferred) {
            return await interaction.reply({ 
                content: '❌ 조각 교환소를 표시하는 중 오류가 발생했습니다.', 
                flags: 64 
            });
        }
    }
}

// 목걸이 목록 표시
async function showNecklaceList(interaction) {
    const user = await getUser(interaction.user.id);
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('📿 목걸이 목록')
        .setDescription('각 목걸이의 효과와 필요 조각을 확인하세요.');

    // 등급별 목걸이 표시
    for (const [rarityId, necklace] of Object.entries(BOSS_FRAGMENTS.necklaces)) {
        const rarity = BOSS_FRAGMENTS.rarities[rarityId];
        const canExchange = BOSS_FRAGMENTS.canExchangeNecklace(user.bossFragments, rarityId);
        
        // 스탯 텍스트
        let statsText = '';
        if (necklace.stats.attack) statsText += `공격력 +${necklace.stats.attack}\n`;
        if (necklace.stats.defense) statsText += `방어력 +${necklace.stats.defense}\n`;
        if (necklace.stats.hp) statsText += `HP +${necklace.stats.hp}\n`;
        if (necklace.stats.criticalChance) statsText += `치명타 확률 +${necklace.stats.criticalChance}%\n`;
        if (necklace.stats.goldBonus) statsText += `골드 획득량 +${necklace.stats.goldBonus}%\n`;
        if (necklace.stats.expBonus) statsText += `경험치 획득량 +${necklace.stats.expBonus}%\n`;
        
        embed.addFields({
            name: `${rarity.emoji} ${necklace.name} ${canExchange ? '✅' : '❌'}`,
            value: `${necklace.description}\n\n**효과:**\n${statsText}\n**필요 조각:** 각 종류별 ${rarity.name} 조각 5개`,
            inline: false
        });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('fragment_exchange_select')
        .setPlaceholder('교환할 목걸이를 선택하세요')
        .addOptions(
            Object.entries(BOSS_FRAGMENTS.necklaces).map(([rarityId, necklace]) => ({
                label: necklace.name,
                description: `${BOSS_FRAGMENTS.rarities[rarityId].name} 등급`,
                value: rarityId,
                emoji: necklace.emoji
            }))
        );

    const components = [
        new ActionRowBuilder().addComponents(selectMenu),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('fragment_exchange_menu')
                .setLabel('🔙 교환소 메뉴')
                .setStyle(ButtonStyle.Secondary)
        )
    ];

    return await interaction.update({
        embeds: [embed],
        components: components
    });
}

// 조각 상세 인벤토리
async function showFragmentInventory(interaction) {
    const user = await getUser(interaction.user.id);
    
    const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('💎 조각 인벤토리')
        .setDescription('보유 중인 모든 조각의 상세 정보입니다.');

    // 보스별로 정리
    for (const [typeId, fragmentType] of Object.entries(BOSS_FRAGMENTS.fragmentTypes)) {
        let fragmentList = '';
        let totalFragments = 0;
        
        for (const [rarityId, rarity] of Object.entries(BOSS_FRAGMENTS.rarities)) {
            const fragmentId = BOSS_FRAGMENTS.getFragmentId(typeId, rarityId);
            const amount = user.bossFragments.get(fragmentId) || 0;
            if (amount > 0) {
                fragmentList += `${rarity.emoji} ${rarity.name}: ${amount}개\n`;
                totalFragments += amount;
            }
        }
        
        if (totalFragments > 0) {
            embed.addFields({
                name: `${fragmentType.emoji} ${fragmentType.name} (총 ${totalFragments}개)`,
                value: fragmentList,
                inline: true
            });
        }
    }

    if (embed.data.fields?.length === 0) {
        embed.setDescription('보유한 조각이 없습니다. 보스 레이드에 도전해보세요!');
    }

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('fragment_exchange_menu')
                .setLabel('🔙 교환소 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

// 조각 합성 메뉴
async function showFragmentSynthesis(interaction) {
    const user = await getUser(interaction.user.id);
    
    const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🔄 조각 합성')
        .setDescription(`하위 등급 조각 ${BOSS_FRAGMENTS.synthesis.ratio}개를 상위 등급 1개로 합성할 수 있습니다.`);

    // 합성 가능한 조각 확인
    const synthesisOptions = [];
    const rarityOrder = ['common', 'rare', 'epic', 'unique'];
    
    for (let i = 0; i < rarityOrder.length; i++) {
        const currentRarity = rarityOrder[i];
        const nextRarity = rarityOrder[i + 1];
        if (!nextRarity) break;
        
        for (const [typeId, fragmentType] of Object.entries(BOSS_FRAGMENTS.fragmentTypes)) {
            const fragmentId = BOSS_FRAGMENTS.getFragmentId(typeId, currentRarity);
            const amount = user.bossFragments.get(fragmentId) || 0;
            
            if (amount >= BOSS_FRAGMENTS.synthesis.ratio) {
                synthesisOptions.push({
                    type: typeId,
                    fromRarity: currentRarity,
                    toRarity: nextRarity,
                    available: Math.floor(amount / BOSS_FRAGMENTS.synthesis.ratio)
                });
            }
        }
    }

    if (synthesisOptions.length === 0) {
        embed.addFields({
            name: '❌ 합성 불가',
            value: '합성 가능한 조각이 없습니다.',
            inline: false
        });
    } else {
        const optionText = synthesisOptions.map(opt => {
            const fragmentType = BOSS_FRAGMENTS.fragmentTypes[opt.type];
            const fromRarity = BOSS_FRAGMENTS.rarities[opt.fromRarity];
            const toRarity = BOSS_FRAGMENTS.rarities[opt.toRarity];
            
            return `${fragmentType.emoji} ${fragmentType.name}: ${fromRarity.emoji} → ${toRarity.emoji} (${opt.available}회 가능)`;
        }).join('\n');
        
        embed.addFields({
            name: '✅ 합성 가능',
            value: optionText,
            inline: false
        });
    }

    let components = [];
    
    if (synthesisOptions.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('fragment_synthesis_select')
            .setPlaceholder('합성할 조각을 선택하세요')
            .addOptions(
                synthesisOptions.map(opt => {
                    const fragmentType = BOSS_FRAGMENTS.fragmentTypes[opt.type];
                    const fromRarity = BOSS_FRAGMENTS.rarities[opt.fromRarity];
                    const toRarity = BOSS_FRAGMENTS.rarities[opt.toRarity];
                    
                    return {
                        label: `${fragmentType.name} ${fromRarity.name} → ${toRarity.name}`,
                        description: `${opt.available}회 합성 가능`,
                        value: `${opt.type}_${opt.fromRarity}_${opt.toRarity}`,
                        emoji: fragmentType.emoji
                    };
                })
            );
        
        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    components.push(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('fragment_exchange_menu')
                .setLabel('🔙 교환소 메뉴')
                .setStyle(ButtonStyle.Secondary)
        )
    );

    return await interaction.update({
        embeds: [embed],
        components: components
    });
}

// 목걸이 교환 처리
async function exchangeNecklace(interaction, necklaceId) {
    const user = await getUser(interaction.user.id);
    const necklace = BOSS_FRAGMENTS.necklaces[necklaceId];
    
    if (!necklace) {
        return await interaction.reply({
            content: '❌ 존재하지 않는 목걸이입니다.',
            flags: 64
        });
    }
    
    // 재료 확인
    if (!BOSS_FRAGMENTS.canExchangeNecklace(user.bossFragments, necklaceId)) {
        return await interaction.reply({
            content: '❌ 필요한 조각이 부족합니다.',
            flags: 64
        });
    }
    
    // 조각 차감
    for (const [fragmentId, requiredAmount] of Object.entries(necklace.requirements)) {
        const currentAmount = user.bossFragments.get(fragmentId) || 0;
        user.bossFragments.set(fragmentId, currentAmount - requiredAmount);
    }
    
    // 목걸이 장착
    user.equippedNecklace = {
        id: necklace.id,
        name: necklace.name,
        stats: necklace.stats
    };
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ 교환 성공!')
        .setDescription(`${necklace.emoji} **${necklace.name}**을(를) 획득하고 장착했습니다!`)
        .addFields({
            name: '📊 능력치',
            value: Object.entries(necklace.stats).map(([stat, value]) => {
                const statNames = {
                    attack: '공격력',
                    defense: '방어력',
                    hp: 'HP',
                    criticalChance: '치명타 확률',
                    goldBonus: '골드 획득량',
                    expBonus: '경험치 획득량'
                };
                return `${statNames[stat]}: +${value}${stat.includes('Bonus') || stat.includes('Chance') ? '%' : ''}`;
            }).join('\n'),
            inline: false
        });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('fragment_exchange_menu')
                .setLabel('🔙 교환소 메뉴')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('profile')
                .setLabel('👤 프로필 확인')
                .setStyle(ButtonStyle.Success)
        );
    
    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

// 조각 합성 처리
async function synthesizeFragments(interaction, synthesisData) {
    const [type, fromRarity, toRarity] = synthesisData.split('_');
    const user = await getUser(interaction.user.id);
    
    const fromFragmentId = BOSS_FRAGMENTS.getFragmentId(type, fromRarity);
    const toFragmentId = BOSS_FRAGMENTS.getFragmentId(type, toRarity);
    
    const currentAmount = user.bossFragments.get(fromFragmentId) || 0;
    const requiredAmount = BOSS_FRAGMENTS.synthesis.ratio;
    
    if (currentAmount < requiredAmount) {
        return await interaction.reply({
            content: '❌ 합성에 필요한 조각이 부족합니다.',
            flags: 64
        });
    }
    
    // 조각 차감 및 추가
    user.bossFragments.set(fromFragmentId, currentAmount - requiredAmount);
    const newAmount = (user.bossFragments.get(toFragmentId) || 0) + 1;
    user.bossFragments.set(toFragmentId, newAmount);
    
    await user.save();
    
    const fragmentType = BOSS_FRAGMENTS.fragmentTypes[type];
    const fromRarityData = BOSS_FRAGMENTS.rarities[fromRarity];
    const toRarityData = BOSS_FRAGMENTS.rarities[toRarity];
    
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ 합성 성공!')
        .setDescription(
            `${fragmentType.emoji} **${fragmentType.name}** 합성 완료!\n\n` +
            `${fromRarityData.emoji} ${fromRarityData.name} ${requiredAmount}개 → ${toRarityData.emoji} ${toRarityData.name} 1개`
        );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('fragment_synthesis')
                .setLabel('🔄 추가 합성')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('fragment_exchange_menu')
                .setLabel('🔙 교환소 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

// 인터랙션 핸들러
async function handleFragmentExchangeInteraction(interaction) {
    const customId = interaction.customId;
    
    if (customId === 'fragment_exchange' || customId === 'fragment_exchange_menu') {
        return await showFragmentExchangeMenu(interaction);
    }
    else if (customId === 'fragment_exchange_list') {
        return await showNecklaceList(interaction);
    }
    else if (customId === 'fragment_inventory') {
        return await showFragmentInventory(interaction);
    }
    else if (customId === 'fragment_synthesis') {
        return await showFragmentSynthesis(interaction);
    }
    else if (interaction.isStringSelectMenu()) {
        if (customId === 'fragment_exchange_select') {
            const necklaceId = interaction.values[0];
            return await exchangeNecklace(interaction, necklaceId);
        }
        else if (customId === 'fragment_synthesis_select') {
            const synthesisData = interaction.values[0];
            return await synthesizeFragments(interaction, synthesisData);
        }
    }
}

module.exports = {
    showFragmentExchangeMenu,
    handleFragmentExchangeInteraction
};