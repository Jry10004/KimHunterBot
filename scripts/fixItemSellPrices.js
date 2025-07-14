const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function fixItemSellPrices() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 모든 유저의 아이템 가격 수정
        const users = await User.find({});
        let totalFixed = 0;
        let totalItems = 0;
        
        for (const user of users) {
            if (!user.inventory || user.inventory.length === 0) continue;
            
            let userFixed = 0;
            
            for (let i = 0; i < user.inventory.length; i++) {
                const item = user.inventory[i];
                if (!item || !item.id) continue;
                
                totalItems++;
                
                // sellPrice가 없거나 0인 경우 수정
                if (!item.sellPrice || item.sellPrice === 0) {
                    user.inventory[i].sellPrice = Math.floor((item.price || 0) * 0.3);
                    userFixed++;
                    totalFixed++;
                }
            }
            
            if (userFixed > 0) {
                await user.save();
                console.log(`${user.nickname || user.discordId}: ${userFixed}개 아이템 수정됨`);
            }
        }
        
        console.log('\n=== 완료 ===');
        console.log(`총 아이템: ${totalItems}개`);
        console.log(`수정된 아이템: ${totalFixed}개`);
        
    } catch (error) {
        console.error('오류:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}

fixItemSellPrices();