const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

async function checkHayeonData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('=== 하연94 사전강화 데이터 확인 ===');
        
        // 하연94 유저 찾기
        const hayeon = await User.findOne({ discordId: '295980447849250817' });
        
        if (hayeon) {
            console.log('유저명:', hayeon.username || '없음');
            console.log('닉네임:', hayeon.nickname || '없음');
            console.log('골드:', hayeon.gold || 0);
            
            // 인벤토리에서 사전강화 아이템 찾기
            if (hayeon.inventory && hayeon.inventory.length > 0) {
                console.log('\n인벤토리 아이템:');
                hayeon.inventory.forEach((item, index) => {
                    if (item.setName === 'prelaunch' || item.name?.includes('전설의 무기')) {
                        console.log(`  ${index + 1}. ${item.name} +${item.enhanceLevel || item.enhanced || 0}`);
                    }
                });
            }
            
            // 백업에서 최고 레벨 찾기 시도
            console.log('\n사전강화 관련 데이터 검색 중...');
            
        } else {
            console.log('하연94 유저를 찾을 수 없습니다.');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// 실행
checkHayeonData();