const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function fixInventorySlots() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        const users = await User.find({});
        console.log(`\n총 ${users.length}명의 유저 인벤토리를 검사합니다.`);
        
        let fixedCount = 0;
        
        for (const user of users) {
            if (user.inventory && user.inventory.length > 0) {
                let modified = false;
                
                // 각 아이템에 inventorySlot 설정
                user.inventory.forEach((item, index) => {
                    if (item && (!item.inventorySlot && item.inventorySlot !== 0)) {
                        item.inventorySlot = index;
                        modified = true;
                    }
                });
                
                if (modified) {
                    user.markModified('inventory');
                    await user.save();
                    fixedCount++;
                    console.log(`✅ ${user.nickname || user.discordId}: ${user.inventory.length}개 아이템의 inventorySlot 설정 완료`);
                }
            }
        }
        
        console.log(`\n✅ 총 ${fixedCount}명의 유저 인벤토리가 수정되었습니다.`);
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

// 즉시 실행
fixInventorySlots();