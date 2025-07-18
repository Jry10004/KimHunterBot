// Script to check users who may have received duplicate fishing rewards
const mongoose = require('mongoose');
const User = require('../models/User');
const { FISHING_SYSTEM } = require('../data/fishingSystemNew');

// MongoDB 연결 (환경변수 사용)
const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/kimhunter';

async function checkDuplicateRewards() {
    try {
        await mongoose.connect(mongoUrl);
        console.log('MongoDB 연결 성공');
        
        // 낚시 데이터가 있는 모든 유저 조회
        const users = await User.find({ 'fishing.collection': { $exists: true } });
        console.log(`총 ${users.length}명의 낚시 유저 발견`);
        
        let problemUsers = [];
        
        for (const user of users) {
            if (!user.fishing || !Array.isArray(user.fishing.collection)) continue;
            
            const collectionCount = user.fishing.collection.length;
            const claimedRewards = user.fishing.collectionRewardsClaimed || [];
            
            // 20종 보상 체크
            if (collectionCount >= 20) {
                const has20Reward = claimedRewards.includes(20);
                
                console.log(`유저: ${user.nickname || user.discordId}`);
                console.log(`  - 수집: ${collectionCount}종`);
                console.log(`  - 20종 보상 받음: ${has20Reward ? '예' : '아니오'}`);
                console.log(`  - 현재 골드: ${user.gold?.toLocaleString() || 0}G`);
                console.log(`  - 받은 보상: ${claimedRewards.join(', ') || '없음'}`);
                
                // 보상을 받지 않았다면 문제 유저로 분류
                if (!has20Reward && collectionCount >= 20) {
                    problemUsers.push({
                        user: user,
                        collectionCount: collectionCount,
                        missingRewards: []
                    });
                    
                    if (collectionCount >= 10 && !claimedRewards.includes(10)) {
                        problemUsers[problemUsers.length - 1].missingRewards.push(10);
                    }
                    if (collectionCount >= 20 && !claimedRewards.includes(20)) {
                        problemUsers[problemUsers.length - 1].missingRewards.push(20);
                    }
                    if (collectionCount >= 30 && !claimedRewards.includes(30)) {
                        problemUsers[problemUsers.length - 1].missingRewards.push(30);
                    }
                    if (collectionCount >= 40 && !claimedRewards.includes(40)) {
                        problemUsers[problemUsers.length - 1].missingRewards.push(40);
                    }
                    if (collectionCount >= 50 && !claimedRewards.includes(50)) {
                        problemUsers[problemUsers.length - 1].missingRewards.push(50);
                    }
                }
                
                console.log('---');
            }
        }
        
        if (problemUsers.length > 0) {
            console.log(`\n문제 발견: ${problemUsers.length}명의 유저가 보상을 받지 못했습니다.`);
            
            for (const problem of problemUsers) {
                console.log(`\n유저: ${problem.user.nickname || problem.user.discordId}`);
                console.log(`수집: ${problem.collectionCount}종`);
                console.log(`받지 못한 보상: ${problem.missingRewards.join(', ')}종`);
            }
            
            console.log('\n이 유저들은 다음에 낚시할 때 자동으로 보상을 받게 됩니다.');
        } else {
            console.log('\n모든 유저가 정상적으로 보상을 받았습니다.');
        }
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

// 스크립트 실행
checkDuplicateRewards();