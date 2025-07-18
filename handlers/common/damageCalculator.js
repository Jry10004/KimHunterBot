// 통합 데미지 계산 시스템
const { calculateCombatPower, getTotalStats } = require('./combatPower');

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
    
    // 2. 장비를 포함한 전체 스탯 계산 (getTotalStats 사용)
    const totalStats = attacker._id ? getTotalStats(attacker) : {
        strength: (attacker.stats?.strength || 10) + (attacker.equipmentStats?.strength || 0),
        agility: (attacker.stats?.agility || 10) + (attacker.equipmentStats?.agility || 0),
        intelligence: (attacker.stats?.intelligence || 10) + (attacker.equipmentStats?.intelligence || 0),
        vitality: (attacker.stats?.vitality || 10) + (attacker.equipmentStats?.vitality || 0),
        luck: (attacker.stats?.luck || 10) + (attacker.equipmentStats?.luck || 0),
        attack: attacker.attack || 0,
        defense: attacker.defense || 0,
        hp: attacker.health || 0,
        dodge: 0
    };
    
    // 장비로부터 온 공격력 추가
    if (totalStats.attack > 0) {
        baseDamage = totalStats.attack;
    }
    
    // 3. 엠블럼 확인 (문자열로 저장되어 있음)
    const emblemType = attacker.emblem ? attacker.emblem.toLowerCase() : 'none';
    
    // 4. 스탯 보너스 (직업별 주스탯 반영)
    if (emblemType.includes('전사') || emblemType.includes('warrior')) {
        // 전사: 힘 기반
        baseDamage += totalStats.strength * 2;
    } else if (emblemType.includes('궁수') || emblemType.includes('archer')) {
        // 궁수: 민첩 기반 (2.2 -> 2.5 상향)
        baseDamage += totalStats.agility * 2.5;
        // 궁수는 행운도 약간 반영 (행운 보너스 추가)
        baseDamage += totalStats.luck * 0.5;
    } else if (emblemType.includes('마법사') || emblemType.includes('wizard') || emblemType.includes('mage')) {
        // 마법사: 지능 기반
        baseDamage += totalStats.intelligence * 2;
    } else if (emblemType.includes('도적') || emblemType.includes('rogue') || emblemType.includes('thief') || emblemType.includes('행운아')) {
        // 도적: 민첩과 행운 혼합
        baseDamage += totalStats.agility * 1.5;
        baseDamage += totalStats.luck * 1;
    } else if (emblemType.includes('수호자') || emblemType.includes('defender') || emblemType.includes('guardian')) {
        // 수호자: 체력 기반 (탱커)
        baseDamage += totalStats.vitality * 1.5;
        baseDamage += totalStats.strength * 0.5;
    } else {
        // 기본 (엠블럼 없음): 기존 방식 유지
        if (damageType === 'physical') {
            baseDamage += totalStats.strength * 2;
        } else if (damageType === 'magical') {
            baseDamage += totalStats.intelligence * 2;
        }
    }
    
    // 3. 레벨 보너스
    baseDamage += (attacker.level || 1) * 5;
    
    // 6. 스탯 시너지 시스템 (totalStats 사용)
    let synergyBonus = 1.0;
    
    // 전사 시너지: 힘+체력
    if (totalStats.strength >= 50 && totalStats.vitality >= 50) {
        const synergyLevel = Math.min(totalStats.strength, totalStats.vitality) / 50;
        synergyBonus += 0.1 * Math.floor(synergyLevel); // 50마다 10% 추가 데미지
    }
    
    // 궁수 시너지: 민첩+행운 (조건 완화 및 보너스 증가)
    if (emblemType.includes('궁수') || emblemType.includes('archer')) {
        if (totalStats.agility >= 30 && totalStats.luck >= 30) {
            const synergyLevel = Math.min(totalStats.agility, totalStats.luck) / 30;
            synergyBonus += 0.12 * Math.floor(synergyLevel); // 30마다 12% 추가 데미지 (상향)
        }
    }
    
    // 마법사 시너지: 지능+민첩
    if (totalStats.intelligence >= 50 && totalStats.agility >= 30) {
        const synergyLevel = Math.min(totalStats.intelligence / 50, totalStats.agility / 30);
        synergyBonus += 0.12 * Math.floor(synergyLevel); // 조건 충족시 12% 추가 데미지
    }
    
    // 도적 시너지: 민첩+행운 균형
    if (totalStats.agility && totalStats.luck) {
        const balance = Math.min(totalStats.agility, totalStats.luck) / Math.max(totalStats.agility, totalStats.luck);
        if (balance >= 0.8) { // 두 스탯이 20% 이내 차이일 때
            synergyBonus += 0.15; // 15% 추가 데미지
        }
    }
    
    // 수호자 시너지: 체력+힘
    if (totalStats.vitality >= 60 && totalStats.strength >= 30) {
        const synergyLevel = Math.min(totalStats.vitality / 60, totalStats.strength / 30);
        synergyBonus += 0.1 * Math.floor(synergyLevel); // 조건 충족시마다 10% 추가 데미지
    }
    
    baseDamage *= synergyBonus;
    
    // 4. 스킬 배율 적용
    baseDamage *= skillMultiplier;
    
    // 5. 직업별 고유 특성 적용
    let classBonus = 1.0;
    let armorPenetration = penetration;
    let critDamageMultiplier = 2.5; // 기본 크리티컬 데미지 250%
    let elementalDamage = 0;
    let extraAttackChance = 0;
    let doubleHitChance = 0;
    let baseCritBonus = 0;
    
    if (emblemType.includes('전사') || emblemType.includes('warrior')) {
        // 전사: HP 30% 이하일 때 공격력 20% 증가 (광전사)
        if (attacker.hp && attacker.maxHp && (attacker.hp / attacker.maxHp) <= 0.3) {
            classBonus *= 1.20;
        }
        // 방어 관통: 체력의 8%
        armorPenetration += totalStats.vitality * 0.08;
    } else if (emblemType.includes('궁수') || emblemType.includes('archer')) {
        // 궁수: 40% 확률로 2연타 공격 (35% -> 40%)
        doubleHitChance = 0.40;
        // 궁수: 크리티컬 확률 기본 +20% (18% -> 20%)
        baseCritBonus = 0.20;
        // 치명타 데미지 증가: 민첩의 2.5% (2% -> 2.5%)
        critDamageMultiplier += totalStats.agility * 0.025;
        
        // 보스전 특화: 약점 조준 - 보스나 고레벨 몬스터에게 30% 추가 데미지
        if (defender.level >= 100 || defender.hp >= 50000) {
            classBonus *= 1.3;
        }
        
        // 정밀 사격: 15% 확률로 방어 무시
        if (Math.random() < 0.15) {
            ignoreDefense = true;
        }
    } else if (emblemType.includes('마법사') || emblemType.includes('wizard') || emblemType.includes('mage')) {
        // 마법사: 원소 데미지 (지능의 25%를 추가 원소 데미지로)
        elementalDamage = totalStats.intelligence * 0.25;
        // 20% 확률로 적에게 60% 추가 데미지 (연쇄 번개)
        if (Math.random() < 0.20) {
            classBonus *= 1.6;
        }
    } else if (emblemType.includes('도적') || emblemType.includes('rogue') || emblemType.includes('thief') || emblemType.includes('행운아')) {
        // 도적: 추가 공격 확률 (기본 3% + 행운의 0.4%)
        extraAttackChance = 0.03 + totalStats.luck * 0.004;
    } else if (emblemType.includes('수호자') || emblemType.includes('defender') || emblemType.includes('guardian')) {
        // 수호자는 방어 특성이므로 공격 보너스 없음
        classBonus = 1.0;
    }
    
    // 6. 직업 보너스 적용
    baseDamage *= classBonus;
    
    // 7. 크리티컬 판정 (궁수 기본 크리티컬 보너스 포함)
    const critChance = calculateCriticalChance(totalStats.luck, additionalCrit + baseCritBonus);
    const isCritical = Math.random() < critChance;
    if (isCritical) {
        baseDamage *= critDamageMultiplier;
    }
    
    // 8. 방어력 적용 (전사의 방어 관통 포함)
    let finalDamage = baseDamage;
    if (!ignoreDefense && damageType !== 'true') {
        const reduction = calculateDamageReduction(defender.defense || 10, armorPenetration);
        finalDamage = baseDamage * (1 - reduction);
    }
    
    // 9. 원소 데미지 적용 (마법사 - 방어력 무시)
    if (elementalDamage > 0) {
        let elementalBonus = elementalDamage * skillMultiplier;
        // 크리티컬 시 원소 데미지 2배 (주문 증폭)
        if (isCritical && (emblemType.includes('마법사') || emblemType.includes('wizard') || emblemType.includes('mage'))) {
            elementalBonus *= 2;
        }
        finalDamage += elementalBonus;
    }
    
    // 10. 추가 데미지
    finalDamage += additionalDamage;
    
    // 11. 랜덤 변동 (±10%)
    const variance = 0.9 + Math.random() * 0.2;
    finalDamage *= variance;
    
    // 12. 최소 데미지 보장
    finalDamage = Math.max(1, Math.floor(finalDamage));
    
    // 13. 도적 추가 공격 판정
    const hasExtraAttack = Math.random() < extraAttackChance;
    let extraDamage = 0;
    if (hasExtraAttack) {
        // 추가 공격은 기본 데미지의 60% (그림자 공격)
        extraDamage = Math.floor(finalDamage * 0.6);
    }
    
    // 14. 궁수 2연타 판정
    const hasDoubleHit = Math.random() < doubleHitChance;
    let doubleHitDamage = 0;
    if (hasDoubleHit) {
        // 2연타는 동일한 데미지
        doubleHitDamage = finalDamage;
    }
    
    return {
        damage: finalDamage,
        isCritical,
        damageType,
        elementalDamage: Math.floor(elementalDamage * skillMultiplier),
        hasExtraAttack,
        extraDamage,
        hasDoubleHit,
        doubleHitDamage,
        totalDamage: finalDamage + extraDamage + doubleHitDamage,
        synergyBonus: (synergyBonus - 1) * 100 // 시너지 보너스 퍼센트
    };
}

// 전사 불굴의 의지 데미지 감소 처리
function applyWarriorDamageReduction(damage, defender) {
    if (!defender.emblem) return { damage, reduced: false, reductionAmount: 0 };
    
    const emblemType = defender.emblem.toLowerCase();
    if (emblemType.includes('전사') || emblemType.includes('warrior')) {
        // 10% 확률로 데미지 40% 감소 (불굴의 의지)
        if (Math.random() < 0.10) {
            const reducedDamage = Math.floor(damage * 0.6);
            return {
                damage: reducedDamage,
                reduced: true,
                reductionAmount: damage - reducedDamage
            };
        }
    }
    
    return { damage, reduced: false, reductionAmount: 0 };
}

// PVP 특화 데미지 계산
function calculatePvPDamage(attacker, defender, skill, match) {
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
    
    // 회피 버프 확인
    let additionalDodge = 0;
    if (match && defender.discordId) {
        const defenderKey = match.player1.user.discordId === defender.discordId ? 'player1Buffs' : 'player2Buffs';
        const buffs = match[defenderKey] || [];
        const dodgeBuff = buffs.find(b => b.type === 'dodgeBoost' && b.duration > 0);
        if (dodgeBuff) {
            additionalDodge = dodgeBuff.value;
        }
    }
    
    // 회피 판정
    const baseDodgeChance = calculateDodgeChance(defender.stats?.agility || 10);
    const totalDodgeChance = Math.min(baseDodgeChance + additionalDodge, 0.75); // 최대 75% 회피
    const hitChance = hitRates[skill] * (1 - totalDodgeChance);
    
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
    
    // 라운드 증폭 받기 (match 객체에서)
    const roundAmplifier = match && match.round ? 1 + (match.round * 0.1) : 1;
    
    return calculateDamage(attacker, defender, {
        skillMultiplier: skillMultipliers[skill] * (1 + pvpBonus) * roundAmplifier,
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

// 수호자 보호막 시스템
function calculateDefenderShield(defender) {
    if (!defender.emblem) return 0;
    
    const emblemType = defender.emblem.toLowerCase();
    if (emblemType.includes('수호자') || emblemType.includes('defender') || emblemType.includes('guardian')) {
        // 받는 피해의 15%를 흡수하는 보호막
        return 0.15;
    }
    
    return 0;
}

// 수호자 기본 방어 증가
function calculateDefenderDamageReduction(defender) {
    if (!defender.emblem) return 0;
    
    const emblemType = defender.emblem.toLowerCase();
    if (emblemType.includes('수호자') || emblemType.includes('defender') || emblemType.includes('guardian')) {
        // 받는 피해 8% 감소
        return 0.08;
    }
    
    return 0;
}

// 수호자 반격 시스템
function calculateDefenderCounterAttack(damage, defender) {
    if (!defender.emblem) return { hasCounter: false, counterDamage: 0 };
    
    const emblemType = defender.emblem.toLowerCase();
    if (emblemType.includes('수호자') || emblemType.includes('defender') || emblemType.includes('guardian')) {
        // 20% 확률로 받은 피해의 40% 반사
        if (Math.random() < 0.20) {
            return {
                hasCounter: true,
                counterDamage: Math.floor(damage * 0.4)
            };
        }
    }
    
    return { hasCounter: false, counterDamage: 0 };
}

// 도적 회피 반격 시스템
function calculateThiefDodgeCounter(attacker, defender) {
    if (!defender.emblem) return { hasCounter: false, counterDamage: 0 };
    
    const emblemType = defender.emblem.toLowerCase();
    if (emblemType.includes('도적') || emblemType.includes('thief') || emblemType.includes('rogue') || emblemType.includes('행운아')) {
        // 회피 시 50% 확률로 반격
        if (Math.random() < 0.5) {
            // 반격 데미지는 도적의 기본 공격력
            const totalStats = {
                agility: (defender.stats?.agility || 10) + (defender.equipmentStats?.agility || 0),
                luck: (defender.stats?.luck || 10) + (defender.equipmentStats?.luck || 0)
            };
            const counterDamage = (defender.attack || 10) + totalStats.agility * 1.5 + totalStats.luck * 1;
            
            return {
                hasCounter: true,
                counterDamage: Math.floor(counterDamage)
            };
        }
    }
    
    return { hasCounter: false, counterDamage: 0 };
}

// 궁수 보스전 회피 시스템
function calculateArcherBossDodge(defender, attacker) {
    if (!defender.emblem) return 0;
    
    const emblemType = defender.emblem.toLowerCase();
    if (emblemType.includes('궁수') || emblemType.includes('archer')) {
        // 보스나 고레벨 몬스터의 공격에 대해 추가 회피율
        if (attacker.level >= 100 || attacker.hp >= 50000) {
            const totalAgility = (defender.stats?.agility || 10) + (defender.equipmentStats?.agility || 0);
            
            // 민첩 기반 추가 회피율 (민첩 100당 10%)
            const agilityDodgeBonus = (totalAgility / 100) * 0.1;
            
            // 기본 보스전 회피 보너스 15% + 민첩 보너스
            return Math.min(0.25, 0.15 + agilityDodgeBonus); // 최대 25% 추가 회피
        }
    }
    
    return 0;
}

module.exports = {
    calculateDamage,
    calculatePvPDamage,
    calculateHuntingDamage,
    calculateBossRaidDamage,
    calculateCriticalChance,
    calculateDodgeChance,
    calculateDamageReduction,
    applyWarriorDamageReduction,
    calculateDefenderShield,
    calculateDefenderDamageReduction,
    calculateDefenderCounterAttack,
    calculateThiefDodgeCounter,
    calculateArcherBossDodge
};