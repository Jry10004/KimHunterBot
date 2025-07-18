const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function findGoldenPickaxeInInventory() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 인벤토리에서 금곡괭이 관련 아이템 찾기
        // 가능한 이름 패턴들
        const pickaxePatterns = [
            /금.*곡괭이/i,
            /golden.*pickaxe/i,
            /황금.*곡괭이/i,
            /곡괭이.*금/i,
            /곡괭이.*황금/i,
            /gold.*pickaxe/i
        ];

        // 모든 유저 검색
        const users = await User.find({});
        const usersWithPickaxe = [];

        console.log(`\n🔍 총 ${users.length}명의 유저 인벤토리 검색 중...\n`);

        for (const user of users) {
            if (!user.inventory || user.inventory.length === 0) continue;

            // 각 유저의 인벤토리에서 금곡괭이 찾기
            const goldPickaxes = user.inventory.filter(item => {
                return pickaxePatterns.some(pattern => pattern.test(item.name));
            });

            if (goldPickaxes.length > 0) {
                usersWithPickaxe.push({
                    user: user,
                    pickaxes: goldPickaxes
                });
            }
        }

        console.log(`📊 검색 결과:`);
        console.log(`총 ${usersWithPickaxe.length}명이 인벤토리에 금곡괭이 관련 아이템을 보유하고 있습니다.\n`);

        if (usersWithPickaxe.length > 0) {
            console.log('🏆 금곡괭이 보유자 목록:\n');
            console.log('='.repeat(80));

            for (const data of usersWithPickaxe) {
                const { user, pickaxes } = data;

                console.log(`👤 유저 정보:`);
                console.log(`   Discord ID: ${user.discordId}`);
                console.log(`   닉네임: ${user.nickname || '없음'}`);
                console.log(`   레벨: ${user.level}`);
                console.log(`   골드: ${user.gold.toLocaleString()}`);
                console.log(`   등록일: ${user.registeredAt || '알 수 없음'}`);
                
                console.log(`\n⛏️ 보유한 곡괭이 아이템:`);
                for (const pickaxe of pickaxes) {
                    console.log(`   - 이름: ${pickaxe.name}`);
                    console.log(`     타입: ${pickaxe.type}`);
                    console.log(`     등급: ${pickaxe.rarity}`);
                    console.log(`     수량: ${pickaxe.quantity || 1}`);
                    console.log(`     강화: +${pickaxe.enhanceLevel || 0}`);
                    console.log(`     장착: ${pickaxe.equipped ? '✅ 예' : '❌ 아니오'}`);
                    console.log(`     슬롯: ${pickaxe.inventorySlot}`);
                    
                    if (pickaxe.stats) {
                        console.log(`     스탯: 공격력 +${pickaxe.stats.attack || 0}, 방어력 +${pickaxe.stats.defense || 0}`);
                    }
                    
                    if (pickaxe.description) {
                        console.log(`     설명: ${pickaxe.description}`);
                    }
                    console.log('');
                }
                
                console.log('='.repeat(80));
            }

            // 추가 통계
            console.log('\n📈 아이템별 통계:');
            const itemStats = {};
            
            usersWithPickaxe.forEach(data => {
                data.pickaxes.forEach(pickaxe => {
                    if (!itemStats[pickaxe.name]) {
                        itemStats[pickaxe.name] = {
                            count: 0,
                            totalQuantity: 0,
                            equipped: 0,
                            avgEnhance: 0,
                            enhanceSum: 0
                        };
                    }
                    
                    itemStats[pickaxe.name].count++;
                    itemStats[pickaxe.name].totalQuantity += (pickaxe.quantity || 1);
                    if (pickaxe.equipped) itemStats[pickaxe.name].equipped++;
                    itemStats[pickaxe.name].enhanceSum += (pickaxe.enhanceLevel || 0);
                });
            });

            Object.entries(itemStats).forEach(([itemName, stats]) => {
                stats.avgEnhance = stats.enhanceSum / stats.count;
                console.log(`\n"${itemName}":`);
                console.log(`   보유자 수: ${stats.count}명`);
                console.log(`   총 수량: ${stats.totalQuantity}개`);
                console.log(`   장착 중: ${stats.equipped}명`);
                console.log(`   평균 강화: +${stats.avgEnhance.toFixed(1)}`);
            });
        } else {
            console.log('❌ 인벤토리에서 금곡괭이 관련 아이템을 찾을 수 없습니다.');
            
            // 대신 모든 곡괭이 관련 아이템 검색
            console.log('\n🔍 참고: 모든 곡괭이 관련 아이템 검색 중...');
            const allPickaxePatterns = /곡괭이|pickaxe/i;
            const allPickaxeItems = new Set();
            
            users.forEach(user => {
                if (user.inventory) {
                    user.inventory.forEach(item => {
                        if (allPickaxePatterns.test(item.name)) {
                            allPickaxeItems.add(item.name);
                        }
                    });
                }
            });
            
            if (allPickaxeItems.size > 0) {
                console.log('\n발견된 곡괭이 아이템 종류:');
                Array.from(allPickaxeItems).sort().forEach(name => {
                    console.log(`   - ${name}`);
                });
            }
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 스크립트 실행
findGoldenPickaxeInInventory();