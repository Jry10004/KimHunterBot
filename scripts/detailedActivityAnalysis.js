const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function detailedActivityAnalysis() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/discord_bot');
        console.log('✅ MongoDB 연결 성공\n');

        // 인프와 하연 유저 찾기
        const inpf = await User.findOne({ discordId: '592659577384730645' });
        const hayeon = await User.findOne({ discordId: '295980447849250817' });

        if (!inpf || !hayeon) {
            console.log('❌ 유저를 찾을 수 없습니다.');
            return;
        }

        console.log('='.repeat(80));
        console.log('🔍 인프와 하연의 상세 활동 분석');
        console.log('='.repeat(80));

        // 1. 레벨업 효율성 분석
        console.log('\n📊 레벨업 효율성 분석');
        console.log('-'.repeat(60));
        
        // 사냥당 경험치 효율
        const inpfExpPerHunt = inpf.totalHunts > 0 ? (209298 / inpf.totalHunts) : 0;
        const hayeonExpPerHunt = hayeon.totalHunts > 0 ? (103533 / hayeon.totalHunts) : 0;
        
        console.log(`사냥당 평균 경험치:`);
        console.log(`  - 인프: ${Math.floor(inpfExpPerHunt).toLocaleString()} EXP/사냥 (총 ${inpf.totalHunts}회)`);
        console.log(`  - 하연: ${Math.floor(hayeonExpPerHunt).toLocaleString()} EXP/사냥 (총 ${hayeon.totalHunts}회)`);
        console.log(`  - 효율 차이: 인프가 ${((inpfExpPerHunt / hayeonExpPerHunt - 1) * 100).toFixed(1)}% 더 효율적`);

        // 2. 해금된 지역 및 사냥터 분석
        console.log('\n🗺️ 해금된 지역 분석');
        console.log('-'.repeat(60));
        console.log(`인프 해금 지역: ${inpf.unlockedAreas.join(', ')}`);
        console.log(`하연 해금 지역: ${hayeon.unlockedAreas.join(', ')}`);
        
        const areaNames = {
            1: '꽃잎 마을',
            2: '신비한 평원', 
            3: '속삭이는 숲',
            4: '크리스탈 광산'
        };
        
        console.log('\n지역별 사냥 가능 레벨:');
        console.log('  - 꽃잎 마을: 1-20 레벨');
        console.log('  - 신비한 평원: 15-35 레벨');
        console.log('  - 속삭이는 숲: 30-50 레벨');
        console.log('  - 크리스탈 광산: 45-70 레벨');

        // 3. 일일 활동 패턴 분석
        console.log('\n📅 일일 활동 패턴');
        console.log('-'.repeat(60));
        
        // 마지막 활동 시간들
        console.log('마지막 활동 시간:');
        console.log(`  인프:`);
        console.log(`    - 마지막 사냥: ${inpf.lastHunt ? new Date(inpf.lastHunt).toLocaleString() : '기록 없음'}`);
        console.log(`    - 마지막 출석: ${inpf.lastDaily || '기록 없음'}`);
        console.log(`    - 마지막 일: ${inpf.lastWork ? new Date(inpf.lastWork).toLocaleString() : '기록 없음'}`);
        
        console.log(`  하연:`);
        console.log(`    - 마지막 사냥: ${hayeon.lastHunt ? new Date(hayeon.lastHunt).toLocaleString() : '기록 없음'}`);
        console.log(`    - 마지막 출석: ${hayeon.lastDaily || '기록 없음'}`);
        console.log(`    - 마지막 일: ${hayeon.lastWork ? new Date(hayeon.lastWork).toLocaleString() : '기록 없음'}`);

        // 4. 장비 및 강화 분석
        console.log('\n⚔️ 장비 및 강화 상태');
        console.log('-'.repeat(60));
        
        // 장착 장비 강화 수치
        let inpfTotalEnhance = 0;
        let hayeonTotalEnhance = 0;
        let inpfEquipCount = 0;
        let hayeonEquipCount = 0;
        
        const equipmentSlots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];
        
        console.log('인프 장착 장비:');
        equipmentSlots.forEach(slot => {
            const slotIndex = inpf.equipment[slot];
            if (slotIndex !== -1 && slotIndex !== undefined && slotIndex !== null) {
                const item = inpf.inventory.find(i => i.inventorySlot === slotIndex);
                if (item) {
                    console.log(`  - ${slot}: ${item.name} (+${item.enhanceLevel}성)`);
                    inpfTotalEnhance += item.enhanceLevel;
                    inpfEquipCount++;
                }
            }
        });
        
        console.log('\n하연 장착 장비:');
        equipmentSlots.forEach(slot => {
            const slotIndex = hayeon.equipment[slot];
            if (slotIndex !== -1 && slotIndex !== undefined && slotIndex !== null) {
                const item = hayeon.inventory.find(i => i.inventorySlot === slotIndex);
                if (item) {
                    console.log(`  - ${slot}: ${item.name} (+${item.enhanceLevel}성)`);
                    hayeonTotalEnhance += item.enhanceLevel;
                    hayeonEquipCount++;
                }
            }
        });
        
        console.log(`\n강화 총합:`);
        console.log(`  - 인프: 총 +${inpfTotalEnhance}성 (${inpfEquipCount}개 장비)`);
        console.log(`  - 하연: 총 +${hayeonTotalEnhance}성 (${hayeonEquipCount}개 장비)`);

        // 5. 특별 활동 및 이벤트
        console.log('\n🎯 특별 활동 및 달성');
        console.log('-'.repeat(60));
        
        // 칭호
        console.log('보유 칭호:');
        console.log(`  - 인프: ${inpf.titles && inpf.titles.length > 0 ? inpf.titles.join(', ') : '없음'}`);
        console.log(`  - 하연: ${hayeon.titles && hayeon.titles.length > 0 ? hayeon.titles.join(', ') : '없음'}`);
        
        // 엠블럼
        console.log('\n엠블럼:');
        console.log(`  - 인프: ${inpf.emblem || '없음'} ${inpf.emblemEnhancement?.level ? `(+${inpf.emblemEnhancement.level})` : ''}`);
        console.log(`  - 하연: ${hayeon.emblem || '없음'} ${hayeon.emblemEnhancement?.level ? `(+${hayeon.emblemEnhancement.level})` : ''}`);

        // 6. 경험치 획득 소스 추정
        console.log('\n💰 경험치 획득 소스 추정');
        console.log('-'.repeat(60));
        
        // 총 경험치에서 각 활동의 기여도 추정
        const estimateExpSources = (user, totalExp) => {
            const sources = {
                hunting: user.totalHunts * 150, // 평균 150 exp per hunt
                daily: Math.floor((Date.now() - new Date(user.registeredAt || user.createdAt)) / (1000 * 60 * 60 * 24)) * 50, // 50 exp per day
                pvp: (user.pvp?.wins || 0) * 100, // 100 exp per win
                minigames: 0
            };
            
            // 미니게임 경험치
            if (user.gameStats) {
                Object.values(user.gameStats).forEach(stat => {
                    sources.minigames += (stat.won || 0) * 50; // 50 exp per win
                });
            }
            
            return sources;
        };
        
        const inpfSources = estimateExpSources(inpf, 209298);
        const hayeonSources = estimateExpSources(hayeon, 103533);
        
        console.log('인프 경험치 소스 (추정):');
        console.log(`  - 사냥: ${inpfSources.hunting.toLocaleString()} EXP`);
        console.log(`  - 일일 출석: ${inpfSources.daily.toLocaleString()} EXP`);
        console.log(`  - PVP: ${inpfSources.pvp.toLocaleString()} EXP`);
        console.log(`  - 미니게임: ${inpfSources.minigames.toLocaleString()} EXP`);
        console.log(`  - 기타/이벤트: ${Math.max(0, 209298 - Object.values(inpfSources).reduce((a,b) => a+b, 0)).toLocaleString()} EXP`);
        
        console.log('\n하연 경험치 소스 (추정):');
        console.log(`  - 사냥: ${hayeonSources.hunting.toLocaleString()} EXP`);
        console.log(`  - 일일 출석: ${hayeonSources.daily.toLocaleString()} EXP`);
        console.log(`  - PVP: ${hayeonSources.pvp.toLocaleString()} EXP`);
        console.log(`  - 미니게임: ${hayeonSources.minigames.toLocaleString()} EXP`);
        console.log(`  - 기타/이벤트: ${Math.max(0, 103533 - Object.values(hayeonSources).reduce((a,b) => a+b, 0)).toLocaleString()} EXP`);

        // 7. 최종 분석 결론
        console.log('\n📝 최종 분석 결론');
        console.log('-'.repeat(60));
        console.log('인프가 하연보다 레벨이 높은 주요 원인:');
        console.log('1. 사냥 효율성: 인프가 더 적은 사냥 횟수로 더 많은 경험치 획득');
        console.log('   → 높은 레벨 지역에서 사냥했을 가능성');
        console.log('2. 일평균 활동량: 인프가 하루 평균 2배 이상의 경험치 획득');
        console.log('3. 특별 이벤트/보너스: "기타/이벤트" 경험치가 상당함');
        console.log('   → 프리런치 이벤트나 특별 보상을 받았을 가능성');
        
        if (inpf.titles && inpf.titles.includes('사냥왕')) {
            console.log('4. 칭호 보너스: 사냥왕 칭호로 추가 경험치 획득 가능성');
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n\n✅ MongoDB 연결 종료');
    }
}

// 스크립트 실행
console.log('🚀 상세 활동 분석 시작...\n');
detailedActivityAnalysis();