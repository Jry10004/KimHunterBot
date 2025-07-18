// 기존 유저 인벤토리 아이템에 baseStats 추가하는 마이그레이션 스크립트

const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// 강화 시스템 설정
const ENHANCE_SYSTEM = {
    statIncrease: {
        tier1: { main: 0.10, sub: 0.05 },  // 1~10계급
        tier2: { main: 0.15, sub: 0.075 }, // 11~20계급  
        tier3: { main: 0.20, sub: 0.10 }   // 21~30계급
    },
    mainStatByType: {
        weapon: ['attack'],
        armor: ['defense'],
        helmet: ['defense', 'hp'],
        gloves: ['attack', 'dodge'],
        boots: ['dodge', 'agility'],
        shield: ['defense', 'hp'],
        accessory: ['luck', 'strength', 'agility', 'intelligence', 'vitality']
    }
};

async function migrateBaseStats() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your_database', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB 연결 성공');

        // 모든 유저 조회
        const users = await User.find({});
        console.log(`총 ${users.length}명의 유저 데이터를 마이그레이션합니다.`);

        let migratedCount = 0;
        let itemCount = 0;

        for (const user of users) {
            let needsSave = false;

            // 인벤토리 아이템 확인
            if (user.inventory && user.inventory.length > 0) {
                for (const item of user.inventory) {
                    // baseStats가 없는 아이템만 처리
                    if (!item.baseStats && item.stats) {
                        needsSave = true;
                        itemCount++;

                        const itemType = item.type || 'weapon';
                        const mainStats = ENHANCE_SYSTEM.mainStatByType[itemType] || ['attack'];
                        const currentLevel = item.enhanceLevel || 0;

                        if (currentLevel === 0) {
                            // 강화가 안된 아이템은 현재 스탯이 원본
                            item.baseStats = { ...item.stats };
                        } else {
                            // 이미 강화된 아이템은 역산해서 원본 구하기
                            item.baseStats = {};
                            
                            Object.keys(item.stats).forEach(stat => {
                                if (item.stats[stat] > 0) {
                                    const isMainStat = mainStats.includes(stat);
                                    
                                    // 현재 레벨까지의 누적 증가율 계산
                                    let totalMultiplier = 1;
                                    for (let level = 1; level <= currentLevel; level++) {
                                        let levelRate;
                                        if (level <= 10) {
                                            levelRate = ENHANCE_SYSTEM.statIncrease.tier1;
                                        } else if (level <= 20) {
                                            levelRate = ENHANCE_SYSTEM.statIncrease.tier2;
                                        } else {
                                            levelRate = ENHANCE_SYSTEM.statIncrease.tier3;
                                        }
                                        const rate = isMainStat ? levelRate.main : levelRate.sub;
                                        totalMultiplier += rate;
                                    }
                                    
                                    // 역산하여 원본 스탯 구하기
                                    item.baseStats[stat] = Math.round(item.stats[stat] / totalMultiplier);
                                }
                            });
                        }

                        console.log(`[${user.nickname || user.discordId}] ${item.name} (+${currentLevel}) baseStats 추가`);
                    }
                }
            }

            // equippedAccessories 확인
            if (user.equippedAccessories) {
                for (const [slot, accessory] of Object.entries(user.equippedAccessories)) {
                    if (accessory && !accessory.baseStats && accessory.stats) {
                        needsSave = true;
                        itemCount++;

                        const mainStats = ENHANCE_SYSTEM.mainStatByType.accessory;
                        const currentLevel = accessory.enhanceLevel || 0;

                        if (currentLevel === 0) {
                            accessory.baseStats = { ...accessory.stats };
                        } else {
                            accessory.baseStats = {};
                            
                            Object.keys(accessory.stats).forEach(stat => {
                                if (accessory.stats[stat] > 0) {
                                    const isMainStat = mainStats.includes(stat);
                                    
                                    let totalMultiplier = 1;
                                    for (let level = 1; level <= currentLevel; level++) {
                                        let levelRate;
                                        if (level <= 10) {
                                            levelRate = ENHANCE_SYSTEM.statIncrease.tier1;
                                        } else if (level <= 20) {
                                            levelRate = ENHANCE_SYSTEM.statIncrease.tier2;
                                        } else {
                                            levelRate = ENHANCE_SYSTEM.statIncrease.tier3;
                                        }
                                        const rate = isMainStat ? levelRate.main : levelRate.sub;
                                        totalMultiplier += rate;
                                    }
                                    
                                    accessory.baseStats[stat] = Math.round(accessory.stats[stat] / totalMultiplier);
                                }
                            });
                        }

                        console.log(`[${user.nickname || user.discordId}] 장착된 ${accessory.name} (+${currentLevel}) baseStats 추가`);
                    }
                }
            }

            if (needsSave) {
                await user.save();
                migratedCount++;
            }
        }

        console.log(`\n마이그레이션 완료!`);
        console.log(`- 총 ${migratedCount}명의 유저 데이터 수정`);
        console.log(`- 총 ${itemCount}개의 아이템에 baseStats 추가`);

    } catch (error) {
        console.error('마이그레이션 중 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB 연결 종료');
    }
}

// 스크립트 실행
migrateBaseStats();