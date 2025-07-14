const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI);

async function monitorBugHunterTitle() {
    console.log('🔍 버그 사냥꾼 칭호 효과 모니터링 시작...\n');
    
    // 버그 사냥꾼 칭호를 가진 모든 유저 찾기
    const bugHunters = await User.find({ equippedTitle: '버그 사냥꾼' });
    
    console.log(`📊 버그 사냥꾼 칭호 보유자: ${bugHunters.length}명\n`);
    
    for (const user of bugHunters) {
        console.log(`👤 유저: ${user.nickname || user.discordId}`);
        console.log(`   - 레벨: ${user.level}`);
        console.log(`   - 골드: ${user.gold.toLocaleString()}G`);
        console.log(`   - 칭호: ${user.equippedTitle}`);
        console.log('');
    }
    
    console.log('\n❌ 골드 보너스가 적용되지 않는 시스템들:');
    console.log('   - 슬롯머신 (handlers/minigames/slotMachine.js)');
    console.log('   - 버섯 게임 (handlers/minigames/mushroomGame.js)');
    console.log('   - 몬스터 배틀 (handlers/minigames/monsterBattle.js)');
    console.log('   - 유물 탐사 (handlers/economy/artifactExploration.js)');
    console.log('   - 상점 판매 (systems/sellSystem.js)');
    console.log('   - 퀘스트 (handlers/daily/quest.js)');
    console.log('   - 토너먼트 (handlers/daily/huntingTournament.js)');
    console.log('   - 롤 인하우스 (handlers/minigames/lolInhouse.js)');
    
    console.log('\n⚠️ 미니게임 보너스만 적용되는 시스템들 (골드 보너스 미적용):');
    console.log('   - 가위바위보 (applyMinigameBonus 사용)');
    console.log('   - 단어 게임 (applyMinigameBonus 사용)');
    
    console.log('\n✅ 골드 보너스가 정상 적용되는 시스템들:');
    console.log('   - PVP 시스템');
    console.log('   - 보스 레이드');
    console.log('   - 월드 보스');
    console.log('   - 사냥');
    console.log('   - 미션 보상');
    console.log('   - 강화 시스템');
    
    console.log('\n💡 권장사항:');
    console.log('   1. 미니게임에서 applyMinigameBonus 대신 골드 보너스도 함께 적용');
    console.log('   2. 모든 골드 획득 시스템에서 applyGoldBonus 사용 통일');
    console.log('   3. 또는 applyMinigameBonus에 골드 보너스 효과 추가');
    
    process.exit(0);
}

monitorBugHunterTitle().catch(console.error);