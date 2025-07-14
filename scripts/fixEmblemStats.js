const mongoose = require('mongoose');
const User = require('../models/User');
const { EMBLEMS } = require('../systems/emblemShop');
const { EMBLEM_ENHANCE_STATS } = require('../systems/emblemEnhancement');
const connectDB = require('../database/connection');

async function fixEmblemStats() {
    try {
        await connectDB();
        console.log('데이터베이스 연결 완료');

        // 엠블럼을 가진 모든 유저 찾기
        const users = await User.find({ emblem: { $exists: true, $ne: null } });
        console.log(`엠블럼을 가진 유저 수: ${users.length}`);

        let fixedCount = 0;

        for (const user of users) {
            if (!user.emblem) continue;

            // 엠블럼 타입 찾기
            const emblemType = Object.keys(EMBLEMS).find(type => 
                EMBLEMS[type].emblems.some(e => e.name === user.emblem)
            );

            if (!emblemType) {
                console.log(`경고: ${user.nickname || user.discordId}의 엠블럼 타입을 찾을 수 없음: ${user.emblem}`);
                continue;
            }

            const emblemData = EMBLEM_ENHANCE_STATS[emblemType];
            if (!emblemData) {
                console.log(`경고: ${emblemType} 타입의 강화 스탯 데이터 없음`);
                continue;
            }

            // 스탯 초기화
            if (!user.stats) {
                user.stats = {
                    strength: 10,
                    agility: 10,
                    intelligence: 10,
                    vitality: 10,
                    luck: 10
                };
            }

            // 기존 엠블럼 스탯 제거
            if (user.emblemEnhancement?.appliedStats) {
                for (const [stat, value] of Object.entries(user.emblemEnhancement.appliedStats)) {
                    if (user.stats[stat] !== undefined && value > 0) {
                        user.stats[stat] = Math.max(10, user.stats[stat] - value);
                    }
                }
            }

            // 새로운 스탯 적용
            const enhanceLevel = user.emblemEnhancement?.level || 0;
            const appliedStats = {};

            for (const [stat, multiplier] of Object.entries(emblemData.stats)) {
                const statValue = Math.floor(multiplier * enhanceLevel);
                if (statValue > 0 && user.stats[stat] !== undefined) {
                    user.stats[stat] += statValue;
                    appliedStats[stat] = statValue;
                }
            }

            // 적용된 스탯 저장
            if (!user.emblemEnhancement) {
                user.emblemEnhancement = {};
            }
            user.emblemEnhancement.appliedStats = appliedStats;

            await user.save();
            fixedCount++;

            console.log(`수정됨: ${user.nickname || user.discordId} - ${user.emblem} (${emblemType}) +${enhanceLevel}`);
            console.log(`  적용된 스탯:`, appliedStats);
        }

        console.log(`\n총 ${fixedCount}명의 유저 엠블럼 스탯 수정 완료`);
        process.exit(0);
    } catch (error) {
        console.error('오류 발생:', error);
        process.exit(1);
    }
}

fixEmblemStats();