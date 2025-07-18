const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    nickname: {
        type: String,
        required: true
    },
    activityType: {
        type: String,
        required: true,
        enum: ['dungeon', 'hunting', 'pvp', 'minigame', 'daily', 'shop', 'enhance', 'trade']
    },
    details: {
        // 던전
        dungeonFloor: Number,
        dungeonRewards: {
            gold: Number,
            exp: Number,
            items: Array
        },
        
        // 사냥
        huntingArea: String,
        monsterKilled: String,
        huntingRewards: {
            gold: Number,
            exp: Number,
            items: Array
        },
        
        // PVP
        opponent: String,
        pvpResult: String, // 'win', 'lose', 'draw'
        ratingChange: Number,
        
        // 미니게임
        gameType: String,
        gameResult: String,
        betAmount: Number,
        winAmount: Number,
        
        // 기타
        goldChange: Number,
        expGained: Number,
        levelUp: Boolean,
        newLevel: Number
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// 복합 인덱스 - 유저별 활동 조회 최적화
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ userId: 1, activityType: 1, timestamp: -1 });

// 자동 인덱스 생성 비활성화
activityLogSchema.set('autoIndex', false);

// 일일 활동 통계 가져오기
activityLogSchema.statics.getDailyStats = async function(userId, date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const activities = await this.find({
        userId,
        timestamp: { $gte: startOfDay, $lte: endOfDay }
    });
    
    const stats = {
        dungeonRuns: 0,
        dungeonExp: 0,
        dungeonGold: 0,
        huntingCount: 0,
        huntingExp: 0,
        huntingGold: 0,
        pvpMatches: 0,
        pvpWins: 0,
        minigamesPlayed: 0,
        totalExpGained: 0,
        totalGoldEarned: 0,
        totalGoldSpent: 0,
        levelUps: 0
    };
    
    activities.forEach(log => {
        switch(log.activityType) {
            case 'dungeon':
                stats.dungeonRuns++;
                stats.dungeonExp += log.details.dungeonRewards?.exp || 0;
                stats.dungeonGold += log.details.dungeonRewards?.gold || 0;
                break;
            case 'hunting':
                stats.huntingCount++;
                stats.huntingExp += log.details.huntingRewards?.exp || 0;
                stats.huntingGold += log.details.huntingRewards?.gold || 0;
                break;
            case 'pvp':
                stats.pvpMatches++;
                if (log.details.pvpResult === 'win') stats.pvpWins++;
                break;
            case 'minigame':
                stats.minigamesPlayed++;
                break;
        }
        
        stats.totalExpGained += log.details.expGained || 0;
        if (log.details.goldChange > 0) {
            stats.totalGoldEarned += log.details.goldChange;
        } else {
            stats.totalGoldSpent += Math.abs(log.details.goldChange);
        }
        
        if (log.details.levelUp) stats.levelUps++;
    });
    
    return stats;
};

// 활동 비교 (두 유저간)
activityLogSchema.statics.compareUsers = async function(userId1, userId2, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const [user1Stats, user2Stats] = await Promise.all([
        this.aggregate([
            {
                $match: {
                    userId: userId1,
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$activityType',
                    count: { $sum: 1 },
                    totalExp: { $sum: '$details.expGained' },
                    totalGold: { $sum: '$details.goldChange' }
                }
            }
        ]),
        this.aggregate([
            {
                $match: {
                    userId: userId2,
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$activityType',
                    count: { $sum: 1 },
                    totalExp: { $sum: '$details.expGained' },
                    totalGold: { $sum: '$details.goldChange' }
                }
            }
        ])
    ]);
    
    return { user1Stats, user2Stats };
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);