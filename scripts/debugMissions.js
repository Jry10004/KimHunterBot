require('dotenv').config();
const mongoose = require('mongoose');
const DailyMission = require('../models/DailyMission');
const User = require('../models/User');

async function debugMissions() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 모든 미션 데이터 확인
        const missions = await DailyMission.find({}).limit(5);
        
        console.log('\n📊 미션 데이터 디버깅:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        for (const mission of missions) {
            const user = await User.findOne({ discordId: mission.userId });
            const nickname = user ? (user.nickname || user.username) : 'Unknown';
            
            console.log(`\n👤 유저: ${nickname} (${mission.userId})`);
            console.log(`📅 마지막 리셋: ${mission.lastDailyReset}`);
            console.log(`💰 골드 미션 진행도: ${mission.dailyMissions.earnGold.progress}/${mission.dailyMissions.earnGold.target}`);
            console.log(`✅ 완료 여부: ${mission.dailyMissions.earnGold.completed}`);
            
            // 다른 미션들도 확인
            console.log('\n다른 미션 상태:');
            Object.entries(mission.dailyMissions).forEach(([key, data]) => {
                console.log(`  - ${key}: ${data.progress}/${data.target} (${data.completed ? '완료' : '진행중'})`);
            });
        }
        
        // 특정 유저의 미션 리셋 테스트
        console.log('\n\n🔄 미션 리셋 테스트:');
        const testMission = missions[0];
        if (testMission) {
            console.log('리셋 전:', {
                earnGold: testMission.dailyMissions.earnGold.progress,
                lastReset: testMission.lastDailyReset
            });
            
            // 강제로 어제 날짜로 설정
            testMission.lastDailyReset = new Date(Date.now() - 24 * 60 * 60 * 1000);
            await testMission.save();
            
            // 리셋 실행
            const wasReset = testMission.resetDaily();
            if (wasReset) {
                await testMission.save();
                console.log('리셋 후:', {
                    earnGold: testMission.dailyMissions.earnGold.progress,
                    lastReset: testMission.lastDailyReset
                });
            }
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ 작업 완료');
    }
}

// 스크립트 실행
debugMissions();