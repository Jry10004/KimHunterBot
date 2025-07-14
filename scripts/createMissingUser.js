const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createMissingUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        const userId = '1108024531286224947';
        
        // 이미 있는지 확인
        const existing = await User.findOne({ discordId: userId });
        if (existing) {
            console.log('이미 유저가 존재합니다.');
            return;
        }
        
        // 새 유저 생성
        const newUser = new User({
            discordId: userId,
            nickname: 'hayeon1130',  // 추정되는 닉네임
            gold: 10038625,  // 관리자가 지급한 후의 골드
            level: 1,
            exp: 0,
            registered: true,
            inventory: []
        });
        
        await newUser.save();
        console.log('✅ 유저 생성 완료!');
        console.log(`Discord ID: ${newUser.discordId}`);
        console.log(`Nickname: ${newUser.nickname}`);
        console.log(`Gold: ${newUser.gold}`);
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

// 실행 확인
console.log('이 스크립트는 User 데이터를 생성합니다. 계속하시겠습니까?');
console.log('실행하려면 주석을 해제하세요.');
// createMissingUser();