// 티켓 초기화 스크립트
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function resetTickets() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');

        // 특정 유저 ID (필요시 변경)
        const userId = process.argv[2];
        
        if (userId) {
            // 특정 유저만 초기화
            const user = await User.findOne({ discordId: userId });
            if (user) {
                user.minigameTickets = {
                    tickets: 20,
                    lastRegen: null
                };
                await user.save();
                console.log(`${userId} 유저의 미니게임 티켓 초기화 완료`);
            } else {
                console.log('유저를 찾을 수 없습니다.');
            }
        } else {
            // 모든 유저 티켓 상태 확인
            const users = await User.find({ 'minigameTickets.tickets': { $lt: 20 } });
            console.log(`티켓이 20개 미만인 유저: ${users.length}명`);
            
            for (const user of users) {
                console.log(`- ${user.discordId}: ${user.minigameTickets?.tickets || 0}장, lastRegen: ${user.minigameTickets?.lastRegen}`);
            }
        }

    } catch (error) {
        console.error('오류:', error);
    } finally {
        await mongoose.connection.close();
        console.log('연결 종료');
    }
}

resetTickets();