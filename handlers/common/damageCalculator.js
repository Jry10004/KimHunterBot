// 통합 데미지 계산 시스템
const { calculateCombatPower } = require('./combatPower');

// 크리티컬 확률 계산 (통일)
function calculateCriticalChance(luck, additionalCrit = 0) {
    const baseCrit = 0.05; // 기본 5%
    const luckBonus = luck * 0.001; // 행운당 0.1%
    return Math.min(0.5, baseCrit + luckBonus + additionalCrit); // 최대 50%
}

// 회피 확률 계산 (통일)
function calculateDodgeChance(agility, additionalDodge = 0) {
    const baseDodge = 0.02; // 기본 2%
    const agilityBonus = agility * 0.002; // 민첩당 0.2%
    return Math.min(0.3, baseDodge + agilityBonus + additionalDodge); // 최대 30%
}

// 방어력에 의한 데미지 감소율 계산
function calculateDamageReduction(defense, penetration = 0) {
    const effectiveDefense = Math.max(0, defense - penetration);
    // 방어력 100당 약 5% 감소, 최대 50% 감소 (기존 70% → 50%로 완화)
    // 방어력 공식 변경: 더 완만한 곡선으로 조정
    return Math.min(0.5, effectiveDefense / (effectiveDefense + 1000));
}

// 통합 데미지 계산
function calculateDamage(attacker, defender, options = {}) {
    const {
        skillMultiplier = 1.0,      // 스킬 배율
        damageType = 'physical',    // physical, magical, true
        ignoreDefense = false,      // 방어 무시
        penetration = 0,            // 방어 관통
        additionalCrit = 0,         // 추가 크리티컬 확률
        additionalDamage = 0        // 추가 고정 데미지
    } = options;

    // 1. 기본 공격력 계산
    let baseDamage = attacker.attack || 10;
    
    // 2. 스탯 보너스
    if (damageType === 'physical') {
        baseDamage += (attacker.stats?.strength || 10) * 2;
    } else if (damageType === 'magical') {
        baseDamage += (attacker.stats?.intelligence || 10) * 2;
    }
    
    // 3. 레벨 보너스
    baseDamage += (attacker.level || 1) * 5;
    
    // 4. 스킬 배율 적용
    baseDamage *= skillMultiplier;
    
    // 5. 크리티컬 판정
    const critChance = calculateCriticalChance(attacker.stats?.luck || 10, additionalCrit);
    const isCritical = Math.random() < critChance;
    if (isCritical) {
        baseDamage *= 2.5; // 크리티컬 데미지 250%
    }
    
    // 6. 방어력 적용
    let finalDamage = baseDamage;
    if (!ignoreDefense && damageType !== 'true') {
        const reduction = calculateDamageReduction(defender.defense || 10, penetration);
        finalDamage = baseDamage * (1 - reduction);
    }
    
    // 7. 추가 데미지
    finalDamage += additionalDamage;
    
    // 8. 랜덤 변동 (±10%)
    const variance = 0.9 + Math.random() * 0.2;
    finalDamage *= variance;
    
    // 9. 최소 데미지 보장
    finalDamage = Math.max(1, Math.floor(finalDamage));
    
    return {
        damage: finalDamage,
        isCritical,
        damageType
    };
}

// PVP 특화 데미지 계산
function calculatePvPDamage(attacker, defender, skill) {
    const skillMultipliers = {
        high: 1.2,      // 별똥베기
        middle: 1.0,    // 슈가스팅
        low: 0.8        // 버섯팡
    };
    
    const hitRates = {
        high: 0.85,
        middle: 0.95,
        low: 1.0
    };
    
    // 회피 판정
    const dodgeChance = calculateDodgeChance(defender.stats?.agility || 10);
    const hitChance = hitRates[skill] * (1 - dodgeChance);
    
    if (Math.random() > hitChance) {
        return {
            damage: 0,
            isCritical: false,
            isDodged: true,
            damageType: 'physical'
        };
    }
    
    // PVP 데미지 보너스 계산
    let pvpBonus = 0;
    if (attacker.equippedAccessories) {
        Object.values(attacker.equippedAccessories).forEach(acc => {
            if (acc && acc.stats) {
                const stats = acc.stats instanceof Map ? Object.fromEntries(acc.stats) : acc.stats;
                pvpBonus += (stats.pvpDamage || 0) / 100;
            }
        });
    }
    
    return calculateDamage(attacker, defender, {
        skillMultiplier: skillMultipliers[skill] * (1 + pvpBonus),
        damageType: 'physical',
        additionalCrit: skill === 'high' ? 0.1 : 0 // 별똥베기는 크리티컬 확률 +10%
    });
}

// 사냥 데미지 계산
function calculateHuntingDamage(user, monster) {
    // 사냥 보너스 계산
    let huntingBonus = 0;
    if (user.equippedAccessories) {
        Object.values(user.equippedAccessories).forEach(acc => {
            if (acc && acc.stats) {
                const stats = acc.stats instanceof Map ? Object.fromEntries(acc.stats) : acc.stats;
                huntingBonus += (stats.huntingDamage || 0) / 100;
            }
        });
    }
    
    return calculateDamage(user, monster, {
        skillMultiplier: 1 + huntingBonus,
        damageType: 'physical'
    });
}

// 보스 레이드 데미지 계산
function calculateBossRaidDamage(user, boss, isSkill = false) {
    // 보스 데미지 보너스 계산
    let bossBonus = 0;
    if (user.equippedAccessories) {
        Object.values(user.equippedAccessories).forEach(acc => {
            if (acc && acc.stats) {
                const stats = acc.stats instanceof Map ? Object.fromEntries(acc.stats) : acc.stats;
                bossBonus += (stats.bossDamage || 0) / 100;
            }
        });
    }
    
    // 전투력 기반 보너스 계산 (고스펙 유저 우대)
    const combatPower = calculateCombatPower(user);
    const powerBonus = Math.sqrt(combatPower / 1000) * 0.1; // 전투력 1000당 10% 보너스 (제곱근 적용)
    
    // 보스 레이드는 방어 관통 30% 적용 (고스펙 유저 우대)
    return calculateDamage(user, boss, {
        skillMultiplier: (isSkill ? 1.5 : 1.0) * (1 + bossBonus + powerBonus),
        damageType: 'physical',
        penetration: boss.defense * 0.3 // 보스 방어력의 30% 관통
    });
}

module.exports = {
    calculateDamage,
    calculatePvPDamage,
    calculateHuntingDamage,
    calculateBossRaidDamage,
    calculateCriticalChance,
    calculateDodgeChance,
    calculateDamageReduction
};