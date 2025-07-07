const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { LOOT_MARKET, getItemPrice, updateMarketPrices } = require('../../data/lootMarket');
const { APPRAISAL_STOCK, generatePrediction, checkAutoTrade } = require('../../data/appraisalStock');

// 전략 설정 메인
async function showStrategyMenu(interaction) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    if (!user.appraisalWarehouse || user.appraisalWarehouse.items.length === 0) {
        return await interaction.editReply({
            content: '❌ 창고에 아이템이 없습니다!',
            embeds: [],
            components: []
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#4444ff')
        .setTitle('🎯 자동매매 전략 설정')
        .setDescription('아이템별로 자동매매 전략을 설정할 수 있습니다.')
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723800/strategy.png');
    
    // 전략 설명
    let strategyText = '';
    for (const [name, strategy] of Object.entries(APPRAISAL_STOCK.strategies)) {
        strategyText += `**${name}**\n${strategy.description}\n\n`;
    }
    
    embed.addFields({
        name: '📋 사용 가능한 전략',
        value: strategyText
    });
    
    // 아이템 선택 메뉴
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('strategy_item_select')
        .setPlaceholder('🎯 전략을 설정할 아이템 선택')
        .setMaxValues(Math.min(user.appraisalWarehouse.items.length, 25));
    
    user.appraisalWarehouse.items.slice(0, 25).forEach((item, index) => {
        const currentStrategy = item.strategy || '없음';
        const locked = item.locked ? '🔒' : '';
        
        selectMenu.addOptions({
            label: `${item.name} x${item.quantity} ${locked}`,
            description: `현재 전략: ${currentStrategy}`,
            value: `${index}`,
            emoji: item.emoji
        });
    });
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('strategy_remove_all')
                .setLabel('🗑️ 모든 전략 제거')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('warehouse_main')
                .setLabel('🔙 창고로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [row, buttonRow]
    });
}

// 전략 선택
async function selectStrategy(interaction, itemIndices) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const selectedItems = itemIndices.map(idx => ({
        index: parseInt(idx),
        item: user.appraisalWarehouse.items[parseInt(idx)]
    })).filter(data => data.item);
    
    if (selectedItems.length === 0) {
        return await showStrategyMenu(interaction);
    }
    
    const embed = new EmbedBuilder()
        .setColor('#4444ff')
        .setTitle('🎯 전략 선택')
        .setDescription('선택한 아이템에 적용할 전략을 선택하세요.');
    
    // 선택된 아이템 표시
    let itemText = '';
    selectedItems.forEach(data => {
        itemText += `${data.item.emoji} ${data.item.name} x${data.item.quantity}\n`;
    });
    
    embed.addFields({ name: '📦 선택한 아이템', value: itemText });
    
    // 전략 버튼들
    const strategyButtons1 = new ActionRowBuilder();
    const strategyButtons2 = new ActionRowBuilder();
    const strategies = Object.entries(APPRAISAL_STOCK.strategies);
    
    strategies.slice(0, 3).forEach(([name, strategy]) => {
        strategyButtons1.addComponents(
            new ButtonBuilder()
                .setCustomId(`apply_strategy_${name}_${itemIndices.join(',')}`)
                .setLabel(name)
                .setStyle(ButtonStyle.Primary)
        );
    });
    
    strategies.slice(3).forEach(([name, strategy]) => {
        strategyButtons2.addComponents(
            new ButtonBuilder()
                .setCustomId(`apply_strategy_${name}_${itemIndices.join(',')}`)
                .setLabel(name)
                .setStyle(ButtonStyle.Primary)
        );
    });
    
    const controlButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`toggle_lock_${itemIndices.join(',')}`)
                .setLabel('🔒 잠금 전환')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`remove_strategy_${itemIndices.join(',')}`)
                .setLabel('🗑️ 전략 제거')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('warehouse_strategy')
                .setLabel('🔙 전략 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [strategyButtons1, strategyButtons2, controlButtons]
    });
}

// 전략 적용
async function applyStrategy(interaction, strategyName, itemIndices) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const indices = itemIndices.split(',').map(idx => parseInt(idx));
    
    let appliedCount = 0;
    indices.forEach(index => {
        if (user.appraisalWarehouse.items[index]) {
            user.appraisalWarehouse.items[index].strategy = strategyName;
            appliedCount++;
        }
    });
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ 전략 적용 완료')
        .setDescription(`${appliedCount}개 아이템에 **${strategyName}**을(를) 적용했습니다.`)
        .setFooter({ text: '설정한 조건에 도달하면 자동으로 실행됩니다.' });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('warehouse_strategy')
                .setLabel('🎯 전략 메뉴')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('warehouse_main')
                .setLabel('🏦 창고로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 자동매매 실행 (정기적으로 실행되어야 함)
async function executeAutoTrades(client) {
    const users = await User.find({ 
        'appraisalWarehouse.items.0': { $exists: true },
        'appraisalWarehouse.items.strategy': { $ne: null }
    });
    
    updateMarketPrices(); // 시세 업데이트
    
    for (const user of users) {
        let executedTrades = [];
        
        for (let i = user.appraisalWarehouse.items.length - 1; i >= 0; i--) {
            const item = user.appraisalWarehouse.items[i];
            if (!item.strategy || item.locked) continue;
            
            const strategy = APPRAISAL_STOCK.strategies[item.strategy];
            if (!strategy) continue;
            
            const currentPrice = getItemPrice(item.id) || item.appraisedPrice;
            const tradeResult = checkAutoTrade(item, strategy, currentPrice);
            
            if (tradeResult && tradeResult.action === 'sell') {
                // 자동 판매 실행
                const profit = (currentPrice - item.appraisedPrice) * item.quantity;
                
                if (profit > 0) {
                    user.appraisalWarehouse.totalProfit += profit;
                } else {
                    user.appraisalWarehouse.totalLoss += Math.abs(profit);
                }
                
                user.gold += currentPrice * item.quantity;
                
                executedTrades.push({
                    item: item.name,
                    action: 'sell',
                    price: currentPrice,
                    quantity: item.quantity,
                    profit,
                    reason: tradeResult.reason
                });
                
                // 아이템 제거
                user.appraisalWarehouse.items.splice(i, 1);
            }
        }
        
        if (executedTrades.length > 0) {
            await user.save();
            
            // 사용자에게 DM으로 알림 (선택적)
            try {
                const discordUser = await client.users.fetch(user.discordId);
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎯 자동매매 실행 알림')
                    .setDescription('설정한 전략에 따라 자동매매가 실행되었습니다.')
                    .setTimestamp();
                
                let tradeText = '';
                executedTrades.forEach(trade => {
                    const profitEmoji = trade.profit > 0 ? '📈' : '📉';
                    tradeText += `${trade.item} x${trade.quantity} → ${formatNumber(trade.price)}G\n`;
                    tradeText += `${profitEmoji} 수익: ${trade.profit > 0 ? '+' : ''}${formatNumber(trade.profit)}G\n`;
                    tradeText += `사유: ${trade.reason}\n\n`;
                });
                
                embed.addFields({ name: '📊 거래 내역', value: tradeText });
                
                await discordUser.send({ embeds: [embed] });
            } catch (error) {
                console.log('자동매매 알림 전송 실패:', error);
            }
        }
    }
}

// 시세 예측 표시
async function showPredictions(interaction) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const warehouseGrade = APPRAISAL_STOCK.warehouseGrades[user.appraisalWarehouse.grade];
    
    if (!warehouseGrade.features.includes('AI 예측')) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🔒 AI 예측 잠김')
            .setDescription('VIP 창고에서만 사용 가능한 기능입니다.')
            .addFields({
                name: '🔓 잠금 해제 방법',
                value: 'VIP 창고로 업그레이드하세요! (500,000G)'
            });
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('warehouse_upgrade')
                    .setLabel('⬆️ 창고 업그레이드')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('warehouse_main')
                    .setLabel('🔙 창고로')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        return await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🔮 AI 시세 예측')
        .setDescription('AI가 분석한 시세 예측 정보입니다.')
        .setFooter({ text: `예측 정확도: ${APPRAISAL_STOCK.predictions.accuracy[user.level >= 100 ? 'legend' : user.level >= 50 ? 'master' : user.level >= 20 ? 'expert' : 'novice'] * 100}%` });
    
    // 보유 아이템별 예측
    let predictionText = '';
    const itemsToPredict = user.appraisalWarehouse.items.slice(0, 5);
    
    for (const item of itemsToPredict) {
        const history = LOOT_MARKET.priceHistory.get(item.id);
        const prediction = generatePrediction(history, user.level);
        const currentPrice = getItemPrice(item.id) || item.appraisedPrice;
        
        predictionText += `${item.emoji} **${item.name}**\n`;
        predictionText += `현재가: ${formatNumber(currentPrice)}G\n`;
        predictionText += `예측: ${prediction.hint} (신뢰도 ${prediction.confidence}%)\n\n`;
    }
    
    embed.addFields({ name: '📊 아이템별 예측', value: predictionText || '예측할 아이템이 없습니다.' });
    
    // 시장 전체 예측
    const marketTrend = LOOT_MARKET.marketState.trend;
    let marketPrediction = '';
    
    if (marketTrend > 70) {
        marketPrediction = '🔥 과열 상태! 조정 가능성 높음';
    } else if (marketTrend > 30) {
        marketPrediction = '📈 상승 추세 지속 예상';
    } else if (marketTrend > -30) {
        marketPrediction = '➖ 횡보장 예상';
    } else if (marketTrend > -70) {
        marketPrediction = '📉 하락 추세 지속 예상';
    } else {
        marketPrediction = '💎 바닥권! 반등 가능성 높음';
    }
    
    embed.addFields({
        name: '🌐 시장 전체 예측',
        value: marketPrediction
    });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('warehouse_main')
                .setLabel('🏦 창고로')
                .setStyle(ButtonStyle.Primary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 창고 업그레이드
async function upgradeWarehouse(interaction) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const currentGrade = user.appraisalWarehouse.grade;
    
    let nextGrade, upgradeCost;
    if (currentGrade === 'basic') {
        nextGrade = 'premium';
        upgradeCost = APPRAISAL_STOCK.warehouseGrades.premium.upgradeCost;
    } else if (currentGrade === 'premium') {
        nextGrade = 'vip';
        upgradeCost = APPRAISAL_STOCK.warehouseGrades.vip.upgradeCost;
    } else {
        return await interaction.editReply({
            content: '❌ 이미 최고 등급입니다!',
            embeds: [],
            components: []
        });
    }
    
    const nextGradeData = APPRAISAL_STOCK.warehouseGrades[nextGrade];
    
    const embed = new EmbedBuilder()
        .setColor('#ffdd44')
        .setTitle('⬆️ 창고 업그레이드')
        .setDescription(`${currentGrade} → ${nextGrade} 업그레이드`)
        .addFields(
            { name: '💰 비용', value: `${formatNumber(upgradeCost)}G`, inline: true },
            { name: '📦 슬롯', value: `${user.appraisalWarehouse.slots} → ${nextGradeData.slots}`, inline: true },
            { name: '💸 보관료', value: `${APPRAISAL_STOCK.warehouseGrades[currentGrade].fee}G → ${nextGradeData.fee}G`, inline: true },
            { name: '✨ 새 기능', value: nextGradeData.features.join('\n') || '없음' }
        );
    
    if (user.gold < upgradeCost) {
        embed.setColor('#ff0000');
        embed.addFields({
            name: '❌ 골드 부족',
            value: `필요: ${formatNumber(upgradeCost)}G\n보유: ${formatNumber(user.gold)}G`
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_warehouse_upgrade_${nextGrade}`)
                .setLabel('✅ 업그레이드')
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.gold < upgradeCost),
            new ButtonBuilder()
                .setCustomId('warehouse_main')
                .setLabel('🔙 취소')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

module.exports = {
    showStrategyMenu,
    selectStrategy,
    applyStrategy,
    executeAutoTrades,
    showPredictions,
    upgradeWarehouse
};