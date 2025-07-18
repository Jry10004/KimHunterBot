const mongoose = require('mongoose');
const User = require('../models/User');
const { calculateCombatPower, getTotalStats, getJobFromEmblem } = require('../handlers/common/combatPower');

async function debugCombatPower() {
    try {
        // MongoDB 연결
        await mongoose.connect('mongodb://localhost:27017/discordbot', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB 연결 성공');

        // 유저 찾기 - 요리
        const user = await User.findOne({ nickname: '요리' });
        if (!user) {
            console.log('유저를 찾을 수 없습니다.');
            return;
        }

        console.log('\n=== 유저 정보 ===');
        console.log(`닉네임: ${user.nickname}`);
        console.log(`레벨: ${user.level}`);
        console.log(`엠블럼: ${user.emblem}`);
        console.log(`DB 전투력: ${user.combatPower}`);

        // 직업 확인
        const job = getJobFromEmblem(user.emblem);
        console.log(`\n직업: ${job}`);

        // 기본 스탯
        console.log('\n=== 기본 스탯 ===');
        console.log(`힘: ${user.stats.strength}`);
        console.log(`민첩: ${user.stats.agility}`);
        console.log(`지능: ${user.stats.intelligence}`);
        console.log(`체력: ${user.stats.vitality}`);
        console.log(`행운: ${user.stats.luck}`);

        // 분배한 스탯
        console.log('\n=== 분배한 스탯 ===');
        if (user.distributedStats) {
            console.log(`힘: ${user.distributedStats.strength || 0}`);
            console.log(`민첩: ${user.distributedStats.agility || 0}`);
            console.log(`지능: ${user.distributedStats.intelligence || 0}`);
            console.log(`체력: ${user.distributedStats.vitality || 0}`);
            console.log(`행운: ${user.distributedStats.luck || 0}`);
        }

        // 엠블럼 강화 정보
        console.log('\n=== 엠블럼 강화 ===');
        if (user.emblemEnhancement) {
            console.log(`강화 레벨: ${user.emblemEnhancement.level}`);
            console.log('강화 스탯:', user.emblemEnhancement.stats);
        }

        // 장비 정보
        console.log('\n=== 장비 ===');
        if (user.equipment) {
            for (const [slot, index] of Object.entries(user.equipment)) {
                if (index >= 0 && user.inventory && user.inventory[index]) {
                    const item = user.inventory[index];
                    console.log(`${slot}: ${item.name} (공격력: ${item.stats?.attack || 0}, 방어력: ${item.stats?.defense || 0})`);
                }
            }
        }

        // 장신구 정보
        console.log('\n=== 장신구 ===');
        if (user.equippedAccessories) {
            for (const [slot, accessory] of Object.entries(user.equippedAccessories)) {
                if (accessory) {
                    console.log(`${slot}: ${accessory.name} (공격력: ${accessory.stats?.attack || 0}, 방어력: ${accessory.stats?.defense || 0}, 행운: ${accessory.stats?.luck || 0})`);
                }
            }
        }

        // PVP 강화
        console.log('\n=== PVP 강화 ===');
        if (user.pvp?.attackEnhancement) {
            console.log('공격력 강화:', user.pvp.attackEnhancement);
            const pvpPower = 
                (user.pvp.attackEnhancement.high || 0) * 15 +
                (user.pvp.attackEnhancement.middle || 0) * 10 +
                (user.pvp.attackEnhancement.low || 0) * 5;
            console.log(`PVP 강화 전투력: ${pvpPower}`);
        }

        // 전체 스탯 계산
        console.log('\n=== 전체 스탯 (getTotalStats) ===');
        const totalStats = getTotalStats(user);
        console.log('totalStats:', totalStats);

        // 전투력 계산 상세
        console.log('\n=== 전투력 계산 과정 ===');
        
        // 직업별 가중치
        const JOB_WEIGHTS = {
            thief: { 
                luck: 3.2,
                agility: 3.2,
                attack: 2.0,
                dodge: 2.1,
                strength: 0.6, 
                hp: 0.7, 
                defense: 0.4, 
                intelligence: 0.5, 
                vitality: 0.5 
            }
        };

        const weights = JOB_WEIGHTS[job];
        console.log('\n직업별 가중치:', weights);

        // 각 스탯별 전투력 기여도
        let combatPower = 0;
        console.log('\n각 스탯의 전투력 기여도:');
        for (const [stat, value] of Object.entries(totalStats)) {
            const weight = weights[stat] || 0.1;
            const contribution = value * weight;
            combatPower += contribution;
            console.log(`${stat}: ${value} × ${weight} = ${contribution.toFixed(2)}`);
        }

        // 레벨 보정
        const levelBonus = user.level * 50;
        combatPower += levelBonus;
        console.log(`\n레벨 보정: ${user.level} × 50 = ${levelBonus}`);

        // PVP 보너스
        if (user.pvp?.attackEnhancement) {
            const pvpPower = 
                (user.pvp.attackEnhancement.high || 0) * 15 +
                (user.pvp.attackEnhancement.middle || 0) * 10 +
                (user.pvp.attackEnhancement.low || 0) * 5;
            combatPower += pvpPower;
            console.log(`PVP 보너스: ${pvpPower}`);
        }

        console.log(`\n최종 계산된 전투력: ${Math.floor(combatPower)}`);

        // calculateCombatPower 함수 결과
        const calculatedPower = calculateCombatPower(user);
        console.log(`calculateCombatPower 함수 결과: ${calculatedPower}`);

        console.log('\n=== 불일치 분석 ===');
        console.log(`장비 화면 전투력: 2,529`);
        console.log(`프로필 화면 전투력: 7,875`);
        console.log(`계산된 전투력: ${calculatedPower}`);
        console.log(`DB 저장 전투력: ${user.combatPower}`);

    } catch (error) {
        console.error('오류:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugCombatPower();