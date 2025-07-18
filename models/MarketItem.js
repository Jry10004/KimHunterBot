const mongoose = require('mongoose');

// 시장 아이템 스키마 (물고기, 전리품, 유물 등)
const marketItemSchema = new mongoose.Schema({
    itemId: {
        type: String,
        required: true,
        unique: true
    },
    itemName: {
        type: String,
        required: true
    },
    itemType: {
        type: String,
        enum: ['fish', 'loot', 'artifact', 'material'],
        required: true
    },
    category: {
        type: String, // e.g., 'common_fish', 'rare_materials', etc.
        required: true
    },
    basePrice: {
        type: Number,
        required: true,
        default: 100
    },
    currentPrice: {
        type: Number,
        required: true,
        default: 100
    },
    priceHistory: [{
        price: Number,
        volume: {
            type: Number,
            default: 0
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    dailyStats: {
        high: Number,
        low: Number,
        open: Number,
        close: Number,
        volume: Number,
        avgPrice: Number,
        changeAmount: Number,
        changePercent: Number,
        lastUpdate: {
            type: Date,
            default: Date.now
        }
    },
    weeklyStats: {
        high: Number,
        low: Number,
        avgPrice: Number,
        totalVolume: Number
    },
    marketFactors: {
        supply: {
            type: Number,
            default: 100 // 공급량 지수
        },
        demand: {
            type: Number,
            default: 100 // 수요 지수
        },
        seasonalBonus: {
            type: Number,
            default: 1.0 // 계절 보너스 배수
        },
        eventBonus: {
            type: Number,
            default: 1.0 // 이벤트 보너스 배수
        }
    },
    metadata: {
        emoji: String,
        symbol: String, // e.g., 'TUNA', 'SLIME'
        rarity: String,
        description: String
    }
}, {
    timestamps: true
});

// 인덱스 생성
// itemId는 unique: true로 이미 인덱스 생성됨, 중복 생성 제거
marketItemSchema.index({ itemType: 1, category: 1 });
marketItemSchema.index({ currentPrice: -1 });
marketItemSchema.index({ 'dailyStats.changePercent': -1 });

// 기존 인덱스와 충돌 방지
marketItemSchema.set('autoIndex', false);

// 가격 업데이트 메서드
marketItemSchema.methods.updatePrice = async function(newPrice, volume = 0) {
    const oldPrice = this.currentPrice;
    this.currentPrice = newPrice;
    
    // 가격 히스토리 추가
    this.priceHistory.push({
        price: newPrice,
        volume: volume,
        timestamp: new Date()
    });
    
    // 히스토리 제한 (최근 200개)
    if (this.priceHistory.length > 200) {
        this.priceHistory = this.priceHistory.slice(-200);
    }
    
    // 일일 통계 업데이트
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayHistory = this.priceHistory.filter(h => 
        new Date(h.timestamp) >= today
    );
    
    if (todayHistory.length > 0) {
        const prices = todayHistory.map(h => h.price);
        this.dailyStats = {
            high: Math.max(...prices),
            low: Math.min(...prices),
            open: todayHistory[0].price,
            close: newPrice,
            volume: todayHistory.reduce((sum, h) => sum + (h.volume || 0), 0),
            avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
            changeAmount: newPrice - oldPrice,
            changePercent: oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice * 100) : 0,
            lastUpdate: new Date()
        };
    }
    
    return this.save();
};

// 시장 요인 업데이트
marketItemSchema.methods.updateMarketFactors = async function(factors) {
    if (factors.supply !== undefined) {
        this.marketFactors.supply = Math.max(0, Math.min(200, factors.supply));
    }
    if (factors.demand !== undefined) {
        this.marketFactors.demand = Math.max(0, Math.min(200, factors.demand));
    }
    if (factors.seasonalBonus !== undefined) {
        this.marketFactors.seasonalBonus = Math.max(0.5, Math.min(2.0, factors.seasonalBonus));
    }
    if (factors.eventBonus !== undefined) {
        this.marketFactors.eventBonus = Math.max(0.5, Math.min(3.0, factors.eventBonus));
    }
    
    // 시장 요인에 따른 가격 조정
    const supplyDemandRatio = this.marketFactors.demand / this.marketFactors.supply;
    const totalMultiplier = supplyDemandRatio * this.marketFactors.seasonalBonus * this.marketFactors.eventBonus;
    const newPrice = Math.floor(this.basePrice * totalMultiplier);
    
    await this.updatePrice(newPrice);
    
    return this.save();
};

// 주간 통계 계산
marketItemSchema.methods.calculateWeeklyStats = async function() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weekHistory = this.priceHistory.filter(h => 
        new Date(h.timestamp) >= oneWeekAgo
    );
    
    if (weekHistory.length > 0) {
        const prices = weekHistory.map(h => h.price);
        this.weeklyStats = {
            high: Math.max(...prices),
            low: Math.min(...prices),
            avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
            totalVolume: weekHistory.reduce((sum, h) => sum + (h.volume || 0), 0)
        };
    }
    
    return this.save();
};

// 차트 데이터 가져오기
marketItemSchema.methods.getChartData = function(hours = 24) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);
    
    const relevantHistory = this.priceHistory.filter(h => 
        new Date(h.timestamp) >= cutoffTime
    );
    
    return relevantHistory.map(h => ({
        price: h.price,
        volume: h.volume || 0,
        timestamp: h.timestamp
    }));
};

// 정적 메서드: 카테고리별 시장 통계
marketItemSchema.statics.getCategoryStats = async function(itemType, category) {
    const items = await this.find({ itemType, category });
    
    if (items.length === 0) return null;
    
    const avgChange = items.reduce((sum, item) => 
        sum + (item.dailyStats?.changePercent || 0), 0
    ) / items.length;
    
    const topGainer = items.reduce((max, item) => 
        (item.dailyStats?.changePercent || 0) > (max.dailyStats?.changePercent || 0) ? item : max
    );
    
    const topLoser = items.reduce((min, item) => 
        (item.dailyStats?.changePercent || 0) < (min.dailyStats?.changePercent || 0) ? item : min
    );
    
    return {
        itemCount: items.length,
        avgChange: avgChange.toFixed(2),
        topGainer: {
            name: topGainer.itemName,
            change: topGainer.dailyStats?.changePercent || 0
        },
        topLoser: {
            name: topLoser.itemName,
            change: topLoser.dailyStats?.changePercent || 0
        },
        totalVolume: items.reduce((sum, item) => 
            sum + (item.dailyStats?.volume || 0), 0
        )
    };
};

// 정적 메서드: 시장 트렌드 아이템
marketItemSchema.statics.getTrendingItems = async function(itemType, limit = 10) {
    return this.find({ itemType })
        .sort({ 'dailyStats.volume': -1 })
        .limit(limit)
        .select('itemId itemName currentPrice dailyStats metadata');
};

// 정적 메서드: 가격 변동 상위/하위
marketItemSchema.statics.getPriceMovers = async function(itemType, direction = 'up', limit = 5) {
    const sortOrder = direction === 'up' ? -1 : 1;
    
    return this.find({ itemType })
        .sort({ 'dailyStats.changePercent': sortOrder })
        .limit(limit)
        .select('itemId itemName currentPrice dailyStats metadata');
};

const MarketItem = mongoose.model('MarketItem', marketItemSchema);

module.exports = MarketItem;