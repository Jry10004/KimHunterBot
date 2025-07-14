const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function findUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // hayeon이 포함된 유저 찾기
        const users = await User.find({
            username: { $regex: 'hayeon', $options: 'i' }
        });
        
        console.log(`\nhayeon이 포함된 유저 수: ${users.length}`);
        users.forEach(user => {
            console.log(`\nUsername: ${user.username}`);
            console.log(`Discord ID: ${user.discordId}`);
            console.log(`Gold: ${user.gold}`);
            console.log(`Registered: ${user.registered}`);
        });
        
        // 최근 골드가 많은 유저들 확인
        const richUsers = await User.find({ gold: { $gt: 1000000 } })
            .sort({ gold: -1 })
            .limit(5);
            
        console.log('\n\n=== 골드 100만 이상 유저들 ===');
        richUsers.forEach(user => {
            console.log(`${user.username}: ${user.gold.toLocaleString()}G (ID: ${user.discordId})`);
        });
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

findUser();