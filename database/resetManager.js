// 🔄 리셋 관리자 - 중앙화된 리셋 시스템
const User = require('../models/User');
const { DAILY_RESET_ALLOWED, WEEKLY_RESET_ALLOWED, backupUserData } = require('./dataProtection');

// 일일 리셋 처리
async function processDailyReset(user) {
    try {
        console.log(`📅 일일 리셋 처리 시작 - 유저: ${user.nickname}`);
        
        // 리셋 전 백업
        await backupUserData(user.userId);
        
        const updates = {};
        
        // 일일 미션 리셋
        updates['dailyMissions'] = {
            hunting: { current: 0, completed: false },
            enhance: { current: 0, completed: false },
            shop: { current: 0, completed: false },
            exercise: { current: 0, completed: false },
            fragment: { current: 0, completed: false },
            lastReset: new Date()
        };
        
        // 일일 인기도 리셋
        updates['dailyPopularityGain'] = 0;
        updates['dailyPopularityLoss'] = 0;
        
        // 일일 융합 리셋
        updates['dailyFusions'] = 0;
        updates['dailyFusionDate'] = new Date();
        
        // 피트니스 일일 목표 리셋
        if (user.fitness) {
            updates['fitness.goals.daily'] = {
                minutes30: false,
                minutes60: false,
                minutes180: false,
                claimed30: false,
                claimed60: false,
                claimed180: false,
                lastReset: new Date()
            };
        }
        
        // 퀘스트 일일 리셋
        if (user.quests) {
            updates['quests.daily'] = {};
            updates['quests.lastDailyReset'] = new Date();
        }
        
        // 안전한 업데이트 수행
        await User.updateOne({ userId: user.userId }, { $set: updates });
        
        console.log(`✅ 일일 리셋 완료 - 유저: ${user.nickname}`);
        return { success: true, updates };
        
    } catch (error) {
        console.error(`❌ 일일 리셋 실패 - 유저: ${user.userId}`, error);
        return { success: false, error: error.message };
    }
}

// 주간 리셋 처리
async function processWeeklyReset(user) {
    try {
        console.log(`📅 주간 리셋 처리 시작 - 유저: ${user.nickname}`);
        
        // 리셋 전 백업
        await backupUserData(user.userId);
        
        const updates = {};
        
        // 주간 출석 리셋
        updates['weeklyAttendance'] = [false, false, false, false, false, false, false];
        updates['weekStart'] = getWeekStart();
        
        // 퀘스트 주간 리셋
        if (user.quests) {
            updates['quests.weekly'] = {};
            updates['quests.lastWeeklyReset'] = new Date();
        }
        
        // 피트니스 주간 목표 리셋
        if (user.fitness && user.fitness.goals && user.fitness.goals.weekly) {
            updates['fitness.goals.weekly.totalMinutes'] = 0;
            updates['fitness.goals.weekly.specificExercises'] = {
                running: 0,
                walking: 0,
                strength: 0,
                yoga: 0
            };
            updates['fitness.goals.weekly.lastReset'] = new Date();
        }
        
        // 안전한 업데이트 수행
        await User.updateOne({ userId: user.userId }, { $set: updates });
        
        console.log(`✅ 주간 리셋 완료 - 유저: ${user.nickname}`);
        return { success: true, updates };
        
    } catch (error) {
        console.error(`❌ 주간 리셋 실패 - 유저: ${user.userId}`, error);
        return { success: false, error: error.message };
    }
}

// 리셋 필요 여부 확인
function needsDailyReset(user) {
    if (!user.dailyMissions || !user.dailyMissions.lastReset) return true;
    
    const lastReset = new Date(user.dailyMissions.lastReset);
    const today = new Date();
    
    // 날짜가 다르면 리셋 필요
    return lastReset.toDateString() !== today.toDateString();
}

function needsWeeklyReset(user) {
    if (!user.weekStart) return true;
    
    const currentWeekStart = getWeekStart();
    const userWeekStart = new Date(user.weekStart);
    
    return currentWeekStart.getTime() !== userWeekStart.getTime();
}

// 주의 시작일 계산 (일요일)
function getWeekStart() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek;
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
}

// 자동 리셋 체크 (유저 상호작용 시 호출)
async function checkAndProcessResets(userId) {
    try {
        const user = await User.findOne({ userId });
        if (!user) return null;
        
        const results = {
            daily: null,
            weekly: null
        };
        
        // 일일 리셋 체크
        if (needsDailyReset(user)) {
            results.daily = await processDailyReset(user);
        }
        
        // 주간 리셋 체크
        if (needsWeeklyReset(user)) {
            results.weekly = await processWeeklyReset(user);
        }
        
        return results;
        
    } catch (error) {
        console.error(`❌ 리셋 체크 실패 - 유저: ${userId}`, error);
        return null;
    }
}

// 강제 리셋 (관리자용)
async function forceReset(userId, resetType) {
    try {
        const user = await User.findOne({ userId });
        if (!user) throw new Error('유저를 찾을 수 없습니다');
        
        if (resetType === 'daily') {
            return await processDailyReset(user);
        } else if (resetType === 'weekly') {
            return await processWeeklyReset(user);
        } else {
            throw new Error('잘못된 리셋 타입입니다');
        }
        
    } catch (error) {
        console.error(`❌ 강제 리셋 실패 - 유저: ${userId}, 타입: ${resetType}`, error);
        return { success: false, error: error.message };
    }
}

// 전체 유저 리셋 상태 확인 (관리자용)
async function checkAllUsersResetStatus() {
    try {
        const users = await User.find({});
        const status = {
            needDailyReset: 0,
            needWeeklyReset: 0,
            total: users.length
        };
        
        for (const user of users) {
            if (needsDailyReset(user)) status.needDailyReset++;
            if (needsWeeklyReset(user)) status.needWeeklyReset++;
        }
        
        return status;
        
    } catch (error) {
        console.error('❌ 전체 유저 리셋 상태 확인 실패:', error);
        return null;
    }
}

module.exports = {
    processDailyReset,
    processWeeklyReset,
    needsDailyReset,
    needsWeeklyReset,
    checkAndProcessResets,
    forceReset,
    checkAllUsersResetStatus
};