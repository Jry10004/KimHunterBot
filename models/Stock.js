const mongoose = require('mongoose');

// 주식 스키마
const stockSchema = new mongoose.Schema({
    companyId: {
        type: String,
        required: true,
        unique: true
    },
    companyName: {
        type: String,
        required: true
    },
    companyType: {
        type: String,
        enum: ['exploration', 'general', 'chain', 'regional'],
        default: 'general'
    },
    currentPrice: {
        type: Number,
        required: true,
        default: 1000
    },
    basePrice: {
        type: Number,
        required: true,
        default: 1000
    },
    shares: {
        type: Number,
        default: 100000 // 총 발행 주식 수
    },
    dailyChange: {
        type: Number,
        default: 0
    },
    dailyChangePercent: {
        type: Number,
        default: 0
    },
    volume: {
        type: Number,
        default: 0
    },
    priceHistory: [{
        price: Number,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    news: [{
        title: String,
        content: String,
        impact: Number, // -100 ~ 100
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    holders: [{
        userId: String,
        shares: Number,
        avgPrice: Number
    }],
    marketCap: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// 인덱스 생성
stockSchema.index({ companyId: 1 });
stockSchema.index({ currentPrice: -1 });
stockSchema.index({ dailyChangePercent: -1 });
stockSchema.index({ volume: -1 });

// 시가총액 계산
stockSchema.virtual('calculatedMarketCap').get(function() {
    return this.currentPrice * this.shares;
});

// 가격 업데이트 메서드
stockSchema.methods.updatePrice = function(newPrice) {
    const oldPrice = this.currentPrice || this.basePrice;
    
    // oldPrice가 0인 경우 처리
    if (oldPrice === 0) {
        this.currentPrice = newPrice;
        this.dailyChange = 0;
        this.dailyChangePercent = 0;
    } else {
        this.currentPrice = newPrice;
        this.dailyChange = newPrice - oldPrice;
        // 수치형으로 저장 (toFixed 사용 안함)
        this.dailyChangePercent = parseFloat(((newPrice - oldPrice) / oldPrice * 100).toFixed(2));
    }
    
    this.marketCap = this.calculatedMarketCap;
    
    // 가격 히스토리 추가
    this.priceHistory.push({
        price: newPrice,
        timestamp: new Date()
    });
    
    // 히스토리 100개로 제한
    if (this.priceHistory.length > 100) {
        this.priceHistory.shift();
    }
    
    return this.save();
};

// 거래량 업데이트
stockSchema.methods.addVolume = function(shares) {
    this.volume += shares;
    return this.save();
};

// 뉴스 추가
stockSchema.methods.addNews = function(title, content, impact) {
    this.news.push({
        title,
        content,
        impact: Math.max(-100, Math.min(100, impact))
    });
    
    // 뉴스 30개로 제한
    if (this.news.length > 30) {
        this.news.shift();
    }
    
    // 뉴스 임팩트에 따른 가격 변동
    const priceImpact = 1 + (impact / 1000); // -10% ~ +10%
    const newPrice = Math.max(1, Math.floor(this.currentPrice * priceImpact)); // 최소가 1원
    return this.updatePrice(newPrice);
    
    return this.save();
};

// 주주 업데이트
stockSchema.methods.updateHolder = function(userId, shares, avgPrice) {
    const holderIndex = this.holders.findIndex(h => h.userId === userId);
    
    if (shares === 0) {
        // 전량 매도
        if (holderIndex !== -1) {
            this.holders.splice(holderIndex, 1);
        }
    } else {
        if (holderIndex !== -1) {
            this.holders[holderIndex].shares = shares;
            this.holders[holderIndex].avgPrice = avgPrice;
        } else {
            this.holders.push({ userId, shares, avgPrice });
        }
    }
    
    // 상위 100명만 유지
    this.holders.sort((a, b) => b.shares - a.shares);
    this.holders = this.holders.slice(0, 100);
    
    return this.save();
};

// 일일 초기화
stockSchema.methods.dailyReset = function() {
    this.volume = 0;
    this.dailyChange = 0;
    this.dailyChangePercent = 0;
    return this.save();
};

// 정적 메서드: 시장 통계
stockSchema.statics.getMarketStats = async function() {
    const stocks = await this.find({});
    
    let totalMarketCap = 0;
    let totalVolume = 0;
    let gainers = 0;
    let losers = 0;
    
    stocks.forEach(stock => {
        totalMarketCap += stock.marketCap || stock.calculatedMarketCap;
        totalVolume += stock.volume;
        if (stock.dailyChangePercent > 0) gainers++;
        else if (stock.dailyChangePercent < 0) losers++;
    });
    
    return {
        totalStocks: stocks.length,
        totalMarketCap,
        totalVolume,
        gainers,
        losers,
        unchanged: stocks.length - gainers - losers
    };
};

// 정적 메서드: 상위 종목
stockSchema.statics.getTopStocks = async function(type = 'gainers', limit = 10) {
    let sortField;
    
    switch (type) {
        case 'gainers':
            sortField = { dailyChangePercent: -1 };
            break;
        case 'losers':
            sortField = { dailyChangePercent: 1 };
            break;
        case 'volume':
            sortField = { volume: -1 };
            break;
        case 'marketcap':
            sortField = { marketCap: -1 };
            break;
        default:
            sortField = { marketCap: -1 };
    }
    
    return this.find({})
        .sort(sortField)
        .limit(limit)
        .select('companyId companyName currentPrice dailyChangePercent volume marketCap');
};

const Stock = mongoose.model('Stock', stockSchema);

module.exports = Stock;