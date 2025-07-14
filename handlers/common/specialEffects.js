// 특수 아이템 효과 처리 유틸리티

// 유저의 특수 효과 계산
function calculateSpecialEffects(user) {
    const effects = {
        pvpBonus: 0,
        bossRaidDamage: 0,
        dungeonReward: 0,
        enhanceBonus: 0,
        huntingDamage: 0,
        expBonus: 0,
        minigameBonus: 0,
        dailyBonus: 0,
        goldBonus: 0,
        jackpotChance: 0,
        dropRateBonus: 0  // 드롭률 보너스 추가
    };
    
    console.log(`[calculateSpecialEffects] 시작 - ${user.nickname || user.discordId}, 칭호: ${user.equippedTitle || '없음'}`);
    console.log(`[calculateSpecialEffects] user.equippedTitle 타입: ${typeof user.equippedTitle}, 값: "${user.equippedTitle}"`);
    console.log(`[calculateSpecialEffects] user.equippedTitle === '버그 사냥꾼': ${user.equippedTitle === '버그 사냥꾼'}`);

    // 인벤토리의 모든 장착된 아이템 확인
    if (user.inventory && Array.isArray(user.inventory)) {
        user.inventory.forEach(item => {
            // 장착된 아이템만 확인
            if (item.equipped && item.specialEffect && item.specialEffect.stats) {
                const specialStats = item.specialEffect.stats;
                
                // 각 효과 누적
                Object.keys(specialStats).forEach(stat => {
                    if (effects.hasOwnProperty(stat)) {
                        effects[stat] += specialStats[stat];
                    }
                });
            }
        });
    }
    
    // 목걸이 효과 추가
    if (user.equippedNecklace && user.equippedNecklace.stats) {
        if (user.equippedNecklace.stats.goldBonus) {
            effects.goldBonus += user.equippedNecklace.stats.goldBonus;
        }
        if (user.equippedNecklace.stats.expBonus) {
            effects.expBonus += user.equippedNecklace.stats.expBonus;
        }
    }
    
    // 장신구(accessory) 효과 추가
    if (user.equippedAccessories) {
        Object.values(user.equippedAccessories).forEach(accessory => {
            if (accessory && accessory.stats) {
                const stats = accessory.stats instanceof Map ? Object.fromEntries(accessory.stats) : accessory.stats;
                // 각 효과 누적
                Object.keys(stats).forEach(stat => {
                    if (effects.hasOwnProperty(stat)) {
                        effects[stat] += stats[stat];
                    }
                });
            }
        });
    }
    
    // 칭호 효과 추가
    if (user.equippedTitle) {
        console.log(`[calculateSpecialEffects] 칭호 확인 중...`);
        
        // 버그 사냥꾼 칭호 효과: 골드 +10%
        if (user.equippedTitle === '버그 사냥꾼') {
            console.log(`[calculateSpecialEffects] 버그 사냥꾼 칭호 발견! 효과 적용 중...`);
            effects.goldBonus += 10;     // 골드 획득 +10%
            console.log(`[calculateSpecialEffects] 버그 사냥꾼 효과 적용 완료 - goldBonus: ${effects.goldBonus}%`);
        } else {
            console.log(`[calculateSpecialEffects] 다른 칭호: "${user.equippedTitle}"`);
        }
    } else {
        console.log(`[calculateSpecialEffects] 칭호 없음`);
    }

    console.log(`[calculateSpecialEffects] 최종 효과 - goldBonus: ${effects.goldBonus}%, expBonus: ${effects.expBonus}%, dropRateBonus: ${effects.dropRateBonus}%`);
    return effects;
}

// PVP 데미지 계산 시 특수 효과 적용
function applyPVPBonus(baseDamage, user) {
    const effects = calculateSpecialEffects(user);
    const pvpBonus = effects.pvpBonus || 0;
    
    // PVP 보너스 적용 (10% = 1.1배)
    const multiplier = 1 + (pvpBonus / 100);
    return Math.floor(baseDamage * multiplier);
}

// 보스 레이드 데미지 계산 시 특수 효과 적용
function applyBossRaidBonus(baseDamage, user) {
    const effects = calculateSpecialEffects(user);
    const bossBonus = effects.bossRaidDamage || 0;
    
    // 보스 공격력 보너스 적용 (30% = 1.3배)
    const multiplier = 1 + (bossBonus / 100);
    return Math.floor(baseDamage * multiplier);
}

// 던전 보상 계산 시 특수 효과 적용
function applyDungeonRewardBonus(baseReward, user) {
    const effects = calculateSpecialEffects(user);
    const dungeonBonus = effects.dungeonReward || 0;
    
    // 던전 보상 보너스 적용 (50% = 1.5배)
    const multiplier = 1 + (dungeonBonus / 100);
    return Math.floor(baseReward * multiplier);
}

// 강화 성공률 계산 시 특수 효과 적용
function applyEnhanceBonus(baseRate, user) {
    const effects = calculateSpecialEffects(user);
    const enhanceBonus = effects.enhanceBonus || 0;
    
    // 강화 성공률 보너스 적용 (+10%)
    return Math.min(100, baseRate + enhanceBonus);
}

// 사냥 데미지 계산 시 특수 효과 적용
function applyHuntingDamageBonus(baseDamage, user) {
    const effects = calculateSpecialEffects(user);
    const huntingBonus = effects.huntingDamage || 0;
    
    // 사냥 데미지 보너스 적용 (30% = 1.3배)
    const multiplier = 1 + (huntingBonus / 100);
    return Math.floor(baseDamage * multiplier);
}

// 경험치 획득 시 특수 효과 적용
function applyExpBonus(baseExp, user) {
    const effects = calculateSpecialEffects(user);
    const expBonus = effects.expBonus || 0;
    
    console.log(`[ExpBonus] ${user.nickname || user.discordId} - 경험치 보너스: ${expBonus}%, 기본 경험치: ${baseExp}, 칭호: ${user.equippedTitle || '없음'}`);
    
    // 경험치 보너스 적용 (10% = 1.1배)
    const multiplier = 1 + (expBonus / 100);
    const finalExp = Math.floor(baseExp * multiplier);
    
    console.log(`[ExpBonus] 최종 경험치: ${finalExp} (${multiplier}배)`);
    return finalExp;
}

// 미니게임 보상 계산 시 특수 효과 적용
function applyMinigameBonus(baseReward, user) {
    const effects = calculateSpecialEffects(user);
    const minigameBonus = effects.minigameBonus || 0;
    const goldBonus = effects.goldBonus || 0;
    
    console.log(`[MinigameBonus] ${user.nickname || user.discordId} - 칭호: ${user.equippedTitle || '없음'}, 미니게임 보너스: ${minigameBonus}%, 골드 보너스: ${goldBonus}%, 기본 보상: ${baseReward}`);
    
    // 미니게임 보너스와 골드 보너스 모두 적용 (중첩)
    const minigameMultiplier = 1 + (minigameBonus / 100);
    const goldMultiplier = 1 + (goldBonus / 100);
    const totalMultiplier = minigameMultiplier * goldMultiplier;
    
    const finalReward = Math.floor(baseReward * totalMultiplier);
    console.log(`[MinigameBonus] 최종 보상: ${finalReward} (${totalMultiplier.toFixed(2)}배)`);
    
    return finalReward;
}

// 일일 보상 계산 시 특수 효과 적용
function applyDailyBonus(baseReward, user) {
    const effects = calculateSpecialEffects(user);
    const dailyBonus = effects.dailyBonus || 0;
    
    // 일일 보상 보너스 적용 (100% = 2배)
    const multiplier = 1 + (dailyBonus / 100);
    return Math.floor(baseReward * multiplier);
}

// 골드 획득 시 특수 효과 적용
function applyGoldBonus(baseGold, user) {
    const effects = calculateSpecialEffects(user);
    const goldBonus = effects.goldBonus || 0;
    
    console.log(`[GoldBonus] ${user.nickname || user.discordId} - 칭호: ${user.equippedTitle || '없음'}, 골드 보너스: ${goldBonus}%, 기본 골드: ${baseGold}`);
    
    // 골드 보너스 적용 (50% = 1.5배, -90% = 0.1배)
    const multiplier = 1 + (goldBonus / 100);
    const finalGold = Math.floor(baseGold * multiplier);
    
    console.log(`[GoldBonus] 최종 골드: ${finalGold} (${multiplier}배)`);
    return finalGold;
}

// 잭팟 확률 계산 시 특수 효과 적용
function applyJackpotBonus(baseChance, user) {
    const effects = calculateSpecialEffects(user);
    const jackpotBonus = effects.jackpotChance || 0;
    
    // 잭팟 확률 보너스 적용 (+10%)
    return baseChance + jackpotBonus;
}

// 드롭률 계산 시 특수 효과 적용
function applyDropRateBonus(baseDropRate, user) {
    const effects = calculateSpecialEffects(user);
    const dropRateBonus = effects.dropRateBonus || 0;
    
    console.log(`[DropRateBonus] ${user.nickname || user.discordId} - 칭호: ${user.equippedTitle || '없음'}, 드롭률 보너스: ${dropRateBonus}%, 기본 드롭률: ${baseDropRate}`);
    
    // 드롭률 보너스 적용 (10% = 0.1 추가)
    const finalDropRate = baseDropRate + (dropRateBonus / 100);
    
    console.log(`[DropRateBonus] 최종 드롭률: ${finalDropRate} (${Math.floor(finalDropRate * 100)}%)`);
    return finalDropRate;
}

// 유저의 모든 특수 효과 요약
function getUserSpecialEffects(user) {
    const effects = calculateSpecialEffects(user);
    const activeEffects = [];
    
    // 칭호 효과 추가
    if (user.equippedTitle) {
        activeEffects.push(`칭호: ${user.equippedTitle}`);
    }
    
    // 활성화된 효과만 표시
    if (effects.pvpBonus > 0) activeEffects.push(`PVP 데미지 +${effects.pvpBonus}%`);
    if (effects.bossRaidDamage > 0) activeEffects.push(`보스 공격력 +${effects.bossRaidDamage}%`);
    if (effects.dungeonReward > 0) activeEffects.push(`던전 보상 +${effects.dungeonReward}%`);
    if (effects.enhanceBonus > 0) activeEffects.push(`강화 성공률 +${effects.enhanceBonus}%`);
    if (effects.huntingDamage > 0) activeEffects.push(`사냥 데미지 +${effects.huntingDamage}%`);
    if (effects.expBonus > 0) activeEffects.push(`경험치 획득 +${effects.expBonus}%`);
    if (effects.minigameBonus > 0) activeEffects.push(`미니게임 보상 +${effects.minigameBonus}%`);
    if (effects.dailyBonus > 0) activeEffects.push(`일일 보상 +${effects.dailyBonus}%`);
    if (effects.goldBonus > 0) activeEffects.push(`골드 획득 +${effects.goldBonus}%`);
    if (effects.goldBonus < 0) activeEffects.push(`골드 획득 ${effects.goldBonus}%`);
    if (effects.jackpotChance > 0) activeEffects.push(`잭팟 확률 +${effects.jackpotChance}%`);
    if (effects.dropRateBonus > 0) activeEffects.push(`드롭률 +${effects.dropRateBonus}%`);
    
    return activeEffects;
}

module.exports = {
    calculateSpecialEffects,
    applyPVPBonus,
    applyBossRaidBonus,
    applyDungeonRewardBonus,
    applyEnhanceBonus,
    applyHuntingDamageBonus,
    applyExpBonus,
    applyMinigameBonus,
    applyDailyBonus,
    applyGoldBonus,
    applyJackpotBonus,
    applyDropRateBonus,
    getUserSpecialEffects
};