const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function recoverAllFragments() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB 연결 성공');

        // 조각을 보유한 모든 유저 찾기
        const users = await User.find({
            'energyFragments.fragments': { $exists: true }
        });

        console.log(`📊 조각을 보유한 유저 수: ${users.length}명`);

        let totalRecovered = 0;
        let totalAttackBonus = 0;
        const recoveredUsers = [];

        for (const user of users) {
            if (!user.energyFragments || !user.energyFragments.fragments) continue;

            const fragments = user.energyFragments.fragments;
            let userTotal = 0;
            let userAttackBonus = 0;
            const userFragments = {};

            // Map 타입 처리
            if (fragments instanceof Map) {
                for (const [level, count] of fragments) {
                    if (count > 0) {
                        userFragments[`Lv.${level}`] = count;
                        userTotal += count;
                        userAttackBonus += parseInt(level) * count;
                    }
                }
            } else if (typeof fragments === 'object') {
                // 일반 객체 처리
                for (const [level, count] of Object.entries(fragments)) {
                    if (count > 0) {
                        userFragments[`Lv.${level}`] = count;
                        userTotal += count;
                        userAttackBonus += parseInt(level) * count;
                    }
                }
            }

            if (userTotal > 0) {
                recoveredUsers.push({
                    userId: user.discordId,
                    nickname: user.nickname || 'Unknown',
                    fragments: userFragments,
                    totalFragments: userTotal,
                    attackBonus: userAttackBonus
                });

                totalRecovered += userTotal;
                totalAttackBonus += userAttackBonus;

                // 조각 회수 (빈 Map으로 초기화)
                user.energyFragments.fragments = new Map();
                user.energyFragments.highestLevel = 0;
                user.energyFragments.totalFusions = 0;
                user.energyFragments.successfulFusions = 0;
                user.energyFragments.failureStack = 0;
                user.energyFragments.consecutiveSuccess = 0;
                user.energyFragments.dailyFusions = 0;
                user.energyFragments.dailyMines = 20;
                
                await user.save();
                console.log(`✅ ${user.nickname}: ${userTotal}개 조각 회수 완료 (공격력 -${userAttackBonus})`);
            }
        }

        // 회수 결과 저장
        const fs = require('fs');
        const result = {
            timestamp: new Date().toISOString(),
            totalUsers: recoveredUsers.length,
            totalFragments: totalRecovered,
            totalAttackBonus: totalAttackBonus,
            users: recoveredUsers
        };

        fs.writeFileSync(
            `fragments_recovery_${new Date().toISOString().split('T')[0]}.json`,
            JSON.stringify(result, null, 2)
        );

        console.log('\n=== 조각 회수 완료 ===');
        console.log(`📊 총 회수된 유저: ${recoveredUsers.length}명`);
        console.log(`💎 총 회수된 조각: ${totalRecovered}개`);
        console.log(`⚔️ 총 회수된 공격력: ${totalAttackBonus}`);
        console.log('\n상세 내역:');
        
        recoveredUsers.forEach(user => {
            console.log(`\n${user.nickname} (${user.userId}):`);
            Object.entries(user.fragments).forEach(([level, count]) => {
                console.log(`  - ${level}: ${count}개`);
            });
            console.log(`  총 ${user.totalFragments}개, 공격력 -${user.attackBonus}`);
        });

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ MongoDB 연결 종료');
    }
}

// 스크립트 실행
recoverAllFragments();