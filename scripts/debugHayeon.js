const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function debugHayeon() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 하연 유저 찾기
        const user = await User.findOne({ discordId: '295980447849250817' });
        
        if (!user) {
            console.log('하연 유저를 찾을 수 없습니다.');
            return;
        }
        
        console.log('\n=== 하연 유저 상세 정보 ===');
        console.log(`닉네임: ${user.nickname}`);
        console.log(`레벨: ${user.level}`);
        console.log(`현재 스텟포인트: ${user.statPoints}`);
        
        // 예상 스텟포인트
        const expectedPoints = (user.level - 1) * 5;
        console.log(`예상 스텟포인트: ${expectedPoints} (레벨 ${user.level} = (${user.level}-1) × 5)`);
        
        // 현재 스텟
        console.log('\n현재 스텟:');
        console.log(`  힘: ${user.stats?.strength || 10}`);
        console.log(`  민첩: ${user.stats?.agility || 10}`);
        console.log(`  지능: ${user.stats?.intelligence || 10}`);
        console.log(`  체력: ${user.stats?.vitality || 10}`);
        console.log(`  행운: ${user.stats?.luck || 10}`);
        
        // 사용한 포인트 계산
        let usedPoints = 0;
        if (user.stats) {
            usedPoints += (user.stats.strength || 10) - 10;
            usedPoints += (user.stats.agility || 10) - 10;
            usedPoints += (user.stats.intelligence || 10) - 10;
            usedPoints += (user.stats.vitality || 10) - 10;
            usedPoints += (user.stats.luck || 10) - 10;
        }
        console.log(`\n사용한 스텟포인트: ${usedPoints}`);
        
        // 엠블럼 강화 스텟
        if (user.emblemEnhancement && user.emblemEnhancement.stats) {
            console.log('\n엠블럼 강화 스텟:');
            console.log(`  힘: +${user.emblemEnhancement.stats.strength || 0}`);
            console.log(`  민첩: +${user.emblemEnhancement.stats.agility || 0}`);
            console.log(`  지능: +${user.emblemEnhancement.stats.intelligence || 0}`);
            console.log(`  체력: +${user.emblemEnhancement.stats.vitality || 0}`);
            console.log(`  행운: +${user.emblemEnhancement.stats.luck || 0}`);
        }
        
        // 총 포인트 계산
        const totalPoints = user.statPoints + usedPoints;
        console.log(`\n총 포인트 (보유 + 사용): ${user.statPoints} + ${usedPoints} = ${totalPoints}`);
        console.log(`차이: ${totalPoints - expectedPoints}`);
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

debugHayeon();