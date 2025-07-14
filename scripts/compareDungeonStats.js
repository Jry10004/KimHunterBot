const mongoose = require('mongoose');
const User = require('../models/User');
const { calculateCombatPower } = require('../handlers/common/combatPower');
const { formatNumber } = require('../handlers/common/utils');

mongoose.connect('mongodb://localhost:27017/rpgbot', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function compareDungeonStats() {
    try {
        console.log('=== 인프와 하연의 던전 기록 비교 분석 ===\n');
        
        // 인프 데이터 조회
        const infp = await User.findOne({ 
            $or: [
                { nickname: '인프' },
                { discordId: '346156636149432320' }
            ]
        });
        
        // 하연 데이터 조회
        const hayeon = await User.findOne({ 
            $or: [
                { nickname: '하연' },
                { discordId: '1097809848883744848' }
            ]
        });
        
        if (!infp || !hayeon) {
            console.log('사용자를 찾을 수 없습니다.');
            return;
        }
        
        // 1. 기본 정보 및 전투력 비교
        console.log('1. 기본 정보 비교');
        console.log('=================');
        console.log(`인프 (${infp.nickname})`);
        console.log(`- 레벨: ${infp.level}`);
        console.log(`- 골드: ${formatNumber(infp.gold)}G`);
        console.log(`- 전투력: ${formatNumber(calculateCombatPower(infp))}`);
        console.log(`- 스탯: 힘 ${infp.stats.strength}, 민첩 ${infp.stats.agility}, 지능 ${infp.stats.intelligence}, 체력 ${infp.stats.vitality}, 운 ${infp.stats.luck}`);
        
        console.log(`\n하연 (${hayeon.nickname})`);
        console.log(`- 레벨: ${hayeon.level}`);
        console.log(`- 골드: ${formatNumber(hayeon.gold)}G`);
        console.log(`- 전투력: ${formatNumber(calculateCombatPower(hayeon))}`);
        console.log(`- 스탯: 힘 ${hayeon.stats.strength}, 민첩 ${hayeon.stats.agility}, 지능 ${hayeon.stats.intelligence}, 체력 ${hayeon.stats.vitality}, 운 ${hayeon.stats.luck}`);
        
        // 2. 던전 진행도 비교
        console.log('\n2. 던전 진행도 비교');
        console.log('===================');
        
        const infpDungeon = infp.dungeonProgress || {};
        const hayeonDungeon = hayeon.dungeonProgress || {};
        
        console.log(`인프 던전 기록:`);
        console.log(`- 마지막 도달 층: ${infpDungeon.lastFloor || 1}층`);
        console.log(`- 최고 도달 층: ${infpDungeon.bestFloor || 0}층`);
        console.log(`- 총 시도 횟수: ${infpDungeon.totalAttempts || 0}회`);
        console.log(`- 50층 완전 클리어: ${infpDungeon.totalClears || 0}회`);
        console.log(`- 던전 총 골드: ${formatNumber(infpDungeon.totalGoldEarned || 0)}G`);
        console.log(`- 던전 총 경험치: ${formatNumber(infpDungeon.totalExpEarned || 0)} EXP`);
        console.log(`- 던전 티켓: ${infp.dungeonTickets || 0}/5장`);
        
        console.log(`\n하연 던전 기록:`);
        console.log(`- 마지막 도달 층: ${hayeonDungeon.lastFloor || 1}층`);
        console.log(`- 최고 도달 층: ${hayeonDungeon.bestFloor || 0}층`);
        console.log(`- 총 시도 횟수: ${hayeonDungeon.totalAttempts || 0}회`);
        console.log(`- 50층 완전 클리어: ${hayeonDungeon.totalClears || 0}회`);
        console.log(`- 던전 총 골드: ${formatNumber(hayeonDungeon.totalGoldEarned || 0)}G`);
        console.log(`- 던전 총 경험치: ${formatNumber(hayeonDungeon.totalExpEarned || 0)} EXP`);
        console.log(`- 던전 티켓: ${hayeon.dungeonTickets || 0}/5장`);
        
        // 3. 던전 통계 비교 (구버전 필드)
        console.log('\n3. 던전 통계 (구버전 필드)');
        console.log('===========================');
        
        const infpStats = infp.dungeonStats || {};
        const hayeonStats = hayeon.dungeonStats || {};
        
        console.log(`인프 던전 통계:`);
        console.log(`- 총 던전 횟수: ${infpStats.totalRuns || 0}회`);
        console.log(`- 최고 층: ${infpStats.maxFloor || 0}층`);
        console.log(`- 총 획득 골드: ${formatNumber(infpStats.totalGoldEarned || 0)}G`);
        console.log(`- 총 사망 횟수: ${infpStats.totalDeaths || 0}회`);
        console.log(`- 보스 처치: ${infpStats.bossKills || 0}회`);
        console.log(`- 발견 아이템: ${infpStats.itemsFound || 0}개`);
        
        console.log(`\n하연 던전 통계:`);
        console.log(`- 총 던전 횟수: ${hayeonStats.totalRuns || 0}회`);
        console.log(`- 최고 층: ${hayeonStats.maxFloor || 0}층`);
        console.log(`- 총 획득 골드: ${formatNumber(hayeonStats.totalGoldEarned || 0)}G`);
        console.log(`- 총 사망 횟수: ${hayeonStats.totalDeaths || 0}회`);
        console.log(`- 보스 처치: ${hayeonStats.bossKills || 0}회`);
        console.log(`- 발견 아이템: ${hayeonStats.itemsFound || 0}개`);
        
        // 4. 던전 완전 클리어 횟수 (구필드)
        console.log('\n4. 추가 던전 정보');
        console.log('==================');
        console.log(`인프 dungeonClears: ${infp.dungeonClears || 0}회`);
        console.log(`하연 dungeonClears: ${hayeon.dungeonClears || 0}회`);
        
        // 5. 층별 보상 공식
        console.log('\n5. 던전 보상 공식');
        console.log('==================');
        console.log('일반 층 보상:');
        console.log('- 골드: 100 * 층수 + 랜덤(0 ~ 100*층수)');
        console.log('- 경험치: 50 * 층수 + 랜덤(0 ~ 25*층수)');
        console.log('- 유물 드롭: 3층마다 1개 (층수가 높을수록 고급 유물)');
        
        console.log('\n보스 층 보상 (10층마다):');
        console.log('- 골드: 일반 보상 x3');
        console.log('- 경험치: 일반 보상 x2');
        console.log('- 특별 유물 확정 드롭');
        
        // 6. 예상 수익 계산
        console.log('\n6. 예상 누적 수익 (최고 층 기준)');
        console.log('==================================');
        
        const calculateExpectedRewards = (maxFloor) => {
            let totalGold = 0;
            let totalExp = 0;
            
            for (let floor = 1; floor <= maxFloor; floor++) {
                const baseGold = 100 * floor;
                const baseExp = 50 * floor;
                
                // 평균값으로 계산 (랜덤 요소의 중간값)
                let floorGold = baseGold + (baseGold / 2);
                let floorExp = baseExp + (baseExp / 4);
                
                // 보스 보너스
                if (floor % 10 === 0) {
                    floorGold *= 3;
                    floorExp *= 2;
                }
                
                totalGold += floorGold;
                totalExp += floorExp;
            }
            
            return { totalGold, totalExp };
        };
        
        const infpExpected = calculateExpectedRewards(infpDungeon.bestFloor || infpStats.maxFloor || 0);
        const hayeonExpected = calculateExpectedRewards(hayeonDungeon.bestFloor || hayeonStats.maxFloor || 0);
        
        console.log(`인프 예상 수익 (${infpDungeon.bestFloor || infpStats.maxFloor || 0}층):`);
        console.log(`- 예상 골드: ${formatNumber(Math.floor(infpExpected.totalGold))}G`);
        console.log(`- 예상 경험치: ${formatNumber(Math.floor(infpExpected.totalExp))} EXP`);
        
        console.log(`\n하연 예상 수익 (${hayeonDungeon.bestFloor || hayeonStats.maxFloor || 0}층):`);
        console.log(`- 예상 골드: ${formatNumber(Math.floor(hayeonExpected.totalGold))}G`);
        console.log(`- 예상 경험치: ${formatNumber(Math.floor(hayeonExpected.totalExp))} EXP`);
        
        // 7. 효율성 분석
        console.log('\n7. 던전 효율성 분석');
        console.log('====================');
        
        const infpPower = calculateCombatPower(infp);
        const hayeonPower = calculateCombatPower(hayeon);
        
        const infpMaxFloor = infpDungeon.bestFloor || infpStats.maxFloor || 0;
        const hayeonMaxFloor = hayeonDungeon.bestFloor || hayeonStats.maxFloor || 0;
        
        const infpEfficiency = infpMaxFloor > 0 ? infpPower / infpMaxFloor : 0;
        const hayeonEfficiency = hayeonMaxFloor > 0 ? hayeonPower / hayeonMaxFloor : 0;
        
        console.log(`인프 효율성:`);
        console.log(`- 전투력/최고층: ${formatNumber(Math.floor(infpEfficiency))}`);
        console.log(`- 층당 필요 전투력: ${infpMaxFloor > 0 ? formatNumber(Math.floor(infpPower / infpMaxFloor)) : 'N/A'}`);
        
        console.log(`\n하연 효율성:`);
        console.log(`- 전투력/최고층: ${formatNumber(Math.floor(hayeonEfficiency))}`);
        console.log(`- 층당 필요 전투력: ${hayeonMaxFloor > 0 ? formatNumber(Math.floor(hayeonPower / hayeonMaxFloor)) : 'N/A'}`);
        
        // 8. 펜듈럼 스킬 영향도
        console.log('\n8. 펜듈럼 스킬 강화 수준');
        console.log('========================');
        
        console.log(`인프 PVP 강화:`);
        console.log(`- 별똥베기(상단): ${infp.pvpEnhancement?.high || 0}강`);
        console.log(`- 슈가스팅(중단): ${infp.pvpEnhancement?.middle || 0}강`);
        console.log(`- 버섯팡(하단): ${infp.pvpEnhancement?.low || 0}강`);
        
        console.log(`\n하연 PVP 강화:`);
        console.log(`- 별똥베기(상단): ${hayeon.pvpEnhancement?.high || 0}강`);
        console.log(`- 슈가스팅(중단): ${hayeon.pvpEnhancement?.middle || 0}강`);
        console.log(`- 버섯팡(하단): ${hayeon.pvpEnhancement?.low || 0}강`);
        
        console.log('\n※ 펜듈럼 스킬은 던전에서 자동 발동되며, 강화 수준이 높을수록 발동 확률과 효과가 증가합니다.');
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        mongoose.connection.close();
    }
}

compareDungeonStats();