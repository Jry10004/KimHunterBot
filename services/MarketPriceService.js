const Stock = require('../models/Stock');
const MarketItem = require('../models/MarketItem');
const { COMPANIES } = require('../data/companiesData');
const { LOOT_MARKET } = require('../data/lootMarket');

class MarketPriceService {
    constructor() {
        this.updateInterval = null;
        this.isInitialized = false;
    }

    // 서비스 초기화
    async initialize() {
        if (this.isInitialized) return;

        console.log('[MarketPriceService] 시장 가격 서비스 초기화 중...');
        
        try {
            // 주식 초기화
            await this.initializeStocks();
            
            // 시장 아이템 초기화
            await this.initializeMarketItems();
            
            // 정기 업데이트 시작
            this.startPriceUpdates();
            
            this.isInitialized = true;
            console.log('[MarketPriceService] 초기화 완료');
        } catch (error) {
            console.error('[MarketPriceService] 초기화 실패:', error);
        }
    }

    // 주식 초기화
    async initializeStocks() {
        for (const [companyId, company] of Object.entries(COMPANIES)) {
            try {
                let stock = await Stock.findOne({ companyId });
                
                if (!stock) {
                    stock = new Stock({
                        companyId,
                        companyName: company.name,
                        companyType: company.type || 'general',
                        currentPrice: company.currentPrice || company.basePrice,
                        basePrice: company.basePrice,
                        shares: company.shares || 100000
                    });
                    
                    // 초기 가격 히스토리 생성
                    const basePrice = company.basePrice;
                    for (let i = 30; i >= 0; i--) {
                        const price = basePrice * (1 + (Math.random() - 0.5) * 0.1);
                        stock.priceHistory.push({
                            price: Math.floor(price),
                            timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
                        });
                    }
                    
                    await stock.save();
                    console.log(`[MarketPriceService] 주식 생성: ${company.name}`);
                }
            } catch (error) {
                console.error(`[MarketPriceService] 주식 초기화 실패 - ${companyId}:`, error);
            }
        }
    }

    // 시장 아이템 초기화
    async initializeMarketItems() {
        // 전리품 시장 아이템 초기화
        for (const [categoryId, category] of Object.entries(LOOT_MARKET.categories)) {
            for (const item of category.items) {
                try {
                    let marketItem = await MarketItem.findOne({ itemId: item.id });
                    
                    if (!marketItem) {
                        marketItem = new MarketItem({
                            itemId: item.id,
                            itemName: item.name,
                            itemType: 'loot',
                            category: categoryId,
                            basePrice: item.basePrice,
                            currentPrice: item.currentPrice || item.basePrice,
                            metadata: {
                                emoji: item.emoji,
                                symbol: item.id.toUpperCase(),
                                rarity: item.rarity || 'common'
                            }
                        });
                        
                        // 초기 가격 히스토리
                        const basePrice = item.basePrice;
                        for (let i = 48; i >= 0; i--) {
                            const price = basePrice * (1 + (Math.random() - 0.5) * 0.15);
                            marketItem.priceHistory.push({
                                price: Math.floor(price),
                                volume: Math.floor(Math.random() * 100),
                                timestamp: new Date(Date.now() - i * 60 * 60 * 1000)
                            });
                        }
                        
                        await marketItem.save();
                        console.log(`[MarketPriceService] 시장 아이템 생성: ${item.name}`);
                    }
                } catch (error) {
                    console.error(`[MarketPriceService] 아이템 초기화 실패 - ${item.id}:`, error);
                }
            }
        }

        // 물고기 시장 아이템 초기화
        const fishItems = [
            { id: 'tuna', name: '참치', basePrice: 25000, rarity: 'legendary', emoji: '🐟' },
            { id: 'salmon', name: '연어', basePrice: 18000, rarity: 'epic', emoji: '🍣' },
            { id: 'mackerel', name: '고등어', basePrice: 8000, rarity: 'rare', emoji: '🐠' },
            { id: 'catfish', name: '메기', basePrice: 1500, rarity: 'uncommon', emoji: '🐡' },
            { id: 'carp', name: '잉어', basePrice: 1000, rarity: 'common', emoji: '🐟' },
            { id: 'goldfish', name: '금붕어', basePrice: 5000, rarity: 'rare', emoji: '🐠' },
            { id: 'shark', name: '상어', basePrice: 20000, rarity: 'legendary', emoji: '🦈' },
            { id: 'squid', name: '오징어', basePrice: 3000, rarity: 'uncommon', emoji: '🦑' },
            { id: 'shrimp', name: '새우', basePrice: 2000, rarity: 'common', emoji: '🦐' },
            { id: 'lobster', name: '랍스터', basePrice: 10000, rarity: 'epic', emoji: '🦞' }
        ];

        for (const fish of fishItems) {
            try {
                let marketItem = await MarketItem.findOne({ itemId: fish.id });
                
                if (!marketItem) {
                    marketItem = new MarketItem({
                        itemId: fish.id,
                        itemName: fish.name,
                        itemType: 'fish',
                        category: fish.rarity + '_fish',
                        basePrice: fish.basePrice,
                        currentPrice: fish.basePrice,
                        metadata: {
                            emoji: fish.emoji,
                            symbol: fish.id.toUpperCase(),
                            rarity: fish.rarity
                        }
                    });
                    
                    // 초기 가격 히스토리
                    const basePrice = fish.basePrice;
                    for (let i = 24; i >= 0; i--) {
                        const price = basePrice * (1 + (Math.random() - 0.5) * 0.2);
                        marketItem.priceHistory.push({
                            price: Math.floor(price),
                            volume: Math.floor(Math.random() * 50),
                            timestamp: new Date(Date.now() - i * 60 * 60 * 1000)
                        });
                    }
                    
                    await marketItem.save();
                    console.log(`[MarketPriceService] 물고기 생성: ${fish.name}`);
                }
            } catch (error) {
                console.error(`[MarketPriceService] 물고기 초기화 실패 - ${fish.id}:`, error);
            }
        }
    }

    // 정기 가격 업데이트 시작
    startPriceUpdates() {
        // 1분마다 가격 업데이트
        this.updateInterval = setInterval(async () => {
            await this.updateAllPrices();
        }, 60000); // 60초

        console.log('[MarketPriceService] 정기 가격 업데이트 시작 (1분 간격)');
    }

    // 모든 가격 업데이트
    async updateAllPrices() {
        try {
            // 주식 가격 업데이트
            const stocks = await Stock.find({});
            for (const stock of stocks) {
                try {
                    const changePercent = (Math.random() - 0.5) * 0.04; // ±2% 변동
                    const newPrice = Math.floor(stock.currentPrice * (1 + changePercent));
                    const volume = Math.floor(Math.random() * 10000 + 1000);
                    
                    // 재시도 로직 추가
                    let retries = 3;
                    while (retries > 0) {
                        try {
                            // 최신 문서 다시 가져오기
                            const freshStock = await Stock.findById(stock._id);
                            if (!freshStock) break;
                            
                            await freshStock.updatePrice(newPrice);
                            freshStock.volume = volume;
                            await freshStock.save();
                            break;
                        } catch (err) {
                            if (err.name === 'VersionError' && retries > 1) {
                                retries--;
                                await new Promise(resolve => setTimeout(resolve, 100));
                                continue;
                            }
                            throw err;
                        }
                    }
                } catch (error) {
                    console.error(`[MarketPriceService] 주식 업데이트 실패 - ${stock.companyName}:`, error.message);
                }
            }

            // 시장 아이템 가격 업데이트
            const marketItems = await MarketItem.find({});
            for (const item of marketItems) {
                try {
                    // 아이템 타입별 변동성 설정
                    let volatility = 0.02; // 기본 2%
                    if (item.itemType === 'fish') volatility = 0.05; // 물고기는 5%
                    if (item.metadata?.rarity === 'legendary') volatility = 0.08; // 전설은 8%
                    
                    const changePercent = (Math.random() - 0.5) * volatility * 2;
                    const newPrice = Math.floor(item.currentPrice * (1 + changePercent));
                    const volume = Math.floor(Math.random() * 100 + 10);
                    
                    // 재시도 로직 추가
                    let retries = 3;
                    while (retries > 0) {
                        try {
                            // 최신 문서 다시 가져오기
                            const freshItem = await MarketItem.findById(item._id);
                            if (!freshItem) break;
                            
                            await freshItem.updatePrice(newPrice, volume);
                            break;
                        } catch (err) {
                            if (err.name === 'VersionError' && retries > 1) {
                                retries--;
                                await new Promise(resolve => setTimeout(resolve, 100));
                                continue;
                            }
                            throw err;
                        }
                    }
                } catch (error) {
                    console.error(`[MarketPriceService] 아이템 업데이트 실패 - ${item.itemName}:`, error.message);
                }
            }

            console.log(`[MarketPriceService] 가격 업데이트 완료 - 주식: ${stocks.length}개, 아이템: ${marketItems.length}개`);
        } catch (error) {
            console.error('[MarketPriceService] 가격 업데이트 실패:', error);
        }
    }

    // 특정 주식의 가격 히스토리 가져오기
    async getStockPriceHistory(companyId, hours = 24) {
        try {
            const stock = await Stock.findOne({ companyId });
            if (!stock) return null;

            const cutoffTime = new Date();
            cutoffTime.setHours(cutoffTime.getHours() - hours);

            return stock.priceHistory.filter(h => 
                new Date(h.timestamp) >= cutoffTime
            );
        } catch (error) {
            console.error('[MarketPriceService] 주식 히스토리 조회 실패:', error);
            return null;
        }
    }

    // 특정 아이템의 가격 히스토리 가져오기
    async getItemPriceHistory(itemId, hours = 24) {
        try {
            const item = await MarketItem.findOne({ itemId });
            if (!item) return null;

            return item.getChartData(hours);
        } catch (error) {
            console.error('[MarketPriceService] 아이템 히스토리 조회 실패:', error);
            return null;
        }
    }

    // 시장 통계 가져오기
    async getMarketStats(itemType) {
        try {
            if (itemType === 'stock') {
                return await Stock.getMarketStats();
            } else {
                const items = await MarketItem.find({ itemType });
                
                const stats = {
                    totalItems: items.length,
                    avgChange: 0,
                    topGainers: [],
                    topLosers: [],
                    totalVolume: 0
                };

                items.forEach(item => {
                    stats.avgChange += item.dailyStats?.changePercent || 0;
                    stats.totalVolume += item.dailyStats?.volume || 0;
                });

                stats.avgChange = (stats.avgChange / items.length).toFixed(2);
                
                // 상위 상승/하락
                const sorted = items.sort((a, b) => 
                    (b.dailyStats?.changePercent || 0) - (a.dailyStats?.changePercent || 0)
                );
                
                stats.topGainers = sorted.slice(0, 5).map(item => ({
                    name: item.itemName,
                    change: item.dailyStats?.changePercent || 0
                }));
                
                stats.topLosers = sorted.slice(-5).reverse().map(item => ({
                    name: item.itemName,
                    change: item.dailyStats?.changePercent || 0
                }));

                return stats;
            }
        } catch (error) {
            console.error('[MarketPriceService] 시장 통계 조회 실패:', error);
            return null;
        }
    }

    // 서비스 중지
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('[MarketPriceService] 가격 업데이트 중지');
        }
    }
}

// 싱글톤 인스턴스
const marketPriceService = new MarketPriceService();

module.exports = marketPriceService;