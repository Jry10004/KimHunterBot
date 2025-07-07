const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function checkInventoryData() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const users = await User.find({}).select('username discordId inventory equipment');
    
    console.log('=== 인벤토리 및 장비 데이터 확인 ===');
    
    let totalOldItems = 0;
    let totalNewItems = 0;
    
    users.forEach(user => {
        if (user.inventory && user.inventory.length > 0) {
            console.log(`\n📦 ${user.username || user.discordId}:`);
            console.log(`   총 아이템: ${user.inventory.length}개`);
            
            // 아이템 타입별 분류
            let oldItems = [];
            let newItems = [];
            
            user.inventory.forEach((item, idx) => {
                // setName으로 구분
                if (item.setName && item.setName !== 'random') {
                    oldItems.push({ idx, item });
                } else {
                    newItems.push({ idx, item });
                }
            });
            
            if (oldItems.length > 0) {
                console.log(`   🔴 구 아이템: ${oldItems.length}개`);
                oldItems.slice(0, 3).forEach(({ idx, item }) => {
                    console.log(`      [${idx}] ${item.name} (setName: ${item.setName})`);
                });
                if (oldItems.length > 3) {
                    console.log(`      ... 외 ${oldItems.length - 3}개`);
                }
            }
            
            if (newItems.length > 0) {
                console.log(`   🟢 신규 랜덤 아이템: ${newItems.length}개`);
                newItems.slice(0, 3).forEach(({ idx, item }) => {
                    console.log(`      [${idx}] ${item.name} (점수: ${item.score || '없음'})`);
                });
                if (newItems.length > 3) {
                    console.log(`      ... 외 ${newItems.length - 3}개`);
                }
            }
            
            // 장착 상태 확인
            if (user.equipment) {
                console.log(`   ⚔️ 장착 상태:`);
                Object.entries(user.equipment).forEach(([slot, idx]) => {
                    if (idx >= 0 && user.inventory[idx]) {
                        console.log(`      ${slot}: [${idx}] ${user.inventory[idx].name}`);
                    }
                });
            }
            
            totalOldItems += oldItems.length;
            totalNewItems += newItems.length;
        }
    });
    
    console.log('\n=== 전체 통계 ===');
    console.log(`구 아이템: ${totalOldItems}개`);
    console.log(`신규 랜덤 아이템: ${totalNewItems}개`);
    console.log(`총 아이템: ${totalOldItems + totalNewItems}개`);
    
    await mongoose.connection.close();
}

checkInventoryData().catch(console.error);