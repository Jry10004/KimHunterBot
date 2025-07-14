const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function verifyItemSellPrices() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 하연 유저 데이터 직접 확인
        const user = await User.findOne({ discordId: '295980447849250817' });
        
        if (user && user.inventory && user.inventory.length > 0) {
            console.log('\n=== 하연 인벤토리 첫 10개 아이템 ===');
            for (let i = 0; i < Math.min(10, user.inventory.length); i++) {
                const item = user.inventory[i];
                console.log(`${i+1}. ${item.name}`);
                console.log(`   - price: ${item.price}`);
                console.log(`   - sellPrice: ${item.sellPrice}`);
                console.log(`   - _id: ${item._id}`);
                console.log(`   - 전체 필드:`, Object.keys(item.toObject ? item.toObject() : item));
            }
            
            // sellPrice가 없는 아이템 찾기
            const noSellPrice = user.inventory.filter(item => !item.sellPrice && item.sellPrice !== 0);
            console.log(`\nsellPrice 없는 아이템: ${noSellPrice.length}개`);
        }
        
    } catch (error) {
        console.error('오류:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}

verifyItemSellPrices();