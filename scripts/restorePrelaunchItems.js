const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const prelaunchData = require('../prelaunchEventData.json');

// 사전강화 아이템 정의
const PRELAUNCH_ITEMS = {
    "🗡️ 나무 검": {
        name: "🗡️ 나무 검",
        type: "weapon",
        rarity: "일반",
        stats: {
            attack: 10
        },
        description: "초보자용 나무 검입니다.",
        price: 1000,
        setName: "prelaunch",
        enhanceLevel: 0
    },
    "🔩 철 검": {
        name: "🔩 철 검",
        type: "weapon",
        rarity: "고급",
        stats: {
            attack: 20
        },
        description: "단단한 철로 만든 검입니다.",
        price: 5000,
        setName: "prelaunch",
        enhanceLevel: 0
    },
    "🔥 화염의 대검": {
        name: "🔥 화염의 대검",
        type: "weapon",
        rarity: "레어",
        stats: {
            attack: 35
        },
        description: "불타는 화염의 힘이 깃든 대검입니다.",
        price: 20000,
        setName: "prelaunch",
        enhanceLevel: 0
    },
    "⚡ 번개의 창": {
        name: "⚡ 번개의 창",
        type: "weapon",
        rarity: "에픽",
        stats: {
            attack: 50
        },
        description: "번개의 힘이 깃든 창입니다.",
        price: 50000,
        setName: "prelaunch",
        enhanceLevel: 0
    },
    "🌟 전설의 무기": {
        name: "🌟 전설의 무기",
        type: "weapon",
        rarity: "레전드리",
        stats: {
            attack: 100
        },
        description: "전설로 전해지는 강력한 무기입니다.",
        price: 200000,
        setName: "prelaunch",
        enhanceLevel: 0
    }
};

async function restorePrelaunchItems() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('=== 사전강화 이벤트 아이템 복구 시작 ===');
        
        let totalRestored = 0;
        let totalUsers = 0;
        
        // 사전강화 이벤트 참여자들 처리
        for (const [discordId, eventData] of Object.entries(prelaunchData)) {
            if (eventData.currentItem) {
                const user = await User.findOne({ discordId });
                
                if (user) {
                    // 현재 아이템 찾기
                    const itemTemplate = PRELAUNCH_ITEMS[eventData.currentItem.name];
                    
                    if (itemTemplate) {
                        // 강화 레벨이 적용된 아이템 생성
                        const restoredItem = {
                            ...itemTemplate,
                            id: `prelaunch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                            enhanceLevel: eventData.currentLevel || 0,
                            enhanced: eventData.currentLevel || 0 // 호환성을 위해 둘 다 저장
                        };
                        
                        // 인벤토리가 없으면 생성
                        if (!user.inventory) {
                            user.inventory = [];
                        }
                        
                        // 아이템 추가
                        user.inventory.push(restoredItem);
                        
                        await user.save();
                        
                        console.log(`✅ ${user.username || discordId}: ${restoredItem.name} +${restoredItem.enhanceLevel} 복구됨`);
                        totalRestored++;
                        totalUsers++;
                    }
                }
            }
        }
        
        console.log('\n=== 복구 완료 ===');
        console.log(`총 ${totalUsers}명의 유저에게 ${totalRestored}개의 사전강화 아이템이 복구되었습니다.`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// 실행
restorePrelaunchItems();