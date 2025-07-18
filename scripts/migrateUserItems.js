const mongoose = require('mongoose');
const User = require('../models/User');
const randomItemGenerator = require('../systems/randomItemGenerator');
require('dotenv').config();

async function migrateUserItems(discordId) {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecobot');
        console.log('데이터베이스 연결 성공');

        // 특정 사용자 조회
        const user = await User.findOne({ discordId: discordId });
        if (!user) {
            console.log('사용자를 찾을 수 없습니다.');
            return;
        }

        console.log(`사용자 ${user.nickname || user.discordId} 발견`);
        console.log(`인벤토리 아이템 수: ${user.inventory.length}`);

        let itemsUpdated = 0;
        let itemsSkipped = 0;

        for (let i = 0; i < user.inventory.length; i++) {
            const item = user.inventory[i];
            
            console.log(`\n[${i+1}/${user.inventory.length}] ${item.name}`);
            console.log(`  타입: ${item.type}, 등급: ${item.rarity}`);
            console.log(`  현재 스탯:`, item.stats);

            // 이미 새로운 스탯을 가진 아이템은 건너뛰기
            if (item.stats && (
                item.stats.strength > 0 || 
                item.stats.agility > 0 || 
                item.stats.intelligence > 0 || 
                item.stats.vitality > 0
            )) {
                console.log('  -> 이미 새 스탯을 가지고 있음, 건너뜀');
                itemsSkipped++;
                continue;
            }

            // 장비 아이템만 처리
            if (!['weapon', 'armor', 'helmet', 'gloves', 'boots', 'shield', 'accessory'].includes(item.type)) {
                console.log('  -> 장비 아이템이 아님, 건너뜀');
                itemsSkipped++;
                continue;
            }

            // 업데이트 여부 확인
            console.log('  이 아이템을 업데이트하시겠습니까? (y/n/all)');
            // 실제로는 자동으로 처리하도록 설정
            const answer = 'y'; // 또는 명령줄 인자로 받을 수 있음

            if (answer === 'n') {
                itemsSkipped++;
                continue;
            }

            // 기존 아이템 정보 백업
            const oldStats = { ...item.stats };
            const enhanceLevel = item.enhanceLevel || 0;

            // 아이템 재생성
            console.log('  재생성 중...');
            
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

            // 기존 주요 스탯은 유지하되, 더 높은 값이면 유지
            if (oldStats.attack && (!newStats.attack || oldStats.attack > newStats.attack)) {
                newStats.attack = oldStats.attack;
            }
            if (oldStats.defense && (!newStats.defense || oldStats.defense > newStats.defense)) {
                newStats.defense = oldStats.defense;
            }

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

            console.log('  기존 스탯:', oldStats);
            console.log('  새 스탯:', newStats);
            
            itemsUpdated++;
        }

        // 사용자 저장
        if (itemsUpdated > 0) {
            await user.save();
            console.log(`\n✅ ${itemsUpdated}개 아이템 업데이트 완료`);
        } else {
            console.log('\n업데이트할 아이템이 없습니다.');
        }
        
        console.log(`📊 총 ${itemsSkipped}개 아이템 건너뜀`);

    } catch (error) {
        console.error('마이그레이션 중 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('데이터베이스 연결 종료');
    }
}

// 명령줄 인자로 Discord ID 받기
const discordId = process.argv[2];
if (!discordId) {
    console.log('사용법: node migrateUserItems.js <Discord ID>');
    console.log('예시: node migrateUserItems.js 123456789012345678');
    process.exit(1);
}

// 스크립트 실행
migrateUserItems(discordId);