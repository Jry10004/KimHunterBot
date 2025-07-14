const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkItemPrices() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 모든 유저의 아이템 가격 확인
        const users = await User.find({});
        let totalItems = 0;
        let noPriceItems = 0;
        let zeroPrice = 0;
        
        for (const user of users) {
            if (!user.inventory || user.inventory.length === 0) continue;
            
            console.log(`\n=== ${user.nickname || user.discordId} ===`);
            
            user.inventory.forEach((item, index) => {
                if (!item || !item.id) return;
                
                totalItems++;
                
                if (!item.price && item.price !== 0) {
                    noPriceItems++;
                    console.log(`[가격없음] ${item.name} (${item.rarity}) - price: undefined`);
                } else if (item.price === 0) {
                    zeroPrice++;
                    console.log(`[가격0원] ${item.name} (${item.rarity}) - price: 0`);
                }
                
                // 첫 5개만 샘플로 표시
                if (index < 5) {
                    const sellPriceValue = item.sellPrice !== undefined ? item.sellPrice : 'undefined';
                    console.log(`  ${item.name}: price=${item.price}, sellPrice=${sellPriceValue}`);
                }
            });
        }
        
        console.log('\n=== 통계 ===');
        console.log(`총 아이템: ${totalItems}개`);
        console.log(`가격 없음: ${noPriceItems}개`);
        console.log(`가격 0원: ${zeroPrice}개`);
        console.log(`정상 가격: ${totalItems - noPriceItems - zeroPrice}개`);
        
        // 가격이 없는 아이템들 수정
        if (noPriceItems > 0 || zeroPrice > 0) {
            console.log('\n가격이 없는 아이템들을 수정하시겠습니까? (수정 필요)');
        }
        
    } catch (error) {
        console.error('오류:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}

checkItemPrices();