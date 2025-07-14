const mongoose = require('mongoose');
require('dotenv').config();

async function checkAccessoryIssue() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const User = require('../models/User');
        
        // 악세사리 타입 아이템을 가진 유저들 확인
        const users = await User.find({
            $or: [
                { 'inventory.type': 'accessory' },
                { 'inventory.type': 'shield' }
            ]
        }).limit(5);
        
        console.log(`악세사리/방패 아이템을 가진 유저: ${users.length}명\n`);
        
        for (const user of users) {
            console.log(`유저: ${user.nickname || user.discordId}`);
            console.log('장비 상태:', JSON.stringify(user.equipment, null, 2));
            
            // 악세사리 슬롯의 아이템 확인
            if (user.equipment.accessory >= 0) {
                const equippedItem = user.inventory.find(item => 
                    item.inventorySlot === user.equipment.accessory
                );
                if (equippedItem) {
                    console.log('현재 장착된 악세사리:');
                    console.log(`  - 이름: ${equippedItem.name}`);
                    console.log(`  - 타입: ${equippedItem.type}`);
                    console.log(`  - 슬롯: ${equippedItem.inventorySlot}`);
                } else {
                    console.log(`악세사리 슬롯 ${user.equipment.accessory}에 해당하는 아이템이 없습니다!`);
                    
                    // 인덱스로 찾아보기
                    const itemByIndex = user.inventory[user.equipment.accessory];
                    if (itemByIndex) {
                        console.log('인덱스로 찾은 아이템:');
                        console.log(`  - 이름: ${itemByIndex.name}`);
                        console.log(`  - 타입: ${itemByIndex.type}`);
                        console.log(`  - inventorySlot: ${itemByIndex.inventorySlot}`);
                    }
                }
            }
            
            console.log('\n인벤토리의 악세사리/방패 아이템:');
            const accessories = user.inventory.filter(item => 
                item.type === 'accessory' || item.type === 'shield'
            );
            
            accessories.forEach((item, idx) => {
                console.log(`  ${idx + 1}. ${item.name}`);
                console.log(`     - 타입: ${item.type}`);
                console.log(`     - inventorySlot: ${item.inventorySlot}`);
                console.log(`     - equipped: ${item.equipped}`);
            });
            
            console.log('\n---\n');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('오류:', error);
        process.exit(1);
    }
}

checkAccessoryIssue();