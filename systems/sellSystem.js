const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../models/User');

// 등급별 이모지
const RARITY_EMOJIS = {
    legendary: '🟨',
    unique: '🟪',
    epic: '🟦',
    rare: '🟢',
    normal: '⚪',
    trash: '🟫'
};

// 등급 순서
const RARITY_ORDER = ['legendary', 'unique', 'epic', 'rare', 'normal', 'trash'];

// 캐시된 판매 가능 아이템 (성능 향상)
const sellableItemsCache = new Map();

// 판매 중 플래그
const sellingInProgress = new Set();

// 페이지당 아이템 수
const ITEMS_PER_PAGE = 10;

// 판매 가능한 아이템 필터링 및 캐싱
async function getSellableItems(userId, forceRefresh = false) {
    // 캐시 확인
    if (!forceRefresh && sellableItemsCache.has(userId)) {
        return sellableItemsCache.get(userId);
    }
    
    // 최신 데이터 가져오기
    const user = await User.findOne({ discordId: userId });
    if (!user || !user.inventory) return [];
    
    console.log(`[판매] ${userId} 인벤토리 아이템 수: ${user.inventory.length}`);
    
    // 필터링
    const sellableItems = user.inventory.filter((item, index) => {
        if (!item || !item.id) return false;
        
        // 사냥 전리품 제외 (재료 아이템만 제외)
        if (item.type === 'material') {
            return false;
        }
        
        // 장착 중인지 확인 - 3가지 방법으로 체크
        // 1. inventorySlot으로 확인 (equipment에 저장된 값과 비교)
        const isEquippedBySlot = item.inventorySlot !== undefined && 
            Object.values(user.equipment || {}).some(slotValue => 
                slotValue !== null && slotValue !== undefined && slotValue !== -1 && 
                slotValue === item.inventorySlot
            );
        
        // 2. equipped 필드로 확인
        const isEquippedByFlag = item.equipped === true;
        
        // 3. 호환성을 위해 인덱스로도 확인
        const isEquippedByIndex = Object.values(user.equipment || {}).some(slotValue => 
            slotValue === index
        );
        
        // 하나라도 true면 장착 중
        const isEquipped = isEquippedBySlot || isEquippedByFlag || isEquippedByIndex;
        
        return !isEquipped;
    }).map((item, index) => {
        // sellPrice 계산
        const calculatedSellPrice = item.sellPrice || Math.floor((item.price || 0) * 0.3);
        
        // MongoDB 문서를 일반 객체로 변환
        const itemData = item.toObject ? item.toObject() : item;
        
        return {
            ...itemData,
            sellPrice: calculatedSellPrice,
            originalIndex: user.inventory.indexOf(item)
        };
    });
    
    // 등급별 정렬
    sellableItems.sort((a, b) => {
        const rarityDiff = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
        if (rarityDiff !== 0) return rarityDiff;
        return (b.sellPrice || 0) - (a.sellPrice || 0);
    });
    
    console.log(`[판매] 판매 가능 아이템 수: ${sellableItems.length}`);
    
    // 캐싱 (5분간 유지)
    sellableItemsCache.set(userId, sellableItems);
    setTimeout(() => sellableItemsCache.delete(userId), 300000);
    
    return sellableItems;
}

// 메인 판매 메뉴
async function showSellMenu(interaction, user) {
    try {
        // 즉시 deferUpdate
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        
        // 항상 최신 데이터를 가져오도록 캐시 강제 갱신
        const sellableItems = await getSellableItems(user.discordId, true);
        
        console.log(`[판매 메뉴] ${user.nickname || user.discordId} - 판매 가능 아이템: ${sellableItems.length}개`);
        
        if (sellableItems.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('💰 장비 판매')
                .setDescription('판매할 수 있는 장비가 없습니다.\n(장착 중인 장비는 판매할 수 없습니다)')
                .setFooter({ text: '상점으로 돌아가려면 아래 버튼을 클릭하세요' });
            
            return await interaction.editReply({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('shop_refresh')
                        .setLabel('🏪 상점으로')
                        .setStyle(ButtonStyle.Secondary)
                )]
            });
        }
        
        // 등급별 개수 계산
        const gradeCounts = {};
        let totalValue = 0;
        
        sellableItems.forEach(item => {
            gradeCounts[item.rarity] = (gradeCounts[item.rarity] || 0) + 1;
            // sellPrice 계산 (price의 30%)
            const itemPrice = item.sellPrice || Math.floor((item.price || 0) * 0.3);
            
            // 디버깅: 가격이 0인 아이템 로그
            if (itemPrice === 0) {
                console.log(`[판매] 가격 0원 아이템:`, {
                    name: item.name,
                    price: item.price,
                    sellPrice: item.sellPrice,
                    rarity: item.rarity
                });
            }
            
            totalValue += itemPrice;
        });
        
        // 판매 모드 선택 화면
        const modeEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💰 판매 모드 선택')
            .setDescription(`**판매 가능한 아이템: ${sellableItems.length}개**\n총 예상 가치: **${totalValue.toLocaleString()}G**`)
            .addFields(
                {
                    name: '📊 등급별 보유 현황',
                    value: RARITY_ORDER.map(rarity => {
                        const count = gradeCounts[rarity] || 0;
                        if (count === 0) return null;
                        return `${RARITY_EMOJIS[rarity]} ${rarity.toUpperCase()}: ${count}개`;
                    }).filter(Boolean).join('\n') || '없음',
                    inline: true
                },
                {
                    name: '💰 현재 보유 골드',
                    value: `${user.gold.toLocaleString()}G`,
                    inline: true
                }
            );
        
        const modeButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('sell_mode_quick')
                .setLabel('🚀 빠른 판매')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('sell_mode_cart')
                .setLabel('📦 카트 판매')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('sell_grade_menu')
                .setLabel('🎯 등급별 판매')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('shop_refresh')
                .setLabel('🏪 돌아가기')
                .setStyle(ButtonStyle.Danger)
        );
        
        await interaction.editReply({
            embeds: [modeEmbed],
            components: [modeButtons]
        });
        
    } catch (error) {
        console.error('showSellMenu 오류:', error);
        await interaction.editReply({
            content: '❌ 오류가 발생했습니다.',
            embeds: [],
            components: []
        }).catch(() => {});
    }
}

// 빠른 판매 모드
async function showQuickSellMode(interaction, user, page = 0) {
    try {
        // 즉시 응답
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        
        const sellableItems = await getSellableItems(user.discordId);
        const totalPages = Math.ceil(sellableItems.length / ITEMS_PER_PAGE);
        const startIndex = page * ITEMS_PER_PAGE;
        const pageItems = sellableItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
        
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`🚀 빠른 판매 (페이지 ${page + 1}/${totalPages})`)
            .setDescription('아이템을 선택하면 즉시 판매됩니다.\n⚠️ **주의: 즉시 판매되므로 신중히 선택하세요!**')
            .setFooter({ text: `보유 골드: ${user.gold.toLocaleString()}G` });
        
        // 아이템 목록을 셀렉트 메뉴로 표시
        const selectOptions = pageItems.map((item, index) => {
            const globalIndex = startIndex + index;
            const sellPrice = item.sellPrice || Math.floor((item.price || 0) * 0.3);
            const enhancement = item.enhancement ? ` (+${item.enhancement})` : '';
            
            return {
                label: `${item.name}${enhancement}`,
                value: `quick_sell_${item.originalIndex}`,
                description: `${item.rarity} | ${sellPrice.toLocaleString()}G`,
                emoji: RARITY_EMOJIS[item.rarity] || '⚪'
            };
        });
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('quick_sell_select')
            .setPlaceholder('판매할 아이템을 선택하세요')
            .addOptions(selectOptions);
        
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`quick_sell_page_${page - 1}`)
                .setLabel('◀️ 이전')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`quick_sell_page_${page + 1}`)
                .setLabel('다음 ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1),
            new ButtonBuilder()
                .setCustomId('sell_menu_back')
                .setLabel('🔙 뒤로')
                .setStyle(ButtonStyle.Primary)
        );
        
        await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(selectMenu),
                buttons
            ]
        });
        
    } catch (error) {
        console.error('showQuickSellMode 오류:', error);
        await interaction.followUp({
            content: '❌ 오류가 발생했습니다.',
            flags: 64
        }).catch(() => {});
    }
}

// 등급별 판매 메뉴
async function showGradeSellMenu(interaction, user) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        
        const sellableItems = await getSellableItems(user.discordId);
        
        // 등급별 통계
        const gradeStats = {};
        RARITY_ORDER.forEach(rarity => {
            const items = sellableItems.filter(item => item.rarity === rarity);
            const totalValue = items.reduce((sum, item) => 
                sum + (item.sellPrice || Math.floor((item.price || 0) * 0.3)), 0
            );
            gradeStats[rarity] = { count: items.length, value: totalValue };
        });
        
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎯 등급별 일괄 판매')
            .setDescription('판매할 등급을 선택하세요.\n선택한 등급 이하의 모든 아이템이 판매됩니다.')
            .addFields(
                {
                    name: '📊 등급별 현황',
                    value: RARITY_ORDER.map(rarity => {
                        const stat = gradeStats[rarity];
                        if (stat.count === 0) return null;
                        return `${RARITY_EMOJIS[rarity]} **${rarity.toUpperCase()}**: ${stat.count}개 (${stat.value.toLocaleString()}G)`;
                    }).filter(Boolean).join('\n') || '판매 가능한 아이템 없음'
                }
            )
            .setFooter({ text: '⚠️ 고급 아이템은 개별 확인 후 판매하는 것을 권장합니다' });
        
        const buttons = [];
        
        // trash만 판매
        if (gradeStats.trash.count > 0) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('grade_sell_trash')
                    .setLabel(`🟫 쓰레기만 (${gradeStats.trash.count}개)`)
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        
        // normal 이하 판매
        const normalAndBelow = gradeStats.trash.count + gradeStats.normal.count;
        if (normalAndBelow > 0) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('grade_sell_normal')
                    .setLabel(`⚪ 일반 이하 (${normalAndBelow}개)`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        
        // rare 이하 판매
        const rareAndBelow = normalAndBelow + gradeStats.rare.count;
        if (rareAndBelow > 0) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('grade_sell_rare')
                    .setLabel(`🟢 레어 이하 (${rareAndBelow}개)`)
                    .setStyle(ButtonStyle.Success)
            );
        }
        
        // epic 이하 판매 (경고 포함)
        const epicAndBelow = rareAndBelow + gradeStats.epic.count;
        if (epicAndBelow > 0) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('grade_sell_epic')
                    .setLabel(`🟦 에픽 이하 (${epicAndBelow}개)`)
                    .setStyle(ButtonStyle.Danger)
            );
        }
        
        // unique 이하 판매 (경고 포함)
        const uniqueAndBelow = epicAndBelow + (gradeStats.unique?.count || 0);
        if (uniqueAndBelow > 0) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('grade_sell_unique')
                    .setLabel(`🟪 유니크 이하 (${uniqueAndBelow}개)`)
                    .setStyle(ButtonStyle.Danger)
            );
        }
        
        buttons.push(
            new ButtonBuilder()
                .setCustomId('sell_menu_back')
                .setLabel('🔙 뒤로')
                .setStyle(ButtonStyle.Secondary)
        );
        
        // 버튼을 행으로 나누기
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }
        
        await interaction.editReply({
            embeds: [embed],
            components: rows
        });
        
    } catch (error) {
        console.error('showGradeSellMenu 오류:', error);
        await interaction.followUp({
            content: '❌ 오류가 발생했습니다.',
            flags: 64
        }).catch(() => {});
    }
}

// 등급별 판매 실행
async function executeGradeSell(interaction, userId, maxRarity, isConfirmed = false) {
    try {
        // 안전한 defer 처리
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }
        } catch (error) {
            if (error.code === 10062) {
                console.log('[GradeSell] Interaction expired');
                return;
            } else if (error.code === 40060) {
                console.log('[GradeSell] Interaction already acknowledged');
                // 이미 acknowledged된 경우 계속 진행
            } else {
                console.error('[GradeSell] Defer error:', error);
                return;
            }
        }
        
        // 중복 판매 방지
        if (sellingInProgress.has(userId)) {
            return await interaction.followUp({
                content: '⏳ 이미 판매가 진행 중입니다.',
                flags: 64
            });
        }
        
        sellingInProgress.add(userId);
        
        // 최신 유저 정보
        const user = await User.findOne({ discordId: userId });
        if (!user) {
            sellingInProgress.delete(userId);
            return await interaction.followUp({
                content: '❌ 사용자 정보를 찾을 수 없습니다.',
                flags: 64
            });
        }
        
        // 판매할 등급 결정
        console.log(`[executeGradeSell] maxRarity: ${maxRarity}`);
        const rarityIndex = RARITY_ORDER.indexOf(maxRarity);
        const sellRarities = RARITY_ORDER.slice(rarityIndex);
        console.log(`[executeGradeSell] rarityIndex: ${rarityIndex}, sellRarities:`, sellRarities);
        
        // 판매할 아이템 찾기
        const itemsToSell = [];
        const itemIndices = [];
        
        user.inventory.forEach((item, index) => {
            if (!item || !item.id) return;
            
            // 장착 중인지 확인 - 모든 방법으로 체크
            const isEquippedBySlot = item.inventorySlot !== undefined && 
                Object.values(user.equipment || {}).some(slotValue => 
                    slotValue !== null && slotValue !== undefined && slotValue !== -1 && 
                    slotValue === item.inventorySlot
                );
            const isEquippedByFlag = item.equipped === true;
            const isEquippedByIndex = Object.values(user.equipment || {}).some(slotValue => 
                slotValue === index
            );
            const isEquipped = isEquippedBySlot || isEquippedByFlag || isEquippedByIndex;
            
            if (!isEquipped && sellRarities.includes(item.rarity) && 
                item.type !== 'material' && !item.fromMonster && !item.fromArea) {
                itemsToSell.push(item);
                itemIndices.push(index);
                console.log(`[executeGradeSell] 판매 대상 추가: ${item.name} (${item.rarity})`);
            }
        });
        
        if (itemsToSell.length === 0) {
            sellingInProgress.delete(userId);
            return await interaction.followUp({
                content: '❌ 판매할 아이템이 없습니다.',
                flags: 64
            });
        }
        
        // 고급 아이템 경고 (확인되지 않은 경우에만)
        const hasValuableItems = itemsToSell.some(item => 
            ['unique', 'legendary'].includes(item.rarity) || item.enhancement > 5
        );
        
        if (!isConfirmed && hasValuableItems && maxRarity !== 'trash' && maxRarity !== 'normal') {
            const confirmEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚠️ 고급 아이템 판매 경고')
                .setDescription(`**${itemsToSell.length}개**의 아이템을 판매하려고 합니다.\n\n` +
                    `🟪 유니크 이상: ${itemsToSell.filter(i => ['unique', 'legendary'].includes(i.rarity)).length}개\n` +
                    `⚔️ +5 이상 강화: ${itemsToSell.filter(i => i.enhancement > 5).length}개\n\n` +
                    `정말로 판매하시겠습니까?`);
            
            const confirmButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_grade_sell_${maxRarity}`)
                    .setLabel('✅ 확인')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('sell_grade_menu')
                    .setLabel('❌ 취소')
                    .setStyle(ButtonStyle.Secondary)
            );
            
            sellingInProgress.delete(userId);
            return await interaction.editReply({
                embeds: [confirmEmbed],
                components: [confirmButtons]
            });
        }
        
        // 판매 실행
        let totalGold = 0;
        const soldByRarity = {};
        
        // 인덱스를 역순으로 정렬 (뒤에서부터 제거)
        itemIndices.sort((a, b) => b - a);
        
        for (const index of itemIndices) {
            const item = user.inventory[index];
            const sellPrice = item.sellPrice || Math.floor((item.price || 0) * 0.3);
            totalGold += sellPrice;
            
            soldByRarity[item.rarity] = (soldByRarity[item.rarity] || 0) + 1;
            user.inventory.splice(index, 1);
        }
        
        // 버그 사냥꾼 칭호 효과 적용
        const { applyGoldBonus } = require('../handlers/common/specialEffects');
        const originalGold = totalGold;
        totalGold = applyGoldBonus(totalGold, user);
        
        let bonusApplied = false;
        let bonusAmount = 0;
        if (totalGold > originalGold) {
            bonusApplied = true;
            bonusAmount = totalGold - originalGold;
            console.log(`[SellSystem] ${user.nickname || user.discordId} - 특수 효과 적용: ${originalGold} → ${totalGold} (+${bonusAmount})`);
        }
        
        user.gold += totalGold;
        await user.save();
        
        // 캐시 초기화
        sellableItemsCache.delete(userId);
        
        // 결과 표시
        const resultEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ 일괄 판매 완료')
            .setDescription(`**${itemsToSell.length}개**의 아이템을 판매했습니다.` +
                (bonusApplied ? `\n\n🏷️ **버그 사냥꾼 칭호 효과** +${bonusAmount.toLocaleString()}G` : ''))
            .addFields(
                {
                    name: '📊 판매 내역',
                    value: Object.entries(soldByRarity).map(([rarity, count]) => 
                        `${RARITY_EMOJIS[rarity]} ${rarity.toUpperCase()}: ${count}개`
                    ).join('\n'),
                    inline: true
                },
                {
                    name: '💰 획득 골드',
                    value: `+${totalGold.toLocaleString()}G`,
                    inline: true
                },
                {
                    name: '💳 현재 골드',
                    value: `${user.gold.toLocaleString()}G`,
                    inline: true
                }
            );
        
        const continueButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('sell_menu_return')
                .setLabel('💰 계속 판매하기')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('shop_refresh')
                .setLabel('🏪 상점으로')
                .setStyle(ButtonStyle.Success)
        );
        
        sellingInProgress.delete(userId);
        await interaction.editReply({
            embeds: [resultEmbed],
            components: [continueButtons]
        });
        
    } catch (error) {
        console.error('executeGradeSell 오류:', error);
        sellingInProgress.delete(userId);
        await interaction.followUp({
            content: '❌ 판매 중 오류가 발생했습니다.',
            flags: 64
        }).catch(() => {});
    }
}

// 빠른 판매 실행
async function executeQuickSell(interaction, userId, itemIndex) {
    try {
        // 중복 방지
        const sellKey = `${userId}_${itemIndex}`;
        if (sellingInProgress.has(sellKey)) {
            return;
        }
        
        sellingInProgress.add(sellKey);
        
        // 유저 정보 가져오기
        const user = await User.findOne({ discordId: userId });
        if (!user || !user.inventory[itemIndex]) {
            sellingInProgress.delete(sellKey);
            return await interaction.followUp({
                content: '❌ 아이템을 찾을 수 없습니다.',
                flags: 64
            });
        }
        
        const item = user.inventory[itemIndex];
        
        // 장착 중인지 다시 확인 - 3가지 방법 모두 체크
        const isEquippedBySlot = item.inventorySlot !== undefined && 
            Object.values(user.equipment || {}).some(slotValue => 
                slotValue !== null && slotValue !== undefined && slotValue !== -1 &&
                slotValue === item.inventorySlot
            );
        const isEquippedByFlag = item.equipped === true;
        const isEquippedByIndex = Object.values(user.equipment || {}).includes(itemIndex);
        
        if (isEquippedBySlot || isEquippedByFlag || isEquippedByIndex) {
            sellingInProgress.delete(sellKey);
            console.log(`[판매 차단] ${item.name} - Slot: ${isEquippedBySlot}, Flag: ${isEquippedByFlag}, Index: ${isEquippedByIndex}`);
            return await interaction.followUp({
                content: '❌ 장착 중인 아이템은 판매할 수 없습니다!',
                flags: 64
            });
        }
        
        let sellPrice = item.sellPrice || Math.floor((item.price || 0) * 0.3);
        const enhancement = item.enhancement ? ` (+${item.enhancement})` : '';
        
        // 판매 전 현재 페이지 계산 (강제 캐시 갱신으로 정확한 현재 페이지 확인)
        const beforeSellItems = await getSellableItems(userId, true);
        let currentPage = 0;
        
        // 판매할 아이템이 현재 캐시에서 몇 번째인지 찾기
        const itemIndexInCache = beforeSellItems.findIndex(cachedItem => 
            cachedItem.originalIndex === itemIndex
        );
        
        if (itemIndexInCache !== -1) {
            currentPage = Math.floor(itemIndexInCache / ITEMS_PER_PAGE);
        }
        
        // 판매 실행
        user.inventory.splice(itemIndex, 1);
        
        // 버그 사냥꾼 칭호 효과 적용
        const { applyGoldBonus } = require('../handlers/common/specialEffects');
        const originalPrice = sellPrice;
        sellPrice = applyGoldBonus(sellPrice, user);
        
        let bonusApplied = false;
        let bonusAmount = 0;
        if (sellPrice > originalPrice) {
            bonusApplied = true;
            bonusAmount = sellPrice - originalPrice;
            console.log(`[SellSystem] ${user.nickname || user.discordId} - 특수 효과 적용: ${originalPrice} → ${sellPrice} (+${bonusAmount})`);
        }
        
        user.gold += sellPrice;
        await user.save();
        
        // 캐시 완전 초기화
        sellableItemsCache.delete(userId);
        
        // 결과 알림 (먼저 ephemeral 메시지로 알림)
        await interaction.followUp({
            content: `✅ **${RARITY_EMOJIS[item.rarity]} ${item.name}${enhancement}**을(를) **${sellPrice.toLocaleString()}G**에 판매했습니다.\n` +
                (bonusApplied ? `🏷️ **버그 사냥꾼 칭호 효과** +${bonusAmount.toLocaleString()}G\n` : '') +
                `💰 현재 골드: **${user.gold.toLocaleString()}G**`,
            flags: 64
        });
        
        // 판매 후 새로운 아이템 목록 가져오기
        const afterSellItems = await getSellableItems(userId, true);
        
        // 판매 후 페이지 계산
        if (afterSellItems.length === 0) {
            // 아이템이 없으면 판매 메뉴로 돌아가기
            await showSellMenu(interaction, user);
        } else {
            // 현재 페이지에 아이템이 없으면 이전 페이지로
            const totalPages = Math.ceil(afterSellItems.length / ITEMS_PER_PAGE);
            if (currentPage >= totalPages && currentPage > 0) {
                currentPage = totalPages - 1;
            }
            
            // 화면 새로고침
            await showQuickSellMode(interaction, user, currentPage);
        }
        
        sellingInProgress.delete(sellKey);
        
    } catch (error) {
        console.error('executeQuickSell 오류:', error);
        sellingInProgress.delete(`${userId}_${itemIndex}`);
        await interaction.followUp({
            content: '❌ 판매 중 오류가 발생했습니다.',
            flags: 64
        }).catch(() => {});
    }
}

module.exports = {
    showSellMenu,
    showQuickSellMode,
    showGradeSellMenu,
    executeGradeSell,
    executeQuickSell,
    getSellableItems
};