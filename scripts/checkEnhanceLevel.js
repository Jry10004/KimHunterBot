const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function checkEnhanceLevel() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const users = await User.find({}).select('username discordId inventory');
    
    console.log('=== 사전강화 아이템 강화 레벨 확인 ===\n');
    
    users.forEach(user => {
        if (user.inventory && user.inventory.length > 0) {
            const prelaunchItems = user.inventory.filter(item => item.setName === 'prelaunch');
            
            if (prelaunchItems.length > 0) {
                console.log(`📦 ${user.username || user.discordId}:`);
                prelaunchItems.forEach(item => {
                    const enhanceLevel = item.enhanceLevel || item.enhanced || 0;
                    console.log(`   ${item.name} +${enhanceLevel}`);
                    console.log(`   - enhanceLevel: ${item.enhanceLevel}`);
                    console.log(`   - enhanced: ${item.enhanced}`);
                    console.log(`   - 공격력: ${item.stats?.attack || 0} + ${enhanceLevel * 10} = ${(item.stats?.attack || 0) + enhanceLevel * 10}`);
                });
                console.log('');
            }
        }
    });
    
    await mongoose.connection.close();
}

checkEnhanceLevel().catch(console.error);