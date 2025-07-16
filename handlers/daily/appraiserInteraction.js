const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { LOOT_MARKET, getItemPrice, generateChartData, recordMarketEvent } = require('../../data/lootMarket');
const { APPRAISAL_STOCK, canCreateCertificate, generatePrediction, checkAutoTrade } = require('../../data/appraisalStock');
const { formatTradingViewData, ITEM_TO_STOCK_MAPPING } = require('../../data/chartAPI');
const { getChartImageUrl, getAnimatedChartUrl } = require('../../data/chartService');

// 감정사와의 대화 시작
async function greetAppraiser(interaction) {
    // 이미 defer된 상태가 아니면 deferUpdate
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }
    
    const user = await getUser(interaction.user.id);
    if (!user) {
        return await interaction.editReply({
            content: '❌ 사용자를 찾을 수 없습니다.',
            embeds: [],
            components: []
        });
    }
    
    // 시장 상태 확인
    const marketTrend = LOOT_MARKET.marketState.trend;
    let marketMessage = '';
    let embedColor = '#9966ff';
    
    if (marketTrend > 50) {
        marketMessage = LOOT_MARKET.appraiser.dialogues.marketUp[Math.floor(Math.random() * LOOT_MARKET.appraiser.dialogues.marketUp.length)];
        embedColor = '#00ff00';
    } else if (marketTrend < -50) {
        marketMessage = LOOT_MARKET.appraiser.dialogues.marketDown[Math.floor(Math.random() * LOOT_MARKET.appraiser.dialogues.marketDown.length)];
        embedColor = '#ff0000';
    } else {
        marketMessage = "현재 시장은 평온한 상태입니다. 적당한 가격에 거래가 이루어지고 있어요.";
        embedColor = '#ffcc00';
    }
    
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${LOOT_MARKET.appraiser.emoji} ${LOOT_MARKET.appraiser.name}`)
        .setDescription(`"안녕하세요, ${user.nickname}님! 오늘도 좋은 물건을 가져오셨나요?"`)
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723795/appraiser.png')
        .addFields(
            { 
                name: '📊 오늘의 시장 상황', 
                value: marketMessage + `\n\n시장 동향: ${marketTrend > 0 ? '📈' : '📉'} ${Math.abs(marketTrend).toFixed(1)}%`,
                inline: false 
            },
            {
                name: '💼 제공 서비스',
                value: '• 실시간 시세 확인\n• 아이템 매매\n• 시세 차트 분석\n• 미확인 아이템 감정',
                inline: true
            },
            {
                name: '💰 보유 자산',
                value: `골드: ${formatNumber(user.gold)}G\n아이템: ${user.inventory.filter(item => item.type === 'material').length}개`,
                inline: true
            }
        )
        .setFooter({ text: '무엇을 도와드릴까요?' });
    
    const warehouseCount = user.appraisalWarehouse?.items?.length || 0;
    const usedSlots = `${warehouseCount}/${user.appraisalWarehouse?.slots || 50}`;
    
    const buttons1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('appraiser_market')
                .setLabel('📊 시세 확인')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('appraiser_sell')
                .setLabel('💰 즉시 판매')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('appraiser_warehouse')
                .setLabel(`🏦 감정 창고 (${usedSlots})`)
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('appraiser_chart')
                .setLabel('📈 차트 보기')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('appraiser_certificate')
                .setLabel('📜 증서 발행')
                .setStyle(ButtonStyle.Secondary)
        );
    
    const buttons2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('appraiser_appraise')
                .setLabel('🔍 감정 의뢰')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!user.lootAppraisal || user.lootAppraisal.unidentifiedItems.length === 0),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('👋 작별 인사')
                .setStyle(ButtonStyle.Danger)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons1, buttons2]
    });
}

// 시세 확인
async function showMarketPrices(interaction) {
    // 이미 defer된 상태가 아니면 deferUpdate
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }
    
    // 카테고리 선택 메뉴
    const categoryMenu = new StringSelectMenuBuilder()
        .setCustomId('appraiser_category_select')
        .setPlaceholder('📦 확인할 카테고리를 선택하세요')
        .addOptions([
            {
                label: '재료',
                description: '일반 재료 아이템',
                value: 'materials',
                emoji: '🧪'
            },
            {
                label: '희귀 재료',
                description: '희귀한 재료 아이템',
                value: 'rare_materials',
                emoji: '💎'
            },
            {
                label: '변이 드롭',
                description: '변이 몬스터 특수 드롭',
                value: 'mutation_drops',
                emoji: '🔥'
            },
            {
                label: '감정 결과물',
                description: '감정으로 얻은 아이템',
                value: 'appraisal_results',
                emoji: '🎁'
            }
        ]);
    
    const embed = new EmbedBuilder()
        .setColor('#9966ff')
        .setTitle('📊 실시간 시세 정보')
        .setDescription('확인하고 싶은 카테고리를 선택해주세요.')
        .setFooter({ text: '시세는 1분마다 자동으로 업데이트됩니다.' })
        .setTimestamp();
    
    const row = new ActionRowBuilder().addComponents(categoryMenu);
    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('appraiser_greet')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [row, buttonRow]
    });
}

// 카테고리별 시세 표시
async function showCategoryPrices(interaction, categoryId) {
    await interaction.deferUpdate();
    
    const category = LOOT_MARKET.categories[categoryId];
    if (!category) {
        return await interaction.editReply({
            content: '❌ 잘못된 카테고리입니다.',
            embeds: [],
            components: []
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#9966ff')
        .setTitle(`📊 ${category.name} 시세`)
        .setDescription('실시간 시장 가격 (기준가 대비)')
        .setTimestamp();
    
    // 아이템별 시세 표시
    let priceList = '';
    category.items.forEach(item => {
        const changeEmoji = item.change > 0 ? '📈' : item.change < 0 ? '📉' : '➖';
        const changeColor = item.change > 0 ? '+' : '';
        
        priceList += `${item.emoji} **${item.name}**\n`;
        priceList += `　현재가: ${formatNumber(item.currentPrice)}G (${changeEmoji} ${changeColor}${item.change.toFixed(1)}%)\n`;
        priceList += `　기준가: ${formatNumber(item.basePrice)}G | 거래량: ${item.volume}\n\n`;
    });
    
    embed.addFields({ name: '💹 시세 정보', value: priceList || '데이터 없음' });
    
    // 시장 통계
    const avgChange = category.items.reduce((sum, item) => sum + item.change, 0) / category.items.length;
    const totalVolume = category.items.reduce((sum, item) => sum + item.volume, 0);
    
    embed.addFields({
        name: '📊 카테고리 통계',
        value: `평균 변동률: ${avgChange > 0 ? '+' : ''}${avgChange.toFixed(2)}%\n총 거래량: ${formatNumber(totalVolume)}개`,
        inline: false
    });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('appraiser_market')
                .setLabel('🔙 카테고리 선택')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('appraiser_greet')
                .setLabel('🏠 메인으로')
                .setStyle(ButtonStyle.Primary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 아이템 판매
async function sellItems(interaction) {
    // 이미 defer된 상태가 아니면 deferUpdate
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }
    
    const user = await getUser(interaction.user.id);
    const materials = user.inventory.filter(item => item.type === 'material');
    
    if (materials.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('💼 판매 가능한 아이템 없음')
            .setDescription('재료 아이템이 없습니다. 사냥을 통해 재료를 획득하세요!')
            .setFooter({ text: '사냥터에서 몬스터를 처치하면 재료를 얻을 수 있습니다.' });
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('hunting')
                    .setLabel('🎯 사냥하러 가기')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('appraiser_greet')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        return await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    }
    
    // 판매 가능한 아이템 목록 생성
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('appraiser_sell_select')
        .setPlaceholder('💰 판매할 아이템을 선택하세요')
        .setMaxValues(Math.min(materials.length, 25)); // 최대 25개까지 선택 가능
    
    let totalValue = 0;
    materials.slice(0, 25).forEach((item, index) => {
        const currentPrice = getItemPrice(item.id) || item.price || 100;
        const quantity = item.quantity || 1;
        const totalPrice = currentPrice * quantity;
        totalValue += totalPrice;
        
        selectMenu.addOptions({
            label: `${item.name} x${quantity}`,
            description: `시세: ${formatNumber(currentPrice)}G | 총액: ${formatNumber(totalPrice)}G`,
            value: `${index}`,
            emoji: item.emoji || '📦'
        });
    });
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💰 아이템 판매')
        .setDescription('판매할 아이템을 선택하세요. (다중 선택 가능)')
        .addFields(
            { name: '📦 보유 재료', value: `${materials.length}개`, inline: true },
            { name: '💵 예상 총액', value: `${formatNumber(totalValue)}G`, inline: true },
            { name: '📊 시장 상태', value: LOOT_MARKET.marketState.trend > 0 ? '📈 상승장' : '📉 하락장', inline: true }
        )
        .setFooter({ text: '시세는 실시간으로 변동됩니다.' });
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('appraiser_sell_all')
                .setLabel('💵 모두 판매')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('appraiser_greet')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [row, buttonRow]
    });
}


// 판매 실행
async function executeSell(interaction, selectedIndices, sellAll = false) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const materials = user.inventory.filter((item, index) => {
        if (item && item.type === 'material') {
            // 인덱스 저장
            item._inventoryIndex = index;
            return true;
        }
        return false;
    });
    
    let itemsToSell = [];
    if (sellAll) {
        itemsToSell = materials;
    } else {
        itemsToSell = selectedIndices.map(index => materials[parseInt(index)]).filter(item => item);
    }
    
    if (itemsToSell.length === 0) {
        return await interaction.editReply({
            content: '❌ 판매할 아이템이 없습니다.',
            embeds: [],
            components: []
        });
    }
    
    let totalGold = 0;
    let sellDetails = [];
    let itemsToRemove = [];
    
    // 각 아이템 판매
    itemsToSell.forEach(item => {
        if (!item) return;
        
        const currentPrice = getItemPrice(item.id) || item.price || 100;
        const quantity = item.quantity || 1;
        const itemTotal = currentPrice * quantity;
        totalGold += itemTotal;
        
        sellDetails.push({
            name: item.name || '알 수 없는 아이템',
            emoji: item.emoji || '📦',
            quantity,
            price: currentPrice,
            total: itemTotal
        });
        
        // 거래량 증가
        for (const category of Object.values(LOOT_MARKET.categories)) {
            const marketItem = category.items.find(i => i.id === item.id);
            if (marketItem) {
                marketItem.volume += quantity;
                break;
            }
        }
        
        // 제거할 아이템 인덱스 저장
        if (item._inventoryIndex !== undefined) {
            itemsToRemove.push(item._inventoryIndex);
        }
    });
    
    // 인벤토리에서 제거 (인덱스 역순으로 정렬하여 제거)
    itemsToRemove.sort((a, b) => b - a);
    for (const index of itemsToRemove) {
        user.inventory.splice(index, 1);
    }
    
    // 골드 지급
    user.gold += totalGold;
    await user.save();
    
    // 시장 이벤트 기록
    recordMarketEvent('appraisalActivity', itemsToSell.length);
    
    // 판매 결과 표시
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('💰 판매 완료!')
        .setDescription(`${LOOT_MARKET.appraiser.name}: "좋은 거래였습니다!"`)
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723796/gold_pile.gif');
    
    let detailText = '';
    sellDetails.slice(0, 10).forEach(detail => {
        detailText += `${detail.emoji} ${detail.name} x${detail.quantity} = ${formatNumber(detail.total)}G\n`;
    });
    
    if (sellDetails.length > 10) {
        detailText += `... 그리고 ${sellDetails.length - 10}개 더\n`;
    }
    
    embed.addFields(
        { name: '📋 판매 내역', value: detailText || '없음' },
        { name: '💵 총 판매액', value: `**+${formatNumber(totalGold)}G**`, inline: true },
        { name: '💰 현재 골드', value: `${formatNumber(user.gold)}G`, inline: true }
    );
    
    // 대박 판매 체크
    if (totalGold > 100000) {
        embed.addFields({
            name: '🎊 대박 거래!',
            value: LOOT_MARKET.appraiser.dialogues.jackpot[Math.floor(Math.random() * LOOT_MARKET.appraiser.dialogues.jackpot.length)]
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('appraiser_sell')
                .setLabel('💰 더 판매하기')
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.inventory.filter(i => i.type === 'material').length === 0),
            new ButtonBuilder()
                .setCustomId('appraiser_greet')
                .setLabel('🏠 메인으로')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('👋 작별 인사')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 시세 차트 표시 (Alpha Vantage + TradingView 스타일)
async function showPriceChart(interaction) {
    // 이미 defer된 상태가 아니면 deferUpdate
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }
    
    const user = await getUser(interaction.user.id);
    
    // 사용자가 보유한 아이템 목록 + 창고 아이템
    const inventoryItems = user.inventory.filter(item => item.type === 'material');
    const warehouseItems = user.appraisalWarehouse?.items || [];
    const allUserItems = [...inventoryItems];
    
    // 창고 아이템도 포함
    warehouseItems.forEach(wItem => {
        if (!allUserItems.find(i => i.id === wItem.id)) {
            allUserItems.push({
                id: wItem.id,
                name: wItem.name,
                emoji: wItem.emoji || '📦',
                price: wItem.appraisedPrice,
                type: 'material'
            });
        }
    });
    
    const embed = new EmbedBuilder()
        .setColor('#131722') // TradingView 배경색
        .setTitle('📈 Professional Trading Chart powered by AlphaVantage')
        .setDescription('📡 Real-time market data with technical analysis')
        .setTimestamp();
    
    // 1. 특정 아이템 상세 차트 (TradingView 스타일)
    if (allUserItems.length > 0) {
        // 첫 번째 아이템의 상세 차트
        const firstItem = allUserItems[0];
        const chartData = formatTradingViewData(firstItem.id);
        
        if (chartData) {
            // 주식 티커 스타일 헤더
            const priceColor = chartData.change > 0 ? '🟢' : '🔴';
            const arrow = chartData.change > 0 ? '↑' : '↓';
            
            embed.addFields({
                name: `${firstItem.emoji} ${chartData.name} (${chartData.symbol})`,
                value: `**${formatNumber(chartData.currentPrice)}G** ${priceColor} ${arrow} ${chartData.change} (${chartData.changePercent > 0 ? '+' : ''}${chartData.changePercent}%)\n` +
                       `H: ${formatNumber(chartData.high)}G | L: ${formatNumber(chartData.low)}G | Vol: ${chartData.volume}`,
                inline: false
            });
            
            // 실제 차트 이미지 추가
            const stockSymbol = ITEM_TO_STOCK_MAPPING[firstItem.id]?.symbol || 'AAPL';
            const chartImageUrl = getChartImageUrl(
                firstItem.id, 
                chartData.name, 
                stockSymbol,
                parseFloat(chartData.currentPrice),
                LOOT_MARKET.priceHistory.get(firstItem.id),
                'candlestick'
            );
            
            embed.setImage(chartImageUrl);
            
            // 기술적 지표
            const indicators = chartData.indicators;
            let technicalAnalysis = `**기술적 분석**\n`;
            technicalAnalysis += `📈 MA5: ${formatNumber(indicators.ma5)}G | MA20: ${formatNumber(indicators.ma20)}G\n`;
            technicalAnalysis += `📊 RSI(14): ${indicators.rsi} ${indicators.rsi > 70 ? '(너무 비쌈)' : indicators.rsi < 30 ? '(너무 쌈)' : '(적정가)'}\n`;
            technicalAnalysis += `📉 MACD: ${indicators.macd}\n`;
            technicalAnalysis += `🎯 볼린저밴드: ${formatNumber(indicators.bollingerBands.upper)}G / ${formatNumber(indicators.bollingerBands.middle)}G / ${formatNumber(indicators.bollingerBands.lower)}G`;
            
            embed.addFields({
                name: '🧠 시세 분석',
                value: technicalAnalysis,
                inline: false
            });
            
            // 호가창 (마켓 뎁스)
            const depth = chartData.marketDepth;
            let orderBook = '**거래 대기열**\n';
            orderBook += '```diff\n';
            orderBook += '판매 대기\n';
            for (let i = Math.min(4, depth.asks.length - 1); i >= 0; i--) {
                const ask = depth.asks[i];
                orderBook += `- ${ask.price.padStart(8)}G | ${ask.volume.toString().padEnd(6)}\n`;
            }
            orderBook += `\n현재가: ${depth.currentPrice}G\n\n`;
            orderBook += '구매 대기\n';
            for (let i = 0; i < Math.min(5, depth.bids.length); i++) {
                const bid = depth.bids[i];
                orderBook += `+ ${bid.price.padStart(8)}G | ${bid.volume.toString().padEnd(6)}\n`;
            }
            orderBook += '```';
            
            embed.addFields({
                name: '📔 거래 상황',
                value: orderBook,
                inline: false
            });
        }
    }
    
    // 2. 보유 아이템 요약
    if (allUserItems.length > 0) {
        let portfolioText = '**보유 아이템 요약**\n';
        let totalValue = 0;
        
        allUserItems.slice(0, 5).forEach(item => {
            const currentPrice = getItemPrice(item.id) || item.price || 100;
            const stockSymbol = ITEM_TO_STOCK_MAPPING[item.id]?.symbol || 'N/A';
            totalValue += currentPrice;
            
            portfolioText += `${item.emoji} ${item.name} (${stockSymbol}): ${formatNumber(currentPrice)}G\n`;
        });
        
        if (allUserItems.length > 5) {
            portfolioText += `... 그리고 ${allUserItems.length - 5}개 더\n`;
        }
        
        portfolioText += `\n💼 **총 아이템 가치**: ${formatNumber(totalValue)}G`;
        
        embed.addFields({
            name: '💹 내 보유 아이템',
            value: portfolioText,
            inline: false
        });
    }
    
    // 3. 시장 지수 & 섹터 분석
    const marketTrend = LOOT_MARKET.marketState.trend;
    const volatility = LOOT_MARKET.marketState.volatility;
    
    let marketIndices = '**주요 지수**\n';
    marketIndices += `🏆 Hunter Index: ${marketTrend > 0 ? '+' : ''}${marketTrend.toFixed(2)}% ${marketTrend > 0 ? '📈' : '📉'}\n`;
    marketIndices += `🌍 Volatility: ${volatility.toFixed(1)}% ${volatility > 50 ? '(높음)' : '(낮음)'}\n`;
    marketIndices += `📊 Volume: ${formatNumber(Math.floor(Math.random() * 1000000))}\n\n`;
    
    marketIndices += '**섹터별 퍼포먼스**\n';
    marketIndices += `🧪 재료: ${(Math.random() * 10 - 5).toFixed(2)}%\n`;
    marketIndices += `💎 희귀재료: ${(Math.random() * 10 - 5).toFixed(2)}%\n`;
    marketIndices += `🔥 변이드롭: ${(Math.random() * 10 - 5).toFixed(2)}%\n`;
    marketIndices += `🎁 감정결과: ${(Math.random() * 10 - 5).toFixed(2)}%`;
    
    embed.addFields({
        name: '🌐 시장 현황',
        value: marketIndices,
        inline: false
    });
    
    // 감정사의 조언
    let strategy = '**현명한 감정사의 조언**\n';
    if (marketTrend > 50) {
        strategy += '🔴 **판매 권장** - 시장이 과열되었습니다. 지금 파는 것이 좋습니다.';
    } else if (marketTrend > 0) {
        strategy += '🟡 **보유 권장** - 상승 추세가 지속될 가능성이 높습니다.';
    } else if (marketTrend > -30) {
        strategy += '🟠 **중립** - 방향성을 지켜보며 대기하세요.';
    } else {
        strategy += '🟢 **보관 권장** - 지금 사서 창고에 보관하기 좋은 시기입니다.';
    }
    
    embed.addFields({
        name: '🤖 감정사의 추천',
        value: strategy,
        inline: false
    });
    
    // TradingView 스타일 푸터
    embed.setFooter({ 
        text: 'Data provided by AlphaVantage • Charts powered by TradingView • Updates every 1min',
        iconURL: 'https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723793/tradingview_icon.png'
    });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('appraiser_detailed_chart')
                .setLabel('📊 상세 차트')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('appraiser_market')
                .setLabel('📋 시세표')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('appraiser_sell')
                .setLabel('💰 판매하기')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('appraiser_warehouse')
                .setLabel('🏦 창고 보관')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('appraiser_greet')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

module.exports = {
    greetAppraiser,
    showMarketPrices,
    showCategoryPrices,
    sellItems,
    showPriceChart,
    executeSell
};