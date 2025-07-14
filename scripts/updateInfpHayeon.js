const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function updateUsers() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/discordbot');
        console.log('MongoDB 연결 성공');
        
        // 인프 업데이트
        const infp = await User.findOne({ discordId: '592659577384730645' });
        if (infp) {
            console.log(`인프 현재 상태: 레벨 ${infp.level}, 경험치 ${infp.exp}`);
            infp.level = 33;
            infp.exp = 100;
            infp.statPoints = (infp.statPoints || 0) + 5; // 레벨업으로 스탯포인트 5점 추가
            await infp.save();
            console.log('인프 업데이트 완료: 레벨 33, 경험치 100, 스탯포인트 +5');
        } else {
            console.log('인프 유저를 찾을 수 없습니다.');
        }
        
        // 하연 업데이트
        const hayeon = await User.findOne({ discordId: '295980447849250817' });
        if (hayeon) {
            console.log(`하연 현재 관리자 권한: ${hayeon.isAdmin}`);
            hayeon.isAdmin = false;
            await hayeon.save();
            console.log('하연 관리자 권한 삭제 완료');
        } else {
            console.log('하연 유저를 찾을 수 없습니다.');
        }
        
        console.log('모든 업데이트 완료!');
        mongoose.connection.close();
    } catch (error) {
        console.error('오류 발생:', error);
        mongoose.connection.close();
    }
}

updateUsers();