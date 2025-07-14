const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function fixNegativeGold() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gamebot');
        console.log('DB 연결 성공');
        
        // 인프 유저 확인
        const infp = await User.findOne({ nickname: '인프' });
        if (infp) {
            console.log('\n인프 유저 상태:');
            console.log('- 닉네임:', infp.nickname);
            console.log('- 현재 골드:', infp.gold);
            console.log('- 레벨:', infp.level);
            
            if (infp.gold < 0) {
                console.log('\n골드가 마이너스입니다! 0으로 초기화합니다.');
                infp.gold = 0;
                await infp.save();
                console.log('골드가 0으로 초기화되었습니다.');
            }
        } else {
            console.log('인프 유저를 찾을 수 없습니다.');
        }
        
        // 모든 마이너스 골드 유저 확인
        const negativeUsers = await User.find({ gold: { $lt: 0 } });
        if (negativeUsers.length > 0) {
            console.log('\n마이너스 골드 유저들:', negativeUsers.length, '명');
            for (const user of negativeUsers) {
                console.log(`- ${user.nickname}: ${user.gold}G`);
                user.gold = 0;
                await user.save();
            }
            console.log('\n모든 마이너스 골드가 0으로 초기화되었습니다.');
        } else {
            console.log('\n마이너스 골드 유저가 없습니다.');
        }
        
        console.log('\n작업 완료!');
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('DB 연결 종료');
    }
}

fixNegativeGold();