const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkInventories() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        const users = await User.find({});
        console.log(`\n총 ${users.length}명의 유저를 검사합니다.`);
        
        for (const user of users) {
            if (user.inventory && user.inventory.length > 0) {
                console.log(`\n${user.nickname || user.discordId}: ${user.inventory.length}개 아이템 보유`);
                
                // 장착된 아이템 확인
                if (user.equipment) {
                    console.log('장착 장비:');
                    for (const [slot, index] of Object.entries(user.equipment)) {
                        if (index >= 0) {
                            const item = user.inventory[index];
                            if (item) {
                                console.log(`  ${slot}: [${index}] ${item.name} (inventorySlot: ${item.inventorySlot})`);
                            } else {
                                console.log(`  ${slot}: [${index}] 아이템을 찾을 수 없음`);
                            }
                        }
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

// 즉시 실행
checkInventories();