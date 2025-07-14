// 보스 난이도 분석 스크립트
const { calculateBossRaidDamage, calculateDamageReduction } = require('../handlers/common/damageCalculator');

// 평균적인 유저 스펙 (레벨별)
const userProfiles = {
    // 초보 유저 (레벨 10-20)
    beginner: {
        level: 15,
        attack: 50,
        defense: 30,
        health: 1000,
        stats: { strength: 15, agility: 10, vitality: 15, intelligence: 10, luck: 10 },
        equipment: { attackBonus: 30, defenseBonus: 20 }, // 기본 장비
        combatPower: 500
    },
    // 중급 유저 (레벨 20-30)
    intermediate: {
        level: 25,
        attack: 100,
        defense: 60,
        health: 2000,
        stats: { strength: 25, agility: 15, vitality: 25, intelligence: 15, luck: 15 },
        equipment: { attackBonus: 60, defenseBonus: 40 }, // 일반~레어 장비
        combatPower: 1200
    },
    // 고급 유저 (레벨 30-40)
    advanced: {
        level: 35,
        attack: 150,
        defense: 100,
        health: 3500,
        stats: { strength: 35, agility: 20, vitality: 35, intelligence: 20, luck: 20 },
        equipment: { attackBonus: 100, defenseBonus: 80 }, // 레어~에픽 장비
        combatPower: 2500
    }
};

// 보스 데이터
const bosses = {
    goblinChief: {
        name: '고블린 족장',
        level: 20,
        hp: 30000,
        attack: 150,
        defense: 80,
        requiredLevel: 10
    },
    skeletonKing: {
        name: '해골 왕',
        level: 30,
        hp: 50000,
        attack: 250,
        defense: 120,
        requiredLevel: 20
    }
};

function analyzeRaid(userProfile, boss, partySize) {
    // 유저의 총 공격력 계산
    const totalAttack = userProfile.attack + userProfile.equipment.attackBonus + (userProfile.stats.strength * 2);
    const user = {
        ...userProfile,
        attack: totalAttack
    };
    
    // 유저의 총 방어력 계산
    const totalDefense = userProfile.defense + userProfile.equipment.defenseBonus;
    const totalHealth = userProfile.health + (userProfile.stats.vitality * 10) + (userProfile.level * 20);
    
    // 플레이어가 주는 데미지 계산
    const normalAttack = calculateBossRaidDamage(user, boss, false);
    const skillAttack = calculateBossRaidDamage(user, boss, true);
    
    // 평균 턴당 데미지 (스킬은 5턴마다)
    const avgDamagePerTurn = (normalAttack.damage * 4 + skillAttack.damage) / 5;
    
    // 보스가 주는 데미지 계산
    const defenseReduction = calculateDamageReduction(totalDefense);
    const bossDamageToPlayer = Math.floor(boss.attack * (1 - defenseReduction));
    
    // 예상 결과 계산
    const turnsToKillBoss = Math.ceil(boss.hp / (avgDamagePerTurn * partySize));
    const playerSurvivalTurns = Math.ceil(totalHealth / bossDamageToPlayer);
    
    return {
        userType: userProfile.name,
        boss: boss.name,
        partySize: partySize,
        playerStats: {
            totalAttack: totalAttack,
            totalDefense: totalDefense,
            totalHealth: totalHealth
        },
        damage: {
            normalAttack: Math.floor(normalAttack.damage),
            skillAttack: Math.floor(skillAttack.damage),
            avgPerTurn: Math.floor(avgDamagePerTurn),
            totalPartyDPS: Math.floor(avgDamagePerTurn * partySize)
        },
        bossDamage: {
            toPlayer: bossDamageToPlayer,
            defenseReduction: Math.floor(defenseReduction * 100) + '%'
        },
        raid: {
            turnsToKillBoss: turnsToKillBoss,
            playerSurvivalTurns: playerSurvivalTurns,
            canSurvive: playerSurvivalTurns > turnsToKillBoss,
            difficulty: turnsToKillBoss > 50 ? '매우 어려움' : 
                       turnsToKillBoss > 30 ? '어려움' :
                       turnsToKillBoss > 20 ? '보통' : '쉬움'
        }
    };
}

console.log('=== 보스 레이드 난이도 분석 ===\n');

// 각 유저 타입별로 분석
Object.entries(userProfiles).forEach(([type, profile]) => {
    profile.name = type;
    console.log(`\n[${type.toUpperCase()} 유저 분석]`);
    
    // 고블린 족장
    console.log('\n고블린 족장 (HP: 30,000):');
    [2, 5, 10].forEach(partySize => {
        const result = analyzeRaid(profile, bosses.goblinChief, partySize);
        console.log(`  ${partySize}명 파티:`);
        console.log(`    - 플레이어 데미지: ${result.damage.normalAttack} (일반) / ${result.damage.skillAttack} (스킬)`);
        console.log(`    - 파티 DPS: ${result.damage.totalPartyDPS}`);
        console.log(`    - 보스 데미지: ${result.bossDamage.toPlayer} (방어 감소: ${result.bossDamage.defenseReduction})`);
        console.log(`    - 예상 턴수: ${result.raid.turnsToKillBoss}턴`);
        console.log(`    - 생존 가능: ${result.raid.canSurvive ? 'O' : 'X'} (${result.raid.playerSurvivalTurns}턴 생존)`);
        console.log(`    - 난이도: ${result.raid.difficulty}`);
    });
    
    // 해골 왕
    console.log('\n해골 왕 (HP: 50,000):');
    [2, 5, 10].forEach(partySize => {
        const result = analyzeRaid(profile, bosses.skeletonKing, partySize);
        console.log(`  ${partySize}명 파티:`);
        console.log(`    - 플레이어 데미지: ${result.damage.normalAttack} (일반) / ${result.damage.skillAttack} (스킬)`);
        console.log(`    - 파티 DPS: ${result.damage.totalPartyDPS}`);
        console.log(`    - 보스 데미지: ${result.bossDamage.toPlayer} (방어 감소: ${result.bossDamage.defenseReduction})`);
        console.log(`    - 예상 턴수: ${result.raid.turnsToKillBoss}턴`);
        console.log(`    - 생존 가능: ${result.raid.canSurvive ? 'O' : 'X'} (${result.raid.playerSurvivalTurns}턴 생존)`);
        console.log(`    - 난이도: ${result.raid.difficulty}`);
    });
});

console.log('\n\n=== 권장 사항 ===');
console.log('1. 고블린 족장:');
console.log('   - 초보 유저: 최소 5-10명 파티 권장');
console.log('   - 중급 유저: 3-5명 파티로 충분');
console.log('   - 고급 유저: 2-3명으로도 클리어 가능');

console.log('\n2. 해골 왕:');
console.log('   - 초보 유저: 도전 권장하지 않음 (레벨 20 이상 권장)');
console.log('   - 중급 유저: 최소 5-10명 파티 권장');
console.log('   - 고급 유저: 3-5명 파티로 안정적 클리어');

console.log('\n3. 전반적인 평가:');
console.log('   - 현재 데미지 공식으로는 적절한 난이도');
console.log('   - 파티 플레이 강제로 협동 유도');
console.log('   - 장비와 레벨의 중요성 강조');