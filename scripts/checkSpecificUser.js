const mongoose = require('mongoose');
const User = require('../models/User');
const DailyMission = require('../models/DailyMission');
require('dotenv').config();

async function checkSpecificUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 1108024531286224947 유저 확인
        const userId = '1108024531286224947';
        
        const user = await User.findOne({ discordId: userId });
        if (user) {
            console.log('\n=== User 데이터 ===');
            console.log(`Nickname: ${user.nickname || user.username || 'Unknown'}`);
            console.log(`Discord ID: ${user.discordId}`);
            console.log(`Gold: ${user.gold}`);
        } else {
            console.log('\n이 유저는 User 컬렉션에 없습니다!');
        }
        
        const mission = await DailyMission.findOne({ userId });
        if (mission) {
            console.log('\n=== DailyMission 데이터 ===');
            console.log(`earnGold: ${mission.dailyMissions.earnGold.progress}/${mission.dailyMissions.earnGold.target}`);
            console.log(`마지막 리셋: ${mission.lastDailyReset}`);
        }
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

checkSpecificUser();