const mongoose = require('mongoose');
const DailyMission = require('../models/DailyMission');
const User = require('../models/User');
require('dotenv').config();

async function debugMission() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 특정 유저의 미션 데이터 확인
        const targetUserId = '295980447849250817'; // 하연의 Discord ID
        
        // User 데이터 확인
        const user = await User.findOne({ discordId: targetUserId });
        if (user) {
            console.log('\n=== User 데이터 ===');
            console.log(`Nickname: ${user.nickname || user.username}`);
            console.log(`Discord ID: ${user.discordId}`);
            console.log(`Gold: ${user.gold}`);
        } else {
            console.log('\n❌ User 데이터를 찾을 수 없습니다.');
        }
        
        // DailyMission 데이터 확인
        const mission = await DailyMission.findOne({ userId: targetUserId });
        if (mission) {
            console.log('\n=== DailyMission 데이터 ===');
            console.log(`userId: ${mission.userId}`);
            console.log('\n일일미션 상태:');
            Object.entries(mission.dailyMissions).forEach(([key, data]) => {
                console.log(`  ${key}: ${data.progress}/${data.target} (완료: ${data.completed})`);
            });
            console.log(`\n일일미션 완료 개수: ${mission.dailyCompletedCount}`);
            console.log(`일일 보상 수령 여부: ${mission.dailyRewardClaimed}`);
            console.log(`마지막 일일 리셋: ${mission.lastDailyReset}`);
            
            console.log('\n주간미션 상태:');
            Object.entries(mission.weeklyMissions).forEach(([key, data]) => {
                console.log(`  ${key}: ${data.progress}/${data.target} (완료: ${data.completed})`);
            });
        } else {
            console.log('\n❌ DailyMission 데이터를 찾을 수 없습니다.');
            
            // 새로 생성해보기
            console.log('\n새 DailyMission 데이터 생성 시도...');
            const newMission = new DailyMission({ userId: targetUserId });
            await newMission.save();
            console.log('✅ 새 DailyMission 데이터 생성 완료');
        }
        
        // 모든 미션 데이터 개수 확인
        const totalMissions = await DailyMission.countDocuments();
        console.log(`\n전체 DailyMission 문서 개수: ${totalMissions}`);
        
        // 골드 미션이 0이 아닌 유저들 확인
        const activeGoldMissions = await DailyMission.find({
            'dailyMissions.earnGold.progress': { $gt: 0 }
        }).limit(5);
        
        console.log('\n골드 미션 진행중인 유저들:');
        activeGoldMissions.forEach(m => {
            console.log(`  userId: ${m.userId}, progress: ${m.dailyMissions.earnGold.progress}`);
        });
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

debugMission();