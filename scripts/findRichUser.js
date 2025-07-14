const mongoose = require('mongoose');
const User = require('../models/User');
const DailyMission = require('../models/DailyMission');
require('dotenv').config();

async function findRichUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 모든 유저를 골드 순으로 정렬
        const allUsers = await User.find()
            .sort({ gold: -1 });
            
        console.log('\n=== 전체 유저 골드 순위 ===');
        for (let i = 0; i < allUsers.length; i++) {
            const user = allUsers[i];
            console.log(`${i+1}. ${user.nickname || user.username || 'Unknown'} (ID: ${user.discordId}): ${user.gold.toLocaleString()}G`);
            
            // 1000만 골드 이상인 유저의 미션 확인
            if (user.gold >= 10000000) {
                const mission = await DailyMission.findOne({ userId: user.discordId });
                if (mission) {
                    console.log(`   └─ 골드 미션: ${mission.dailyMissions.earnGold.progress}/${mission.dailyMissions.earnGold.target}`);
                } else {
                    console.log(`   └─ 미션 데이터 없음`);
                }
            }
        }
        
        // 닉네임에 'hayeon'이 포함된 유저 찾기
        const hayeonUsers = await User.find({
            $or: [
                { nickname: { $regex: 'hayeon', $options: 'i' } },
                { username: { $regex: 'hayeon', $options: 'i' } }
            ]
        });
        
        if (hayeonUsers.length > 0) {
            console.log('\n=== hayeon이 포함된 유저들 ===');
            hayeonUsers.forEach(user => {
                console.log(`${user.nickname || user.username} (ID: ${user.discordId}): ${user.gold.toLocaleString()}G`);
            });
        }
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

findRichUser();