const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkStatPoints() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 모든 유저 가져오기
        const users = await User.find({}).sort({ level: -1 });
        
        console.log('\n=== 스텟포인트 현황 ===');
        console.log('닉네임 | 레벨 | 현재 스텟포인트 | 예상 스텟포인트 | 차이');
        console.log('─'.repeat(60));
        
        let issueCount = 0;
        
        for (const user of users) {
            // 예상 스텟포인트 계산 (레벨-1) * 5
            const expectedPoints = (user.level - 1) * 5;
            
            // 현재 사용한 스텟포인트 계산
            let usedPoints = 0;
            if (user.stats) {
                usedPoints += (user.stats.strength || 10) - 10;
                usedPoints += (user.stats.agility || 10) - 10;
                usedPoints += (user.stats.intelligence || 10) - 10;
                usedPoints += (user.stats.vitality || 10) - 10;
                usedPoints += (user.stats.luck || 10) - 10;
            }
            
            // 총 포인트 (현재 보유 + 사용한 포인트)
            const totalPoints = (user.statPoints || 0) + usedPoints;
            const difference = totalPoints - expectedPoints;
            
            // 차이가 있는 경우만 표시
            if (difference !== 0) {
                console.log(`${(user.nickname || user.discordId).padEnd(15)} | Lv.${user.level.toString().padEnd(3)} | ${totalPoints.toString().padEnd(15)} | ${expectedPoints.toString().padEnd(15)} | ${difference > 0 ? '+' : ''}${difference}`);
                issueCount++;
            }
        }
        
        if (issueCount === 0) {
            console.log('모든 유저의 스텟포인트가 정상입니다.');
        } else {
            console.log(`\n⚠️  ${issueCount}명의 유저에게 스텟포인트 문제가 있습니다.`);
        }
        
        // 레벨별 정상 스텟포인트 표
        console.log('\n=== 레벨별 정상 스텟포인트 ===');
        console.log('레벨 | 획득 포인트');
        console.log('─'.repeat(20));
        for (let level = 1; level <= 20; level++) {
            const points = (level - 1) * 5;
            console.log(`Lv.${level.toString().padEnd(2)} | ${points}p`);
        }
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

checkStatPoints();