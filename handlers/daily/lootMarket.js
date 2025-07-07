const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { LOOT_MARKET, updateMarketPrices } = require('../../data/lootMarket');
const { formatTradingViewData, ITEM_TO_STOCK_MAPPING } = require('../../data/chartAPI');
const { getUser, formatNumber } = require('../common/utils');

// 시세 확인 통합 메뉴 (주식, 물고기, 전리품)
async function showMarketPrices(interaction, marketType = null, categoryId = null) {
    // 메인 메뉴에서 오는 경우와 버튼에서 오는 경우 구분
    if (interaction.customId === 'market_prices' && !interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: 64 });
    } else {
        await interaction.deferUpdate().catch(() => {});
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
            embeds: [],
            components: []
        });
    }

    // 시장 타입 선택 화면
    if (!marketType) {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('📊 통합 시세 센터')
            .setDescription('확인하고 싶은 시장을 선택하세요!')
            .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723776/market.gif')
            .addFields(
                {
                    name: '📈 길드 지분 시세',
                    value: '각 길드의 지분 가격과 배당금을 확인합니다.',
                    inline: false
                },
                {
                    name: '🐟 물고기 시세',
                    value: '오늘 낚은 물고기들의 가격을 확인합니다.',
                    inline: false
                },
                {
                    name: '🎯 전리품 시세',
                    value: '사냥으로 얻은 재료들의 시세를 확인합니다.',
                    inline: false
                }
            )
            .setFooter({ text: '모든 시세는 실시간으로 변동됩니다' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('market_type_select')
            .setPlaceholder('📊 시장을 선택하세요')
            .addOptions([
                {
                    label: '길드 지분',
                    description: '길드별 지분 가격',
                    value: 'stock',
                    emoji: '📈'
                },
                {
                    label: '물고기 시세',
                    description: '어종별 가격 정보',
                    value: 'fish',
                    emoji: '🐟'
                },
                {
                    label: '전리품 시세',
                    description: '재료별 가격 정보',
                    value: 'loot',
                    emoji: '🎯'
                }
            ]);

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        const replyMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
        return await interaction[replyMethod]({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(selectMenu), buttons],
            flags: 64
        });
    }

    // 주식 시세
    if (marketType === 'stock') {
        return await showStockMarket(interaction);
    }
    
    // 물고기 시세
    else if (marketType === 'fish') {
        return await showFishMarket(interaction);
    }
    
    // 전리품 시세
    else if (marketType === 'loot') {
        // 시세 업데이트
        updateMarketPrices();

        // 카테고리 선택되지 않은 경우 카테고리 목록 표시
        if (!categoryId) {
            const embed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle('🎯 전리품 시세 정보')
                .setDescription(`현재 시장 동향을 확인하세요!\n\n📈 **시장 상태**: ${LOOT_MARKET.marketState.trend >= 0 ? '활발' : '침체'} (${Math.abs(LOOT_MARKET.marketState.trend)}%)`)
                .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723776/market.gif')
            .addFields(
                { name: '📋 카테고리', value: '아래에서 확인하고 싶은 카테고리를 선택하세요', inline: false }
            )
            .setFooter({ text: '시세는 1분마다 자동으로 변동됩니다' })
            .setTimestamp();

        // 카테고리별 요약 정보
        Object.entries(LOOT_MARKET.categories).forEach(([key, category]) => {
            const avgChange = category.items.reduce((sum, item) => sum + (item.change || 0), 0) / category.items.length;
            const changeEmoji = avgChange > 0 ? '📈' : avgChange < 0 ? '📉' : '➖';
            
            embed.addFields({
                name: `${changeEmoji} ${category.name}`,
                value: `평균 변동률: ${avgChange > 0 ? '+' : ''}${avgChange.toFixed(2)}%`,
                inline: true
            });
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('market_category_select')
            .setPlaceholder('📊 카테고리를 선택하세요')
            .addOptions([
                {
                    label: '재료',
                    description: '기본 재료 아이템의 시세',
                    value: 'materials',
                    emoji: '🧪'
                },
                {
                    label: '희귀 재료',
                    description: '희귀 재료 아이템의 시세',
                    value: 'rare_materials',
                    emoji: '💎'
                },
                {
                    label: '변이 드롭',
                    description: '변이 몬스터 드롭 아이템의 시세',
                    value: 'mutation_drops',
                    emoji: '🔥'
                },
                {
                    label: '감정 결과물',
                    description: '감정사를 통해 얻은 아이템의 시세',
                    value: 'appraisal_results',
                    emoji: '🔮'
                }
            ]);

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('market_refresh')
                    .setLabel('🔄 새로고침')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('market_back_to_type')
                    .setLabel('📊 시장 선택')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        const replyMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
        return await interaction[replyMethod]({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(selectMenu), buttons],
            flags: 64
        });
    }

    // 특정 카테고리 시세 표시 (페이지네이션 추가)
    const category = LOOT_MARKET.categories[categoryId];
    if (!category) {
        return await interaction.editReply({ 
            content: '❌ 잘못된 카테고리입니다.',
            embeds: [],
            components: []
        });
    }

    // 페이지 정보 파싱 (customId에서 페이지 정보 추출)
    let currentPage = 0;
    let chartType = 'candlestick'; // 기본 차트 타입
    
    if (interaction.customId && interaction.customId.includes('_page_')) {
        const parts = interaction.customId.split('_page_');
        currentPage = parseInt(parts[1]) || 0;
        
        // 차트 타입 확인
        if (parts[1] && parts[1].includes('_chart_')) {
            const chartParts = parts[1].split('_chart_');
            currentPage = parseInt(chartParts[0]) || 0;
            chartType = chartParts[1] || 'candlestick';
        }
    }

    // 아이템별 시세 정보 정렬
    const sortedItems = [...category.items].sort((a, b) => b.change - a.change);
    const itemsPerPage = 1; // 한 페이지에 하나의 아이템 (큰 차트와 상세 정보)
    const totalPages = sortedItems.length;
    const currentItem = sortedItems[currentPage];

    if (!currentItem) {
        currentPage = 0;
        currentItem = sortedItems[0];
    }

    const embed = new EmbedBuilder()
        .setColor('#131722') // TradingView 다크 테마
        .setTitle(`📊 ${category.name} 시세 - ${currentItem.name}`)
        .setDescription(
            `📡 실시간 데이터 스트리밍 중...\n` +
            `페이지: ${currentPage + 1}/${totalPages}\n` +
            `마지막 업데이트: <t:${Math.floor(Date.now() / 1000)}:R>`
        )
        .setFooter({ text: 'Data by AlphaVantage • Charts by TradingView • Updates every 1min' });

    // 현재 아이템의 상세 정보
    const chartData = formatTradingViewData(currentItem.id);
    const { getProfessionalChartUrl, generateChartData } = require('../../data/chartService');
    
    if (chartData || currentItem) {
        // DB에서 실제 가격 히스토리 가져오기
        const marketPriceService = require('../../services/MarketPriceService');
        const dbHistory = await marketPriceService.getItemPriceHistory(currentItem.id, 48);
        
        let priceHistory;
        if (dbHistory && dbHistory.length > 0) {
            priceHistory = dbHistory;
        } else {
            // DB에 데이터가 없으면 시뮬레이션
            priceHistory = [];
            const now = Date.now();
            let simulatedPrice = currentItem.currentPrice || currentItem.basePrice;
            
            // 48시간 동안의 데이터 생성 (2시간 간격)
            for (let i = 23; i >= 0; i--) {
                const time = new Date(now - i * 2 * 3600000); // 2시간 간격
                const variation = (Math.random() - 0.5) * 0.08; // ±4% 변동
                simulatedPrice = Math.max(currentItem.basePrice * 0.7, Math.min(currentItem.basePrice * 1.3, simulatedPrice * (1 + variation)));
                
                priceHistory.push({
                    timestamp: time.getTime(),
                    price: Math.floor(simulatedPrice)
                });
            }
        }
        
        // 차트 데이터 생성
        const chartDataGenerated = generateChartData(
            currentItem.id,
            currentItem.name,
            chartData?.symbol || currentItem.id.toUpperCase(),
            currentItem.currentPrice,
            priceHistory,
            24
        );
        
        // 전문적인 차트 URL 생성
        const chartImageUrl = getProfessionalChartUrl({
            name: currentItem.name,
            symbol: chartData?.symbol || currentItem.id.toUpperCase(),
            prices: chartDataGenerated.prices,
            labels: chartDataGenerated.labels,
            currentPrice: currentItem.currentPrice,
            changePercent: currentItem.change.toFixed(2),
            volume: currentItem.volume || Math.floor(Math.random() * 5000 + 1000)
        });
        
        embed.setImage(chartImageUrl);
        
        // 현재 아이템 정보
        const priceColor = currentItem.change > 0 ? '🟢' : currentItem.change < 0 ? '🔴' : '⚪';
        const arrow = currentItem.change > 0 ? '↑' : currentItem.change < 0 ? '↓' : '→';
        
        embed.addFields({
            name: `${currentItem.emoji} ${currentItem.name} (${chartData.symbol || 'ITEM'})`,
            value: `**현재가**: ${formatNumber(currentItem.currentPrice)}G ${priceColor} ${arrow} ${currentItem.change > 0 ? '+' : ''}${currentItem.change.toFixed(2)}%\n` +
                   `**기준가**: ${formatNumber(currentItem.basePrice)}G\n` +
                   `**거래량**: ${formatNumber(currentItem.volume)}개\n` +
                   `**일일 최고**: ${formatNumber(Math.floor(currentItem.currentPrice * 1.1))}G\n` +
                   `**일일 최저**: ${formatNumber(Math.floor(currentItem.currentPrice * 0.9))}G`,
            inline: false
        });
        
        // 시세 분석
        const indicators = chartData.indicators;
        embed.addFields({
            name: '📈 시세 분석',
            value: `**평균 가격**\n` +
                   `5일: ${formatNumber(indicators.ma5)}G | 20일: ${formatNumber(indicators.ma20)}G\n\n` +
                   `**시장 상태**\n` +
                   `인기도: ${indicators.rsi} ${indicators.rsi > 70 ? '(매우 인기)' : indicators.rsi < 30 ? '(인기 없음)' : '(보통)'}\n` +
                   `추세: ${indicators.macd > 0 ? '상승세' : '하락세'}\n` +
                   `가격 범위: ${formatNumber(indicators.bollingerBands.lower)}G ~ ${formatNumber(indicators.bollingerBands.upper)}G`,
            inline: false
        });
        
        // 거래 추천
        let recommendation = '';
        if (currentItem.change > 5) {
            recommendation = '🔴 **판매 추천** - 지금 팔면 높은 수익을 얻을 수 있습니다!';
        } else if (currentItem.change < -5) {
            recommendation = '🟢 **보관 추천** - 가격이 낮아 창고에 보관하기 좋습니다!';
        } else {
            recommendation = '🟡 **대기 추천** - 좀 더 지켜보고 결정하세요.';
        }
        
        embed.addFields({
            name: '💡 감정사의 조언',
            value: recommendation,
            inline: false
        });
    }

    // 버튼 구성 (페이지네이션 포함)
    const buttons1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`market_item_${categoryId}_page_${Math.max(0, currentPage - 1)}`)
                .setLabel('◀️ 이전')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`market_item_${categoryId}_page_${Math.min(totalPages - 1, currentPage + 1)}`)
                .setLabel('다음 ▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage >= totalPages - 1),
            new ButtonBuilder()
                .setCustomId(`market_item_chart_${currentItem.id}`)
                .setLabel('📊 다른 차트 유형')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`market_refresh_${categoryId}_page_${currentPage}`)
                .setLabel('🔄 새로고침')
                .setStyle(ButtonStyle.Success)
        );

    const buttons2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('market_back')
                .setLabel('📋 카테고리로')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('market_back_to_type')
                .setLabel('📊 시장 선택')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('appraiser_greet')
                .setLabel('💰 감정소 가기')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Danger)
        );

    return await interaction.editReply({
        embeds: [embed],
        components: [buttons1, buttons2]
    });
    }
}

// 길드 지분 시세 표시 (개선된 버전)
async function showStockMarket(interaction) {
    const { getProfessionalChartUrl, generateChartData } = require('../../data/chartService');
    
    // 길드 목록
    const stocks = [
        { name: '김헌터 길드', symbol: 'KHG', emoji: '🏢', price: 152400, change: 2.3, power: '15만' },
        { name: '게임빌드', symbol: 'GBG', emoji: '🎮', price: 84200, change: -1.2, power: '8만' },
        { name: '헌터 은행', symbol: 'HBG', emoji: '🏦', price: 45800, change: 0.8, power: '23만' },
        { name: '모험가 길드', symbol: 'ADG', emoji: '🚀', price: 238000, change: 5.4, power: '47만' },
        { name: '요리사 길드', symbol: 'CKG', emoji: '🍜', price: 12300, change: -0.3, power: '2만' },
        { name: '마법사 길드', symbol: 'MZG', emoji: '⚡', price: 67400, change: 1.7, power: '13만' }
    ];
    
    const embed = new EmbedBuilder()
        .setColor('#131722')
        .setTitle('📈 길드 지분 거래소')
        .setDescription('실시간 지분 가격 • 1분마다 갱신')
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723777/stock.gif');
    
    // 첫 번째 주식의 실제 차트 이미지 생성
    const firstStock = stocks[0];
    
    // DB에서 실제 가격 히스토리 가져오기
    const marketPriceService = require('../../services/MarketPriceService');
    const dbHistory = await marketPriceService.getStockPriceHistory(firstStock.symbol.toLowerCase(), 30 * 24);
    
    let priceHistory;
    if (dbHistory && dbHistory.length > 0) {
        priceHistory = dbHistory;
    } else {
        // DB에 데이터가 없으면 시뮬레이션
        priceHistory = [];
        const now = Date.now();
        let simulatedPrice = firstStock.price;
        
        // 30일간의 일별 데이터 생성
        for (let i = 29; i >= 0; i--) {
            const time = new Date(now - i * 24 * 3600000); // 1일 간격
            const trendEffect = firstStock.change > 0 ? 0.003 : -0.003; // 전체 트렌드 반영
            const randomEffect = (Math.random() - 0.5) * 0.02;
            simulatedPrice = Math.max(firstStock.price * 0.8, Math.min(firstStock.price * 1.2, simulatedPrice * (1 + trendEffect + randomEffect)));
            
            priceHistory.push({
                timestamp: time.getTime(),
                price: Math.floor(simulatedPrice)
            });
        }
    }
    
    // 차트 데이터 생성
    const chartData = generateChartData(
        firstStock.symbol.toLowerCase(),
        firstStock.name,
        firstStock.symbol,
        firstStock.price,
        priceHistory,
        30
    );
    
    // 전문적인 차트 URL 생성
    const chartImageUrl = getProfessionalChartUrl({
        name: firstStock.name,
        symbol: firstStock.symbol,
        prices: chartData.prices,
        labels: chartData.labels,
        currentPrice: firstStock.price,
        changePercent: firstStock.change.toFixed(1),
        volume: Math.floor(Math.random() * 10000000 + 1000000) // 거래량 시뮬레이션
    });
    
    // 차트 이미지 설정
    embed.setImage(chartImageUrl);
    
    // 기술적 지표
    const indicators = {
        rsi: 58.3,
        macd: 142.5,
        volume: '12.5M'
    };
    
    // 첫 번째 길드 정보
    const priceColor = firstStock.change > 0 ? '🟢' : '🔴';
    const arrow = firstStock.change > 0 ? '↑' : '↓';
    
    embed.addFields({
        name: `${firstStock.emoji} ${firstStock.name} (${firstStock.symbol})`,
        value: `**${firstStock.price.toLocaleString()}G** ${priceColor} ${arrow} ${firstStock.change > 0 ? '+' : ''}${firstStock.change}%\n` +
               `최고: ${Math.floor(firstStock.price * 1.02).toLocaleString()}G | 최저: ${Math.floor(firstStock.price * 0.98).toLocaleString()}G`,
        inline: false
    });
    
    embed.addFields({
        name: '💰 거래 신청 현황',
        value: '```diff\n' +
               '+ 구매 152,500G (1,234명)\n' +
               '+ 구매 152,400G (5,678명)\n' +
               '  현재가 152,400G\n' +
               '- 판매 152,500G (3,456명)\n' +
               '- 판매 152,600G (2,345명)\n```',
        inline: true
    });
    
    embed.addFields({
        name: '🔮 예측 지표',
        value: `상승력: ${indicators.rsi}%\n` +
               `추세: ${indicators.macd > 0 ? '상승' : '하락'}\n` +
               `참여자: ${indicators.volume}`,
        inline: true
    });
    
    // 나머지 길드들
    stocks.forEach((stock, index) => {
        if (index === 0) return; // 첫 번째는 이미 표시함
        
        const changeColor = stock.change > 0 ? '🟢' : stock.change < 0 ? '🔴' : '⚪';
        const arrow = stock.change > 0 ? '↑' : stock.change < 0 ? '↓' : '→';
        
        embed.addFields({
            name: `${stock.emoji} ${stock.name} (${stock.symbol})`,
            value: `${changeColor} **${stock.price.toLocaleString()}G** ${arrow} ${stock.change > 0 ? '+' : ''}${stock.change}%\n길드파워: ${stock.power}`,
            inline: true
        });
    });
    
    embed.addFields(
        { name: '\u200B', value: '\u200B', inline: false },
        {
            name: '🌐 전체 시장 현황',
            value: '**헌터 지수**: 2,574 (+0.84%)\n**모험가 지수**: 834 (-0.32%)\n**골드 환율**: 1G = 1.324원',
            inline: false
        }
    )
    .setFooter({ text: '실시간 거래 정보 • 모든 가격은 게임 골드(G) 기준' });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('guild_detail')
                .setLabel('📊 길드 상세정보')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('my_guild_shares')
                .setLabel('💼 내 보유 지분')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('market_back_to_type')
                .setLabel('📊 시장 선택')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 물고기 시세 표시 (개선된 버전)
async function showFishMarket(interaction) {
    const { getProfessionalChartUrl } = require('../../data/chartService');
    
    // 물고기 시세 데이터 (더 자세한 정보)
    const fishData = [
        { id: 'tuna', name: '참치', symbol: 'TUNA', basePrice: 25000, rarity: 'legendary', emoji: '🐟' },
        { id: 'salmon', name: '연어', symbol: 'SLMN', basePrice: 18000, rarity: 'epic', emoji: '🍣' },
        { id: 'mackerel', name: '고등어', symbol: 'MCKR', basePrice: 8000, rarity: 'rare', emoji: '🐠' },
        { id: 'catfish', name: '메기', symbol: 'CTFH', basePrice: 1500, rarity: 'uncommon', emoji: '🐡' },
        { id: 'carp', name: '잉어', symbol: 'CARP', basePrice: 1000, rarity: 'common', emoji: '🐟' }
    ];
    
    // 현재 선택된 물고기 (페이지네이션 고려)
    const selectedFishIndex = 0; // 나중에 페이지네이션 추가 가능
    const selectedFish = fishData[selectedFishIndex];
    
    // DB에서 실제 가격 히스토리 가져오기
    const marketPriceService = require('../../services/MarketPriceService');
    const dbHistory = await marketPriceService.getItemPriceHistory(selectedFish.id, 24);
    
    let priceHistory;
    if (dbHistory && dbHistory.length > 0) {
        priceHistory = dbHistory;
    } else {
        // DB에 데이터가 없으면 시뮬레이션
        priceHistory = [];
        const now = Date.now();
        let currentPrice = selectedFish.basePrice;
        
        // 24시간 동안의 시간별 가격 데이터 생성
        for (let i = 23; i >= 0; i--) {
            const variation = (Math.random() - 0.5) * 0.15; // ±7.5% 변동
            currentPrice = Math.max(selectedFish.basePrice * 0.5, Math.min(selectedFish.basePrice * 1.5, currentPrice * (1 + variation)));
            
            priceHistory.push({
                timestamp: now - i * 3600000, // 1시간 간격
                price: Math.floor(currentPrice)
            });
        }
    }
    
    // 라벨 생성 (시간대별)
    const labels = priceHistory.map(h => {
        const time = new Date(h.timestamp);
        const today = new Date();
        const isToday = time.toDateString() === today.toDateString();
        
        if (isToday) {
            return `${time.getHours()}시`;
        } else {
            return `${time.getMonth() + 1}/${time.getDate()}`;
        }
    });
    
    // 변동률 계산
    const firstPrice = priceHistory[0].price;
    const lastPrice = priceHistory[priceHistory.length - 1].price;
    const changePercent = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
    
    // 전문적인 차트 생성
    const chartImageUrl = getProfessionalChartUrl({
        name: selectedFish.name,
        symbol: selectedFish.symbol,
        prices: priceHistory.map(h => h.price),
        labels: labels,
        currentPrice: lastPrice,
        changePercent: changePercent,
        volume: Math.floor(Math.random() * 1000 + 100) // 거래량
    });
    
    const embed = new EmbedBuilder()
        .setColor('#1E88E5') // 물고기 테마 색상
        .setTitle('🐟 실시간 수산물 거래소')
        .setDescription('수산물 시세 정보 • 24시간 실시간 업데이트')
        .setImage(chartImageUrl)
        .addFields(
            {
                name: `${selectedFish.emoji} ${selectedFish.name} (${selectedFish.symbol})`,
                value: `**현재가**: ${lastPrice.toLocaleString()}G\n` +
                       `**변동률**: ${changePercent >= 0 ? '+' : ''}${changePercent}%\n` +
                       `**24시간 최고**: ${Math.max(...priceHistory.map(h => h.price)).toLocaleString()}G\n` +
                       `**24시간 최저**: ${Math.min(...priceHistory.map(h => h.price)).toLocaleString()}G`,
                inline: false
            },
            {
                name: '📊 시장 분석',
                value: `• **어획량 지수**: ${Math.floor(Math.random() * 50 + 50)}% (${Math.random() > 0.5 ? '증가' : '감소'} 추세)\n` +
                       `• **신선도 프리미엄**: +${Math.floor(Math.random() * 20 + 10)}%\n` +
                       `• **크기 보너스**: 대형 +30%, 특대형 +50%`,
                inline: false
            }
        )
        .addFields(
            {
                name: '🐟 일반 어종',
                value: '**붕어**: 500~1,000G\n**잉어**: 800~1,500G\n**메기**: 1,200~2,000G',
                inline: true
            },
            {
                name: '🐠 희귀 어종',
                value: '**무지개송어**: 3,000~5,000G\n**금붕어**: 5,000~8,000G\n**열대어**: 4,000~7,000G',
                inline: true
            },
            {
                name: '🦈 특수 어종',
                value: '**상어**: 15,000~25,000G\n**가오리**: 12,000~20,000G\n**전기뱀장어**: 18,000~30,000G',
                inline: true
            },
            {
                name: '🐙 심해 어종',
                value: '**대왕오징어**: 50,000~80,000G\n**심해아귀**: 35,000~60,000G\n**투명물고기**: 40,000~70,000G',
                inline: true
            },
            {
                name: '🦞 갑각류',
                value: '**새우**: 2,000~3,500G\n**게**: 4,000~6,000G\n**랍스터**: 8,000~15,000G',
                inline: true
            },
            {
                name: '🐚 조개류',
                value: '**조개**: 1,000~2,000G\n**전복**: 6,000~10,000G\n**진주조개**: 10,000~20,000G',
                inline: true
            }
        )
        .addFields(
            { name: '\u200B', value: '\u200B', inline: false },
            {
                name: '🌊 오늘의 조황',
                value: '**날씨**: ☀️ 맑음\n**파도**: 🌊 잔잔함\n**조류**: 💨 약함\n**물때**: 🌙 사리',
                inline: false
            }
        )
        .addFields(
            { name: '\u200B', value: '\u200B', inline: false },
            {
                name: '🌊 오늘의 낚시 정보',
                value: '**황금 물때**: 오전 6시, 오후 6시\n**추천 미끼**: 지렁이 (+20% 확률)\n**특별 이벤트**: 대물 출현율 2배',
                inline: false
            }
        )
        .setFooter({ text: '낚시왕 협회 제공 • 실시간 어황 정보' });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('fishing_spot')
                .setLabel('🎣 낚시터 가기')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('fish_collection')
                .setLabel('📖 도감 보기')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('market_back_to_type')
                .setLabel('📊 시장 선택')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 시세 확인 인터랙션 처리
async function handleMarketInteraction(interaction) {
    const customId = interaction.customId;

    if (customId === 'market_prices') {
        return await showMarketPrices(interaction);
    }
    
    else if (customId === 'market_type_select') {
        const marketType = interaction.values[0];
        return await showMarketPrices(interaction, marketType);
    }
    
    else if (customId === 'market_category_select') {
        const categoryId = interaction.values[0];
        return await showMarketPrices(interaction, 'loot', categoryId);
    }
    
    else if (customId === 'market_back') {
        return await showMarketPrices(interaction, 'loot');
    }
    
    else if (customId === 'market_back_to_type') {
        return await showMarketPrices(interaction);
    }
    
    // 페이지네이션 처리
    else if (customId.startsWith('market_item_')) {
        const parts = customId.split('_');
        const categoryId = parts[2];
        const page = parts[4] ? parseInt(parts[4]) : 0;
        
        // customId를 수정하여 페이지 정보 전달
        interaction.customId = `market_category_select_page_${page}`;
        return await showMarketPrices(interaction, 'loot', categoryId);
    }
    
    // 새로고침 처리 (페이지 유지)
    else if (customId.startsWith('market_refresh_')) {
        const parts = customId.split('_');
        const categoryId = parts[2];
        const page = parts[4] ? parseInt(parts[4]) : 0;
        
        interaction.customId = `market_category_select_page_${page}`;
        return await showMarketPrices(interaction, 'loot', categoryId);
    }
    
    else if (customId === 'market_refresh') {
        // 현재 화면 유지하면서 새로고침
        const embed = interaction.message.embeds[0];
        const title = embed.title;
        
        if (title.includes('주식')) {
            return await showStockMarket(interaction);
        } else if (title.includes('물고기')) {
            return await showFishMarket(interaction);
        } else if (title.includes('전리품')) {
            const currentCategory = title.includes('재료') ? 'materials' :
                                  title.includes('희귀') ? 'rare_materials' :
                                  title.includes('변이') ? 'mutation_drops' :
                                  title.includes('감정') ? 'appraisal_results' : null;
            
            return await showMarketPrices(interaction, 'loot', currentCategory);
        } else {
            return await showMarketPrices(interaction);
        }
    }
    
    // 차트 유형 변경 처리
    else if (customId.startsWith('market_item_chart_')) {
        const itemId = customId.split('market_item_chart_')[1];
        
        try {
            await interaction.deferUpdate();
            
            // 현재 차트 타입 파악 (embed 내용 기반)
            const embed = interaction.message.embeds[0];
            const isCandle = embed.image?.url?.includes('candlestick');
            
            // 차트 타입 전환하여 다시 표시
            const newChartType = isCandle ? 'line' : 'candlestick';
            
            // 카테고리와 페이지 정보 파싱
            const title = embed.title || '';
            const description = embed.description || '';
            const pageMatch = description.match(/페이지: (\d+)\/(\d+)/);
            const currentPage = pageMatch ? parseInt(pageMatch[1]) - 1 : 0;
            
            // 카테고리 찾기 (더 정확한 매칭)
            let categoryId = 'materials'; // 기본값
            
            // 제목에서 카테고리 찾기
            if (title.includes('재료') && !title.includes('희귀')) {
                categoryId = 'materials';
            } else if (title.includes('희귀 재료')) {
                categoryId = 'rare_materials';
            } else if (title.includes('변이 드롭')) {
                categoryId = 'mutation_drops';
            } else if (title.includes('감정 결과물')) {
                categoryId = 'appraisal_results';
            }
            
            // 차트 타입을 customId에 추가하여 전달
            interaction.customId = `market_category_select_page_${currentPage}_chart_${newChartType}`;
            return await showMarketPrices(interaction, 'loot', categoryId);
        } catch (error) {
            console.error('차트 유형 변경 오류:', error);
            return;
        }
    }
}

module.exports = {
    showMarketPrices,
    handleMarketInteraction
};