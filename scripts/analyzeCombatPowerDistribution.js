const mongoose = require('mongoose');
const User = require('../models/User');
const { calculateCombatPower } = require('../handlers/common/combatPower');
require('dotenv').config();

async function analyzeCombatPowerDistribution() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/discord-bot', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB 연결 성공');

        // 모든 등록된 유저 가져오기
        const users = await User.find({ registered: true });
        console.log(`\n총 등록된 유저 수: ${users.length}명`);

        // 각 유저의 전투력 계산
        const userPowers = users.map(user => {
            const power = calculateCombatPower(user);
            const isMage = user.emblem && (
                user.emblem.includes('마법사') || 
                user.emblem.includes('원소 술사') ||
                user.emblem.includes('신비한 현자') ||
                user.emblem.includes('대마법사') ||
                user.emblem.includes('아크메이지')
            );
            
            return {
                nickname: user.nickname,
                discordId: user.discordId,
                emblem: user.emblem || '없음',
                level: user.level,
                power: power,
                type: isMage ? '마력' : '전투력'
            };
        });

        // 전투력 기준 정렬
        userPowers.sort((a, b) => b.power - a.power);

        // 통계 계산
        const totalUsers = userPowers.length;
        const avgPower = Math.floor(userPowers.reduce((sum, u) => sum + u.power, 0) / totalUsers);
        const maxPower = userPowers[0]?.power || 0;
        const minPower = userPowers[totalUsers - 1]?.power || 0;

        console.log(`\n=== 전투력/마력 통계 ===`);
        console.log(`평균: ${avgPower.toLocaleString()}`);
        console.log(`최대: ${maxPower.toLocaleString()} (${userPowers[0]?.nickname || 'N/A'})`);
        console.log(`최소: ${minPower.toLocaleString()} (${userPowers[totalUsers - 1]?.nickname || 'N/A'})`);

        // 분위수 계산
        const percentile33 = Math.floor(totalUsers * 0.33);
        const percentile66 = Math.floor(totalUsers * 0.66);

        console.log(`\n=== 분위수 기준 ===`);
        console.log(`상위 33% 기준: ${userPowers[percentile33]?.power.toLocaleString() || 0} 이상`);
        console.log(`중위 33% 기준: ${userPowers[percentile66]?.power.toLocaleString() || 0} ~ ${userPowers[percentile33]?.power.toLocaleString() || 0}`);
        console.log(`하위 34% 기준: ${userPowers[percentile66]?.power.toLocaleString() || 0} 미만`);

        // 티어 분류
        const highTierUsers = userPowers.slice(0, percentile33);
        const midTierUsers = userPowers.slice(percentile33, percentile66);
        const lowTierUsers = userPowers.slice(percentile66);

        console.log(`\n=== 티어별 인원 ===`);
        console.log(`상위 티어 (High): ${highTierUsers.length}명`);
        console.log(`중위 티어 (Mid): ${midTierUsers.length}명`);
        console.log(`하위 티어 (Low): ${lowTierUsers.length}명`);

        // TOP 10 출력
        console.log(`\n=== TOP 10 유저 ===`);
        for (let i = 0; i < Math.min(10, userPowers.length); i++) {
            const user = userPowers[i];
            console.log(`${i + 1}위: ${user.nickname} - ${user.type} ${user.power.toLocaleString()} (${user.emblem}, Lv.${user.level})`);
        }

        // 직업별 분포
        const jobDistribution = {};
        userPowers.forEach(user => {
            const job = user.emblem || '없음';
            if (!jobDistribution[job]) {
                jobDistribution[job] = { count: 0, totalPower: 0 };
            }
            jobDistribution[job].count++;
            jobDistribution[job].totalPower += user.power;
        });

        console.log(`\n=== 직업별 평균 전투력 ===`);
        Object.entries(jobDistribution)
            .sort((a, b) => (b[1].totalPower / b[1].count) - (a[1].totalPower / a[1].count))
            .forEach(([job, data]) => {
                const avgJobPower = Math.floor(data.totalPower / data.count);
                console.log(`${job}: ${avgJobPower.toLocaleString()} (${data.count}명)`);
            });

        // 제안 값 출력
        console.log(`\n=== 보스 티어 설정 제안 ===`);
        console.log(`High 티어 기준: ${userPowers[percentile33]?.power.toLocaleString() || 50000} 이상`);
        console.log(`Mid 티어 기준: ${userPowers[percentile66]?.power.toLocaleString() || 20000} ~ ${userPowers[percentile33]?.power.toLocaleString() || 50000}`);
        console.log(`Low 티어 기준: ${userPowers[percentile66]?.power.toLocaleString() || 20000} 미만`);

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 스크립트 실행
analyzeCombatPowerDistribution();