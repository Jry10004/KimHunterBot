const mongoose = require('mongoose');

// 유저 유물 스키마
const userArtifactsSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    pickaxes: {
        bronze: {
            level: {
                type: Number,
                default: 1,
                min: 1,
                max: 100
            },
            experience: {
                type: Number,
                default: 0
            }
        },
        silver: {
            level: {
                type: Number,
                default: 0,
                min: 0,
                max: 100
            },
            experience: {
                type: Number,
                default: 0
            },
            unlocked: {
                type: Boolean,
                default: false
            }
        },
        gold: {
            level: {
                type: Number,
                default: 0,
                min: 0,
                max: 100
            },
            experience: {
                type: Number,
                default: 0
            },
            unlocked: {
                type: Boolean,
                default: false
            }
        }
    },
    currentPickaxe: {
        type: String,
        enum: ['bronze', 'silver', 'gold'],
        default: 'bronze'
    },
    artifacts: [{
        id: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        rarity: {
            type: String,
            enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
            required: true
        },
        baseItem: {
            type: String,
            required: true
        },
        foundDate: {
            type: Date,
            default: Date.now
        },
        foundWith: {
            company: String,
            pickaxe: String,
            pickaxeLevel: Number
        },
        value: {
            type: Number,
            required: true
        },
        sold: {
            type: Boolean,
            default: false
        },
        soldPrice: {
            type: Number,
            default: 0
        },
        soldDate: {
            type: Date
        }
    }],
    statistics: {
        totalArtifactsFound: {
            type: Number,
            default: 0
        },
        totalArtifactsSold: {
            type: Number,
            default: 0
        },
        totalEarnings: {
            type: Number,
            default: 0
        },
        totalExplorations: {
            type: Number,
            default: 0
        },
        rarityCount: {
            common: { type: Number, default: 0 },
            uncommon: { type: Number, default: 0 },
            rare: { type: Number, default: 0 },
            epic: { type: Number, default: 0 },
            legendary: { type: Number, default: 0 },
            mythic: { type: Number, default: 0 }
        },
        favoriteCompany: {
            companyId: String,
            explorationCount: Number
        },
        bestFind: {
            name: String,
            rarity: String,
            value: Number,
            date: Date
        }
    },
    achievements: [{
        id: String,
        name: String,
        description: String,
        unlockedDate: {
            type: Date,
            default: Date.now
        },
        reward: Number
    }],
    lastExploration: {
        type: Date,
        default: null
    },
    explorationStreak: {
        count: {
            type: Number,
            default: 0
        },
        lastDate: {
            type: Date,
            default: null
        }
    },
    companyRelations: [{
        companyId: String,
        explorationCount: {
            type: Number,
            default: 0
        },
        totalValue: {
            type: Number,
            default: 0
        },
        reputation: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    }]
}, {
    timestamps: true
});

// 인덱스 생성 (userId는 unique: true로 이미 인덱스 생성됨)
userArtifactsSchema.index({ 'statistics.totalEarnings': -1 });
userArtifactsSchema.index({ 'statistics.totalArtifactsFound': -1 });

// 자동 인덱스 생성 비활성화
userArtifactsSchema.set('autoIndex', false);

// 곡괭이 업그레이드 메서드
userArtifactsSchema.methods.upgradePickaxe = function(pickaxeType) {
    const pickaxe = this.pickaxes[pickaxeType];
    
    if (!pickaxe.unlocked && pickaxeType !== 'bronze') {
        throw new Error('곡괭이가 잠겨있습니다!');
    }
    
    if (pickaxe.level >= 100) {
        throw new Error('이미 최고 레벨입니다!');
    }
    
    pickaxe.level += 1;
    pickaxe.experience = 0;
    
    return this.save();
};

// 곡괭이 잠금 해제
userArtifactsSchema.methods.unlockPickaxe = function(pickaxeType) {
    if (pickaxeType === 'bronze') {
        return Promise.resolve(this);
    }
    
    this.pickaxes[pickaxeType].unlocked = true;
    this.pickaxes[pickaxeType].level = 1;
    
    return this.save();
};

// 유물 추가
userArtifactsSchema.methods.addArtifact = async function(artifact) {
    this.artifacts.push(artifact);
    this.statistics.totalArtifactsFound += 1;
    this.statistics.rarityCount[artifact.rarity] += 1;
    
    // 최고 발견 업데이트
    if (!this.statistics.bestFind || artifact.value > this.statistics.bestFind.value) {
        this.statistics.bestFind = {
            name: artifact.name,
            rarity: artifact.rarity,
            value: artifact.value,
            date: new Date()
        };
    }
    
    // User 모델의 통합 랭킹 데이터 업데이트
    const User = require('./User');
    const user = await User.findOne({ discordId: this.userId });
    if (user) {
        if (!user.rankingStats) user.rankingStats = {};
        if (!user.rankingStats.artifact) user.rankingStats.artifact = {};
        
        user.rankingStats.artifact.totalFound = this.statistics.totalArtifactsFound;
        user.rankingStats.artifact.highestValue = Math.max(
            user.rankingStats.artifact.highestValue || 0,
            artifact.value
        );
        user.rankingStats.artifact.lastUpdated = new Date();
        await user.save();
    }
    
    return this.save();
};

// 유물 판매
userArtifactsSchema.methods.sellArtifact = async function(artifactId, sellPrice) {
    const artifactIndex = this.artifacts.findIndex(a => a.id === artifactId && !a.sold);
    
    if (artifactIndex === -1) {
        throw new Error('유물을 찾을 수 없습니다!');
    }
    
    const artifact = this.artifacts[artifactIndex];
    artifact.sold = true;
    artifact.soldPrice = sellPrice;
    artifact.soldDate = new Date();
    
    this.statistics.totalArtifactsSold += 1;
    this.statistics.totalEarnings += sellPrice;
    
    // User 모델의 통합 랭킹 데이터 업데이트
    const User = require('./User');
    const user = await User.findOne({ discordId: this.userId });
    if (user) {
        if (!user.rankingStats) user.rankingStats = {};
        if (!user.rankingStats.artifact) user.rankingStats.artifact = {};
        
        user.rankingStats.artifact.totalEarnings = this.statistics.totalEarnings;
        user.rankingStats.artifact.lastUpdated = new Date();
        await user.save();
    }
    
    return this.save();
};

// 탐사 기록
userArtifactsSchema.methods.recordExploration = function(companyId) {
    this.statistics.totalExplorations += 1;
    this.lastExploration = new Date();
    
    // 연속 탐사 체크
    const now = new Date();
    const lastDate = this.explorationStreak.lastDate;
    
    if (lastDate) {
        const hoursSinceLastExploration = (now - lastDate) / (1000 * 60 * 60);
        
        if (hoursSinceLastExploration < 24) {
            this.explorationStreak.count += 1;
        } else {
            this.explorationStreak.count = 1;
        }
    } else {
        this.explorationStreak.count = 1;
    }
    
    this.explorationStreak.lastDate = now;
    
    // 회사 관계 업데이트
    const relationIndex = this.companyRelations.findIndex(r => r.companyId === companyId);
    
    if (relationIndex !== -1) {
        this.companyRelations[relationIndex].explorationCount += 1;
        this.companyRelations[relationIndex].reputation = Math.min(
            this.companyRelations[relationIndex].reputation + 1,
            100
        );
    } else {
        this.companyRelations.push({
            companyId,
            explorationCount: 1,
            totalValue: 0,
            reputation: 1
        });
    }
    
    // 선호 회사 업데이트
    const topCompany = this.companyRelations.reduce((max, company) => 
        company.explorationCount > (max?.explorationCount || 0) ? company : max
    , null);
    
    if (topCompany) {
        this.statistics.favoriteCompany = {
            companyId: topCompany.companyId,
            explorationCount: topCompany.explorationCount
        };
    }
    
    return this.save();
};

// 업적 해금
userArtifactsSchema.methods.unlockAchievement = function(achievementId, achievement) {
    const alreadyUnlocked = this.achievements.some(a => a.id === achievementId);
    
    if (!alreadyUnlocked) {
        this.achievements.push({
            id: achievementId,
            name: achievement.name,
            description: achievement.description,
            reward: achievement.reward
        });
        
        return this.save();
    }
    
    return Promise.resolve(this);
};

// 인벤토리 정리 (판매된 유물 제거)
userArtifactsSchema.methods.cleanInventory = function() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    this.artifacts = this.artifacts.filter(artifact => 
        !artifact.sold || artifact.soldDate > thirtyDaysAgo
    );
    
    return this.save();
};

// 정적 메서드: 탐사 랭킹
userArtifactsSchema.statics.getExplorationRankings = async function(type = 'earnings') {
    let sortField;
    
    switch (type) {
        case 'found':
            sortField = { 'statistics.totalArtifactsFound': -1 };
            break;
        case 'mythic':
            sortField = { 'statistics.rarityCount.mythic': -1 };
            break;
        case 'legendary':
            sortField = { 'statistics.rarityCount.legendary': -1 };
            break;
        case 'earnings':
        default:
            sortField = { 'statistics.totalEarnings': -1 };
    }
    
    return this.find({})
        .sort(sortField)
        .limit(10)
        .select('userId username statistics.totalEarnings statistics.totalArtifactsFound statistics.rarityCount statistics.bestFind');
};

const UserArtifacts = mongoose.model('UserArtifacts', userArtifactsSchema);

module.exports = UserArtifacts;