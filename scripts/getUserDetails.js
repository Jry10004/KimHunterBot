const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function getUserDetails() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 하연과 지영 유저 찾기
        const users = await User.find({
            nickname: { $in: ['하연', '지영'] }
        });
        
        if (users.length === 0) {
            console.log('하연 또는 지영 유저를 찾을 수 없습니다.');
            return;
        }
        
        // 각 유저 정보 출력
        for (const user of users) {
            console.log('\n' + '='.repeat(80));
            console.log(`📋 ${user.nickname} 유저 상세 정보`);
            console.log('='.repeat(80));
            
            // 1. 기본 정보
            console.log('\n1️⃣ 기본 정보');
            console.log(`- Discord ID: ${user.discordId}`);
            console.log(`- 레벨: ${user.level}`);
            console.log(`- 골드: ${user.gold.toLocaleString()}G`);
            console.log(`- 경험치: ${user.exp.toLocaleString()}`);
            console.log(`- 인기도: ${user.popularity}`);
            console.log(`- 가입일: ${user.registeredAt || '알 수 없음'}`);
            
            // 2. 스탯 정보
            console.log('\n2️⃣ 스탯 정보');
            console.log(`- 힘(STR): ${user.stats.strength}`);
            console.log(`- 민첩(AGI): ${user.stats.agility}`);
            console.log(`- 지능(INT): ${user.stats.intelligence}`);
            console.log(`- 체력(VIT): ${user.stats.vitality}`);
            console.log(`- 행운(LUK): ${user.stats.luck}`);
            console.log(`- 남은 스탯 포인트: ${user.statPoints}`);
            
            // 3. 전투력
            console.log('\n3️⃣ 전투력');
            console.log(`- 공격력: ${user.attack}`);
            console.log(`- 방어력: ${user.defense}`);
            console.log(`- 체력: ${user.health}`);
            
            // 4. PVP 정보
            console.log('\n4️⃣ PVP 정보');
            console.log(`- 레이팅: ${user.pvpRating || user.pvp?.rating || 1000}`);
            console.log(`- 티어: ${user.pvpTier || user.pvp?.tier || 'Bronze'}`);
            console.log(`- 승리: ${user.pvpWins || user.pvp?.wins || 0}회`);
            console.log(`- 패배: ${user.pvpLosses || user.pvp?.losses || 0}회`);
            console.log(`- 승률: ${((user.pvpWins || user.pvp?.wins || 0) / ((user.pvpWins || user.pvp?.wins || 0) + (user.pvpLosses || user.pvp?.losses || 0)) * 100 || 0).toFixed(1)}%`);
            console.log(`- 최고 레이팅: ${user.pvp?.highestRating || user.pvpRating || 1000}`);
            console.log(`- 연승: ${user.pvpWinStreak || user.pvp?.winStreak || 0}`);
            console.log(`- 최고 연승: ${user.pvpMaxWinStreak || user.pvp?.maxWinStreak || 0}`);
            
            // 5. 컨텐츠 활동 기록
            console.log('\n5️⃣ 컨텐츠 활동 기록');
            console.log(`- 사냥 횟수: ${user.totalHunts || 0}회`);
            console.log(`- 보스 처치: ${user.bossKills || 0}회`);
            console.log(`- 던전 클리어: ${user.dungeonClears || 0}회`);
            console.log(`- 최고 던전층: ${user.dungeonProgress?.bestFloor || 0}층`);
            console.log(`- 던전 총 시도: ${user.dungeonStats?.totalRuns || user.dungeonProgress?.totalAttempts || 0}회`);
            
            // 미니게임 플레이 횟수
            console.log('\n📊 미니게임 플레이 횟수');
            const gameStats = user.gameStats || {};
            let totalGames = 0;
            let totalWins = 0;
            
            const games = [
                { key: 'dice', name: '주사위' },
                { key: 'slot', name: '슬롯머신' },
                { key: 'rps', name: '가위바위보' },
                { key: 'quiz', name: '퀴즈' },
                { key: 'blackjack', name: '블랙잭' },
                { key: 'oddeven', name: '홀짝' },
                { key: 'mushroom', name: '독버섯' },
                { key: 'chosung', name: '초성게임' },
                { key: 'wordchain', name: '끝말잇기' },
                { key: 'tictactoe', name: '틱택토' }
            ];
            
            games.forEach(game => {
                const played = gameStats[game.key]?.played || 0;
                const won = gameStats[game.key]?.won || 0;
                if (played > 0) {
                    console.log(`  - ${game.name}: ${played}회 (승리: ${won}회, 승률: ${(won/played*100).toFixed(1)}%)`);
                    totalGames += played;
                    totalWins += won;
                }
            });
            
            console.log(`\n  📌 총 미니게임: ${totalGames}회 (승리: ${totalWins}회, 전체 승률: ${totalGames > 0 ? (totalWins/totalGames*100).toFixed(1) : 0}%)`);
            
            // PVP 대전 횟수
            console.log(`\n- PVP 대전 횟수: ${user.pvp?.totalDuels || ((user.pvpWins || 0) + (user.pvpLosses || 0))}회`);
            
            // 출석 일수
            const today = new Date().toLocaleDateString('ko-KR');
            const lastDaily = user.lastDaily;
            const attendanceCount = user.weeklyAttendance?.filter(day => day).length || 0;
            console.log(`- 이번 주 출석: ${attendanceCount}/7일`);
            console.log(`- 연속 출석: ${user.attendanceStreak || 0}일`);
            console.log(`- 마지막 출석: ${lastDaily || '없음'}`);
            
            // 6. 보유 티켓 현황
            console.log('\n6️⃣ 보유 티켓 현황');
            console.log(`- 사냥 티켓: ${user.huntingTickets || 0}/20`);
            console.log(`- PVP 티켓: ${user.pvpTickets || user.pvp?.duelTickets || 0}/20`);
            console.log(`- 던전 티켓: ${user.dungeonTickets || 0}/5`);
            console.log(`- 레이드 티켓: ${user.raidTickets || 0}/3`);
            console.log(`- 미니게임 티켓: ${user.minigameTickets?.tickets || 0}/20`);
            console.log(`- 가위바위보 봇 티켓: ${user.rpsGameData?.botTickets || 0}/20`);
            console.log(`- 가위바위보 유저 티켓: ${user.rpsGameData?.userTickets || 0}/20`);
            
            // 7. 장비/아이템 정보
            console.log('\n7️⃣ 장비/아이템 정보');
            console.log(`- 인벤토리 아이템 수: ${user.inventory?.length || 0}개`);
            console.log(`- 최대 슬롯: ${user.maxInventorySlots || 50}개`);
            
            // 장착 장비
            console.log('\n🛡️ 장착 중인 장비:');
            const equipmentSlots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];
            equipmentSlots.forEach(slot => {
                const slotIndex = user.equipment?.[slot];
                if (slotIndex && slotIndex !== -1) {
                    const item = user.inventory?.find(i => i.inventorySlot === slotIndex);
                    if (item) {
                        const slotName = {
                            weapon: '무기',
                            armor: '갑옷',
                            helmet: '투구',
                            gloves: '장갑',
                            boots: '신발',
                            accessory: '장신구'
                        }[slot];
                        console.log(`  - ${slotName}: ${item.name} (+${item.enhanceLevel || 0}강)`);
                    }
                }
            });
            
            // 강화 통계
            console.log('\n⚒️ 강화 통계:');
            console.log(`  - 총 시도: ${user.enhanceStats?.totalAttempts || 0}회`);
            console.log(`  - 성공: ${user.enhanceStats?.successCount || 0}회`);
            console.log(`  - 파괴: ${user.enhanceStats?.destroyCount || 0}회`);
            console.log(`  - 최고 강화: +${user.enhanceStats?.maxEnhanceLevel || 0}`);
            console.log(`  - 사용 골드: ${(user.enhanceStats?.totalCost || 0).toLocaleString()}G`);
            
            // 기타 정보
            console.log('\n8️⃣ 기타 활동');
            console.log(`- 엠블럼: ${user.emblem || '없음'}`);
            console.log(`- 칭호: ${user.equippedTitle || '없음'}`);
            console.log(`- 에너지 조각 최고 레벨: ${user.energyFragments?.highestLevel || 0}`);
            console.log(`- 유물 보유: ${user.artifacts?.length || 0}개`);
            console.log(`- 주식 투자액: ${(user.stockPortfolio?.totalInvested || 0).toLocaleString()}G`);
            console.log(`- 레이싱 참가: ${user.racingStats?.totalRaces || 0}회`);
            console.log(`- 운동 레벨: ${user.fitness?.level || 1}`);
            console.log(`- 낚시 통계: ${user.fishing?.stats?.totalCaught || 0}마리`);
        }
        
        console.log('\n' + '='.repeat(80));
        
    } catch (error) {
        console.error('에러 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nMongoDB 연결 종료');
    }
}

getUserDetails();