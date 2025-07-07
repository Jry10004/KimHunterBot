const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function checkNicknames() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const users = await User.find({}).select('username discordId nickname');
    
    console.log('=== 유저 닉네임 확인 ===\n');
    
    users.forEach(user => {
        console.log(`Discord ID: ${user.discordId}`);
        console.log(`Discord Username: ${user.username || '없음'}`);
        console.log(`게임 닉네임: ${user.nickname || '설정안됨'}`);
        console.log('---');
    });
    
    await mongoose.connection.close();
}

checkNicknames().catch(console.error);