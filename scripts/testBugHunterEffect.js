const mongoose = require('mongoose');
const User = require('../models/User');
const { applyGoldBonus, applyMinigameBonus } = require('../handlers/common/specialEffects');
require('dotenv').config();

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI);

async function testBugHunterEffect() {
    console.log('🧪 버그 사냥꾼 칭호 효과 테스트\n');
    
    // 버그 사냥꾼 칭호를 가진 유저 찾기
    const bugHunter = await User.findOne({ equippedTitle: '버그 사냥꾼' });
    
    if (!bugHunter) {
        console.log('❌ 버그 사냥꾼 칭호를 가진 유저가 없습니다.');
        process.exit(0);
    }
    
    console.log(`👤 테스트 유저: ${bugHunter.nickname || bugHunter.discordId}`);
    console.log(`   칭호: ${bugHunter.equippedTitle}\n`);
    
    // 기본 보상 테스트
    const baseReward = 1000;
    
    console.log('1️⃣ applyGoldBonus 테스트 (PVP, 보스레이드, 사냥 등에서 사용)');
    const goldBonusResult = applyGoldBonus(baseReward, bugHunter);
    console.log(`   기본 보상: ${baseReward}G → 최종 보상: ${goldBonusResult}G\n`);
    
    console.log('2️⃣ applyMinigameBonus 테스트 (미니게임에서 사용)');
    const minigameBonusResult = applyMinigameBonus(baseReward, bugHunter);
    console.log(`   기본 보상: ${baseReward}G → 최종 보상: ${minigameBonusResult}G\n`);
    
    console.log('📊 결과 분석:');
    if (goldBonusResult > baseReward) {
        console.log('✅ applyGoldBonus: 버그 사냥꾼 효과 정상 적용');
    } else {
        console.log('❌ applyGoldBonus: 버그 사냥꾼 효과 미적용');
    }
    
    if (minigameBonusResult > baseReward) {
        console.log('✅ applyMinigameBonus: 버그 사냥꾼 효과 정상 적용 (수정됨)');
    } else {
        console.log('❌ applyMinigameBonus: 버그 사냥꾼 효과 미적용');
    }
    
    process.exit(0);
}

testBugHunterEffect().catch(console.error);