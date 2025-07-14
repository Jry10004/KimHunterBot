const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function debugAccessoryEquip() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');

        // 악세사리를 가진 유저 찾기
        const users = await User.find({
            'inventory': {
                $elemMatch: {
                    $or: [
                        { type: 'accessory' },
                        { type: 'shield' }
                    ]
                }
            }
        }).limit(5);

        console.log(`\n악세사리/방패를 가진 유저 ${users.length}명 발견\n`);

        for (const user of users) {
            console.log(`========================================`);
            console.log(`유저: ${user.nickname || user.discordId}`);
            console.log(`equipment.accessory: ${user.equipment?.accessory}`);
            
            // 악세사리/방패 아이템 찾기
            const accessories = user.inventory.filter(item => 
                item.type === 'accessory' || item.type === 'shield'
            );
            
            console.log(`\n악세사리/방패 아이템 (${accessories.length}개):`);
            accessories.forEach((item, idx) => {
                const inventoryIndex = user.inventory.findIndex(i => i === item);
                console.log(`  ${idx + 1}. ${item.name}`);
                console.log(`     - type: ${item.type}`);
                console.log(`     - inventorySlot: ${item.inventorySlot}`);
                console.log(`     - 실제 인덱스: ${inventoryIndex}`);
                console.log(`     - equipped: ${item.equipped}`);
                console.log(`     - rarity: ${item.rarity}`);
                if (item.stats) {
                    console.log(`     - stats:`, item.stats);
                }
            });
            
            // 현재 장착된 악세사리 확인
            if (user.equipment?.accessory >= 0) {
                console.log(`\n현재 장착된 악세사리 (슬롯 값: ${user.equipment.accessory}):`);
                
                // inventorySlot으로 찾기
                const equippedBySlot = user.inventory.find(item => 
                    item.inventorySlot === user.equipment.accessory
                );
                
                // 인덱스로 찾기
                const equippedByIndex = user.inventory[user.equipment.accessory];
                
                if (equippedBySlot) {
                    console.log(`  - inventorySlot으로 찾음: ${equippedBySlot.name}`);
                } else if (equippedByIndex) {
                    console.log(`  - 인덱스로 찾음: ${equippedByIndex.name}`);
                } else {
                    console.log(`  - 아이템을 찾을 수 없음!`);
                }
            } else {
                console.log(`\n악세사리 미장착`);
            }
            
            console.log('');
        }

        // 장비 슬롯 통계
        const stats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    withAccessoryEquipped: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $ne: ['$equipment.accessory', null] },
                                    { $ne: ['$equipment.accessory', -1] },
                                    { $gte: ['$equipment.accessory', 0] }
                                ]},
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        if (stats.length > 0) {
            console.log(`\n========================================`);
            console.log(`전체 통계:`);
            console.log(`- 총 유저 수: ${stats[0].totalUsers}`);
            console.log(`- 악세사리 장착 유저: ${stats[0].withAccessoryEquipped}`);
            console.log(`- 장착률: ${((stats[0].withAccessoryEquipped / stats[0].totalUsers) * 100).toFixed(2)}%`);
        }

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n연결 종료');
    }
}

// 스크립트 실행
debugAccessoryEquip();