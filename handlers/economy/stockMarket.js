const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const STOCK_MARKET = require('../../data/stockMarket');
const { showStockDetail, showPortfolio, showMarketOverview, buyStock, sellStock, initializePriceHistory, showSectorList, showStockList, showStockRankings } = require('./stockTrading');
const { COMPANIES, SECTORS } = require('../../data/companiesData');
const Stock = require('../../models/Stock');

// 주식 메인 메뉴
async function showStockMenu(interaction) {
    try {
        console.log('[주식] 메뉴 표시 시작:', interaction.user.username);
        
        if (!interaction.deferred && !interaction.replied) {
            if (interaction.isStringSelectMenu() || interaction.isButton()) {
                await interaction.deferUpdate();
            } else {
                await interaction.deferReply({ flags: 64 });
            }
        }
    } catch (error) {
        console.error('[주식] defer 오류:', error);
    }
    
    try {
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            return await interaction.editReply({ 
                content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
                embeds: [],
                components: []
            });
        }
        
        const summary = await getMarketSummary();
    
    const embed = new EmbedBuilder()
        .setColor('#00b4d8')
        .setTitle('📈 환상 차원 주식거래소')
        .setDescription(
            '환상 차원의 다양한 기업들에 투자하여 수익을 얻으세요!\n' +
            '시장은 실시간으로 변동하며, 뉴스와 이벤트가 주가에 영향을 줍니다.'
        )
        .addFields(
            { name: '💰 보유 자산', value: `${formatNumber(user.gold)}G`, inline: true },
            { name: '📊 시장 지수', value: summary.index, inline: true },
            { name: '📈 최고 상승', value: `${summary.topGainer.name}\n+${summary.topGainer.change.toFixed(2)}%`, inline: true },
            { name: '📉 최고 하락', value: `${summary.topLoser.name}\n${summary.topLoser.change.toFixed(2)}%`, inline: true },
            { name: '💼 거래량', value: `${formatNumber(summary.volume)}주`, inline: true },
            { name: '💵 시가총액', value: `${formatNumber(summary.marketCap)}G`, inline: true }
        )
        .setFooter({ text: '📰 뉴스를 확인하여 투자 전략을 세우세요!' })
        .setTimestamp();
    
    const buttons = [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('stock_market')
                    .setLabel('📊 시장 현황')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('stock_portfolio')
                    .setLabel('💼 내 포트폴리오')
                    .setStyle(ButtonStyle.Secondary)
            ),
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            )
    ];
    
        return await interaction.editReply({
            embeds: [embed],
            components: buttons
        });
    } catch (error) {
        console.error('[주식] 메뉴 표시 오류:', error);
        return await interaction.editReply({
            content: '❌ 주식 시장 데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            embeds: [],
            components: []
        });
    }
}

// 주식 찾기 헬퍼
function findCompany(companyId) {
    // 지역 기업들 검색
    for (const region of Object.values(STOCK_MARKET.regions)) {
        const company = region.companies.find(c => c.id === companyId);
        if (company) return company;
    }
    
    // 체인 기업들 검색
    const chainCompany = STOCK_MARKET.chains.find(c => c.id === companyId);
    if (chainCompany) return chainCompany;
    
    // 유물탐사회사들 검색
    return STOCK_MARKET.exploration_companies.find(c => c.id === companyId);
}

// 시장 요약 정보 가져오기
async function getMarketSummary() {
    try {
        // MongoDB Stock 모델에서 데이터 가져오기
        const Stock = require('../../models/Stock');
        const marketStats = await Stock.getMarketStats();
        const topStocks = await Stock.getTopStocks('gainers', 1);
        const bottomStocks = await Stock.getTopStocks('losers', 1);
        
        const topGainer = topStocks && topStocks[0] ? topStocks[0] : { companyName: '없음', dailyChangePercent: 0 };
        const topLoser = bottomStocks && bottomStocks[0] ? bottomStocks[0] : { companyName: '없음', dailyChangePercent: 0 };
        
        const avgChange = marketStats.totalStocks > 0 ? 
            ((marketStats.gainers - marketStats.losers) / marketStats.totalStocks * 10) : 0;
        const indexEmoji = avgChange > 0 ? '📈' : avgChange < 0 ? '📉' : '➡️';
        
        return {
            index: `${indexEmoji} ${avgChange > 0 ? '+' : ''}${avgChange.toFixed(2)}%`,
            topGainer: { name: topGainer.companyName, change: topGainer.dailyChangePercent || 0 },
            topLoser: { name: topLoser.companyName, change: topLoser.dailyChangePercent || 0 },
            volume: marketStats.totalVolume || 0,
            marketCap: marketStats.totalMarketCap || 0,
            latestNews: '📰 새로운 AI 기술 발표로 기술주 상승'
        };
    } catch (error) {
        console.error('[Stock] 시장 요약 정보 오류:', error);
        // 오류 시 기본값 반환
        return {
            index: '➡️ 0.00%',
            topGainer: { name: '데이터 없음', change: 0 },
            topLoser: { name: '데이터 없음', change: 0 },
            volume: 0,
            marketCap: 0,
            latestNews: '📰 시장 데이터 로딩 중...'
        };
    }
}

// 포트폴리오 가져오기
async function getPlayerPortfolio(userId) {
    try {
        const user = await User.findOne({ discordId: userId }).select('gold stockPortfolio');
        const userGold = user ? user.gold : 0;
        
        const portfolio = {
            cash: userGold,
            stocks: new Map(),
            totalValue: userGold
        };
        
        if (user && user.stockPortfolio && user.stockPortfolio.stocks) {
            for (const [companyId, stockData] of user.stockPortfolio.stocks) {
                portfolio.stocks.set(companyId, {
                    shares: stockData.shares,
                    avgPrice: stockData.avgPrice
                });
            }
        }
        
        return portfolio;
    } catch (error) {
        console.error('포트폴리오 로드 오류:', error);
        return {
            cash: 0,
            stocks: new Map(),
            totalValue: 0
        };
    }
}

// 주식 시장 메인 메뉴
async function showStockMarket(interaction) {
    // Defer if not already deferred
    if (!interaction.deferred && !interaction.replied) {
        if (interaction.isStringSelectMenu() || interaction.isButton()) {
            await interaction.deferUpdate();
        } else {
            await interaction.deferReply({ flags: 64 });
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

    // 가격 히스토리 초기화 (첫 실행시)
    initializePriceHistory();

    const portfolio = await getPlayerPortfolio(user.discordId);
    let portfolioValue = portfolio.cash;
    
    // 포트폴리오 가치 계산
    for (const [companyId, holding] of portfolio.stocks) {
        const company = COMPANIES[companyId];
        if (company) {
            portfolioValue += company.currentPrice * holding.shares;
        }
    }

    // 시장 요약 정보
    const marketSummary = await getMarketSummary();

    const marketEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💎 김헌터 왕국 투자 거래소')
        .setDescription('왕국의 기업들에 투자하여 부를 쌓으세요!')
        .addFields(
            { name: '💰 보유 골드', value: `${formatNumber(portfolio.cash)}G`, inline: true },
            { name: '📊 총 자산 가치', value: `${formatNumber(portfolioValue)}G`, inline: true },
            { name: '📈 왕국 경제 지표', value: marketSummary.index, inline: true },
            { name: '🔥 떠오르는 기업', value: marketSummary.topGainer.name ? `${marketSummary.topGainer.name} (+${marketSummary.topGainer.change.toFixed(1)}%)` : '없음', inline: true },
            { name: '❄️ 하락하는 기업', value: marketSummary.topLoser.name ? `${marketSummary.topLoser.name} (${marketSummary.topLoser.change.toFixed(1)}%)` : '없음', inline: true },
            { name: '📰 왕국 속보', value: marketSummary.latestNews, inline: true }
        );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_market_overview')
                .setLabel('📊 왕국 기업 목록')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_sectors')
                .setLabel('🏢 길드별 보기')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_news')
                .setLabel('📰 왕국 속보')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stock_portfolio')
                .setLabel('💎 내 투자 현황')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    // 상호작용 상태 확인 후 적절한 응답 방법 사용
    if (interaction.deferred) {
        return await interaction.editReply({
            embeds: [marketEmbed],
            components: [buttons]
        });
    } else if (interaction.replied) {
        return await interaction.followUp({
            embeds: [marketEmbed],
            components: [buttons],
            flags: 64
        });
    } else {
        return await interaction.reply({
            embeds: [marketEmbed],
            components: [buttons],
            flags: 64
        });
    }
}

// 시장 동향 텍스트
function getMarketTrend() {
    const trend = STOCK_MARKET.market_state.overall_trend;
    const volatility = STOCK_MARKET.market_state.volatility;
    
    let trendText = '';
    if (trend > 50) trendText = '📈 강세장';
    else if (trend > 0) trendText = '📊 상승세';
    else if (trend > -50) trendText = '📉 하락세';
    else trendText = '💥 약세장';
    
    let volText = '';
    if (volatility > 70) volText = '(매우 불안정)';
    else if (volatility > 40) volText = '(변동성 높음)';
    else if (volatility > 20) volText = '(보통)';
    else volText = '(안정적)';
    
    return `${trendText} ${volText}`;
}

// 지역별 기업 표시
async function showRegionalStocks(interaction) {
    const regionsEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🌍 지역별 기업 목록')
        .setDescription('각 지역의 특색있는 기업들입니다.');

    for (const [regionKey, region] of Object.entries(STOCK_MARKET.regions)) {
        let companyList = '';
        for (const company of region.companies) {
            const changeIcon = company.change >= 0 ? '📈' : '📉';
            companyList += `${changeIcon} **${company.name}** - ${formatNumber(company.price)}G (${company.change >= 0 ? '+' : ''}${company.change.toFixed(1)}%)\n`;
        }
        regionsEmbed.addFields({
            name: region.name,
            value: companyList || '기업 없음',
            inline: true
        });
    }

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_buy')
                .setLabel('💰 매수')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('stock_sell')
                .setLabel('💸 매도')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('stock_market')
                .setLabel('🔙 뒤로')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.update({
        embeds: [regionsEmbed],
        components: [buttons]
    });
}

// 체인 기업 표시
async function showChainStocks(interaction) {
    const chainsEmbed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('🏢 전 지역 체인 기업')
        .setDescription('모든 지역에서 운영되는 대형 체인 기업들입니다.')
        .addFields({
            name: '📊 기업 목록',
            value: STOCK_MARKET.chains.map(company => {
                const changeIcon = company.change >= 0 ? '📈' : '📉';
                return `${changeIcon} **${company.name}** - ${formatNumber(company.price)}G (${company.change >= 0 ? '+' : ''}${company.change.toFixed(1)}%)`;
            }).join('\n')
        });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_buy')
                .setLabel('💰 매수')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('stock_sell')
                .setLabel('💸 매도')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('stock_market')
                .setLabel('🔙 뒤로')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.update({
        embeds: [chainsEmbed],
        components: [buttons]
    });
}

// 탐사 회사 표시
async function showExplorationStocks(interaction) {
    const explorationEmbed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🔍 유물 탐사 회사')
        .setDescription('모험과 발견의 세계! 유물 탐사 전문 기업들입니다.')
        .addFields({
            name: '🗺️ 탐사 기업 목록',
            value: STOCK_MARKET.exploration_companies.map(company => {
                const changeIcon = company.change >= 0 ? '📈' : '📉';
                return `${changeIcon} **${company.name}** - ${formatNumber(company.price)}G (${company.change >= 0 ? '+' : ''}${company.change.toFixed(1)}%)`;
            }).join('\n')
        });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_buy')
                .setLabel('💰 매수')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('stock_sell')
                .setLabel('💸 매도')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('stock_market')
                .setLabel('🔙 뒤로')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.update({
        embeds: [explorationEmbed],
        components: [buttons]
    });
}

// 주식 매수 모달 표시
async function showStockBuyModal(interaction) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    
    const modal = new ModalBuilder()
        .setCustomId('stock_buy_select')
        .setTitle('💎 기업 지분 매수');
    
    const companyInput = new TextInputBuilder()
        .setCustomId('company_id')
        .setLabel('기업 ID (예: mystic_herb)')
        .setPlaceholder('매수할 기업의 ID를 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const sharesInput = new TextInputBuilder()
        .setCustomId('shares')
        .setLabel('매수 수량')
        .setPlaceholder('구매할 주식 수량을 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(companyInput),
        new ActionRowBuilder().addComponents(sharesInput)
    );
    
    await interaction.showModal(modal);
}

// 주식 매도 모달 표시
async function showStockSellModal(interaction) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    
    const modal = new ModalBuilder()
        .setCustomId('stock_sell_select')
        .setTitle('💸 기업 지분 매도');
    
    const companyInput = new TextInputBuilder()
        .setCustomId('company_id')
        .setLabel('기업 ID (예: mystic_herb)')
        .setPlaceholder('매도할 기업의 ID를 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const sharesInput = new TextInputBuilder()
        .setCustomId('shares')
        .setLabel('매도 수량')
        .setPlaceholder('판매할 주식 수량을 입력하세요')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(companyInput),
        new ActionRowBuilder().addComponents(sharesInput)
    );
    
    await interaction.showModal(modal);
}

// 투자 자산 표시
async function showPlayerStocks(interaction) {
    const portfolio = await getPlayerPortfolio(interaction.user.id);
    
    const portfolioEmbed = new EmbedBuilder()
        .setColor('#27ae60')
        .setTitle('💎 나의 투자 왕국')
        .setDescription('보유한 기업 지분 현황')
        .addFields({ name: '💰 왕국 금고', value: `${formatNumber(portfolio.cash)}G`, inline: false });

    let totalValue = portfolio.cash;
    let portfolioText = '';

    if (portfolio.stocks.size === 0) {
        portfolioText = '보유한 주식이 없습니다.';
    } else {
        for (const [companyId, holding] of portfolio.stocks) {
            const company = findCompany(companyId);
            if (company) {
                const currentValue = company.price * holding.shares;
                const profit = (company.price - holding.avgPrice) * holding.shares;
                const profitPercent = ((company.price - holding.avgPrice) / holding.avgPrice * 100).toFixed(1);
                const profitIcon = profit >= 0 ? '📈' : '📉';
                
                portfolioText += `**${company.name}**\n`;
                portfolioText += `보유: ${holding.shares}주 | 평균가: ${formatNumber(holding.avgPrice)}G\n`;
                portfolioText += `현재가: ${formatNumber(company.price)}G | 평가액: ${formatNumber(currentValue)}G\n`;
                portfolioText += `${profitIcon} 손익: ${profit >= 0 ? '+' : ''}${formatNumber(profit)}G (${profitPercent}%)\n\n`;
                
                totalValue += currentValue;
            }
        }
    }

    portfolioEmbed.addFields(
        { name: '📊 보유 주식', value: portfolioText || '없음', inline: false },
        { name: '💎 총 자산', value: `${formatNumber(totalValue)}G`, inline: true }
    );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_buy')
                .setLabel('💰 매수')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('stock_sell')
                .setLabel('💸 매도')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('stock_market')
                .setLabel('🔙 뒤로')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.update({
        embeds: [portfolioEmbed],
        components: [buttons]
    });
}

// 주식 매수/매도는 stockTrading.js의 함수를 사용합니다.

// 주식 인터랙션 핸들러
async function handleStockInteraction(interaction) {
    const customId = interaction.customId;
    
    // 디버깅을 위한 로깅
    const { debugStockButtonClick } = require('../../utils/interactionDebug');
    debugStockButtonClick(interaction);
    
    // 메인 메뉴 버튼들
    if (customId === 'stock_market_overview') {
        return await showMarketOverview(interaction);
    } else if (customId === 'stock_sectors') {
        return await showSectorList(interaction);
    } else if (customId === 'stock_news') {
        return await showNewsView(interaction);
    } else if (customId === 'stock_portfolio') {
        return await showPortfolio(interaction);
    } else if (customId === 'stock_list') {
        return await showStockList(interaction);
    } else if (customId === 'stock_rankings') {
        return await showStockRankings(interaction);
    } else if (customId === 'stock_market') {
        return await showStockMarket(interaction);
    }
    
    // 종목 상세보기 (stock_detail_COMPANYID 형식)
    if (customId.startsWith('stock_detail_')) {
        const companyId = customId.split('_')[2];
        return await showStockDetail(interaction, companyId);
    }
    
    // 매수/매도 버튼 (간단한 모달 표시)
    if (customId === 'stock_buy') {
        try {
            // 인터랙션이 이미 응답되었는지 확인
            if (interaction.replied || interaction.deferred) {
                console.log('[Stock] Buy button - interaction already handled');
                return;
            }
            return await showStockBuyModal(interaction);
        } catch (error) {
            console.error('[Stock] Buy modal error:', error);
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({ 
                    content: '❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 
                    flags: 64 
                });
            }
        }
    }
    if (customId === 'stock_sell') {
        try {
            // 인터랙션이 이미 응답되었는지 확인
            if (interaction.replied || interaction.deferred) {
                console.log('[Stock] Sell button - interaction already handled');
                return;
            }
            return await showStockSellModal(interaction);
        } catch (error) {
            console.error('[Stock] Sell modal error:', error);
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({ 
                    content: '❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 
                    flags: 64 
                });
            }
        }
    }
    
    // 매수/매도 실행 (stock_buy_COMPANYID_SHARES 형식)
    if (customId.startsWith('stock_buy_') && customId.split('_').length > 2) {
        const parts = customId.split('_');
        const companyId = parts[2];
        let shares = parts[3];
        
        if (shares === 'all') {
            // 최대 매수 가능 수량 계산
            const user = await getUser(interaction.user.id);
            const company = COMPANIES[companyId];
            if (company && user) {
                shares = Math.floor(user.gold / (company.currentPrice * 1.001)); // 수수료 고려
            } else {
                shares = 0;
            }
        } else {
            shares = parseInt(shares || '10');
        }
        
        if (shares > 0) {
            try {
                // 먼저 인터랙션을 defer 처리
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.deferUpdate();
                }
                
                const result = await buyStock(interaction, companyId, shares);
                
                // 성공 시 포트폴리오 화면으로 전환
                if (result.success) {
                    return await showPortfolio(interaction);
                } else {
                    // 실패 시 메시지만 표시
                    return await interaction.editReply({
                        content: result.message,
                        embeds: [],
                        components: []
                    });
                }
            } catch (error) {
                console.error('[Stock] Buy execution error:', error);
                return await interaction.editReply({
                    content: '❌ 거래 처리 중 오류가 발생했습니다.',
                    embeds: [],
                    components: []
                });
            }
        } else {
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({
                    content: '❌ 매수 가능한 수량이 없습니다.',
                    flags: 64
                });
            }
        }
    }
    
    if (customId.startsWith('stock_sell_') && customId.split('_').length > 2) {
        const parts = customId.split('_');
        const companyId = parts[2];
        let shares = parts[3];
        
        if (shares === 'all') {
            // 전량 매도
            const portfolio = await getPlayerPortfolio(interaction.user.id);
            const holding = portfolio.stocks.get(companyId);
            shares = holding ? holding.shares : 0;
        } else {
            shares = parseInt(shares || '10');
        }
        
        if (shares > 0) {
            try {
                // 먼저 인터랙션을 defer 처리
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.deferUpdate();
                }
                
                const result = await sellStock(interaction, companyId, shares);
                
                // 성공 시 포트폴리오 화면으로 전환
                if (result.success) {
                    return await showPortfolio(interaction);
                } else {
                    // 실패 시 메시지만 표시
                    return await interaction.editReply({
                        content: result.message,
                        embeds: [],
                        components: []
                    });
                }
            } catch (error) {
                console.error('[Stock] Sell execution error:', error);
                return await interaction.editReply({
                    content: '❌ 거래 처리 중 오류가 발생했습니다.',
                    embeds: [],
                    components: []
                });
            }
        } else {
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({
                    content: '❌ 매도 가능한 수량이 없습니다.',
                    flags: 64
                });
            }
        }
    }
    
    // 섹터별 보기
    if (customId.startsWith('stock_sector_')) {
        const sector = customId.split('_')[2];
        return await showSectorList(interaction, sector);
    }
    
    // 섹터 선택 드롭다운
    if (customId === 'sector_select' && interaction.isStringSelectMenu()) {
        const selectedSector = interaction.values[0];
        return await showSectorList(interaction, selectedSector);
    }
    
    // 종목 선택 드롭다운
    if (customId === 'stock_select' && interaction.isStringSelectMenu()) {
        const selectedCompany = interaction.values[0];
        return await showStockDetail(interaction, selectedCompany);
    }
}

// 뉴스 보기
async function showNewsView(interaction) {
    const newsSystem = require('../../systems/newsSystem');
    const recentNews = newsSystem.newsHistory.slice(-10);
    
    const newsEmbed = new EmbedBuilder()
        .setColor('#00BCD4')
        .setTitle('📰 실시간 시장 뉴스')
        .setDescription('최신 뉴스가 주식 시장에 미치는 영향을 확인하세요!')
        .setTimestamp();
    
    if (recentNews.length === 0) {
        newsEmbed.addFields({ 
            name: '📭 뉴스 없음', 
            value: '아직 발행된 뉴스가 없습니다.' 
        });
    } else {
        recentNews.forEach((news, index) => {
            const timeAgo = getTimeAgo(news.timestamp);
            newsEmbed.addFields({
                name: `${news.category?.emoji || '📰'} ${timeAgo}`,
                value: news.content.slice(0, 100) + (news.content.length > 100 ? '...' : ''),
                inline: false
            });
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stock_market')
                .setLabel('🔙 주식 시장으로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.update({
        embeds: [newsEmbed],
        components: [buttons]
    });
}

// 시간 계산 헬퍼
function getTimeAgo(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
}

module.exports = {
    showStockMenu,
    showStockMarket,
    showRegionalStocks,
    showChainStocks,
    showExplorationStocks,
    showPlayerStocks,
    findCompany,
    getPlayerPortfolio,
    handleStockInteraction
};