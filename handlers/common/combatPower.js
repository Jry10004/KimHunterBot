// 순환 참조 방지를 위해 직접 구현
function getEquippedItem(user, slot) {
    if (!user || !user.equipment) return null;
    return user.equipment[slot] || null;
}

function getEmblemLevel(user, emblemType) {
    if (!user || !user.emblems) return 0;
    const emblem = user.emblems.find(e => e.type === emblemType);
    return emblem ? emblem.level : 0;
}

// 통합 전투력 계산 함수 - 모든 곳에서 이 함수를 사용
function calculateCombatPower(user) {
    let totalPower = 0;
    
    // 1. 기본 스탯 전투력 계산
    const stats = user.stats || {};
    const baseStats = {
        str: stats.strength || 10,
        agi: stats.agility || 10,
        int: stats.intelligence || 10,
        vit: stats.vitality || 10,
        luk: stats.luck || 10
    };
    
    // 스탯별 가중치 적용
    const statPower = 
        (baseStats.str * 2) +      // 힘: x2
        (baseStats.agi * 1.5) +    // 민첩: x1.5
        (baseStats.int * 1.2) +    // 지능: x1.2
        (baseStats.vit * 1.8) +    // 체력: x1.8
        (baseStats.luk * 0.5);     // 행운: x0.5
    
    totalPower += statPower;
    
    // 2. 장비 전투력 계산
    let equipmentPower = 0;
    if (user.equipment) {
        Object.values(user.equipment).forEach(item => {
            if (item && item.stats) {
                // 기본 능력치
                equipmentPower += (item.stats.attack || 0) * 2;
                equipmentPower += (item.stats.defense || 0) * 1.5;
                equipmentPower += (item.stats.hp || 0) * 0.5;
                equipmentPower += (item.stats.dodge || 0) * 1;
                equipmentPower += (item.stats.luck || 0) * 0.5;
                
                // 강화 보너스
                if (item.enhancement && item.enhancement > 0) {
                    equipmentPower += (item.enhancement * 10); // 강화당 +10
                }
            }
        });
    }
    totalPower += equipmentPower;
    
    // 3. 엠블럼 강화 보너스
    if (user.emblemEnhancement && user.emblemEnhancement.level > 0) {
        totalPower += user.emblemEnhancement.level * 20; // 강화 레벨당 +20
    }
    
    // 4. 레벨 보너스
    totalPower += user.level * 10;
    
    // 5. PVP 강화 전투력
    if (user.pvp?.attackEnhancement) {
        const pvpPower = 
            (user.pvp.attackEnhancement.high || 0) * 15 +
            (user.pvp.attackEnhancement.middle || 0) * 10 +
            (user.pvp.attackEnhancement.low || 0) * 5;
        totalPower += pvpPower;
    }
    
    // 6. 에너지 조각 전투력
    if (user.energyFragments?.fragments) {
        let fragmentAttackBonus = 0;
        // 각 레벨별 조각의 공격력 보너스 계산
        Object.entries(user.energyFragments.fragments).forEach(([level, count]) => {
            if (count > 0) {
                fragmentAttackBonus += parseInt(level) * count; // 레벨 * 개수 = 공격력 보너스
            }
        });
        totalPower += fragmentAttackBonus * 2; // 공격력 보너스를 전투력으로 변환 (x2)
    }
    
    // 7. 운동 시스템 보너스
    if (user.fitness?.stats) {
        const fitnessBonus = 
            (user.fitness.stats.strength || 0) * 2 +
            (user.fitness.stats.stamina || 0) * 1.5 +
            (user.fitness.stats.agility || 0) * 1;
        totalPower += fitnessBonus;
    }
    
    // 8. 목걸이 보너스 (구버전 호환)
    if (user.equippedNecklace && user.equippedNecklace.stats) {
        const necklacePower = 
            (user.equippedNecklace.stats.attack || 0) * 2 +
            (user.equippedNecklace.stats.defense || 0) * 1.5 +
            (user.equippedNecklace.stats.hp || 0) * 0.5;
        totalPower += necklacePower;
    }
    
    // 9. 장신구 전투력 (신버전 - 7슬롯)
    if (user.equippedAccessories) {
        Object.values(user.equippedAccessories).forEach(accessory => {
            if (accessory && accessory.stats) {
                const stats = accessory.stats instanceof Map ? Object.fromEntries(accessory.stats) : accessory.stats;
                
                // 기본 스탯
                totalPower += (stats.attack || 0) * 2;
                totalPower += (stats.defense || 0) * 1.5;
                totalPower += (stats.hp || 0) * 0.5;
                totalPower += (stats.critical || 0) * 1;
                totalPower += (stats.dodge || 0) * 1;
                
                // 특수 스탯
                totalPower += (stats.pvpDamage || 0) * 0.5;
                totalPower += (stats.huntingDamage || 0) * 0.5;
                totalPower += (stats.bossDamage || 0) * 0.5;
            }
        });
    }
    
    return Math.floor(totalPower);
}

module.exports = {
    calculateCombatPower
};