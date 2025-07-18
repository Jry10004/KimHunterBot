const mongoose = require('mongoose');
const UserArtifacts = require('../models/UserArtifacts');
const User = require('../models/User');
require('dotenv').config();

async function findGoldenPickaxeUsers() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 금 곡괭이를 보유한 유저 찾기
        const goldenPickaxeUsers = await UserArtifacts.find({
            'pickaxes.gold.unlocked': true
        });

        console.log(`\n📊 금 곡괭이 보유자 통계:`);
        console.log(`총 ${goldenPickaxeUsers.length}명이 금 곡괭이를 보유하고 있습니다.\n`);

        if (goldenPickaxeUsers.length > 0) {
            console.log('🏆 금 곡괭이 보유자 목록:\n');
            console.log('='.repeat(80));
            
            for (const artifactUser of goldenPickaxeUsers) {
                // User 정보도 함께 가져오기
                const user = await User.findOne({ discordId: artifactUser.userId });
                
                const goldPickaxe = artifactUser.pickaxes.gold;
                const isCurrentlyUsing = artifactUser.currentPickaxe === 'gold';
                
                console.log(`👤 유저명: ${artifactUser.username}`);
                console.log(`   Discord ID: ${artifactUser.userId}`);
                if (user) {
                    console.log(`   닉네임: ${user.nickname || '없음'}`);
                    console.log(`   레벨: ${user.level}`);
                    console.log(`   골드: ${user.gold.toLocaleString()}`);
                }
                console.log(`   금 곡괭이 레벨: ${goldPickaxe.level}`);
                console.log(`   금 곡괭이 경험치: ${goldPickaxe.experience}`);
                console.log(`   현재 사용 중: ${isCurrentlyUsing ? '✅ 예' : '❌ 아니오'}`);
                console.log(`   현재 사용 곡괭이: ${artifactUser.currentPickaxe}`);
                
                // 유물 통계
                const totalArtifacts = artifactUser.artifacts.length;
                const legendaryArtifacts = artifactUser.artifacts.filter(a => a.rarity === 'legendary').length;
                const mythicArtifacts = artifactUser.artifacts.filter(a => a.rarity === 'mythic').length;
                
                console.log(`   총 유물 수: ${totalArtifacts}`);
                console.log(`   전설 유물: ${legendaryArtifacts}개`);
                console.log(`   신화 유물: ${mythicArtifacts}개`);
                
                // 총 탐사 수익 계산
                const totalEarnings = artifactUser.artifacts
                    .filter(a => a.sold)
                    .reduce((sum, a) => sum + (a.soldPrice || 0), 0);
                
                console.log(`   총 유물 판매 수익: ${totalEarnings.toLocaleString()} 골드`);
                console.log('='.repeat(80));
            }
            
            // 추가 통계
            console.log('\n📈 추가 통계:');
            
            // 금 곡괭이 레벨별 분포
            const levelDistribution = {};
            goldenPickaxeUsers.forEach(user => {
                const level = Math.floor(user.pickaxes.gold.level / 10) * 10;
                levelDistribution[`${level}-${level+9}`] = (levelDistribution[`${level}-${level+9}`] || 0) + 1;
            });
            
            console.log('\n레벨 분포:');
            Object.entries(levelDistribution).sort().forEach(([range, count]) => {
                console.log(`   레벨 ${range}: ${count}명`);
            });
            
            // 현재 금 곡괭이 사용자
            const activeGoldUsers = goldenPickaxeUsers.filter(u => u.currentPickaxe === 'gold').length;
            console.log(`\n현재 금 곡괭이 사용 중: ${activeGoldUsers}명 (${(activeGoldUsers/goldenPickaxeUsers.length*100).toFixed(1)}%)`);
            
            // 최고 레벨 금 곡괭이 보유자
            const topLevelUser = goldenPickaxeUsers.reduce((top, user) => 
                user.pickaxes.gold.level > (top?.pickaxes.gold.level || 0) ? user : top
            , null);
            
            if (topLevelUser) {
                console.log(`\n🥇 최고 레벨 금 곡괭이 보유자:`);
                console.log(`   유저명: ${topLevelUser.username}`);
                console.log(`   금 곡괭이 레벨: ${topLevelUser.pickaxes.gold.level}`);
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
findGoldenPickaxeUsers();