// 🛡️ 데이터 보호 시스템
const fs = require('fs');
const path = require('path');
// User 모델은 나중에 동적으로 로드 (순환 참조 방지)

// 보호된 필드 목록 - 절대 초기화되면 안 되는 필드들
const PROTECTED_FIELDS = {
    // 기본 정보
    core: ['userId', 'nickname', 'level', 'exp', 'gold', 'popularity'],
    
    // 스탯 & 스킬
    stats: ['statPoints', 'stats.strength', 'stats.agility', 'stats.intelligence', 'stats.defense', 'stats.luck', 'skills'],
    
    // 장비 & 인벤토리
    equipment: ['equipment', 'inventory', 'enhancementStone', 'artifacts', 'enhancementLevel', 'enhanceStats'],
    
    // 자원 & 재료
    resources: ['energyFragments', 'dailyFragmentAmount', 'lastMiningTime', 'fragmentTotalMined'],
    
    // 주식 시스템
    stock: ['stockPortfolio', 'stockHistory'],
    
    // 사냥 & 전투
    combat: ['huntingTickets', 'pvpTickets', 'weeklyBossEntries', 'bossProgress', 'pvp'],
    
    // 게임 통계
    gameStats: [
        'racingStats', 'slotStats', 'dungeonStats', 'rpsStats', 
        'mushroomStats', 'blackjackStats', 'diceStats', 'oddEvenStats'
    ],
    
    // 업적 & 기록
    records: ['achievements', 'titles', 'currentTitle', 'multiplayerStats', 'completedQuests'],
    
    // 출석 & 보상
    attendance: ['attendanceStreak', 'totalAttendance', 'weeklyAttendance', 'monthlyAttendance'],
    
    // 이벤트 데이터
    events: ['prelaunchEnhancement', 'eventParticipation', 'dogBotCoinflip'],
    
    // 보안 데이터
    security: ['registrationIP', 'lastLoginIP', 'ipHistory', 'email', 'emailVerified', 'macroSuspicion'],
    
    // 피트니스 시스템
    fitness: ['fitness', 'fitnessLevel', 'fitnessExp'],
    
    // 엠블럼 & 메뉴
    customization: ['emblems', 'purchasedMenus', 'selectedMenuColor']
};

// 일일 리셋 허용 필드
const DAILY_RESET_ALLOWED = [
    'dailyAttendance',
    'lastDaily',
    'dailyPopularityGain',
    'dailyPopularityLoss',
    'dailyFusions',
    'dailyMissions',
    'fitnessData.dailyGoals'
];

// 주간 리셋 허용 필드
const WEEKLY_RESET_ALLOWED = [
    'weeklyAttendance',
    'weeklyQuests',
    'fitnessData.weeklyGoals'
];

// 데이터 백업
async function backupUserData(userId) {
    try {
        // 동적으로 User 모델 로드 (순환 참조 방지)
        const User = require('../models/User');
        const user = await User.findOne({ discordId: userId });
        if (!user) return null;
        
        const backupDir = path.join(__dirname, '..', 'backups', 'users');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `user_${userId}_${timestamp}.json`);
        
        fs.writeFileSync(backupPath, JSON.stringify(user.toObject(), null, 2));
        console.log(`✅ 유저 ${userId} 데이터 백업 완료: ${backupPath}`);
        
        return backupPath;
    } catch (error) {
        console.error(`❌ 유저 ${userId} 백업 실패:`, error);
        return null;
    }
}

// 데이터 복원
async function restoreUserData(userId, backupPath) {
    try {
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const User = require('../models/User');
        
        // 보호된 필드만 복원
        const updateData = {};
        for (const category of Object.values(PROTECTED_FIELDS)) {
            for (const field of category) {
                const keys = field.split('.');
                let value = backupData;
                for (const key of keys) {
                    value = value?.[key];
                }
                if (value !== undefined) {
                    updateData[field] = value;
                }
            }
        }
        
        await User.updateOne({ discordId: userId }, { $set: updateData });
        console.log(`✅ 유저 ${userId} 데이터 복원 완료`);
        return true;
    } catch (error) {
        console.error(`❌ 유저 ${userId} 복원 실패:`, error);
        return false;
    }
}

// 데이터 무결성 검사
async function validateUserData(userId) {
    try {
        const User = require('../models/User');
        const user = await User.findOne({ discordId: userId });
        if (!user) return { valid: false, reason: '유저를 찾을 수 없음' };
        
        const issues = [];
        
        // 레벨과 경험치 검증
        if (user.level < 1 || user.level > 999) {
            issues.push('비정상적인 레벨');
        }
        
        // 골드 검증
        if (user.gold < 0) {
            issues.push('음수 골드');
        }
        
        // 스탯 검증
        const stats = ['strength', 'agility', 'intelligence', 'defense', 'luck'];
        for (const stat of stats) {
            if (user.stats[stat] < 1) {
                issues.push(`비정상적인 ${stat} 스탯`);
            }
        }
        
        // 장비 슬롯 검증
        const equipSlots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];
        for (const slot of equipSlots) {
            const value = user.equipment[slot];
            if (value !== -1 && (!Number.isInteger(value) || value < 0 || value >= user.inventory.length)) {
                issues.push(`비정상적인 ${slot} 장비 슬롯`);
            }
        }
        
        return {
            valid: issues.length === 0,
            issues: issues
        };
    } catch (error) {
        console.error(`❌ 유저 ${userId} 검증 실패:`, error);
        return { valid: false, reason: error.message };
    }
}

// 자동 백업 스케줄러
function scheduleAutoBackup() {
    // 매일 새벽 3시에 전체 유저 백업
    const now = new Date();
    const tomorrow3am = new Date(now);
    tomorrow3am.setDate(tomorrow3am.getDate() + 1);
    tomorrow3am.setHours(3, 0, 0, 0);
    
    const msUntil3am = tomorrow3am - now;
    
    setTimeout(() => {
        backupAllUsers();
        // 이후 24시간마다 반복
        setInterval(backupAllUsers, 24 * 60 * 60 * 1000);
    }, msUntil3am);
    
    console.log(`📅 자동 백업 스케줄 설정 완료 (다음 백업: ${tomorrow3am.toLocaleString()})`);
}

// 전체 유저 백업
async function backupAllUsers() {
    try {
        console.log('🔄 전체 유저 백업 시작...');
        const User = require('../models/User');
        const users = await User.find({});
        let successCount = 0;
        
        for (const user of users) {
            const result = await backupUserData(user.discordId);
            if (result) successCount++;
        }
        
        console.log(`✅ 전체 유저 백업 완료: ${successCount}/${users.length}명 성공`);
    } catch (error) {
        console.error('❌ 전체 유저 백업 실패:', error);
    }
}

// 안전한 업데이트 함수
async function safeUpdateUser(userId, updateData) {
    try {
        // 백업 먼저 수행
        await backupUserData(userId);
        
        // 보호된 필드 체크
        const protectedUpdates = {};
        const allowedUpdates = {};
        
        for (const [key, value] of Object.entries(updateData)) {
            let isProtected = false;
            
            // 보호된 필드인지 확인
            for (const category of Object.values(PROTECTED_FIELDS)) {
                if (category.includes(key)) {
                    isProtected = true;
                    protectedUpdates[key] = value;
                    break;
                }
            }
            
            // 일일/주간 리셋 허용 필드
            if (DAILY_RESET_ALLOWED.includes(key) || WEEKLY_RESET_ALLOWED.includes(key)) {
                allowedUpdates[key] = value;
            } else if (!isProtected) {
                allowedUpdates[key] = value;
            }
        }
        
        // 보호된 필드 업데이트는 특별 로깅
        if (Object.keys(protectedUpdates).length > 0) {
            console.log(`⚠️ 보호된 필드 업데이트 감지 - 유저: ${userId}`, protectedUpdates);
        }
        
        // 업데이트 수행
        const result = await User.updateOne(
            { userId },
            { $set: { ...allowedUpdates, ...protectedUpdates } }
        );
        
        return result;
    } catch (error) {
        console.error(`❌ 안전한 업데이트 실패 - 유저: ${userId}`, error);
        throw error;
    }
}

module.exports = {
    PROTECTED_FIELDS,
    DAILY_RESET_ALLOWED,
    WEEKLY_RESET_ALLOWED,
    backupUserData,
    restoreUserData,
    validateUserData,
    scheduleAutoBackup,
    backupAllUsers,
    safeUpdateUser
};