const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function initDungeonTickets() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        const users = await User.find({});
        console.log(`\n총 ${users.length}명의 유저를 검사합니다.`);
        
        let updateCount = 0;
        
        for (const user of users) {
            let updated = false;
            
            // 던전 티켓이 없으면 초기화
            if (user.dungeonTickets === undefined || user.dungeonTickets === null) {
                user.dungeonTickets = 5;
                updated = true;
            }
            
            // 던전 티켓 재생성 시간이 없으면 초기화
            if (!user.lastDungeonTicketRegen) {
                user.lastDungeonTicketRegen = new Date();
                updated = true;
            }
            
            if (updated) {
                await user.save();
                updateCount++;
                console.log(`✅ ${user.nickname || user.discordId}: 던전 티켓 ${user.dungeonTickets}개로 초기화`);
            }
        }
        
        console.log(`\n✅ 총 ${updateCount}명의 유저 던전 티켓이 초기화되었습니다.`);
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

// 즉시 실행
initDungeonTickets();