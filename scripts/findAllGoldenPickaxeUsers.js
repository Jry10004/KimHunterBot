const mongoose = require('mongoose');
const User = require('../models/User');
const UserArtifacts = require('../models/UserArtifacts');
require('dotenv').config();

async function findAllGoldenPickaxeUsers() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');
        console.log('🔍 금곡괭이 보유자 검색 시작...\n');

        // 1. 유물 시스템에서 금 곡괭이 보유자 찾기
        console.log('='.repeat(80));
        console.log('📦 1. 유물 탐사 시스템 - 금 곡괭이 보유자');
        console.log('='.repeat(80));
        
        const artifactUsers = await UserArtifacts.find({
            'pickaxes.gold.unlocked': true
        });

        console.log(`\n✅ 유물 시스템: ${artifactUsers.length}명이 금 곡괭이를 보유하고 있습니다.`);

        if (artifactUsers.length > 0) {
            const artifactUserDetails = [];
            
            for (const artifactUser of artifactUsers) {
                const user = await User.findOne({ discordId: artifactUser.userId });
                artifactUserDetails.push({
                    artifactUser,
                    user
                });
            }

            // 금 곡괭이 레벨 기준으로 정렬
            artifactUserDetails.sort((a, b) => 
                b.artifactUser.pickaxes.gold.level - a.artifactUser.pickaxes.gold.level
            );

            console.log('\n🏆 금 곡괭이 보유자 (레벨 순):');
            artifactUserDetails.forEach((data, index) => {
                const { artifactUser, user } = data;
                const goldPickaxe = artifactUser.pickaxes.gold;
                
                console.log(`\n${index + 1}. ${artifactUser.username}`);
                console.log(`   Discord ID: ${artifactUser.userId}`);
                if (user) {
                    console.log(`   닉네임: ${user.nickname || '없음'}`);
                    console.log(`   캐릭터 레벨: ${user.level}`);
                    console.log(`   보유 골드: ${user.gold.toLocaleString()}`);
                }
                console.log(`   ⛏️ 금 곡괭이 레벨: ${goldPickaxe.level} (경험치: ${goldPickaxe.experience})`);
                console.log(`   현재 사용 중: ${artifactUser.currentPickaxe === 'gold' ? '✅ 예' : '❌ 아니오 (' + artifactUser.currentPickaxe + ' 사용 중)'}`);
            });
        }

        // 2. 일반 인벤토리에서 금곡괭이 아이템 찾기
        console.log('\n' + '='.repeat(80));
        console.log('🎒 2. 일반 인벤토리 - 금곡괭이 아이템 보유자');
        console.log('='.repeat(80));

        const pickaxePatterns = [
            /금.*곡괭이/i,
            /golden.*pickaxe/i,
            /황금.*곡괭이/i
        ];

        const users = await User.find({
            'inventory.name': { 
                $in: pickaxePatterns.map(pattern => new RegExp(pattern))
            }
        });

        console.log(`\n✅ 인벤토리: ${users.length}명이 금곡괭이 아이템을 보유하고 있습니다.`);

        if (users.length > 0) {
            console.log('\n📦 인벤토리 금곡괭이 보유자:');
            users.forEach((user, index) => {
                const goldPickaxes = user.inventory.filter(item => 
                    pickaxePatterns.some(pattern => pattern.test(item.name))
                );

                console.log(`\n${index + 1}. ${user.nickname || user.discordId}`);
                console.log(`   Discord ID: ${user.discordId}`);
                console.log(`   레벨: ${user.level}`);
                console.log(`   골드: ${user.gold.toLocaleString()}`);
                
                goldPickaxes.forEach(pickaxe => {
                    console.log(`   📍 아이템: ${pickaxe.name}`);
                    console.log(`      - 타입: ${pickaxe.type}`);
                    console.log(`      - 등급: ${pickaxe.rarity}`);
                    console.log(`      - 강화: +${pickaxe.enhanceLevel || 0}`);
                    console.log(`      - 장착: ${pickaxe.equipped ? '✅' : '❌'}`);
                });
            });
        }

        // 3. 종합 통계
        console.log('\n' + '='.repeat(80));
        console.log('📊 종합 통계');
        console.log('='.repeat(80));

        const totalUniqueUsers = new Set([
            ...artifactUsers.map(u => u.userId),
            ...users.map(u => u.discordId)
        ]).size;

        console.log(`\n총 금곡괭이 보유자 (중복 제거): ${totalUniqueUsers}명`);
        console.log(`- 유물 시스템 금 곡괭이: ${artifactUsers.length}명`);
        console.log(`- 인벤토리 금곡괭이 아이템: ${users.length}명`);

        if (artifactUsers.length > 0) {
            const maxLevel = Math.max(...artifactUsers.map(u => u.pickaxes.gold.level));
            const avgLevel = artifactUsers.reduce((sum, u) => sum + u.pickaxes.gold.level, 0) / artifactUsers.length;
            const activeUsers = artifactUsers.filter(u => u.currentPickaxe === 'gold').length;

            console.log(`\n유물 시스템 금 곡괭이 통계:`);
            console.log(`- 최고 레벨: ${maxLevel}`);
            console.log(`- 평균 레벨: ${avgLevel.toFixed(1)}`);
            console.log(`- 현재 사용 중: ${activeUsers}명 (${(activeUsers/artifactUsers.length*100).toFixed(1)}%)`);
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 명령줄 인자 처리 (선택적)
const args = process.argv.slice(2);
if (args.includes('--export')) {
    // 결과를 파일로 내보내기 옵션
    console.log('📝 결과를 파일로 내보내는 기능은 추후 구현 예정입니다.');
}

// 스크립트 실행
findAllGoldenPickaxeUsers();