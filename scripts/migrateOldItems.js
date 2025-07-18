const mongoose = require('mongoose');
const User = require('../models/User');
const randomItemGenerator = require('../systems/randomItemGenerator');
require('dotenv').config();

async function migrateOldItems() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecobot');
        console.log('데이터베이스 연결 성공');

        // 모든 사용자 조회
        const users = await User.find({ 'inventory.0': { $exists: true } });
        console.log(`총 ${users.length}명의 사용자 발견`);

        let totalItemsUpdated = 0;
        let totalItemsSkipped = 0;

        for (const user of users) {
            console.log(`\n사용자 ${user.nickname || user.discordId} 처리 중...`);
            let userItemsUpdated = 0;
            let userItemsSkipped = 0;

            for (let i = 0; i < user.inventory.length; i++) {
                const item = user.inventory[i];
                
                // 이미 새로운 스탯을 가진 아이템은 건너뛰기
                if (item.stats && (
                    item.stats.strength > 0 || 
                    item.stats.agility > 0 || 
                    item.stats.intelligence > 0 || 
                    item.stats.vitality > 0
                )) {
                    userItemsSkipped++;
                    continue;
                }

                // 장비 아이템만 처리
                if (!['weapon', 'armor', 'helmet', 'gloves', 'boots', 'shield', 'accessory'].includes(item.type)) {
                    userItemsSkipped++;
                    continue;
                }

                // 기존 아이템 정보 백업
                const oldStats = { ...item.stats };
                const enhanceLevel = item.enhanceLevel || 0;

                // 아이템 재생성
                console.log(`  - ${item.name} 재생성 중...`);
                
                // 기존 아이템의 등급과 타입으로 새 스탯 생성
                const newOptions = randomItemGenerator.generateOptions(
                    item.rarity || 'normal', 
                    item.type,
                    user.emblem
                );

                // 새로운 stats 객체 생성
                const newStats = {};
                newOptions.forEach(opt => {
                    newStats[opt.key] = opt.value;
                });

                // 기존 스탯 유지 (attack, defense 등)
                if (oldStats.attack > 0) newStats.attack = oldStats.attack;
                if (oldStats.defense > 0) newStats.defense = oldStats.defense;
                if (oldStats.dodge > 0) newStats.dodge = oldStats.dodge;
                if (oldStats.luck > 0 && !newStats.luck) newStats.luck = oldStats.luck;

                // baseStats도 업데이트
                const baseStats = { ...newStats };

                // 강화가 되어 있었다면 강화 배율 적용
                if (enhanceLevel > 0) {
                    let totalMultiplier = 1;
                    for (let j = 1; j <= enhanceLevel; j++) {
                        if (j <= 5) totalMultiplier += 0.02;
                        else if (j <= 10) totalMultiplier += 0.03;
                        else if (j <= 15) totalMultiplier += 0.04;
                        else if (j <= 20) totalMultiplier += 0.05;
                        else if (j <= 25) totalMultiplier += 0.06;
                        else totalMultiplier += 0.07;
                    }

                    // 강화 배율 적용
                    for (const stat in newStats) {
                        newStats[stat] = Math.floor(baseStats[stat] * totalMultiplier);
                    }
                }

                // 아이템 업데이트
                user.inventory[i].stats = newStats;
                user.inventory[i].baseStats = baseStats;

                console.log(`    기존: ${JSON.stringify(oldStats)}`);
                console.log(`    신규: ${JSON.stringify(newStats)}`);
                
                userItemsUpdated++;
            }

            // 사용자 저장
            if (userItemsUpdated > 0) {
                await user.save();
                console.log(`  -> ${userItemsUpdated}개 아이템 업데이트, ${userItemsSkipped}개 건너뜀`);
            }

            totalItemsUpdated += userItemsUpdated;
            totalItemsSkipped += userItemsSkipped;
        }

        console.log('\n=== 마이그레이션 완료 ===');
        console.log(`총 ${totalItemsUpdated}개 아이템 업데이트`);
        console.log(`총 ${totalItemsSkipped}개 아이템 건너뜀`);

    } catch (error) {
        console.error('마이그레이션 중 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('데이터베이스 연결 종료');
    }
}

// 스크립트 실행
migrateOldItems();