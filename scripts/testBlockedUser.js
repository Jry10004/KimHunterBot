const mongoose = require('mongoose');
const MissionHelper = require('../utils/missionHelper');
const DailyMission = require('../models/DailyMission');
require('dotenv').config();

async function testBlockedUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // User 데이터가 없는 유저로 테스트
        const blockedUserId = '1108024531286224947';
        
        // 현재 상태 확인
        const mission = await DailyMission.findOne({ userId: blockedUserId });
        console.log('\n테스트 전 earnGold:', mission?.dailyMissions?.earnGold?.progress || 0);
        
        // 골드 업데이트 시도
        console.log('\n10000 골드 업데이트 시도...');
        await MissionHelper.updateGoldEarned(blockedUserId, 10000);
        
        // 업데이트 후 확인
        const updatedMission = await DailyMission.findOne({ userId: blockedUserId });
        console.log('\n테스트 후 earnGold:', updatedMission?.dailyMissions?.earnGold?.progress || 0);
        
        if (mission?.dailyMissions?.earnGold?.progress === updatedMission?.dailyMissions?.earnGold?.progress) {
            console.log('\n✅ 성공: User 데이터가 없는 유저의 미션 업데이트가 차단되었습니다!');
        } else {
            console.log('\n❌ 실패: 미션이 업데이트되었습니다.');
        }
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

testBlockedUser();