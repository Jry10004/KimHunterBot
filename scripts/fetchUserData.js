const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function fetchUserData() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/discord_bot');
        console.log('✅ MongoDB 연결 성공\n');

        // 검색할 사용자들
        const searchTargets = [
            { name: '인프', ids: ['1374702838541168650', '592659577384730645'] },
            { name: '하연', ids: ['295980447849250817'] }
        ];

        for (const target of searchTargets) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🔍 ${target.name} 유저 데이터 검색`);
            console.log('='.repeat(60));

            // 모든 가능한 ID로 검색
            for (const discordId of target.ids) {
                const user = await User.findOne({ discordId });
                
                if (user) {
                    console.log(`\n✅ 발견! Discord ID: ${discordId}`);
                    console.log('-'.repeat(40));
                    
                    // 기본 정보
                    console.log('📌 기본 정보:');
                    console.log(`  - 닉네임: ${user.nickname || '없음'}`);
                    console.log(`  - Discord ID: ${user.discordId}`);
                    console.log(`  - 레벨: ${user.level}`);
                    console.log(`  - 경험치: ${user.exp.toLocaleString()}`);
                    console.log(`  - 골드: ${user.gold.toLocaleString()}G`);
                    console.log(`  - 가입일: ${user.registeredAt || user.createdAt}`);
                    
                    // 스탯 정보
                    console.log('\n⚔️ 스탯:');
                    console.log(`  - 공격력: ${user.attack}`);
                    console.log(`  - 방어력: ${user.defense}`);
                    console.log(`  - 체력: ${user.health}`);
                    console.log(`  - 힘: ${user.stats.strength}`);
                    console.log(`  - 민첩: ${user.stats.agility}`);
                    console.log(`  - 지능: ${user.stats.intelligence}`);
                    console.log(`  - 생명력: ${user.stats.vitality}`);
                    console.log(`  - 행운: ${user.stats.luck}`);
                    console.log(`  - 스탯 포인트: ${user.statPoints}`);
                    
                    // 장착 아이템
                    console.log('\n🛡️ 장착 중인 아이템:');
                    const equipmentSlots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];
                    for (const slot of equipmentSlots) {
                        const slotIndex = user.equipment[slot];
                        if (slotIndex !== -1 && slotIndex !== undefined && slotIndex !== null) {
                            const item = user.inventory.find(i => i.inventorySlot === slotIndex);
                            if (item) {
                                console.log(`  - ${slot}: ${item.name} (+${item.enhanceLevel}성)`);
                            }
                        }
                    }
                    
                    // 칭호
                    if (user.equippedTitle) {
                        console.log(`\n🏆 장착 칭호: ${user.equippedTitle}`);
                    }
                    if (user.titles && user.titles.length > 0) {
                        console.log(`📜 보유 칭호: ${user.titles.join(', ')}`);
                    }
                    
                    // 엠블럼
                    if (user.emblem) {
                        console.log(`\n🎖️ 엠블럼: ${user.emblem}`);
                        if (user.emblemEnhancement && user.emblemEnhancement.level > 0) {
                            console.log(`  - 강화 레벨: ${user.emblemEnhancement.level}`);
                            console.log(`  - 추가 스탯:`);
                            for (const [stat, value] of Object.entries(user.emblemEnhancement.stats)) {
                                if (value > 0) console.log(`    • ${stat}: +${value}`);
                            }
                        }
                    }
                    
                    // 특수 시스템
                    console.log('\n🎯 게임 진행도:');
                    console.log(`  - 해금된 지역: ${user.unlockedAreas.join(', ')}`);
                    console.log(`  - 사냥 티켓: ${user.huntingTickets}/20`);
                    console.log(`  - 던전 티켓: ${user.dungeonTickets}/5`);
                    console.log(`  - PVP 티켓: ${user.pvpTickets}/20`);
                    
                    // PVP 정보
                    if (user.pvp) {
                        console.log('\n⚔️ PVP 정보:');
                        console.log(`  - 레이팅: ${user.pvp.rating}`);
                        console.log(`  - 티어: ${user.pvp.tier} ${user.pvp.division}`);
                        console.log(`  - 전적: ${user.pvp.wins}승 ${user.pvp.losses}패`);
                        console.log(`  - 승률: ${((user.pvp.wins / (user.pvp.wins + user.pvp.losses) * 100) || 0).toFixed(1)}%`);
                    }
                    
                    // 인벤토리 요약
                    console.log(`\n📦 인벤토리: ${user.inventory.length}/${user.maxInventorySlots} 슬롯 사용중`);
                    const rarityCount = {};
                    user.inventory.forEach(item => {
                        rarityCount[item.rarity] = (rarityCount[item.rarity] || 0) + 1;
                    });
                    console.log('  - 등급별 보유:');
                    for (const [rarity, count] of Object.entries(rarityCount)) {
                        console.log(`    • ${rarity}: ${count}개`);
                    }
                    
                    // 기타 통계
                    console.log('\n📊 기타 통계:');
                    console.log(`  - 보스 처치: ${user.bossKills}회`);
                    console.log(`  - 총 사냥: ${user.totalHunts}회`);
                    console.log(`  - 던전 클리어: ${user.dungeonClears}회`);
                    console.log(`  - 최고 던전 층: ${user.dungeonProgress?.bestFloor || 0}층`);
                    
                    break; // 하나라도 찾으면 다음 사용자로
                }
            }
            
            // 모든 ID로도 찾지 못한 경우
            if (!target.ids.some(async id => await User.findOne({ discordId: id }))) {
                console.log(`\n❌ ${target.name} 유저를 찾을 수 없습니다.`);
            }
        }

        // 닉네임으로도 추가 검색
        console.log(`\n\n${'='.repeat(60)}`);
        console.log('🔍 닉네임으로 추가 검색');
        console.log('='.repeat(60));
        
        const nicknameSearches = ['인프', '하연'];
        for (const nickname of nicknameSearches) {
            const users = await User.find({ 
                nickname: { $regex: nickname, $options: 'i' } 
            }).limit(5);
            
            if (users.length > 0) {
                console.log(`\n"${nickname}" 닉네임 검색 결과:`);
                users.forEach(user => {
                    console.log(`  - ${user.nickname} (ID: ${user.discordId}, Lv.${user.level})`);
                });
            }
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n\n✅ MongoDB 연결 종료');
    }
}

// 스크립트 실행
console.log('🚀 유저 데이터 조회 시작...\n');
fetchUserData();