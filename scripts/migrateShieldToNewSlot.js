const mongoose = require('mongoose');
const User = require('../models/User');

async function migrateShieldToNewSlot() {
    try {
        // .env 파일 로드
        require('dotenv').config();
        
        // MongoDB 연결
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kimhunter';
        await mongoose.connect(mongoUri);
        console.log('MongoDB 연결 성공');

        // 모든 유저 조회
        const users = await User.find({});
        let migratedCount = 0;
        let shieldCount = 0;

        for (const user of users) {
            let needsSave = false;

            // equipment.shield 필드가 없으면 추가
            if (user.equipment.shield === undefined) {
                user.equipment.shield = -1;
                needsSave = true;
            }

            // 인벤토리에서 방패 찾기
            const shields = user.inventory.filter(item => item && item.type === 'shield');
            if (shields.length > 0) {
                shieldCount += shields.length;
                console.log(`\n${user.nickname || user.discordId}: ${shields.length}개의 방패 보유`);
                shields.forEach(shield => {
                    console.log(`  - ${shield.name} (slot: ${shield.inventorySlot})`);
                });
            }

            // 악세사리 슬롯에 방패가 장착되어 있는지 확인
            if (user.equipment.accessory !== -1) {
                const equippedItem = user.inventory.find(item => 
                    item && item.inventorySlot === user.equipment.accessory
                );
                
                if (equippedItem && equippedItem.type === 'shield') {
                    console.log(`[마이그레이션] ${user.nickname || user.discordId}: 악세사리 슬롯의 방패를 방패 슬롯으로 이동`);
                    console.log(`  - 방패: ${equippedItem.name}`);
                    
                    // 방패를 shield 슬롯으로 이동
                    user.equipment.shield = user.equipment.accessory;
                    user.equipment.accessory = -1;
                    needsSave = true;
                    migratedCount++;
                }
            }

            if (needsSave) {
                await user.save();
            }
        }

        console.log('\n=== 마이그레이션 완료 ===');
        console.log(`총 ${users.length}명의 유저 처리`);
        console.log(`${migratedCount}명의 유저의 방패 슬롯 마이그레이션 완료`);
        console.log(`총 ${shieldCount}개의 방패 아이템 발견`);

    } catch (error) {
        console.error('마이그레이션 오류:', error);
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB 연결 종료');
    }
}

// 스크립트 실행
migrateShieldToNewSlot();