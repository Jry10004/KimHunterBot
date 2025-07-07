// 사용자 게임 통계 모델
const mongoose = require('mongoose');

const userGameStatsSchema = new mongoose.Schema({
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
    
    // PVP 통계
    pvpStats: {
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        draws: { type: Number, default: 0 },
        winStreak: { type: Number, default: 0 },
        bestWinStreak: { type: Number, default: 0 },
        totalDamageDealt: { type: Number, default: 0 },
        totalDamageTaken: { type: Number, default: 0 },
        pvpRating: { type: Number, default: 1000 },
        lastPvpTime: { type: Date, default: null }
    },
    
    // 사냥 통계
    huntingStats: {
        totalHunts: { type: Number, default: 0 },
        monstersKilled: { type: Number, default: 0 },
        bossesKilled: { type: Number, default: 0 },
        totalExpGained: { type: Number, default: 0 },
        totalGoldEarned: { type: Number, default: 0 },
        rareItemsFound: { type: Number, default: 0 },
        epicItemsFound: { type: Number, default: 0 },
        legendaryItemsFound: { type: Number, default: 0 },
        favoriteArea: { type: Number, default: 0 }
    },
    
    // 던전 통계
    dungeonStats: {
        totalRuns: { type: Number, default: 0 },
        successfulRuns: { type: Number, default: 0 },
        highestFloor: { type: Number, default: 0 },
        totalFloorsCleared: { type: Number, default: 0 },
        treasuresFound: { type: Number, default: 0 },
        deathCount: { type: Number, default: 0 },
        fastestClearTime: { type: Number, default: null }
    },
    
    // 보스 레이드 통계
    bossRaidStats: {
        totalRaids: { type: Number, default: 0 },
        bossesDefeated: { type: Number, default: 0 },
        totalDamageDealt: { type: Number, default: 0 },
        highestDamage: { type: Number, default: 0 },
        mvpCount: { type: Number, default: 0 }
    },
    
    // 미니게임 통계
    miniGameStats: {
        // 가위바위보
        rpsGameData: {
            wins: { type: Number, default: 0 },
            losses: { type: Number, default: 0 },
            draws: { type: Number, default: 0 },
            totalGames: { type: Number, default: 0 },
            currentStreak: { type: Number, default: 0 },
            bestStreak: { type: Number, default: 0 },
            totalWinnings: { type: Number, default: 0 },
            totalLosses: { type: Number, default: 0 }
        },
        
        // 독버섯
        mushroomGameData: {
            gamesPlayed: { type: Number, default: 0 },
            wins: { type: Number, default: 0 },
            totalRoundsSurvived: { type: Number, default: 0 },
            bestRoundSurvived: { type: Number, default: 0 },
            totalEarnings: { type: Number, default: 0 },
            poisonedCount: { type: Number, default: 0 }
        },
        
        // 홀짝
        oddEvenGameData: {
            gamesPlayed: { type: Number, default: 0 },
            wins: { type: Number, default: 0 },
            losses: { type: Number, default: 0 },
            totalBet: { type: Number, default: 0 },
            totalWon: { type: Number, default: 0 },
            biggestWin: { type: Number, default: 0 },
            currentStreak: { type: Number, default: 0 }
        },
        
        // 끝말잇기
        wordGameData: {
            gamesPlayed: { type: Number, default: 0 },
            wins: { type: Number, default: 0 },
            wordsUsed: { type: Number, default: 0 },
            longestChain: { type: Number, default: 0 },
            totalScore: { type: Number, default: 0 }
        }
    },
    
    // 업적 통계
    achievementStats: {
        totalAchievements: { type: Number, default: 0 },
        commonAchievements: { type: Number, default: 0 },
        rareAchievements: { type: Number, default: 0 },
        epicAchievements: { type: Number, default: 0 },
        legendaryAchievements: { type: Number, default: 0 },
        achievementPoints: { type: Number, default: 0 }
    },
    
    // 전체 게임 플레이 통계
    overallStats: {
        totalPlayTime: { type: Number, default: 0 }, // 분 단위
        totalGoldEarned: { type: Number, default: 0 },
        totalGoldSpent: { type: Number, default: 0 },
        totalExpEarned: { type: Number, default: 0 },
        totalDeaths: { type: Number, default: 0 },
        lastActiveDate: { type: Date, default: Date.now },
        daysPlayed: { type: Number, default: 1 }
    }
}, {
    timestamps: true
});

// 인덱스 설정
userGameStatsSchema.index({ userId: 1 });
userGameStatsSchema.index({ discordId: 1 });
userGameStatsSchema.index({ 'pvpStats.pvpRating': -1 });
userGameStatsSchema.index({ 'overallStats.lastActiveDate': -1 });

module.exports = mongoose.model('UserGameStats', userGameStatsSchema);