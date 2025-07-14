const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { COMPANIES, SECTORS, getCompanyById } = require('../../data/companiesData');
const MissionHelper = require('../../utils/missionHelper');

// Constants
const CHART_WIDTH = 40;
const CHART_HEIGHT = 10;
const MAX_PRICE_HISTORY = 50;
const COMMISSION_RATE = 0.001; // 0.1% commission

// In-memory price history (in production, this should be in database)
const priceHistory = new Map();
const orderBook = new Map(); // For limit orders
const marketNews = []; // Recent news events
const playerAchievements = new Map(); // Trading achievements

// Trading achievements
const ACHIEVEMENTS = {
    FIRST_TRADE: { name: '첫 투자', desc: '첫 기업 지분 획득', icon: '🎯', reward: 1000 },
    PROFIT_10K: { name: '황금 수확', desc: '한 번에 1만G 이상 수익 달성', icon: '💰', reward: 5000 },
    PROFIT_100K: { name: '왕국의 부자', desc: '한 번에 10만G 이상 수익 달성', icon: '💎', reward: 50000 },
    DIVERSIFIED: { name: '현명한 투자자', desc: '5개 이상 다른 기업에 투자', icon: '🌈', reward: 10000 },
    SECTOR_MASTER: { name: '길드 정복자', desc: '한 길드의 모든 기업 지분 획득', icon: '🏆', reward: 25000 },
    MILLIONAIRE: { name: '왕국의 거상', desc: '총 자산 100만G 달성', icon: '🤑', reward: 100000 },
    DAY_TRADER: { name: '번개 거래왕', desc: '하루에 10번 이상 거래', icon: '⚡', reward: 15000 },
    DIAMOND_HANDS: { name: '강철 의지', desc: '큰 손실에도 불구하고 홀드', icon: '💎', reward: 20000 },
    PERFECT_TIMING: { name: '예언자의 눈', desc: '최저가 매수 후 최고가 매도', icon: '🎯', reward: 30000 },
    NEWS_TRADER: { name: '정보통', desc: '속보 발생 1분 이내 거래', icon: '📰', reward: 10000 }
};

// Initialize price history for all companies
function initializePriceHistory() {
    Object.keys(COMPANIES).forEach(companyId => {
        if (!priceHistory.has(companyId)) {
            priceHistory.set(companyId, [{
                timestamp: Date.now(),
                price: COMPANIES[companyId].currentPrice,
                volume: 0
            }]);
        }
    });
}

// Generate QuickChart URL for price chart (improved version)
function generatePriceChartUrl(history, companyName, currentPrice, symbol) {
    const { getProfessionalChartUrl } = require('../../data/chartService');
    
    let prices = [];
    let timeLabels = [];
    const now = Date.now();
    
    // 히스토리가 있으면 실제 데이터 사용
    if (history && history.length > 0) {
        // 최근 20개 데이터 사용 (더 길고 전문적인 차트)
        const recentHistory = history.slice(-20);
        
        recentHistory.forEach(h => {
            prices.push(h.price || currentPrice || 100000);
            
            const time = new Date(h.timestamp || now);
            const today = new Date();
            const isToday = time.toDateString() === today.toDateString();
            
            // 오늘이면 시간만, 아니면 날짜도 표시
            if (isToday) {
                const hours = time.getHours().toString().padStart(2, '0');
                const minutes = time.getMinutes().toString().padStart(2, '0');
                timeLabels.push(`${hours}:${minutes}`);
            } else {
                const month = (time.getMonth() + 1).toString().padStart(2, '0');
                const day = time.getDate().toString().padStart(2, '0');
                const hours = time.getHours().toString().padStart(2, '0');
                timeLabels.push(`${month}/${day} ${hours}시`);
            }
        });
        
        // 부족한 데이터 채우기
        const basePrice = prices.length > 0 ? prices[prices.length - 1] : (currentPrice || 100000);
        while (prices.length < 20) {
            const variation = (Math.random() - 0.5) * 0.05; // ±2.5% 변동
            const newPrice = Math.floor(basePrice * (1 + variation));
            prices.unshift(newPrice);
            
            const time = new Date(now - (20 - prices.length) * 3600000); // 1시간 간격
            const hours = time.getHours().toString().padStart(2, '0');
            timeLabels.unshift(`${hours}:00`);
        }
    } else {
        // 히스토리가 없으면 시뮬레이션 데이터 생성
        const basePrice = currentPrice || 100000;
        let simulatedPrice = basePrice;
        const trend = Math.random() > 0.5 ? 1 : -1;
        
        for (let i = 19; i >= 0; i--) {
            const trendEffect = trend * Math.random() * 0.02;
            const randomEffect = (Math.random() - 0.5) * 0.01;
            simulatedPrice = Math.max(1, Math.floor(simulatedPrice * (1 + trendEffect + randomEffect)));
            prices.push(simulatedPrice);
            
            const time = new Date(now - i * 3600000); // 1시간 간격
            const today = new Date();
            const isToday = time.toDateString() === today.toDateString();
            
            if (isToday) {
                const hours = time.getHours().toString().padStart(2, '0');
                timeLabels.push(`${hours}:00`);
            } else {
                const month = (time.getMonth() + 1).toString().padStart(2, '0');
                const day = time.getDate().toString().padStart(2, '0');
                timeLabels.push(`${month}/${day}`);
            }
        }
    }
    
    // 가격 변동률 계산
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const changePercent = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
    
    // 거래량 시뮬레이션 (실제 거래량이 없을 경우)
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const volume = Math.floor(Math.random() * 50000 + 10000);
    
    // 전문적인 차트 URL 생성
    return getProfessionalChartUrl({
        name: companyName || '알 수 없는 종목',
        symbol: symbol || 'UNKNOWN',
        prices: prices,
        labels: timeLabels,
        currentPrice: lastPrice,
        changePercent: changePercent,
        volume: volume
    });
}

// Generate ASCII price chart (fallback)
function generatePriceChart(history, currentPrice) {
    if (!history || history.length < 2) {
        // 가상 데이터 생성
        const basePrice = currentPrice || 100000;
        history = [];
        for (let i = 0; i < 20; i++) {
            const variation = (Math.random() - 0.5) * 0.1;
            history.push({
                price: Math.floor(basePrice * (1 + variation)),
                timestamp: Date.now() - (20 - i) * 60000
            });
        }
    }

    const prices = history.slice(-CHART_WIDTH).map(h => h.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    // Create empty chart
    const chart = Array(CHART_HEIGHT).fill(null).map(() => Array(prices.length).fill(' '));

    // Plot prices
    prices.forEach((price, x) => {
        const y = Math.floor((1 - (price - minPrice) / priceRange) * (CHART_HEIGHT - 1));
        if (y >= 0 && y < CHART_HEIGHT) {
            chart[y][x] = '█';
        }
    });

    // Add price labels
    const maxLabel = `${formatNumber(maxPrice)}G`;
    const minLabel = `${formatNumber(minPrice)}G`;
    
    // Build chart string
    let chartStr = '```\n';
    chartStr += maxLabel.padStart(10) + ' ┤' + '\n';
    
    chart.forEach((row, i) => {
        const rowStr = row.join('');
        if (i === 0) {
            chartStr += '          │' + rowStr + '\n';
        } else if (i === CHART_HEIGHT - 1) {
            chartStr += minLabel.padStart(10) + ' ┤' + rowStr + '\n';
        } else {
            chartStr += '          │' + rowStr + '\n';
        }
    });
    
    chartStr += '          └' + '─'.repeat(prices.length) + '\n';
    chartStr += '```';

    return chartStr;
}

// Calculate technical indicators
function calculateIndicators(history) {
    if (!history || history.length < 2) {
        return { 
            trend: 'NEUTRAL', 
            strength: 0, 
            volume: 0,
            ma5: 0,
            ma10: 0,
            priceChange: 0
        };
    }

    const recent = history.slice(-20);
    const prices = recent.map(h => h.price);
    
    // Calculate moving averages
    const ma5 = prices.length >= 5 ? 
        prices.slice(-5).reduce((a, b) => a + b, 0) / 5 : 
        prices.reduce((a, b) => a + b, 0) / prices.length;
    
    const ma10 = prices.length >= 10 ? 
        prices.slice(-10).reduce((a, b) => a + b, 0) / 10 : 
        prices.reduce((a, b) => a + b, 0) / prices.length;
    
    // Calculate trend
    const currentPrice = prices[prices.length - 1];
    const firstPrice = prices[0];
    const priceChange = firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0;
    
    let trend = 'NEUTRAL';
    if (ma5 > ma10 * 1.02) trend = 'BULLISH';
    else if (ma5 < ma10 * 0.98) trend = 'BEARISH';
    
    // Calculate volume
    const totalVolume = recent.reduce((sum, h) => sum + (h.volume || 0), 0);
    
    return {
        trend,
        strength: Math.abs(priceChange),
        volume: totalVolume,
        ma5: ma5 || 0,
        ma10: ma10 || 0,
        priceChange: priceChange || 0
    };
}

// Show stock detail with chart
async function showStockDetail(interaction, companyId) {
    const company = getCompanyById(companyId);
    if (!company) {
        return await interaction.reply({
            content: '❌ 존재하지 않는 기업입니다.',
            flags: 64
        });
    }

    const user = await getUser(interaction.user.id);
    const portfolio = await getPlayerPortfolio(user.discordId);
    const holding = portfolio.stocks.get(companyId);
    
    // 실제 가격 히스토리를 DB에서 가져오기
    const marketPriceService = require('../../services/MarketPriceService');
    const dbHistory = await marketPriceService.getStockPriceHistory(companyId, 24);
    const history = dbHistory || priceHistory.get(companyId) || [];
    const indicators = calculateIndicators(history);
    
    // Create detail embed
    const detailEmbed = new EmbedBuilder()
        .setColor(indicators.trend === 'BULLISH' ? '#00ff00' : indicators.trend === 'BEARISH' ? '#ff0000' : '#ffff00')
        .setTitle(`${company.emoji} ${company.name}`)
        .setDescription(company.description)
        .addFields(
            { name: '📊 현재가', value: `${formatNumber(company.currentPrice)}G`, inline: true },
            { name: '📈 변동률', value: `${indicators.priceChange >= 0 ? '+' : ''}${indicators.priceChange.toFixed(2)}%`, inline: true },
            { name: '🏢 섹터', value: SECTORS[company.sector]?.name || company.sector, inline: true },
            { name: '💹 거래량', value: formatNumber(indicators.volume), inline: true },
            { name: '📉 5일 이평', value: `${formatNumber(Math.floor(indicators.ma5))}G`, inline: true },
            { name: '📊 추세', value: getTrendEmoji(indicators.trend), inline: true }
        );

    // Add holding info if user owns this stock
    if (holding) {
        const currentValue = company.currentPrice * holding.shares;
        const profit = (company.currentPrice - holding.avgPrice) * holding.shares;
        const profitPercent = ((company.currentPrice - holding.avgPrice) / holding.avgPrice * 100).toFixed(2);
        
        detailEmbed.addFields(
            { name: '\u200B', value: '**📊 보유 현황**', inline: false },
            { name: '보유량', value: `${holding.shares}주`, inline: true },
            { name: '평균가', value: `${formatNumber(holding.avgPrice)}G`, inline: true },
            { name: '평가손익', value: `${profit >= 0 ? '+' : ''}${formatNumber(profit)}G (${profitPercent}%)`, inline: true }
        );
    }

    // Add price chart using improved QuickChart
    const chartUrl = generatePriceChartUrl(history, company.name, company.currentPrice, company.symbol);
    if (chartUrl) {
        console.log('[차트 URL]', chartUrl);
        console.log('[히스토리 길이]', history ? history.length : 0);
        detailEmbed.setImage(chartUrl);
        
        // 차트 정보 추가
        const chartInfo = history && history.length > 0 
            ? `최근 ${Math.min(history.length, 20)}개 거래 기록 기반`
            : '시뮬레이션 데이터 (실제 거래 후 업데이트됩니다)';
        
        detailEmbed.addFields({ 
            name: '📊 가격 차트', 
            value: chartInfo, 
            inline: false 
        });
    } else {
        // Fallback to ASCII chart
        const chart = generatePriceChart(history, company.currentPrice);
        detailEmbed.addFields({ name: '📈 가격 차트 (텍스트)', value: chart, inline: false });
    }

    // Add market sensitivity info
    if (company.sensitivity) {
        let sensitivityText = '';
        if (company.sensitivity.weather) {
            const weatherEffects = Object.entries(company.sensitivity.weather)
                .filter(([_, mult]) => mult !== 1)
                .map(([weather, mult]) => `${weather}: ${mult > 1 ? '+' : ''}${((mult - 1) * 100).toFixed(0)}%`);
            if (weatherEffects.length > 0) {
                sensitivityText += `**날씨 영향**: ${weatherEffects.join(', ')}\n`;
            }
        }
        if (company.sensitivity.news) {
            const newsEffects = Object.entries(company.sensitivity.news)
                .map(([news, mult]) => `${news}: ${mult > 1 ? '+' : ''}${((mult - 1) * 100).toFixed(0)}%`);
            if (newsEffects.length > 0) {
                sensitivityText += `**뉴스 민감도**: ${newsEffects.join(', ')}\n`;
            }
        }
        if (sensitivityText) {
            detailEmbed.addFields({ name: '🌟 시장 민감도', value: sensitivityText, inline: false });
        }
    }

    // Create buttons - 매수/매도 옵션 추가
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`stock_buy_${companyId}_10`)
                .setLabel('💰 10주 매수')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`stock_buy_${companyId}_100`)
                .setLabel('💰 100주 매수')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`stock_buy_${companyId}_1000`)
                .setLabel('💰 1000주 매수')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`stock_buy_${companyId}_all`)
                .setLabel('💰 최대 매수')
                .setStyle(ButtonStyle.Primary)
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`stock_sell_${companyId}_10`)
                .setLabel('💸 10주 매도')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`stock_sell_${companyId}_100`)
                .setLabel('💸 100주 매도')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`stock_sell_${companyId}_1000`)
                .setLabel('💸 1000주 매도')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`stock_sell_${companyId}_all`)
                .setLabel('💸 전량 매도')
                .setStyle(ButtonStyle.Danger)
        );
    
    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_portfolio')
                .setLabel('💼 포트폴리오')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stock_list')
                .setLabel('📊 종목 목록')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stock_market')
                .setLabel('🔙 주식 시장')
                .setStyle(ButtonStyle.Secondary)
        );

    // interaction이 이미 응답된 경우 update 사용
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({
            embeds: [detailEmbed],
            components: [row1, row2, row3]
        });
    }
    
    return await interaction.reply({
        embeds: [detailEmbed],
        components: [row1, row2, row3],
        flags: 64
    });
}

// Get player portfolio
async function getPlayerPortfolio(userId) {
    try {
        const user = await User.findOne({ discordId: userId }).select('gold stockPortfolio');
        
        const portfolio = {
            cash: user?.gold || 0,
            stocks: new Map(),
            totalValue: user?.gold || 0,
            totalInvested: user?.stockPortfolio?.totalInvested || 0,
            limitOrders: []
        };
        
        if (user?.stockPortfolio?.stocks) {
            for (const [companyId, stockData] of user.stockPortfolio.stocks) {
                portfolio.stocks.set(companyId, {
                    shares: stockData.shares,
                    avgPrice: stockData.avgPrice
                });
                
                const company = getCompanyById(companyId);
                if (company) {
                    portfolio.totalValue += company.currentPrice * stockData.shares;
                }
            }
        }
        
        // Get limit orders
        const limitOrders = orderBook.get(userId) || [];
        portfolio.limitOrders = limitOrders;
        
        return portfolio;
    } catch (error) {
        console.error('Portfolio load error:', error);
        return {
            cash: 0,
            stocks: new Map(),
            totalValue: 0,
            totalInvested: 0,
            limitOrders: []
        };
    }
}

// Show portfolio
async function showPortfolio(interaction) {
    const portfolio = await getPlayerPortfolio(interaction.user.id);
    
    const portfolioEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💼 주식 포트폴리오')
        .setDescription(`총 자산: **${formatNumber(portfolio.totalValue)}G**`)
        .addFields(
            { name: '💰 현금', value: `${formatNumber(portfolio.cash)}G`, inline: true },
            { name: '📊 주식 평가액', value: `${formatNumber(portfolio.totalValue - portfolio.cash)}G`, inline: true },
            { name: '💸 총 투자금', value: `${formatNumber(portfolio.totalInvested)}G`, inline: true }
        );

    // Add stock holdings
    if (portfolio.stocks.size > 0) {
        let stockList = '';
        let totalProfit = 0;
        
        for (const [companyId, holding] of portfolio.stocks) {
            const company = getCompanyById(companyId);
            if (company) {
                const currentValue = company.currentPrice * holding.shares;
                const profit = (company.currentPrice - holding.avgPrice) * holding.shares;
                totalProfit += profit;
                
                stockList += `${company.emoji} **${company.name}**\n`;
                stockList += `${holding.shares}주 | 평균가: ${formatNumber(holding.avgPrice)}G | 현재가: ${formatNumber(company.currentPrice)}G\n`;
                stockList += `평가액: ${formatNumber(currentValue)}G | 손익: ${profit >= 0 ? '+' : ''}${formatNumber(profit)}G\n\n`;
            }
        }
        
        portfolioEmbed.addFields(
            { name: '📈 보유 종목', value: stockList || '없음', inline: false },
            { name: '💹 총 평가손익', value: `${totalProfit >= 0 ? '+' : ''}${formatNumber(totalProfit)}G`, inline: false }
        );
    } else {
        portfolioEmbed.addFields({ name: '📈 보유 종목', value: '보유한 주식이 없습니다.', inline: false });
    }

    // Add limit orders
    if (portfolio.limitOrders.length > 0) {
        let orderList = '';
        portfolio.limitOrders.forEach(order => {
            const company = getCompanyById(order.companyId);
            if (company) {
                orderList += `${order.type === 'BUY' ? '🟢' : '🔴'} ${company.name}: ${order.shares}주 @ ${formatNumber(order.price)}G\n`;
            }
        });
        portfolioEmbed.addFields({ name: '📋 지정가 주문', value: orderList, inline: false });
    }

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_list')
                .setLabel('📊 종목 목록')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_sectors')
                .setLabel('🏢 섹터별 보기')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_rankings')
                .setLabel('🏆 순위')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stock_market')
                .setLabel('🔙 주식 시장')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    // interaction이 이미 응답된 경우 update 사용
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({
            embeds: [portfolioEmbed],
            components: [buttons]
        });
    }
    
    return await interaction.reply({
        embeds: [portfolioEmbed],
        components: [buttons],
        flags: 64
    });
}

// Buy stock
async function buyStock(interaction, companyId, shares) {
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return { success: false, message: '먼저 회원가입을 해주세요!' };
    }

    const company = getCompanyById(companyId);
    if (!company) {
        return { success: false, message: '존재하지 않는 기업입니다!' };
    }

    const totalCost = Math.ceil(company.currentPrice * shares * (1 + COMMISSION_RATE));
    
    if (user.gold < totalCost) {
        return { success: false, message: `자금이 부족합니다! (필요: ${formatNumber(totalCost)}G)` };
    }

    // Execute trade
    const updateResult = await User.updateOne(
        { discordId: user.discordId, gold: { $gte: totalCost } },
        {
            $inc: { 
                gold: -totalCost,
                'stockPortfolio.totalInvested': totalCost
            },
            $set: { 'stockPortfolio.lastUpdate': new Date() }
        }
    );

    if (updateResult.matchedCount === 0) {
        return { success: false, message: '거래 처리 중 오류가 발생했습니다.' };
    }

    // Update stock holdings
    const updatedUser = await User.findOne({ discordId: user.discordId });
    if (!updatedUser.stockPortfolio) {
        updatedUser.stockPortfolio = { stocks: new Map(), totalInvested: 0, lastUpdate: new Date() };
    }

    const currentStock = updatedUser.stockPortfolio.stocks.get(companyId);
    if (currentStock) {
        const newAvgPrice = (currentStock.avgPrice * currentStock.shares + company.currentPrice * shares) / (currentStock.shares + shares);
        updatedUser.stockPortfolio.stocks.set(companyId, {
            shares: currentStock.shares + shares,
            avgPrice: newAvgPrice
        });
    } else {
        updatedUser.stockPortfolio.stocks.set(companyId, {
            shares: shares,
            avgPrice: company.currentPrice
        });
    }

    await updatedUser.save();
    
    // 미션 진행도 업데이트
    await MissionHelper.updateStockTrade(interaction.user.id);

    // Update price history
    updatePriceHistory(companyId, company.currentPrice, shares);

    // Simulate price impact
    const priceImpact = calculatePriceImpact(shares, company.shares);
    company.currentPrice = Math.floor(company.currentPrice * (1 + priceImpact));

    // Check achievements
    const achievements = await checkAchievements(user.discordId, 'TRADE', { type: 'BUY' });
    const portfolio = await getPlayerPortfolio(user.discordId);
    await checkAchievements(user.discordId, 'PORTFOLIO', { 
        stockCount: portfolio.stocks.size,
        totalValue: portfolio.totalValue 
    });

    // Check if this was a news trade
    const recentNews = marketNews.find(news => 
        news.companyId === companyId && 
        (Date.now() - news.timestamp) < 60000 // Within 1 minute
    );
    if (recentNews) {
        await checkAchievements(user.discordId, 'NEWS_TRADE', {});
    }

    let message = `✅ ${company.name} ${shares}주를 ${formatNumber(company.currentPrice)}G에 매수했습니다!\n수수료: ${formatNumber(Math.ceil(totalCost - company.currentPrice * shares))}G`;
    
    if (achievements.length > 0) {
        message += '\n\n🎉 **업적 달성!**\n';
        achievements.forEach(ach => {
            message += `${ach.icon} ${ach.name} - 보상: ${formatNumber(ach.reward)}G\n`;
        });
    }

    // 재미있는 응원 메시지 생성
    const cheerMessages = [
        '🚀 떡상 가즈아!!!',
        '📈 주린이 탈출 기원합니다!',
        '💎 다이아몬드 손 인증!',
        '🌙 달나라까지 가즈아!',
        '💰 부자되세요~',
        '🎯 신의 한 수였길!',
        '🔥 불타오르네!',
        '⚡ 번개 상승 기원!',
        '🌈 무지개 떡상 가자!'
    ];
    
    const randomCheer = cheerMessages[Math.floor(Math.random() * cheerMessages.length)];
    
    // 공개 메시지 생성 (채널에 전송될 메시지)
    const publicMessage = `📈 **${interaction.user.username}**님이 ${company.emoji} **${company.name}** ${formatNumber(shares)}주를 ${formatNumber(company.currentPrice)}G에 매수했습니다!\n${randomCheer}`;
    
    // 채널에 공개 메시지 전송
    try {
        await interaction.channel.send(publicMessage);
    } catch (error) {
        console.error('주식 매수 응원 메시지 전송 실패:', error);
    }

    return {
        success: true,
        message,
        achievements,
        publicMessage
    };
}

// Sell stock
async function sellStock(interaction, companyId, shares) {
    const user = await getUser(interaction.user.id);
    const portfolio = await getPlayerPortfolio(user.discordId);
    
    const company = getCompanyById(companyId);
    if (!company) {
        return { success: false, message: '존재하지 않는 기업입니다!' };
    }

    const holding = portfolio.stocks.get(companyId);
    if (!holding || holding.shares < shares) {
        return { success: false, message: '보유 수량이 부족합니다!' };
    }

    const totalValue = Math.floor(company.currentPrice * shares * (1 - COMMISSION_RATE));

    // Update user gold
    await User.updateOne(
        { discordId: user.discordId },
        { $inc: { gold: totalValue } }
    );

    // Update holdings
    const updatedUser = await User.findOne({ discordId: user.discordId });
    const currentStock = updatedUser.stockPortfolio.stocks.get(companyId);

    if (currentStock.shares <= shares) {
        updatedUser.stockPortfolio.stocks.delete(companyId);
    } else {
        updatedUser.stockPortfolio.stocks.set(companyId, {
            shares: currentStock.shares - shares,
            avgPrice: currentStock.avgPrice
        });
    }

    updatedUser.stockPortfolio.lastUpdate = new Date();
    await updatedUser.save();
    
    // 미션 진행도 업데이트
    await MissionHelper.updateStockTrade(interaction.user.id);

    // Update price history
    updatePriceHistory(companyId, company.currentPrice, shares);

    // Simulate price impact (negative for selling)
    const priceImpact = calculatePriceImpact(shares, company.shares) * -0.8;
    company.currentPrice = Math.floor(company.currentPrice * (1 + priceImpact));

    const profit = (company.currentPrice - holding.avgPrice) * shares;

    // Check achievements
    const achievements = await checkAchievements(user.discordId, 'TRADE', { type: 'SELL' });
    if (profit >= 10000) {
        const profitAchievements = await checkAchievements(user.discordId, 'PROFIT', { profit });
        achievements.push(...profitAchievements);
    }

    let message = `✅ ${company.name} ${shares}주를 ${formatNumber(company.currentPrice)}G에 매도했습니다!\n수수료: ${formatNumber(Math.ceil(company.currentPrice * shares - totalValue))}G\n손익: ${profit >= 0 ? '+' : ''}${formatNumber(profit)}G`;
    
    if (achievements.length > 0) {
        message += '\n\n🎉 **업적 달성!**\n';
        achievements.forEach(ach => {
            message += `${ach.icon} ${ach.name} - 보상: ${formatNumber(ach.reward)}G\n`;
        });
        
        // Award achievement rewards
        await User.updateOne(
            { discordId: user.discordId },
            { $inc: { gold: achievements.reduce((sum, ach) => sum + ach.reward, 0) } }
        );
    }

    // 손익에 따른 재미있는 메시지 생성
    let publicMessage = '';
    const profitPercent = ((profit / (holding.avgPrice * shares)) * 100).toFixed(1);
    
    if (profit > 0) {
        // 이익인 경우
        let profitMessage = '';
        if (profit >= 1000000) {
            profitMessage = `🤑 **${interaction.user.username}**님이 ${company.emoji} **${company.name}** ${formatNumber(shares)}주를 매도하여 **${formatNumber(profit)}G** 수익 달성! (+${profitPercent}%)\n💎 와! 대박났네요! 치킨값 나왔다! 🍗`;
        } else if (profit >= 100000) {
            profitMessage = `💰 **${interaction.user.username}**님이 ${company.emoji} **${company.name}** ${formatNumber(shares)}주를 매도하여 **${formatNumber(profit)}G** 수익! (+${profitPercent}%)\n🎉 축하합니다! 오늘 저녁은 뭐 드실래요? 🍖`;
        } else if (profit >= 10000) {
            profitMessage = `📈 **${interaction.user.username}**님이 ${company.emoji} **${company.name}** ${formatNumber(shares)}주를 매도하여 **${formatNumber(profit)}G** 수익! (+${profitPercent}%)\n👍 나이스! 커피값은 벌었네요! ☕`;
        } else {
            profitMessage = `💸 **${interaction.user.username}**님이 ${company.emoji} **${company.name}** ${formatNumber(shares)}주를 매도하여 **${formatNumber(profit)}G** 수익! (+${profitPercent}%)\n😊 소소하지만 이익은 이익! 👏`;
        }
        publicMessage = profitMessage;
    } else if (profit < 0) {
        // 손실인 경우
        const loss = Math.abs(profit);
        let lossMessage = '';
        if (loss >= 1000000) {
            lossMessage = `😱 **${interaction.user.username}**님이 ${company.emoji} **${company.name}** ${formatNumber(shares)}주를 매도하여 **${formatNumber(loss)}G** 손실... (${profitPercent}%)\n💔 아... 이건 좀 아프네요... 다음엔 꼭 성공하실 거예요! 힘내세요! 🫂`;
        } else if (loss >= 100000) {
            lossMessage = `😢 **${interaction.user.username}**님이 ${company.emoji} **${company.name}** ${formatNumber(shares)}주를 매도하여 **${formatNumber(loss)}G** 손실... (${profitPercent}%)\n😭 흑흑... 주식은 원래 이런 거예요... 다음 기회에! 💪`;
        } else if (loss >= 10000) {
            lossMessage = `😅 **${interaction.user.username}**님이 ${company.emoji} **${company.name}** ${formatNumber(shares)}주를 매도하여 **${formatNumber(loss)}G** 손실... (${profitPercent}%)\n🤷 에이~ 수업료라고 생각하세요! 화이팅! 🔥`;
        } else {
            lossMessage = `😔 **${interaction.user.username}**님이 ${company.emoji} **${company.name}** ${formatNumber(shares)}주를 매도하여 **${formatNumber(loss)}G** 손실... (${profitPercent}%)\n🤏 작은 손실이니까 괜찮아요! 금방 회복할 거예요! 📈`;
        }
        publicMessage = lossMessage;
    } else {
        // 본전인 경우
        publicMessage = `😐 **${interaction.user.username}**님이 ${company.emoji} **${company.name}** ${formatNumber(shares)}주를 본전에 매도했습니다!\n🤝 손해는 안 봤으니 다행이네요! 다음엔 수익 봅시다! 💪`;
    }
    
    // 채널에 공개 메시지 전송
    try {
        await interaction.channel.send(publicMessage);
    } catch (error) {
        console.error('주식 매도 메시지 전송 실패:', error);
    }

    return {
        success: true,
        message,
        achievements,
        profit,
        publicMessage
    };
}

// Helper functions
function getTrendEmoji(trend) {
    switch(trend) {
        case 'BULLISH': return '🚀 상승세';
        case 'BEARISH': return '🐻 하락세';
        default: return '➡️ 보합세';
    }
}

function updatePriceHistory(companyId, price, volume) {
    const history = priceHistory.get(companyId) || [];
    history.push({
        timestamp: Date.now(),
        price,
        volume
    });
    
    // Keep only recent history
    if (history.length > MAX_PRICE_HISTORY) {
        history.shift();
    }
    
    priceHistory.set(companyId, history);
}

function calculatePriceImpact(shares, totalShares) {
    // Price impact based on order size relative to total shares
    const orderSize = shares / totalShares;
    return Math.min(orderSize * 0.1, 0.05); // Max 5% impact
}

// Show stock list with sectors
async function showStockList(interaction, sector = null) {
    const companies = sector ? 
        Object.values(COMPANIES).filter(c => c.sector === sector) : 
        Object.values(COMPANIES);

    // Sort by market cap
    companies.sort((a, b) => (b.currentPrice * b.shares) - (a.currentPrice * a.shares));

    const listEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`📊 주식 종목 목록 ${sector ? `- ${SECTORS[sector]?.name}` : ''}`)
        .setDescription('거래 가능한 모든 기업들입니다.');

    // Create pages (10 companies per page)
    const itemsPerPage = 10;
    const pages = Math.ceil(companies.length / itemsPerPage);
    const currentPage = 0;

    const pageCompanies = companies.slice(0, itemsPerPage);
    let stockList = '';

    pageCompanies.forEach((company, index) => {
        const history = priceHistory.get(company.id) || [];
        const priceChange = history.length >= 2 ? 
            ((history[history.length - 1].price - history[0].price) / history[0].price * 100) : 0;
        
        stockList += `${index + 1}. ${company.emoji} **${company.name}**\n`;
        stockList += `가격: ${formatNumber(company.currentPrice)}G | 변동: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%\n`;
        stockList += `시가총액: ${formatNumber(company.currentPrice * company.shares)}G\n\n`;
    });

    listEmbed.addFields({ name: '종목 리스트', value: stockList || '종목 없음', inline: false });
    listEmbed.setFooter({ text: `페이지 1/${pages} | 총 ${companies.length}개 종목` });

    // Create select menu for companies
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('stock_select')
        .setPlaceholder('종목을 선택하세요')
        .addOptions(
            pageCompanies.slice(0, 25).map(company => ({
                label: company.name,
                description: `${formatNumber(company.currentPrice)}G | ${SECTORS[company.sector]?.name}`,
                value: company.id,
                emoji: company.emoji
            }))
        );

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_sectors')
                .setLabel('🏢 섹터별 보기')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_rankings')
                .setLabel('🏆 순위')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_portfolio')
                .setLabel('💼 포트폴리오')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    // interaction이 이미 응답된 경우 update 사용
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({
            embeds: [listEmbed],
            components: [row1, row2]
        });
    }
    
    return await interaction.reply({
        embeds: [listEmbed],
        components: [row1, row2],
        flags: 64
    });
}

// Show sector list
async function showSectorList(interaction) {
    const sectorEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🏢 섹터별 종목 보기')
        .setDescription('섹터를 선택하여 해당 업종의 기업들을 확인하세요.');

    let sectorInfo = '';
    Object.entries(SECTORS).forEach(([key, sector]) => {
        const companies = sector.companies.map(id => COMPANIES[id]).filter(c => c);
        const totalMarketCap = companies.reduce((sum, c) => sum + (c.currentPrice * c.shares), 0);
        
        sectorInfo += `**${sector.name}**\n`;
        sectorInfo += `${sector.description}\n`;
        sectorInfo += `기업 수: ${companies.length}개 | 시가총액: ${formatNumber(totalMarketCap)}G\n\n`;
    });

    sectorEmbed.addFields({ name: '섹터 정보', value: sectorInfo, inline: false });

    // Create sector select menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('sector_select')
        .setPlaceholder('섹터를 선택하세요')
        .addOptions(
            Object.entries(SECTORS).map(([key, sector]) => ({
                label: sector.name,
                description: sector.description,
                value: key
            }))
        );

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_list')
                .setLabel('📊 전체 종목')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_portfolio')
                .setLabel('💼 포트폴리오')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    // interaction이 이미 응답된 경우 update 사용
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({
            embeds: [sectorEmbed],
            components: [row1, row2]
        });
    }
    
    return await interaction.reply({
        embeds: [sectorEmbed],
        components: [row1, row2],
        flags: 64
    });
}

// Show stock rankings
async function showStockRankings(interaction) {
    const companies = Object.values(COMPANIES);
    
    // Calculate various rankings
    const byMarketCap = [...companies].sort((a, b) => (b.currentPrice * b.shares) - (a.currentPrice * a.shares));
    const byPrice = [...companies].sort((a, b) => b.currentPrice - a.currentPrice);
    
    // Calculate price changes
    const withChanges = companies.map(company => {
        const history = priceHistory.get(company.id) || [];
        const priceChange = history.length >= 2 ? 
            ((history[history.length - 1].price - history[0].price) / history[0].price * 100) : 0;
        return { ...company, priceChange };
    });
    
    const topGainers = [...withChanges].sort((a, b) => b.priceChange - a.priceChange).slice(0, 5);
    const topLosers = [...withChanges].sort((a, b) => a.priceChange - b.priceChange).slice(0, 5);

    const rankingEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 주식 시장 순위')
        .setDescription('실시간 주식 시장 순위입니다.')
        .addFields(
            {
                name: '📈 상승률 TOP 5',
                value: topGainers.map((c, i) => 
                    `${i + 1}. ${c.emoji} ${c.name}: +${c.priceChange.toFixed(2)}%`
                ).join('\n') || '데이터 없음',
                inline: true
            },
            {
                name: '📉 하락률 TOP 5',
                value: topLosers.map((c, i) => 
                    `${i + 1}. ${c.emoji} ${c.name}: ${c.priceChange.toFixed(2)}%`
                ).join('\n') || '데이터 없음',
                inline: true
            },
            {
                name: '💰 시가총액 TOP 5',
                value: byMarketCap.slice(0, 5).map((c, i) => 
                    `${i + 1}. ${c.emoji} ${c.name}: ${formatNumber(c.currentPrice * c.shares)}G`
                ).join('\n'),
                inline: false
            },
            {
                name: '💎 고가 주식 TOP 5',
                value: byPrice.slice(0, 5).map((c, i) => 
                    `${i + 1}. ${c.emoji} ${c.name}: ${formatNumber(c.currentPrice)}G`
                ).join('\n'),
                inline: true
            },
            {
                name: '🪙 저가 주식 TOP 5',
                value: byPrice.slice(-5).reverse().map((c, i) => 
                    `${i + 1}. ${c.emoji} ${c.name}: ${formatNumber(c.currentPrice)}G`
                ).join('\n'),
                inline: true
            }
        )
        .setTimestamp()
        .setFooter({ text: '실시간 업데이트' });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_list')
                .setLabel('📊 종목 목록')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_portfolio')
                .setLabel('💼 포트폴리오')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    // interaction이 이미 응답된 경우 update 사용
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({
            embeds: [rankingEmbed],
            components: [buttons]
        });
    }
    
    return await interaction.reply({
        embeds: [rankingEmbed],
        components: [buttons],
        flags: 64
    });
}

// Create limit order
async function createLimitOrder(userId, companyId, type, shares, price) {
    const orders = orderBook.get(userId) || [];
    
    orders.push({
        id: Date.now().toString(),
        companyId,
        type, // 'BUY' or 'SELL'
        shares,
        price,
        createdAt: new Date()
    });
    
    orderBook.set(userId, orders);
    
    // Check if order can be executed immediately
    const company = getCompanyById(companyId);
    if (company) {
        if (type === 'BUY' && company.currentPrice <= price) {
            // Execute buy order
            return { execute: true, type: 'BUY' };
        } else if (type === 'SELL' && company.currentPrice >= price) {
            // Execute sell order
            return { execute: true, type: 'SELL' };
        }
    }
    
    return { execute: false };
}

// Process limit orders (should be called periodically)
async function processLimitOrders() {
    for (const [userId, orders] of orderBook.entries()) {
        for (let i = orders.length - 1; i >= 0; i--) {
            const order = orders[i];
            const company = getCompanyById(order.companyId);
            
            if (!company) continue;
            
            let shouldExecute = false;
            if (order.type === 'BUY' && company.currentPrice <= order.price) {
                shouldExecute = true;
            } else if (order.type === 'SELL' && company.currentPrice >= order.price) {
                shouldExecute = true;
            }
            
            if (shouldExecute) {
                // Execute the order
                // Note: In a real implementation, this would need proper transaction handling
                orders.splice(i, 1);
            }
        }
        
        if (orders.length === 0) {
            orderBook.delete(userId);
        } else {
            orderBook.set(userId, orders);
        }
    }
}

// Simulate market news events
async function generateMarketNews() {
    // 30% 확률로 실제 뉴스 사용
    if (Math.random() < 0.3) {
        try {
            const externalNewsAdapter = require('../../systems/externalNewsAdapter');
            const User = require('../../models/User');
            
            // 최근 활동 유저 가져오기
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const activeUsers = await User.find({
                lastActive: { $gte: oneDayAgo },
                registered: true
            }).limit(10);
            
            const gameNews = await externalNewsAdapter.convertToGameNews(activeUsers);
            
            if (gameNews.length > 0) {
                const realNews = gameNews[0];
                
                // 실제 뉴스 기반 시장 뉴스 생성
                const news = {
                    message: realNews.content,
                    companyId: realNews.companyId,
                    companyName: realNews.company,
                    impact: realNews.impact.impact,
                    type: 'real_news',
                    timestamp: Date.now()
                };
                
                // Apply news impact to stock price
                const company = COMPANIES[realNews.companyId];
                if (company) {
                    const oldPrice = company.currentPrice;
                    const newPrice = Math.floor(company.currentPrice * (1 + news.impact));
                    company.currentPrice = Math.max(100, newPrice); // Minimum price of 100G
                    
                    news.priceChange = company.currentPrice - oldPrice;
                    news.priceChangePercent = (news.impact * 100).toFixed(2);
                    
                    // Update price history
                    updatePriceHistory(company.id, company.currentPrice, Math.floor(Math.random() * 10000));
                }
                
                // Store news in history
                marketNews.push(news);
                if (marketNews.length > 20) marketNews.shift();
                
                console.log('[실시간 뉴스]', news.message, `(${news.companyName}, ${news.priceChangePercent}%)`);
                
                // 뉴스 시스템에 속보 전달 (실제 뉴스는 항상 속보로) - 임시 비활성화
                // 뉴스 시스템에서 자체적으로 다양한 카테고리의 뉴스를 생성하므로 주식 시장 뉴스는 비활성화
                /*
                try {
                    const newsSystem = require('../../systems/newsSystem');
                    const breakingNews = {
                        id: Date.now().toString(),
                        type: 'real_news',
                        category: 'MARKET',
                        content: news.message,
                        timestamp: new Date(),
                        isBreaking: true,
                        marketImpact: {
                            companies: [news.companyId],
                            impact: news.impact
                        }
                    };
                    
                    // 뉴스 시스템에 추가
                    newsSystem.breakingNews.push(breakingNews);
                    newsSystem.newsHistory.unshift(breakingNews);
                    
                    // 속보 발송
                    newsSystem.publishBreakingNews(breakingNews);
                    console.log(`[실시간 뉴스] 속보 발송: ${news.message}`);
                } catch (error) {
                    console.error('[실시간 뉴스] 뉴스 시스템 연동 오류:', error);
                }
                */
                
                return news;
            }
        } catch (error) {
            console.error('[뉴스 시스템] 실제 뉴스 생성 오류:', error);
        }
    }
    
    // 기존 템플릿 뉴스 사용
    const newsTemplates = [
        // 🎯 일반 긍정적 뉴스 (5-15% 영향)
        { template: '{company} 신규 마법 아이템 출시! 모험가들 반응 폭발적', impact: 0.05, type: 'product' },
        { template: '{company} 분기 수익 예상치 20% 초과 달성', impact: 0.08, type: 'earnings' },
        { template: '{company} 왕국 은행으로부터 1000억G 투자 유치', impact: 0.10, type: 'investment' },
        { template: '{company} 고대 마법 기술 발굴로 업계 선도', impact: 0.06, type: 'tech' },
        { template: '{company} 인근 왕국과 무역 협정 체결', impact: 0.07, type: 'expansion' },
        { template: '{company} 왕실 직속 프로젝트 수주 확정', impact: 0.09, type: 'contract' },
        { template: '{company} 길드 연합 최우수상 수상', impact: 0.04, type: 'award' },
        { template: '{company} 해외 시장 진출 성공! 현지 반응 뜨거워', impact: 0.12, type: 'expansion' },
        { template: '{company} 마법 특허 100개 돌파 기념 이벤트', impact: 0.06, type: 'tech' },
        { template: '{company} 업계 최초 친환경 마나 기술 개발', impact: 0.08, type: 'innovation' },
        
        // 💥 대형 긍정적 뉴스 (15-30% 영향)
        { template: '🚨속보: {company} 전설급 아티팩트 제작 성공! 업계 충격', impact: 0.25, type: 'breakthrough' },
        { template: '🎊대박: {company} 왕실 독점 계약 체결! 향후 10년간 독점 공급', impact: 0.30, type: 'mega_contract' },
        { template: '💎특종: {company} 신대륙 발견! 독점 개발권 획득', impact: 0.28, type: 'discovery' },
        { template: '🏆속보: {company} 세계 마법 대회 그랜드슬램 달성!', impact: 0.20, type: 'achievement' },
        { template: '🔥화제: {company} 드래곤 왕국과 평화 조약 및 무역 협정 체결', impact: 0.22, type: 'diplomacy' },
        
        // 📉 일반 부정적 뉴스 (5-15% 영향)
        { template: '{company} 길드장 갑작스런 은퇴 발표', impact: -0.05, type: 'management' },
        { template: '{company} 몬스터 습격으로 창고 피해 발생', impact: -0.08, type: 'security' },
        { template: '{company} 직원들 단체 휴가로 운영 차질', impact: -0.06, type: 'labor' },
        { template: '{company} 재무 관리 실수로 손실 발생', impact: -0.10, type: 'scandal' },
        { template: '{company} 주요 거래 길드와 계약 종료', impact: -0.07, type: 'contract' },
        { template: '{company} 불량 포션 대량 회수 사태', impact: -0.09, type: 'recall' },
        { template: '{company} 경쟁사에 핵심 인재 대거 이직', impact: -0.11, type: 'talent' },
        { template: '{company} 마법 실험 실패로 연구소 일부 파손', impact: -0.07, type: 'accident' },
        
        // 💣 대형 부정적 뉴스 (15-30% 영향)
        { template: '⚠️긴급: {company} 대규모 횡령 사건 발생! 수사 착수', impact: -0.25, type: 'crime' },
        { template: '🚨속보: {company} 본사 드래곤 습격으로 전소! 복구 수개월 예상', impact: -0.30, type: 'disaster' },
        { template: '😱충격: {company} 제품에서 치명적 결함 발견! 전량 리콜', impact: -0.20, type: 'defect' },
        { template: '💔비보: {company} 창업자 갑작스런 사망... 후계 구도 혼란', impact: -0.22, type: 'leadership' },
        { template: '🔴경고: {company} 왕국 감사원 특별 조사 착수', impact: -0.18, type: 'investigation' },
        
        // 🎲 루머와 추측성 뉴스 (2-8% 영향)
        { template: '[루머] {company} 비밀 던전 발견 소문... 진위 확인 중', impact: 0.03, type: 'rumor' },
        { template: '[미확인] {company} 전설급 아이템 제작 성공?', impact: 0.04, type: 'rumor' },
        { template: '[소문] {company} 타 길드와 합병 추진 중?', impact: -0.02, type: 'rumor' },
        { template: '[찌라시] {company} 내부 분열설... 관계자는 부인', impact: -0.03, type: 'rumor' },
        { template: '[카더라] {company} 드래곤과 비밀 계약 체결했다는데...', impact: 0.05, type: 'rumor' },
        { template: '[추측] {company} 곧 대박 날 것 같다는 예언가 등장', impact: 0.02, type: 'rumor' },
        { template: '[설왕설래] {company} 왕실 공주와 CEO 열애설?', impact: 0.03, type: 'rumor' },
        { template: '[정보통] {company} 조만간 빅 이벤트 있다는데...', impact: 0.04, type: 'rumor' },
        
        // 🌟 섹터별 특수 뉴스
        { template: '{company} 마나 폭풍으로 생산량 3배 증가!', impact: 0.12, type: 'magic', sectors: ['energy', 'special'] },
        { template: '{company} 신규 S급 던전 독점 탐사권 획득', impact: 0.10, type: 'dungeon', sectors: ['manufacturing', 'resources'] },
        { template: '{company} 용족 습격으로 본사 건물 반파', impact: -0.15, type: 'disaster', sectors: ['manufacturing', 'resources'] },
        { template: '{company} 희귀 광맥 발견! 주가 급등 예상', impact: 0.15, type: 'resource', sectors: ['resources'] },
        { template: '{company} 길드전 승리로 명성 대폭 상승', impact: 0.08, type: 'guild', sectors: ['entertainment', 'service'] },
        { template: '{company} AI 마법 융합 기술 특허 취득!', impact: 0.14, type: 'tech', sectors: ['technology'] },
        { template: '{company} 왕국 보건청 안전 인증 최고 등급 획득', impact: 0.09, type: 'certification', sectors: ['manufacturing', 'service'] },
        { template: '{company} 차원 균열로 수송 루트 일시 차단', impact: -0.12, type: 'logistics', sectors: ['service', 'retail'] },
        
        // 🌍 시장 전체 영향 뉴스 (여러 기업에 영향)
        { template: '📊 왕국 중앙은행 기준금리 인하! 금융주 수혜 예상', impact: 0.08, type: 'macro', affectsSector: 'finance' },
        { template: '⚡ 대규모 마나 폭풍 예보! 에너지 기업들 비상', impact: -0.10, type: 'weather', affectsSector: 'energy' },
        { template: '🏰 왕실 대규모 인프라 투자 발표! 건설·제조 호황 예상', impact: 0.12, type: 'policy', affectsSector: 'manufacturing' },
        { template: '🎮 연말 길드 축제 개최! 엔터테인먼트 업계 특수 기대', impact: 0.10, type: 'event', affectsSector: 'entertainment' },
        { template: '💊 신종 몬스터 바이러스 확산! 제약·보험 수요 급증', impact: 0.15, type: 'health', affectsSector: 'manufacturing' },
        { template: '🌊 해상 무역로 해적 출몰! 물류·운송 타격', impact: -0.12, type: 'security', affectsSector: 'service' },
        
        // 📅 계절/시간대별 이벤트 뉴스
        { template: '❄️ 겨울 축제 시즌 시작! 소비 관련주 상승 기대', impact: 0.08, type: 'seasonal', affectsSector: 'retail' },
        { template: '🌸 봄맞이 대청소! 청소·정리 관련 기업 호황', impact: 0.06, type: 'seasonal', affectsSector: 'service' },
        { template: '🌞 여름 휴가철 성수기! 숙박·관광 업계 대목', impact: 0.10, type: 'seasonal', affectsSector: 'service' },
        { template: '🍂 수확의 계절! 자원·농업 관련주 강세', impact: 0.09, type: 'seasonal', affectsSector: 'resources' },
        
        // 💰 실적 발표 관련 상세 뉴스
        { template: '{company} 3분기 매출 312% 성장! 어닝 서프라이즈', impact: 0.18, type: 'earnings' },
        { template: '{company} 영업이익률 45% 달성! 업계 최고 수준', impact: 0.15, type: 'earnings' },
        { template: '{company} 적자 전환... 예상보다 심각한 실적', impact: -0.20, type: 'earnings' },
        { template: '{company} 매출 50% 급감! 긴급 구조조정 돌입', impact: -0.25, type: 'earnings' },
        
        // 🤝 M&A 및 제휴 뉴스
        { template: '🤝 {company}, 업계 2위 기업 인수 완료! 시장 점유율 40% 돌파', impact: 0.20, type: 'merger' },
        { template: '💼 {company}, 글로벌 길드와 전략적 제휴 체결', impact: 0.12, type: 'partnership' },
        { template: '🔄 {company}, 적대적 인수 시도에 직면! 경영권 분쟁', impact: -0.15, type: 'takeover' },
        { template: '✨ {company}, 스타트업 10개사 동시 인수! 기술력 대폭 강화', impact: 0.16, type: 'acquisition' }
    ];
    
    const companies = Object.values(COMPANIES);
    
    // Determine if this is a sector-wide news (20% chance)
    const isSectorNews = Math.random() < 0.2;
    
    if (isSectorNews && newsTemplates.some(n => n.affectsSector)) {
        // Generate sector-wide news
        const sectorNews = newsTemplates.filter(n => n.affectsSector);
        const randomNews = sectorNews[Math.floor(Math.random() * sectorNews.length)];
        
        const affectedCompanies = companies.filter(c => c.sector === randomNews.affectsSector);
        
        const news = {
            message: randomNews.template,
            type: randomNews.type,
            affectsSector: randomNews.affectsSector,
            timestamp: Date.now(),
            affectedCompanies: []
        };
        
        // Apply impact to all companies in the sector
        affectedCompanies.forEach(company => {
            const companyImpact = randomNews.impact * (0.7 + Math.random() * 0.6); // 70-130% of base impact
            const oldPrice = company.currentPrice;
            const newPrice = Math.floor(company.currentPrice * (1 + companyImpact));
            company.currentPrice = Math.max(100, newPrice);
            
            const priceChange = company.currentPrice - oldPrice;
            
            news.affectedCompanies.push({
                companyId: company.id,
                companyName: company.name,
                impact: companyImpact,
                priceChange: priceChange,
                priceChangePercent: (companyImpact * 100).toFixed(2)
            });
            
            updatePriceHistory(company.id, company.currentPrice, Math.floor(Math.random() * 10000));
        });
        
        marketNews.push(news);
        if (marketNews.length > 20) marketNews.shift();
        
        return news;
    } else {
        // Generate company-specific news
        const randomCompany = companies[Math.floor(Math.random() * companies.length)];
        
        // Filter news templates by sector if applicable
        let applicableNews = newsTemplates.filter(news => 
            !news.sectors || news.sectors.includes(randomCompany.sector)
        );
        
        // Exclude sector-wide news for individual company news
        applicableNews = applicableNews.filter(news => !news.affectsSector);
        
        const randomNews = applicableNews[Math.floor(Math.random() * applicableNews.length)];
        
        const news = {
            message: randomNews.template.replace('{company}', randomCompany.name),
            companyId: randomCompany.id,
            companyName: randomCompany.name,
            impact: randomNews.impact * (0.8 + Math.random() * 0.4), // Add some randomness
            type: randomNews.type,
            timestamp: Date.now()
        };
        
        // Apply news impact to stock price
        const oldPrice = randomCompany.currentPrice;
        const newPrice = Math.floor(randomCompany.currentPrice * (1 + news.impact));
        randomCompany.currentPrice = Math.max(100, newPrice); // Minimum price of 100G
        
        news.priceChange = randomCompany.currentPrice - oldPrice;
        news.priceChangePercent = (news.impact * 100).toFixed(2);
        
        // Update price history
        updatePriceHistory(randomCompany.id, randomCompany.currentPrice, Math.floor(Math.random() * 10000));
        
        // Check for ripple effects (10% chance for major news)
        if (Math.abs(news.impact) > 0.15 && Math.random() < 0.1) {
            // Create ripple effect on related companies
            const relatedSector = randomCompany.sector;
            const relatedCompanies = companies.filter(c => 
                c.sector === relatedSector && c.id !== randomCompany.id
            );
            
            news.rippleEffects = [];
            
            relatedCompanies.forEach(company => {
                const rippleImpact = news.impact * 0.3 * (0.5 + Math.random() * 0.5); // 15-30% of original impact
                const rippleOldPrice = company.currentPrice;
                const rippleNewPrice = Math.floor(company.currentPrice * (1 + rippleImpact));
                company.currentPrice = Math.max(100, rippleNewPrice);
                
                news.rippleEffects.push({
                    companyId: company.id,
                    companyName: company.name,
                    impact: rippleImpact,
                    priceChange: company.currentPrice - rippleOldPrice
                });
                
                updatePriceHistory(company.id, company.currentPrice, Math.floor(Math.random() * 1000));
            });
        }
        
        // Store news in history
        marketNews.push(news);
        if (marketNews.length > 20) marketNews.shift(); // Keep only recent 20 news
        
        // 뉴스 시스템에 속보 전달 (중요한 뉴스만) - 임시 비활성화
        // 뉴스 시스템에서 자체적으로 다양한 카테고리의 뉴스를 생성하므로 주식 시장 뉴스는 비활성화
        /*
        if (Math.abs(news.impact) > 0.10) { // 10% 이상 변동 시
            try {
                const newsSystem = require('../../systems/newsSystem');
                const breakingNews = {
                    id: Date.now().toString(),
                    type: news.type,
                    category: 'MARKET',
                    content: news.message,
                    timestamp: new Date(),
                    isBreaking: true,
                    marketImpact: {
                        companies: news.affectedCompanies || [news.companyId],
                        impact: news.impact
                    }
                };
                
                // 뉴스 시스템에 추가
                newsSystem.breakingNews.push(breakingNews);
                newsSystem.newsHistory.unshift(breakingNews);
                
                // 속보 발송
                newsSystem.publishBreakingNews(breakingNews);
                console.log(`[주식시장] 속보 발송: ${news.message}`);
            } catch (error) {
                console.error('[주식시장] 뉴스 시스템 연동 오류:', error);
            }
        }
        */
        
        return news;
    }
}

// Show market news
async function showMarketNews(interaction) {
    const newsEmbed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('📰 실시간 시장 뉴스')
        .setDescription('최신 시장 동향과 기업 소식')
        .setTimestamp();

    if (marketNews.length === 0) {
        newsEmbed.addFields({ name: '뉴스 없음', value: '아직 발생한 뉴스가 없습니다.', inline: false });
    } else {
        const recentNews = marketNews.slice(-10).reverse(); // Show last 10 news
        
        recentNews.forEach(news => {
            const timeAgo = Math.floor((Date.now() - news.timestamp) / 60000); // minutes ago
            
            if (news.affectsSector) {
                // Sector-wide news
                const avgChange = news.affectedCompanies.reduce((sum, c) => sum + parseFloat(c.priceChangePercent), 0) / news.affectedCompanies.length;
                const changeIcon = avgChange >= 0 ? '📈' : '📉';
                
                let valueText = `섹터 평균 변동: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}% | ${timeAgo}분 전\n`;
                valueText += `영향받은 기업: ${news.affectedCompanies.slice(0, 3).map(c => c.companyName).join(', ')}`;
                if (news.affectedCompanies.length > 3) {
                    valueText += ` 외 ${news.affectedCompanies.length - 3}개`;
                }
                
                newsEmbed.addFields({
                    name: `${changeIcon} ${news.message}`,
                    value: valueText,
                    inline: false
                });
            } else {
                // Company-specific news
                const changeIcon = news.priceChange >= 0 ? '📈' : '📉';
                let valueText = `영향: ${news.priceChange >= 0 ? '+' : ''}${news.priceChangePercent}% | ${timeAgo}분 전`;
                
                // Add ripple effects if any
                if (news.rippleEffects && news.rippleEffects.length > 0) {
                    valueText += '\n🌊 연쇄 영향: ';
                    valueText += news.rippleEffects.slice(0, 2).map(r => 
                        `${r.companyName} ${r.priceChange >= 0 ? '+' : ''}${formatNumber(r.priceChange)}G`
                    ).join(', ');
                    if (news.rippleEffects.length > 2) {
                        valueText += ` 외 ${news.rippleEffects.length - 2}개`;
                    }
                }
                
                newsEmbed.addFields({
                    name: `${changeIcon} ${news.message}`,
                    value: valueText,
                    inline: false
                });
            }
        });
    }

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('generate_news')
                .setLabel('📡 뉴스 업데이트')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_list')
                .setLabel('📊 종목 목록')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stock_portfolio')
                .setLabel('💼 포트폴리오')
                .setStyle(ButtonStyle.Success)
        );

    // interaction이 이미 응답된 경우 update 사용
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({
            embeds: [newsEmbed],
            components: [buttons]
        });
    }
    
    return await interaction.reply({
        embeds: [newsEmbed],
        components: [buttons],
        flags: 64
    });
}

// Check and award achievements
async function checkAchievements(userId, action, data) {
    const userAchievements = playerAchievements.get(userId) || new Set();
    const newAchievements = [];
    
    switch(action) {
        case 'TRADE':
            if (!userAchievements.has('FIRST_TRADE')) {
                userAchievements.add('FIRST_TRADE');
                newAchievements.push(ACHIEVEMENTS.FIRST_TRADE);
            }
            
            // Check daily trades
            const today = new Date().toDateString();
            const dailyTrades = data.dailyTrades || {};
            dailyTrades[today] = (dailyTrades[today] || 0) + 1;
            
            if (dailyTrades[today] >= 10 && !userAchievements.has('DAY_TRADER')) {
                userAchievements.add('DAY_TRADER');
                newAchievements.push(ACHIEVEMENTS.DAY_TRADER);
            }
            break;
            
        case 'PROFIT':
            if (data.profit >= 10000 && !userAchievements.has('PROFIT_10K')) {
                userAchievements.add('PROFIT_10K');
                newAchievements.push(ACHIEVEMENTS.PROFIT_10K);
            }
            if (data.profit >= 100000 && !userAchievements.has('PROFIT_100K')) {
                userAchievements.add('PROFIT_100K');
                newAchievements.push(ACHIEVEMENTS.PROFIT_100K);
            }
            break;
            
        case 'PORTFOLIO':
            if (data.stockCount >= 5 && !userAchievements.has('DIVERSIFIED')) {
                userAchievements.add('DIVERSIFIED');
                newAchievements.push(ACHIEVEMENTS.DIVERSIFIED);
            }
            if (data.totalValue >= 1000000 && !userAchievements.has('MILLIONAIRE')) {
                userAchievements.add('MILLIONAIRE');
                newAchievements.push(ACHIEVEMENTS.MILLIONAIRE);
            }
            break;
            
        case 'NEWS_TRADE':
            if (!userAchievements.has('NEWS_TRADER')) {
                userAchievements.add('NEWS_TRADER');
                newAchievements.push(ACHIEVEMENTS.NEWS_TRADER);
            }
            break;
    }
    
    playerAchievements.set(userId, userAchievements);
    
    return newAchievements;
}

// Show achievements
async function showAchievements(interaction) {
    const userId = interaction.user.id;
    const userAchievements = playerAchievements.get(userId) || new Set();
    
    const achievementEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 주식 거래 업적')
        .setDescription(`달성한 업적: ${userAchievements.size}/${Object.keys(ACHIEVEMENTS).length}개`)
        .setTimestamp();

    let earnedList = '';
    let unearnedList = '';
    let totalRewards = 0;

    Object.entries(ACHIEVEMENTS).forEach(([key, achievement]) => {
        if (userAchievements.has(key)) {
            earnedList += `${achievement.icon} **${achievement.name}**\n${achievement.desc} | 보상: ${formatNumber(achievement.reward)}G\n\n`;
            totalRewards += achievement.reward;
        } else {
            unearnedList += `❓ **${achievement.name}**\n${achievement.desc} | 보상: ${formatNumber(achievement.reward)}G\n\n`;
        }
    });

    if (earnedList) {
        achievementEmbed.addFields({ name: '✅ 달성한 업적', value: earnedList, inline: false });
    }
    
    if (unearnedList) {
        achievementEmbed.addFields({ name: '🔒 미달성 업적', value: unearnedList, inline: false });
    }

    achievementEmbed.addFields({ 
        name: '💰 총 획득 보상', 
        value: `${formatNumber(totalRewards)}G`, 
        inline: true 
    });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_portfolio')
                .setLabel('💼 포트폴리오')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_list')
                .setLabel('📊 종목 목록')
                .setStyle(ButtonStyle.Secondary)
        );

    // interaction이 이미 응답된 경우 update 사용
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({
            embeds: [achievementEmbed],
            components: [buttons]
        });
    }
    
    return await interaction.reply({
        embeds: [achievementEmbed],
        components: [buttons],
        flags: 64
    });
}

// Market simulator - creates dynamic price movements
function simulateMarket() {
    const companies = Object.values(COMPANIES);
    
    companies.forEach(company => {
        // Base volatility from sector
        let volatility = 0.02; // 2% base volatility
        
        // Sector-specific volatility
        switch(company.sector) {
            case 'crypto':
            case 'special':
                volatility = 0.05; // 5% for high-risk sectors
                break;
            case 'technology':
            case 'entertainment':
                volatility = 0.03; // 3% for medium-risk
                break;
            case 'finance':
            case 'retail':
                volatility = 0.015; // 1.5% for low-risk
                break;
        }
        
        // Random walk with mean reversion
        const meanReversionFactor = 0.1;
        const priceRatio = company.currentPrice / company.basePrice;
        const meanReversionPressure = (1 - priceRatio) * meanReversionFactor;
        
        // Calculate price change
        const randomChange = (Math.random() - 0.5) * 2 * volatility;
        const totalChange = randomChange + meanReversionPressure;
        
        // Apply change
        const newPrice = Math.floor(company.currentPrice * (1 + totalChange));
        company.currentPrice = Math.max(100, Math.min(newPrice, company.basePrice * 3)); // Limit to 3x base price
        
        // Update price history
        updatePriceHistory(company.id, company.currentPrice, Math.floor(Math.random() * 1000));
    });
}

// Show sector list
async function showSectorList(interaction, selectedSector = null) {
    if (selectedSector) {
        // 특정 섹터의 종목 목록 표시
        return await showStockList(interaction, selectedSector);
    }
    
    // 섹터 선택 메뉴 표시
    const { StringSelectMenuBuilder } = require('discord.js');
    
    // 섹터별 아이콘 매핑
    const sectorIcons = {
        entertainment: '🎮',
        technology: '💻',
        manufacturing: '🏭',
        finance: '💰',
        retail: '🛒',
        service: '🏨',
        resources: '⛏️',
        energy: '⚡',
        special: '🔮',
        automotive: '🚗',
        crypto: '🪙'
    };
    
    const sectorEmbed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🏢 길드별 기업 목록')
        .setDescription('각 길드의 전문 기업들을 확인하세요!')
        .setTimestamp();
    
    // 섹터별 요약 정보
    Object.entries(SECTORS).forEach(([sectorKey, sector]) => {
        const sectorCompanies = sector.companies.map(id => COMPANIES[id]).filter(c => c);
        let totalMarketCap = 0;
        let avgChange = 0;
        
        sectorCompanies.forEach(company => {
            const history = priceHistory.get(company.id) || [];
            const change = history.length >= 2 ? 
                ((history[history.length - 1].price - history[0].price) / history[0].price * 100) : 0;
            totalMarketCap += company.currentPrice * company.shares;
            avgChange += change;
        });
        
        if (sectorCompanies.length > 0) {
            avgChange /= sectorCompanies.length;
            const changeIcon = avgChange >= 0 ? '📈' : '📉';
            const sectorIcon = sectorIcons[sectorKey] || '🏢';
            
            sectorEmbed.addFields({
                name: `${sectorIcon} ${sector.name}`,
                value: `기업 수: ${sectorCompanies.length}개\n평균 변동률: ${changeIcon} ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%\n시가총액: ${formatNumber(totalMarketCap)}G`,
                inline: true
            });
        }
    });
    
    // 섹터 선택 드롭다운
    const sectorSelect = new StringSelectMenuBuilder()
        .setCustomId('sector_select')
        .setPlaceholder('섹터를 선택하세요')
        .addOptions(
            Object.entries(SECTORS).map(([key, sector]) => ({
                label: sector.name,
                description: `${sector.companies.length}개 기업`,
                value: key,
                emoji: sectorIcons[key] || '🏢'
            }))
        );
    
    const row1 = new ActionRowBuilder().addComponents(sectorSelect);
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_list')
                .setLabel('📊 전체 종목')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_rankings')
                .setLabel('🏆 순위')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stock_market')
                .setLabel('🔙 뒤로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    // interaction이 이미 응답된 경우 update 사용
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({
            embeds: [sectorEmbed],
            components: [row1, row2]
        });
    }
    
    return await interaction.reply({
        embeds: [sectorEmbed],
        components: [row1, row2],
        flags: 64
    });
}

// Show market overview
async function showMarketOverview(interaction) {
    const sectors = Object.entries(SECTORS);
    
    const overviewEmbed = new EmbedBuilder()
        .setColor('#4ECDC4')
        .setTitle('🌐 김헌터 주식 시장 개요')
        .setDescription('실시간 시장 현황과 섹터별 동향')
        .setTimestamp();

    // Calculate market indices
    let totalMarketCap = 0;
    let totalChange = 0;
    let companiesCount = 0;

    sectors.forEach(([sectorKey, sector]) => {
        const sectorCompanies = sector.companies.map(id => COMPANIES[id]).filter(c => c);
        
        let sectorMarketCap = 0;
        let sectorAvgChange = 0;
        
        sectorCompanies.forEach(company => {
            const history = priceHistory.get(company.id) || [];
            const change = history.length >= 2 ? 
                ((history[history.length - 1].price - history[0].price) / history[0].price * 100) : 0;
            
            sectorMarketCap += company.currentPrice * company.shares;
            sectorAvgChange += change;
            totalMarketCap += company.currentPrice * company.shares;
            totalChange += change;
            companiesCount++;
        });
        
        if (sectorCompanies.length > 0) {
            sectorAvgChange /= sectorCompanies.length;
            const changeIcon = sectorAvgChange >= 0 ? '📈' : '📉';
            
            overviewEmbed.addFields({
                name: `${changeIcon} ${sector.name}`,
                value: `시가총액: ${formatNumber(sectorMarketCap)}G\n변동률: ${sectorAvgChange >= 0 ? '+' : ''}${sectorAvgChange.toFixed(2)}%`,
                inline: true
            });
        }
    });

    const avgMarketChange = companiesCount > 0 ? totalChange / companiesCount : 0;
    const marketTrend = avgMarketChange > 2 ? '🚀 급등장' : 
                       avgMarketChange > 0 ? '📈 상승장' :
                       avgMarketChange > -2 ? '📉 하락장' : '💥 급락장';

    overviewEmbed.setDescription(
        `${marketTrend} | 전체 시가총액: ${formatNumber(totalMarketCap)}G | 평균 변동률: ${avgMarketChange >= 0 ? '+' : ''}${avgMarketChange.toFixed(2)}%`
    );

    // Add recent news summary
    if (marketNews.length > 0) {
        const recentNews = marketNews.slice(-3);
        let newsText = '';
        recentNews.forEach(news => {
            const icon = news.priceChange >= 0 ? '📈' : '📉';
            newsText += `${icon} ${news.message.substring(0, 50)}...\n`;
        });
        overviewEmbed.addFields({ name: '📰 최신 뉴스', value: newsText, inline: false });
    }

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_list')
                .setLabel('📊 종목 목록')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_rankings')
                .setLabel('🏆 순위')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_news')
                .setLabel('📰 뉴스')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stock_portfolio')
                .setLabel('💼 포트폴리오')
                .setStyle(ButtonStyle.Success)
        );

    // interaction이 이미 응답된 경우 update 사용
    if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({
            embeds: [overviewEmbed],
            components: [buttons]
        });
    }
    
    return await interaction.reply({
        embeds: [overviewEmbed],
        components: [buttons],
        flags: 64
    });
}

// Initialize on load
initializePriceHistory();

// Generate initial market activity
(async () => {
    for (let i = 0; i < 10; i++) {
        await generateMarketNews();
    }
})();

// Start market simulation (update every 30 seconds)
setInterval(async () => {
    simulateMarket();
    processLimitOrders();
    
    // Random chance for news (increased to 40% for more frequent news)
    if (Math.random() < 0.4) { // 40% chance
        const news = await generateMarketNews();
        
        // Log major news events
        if (news && Math.abs(news.impact || 0) > 0.15) {
            console.log(`[주식시장] 주요 뉴스 발생: ${news.message}`);
            if (news.affectedCompanies) {
                console.log(`[주식시장] ${news.affectedCompanies.length}개 기업 영향`);
            }
        }
    }
    
    // Small chance for multiple news at once (5%)
    if (Math.random() < 0.05) {
        await generateMarketNews();
    }
}, 30000);

module.exports = {
    initializePriceHistory,
    showStockDetail,
    buyStock,
    sellStock,
    showPortfolio,
    showStockList,
    showSectorList,
    showStockRankings,
    showMarketNews,
    showMarketOverview,
    showAchievements,
    generatePriceChart,
    generatePriceChartUrl,
    getPlayerPortfolio,
    createLimitOrder,
    processLimitOrders,
    generateMarketNews,
    checkAchievements,
    simulateMarket,
    priceHistory,
    orderBook,
    marketNews,
    ACHIEVEMENTS
};