require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function debugEquipment() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 특정 유저의 장비 상태 확인 (모든 유저를 확인하려면 수정 가능)
        const users = await User.find({ registered: true }).limit(5); // 처음 5명만 확인

        console.log('\n📊 유저별 장비 상태 디버깅:');
        
        for (const user of users) {
            console.log(`\n👤 ${user.nickname || user.username} (레벨 ${user.level})`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // equipment 필드 확인
            if (!user.equipment) {
                console.log('❌ equipment 필드가 없음');
            } else {
                console.log('✅ equipment 필드 존재:', JSON.stringify(user.equipment, null, 2));
            }
            
            // 인벤토리 아이템 중 장착 가능한 아이템 확인
            if (user.inventory && user.inventory.length > 0) {
                const equipableItems = user.inventory.filter(item => 
                    ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory', 'shield'].includes(item.type)
                );
                
                console.log(`\n📦 장착 가능한 아이템: ${equipableItems.length}개`);
                equipableItems.slice(0, 5).forEach((item, index) => {
                    console.log(`  ${index + 1}. ${item.name} (${item.type}) - 인덱스: ${user.inventory.indexOf(item)}`);
                });
            } else {
                console.log('📦 인벤토리가 비어있음');
            }
            
            // 스탯 포인트 확인
            console.log(`\n💎 스탯 포인트: ${user.statPoints || 0}`);
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ 작업 완료');
    }
}

// 스크립트 실행
debugEquipment();