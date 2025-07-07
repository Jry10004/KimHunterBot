const User = require('../models/User');
const { formatNumber } = require('../handlers/common/utils');

// 휴식 보상 시스템 설정
const REST_BONUS_CONFIG = {
    minOfflineHours: 48,      // 최소 48시간 이상 미접속 시 활성화
    expMultiplier: 3.0,       // 경험치 3배
    goldMultiplier: 2.0,      // 골드 2배
    duration: 60,             // 60분간 지속
    maxStackDays: 7           // 최대 7일치 누적
};

class RestBonusSystem {
    constructor() {
        this.activeBonuses = new Map();
    }

    // 휴식 보상 체크 및 적용
    async checkAndApplyRestBonus(userId) {
        const user = await User.findOne({ discordId: userId });
        if (!user) return null;

        const now = Date.now();
        const lastActivity = user.lastActivity || now;
        const offlineHours = (now - lastActivity) / (1000 * 60 * 60);

        // 48시간 미만 오프라인이면 보상 없음
        if (offlineHours < REST_BONUS_CONFIG.minOfflineHours) {
            return null;
        }

        // 휴식 보상 계산
        const bonusDays = Math.min(
            Math.floor(offlineHours / 24),
            REST_BONUS_CONFIG.maxStackDays
        );

        const bonusDuration = REST_BONUS_CONFIG.duration * bonusDays;
        const endTime = now + (bonusDuration * 60 * 1000);

        // 휴식 보상 정보 저장
        this.activeBonuses.set(userId, {
            multiplier: REST_BONUS_CONFIG.expMultiplier,
            goldMultiplier: REST_BONUS_CONFIG.goldMultiplier,
            endTime: endTime,
            stackedDays: bonusDays
        });

        // 유저 정보 업데이트
        user.lastActivity = now;
        user.restBonusActive = true;
        user.restBonusEndTime = endTime;
        await user.save();

        return {
            active: true,
            offlineHours: Math.floor(offlineHours),
            stackedDays: bonusDays,
            duration: bonusDuration,
            expMultiplier: REST_BONUS_CONFIG.expMultiplier,
            goldMultiplier: REST_BONUS_CONFIG.goldMultiplier
        };
    }

    // 휴식 보상이 활성화되어 있는지 확인
    isRestBonusActive(userId) {
        const bonus = this.activeBonuses.get(userId);
        if (!bonus) return false;

        const now = Date.now();
        if (now > bonus.endTime) {
            this.activeBonuses.delete(userId);
            return false;
        }

        return true;
    }

    // 휴식 보상 배수 가져오기
    getRestBonusMultiplier(userId, type = 'exp') {
        if (!this.isRestBonusActive(userId)) return 1.0;

        const bonus = this.activeBonuses.get(userId);
        return type === 'gold' ? bonus.goldMultiplier : bonus.multiplier;
    }

    // 남은 휴식 보상 시간 가져오기
    getRemainingTime(userId) {
        const bonus = this.activeBonuses.get(userId);
        if (!bonus) return 0;

        const now = Date.now();
        const remaining = Math.max(0, bonus.endTime - now);
        return Math.floor(remaining / (1000 * 60)); // 분 단위로 반환
    }

    // 휴식 보상 정보 포맷팅
    formatRestBonusInfo(userId) {
        if (!this.isRestBonusActive(userId)) {
            return '휴식 보상: 비활성';
        }

        const bonus = this.activeBonuses.get(userId);
        const remainingMinutes = this.getRemainingTime(userId);
        
        return `🌟 **휴식 보상 활성**\n` +
               `• 경험치: ${bonus.multiplier}배\n` +
               `• 골드: ${bonus.goldMultiplier}배\n` +
               `• 남은 시간: ${remainingMinutes}분\n` +
               `• 누적 일수: ${bonus.stackedDays}일`;
    }

    // 경험치 적용 (휴식 보상 포함)
    applyExpWithRestBonus(baseExp, userId) {
        const multiplier = this.getRestBonusMultiplier(userId, 'exp');
        return Math.floor(baseExp * multiplier);
    }

    // 골드 적용 (휴식 보상 포함)
    applyGoldWithRestBonus(baseGold, userId) {
        const multiplier = this.getRestBonusMultiplier(userId, 'gold');
        return Math.floor(baseGold * multiplier);
    }

    // 유저 활동 업데이트
    async updateUserActivity(userId) {
        const user = await User.findOne({ discordId: userId });
        if (!user) return;

        user.lastActivity = Date.now();
        
        // 휴식 보상이 만료되었으면 플래그 제거
        if (!this.isRestBonusActive(userId)) {
            user.restBonusActive = false;
            user.restBonusEndTime = null;
        }
        
        await user.save();
    }

    // 주기적으로 만료된 보너스 정리
    cleanupExpiredBonuses() {
        const now = Date.now();
        for (const [userId, bonus] of this.activeBonuses.entries()) {
            if (now > bonus.endTime) {
                this.activeBonuses.delete(userId);
            }
        }
    }
}

// 싱글톤 인스턴스
const restBonusSystem = new RestBonusSystem();

// 5분마다 만료된 보너스 정리
setInterval(() => {
    restBonusSystem.cleanupExpiredBonuses();
}, 5 * 60 * 1000);

module.exports = {
    restBonusSystem,
    REST_BONUS_CONFIG
};