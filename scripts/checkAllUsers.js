const mongoose = require('mongoose');
const User = require('../models/User');
const DailyMission = require('../models/DailyMission');
require('dotenv').config();

async function checkAllUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 전체 유저 수
        const totalUsers = await User.countDocuments();
        console.log(`\n전체 User 문서 수: ${totalUsers}`);
        
        // 최근 생성된 유저들
        const recentUsers = await User.find()
            .sort({ _id: -1 })
            .limit(10);
            
        console.log('\n최근 생성된 유저들:');
        recentUsers.forEach(user => {
            console.log(`- ${user.nickname || user.username || 'Unknown'} (ID: ${user.discordId}, Gold: ${user.gold})`);
        });
        
        // 골드가 1000만 이상인 유저 찾기
        const richUser = await User.findOne({ gold: { $gte: 10000000 } });
        if (richUser) {
            console.log(`\n골드 1000만 이상 유저 발견:`);
            console.log(`Nickname: ${richUser.nickname || richUser.username}`);
            console.log(`Discord ID: ${richUser.discordId}`);
            console.log(`Gold: ${richUser.gold.toLocaleString()}`);
            
            // 이 유저의 미션 데이터 확인
            const mission = await DailyMission.findOne({ userId: richUser.discordId });
            if (mission) {
                console.log('\n해당 유저의 미션 데이터:');
                console.log(`earnGold: ${mission.dailyMissions.earnGold.progress}/${mission.dailyMissions.earnGold.target}`);
            } else {
                console.log('\n해당 유저의 미션 데이터가 없습니다.');
            }
        }
        
        // discordId 형식 확인
        const sampleUser = await User.findOne();
        if (sampleUser) {
            console.log('\n샘플 유저의 discordId 형식:');
            console.log(`Type: ${typeof sampleUser.discordId}`);
            console.log(`Value: "${sampleUser.discordId}"`);
            console.log(`Length: ${sampleUser.discordId.length}`);
        }
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

checkAllUsers();