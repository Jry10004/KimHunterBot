const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function fixStatPoints() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        const users = await User.find({});
        console.log(`\n총 ${users.length}명의 유저 스텟포인트를 수정합니다.`);
        
        let fixedCount = 0;
        
        for (const user of users) {
            // 정확한 스텟포인트 계산
            const correctStatPoints = (user.level - 1) * 5;
            
            // 현재 사용 중인 스텟포인트 계산
            let usedPoints = 0;
            if (user.stats) {
                usedPoints += (user.stats.strength || 10) - 10;
                usedPoints += (user.stats.agility || 10) - 10;
                usedPoints += (user.stats.intelligence || 10) - 10;
                usedPoints += (user.stats.vitality || 10) - 10;
                usedPoints += (user.stats.luck || 10) - 10;
            }
            
            // 엠블럼 강화로 얻은 스텟은 제외
            if (user.emblemEnhancement && user.emblemEnhancement.stats) {
                usedPoints -= (user.emblemEnhancement.stats.strength || 0);
                usedPoints -= (user.emblemEnhancement.stats.agility || 0);
                usedPoints -= (user.emblemEnhancement.stats.intelligence || 0);
                usedPoints -= (user.emblemEnhancement.stats.vitality || 0);
                usedPoints -= (user.emblemEnhancement.stats.luck || 0);
            }
            
            // 사용 가능한 포인트 = 총 포인트 - 사용한 포인트
            const availablePoints = correctStatPoints - usedPoints;
            
            // 음수가 되는 경우 (과도하게 사용한 경우) 스텟 초기화
            if (availablePoints < 0) {
                console.log(`❌ ${user.nickname || user.discordId}: 스텟포인트 초과 사용 (${-availablePoints}p 초과)`);
                
                // 스텟 초기화
                user.stats = {
                    strength: 10,
                    agility: 10,
                    intelligence: 10,
                    vitality: 10,
                    luck: 10
                };
                
                // 엠블럼 강화 스탯 재적용
                if (user.emblemEnhancement && user.emblemEnhancement.stats) {
                    user.stats.strength += user.emblemEnhancement.stats.strength || 0;
                    user.stats.agility += user.emblemEnhancement.stats.agility || 0;
                    user.stats.intelligence += user.emblemEnhancement.stats.intelligence || 0;
                    user.stats.vitality += user.emblemEnhancement.stats.vitality || 0;
                    user.stats.luck += user.emblemEnhancement.stats.luck || 0;
                }
                
                user.statPoints = correctStatPoints;
                console.log(`  → 스텟 초기화 완료. ${correctStatPoints}p 지급`);
            } else {
                // 정상적인 경우 포인트만 수정
                const before = user.statPoints || 0;
                user.statPoints = availablePoints;
                
                if (before !== availablePoints) {
                    console.log(`✅ ${user.nickname || user.discordId}: ${before}p → ${availablePoints}p (Lv.${user.level})`);
                    fixedCount++;
                }
            }
            
            await user.save();
        }
        
        console.log(`\n수정 완료: ${fixedCount}명의 스텟포인트가 수정되었습니다.`);
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

// 실행 확인
console.log('⚠️  이 스크립트는 모든 유저의 스텟포인트를 레벨에 맞게 수정합니다.');
console.log('과도하게 사용한 유저는 스텟이 초기화됩니다.');
console.log('실행하려면 아래 주석을 해제하세요.\n');

fixStatPoints();