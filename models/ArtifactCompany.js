const mongoose = require('mongoose');

// 탐사 회사 스키마
const artifactCompanySchema = new mongoose.Schema({
    companyId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    basePrice: {
        type: Number,
        required: true,
        default: 1000
    },
    currentPrice: {
        type: Number,
        required: true,
        default: 1000
    },
    specialty: {
        type: String,
        required: true
    },
    multiplier: {
        type: Number,
        required: true,
        default: 1
    },
    totalArtifactsFound: {
        type: Number,
        default: 0
    },
    totalRevenue: {
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
    topExplorers: [{
        userId: String,
        username: String,
        artifactsFound: Number,
        totalValue: Number
    }],
    dailyStats: {
        artifactsFound: {
            type: Number,
            default: 0
        },
        revenue: {
            type: Number,
            default: 0
        },
        lastReset: {
            type: Date,
            default: Date.now
        }
    }
}, {
    timestamps: true
});

// 인덱스 생성
// companyId는 unique: true로 이미 인덱스 생성됨
artifactCompanySchema.index({ currentPrice: -1 });
artifactCompanySchema.index({ totalRevenue: -1 });

// 가격 업데이트 메서드
artifactCompanySchema.methods.updatePrice = function(changePercent) {
    const maxChange = 0.1; // 최대 10% 변동
    const actualChange = Math.max(-maxChange, Math.min(maxChange, changePercent));
    
    this.currentPrice = Math.floor(this.currentPrice * (1 + actualChange));
    this.currentPrice = Math.max(100, this.currentPrice); // 최소 가격 100
    
    // 가격 히스토리 추가 (최대 100개 유지)
    this.priceHistory.push({
        price: this.currentPrice,
        timestamp: new Date()
    });
    
    if (this.priceHistory.length > 100) {
        this.priceHistory.shift();
    }
    
    return this.save();
};

// 탐사 통계 업데이트
artifactCompanySchema.methods.recordExploration = function(userId, username, artifactValue) {
    this.totalArtifactsFound += 1;
    this.totalRevenue += artifactValue;
    this.dailyStats.artifactsFound += 1;
    this.dailyStats.revenue += artifactValue;
    
    // 탑 탐사가 업데이트
    const explorerIndex = this.topExplorers.findIndex(e => e.userId === userId);
    
    if (explorerIndex !== -1) {
        this.topExplorers[explorerIndex].artifactsFound += 1;
        this.topExplorers[explorerIndex].totalValue += artifactValue;
    } else {
        this.topExplorers.push({
            userId,
            username,
            artifactsFound: 1,
            totalValue: artifactValue
        });
    }
    
    // 상위 10명만 유지
    this.topExplorers.sort((a, b) => b.totalValue - a.totalValue);
    this.topExplorers = this.topExplorers.slice(0, 10);
    
    return this.save();
};

// 일일 통계 리셋
artifactCompanySchema.methods.resetDailyStats = function() {
    const now = new Date();
    const lastReset = new Date(this.dailyStats.lastReset);
    
    // 하루가 지났는지 확인
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
        
        this.dailyStats.artifactsFound = 0;
        this.dailyStats.revenue = 0;
        this.dailyStats.lastReset = now;
        
        return this.save();
    }
    
    return Promise.resolve(this);
};

// 회사 성과 계산
artifactCompanySchema.methods.getPerformance = function() {
    const basePerformance = this.currentPrice / this.basePrice;
    const revenueBonus = Math.log10(this.totalRevenue + 1) / 10;
    const artifactBonus = Math.log10(this.totalArtifactsFound + 1) / 20;
    
    return basePerformance + revenueBonus + artifactBonus;
};

// 정적 메서드: 모든 회사 가격 변동
artifactCompanySchema.statics.updateAllPrices = async function() {
    const companies = await this.find({});
    
    for (const company of companies) {
        // 성과 기반 가격 변동
        const performance = company.getPerformance();
        const marketTrend = (Math.random() - 0.5) * 0.1; // -5% ~ +5%
        const changePercent = marketTrend * performance;
        
        await company.updatePrice(changePercent);
    }
};

// 정적 메서드: 회사 랭킹 조회
artifactCompanySchema.statics.getCompanyRankings = async function() {
    return this.find({})
        .sort({ totalRevenue: -1 })
        .limit(15)
        .select('companyId name currentPrice totalRevenue totalArtifactsFound specialty');
};

const ArtifactCompany = mongoose.model('ArtifactCompany', artifactCompanySchema);

module.exports = ArtifactCompany;