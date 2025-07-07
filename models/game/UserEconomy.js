// 사용자 경제 활동 모델
const mongoose = require('mongoose');

const stockHoldingSchema = new mongoose.Schema({
    stockId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    averagePrice: { type: Number, required: true },
    totalInvested: { type: Number, required: true },
    lastPurchase: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['earn', 'spend', 'transfer', 'trade', 'stockBuy', 'stockSell', 'enhancement', 'shop', 'game', 'quest', 'other']
    },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    relatedId: { type: String, default: null }, // 관련 아이템/유저 ID
    balanceAfter: { type: Number, required: true }
});

const userEconomySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    discordId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // 재화
    currencies: {
        gold: { type: Number, default: 1000, min: 0 },
        gems: { type: Number, default: 0, min: 0 },
        tokens: { type: Number, default: 0, min: 0 },
        energyFragments: { type: Number, default: 0, min: 0 }
    },
    
    // 주식 포트폴리오
    stockPortfolio: [stockHoldingSchema],
    
    // 주식 거래 통계
    stockStats: {
        totalTrades: { type: Number, default: 0 },
        totalProfit: { type: Number, default: 0 },
        totalLoss: { type: Number, default: 0 },
        bestTrade: {
            stockId: { type: String, default: null },
            profit: { type: Number, default: 0 },
            date: { type: Date, default: null }
        },
        worstTrade: {
            stockId: { type: String, default: null },
            loss: { type: Number, default: 0 },
            date: { type: Date, default: null }
        }
    },
    
    // 거래 내역 (최근 100개만 유지)
    transactionHistory: {
        type: [transactionSchema],
        validate: [arrayLimit, '{PATH} exceeds the limit of 100']
    },
    
    // 일일/주간 제한
    dailyLimits: {
        questsCompleted: { type: Number, default: 0 },
        dailyRewardClaimed: { type: Boolean, default: false },
        workCount: { type: Number, default: 0 },
        lastReset: { type: Date, default: Date.now }
    },
    
    // 경제 통계
    economyStats: {
        totalGoldEarned: { type: Number, default: 0 },
        totalGoldSpent: { type: Number, default: 0 },
        totalGemsEarned: { type: Number, default: 0 },
        totalGemsSpent: { type: Number, default: 0 },
        largestTransaction: { type: Number, default: 0 },
        bankruptcyCount: { type: Number, default: 0 }
    },
    
    // 소득원별 통계
    incomeStats: {
        fromQuests: { type: Number, default: 0 },
        fromHunting: { type: Number, default: 0 },
        fromPvP: { type: Number, default: 0 },
        fromMiniGames: { type: Number, default: 0 },
        fromTrading: { type: Number, default: 0 },
        fromStocks: { type: Number, default: 0 },
        fromGifts: { type: Number, default: 0 },
        fromOther: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// 배열 크기 제한 함수
function arrayLimit(val) {
    return val.length <= 100;
}

// 인덱스 설정
userEconomySchema.index({ userId: 1 });
userEconomySchema.index({ discordId: 1 });
userEconomySchema.index({ 'currencies.gold': -1 });
userEconomySchema.index({ 'stockPortfolio.stockId': 1 });

// 메서드: 골드 추가
userEconomySchema.methods.addGold = async function(amount, description, type = 'earn') {
    this.currencies.gold += amount;
    this.economyStats.totalGoldEarned += amount;
    
    await this.addTransaction(type, amount, description);
    return this.save();
};

// 메서드: 골드 차감
userEconomySchema.methods.spendGold = async function(amount, description, type = 'spend') {
    if (this.currencies.gold < amount) {
        throw new Error('골드가 부족합니다.');
    }
    
    this.currencies.gold -= amount;
    this.economyStats.totalGoldSpent += amount;
    
    await this.addTransaction(type, -amount, description);
    return this.save();
};

// 메서드: 거래 내역 추가
userEconomySchema.methods.addTransaction = async function(type, amount, description, relatedId = null) {
    const transaction = {
        type,
        amount,
        description,
        relatedId,
        balanceAfter: this.currencies.gold
    };
    
    this.transactionHistory.push(transaction);
    
    // 100개 초과시 오래된 것부터 제거
    if (this.transactionHistory.length > 100) {
        this.transactionHistory = this.transactionHistory.slice(-100);
    }
    
    // 최대 거래액 업데이트
    if (Math.abs(amount) > this.economyStats.largestTransaction) {
        this.economyStats.largestTransaction = Math.abs(amount);
    }
};

// 메서드: 일일 제한 리셋
userEconomySchema.methods.resetDailyLimits = function() {
    const now = new Date();
    const lastReset = new Date(this.dailyLimits.lastReset);
    
    // 날짜가 바뀌었는지 확인
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
        
        this.dailyLimits = {
            questsCompleted: 0,
            dailyRewardClaimed: false,
            workCount: 0,
            lastReset: now
        };
        
        return this.save();
    }
    
    return Promise.resolve(this);
};

module.exports = mongoose.model('UserEconomy', userEconomySchema);