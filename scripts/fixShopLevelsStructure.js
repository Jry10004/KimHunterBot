require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function fixShopLevelsStructure() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 모든 유저의 상점 레벨을 올바른 구조로 수정
        const defaultShopLevel = {
            level: 1,
            exp: 0,
            totalPulls: 0
        };

        const result = await User.updateMany(
            {},
            {
                $set: {
                    'shopLevels.weapon': defaultShopLevel,
                    'shopLevels.armor': defaultShopLevel,
                    'shopLevels.helmet': defaultShopLevel,
                    'shopLevels.gloves': defaultShopLevel,
                    'shopLevels.boots': defaultShopLevel,
                    'shopLevels.shield': defaultShopLevel,
                    'shopLevels.accessory': defaultShopLevel
                }
            }
        );

        console.log(`✅ ${result.modifiedCount}명의 유저 상점 레벨 구조가 수정되었습니다.`);

        // 수정 결과 확인
        const users = await User.find({}).select('username nickname shopLevels');
        console.log('\n📊 상점 레벨 수정 결과:');
        
        let successCount = 0;
        users.forEach(user => {
            const weapon = user.shopLevels?.weapon;
            const armor = user.shopLevels?.armor;
            
            if (weapon && typeof weapon === 'object' && weapon.level !== undefined) {
                successCount++;
                console.log(`✅ ${user.nickname || user.username}: 무기 Lv.${weapon.level}, 방어구 Lv.${armor?.level || 1}`);
            } else {
                console.log(`❌ ${user.nickname || user.username}: 수정 실패`);
            }
        });
        
        console.log(`\n✅ 총 ${successCount}/${users.length}명 수정 성공`);

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ 작업 완료');
    }
}

// 스크립트 실행
fixShopLevelsStructure();