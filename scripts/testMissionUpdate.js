const mongoose = require('mongoose');
const DailyMission = require('../models/DailyMission');
const User = require('../models/User');
const MissionHelper = require('../utils/missionHelper');
require('dotenv').config();

async function testMissionUpdate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 하연 유저 ID
        const targetUserId = '295980447849250817';
        
        // 현재 미션 상태 확인
        let mission = await DailyMission.findOne({ userId: targetUserId });
        console.log('\n=== 테스트 전 미션 상태 ===');
        console.log(`earnGold: ${mission.dailyMissions.earnGold.progress}/${mission.dailyMissions.earnGold.target}`);
        
        // MissionHelper로 골드 미션 업데이트 테스트
        console.log('\n1000 골드 획득 시뮬레이션...');
        await MissionHelper.updateGoldEarned(targetUserId, 1000);
        
        // 업데이트 후 상태 확인
        mission = await DailyMission.findOne({ userId: targetUserId });
        console.log('\n=== 테스트 후 미션 상태 ===');
        console.log(`earnGold: ${mission.dailyMissions.earnGold.progress}/${mission.dailyMissions.earnGold.target}`);
        
        // 큰 금액 테스트
        console.log('\n10000 골드 획득 시뮬레이션...');
        await MissionHelper.updateGoldEarned(targetUserId, 10000);
        
        mission = await DailyMission.findOne({ userId: targetUserId });
        console.log('\n=== 큰 금액 테스트 후 미션 상태 ===');
        console.log(`earnGold: ${mission.dailyMissions.earnGold.progress}/${mission.dailyMissions.earnGold.target}`);
        console.log(`완료 여부: ${mission.dailyMissions.earnGold.completed}`);
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

testMissionUpdate();