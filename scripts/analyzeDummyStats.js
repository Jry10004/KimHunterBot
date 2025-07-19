const mongoose = require('mongoose');
const DummyStats = require('../models/DummyStats');
require('dotenv').config();

async function analyzeDummyStats() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 전체 통계
        const totalStats = await DummyStats.countDocuments();
        console.log(`\n📊 전체 허수아비 통계 데이터: ${totalStats}개`);

        // 직업별 평균 데미지 분석
        console.log('\n🔍 직업별 평균 데미지 분석:');
        const jobAnalysis = await DummyStats.aggregate([
            {
                $group: {
                    _id: '$jobType',
                    avgDamage: { $avg: '$avgDamage' },
                    maxDamage: { $max: '$maxDamage' },
                    avgCritRate: { $avg: '$critRate' },
                    avgCombatPower: { $avg: '$combatPower' },
                    userCount: { $sum: 1 },
                    totalAttacks: { $sum: '$attackCount' }
                }
            },
            { $sort: { avgDamage: -1 } }
        ]);

        // 전사 기준값
        const warriorStats = jobAnalysis.find(j => j._id === '전사');
        const baseAvgDamage = warriorStats ? warriorStats.avgDamage : jobAnalysis[0].avgDamage;

        console.log('\n직업별 성능 비교 (전사 대비):');
        console.log('='.repeat(80));
        
        jobAnalysis.forEach((job, index) => {
            const performanceRatio = (job.avgDamage / baseAvgDamage * 100).toFixed(1);
            const bar = '█'.repeat(Math.round(performanceRatio / 10)) + '░'.repeat(10 - Math.round(performanceRatio / 10));
            
            console.log(`\n${index + 1}. ${job._id}`);
            console.log(`   성능: ${bar} ${performanceRatio}%`);
            console.log(`   평균 데미지: ${Math.floor(job.avgDamage).toLocaleString()}`);
            console.log(`   최대 데미지: ${job.maxDamage.toLocaleString()}`);
            console.log(`   평균 치명타율: ${job.avgCritRate.toFixed(1)}%`);
            console.log(`   평균 전투력: ${Math.floor(job.avgCombatPower).toLocaleString()}`);
            console.log(`   유저 수: ${job.userCount}명`);
            console.log(`   총 공격 횟수: ${job.totalAttacks.toLocaleString()}회`);
        });

        // 궁수 특별 분석
        const archerStats = jobAnalysis.find(j => j._id === '궁수');
        if (archerStats) {
            console.log('\n🏹 궁수 상세 분석:');
            console.log('='.repeat(80));
            
            // 궁수 유저들 상세 정보
            const archerUsers = await DummyStats.find({ jobType: '궁수' })
                .sort({ avgDamage: -1 })
                .limit(10);
            
            console.log('\n상위 10명 궁수 유저:');
            archerUsers.forEach((user, index) => {
                console.log(`${index + 1}. ${user.username} - 평균: ${user.avgDamage.toLocaleString()}, 전투력: ${user.combatPower.toLocaleString()}`);
            });
        }

        // 전투력 대비 데미지 효율
        console.log('\n⚔️ 전투력 대비 데미지 효율:');
        const efficiencyAnalysis = await DummyStats.aggregate([
            {
                $match: { combatPower: { $gt: 0 } }
            },
            {
                $project: {
                    jobType: 1,
                    efficiency: { $divide: ['$avgDamage', '$combatPower'] }
                }
            },
            {
                $group: {
                    _id: '$jobType',
                    avgEfficiency: { $avg: '$efficiency' }
                }
            },
            { $sort: { avgEfficiency: -1 } }
        ]);

        efficiencyAnalysis.forEach((job) => {
            console.log(`${job._id}: ${(job.avgEfficiency * 100).toFixed(2)}% 효율`);
        });

    } catch (error) {
        console.error('분석 중 오류:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ 분석 완료');
    }
}

analyzeDummyStats();