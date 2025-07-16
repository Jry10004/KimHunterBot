require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { calculateCombatPower, getJobFromEmblem } = require('../handlers/common/combatPower');

async function analyzeClassBalance() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공\n');

        // 모든 유저 가져오기 (레벨 1 이상, 등록된 유저만)
        const users = await User.find({ 
            registered: true,
            level: { $gte: 1 }
        });

        console.log(`📊 총 분석 대상 유저: ${users.length}명\n`);

        // 클래스별 데이터 수집
        const classData = {
            warrior: { users: [], totalPower: 0, totalLevel: 0, count: 0 },
            archer: { users: [], totalPower: 0, totalLevel: 0, count: 0 },
            mage: { users: [], totalPower: 0, totalLevel: 0, count: 0 },
            thief: { users: [], totalPower: 0, totalLevel: 0, count: 0 },
            defender: { users: [], totalPower: 0, totalLevel: 0, count: 0 },
            none: { users: [], totalPower: 0, totalLevel: 0, count: 0 }
        };

        // 전체 유저 데이터 수집
        const allUserData = [];

        for (const user of users) {
            const combatPower = calculateCombatPower(user);
            const job = getJobFromEmblem(user.emblem) || 'none';
            
            const userData = {
                nickname: user.nickname || user.discordId,
                emblem: user.emblem || '없음',
                job: job,
                level: user.level,
                combatPower: combatPower,
                normalizedPower: Math.floor(combatPower * (100 / user.level)) // 레벨 100 기준 정규화
            };

            classData[job].users.push(userData);
            classData[job].totalPower += combatPower;
            classData[job].totalLevel += user.level;
            classData[job].count++;

            allUserData.push(userData);
        }

        // 전투력 기준 정렬
        allUserData.sort((a, b) => b.combatPower - a.combatPower);

        console.log('=== 📊 클래스별 통계 ===\n');

        // 클래스별 평균 계산 및 출력
        for (const [className, data] of Object.entries(classData)) {
            if (data.count === 0) continue;

            const avgPower = Math.floor(data.totalPower / data.count);
            const avgLevel = Math.floor(data.totalLevel / data.count);
            
            // 해당 클래스의 최고 전투력 유저
            const topUser = data.users.sort((a, b) => b.combatPower - a.combatPower)[0];
            
            console.log(`📌 ${className.toUpperCase()} (${data.count}명)`);
            console.log(`   평균 전투력: ${avgPower.toLocaleString()}`);
            console.log(`   평균 레벨: ${avgLevel}`);
            console.log(`   최고 전투력: ${topUser.combatPower.toLocaleString()} (${topUser.nickname}, Lv.${topUser.level})`);
            console.log(`   레벨 100 정규화 평균: ${Math.floor(avgPower * (100 / avgLevel)).toLocaleString()}\n`);
        }

        console.log('\n=== 🏆 상위 10명 분석 ===\n');

        // 상위 10명의 클래스 분포
        const top10 = allUserData.slice(0, 10);
        const top10ClassCount = {};

        for (const user of top10) {
            top10ClassCount[user.job] = (top10ClassCount[user.job] || 0) + 1;
        }

        console.log('상위 10명 클래스 분포:');
        for (const [job, count] of Object.entries(top10ClassCount)) {
            console.log(`   ${job}: ${count}명 (${count * 10}%)`);
        }

        console.log('\n상위 10명 상세 정보:');
        top10.forEach((user, index) => {
            console.log(`${index + 1}. ${user.nickname} (${user.emblem})`);
            console.log(`   전투력: ${user.combatPower.toLocaleString()} | 레벨: ${user.level} | 정규화: ${user.normalizedPower.toLocaleString()}`);
        });

        // 상위 10% 분석
        console.log('\n=== 🎯 상위 10% 분석 ===\n');
        
        const top10PercentCount = Math.floor(allUserData.length * 0.1);
        const top10Percent = allUserData.slice(0, top10PercentCount);
        const top10PercentClassCount = {};

        for (const user of top10Percent) {
            top10PercentClassCount[user.job] = (top10PercentClassCount[user.job] || 0) + 1;
        }

        console.log(`상위 10% (${top10PercentCount}명) 클래스 분포:`);
        for (const [job, count] of Object.entries(top10PercentClassCount)) {
            const percentage = ((count / top10PercentCount) * 100).toFixed(1);
            console.log(`   ${job}: ${count}명 (${percentage}%)`);
        }

        // 클래스별 상위 10% 진입률
        console.log('\n클래스별 상위 10% 진입률:');
        for (const [className, data] of Object.entries(classData)) {
            if (data.count === 0) continue;
            
            const classInTop10Percent = top10PercentClassCount[className] || 0;
            const entryRate = ((classInTop10Percent / data.count) * 100).toFixed(1);
            console.log(`   ${className}: ${classInTop10Percent}/${data.count}명 (${entryRate}%)`);
        }

        // 전사 클래스 상세 분석
        console.log('\n=== ⚔️ 전사 클래스 상세 분석 ===\n');
        
        const warriorData = classData.warrior;
        if (warriorData.count > 0) {
            // 전투력 분포
            const warriorPowers = warriorData.users.map(u => u.combatPower);
            const maxPower = Math.max(...warriorPowers);
            const minPower = Math.min(...warriorPowers);
            const medianPower = warriorPowers.sort((a, b) => a - b)[Math.floor(warriorPowers.length / 2)];
            
            console.log('전사 전투력 분포:');
            console.log(`   최고: ${maxPower.toLocaleString()}`);
            console.log(`   최저: ${minPower.toLocaleString()}`);
            console.log(`   중앙값: ${medianPower.toLocaleString()}`);
            console.log(`   평균: ${Math.floor(warriorData.totalPower / warriorData.count).toLocaleString()}`);
            
            // 상위 5명 전사
            console.log('\n상위 5명 전사:');
            warriorData.users
                .sort((a, b) => b.combatPower - a.combatPower)
                .slice(0, 5)
                .forEach((user, index) => {
                    console.log(`${index + 1}. ${user.nickname} - ${user.combatPower.toLocaleString()} (Lv.${user.level})`);
                });
        }

        // 밸런스 점수 계산 (표준편차 기반)
        console.log('\n=== 📈 클래스 밸런스 점수 ===\n');
        
        const classAverages = [];
        for (const [className, data] of Object.entries(classData)) {
            if (data.count > 0 && className !== 'none') {
                const avgPower = data.totalPower / data.count;
                const avgLevel = data.totalLevel / data.count;
                const normalizedAvg = avgPower * (100 / avgLevel);
                classAverages.push({
                    class: className,
                    avgPower: avgPower,
                    normalizedAvg: normalizedAvg,
                    count: data.count
                });
            }
        }

        // 정규화된 평균의 표준편차 계산
        const normalizedValues = classAverages.map(c => c.normalizedAvg);
        const mean = normalizedValues.reduce((a, b) => a + b, 0) / normalizedValues.length;
        const variance = normalizedValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / normalizedValues.length;
        const stdDev = Math.sqrt(variance);
        const balanceScore = 100 - (stdDev / mean * 100);

        console.log(`전체 밸런스 점수: ${balanceScore.toFixed(1)}/100`);
        console.log(`(100에 가까울수록 균형잡힌 상태)\n`);

        // 각 클래스별 평균 대비 비율
        console.log('평균 대비 각 클래스 전투력:');
        classAverages.forEach(c => {
            const ratio = ((c.normalizedAvg / mean) * 100).toFixed(1);
            console.log(`   ${c.class}: ${ratio}% (${c.normalizedAvg.toLocaleString()})`);
        });

        await mongoose.connection.close();
        console.log('\n✅ 분석 완료');

    } catch (error) {
        console.error('❌ 오류 발생:', error);
        await mongoose.connection.close();
    }
}

// 스크립트 실행
analyzeClassBalance();