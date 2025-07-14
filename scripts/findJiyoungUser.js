const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function findJiyoungUser() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 지영과 유사한 닉네임 검색
        const users = await User.find({
            nickname: { $regex: /지영|jiyoung|ji young/i }
        });
        
        console.log(`\n지영과 관련된 유저 ${users.length}명 발견:`);
        
        users.forEach(user => {
            console.log(`- 닉네임: ${user.nickname}, Discord ID: ${user.discordId}, 레벨: ${user.level}`);
        });
        
        // 만약 못 찾았다면 최근 활동한 상위 유저들 확인
        if (users.length === 0) {
            console.log('\n지영 닉네임을 찾을 수 없어 레벨 높은 유저 10명을 확인합니다:');
            const topUsers = await User.find({ registered: true })
                .sort({ level: -1 })
                .limit(10)
                .select('nickname discordId level gold');
                
            topUsers.forEach(user => {
                console.log(`- 닉네임: ${user.nickname}, 레벨: ${user.level}, 골드: ${user.gold.toLocaleString()}G`);
            });
        }
        
    } catch (error) {
        console.error('에러 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}

findJiyoungUser();