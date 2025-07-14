const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const randomItemGenerator = require('../../systems/randomItemGenerator');
const randomItemData = require('../../data/randomItemData');
const { getUser } = require('../common/utils');
const MissionHelper = require('../../utils/missionHelper');

// 랜덤 상점 메인
async function showRandomShop(interaction) {
    const user = await getUser(interaction.user.id);
    
    if (!user || !user.registered) {
        return await interaction.reply({
            content: '❌ 먼저 `/가입` 명령어로 가입해주세요!',
            flags: 64
        });
    }

    // 뽑기 선택 메뉴
    const gachaEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎰 랜덤 아이템 뽑기')
        .setDescription('완전 랜덤으로 생성되는 아이템!\n이름도 랜덤! 옵션도 랜덤!\n어떤 아이템이 나올지는 아무도 몰라요!')
        .addFields(
            {
                name: '🍀 행운의 뽑기',
                value: `가격: 30,000G\n레전드리 확률: 0.5%\n초보자 추천!`,
                inline: true
            },
            {
                name: '🎯 도전자의 뽑기',
                value: `가격: 100,000G\n레전드리 확률: 1%\n균형잡힌 선택!`,
                inline: true
            },
            {
                name: '💎 전설의 뽑기',
                value: `가격: 500,000G\n레전드리 확률: 2%\n부자들의 선택!`,
                inline: true
            }
        )
        .addFields(
            {
                name: '💰 보유 골드',
                value: `${user.gold.toLocaleString()}G`,
                inline: false
            }
        )
        .setFooter({ text: '⚠️ 이름이 레전드리여도 옵션이 최하일 수 있습니다!' });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('random_gacha_lucky')
                .setLabel('🍀 행운의 뽑기 (3만G)')
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.gold < 30000),
            new ButtonBuilder()
                .setCustomId('random_gacha_challenger')
                .setLabel('🎯 도전자의 뽑기 (10만G)')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.gold < 100000),
            new ButtonBuilder()
                .setCustomId('random_gacha_legend')
                .setLabel('💎 전설의 뽑기 (50만G)')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(user.gold < 500000)
        );

    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('shop')
                .setLabel('🔙 상점 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.update({
        embeds: [gachaEmbed],
        components: [buttons, backButton]
    });
}

// 뽑기 실행
async function executeGacha(interaction, gachaType) {
    const user = await getUser(interaction.user.id);
    const gachaInfo = randomItemData.gachaRates[gachaType];
    
    // 골드 확인
    if (user.gold < gachaInfo.price) {
        return await interaction.reply({
            content: '❌ 골드가 부족합니다!',
            flags: 64
        });
    }
    
    // 골드 차감
    user.gold -= gachaInfo.price;
    
    // 아이템 생성
    const item = randomItemGenerator.generateItem(gachaType);
    
    // 결과 애니메이션
    const rollingEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎰 뽑기 중...')
        .setDescription('두근두근... 어떤 아이템이 나올까요?')
        .setImage('https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif');

    await interaction.update({
        embeds: [rollingEmbed],
        components: []
    });

    // 3초 대기
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 결과 표시
    const resultEmbed = new EmbedBuilder()
        .setColor(item.color)
        .setTitle(`${item.emoji} ${item.rarity.toUpperCase()} 아이템 획득!`)
        .setDescription(`**${item.name}**`)
        .addFields(
            {
                name: '📊 능력치',
                value: Object.entries(item.stats)
                    .map(([key, value]) => {
                        const statNames = {
                            attack: "⚔️ 공격력",
                            defense: "🛡️ 방어력",
                            strength: "💪 힘",
                            agility: "🏃 민첩",
                            intelligence: "🧠 지능",
                            vitality: "❤️ 체력",
                            luck: "🍀 행운",
                            hp: "💖 추가HP",
                            dodge: "💨 회피력"
                        };
                        return `${statNames[key]}: +${value}`;
                    }).join('\n'),
                inline: true
            },
            {
                name: '📝 정보',
                value: `종류: ${randomItemGenerator.getItemTypeKorean(item.type)}\n가격: ${item.price.toLocaleString()}G\n${item.description}`,
                inline: true
            }
        );

    if (item.specialCombo) {
        resultEmbed.addFields({
            name: '✨ 특수 효과',
            value: `**${item.specialCombo.name}**\n${item.specialCombo.effect}`,
            inline: false
        });
    }

    // 인벤토리에 추가 버튼
    const actionButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`random_add_inventory_${item.id}`)
                .setLabel('🎒 인벤토리에 추가')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`random_sell_item_${item.id}`)
                .setLabel(`💰 즉시 판매 (${item.sellPrice.toLocaleString()}G)`)
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.editReply({
        embeds: [resultEmbed],
        components: [actionButtons]
    });

    // 임시 아이템 저장
    if (!global.tempRandomItems) global.tempRandomItems = new Map();
    global.tempRandomItems.set(item.id, item);

    await user.save();

    // 30초 후 임시 데이터 삭제
    setTimeout(() => {
        global.tempRandomItems.delete(item.id);
    }, 30000);
}

// 아이템 처리
async function handleItemAction(interaction, action, itemId) {
    const user = await getUser(interaction.user.id);
    const item = global.tempRandomItems?.get(itemId);
    
    if (!item) {
        return await interaction.update({
            content: '❌ 아이템 정보를 찾을 수 없습니다. (시간 초과)',
            embeds: [],
            components: []
        });
    }

    if (action === 'add') {
        // 인벤토리 슬롯 찾기
        const emptySlot = user.findEmptyInventorySlot();
        
        if (emptySlot === -1) {
            return await interaction.update({
                content: '❌ 인벤토리가 가득 찼습니다!',
                embeds: [],
                components: []
            });
        }

        // 아이템 추가
        const inventoryItem = {
            id: item.id,
            name: item.name,
            type: item.type,
            rarity: item.rarity,
            stats: item.stats,
            description: item.description,
            price: item.price,
            enhanceLevel: 0,
            inventorySlot: emptySlot,
            equipped: false
        };

        // 특수 효과 추가
        if (item.specialCombo) {
            inventoryItem.specialEffect = {
                name: item.specialCombo.name,
                effect: item.specialCombo.effect,
                stats: item.specialStats
            };
        }

        user.inventory.push(inventoryItem);
        await user.save();

        await interaction.update({
            content: `✅ **${item.name}**을(를) 인벤토리에 추가했습니다!`,
            embeds: [],
            components: []
        });
    } else if (action === 'sell') {
        // 즉시 판매
        user.gold += item.sellPrice;
        await user.save();
        
        // 골드 획득 미션 업데이트
        await MissionHelper.updateGoldEarned(interaction.user.id, item.sellPrice);

        await interaction.update({
            content: `💰 **${item.name}**을(를) ${item.sellPrice.toLocaleString()}G에 판매했습니다!`,
            embeds: [],
            components: []
        });
    }

    // 임시 데이터 삭제
    global.tempRandomItems.delete(itemId);
}

module.exports = {
    showRandomShop,
    executeGacha,
    handleItemAction
};