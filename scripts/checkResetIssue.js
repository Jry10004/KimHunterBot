const mongoose = require('mongoose');
const DailyMission = require('../models/DailyMission');
require('dotenv').config();

async function checkResetIssue() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 모든 미션 데이터 확인
        const allMissions = await DailyMission.find();
        
        console.log(`\n전체 미션 데이터 수: ${allMissions.length}`);
        
        const now = new Date();
        console.log(`현재 시간: ${now}`);
        console.log(`현재 날짜 문자열: ${now.toDateString()}`);
        
        allMissions.forEach(mission => {
            const lastReset = new Date(mission.lastDailyReset);
            const isSameDay = now.toDateString() === lastReset.toDateString();
            
            console.log(`\n유저 ID: ${mission.userId}`);
            console.log(`마지막 리셋: ${lastReset}`);
            console.log(`리셋 날짜 문자열: ${lastReset.toDateString()}`);
            console.log(`같은 날인가?: ${isSameDay}`);
            console.log(`earnGold 진행도: ${mission.dailyMissions.earnGold.progress}/${mission.dailyMissions.earnGold.target}`);
            
            // 리셋이 필요한지 체크
            if (!isSameDay) {
                console.log('⚠️ 이 유저는 리셋이 필요합니다!');
            }
        });
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

checkResetIssue();