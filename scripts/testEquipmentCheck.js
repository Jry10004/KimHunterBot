const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function testEquipmentCheck() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 테스트할 유저들
        const testUsers = ['295980447849250817', '592659577384730645', '590922222361903135'];
        
        for (const userId of testUsers) {
            const user = await User.findOne({ discordId: userId });
            if (!user) continue;
            
            console.log(`\n=== ${user.nickname || userId} ===`);
            console.log('Equipment:', JSON.stringify(user.equipment, null, 2));
            
            // 장착된 아이템 확인
            for (const [slot, value] of Object.entries(user.equipment || {})) {
                if (value !== null && value !== undefined && value !== -1) {
                    console.log(`\n${slot}: ${value}`);
                    
                    // inventorySlot으로 찾기
                    const itemBySlot = user.inventory.find(item => item.inventorySlot === value);
                    if (itemBySlot) {
                        console.log(`  - inventorySlot으로 찾음: ${itemBySlot.name} (equipped: ${itemBySlot.equipped})`);
                    }
                    
                    // 인덱스로 찾기
                    const itemByIndex = user.inventory[value];
                    if (itemByIndex) {
                        console.log(`  - 인덱스로 찾음: ${itemByIndex.name} (equipped: ${itemByIndex.equipped})`);
                    }
                    
                    // 실제 장착된 아이템 찾기
                    const equippedItem = user.inventory.find(item => 
                        item.equipped === true && 
                        item.type === slot
                    );
                    if (equippedItem) {
                        console.log(`  - equipped=true로 찾음: ${equippedItem.name} (inventorySlot: ${equippedItem.inventorySlot})`);
                    }
                }
            }
            
            // 판매 가능한 아이템 테스트
            console.log('\n판매 가능한 아이템:');
            let sellableCount = 0;
            
            user.inventory.forEach((item, index) => {
                if (!item || !item.id) return;
                if (item.type === 'material' || item.fromMonster || item.fromArea) return;
                
                // 3가지 방법으로 장착 확인
                const isEquipped1 = Object.values(user.equipment || {}).some(slotIndex => 
                    slotIndex !== null && slotIndex !== undefined && slotIndex !== -1 && 
                    item.inventorySlot !== undefined && item.inventorySlot === slotIndex
                );
                
                const isEquipped2 = Object.values(user.equipment || {}).some(slotIndex => 
                    slotIndex !== null && slotIndex !== undefined && slotIndex === index
                );
                
                const isEquipped3 = item.equipped === true;
                
                if (!isEquipped1 && !isEquipped2 && !isEquipped3) {
                    sellableCount++;
                    if (sellableCount <= 5) {
                        console.log(`  - ${item.name} (${item.rarity}) - 판매 가능`);
                    }
                }
            });
            
            console.log(`총 판매 가능: ${sellableCount}개`);
        }
        
    } catch (error) {
        console.error('오류:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}

testEquipmentCheck();