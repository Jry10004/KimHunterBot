// 전투력 계산 시스템 - 완전 재작성
// 직업별 가중치가 반영된 실전 중심 전투력

// 직업별 스탯 가중치 정의
const JOB_WEIGHTS = {
    warrior: { 
        strength: 2.5,  // 3.0 -> 2.5 하향
        vitality: 1.5,  // 2.0 -> 1.5 하향
        attack: 1.5, 
        defense: 1.2, 
        hp: 1.0, 
        agility: 0.5, 
        intelligence: 0.3, 
        luck: 0.5, 
        dodge: 0.3
    },
    archer: { 
        agility: 3.5,  // 3.3 -> 3.5 추가 상향
        luck: 3.1,     // 2.9 -> 3.1 추가 상향
        attack: 2.5,   // 2.3 -> 2.5 추가 상향
        strength: 0.8, 
        dodge: 1.8,    // 1.6 -> 1.8 추가 상향
        hp: 0.7, 
        defense: 0.5, 
        vitality: 0.6, 
        intelligence: 0.4
    },
    mage: { 
        intelligence: 3.3,  // 3.5 -> 3.3 (5% 너프)
        attack: 2.4,        // 2.5 -> 2.4 (5% 너프) - 마법사도 같은 attack 스탯 사용
        luck: 1.5, 
        hp: 1.0, 
        defense: 0.7, 
        agility: 0.5, 
        strength: 0.3, 
        vitality: 0.6, 
        dodge: 0.8 
    },
    thief: { 
        luck: 3.2,     // 3.0 -> 3.2 상향
        agility: 3.2,  // 3.0 -> 3.2 상향
        attack: 2.0,   // 1.8 -> 2.0 상향
        dodge: 2.1,    // 2.0 -> 2.1 상향
        strength: 0.6, 
        hp: 0.7, 
        defense: 0.4, 
        intelligence: 0.5, 
        vitality: 0.5
    },
    defender: { 
        vitality: 3.5, 
        defense: 3.0, 
        hp: 2.5, 
        strength: 1.5, 
        attack: 0.8, 
        agility: 0.4, 
        intelligence: 0.4, 
        luck: 0.5, 
        dodge: 0.6
    }
};

// 엠블럼에서 직업 추출
function getJobFromEmblem(emblem) {
    if (!emblem) return null;
    
    const emblemLower = emblem.toLowerCase();
    
    // 전사 계열 (정확한 엠블럼 이름)
    if (emblem === '초보전사' || emblem === '튼튼한 기사' || 
        emblem === '용맹한 검사' || emblem === '맹렬한 전사' || 
        emblem === '전설의 기사') {
        return 'warrior';
    }
    
    // 궁수 계열 (정확한 엠블럼 이름)
    if (emblem === '마을사냥꾼' || emblem === '숲의 궁수' || 
        emblem === '바람 사수' || emblem === '정확한 사격수' || 
        emblem === '전설의 명궁') {
        return 'archer';
    }
    
    // 수호자 계열 (정확한 엠블럼 이름)
    if (emblem === '초보 수호자' || emblem === '철벽 방패병' || 
        emblem === '불굴의 수호자' || emblem === '강철 파수꾼' || 
        emblem === '전설의 철벽') {
        return 'defender';
    }
    
    // 마법사 계열 (정확한 엠블럼 이름)
    if (emblem === '견습 마법사' || emblem === '원소 술사' || 
        emblem === '신비한 현자' || emblem === '대마법사' || 
        emblem === '전설의 아크메이지') {
        return 'mage';
    }
    
    // 도적 계열 (정확한 엠블럼 이름)
    if (emblem === '떠돌이 도적' || emblem === '운 좋은 도둑' || 
        emblem === '행운의 닌자' || emblem === '복 많은 도적' || 
        emblem === '전설의 행운아') {
        return 'thief';
    }
    
    // 강화된 엠블럼 처리 (+숫자)
    const baseEmblem = emblem.replace(/\s*\+\d+$/, '');
    if (baseEmblem !== emblem) {
        return getJobFromEmblem(baseEmblem);
    }
    
    return null;
}

// 장착된 아이템 가져오기
function getEquippedItem(user, slot) {
    if (!user || !user.equipment) return null;
    
    const itemIdOrIndex = user.equipment[slot];
    if (itemIdOrIndex === undefined || itemIdOrIndex === null) return null;
    
    if (user.inventory) {
        // ID로 찾기 시도
        let item = user.inventory.find(item => 
            item && (item.id === itemIdOrIndex || item._id?.toString() === itemIdOrIndex)
        );
        
        // inventorySlot으로 찾기 시도
        if (!item && typeof itemIdOrIndex === 'number') {
            item = user.inventory.find(item => item && item.inventorySlot === itemIdOrIndex);
        }
        
        // 인덱스로 찾기 시도
        if (!item && typeof itemIdOrIndex === 'number' && itemIdOrIndex >= 0) {
            item = user.inventory[itemIdOrIndex];
        }
        
        return item || null;
    }
    
    return null;
}

// 조각 시스템 공격력 계산
function getFragmentAttackBonus(user) {
    if (!user.energyFragments || !user.energyFragments.fragments) return 0;
    
    let totalAttackBonus = 0;
    const fragments = user.energyFragments.fragments instanceof Map 
        ? user.energyFragments.fragments 
        : new Map(Object.entries(user.energyFragments.fragments || {}));
    
    for (const [level, count] of fragments) {
        const lvl = parseInt(level);
        if (isNaN(lvl) || count <= 0) continue;
        
        // 기본 공격력 (레벨당 1)
        const baseAttack = lvl * count;
        
        // 구간별 보너스 배율
        let multiplier = 1.0;
        if (lvl >= 26 && lvl <= 50) multiplier = 1.2;
        else if (lvl >= 51 && lvl <= 75) multiplier = 1.5;
        else if (lvl >= 76 && lvl <= 99) multiplier = 2.0;
        else if (lvl === 100) multiplier = 3.0;
        
        totalAttackBonus += Math.floor(baseAttack * multiplier);
    }
    
    return totalAttackBonus;
}

// 전체 스탯 계산 (기본 + 장비)
// [중요] 이 함수가 모든 스탯 소스를 통합합니다:
// 1. 사용자 기본 스탯 (user.stats)
// 2. 장비 스탯 (user.equipment)
// 3. 장신구 스탯 (user.equippedAccessories)
// 4. 엠블럼 강화 스탯 (user.emblemEnhancement.stats)
// 5. 조각 시스템 공격력 (energyFragments)
function getTotalStats(user) {
    const totalStats = {
        strength: user.stats?.strength || 10,
        agility: user.stats?.agility || 10,
        intelligence: user.stats?.intelligence || 10,
        vitality: user.stats?.vitality || 10,
        luck: user.stats?.luck || 10,
        attack: 10,  // 기본 공격력 (장비 공격력으로 대체됨) - 마법사는 이것을 마력으로 표시
        defense: 10,  // 기본 방어력 (장비 방어력으로 대체됨)
        hp: 0,  // 장비에서 오는 추가 HP
        dodge: 0
    };
    
    // 장비 스탯 추가
    if (user.equipment && user.inventory) {
        const slots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'shield', 'accessory'];
        
        for (const slot of slots) {
            const item = getEquippedItem(user, slot);
            if (item && item.stats) {
                // item.stats에는 이미 강화 보너스가 포함되어 있음
                for (const [stat, value] of Object.entries(item.stats)) {
                    if (totalStats.hasOwnProperty(stat)) {
                        totalStats[stat] += value;
                    }
                }
            }
        }
    }
    
    // 장신구 스탯 추가
    if (user.equippedAccessories) {
        const accessorySlots = ['ring1', 'ring2', 'necklace', 'bracelet1', 'bracelet2', 'earring1', 'earring2'];
        for (const slot of accessorySlots) {
            const accessory = user.equippedAccessories[slot];
            if (accessory && accessory.stats) {
                const stats = accessory.stats instanceof Map ? Object.fromEntries(accessory.stats) : accessory.stats;
                for (const [stat, value] of Object.entries(stats)) {
                    if (totalStats.hasOwnProperty(stat) && value > 0) {
                        totalStats[stat] += value;
                    }
                }
            }
        }
    }
    
    // 엠블럼 강화 스탯 추가
    if (user.emblemEnhancement && user.emblemEnhancement.stats) {
        for (const [stat, value] of Object.entries(user.emblemEnhancement.stats)) {
            if (totalStats.hasOwnProperty(stat) && value > 0) {
                totalStats[stat] += value;
            }
        }
    }
    
    // 조각 시스템 공격력 추가
    const fragmentAttack = getFragmentAttackBonus(user);
    if (fragmentAttack > 0) {
        totalStats.attack += fragmentAttack;
    }
    
    return totalStats;
}

// 전투력 계산 - 직업별 특화
function calculateCombatPower(user) {
    // 1. 직업 확인
    const job = getJobFromEmblem(user.emblem);
    const weights = job ? JOB_WEIGHTS[job] : null;
    
    // 2. 전체 스탯 계산
    // [중요] getTotalStats가 모든 스탯을 통합하므로 여기서는 추가 계산 불필요
    const stats = getTotalStats(user);
    
    // 3. 직업별 가중치 적용 전투력
    let combatPower = 0;
    
    if (weights) {
        // 직업별 가중치 적용
        for (const [stat, value] of Object.entries(stats)) {
            const weight = weights[stat] || 0.1;
            combatPower += value * weight;
        }
    } else {
        // 직업 정보 없으면 기본 계산
        combatPower = (stats.strength * 2) + 
                      (stats.agility * 1.5) + 
                      (stats.intelligence * 1.2) + 
                      (stats.vitality * 1.8) + 
                      (stats.luck * 0.5) +
                      (stats.attack * 2) +
                      (stats.defense * 1.5) +
                      (stats.hp * 0.3) +
                      (stats.dodge * 1);
    }
    
    // 4. 레벨 보정 (하향 조정)
    combatPower += user.level * 50;  // 100 -> 50 하향
    
    // 5. 추가 시스템 보너스
    // PVP 강화
    if (user.pvp?.attackEnhancement) {
        const pvpPower = 
            (user.pvp.attackEnhancement.high || 0) * 15 +
            (user.pvp.attackEnhancement.middle || 0) * 10 +
            (user.pvp.attackEnhancement.low || 0) * 5;
        combatPower += pvpPower;
    }
    
    // 운동 시스템은 이제 user.stats에 직접 반영됨
    
    return Math.floor(combatPower);
}

// 전투력 차이에 따른 전투 수정치
function getCombatModifier(attackerPower, defenderPower) {
    const ratio = attackerPower / defenderPower;
    
    return {
        damage: Math.min(3.0, Math.max(0.2, ratio)),  // 0.2배 ~ 3배
        hitRate: Math.min(0.95, Math.max(0.20, 0.5 + (ratio - 1) * 0.3))  // 20% ~ 95%
    };
}

module.exports = {
    calculateCombatPower,
    getCombatModifier,
    getJobFromEmblem,
    getTotalStats,
    getFragmentAttackBonus,
    JOB_WEIGHTS
};