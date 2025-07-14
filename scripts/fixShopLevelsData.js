require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function fixShopLevelsData() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 완료');

        // 모든 유저 조회
        const users = await User.find({});
        console.log(`📊 총 ${users.length}명의 유저 데이터 확인 중...`);

        let fixedCount = 0;
        const slots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'shield', 'accessory'];

        for (const user of users) {
            let needsFix = false;

            // shopLevels가 없으면 초기화
            if (!user.shopLevels) {
                user.shopLevels = {};
                needsFix = true;
            }

            // 각 슬롯 확인 및 수정
            for (const slot of slots) {
                // 숫자로 저장된 경우나 객체가 아닌 경우 수정
                if (user.shopLevels[slot] && typeof user.shopLevels[slot] !== 'object') {
                    console.log(`🔧 ${user.nickname || user.discordId}: ${slot} 데이터 수정 (${user.shopLevels[slot]} → 객체)`);
                    user.shopLevels[slot] = { level: 1, exp: 0, totalPulls: 0 };
                    needsFix = true;
                }
                // 슬롯이 없으면 초기화
                else if (!user.shopLevels[slot]) {
                    user.shopLevels[slot] = { level: 1, exp: 0, totalPulls: 0 };
                    needsFix = true;
                }
            }

            if (needsFix) {
                await user.save();
                fixedCount++;
            }
        }

        console.log(`✅ 총 ${fixedCount}명의 유저 데이터 수정 완료`);
        
        // 검증
        const verifyUsers = await User.find({});
        let verifyFailed = 0;
        
        for (const user of verifyUsers) {
            for (const slot of slots) {
                if (!user.shopLevels || !user.shopLevels[slot] || typeof user.shopLevels[slot] !== 'object') {
                    console.log(`❌ 검증 실패: ${user.nickname || user.discordId} - ${slot}`);
                    verifyFailed++;
                }
            }
        }
        
        if (verifyFailed === 0) {
            console.log('✅ 모든 유저의 shopLevels 데이터 검증 완료!');
        } else {
            console.log(`⚠️ ${verifyFailed}개의 데이터 검증 실패`);
        }

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔒 MongoDB 연결 종료');
    }
}

// 스크립트 실행
fixShopLevelsData();