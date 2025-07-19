require('dotenv').config();
const connectDB = require('../database/connection');
const User = require('../models/User');

async function findLargeInventoryUsers() {
    try {
        await connectDB();
        console.log('=== 대량 인벤토리 보유 유저 조회 ===\n');
        
        // 모든 유저 조회
        const users = await User.find({});
        
        // 인벤토리 크기별로 정렬
        const userInventories = users.map(user => ({
            discordId: user.discordId,
            nickname: user.nickname || '닉네임 없음',
            inventorySize: user.inventory ? user.inventory.length : 0,
            level: user.level,
            gold: user.gold,
            registeredAt: user.registeredAt
        })).sort((a, b) => b.inventorySize - a.inventorySize);
        
        console.log('🏆 인벤토리 크기 TOP 10:');
        console.log('================================');
        
        for (let i = 0; i < Math.min(10, userInventories.length); i++) {
            const user = userInventories[i];
            console.log(`${i + 1}. ${user.nickname} (${user.discordId})`);
            console.log(`   - 인벤토리: ${user.inventorySize.toLocaleString()}개`);
            console.log(`   - 레벨: ${user.level}`);
            console.log(`   - 골드: ${user.gold.toLocaleString()}`);
            console.log(`   - 가입일: ${user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('ko-KR') : '알 수 없음'}`);
            console.log('');
        }
        
        // 가장 많은 아이템을 가진 유저의 인벤토리 분석
        if (userInventories.length > 0 && userInventories[0].inventorySize > 1000) {
            const topUser = await User.findOne({ discordId: userInventories[0].discordId });
            
            console.log(`\n=== ${topUser.nickname}님의 인벤토리 분석 ===`);
            
            // 아이템 타입별 분류
            const itemTypes = {};
            const itemNames = {};
            
            topUser.inventory.forEach(item => {
                // 타입별 카운트
                itemTypes[item.type] = (itemTypes[item.type] || 0) + 1;
                
                // 이름별 카운트 (상위 10개만)
                const key = `${item.name} +${item.enhanceLevel || 0}`;
                itemNames[key] = (itemNames[key] || 0) + (item.quantity || 1);
            });
            
            console.log('\n📊 타입별 분포:');
            Object.entries(itemTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
                console.log(`   - ${type}: ${count.toLocaleString()}개`);
            });
            
            console.log('\n🔝 가장 많은 아이템 TOP 10:');
            Object.entries(itemNames)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .forEach(([name, count], index) => {
                    console.log(`   ${index + 1}. ${name}: ${count.toLocaleString()}개`);
                });
            
            // 중복 아이템 확인
            const duplicates = {};
            topUser.inventory.forEach(item => {
                const key = `${item.name}_${item.enhanceLevel || 0}`;
                if (!duplicates[key]) duplicates[key] = [];
                duplicates[key].push(item);
            });
            
            const duplicateItems = Object.entries(duplicates).filter(([, items]) => items.length > 1);
            console.log(`\n⚠️  중복 아이템 종류: ${duplicateItems.length}개`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('오류:', error);
        process.exit(1);
    }
}

findLargeInventoryUsers();