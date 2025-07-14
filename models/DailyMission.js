const mongoose = require('mongoose');

const dailyMissionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // 일일미션 진행도
    dailyMissions: {
        attendance: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 1 } },
        miniGames: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 3 } },
        pvpBattles: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 10 } },
        earnGold: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 50000 } },
        enhanceTries: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 3 } },
        exercise: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 1 } },
        hunting: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 5 } },
        stockTrade: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 1 } },
        artifactExplore: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 3 } },
        energyMining: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 10 } }
    },
    // 주간미션 진행도
    weeklyMissions: {
        totalPvpWins: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 30 } },
        totalGoldEarned: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 1000000 } },
        totalEnhanceSuccess: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 10 } },
        totalMiniGames: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 50 } },
        totalHunting: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 100 } },
        dailyMissionComplete: { completed: Boolean, progress: { type: Number, default: 0 }, target: { type: Number, default: 5 } }
    },
    // 보상 수령 여부
    dailyRewardClaimed: { type: Boolean, default: false },
    weeklyRewardClaimed: { type: Boolean, default: false },
    // 완료한 일일미션 개수
    dailyCompletedCount: { type: Number, default: 0 },
    weeklyCompletedCount: { type: Number, default: 0 },
    // 마지막 리셋 시간 - 어제 날짜로 설정하여 오늘 첫 접속시 리셋되도록
    lastDailyReset: { type: Date, default: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
    }},
    lastWeeklyReset: { type: Date, default: () => {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        return lastWeek;
    }},
    // 연속 완료 일수
    dailyStreak: { type: Number, default: 0 },
    lastStreakDate: { type: Date }
}, {
    timestamps: true
});

// 일일미션 진행도 업데이트
dailyMissionSchema.methods.updateDailyProgress = function(missionType, amount = 1) {
    if (this.dailyMissions[missionType]) {
        this.dailyMissions[missionType].progress = Math.min(
            this.dailyMissions[missionType].progress + amount,
            this.dailyMissions[missionType].target
        );
        
        if (this.dailyMissions[missionType].progress >= this.dailyMissions[missionType].target) {
            if (!this.dailyMissions[missionType].completed) {
                this.dailyMissions[missionType].completed = true;
                this.dailyCompletedCount++;
            }
        }
        
        // Mongoose가 subdocument 변경을 감지하도록 명시적으로 표시
        this.markModified(`dailyMissions.${missionType}`);
    }
};

// 주간미션 진행도 업데이트
dailyMissionSchema.methods.updateWeeklyProgress = function(missionType, amount = 1) {
    if (this.weeklyMissions[missionType]) {
        this.weeklyMissions[missionType].progress = Math.min(
            this.weeklyMissions[missionType].progress + amount,
            this.weeklyMissions[missionType].target
        );
        
        if (this.weeklyMissions[missionType].progress >= this.weeklyMissions[missionType].target) {
            if (!this.weeklyMissions[missionType].completed) {
                this.weeklyMissions[missionType].completed = true;
                this.weeklyCompletedCount++;
            }
        }
        
        // Mongoose가 subdocument 변경을 감지하도록 명시적으로 표시
        this.markModified(`weeklyMissions.${missionType}`);
    }
};

// 일일 리셋
dailyMissionSchema.methods.resetDaily = function() {
    const now = new Date();
    const lastReset = new Date(this.lastDailyReset);
    
    // 한국 시간 기준으로 날짜 비교
    const nowKST = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const lastResetKST = new Date(lastReset.getTime() + (9 * 60 * 60 * 1000));
    
    // 날짜가 바뀌었는지 확인 (년, 월, 일 비교)
    const nowDate = nowKST.toISOString().split('T')[0];
    const lastResetDate = lastResetKST.toISOString().split('T')[0];
    
    if (nowDate !== lastResetDate) {
        console.log(`[DailyMission] 일일미션 리셋 - userId: ${this.userId}, 마지막리셋: ${lastResetDate}, 현재: ${nowDate}`);
        
        // 모든 일일미션 초기화
        Object.keys(this.dailyMissions).forEach(key => {
            this.dailyMissions[key].completed = false;
            this.dailyMissions[key].progress = 0;
        });
        
        this.dailyRewardClaimed = false;
        this.dailyCompletedCount = 0;
        this.lastDailyReset = now;
        
        // 연속 출석 체크
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (this.lastStreakDate && this.lastStreakDate.toDateString() === yesterday.toDateString()) {
            // 연속 출석 유지
        } else {
            // 연속 출석 리셋
            this.dailyStreak = 0;
        }
        
        return true;
    }
    return false;
};

// 주간 리셋
dailyMissionSchema.methods.resetWeekly = function() {
    const now = new Date();
    const lastReset = new Date(this.lastWeeklyReset);
    
    // 주가 바뀌었는지 확인 (월요일 기준)
    const nowWeek = getWeekNumber(now);
    const lastWeek = getWeekNumber(lastReset);
    
    if (nowWeek !== lastWeek) {
        // 모든 주간미션 초기화
        Object.keys(this.weeklyMissions).forEach(key => {
            this.weeklyMissions[key].completed = false;
            this.weeklyMissions[key].progress = 0;
        });
        
        this.weeklyRewardClaimed = false;
        this.weeklyCompletedCount = 0;
        this.lastWeeklyReset = now;
    }
};

// 주 번호 계산
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

module.exports = mongoose.model('DailyMission', dailyMissionSchema);