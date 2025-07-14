const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function resetAllStats() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 모든 유저 가져오기
        const users = await User.find({});
        console.log(`\n총 ${users.length}명의 유저를 처리합니다.`);
        
        let resetCount = 0;
        
        for (const user of users) {
            let totalPointsRecovered = 0;
            
            // 현재 스탯이 있는 경우
            if (user.stats) {
                // 기본값 10을 뺀 값이 투자한 포인트
                totalPointsRecovered += (user.stats.strength || 10) - 10;
                totalPointsRecovered += (user.stats.agility || 10) - 10;
                totalPointsRecovered += (user.stats.intelligence || 10) - 10;
                totalPointsRecovered += (user.stats.vitality || 10) - 10;
                totalPointsRecovered += (user.stats.luck || 10) - 10;
                
                // 스탯 초기화
                user.stats = {
                    strength: 10,
                    agility: 10,
                    intelligence: 10,
                    vitality: 10,
                    luck: 10
                };
            }
            
            // 레벨에 따른 스탯포인트 계산 (레벨-1) * 5
            const levelStatPoints = (user.level - 1) * 5;
            
            // 스탯포인트 설정 (회수한 포인트 + 레벨 포인트)
            user.statPoints = totalPointsRecovered;
            
            // 엠블럼 강화로 얻은 스탯 제외
            if (user.emblemEnhancement && user.emblemEnhancement.stats) {
                // 엠블럼 강화 스탯은 제외하고 계산
                const emblemStats = user.emblemEnhancement.stats;
                user.stats.strength += emblemStats.strength || 0;
                user.stats.agility += emblemStats.agility || 0;
                user.stats.intelligence += emblemStats.intelligence || 0;
                user.stats.vitality += emblemStats.vitality || 0;
                user.stats.luck += emblemStats.luck || 0;
            }
            
            // 최종 스텟포인트는 레벨에 맞게 정확히 설정
            user.statPoints = levelStatPoints;
            
            await user.save();
            
            console.log(`${user.nickname || user.discordId}: Lv.${user.level}, 회수: ${totalPointsRecovered}p, 총: ${user.statPoints}p`);
            resetCount++;
        }
        
        console.log(`\n✅ 총 ${resetCount}명의 유저 스탯이 초기화되었습니다.`);
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

// 실행 확인
console.log('⚠️  경고: 모든 유저의 스탯을 초기화합니다!');
console.log('레벨에 따른 스탯포인트가 재지급됩니다.');
console.log('실행하려면 아래 주석을 해제하세요.\n');

// resetAllStats();