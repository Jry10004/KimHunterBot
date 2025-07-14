const mongoose = require('mongoose');
const User = require('../models/User');
const randomItemGenerator = require('../systems/randomItemGenerator');
require('dotenv').config();

async function testAccessoryEquip() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공\n');

        // 테스트용 악세사리 아이템 생성
        console.log('=== 악세사리 아이템 생성 테스트 ===');
        for (let i = 0; i < 5; i++) {
            const item = randomItemGenerator.generateItemBySlot('accessory', 'beginner');
            console.log(`${i + 1}. ${item.name}`);
            console.log(`   - 타입: ${item.type}`);
            console.log(`   - 희귀도: ${item.rarity}`);
            console.log(`   - 스탯:`, item.stats);
            console.log('');
        }

        // 테스트 유저 찾기 (악세사리를 가진 유저)
        const testUser = await User.findOne({
            'inventory': {
                $elemMatch: {
                    type: 'accessory'
                }
            }
        });

        if (testUser) {
            console.log('\n=== 실제 유저 악세사리 장착 테스트 ===');
            console.log(`유저: ${testUser.nickname || testUser.discordId}`);
            
            // 첫 번째 악세사리 찾기
            const accessory = testUser.inventory.find(item => item.type === 'accessory');
            if (accessory) {
                console.log(`\n악세사리 발견: ${accessory.name}`);
                console.log(`- inventorySlot: ${accessory.inventorySlot}`);
                
                // 실제 인덱스 찾기
                const index = testUser.inventory.findIndex(item => item === accessory);
                console.log(`- 실제 인덱스: ${index}`);
                
                // 장착 시뮬레이션
                const slotToUse = accessory.inventorySlot !== undefined ? accessory.inventorySlot : index;
                console.log(`\n장착 시뮬레이션:`);
                console.log(`- equipment.accessory에 설정할 값: ${slotToUse}`);
                
                // 실제로 장착
                testUser.equipment = testUser.equipment || {};
                testUser.equipment.accessory = slotToUse;
                await testUser.save();
                
                console.log(`- 장착 완료!`);
                
                // 다시 로드해서 확인
                const reloadedUser = await User.findOne({ _id: testUser._id });
                console.log(`\n재확인:`);
                console.log(`- equipment.accessory: ${reloadedUser.equipment.accessory}`);
                
                // 장착된 아이템 찾기
                const equippedItem = reloadedUser.inventory.find(item => 
                    item.inventorySlot === reloadedUser.equipment.accessory
                );
                
                if (equippedItem) {
                    console.log(`- 장착된 아이템: ${equippedItem.name} ✅`);
                } else {
                    console.log(`- 장착된 아이템을 찾을 수 없음 ❌`);
                }
            }
        } else {
            console.log('\n악세사리를 가진 유저를 찾을 수 없습니다.');
        }

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n연결 종료');
    }
}

// 스크립트 실행
testAccessoryEquip();