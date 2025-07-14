const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function resetAllStatsNew() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        const users = await User.find({});
        console.log(`\n총 ${users.length}명의 유저 스텟을 초기화합니다.`);
        
        let resetCount = 0;
        
        for (const user of users) {
            // 스텟 초기화
            user.stats = {
                strength: 10,
                agility: 10,
                intelligence: 10,
                vitality: 10,
                luck: 10
            };
            
            // 레벨에 따른 스텟포인트 재지급 (레벨-1) * 5
            const levelStatPoints = (user.level - 1) * 5;
            user.statPoints = levelStatPoints;
            
            await user.save();
            
            console.log(`✅ ${user.nickname || user.discordId}: Lv.${user.level}, 스텟포인트: ${user.statPoints}p`);
            resetCount++;
        }
        
        console.log(`\n✅ 총 ${resetCount}명의 유저 스텟이 초기화되었습니다.`);
        console.log('모든 유저가 레벨에 따른 스텟포인트를 다시 받았습니다.');
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

// 즉시 실행
resetAllStatsNew();