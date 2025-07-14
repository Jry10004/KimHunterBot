const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function analyzeLevelDifference() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/discord_bot');
        console.log('✅ MongoDB 연결 성공\n');

        // 인프와 하연 유저 찾기
        const inpf = await User.findOne({ discordId: '1374702838541168650' }) || 
                     await User.findOne({ discordId: '592659577384730645' });
        const hayeon = await User.findOne({ discordId: '295980447849250817' });

        if (!inpf || !hayeon) {
            console.log('❌ 유저를 찾을 수 없습니다.');
            console.log(`인프: ${inpf ? '찾음' : '없음'}`);
            console.log(`하연: ${hayeon ? '찾음' : '없음'}`);
            
            // 닉네임으로 재검색
            if (!inpf) {
                const inpfByNick = await User.findOne({ nickname: { $regex: '인프', $options: 'i' } });
                if (inpfByNick) {
                    console.log(`\n인프 닉네임으로 발견: ${inpfByNick.discordId}`);
                }
            }
            if (!hayeon) {
                const hayeonByNick = await User.findOne({ nickname: { $regex: '하연', $options: 'i' } });
                if (hayeonByNick) {
                    console.log(`하연 닉네임으로 발견: ${hayeonByNick.discordId}`);
                }
            }
            return;
        }

        console.log('='.repeat(80));
        console.log('📊 인프와 하연의 레벨 차이 분석');
        console.log('='.repeat(80));

        // 1. 기본 정보
        console.log('\n📌 기본 정보');
        console.log('-'.repeat(60));
        console.log(`인프:`);
        console.log(`  - 닉네임: ${inpf.nickname}`);
        console.log(`  - Discord ID: ${inpf.discordId}`);
        console.log(`  - 레벨: ${inpf.level}`);
        console.log(`  - 경험치: ${inpf.exp.toLocaleString()} / ${(inpf.level * 100).toLocaleString()}`);
        console.log(`  - 골드: ${inpf.gold.toLocaleString()}G`);
        console.log(`  - 가입일: ${inpf.registeredAt || inpf.createdAt}`);

        console.log(`\n하연:`);
        console.log(`  - 닉네임: ${hayeon.nickname}`);
        console.log(`  - Discord ID: ${hayeon.discordId}`);
        console.log(`  - 레벨: ${hayeon.level}`);
        console.log(`  - 경험치: ${hayeon.exp.toLocaleString()} / ${(hayeon.level * 100).toLocaleString()}`);
        console.log(`  - 골드: ${hayeon.gold.toLocaleString()}G`);
        console.log(`  - 가입일: ${hayeon.registeredAt || hayeon.createdAt}`);

        // 2. 총 누적 경험치 계산
        function getTotalExp(user) {
            let total = 0;
            for (let i = 1; i < user.level; i++) {
                total += i * 100;
            }
            total += user.exp;
            return total;
        }

        const inpfTotalExp = getTotalExp(inpf);
        const hayeonTotalExp = getTotalExp(hayeon);

        console.log('\n📈 누적 경험치 분석');
        console.log('-'.repeat(60));
        console.log(`인프 총 누적 경험치: ${inpfTotalExp.toLocaleString()} EXP`);
        console.log(`하연 총 누적 경험치: ${hayeonTotalExp.toLocaleString()} EXP`);
        console.log(`경험치 차이: ${(inpfTotalExp - hayeonTotalExp).toLocaleString()} EXP (${((inpfTotalExp / hayeonTotalExp - 1) * 100).toFixed(1)}% 더 많음)`);

        // 3. 활동량 비교
        console.log('\n🎮 활동량 비교');
        console.log('-'.repeat(60));
        console.log(`사냥 횟수:`);
        console.log(`  - 인프: ${inpf.totalHunts || 0}회`);
        console.log(`  - 하연: ${hayeon.totalHunts || 0}회`);
        console.log(`  - 차이: ${(inpf.totalHunts || 0) - (hayeon.totalHunts || 0)}회`);

        console.log(`\n던전 클리어:`);
        console.log(`  - 인프: ${inpf.dungeonClears || 0}회`);
        console.log(`  - 하연: ${hayeon.dungeonClears || 0}회`);
        console.log(`  - 차이: ${(inpf.dungeonClears || 0) - (hayeon.dungeonClears || 0)}회`);

        console.log(`\n보스 처치:`);
        console.log(`  - 인프: ${inpf.bossKills || 0}회`);
        console.log(`  - 하연: ${hayeon.bossKills || 0}회`);
        console.log(`  - 차이: ${(inpf.bossKills || 0) - (hayeon.bossKills || 0)}회`);

        // 4. PVP 활동
        console.log('\n⚔️ PVP 활동');
        console.log('-'.repeat(60));
        if (inpf.pvp && hayeon.pvp) {
            console.log(`전적:`);
            console.log(`  - 인프: ${inpf.pvp.wins}승 ${inpf.pvp.losses}패 (승률 ${((inpf.pvp.wins / (inpf.pvp.wins + inpf.pvp.losses) * 100) || 0).toFixed(1)}%)`);
            console.log(`  - 하연: ${hayeon.pvp.wins}승 ${hayeon.pvp.losses}패 (승률 ${((hayeon.pvp.wins / (hayeon.pvp.wins + hayeon.pvp.losses) * 100) || 0).toFixed(1)}%)`);
            console.log(`\n레이팅:`);
            console.log(`  - 인프: ${inpf.pvp.rating} (${inpf.pvp.tier} ${inpf.pvp.division})`);
            console.log(`  - 하연: ${hayeon.pvp.rating} (${hayeon.pvp.tier} ${hayeon.pvp.division})`);
        }

        // 5. 게임 플레이 일수 계산
        const inpfPlayDays = Math.floor((Date.now() - new Date(inpf.registeredAt || inpf.createdAt)) / (1000 * 60 * 60 * 24));
        const hayeonPlayDays = Math.floor((Date.now() - new Date(hayeon.registeredAt || hayeon.createdAt)) / (1000 * 60 * 60 * 24));

        console.log('\n📅 플레이 기간 분석');
        console.log('-'.repeat(60));
        console.log(`인프: ${inpfPlayDays}일 플레이`);
        console.log(`하연: ${hayeonPlayDays}일 플레이`);
        console.log(`차이: ${Math.abs(inpfPlayDays - hayeonPlayDays)}일`);
        console.log(`\n일평균 레벨업:`);
        console.log(`  - 인프: ${(inpf.level / inpfPlayDays).toFixed(2)} 레벨/일`);
        console.log(`  - 하연: ${(hayeon.level / hayeonPlayDays).toFixed(2)} 레벨/일`);
        console.log(`\n일평균 경험치:`);
        console.log(`  - 인프: ${Math.floor(inpfTotalExp / inpfPlayDays).toLocaleString()} EXP/일`);
        console.log(`  - 하연: ${Math.floor(hayeonTotalExp / hayeonPlayDays).toLocaleString()} EXP/일`);

        // 6. 미니게임 활동
        console.log('\n🎲 미니게임 활동');
        console.log('-'.repeat(60));
        if (inpf.gameStats && hayeon.gameStats) {
            const games = ['dice', 'slot', 'rps', 'quiz', 'blackjack', 'oddeven', 'mushroom', 'chosung', 'wordchain', 'tictactoe'];
            let inpfTotal = 0, hayeonTotal = 0;
            
            games.forEach(game => {
                if (inpf.gameStats[game]) inpfTotal += inpf.gameStats[game].played || 0;
                if (hayeon.gameStats[game]) hayeonTotal += hayeon.gameStats[game].played || 0;
            });
            
            console.log(`총 미니게임 플레이:`);
            console.log(`  - 인프: ${inpfTotal}회`);
            console.log(`  - 하연: ${hayeonTotal}회`);
        }

        // 7. 레벨 차이 원인 분석
        console.log('\n💡 레벨 차이 주요 원인 분석');
        console.log('-'.repeat(60));
        
        const reasons = [];
        
        // 플레이 기간
        if (inpfPlayDays > hayeonPlayDays) {
            reasons.push(`✓ 인프가 ${inpfPlayDays - hayeonPlayDays}일 더 오래 플레이`);
        }
        
        // 일평균 경험치
        const inpfDailyExp = inpfTotalExp / inpfPlayDays;
        const hayeonDailyExp = hayeonTotalExp / hayeonPlayDays;
        if (inpfDailyExp > hayeonDailyExp) {
            reasons.push(`✓ 인프의 일평균 경험치가 ${((inpfDailyExp / hayeonDailyExp - 1) * 100).toFixed(1)}% 더 높음`);
        }
        
        // 사냥 활동
        if ((inpf.totalHunts || 0) > (hayeon.totalHunts || 0)) {
            reasons.push(`✓ 인프가 사냥을 ${(inpf.totalHunts || 0) - (hayeon.totalHunts || 0)}회 더 많이 함`);
        }
        
        // 던전 활동
        if ((inpf.dungeonClears || 0) > (hayeon.dungeonClears || 0)) {
            reasons.push(`✓ 인프가 던전을 ${(inpf.dungeonClears || 0) - (hayeon.dungeonClears || 0)}회 더 많이 클리어`);
        }
        
        // 특별 이벤트나 보너스
        if (inpf.titles && inpf.titles.length > 0) {
            reasons.push(`✓ 인프가 칭호 ${inpf.titles.length}개 보유 (추가 보너스 가능성)`);
        }
        
        reasons.forEach(reason => console.log(reason));
        
        // 8. 예상 따라잡기 시간
        console.log('\n⏰ 예상 따라잡기 시간');
        console.log('-'.repeat(60));
        if (hayeonDailyExp > 0) {
            const expDifference = inpfTotalExp - hayeonTotalExp;
            const daysToLevelUp = Math.ceil(expDifference / hayeonDailyExp);
            console.log(`현재 속도로 하연이 인프를 따라잡으려면: 약 ${daysToLevelUp}일 필요`);
            console.log(`(하연의 일평균 ${Math.floor(hayeonDailyExp).toLocaleString()} EXP 기준)`);
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n\n✅ MongoDB 연결 종료');
    }
}

// 스크립트 실행
console.log('🚀 레벨 차이 분석 시작...\n');
analyzeLevelDifference();