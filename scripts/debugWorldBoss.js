require('dotenv').config();
const connectDB = require('../database/connection');
const worldBossSystem = require('../systems/worldBossSystem');

async function checkWorldBoss() {
    try {
        await connectDB();
        console.log('=== 월드보스 시스템 디버그 ===');
        console.log('활성 월드보스:', worldBossSystem.activeWorldBoss ? '있음' : '없음');
        if (worldBossSystem.activeWorldBoss) {
            console.log('- 보스 이름:', worldBossSystem.activeWorldBoss.boss.name);
            console.log('- 현재 HP:', worldBossSystem.activeWorldBoss.currentHp);
            console.log('- 최대 HP:', worldBossSystem.activeWorldBoss.maxHp);
            console.log('- 참가자:', worldBossSystem.activeWorldBoss.participants.length);
        }
        console.log('마지막 소환 시간:', new Date(worldBossSystem.lastSpawnTime).toLocaleString('ko-KR'));
        console.log('다음 소환 가능 시간:', new Date(worldBossSystem.lastSpawnTime + worldBossSystem.SPAWN_COOLDOWN).toLocaleString('ko-KR'));
        console.log('소환 쿨다운:', worldBossSystem.SPAWN_COOLDOWN / 60000, '분');
        console.log('소환 가능 여부:', await worldBossSystem.canSpawnBoss());
        console.log('자동 소환 인터벌:', worldBossSystem.spawnCheckInterval ? '실행중' : '정지됨');
        
        // 보스 상태 파일 확인
        const fs = require('fs');
        const path = require('path');
        const stateFile = path.join(__dirname, '..', 'data', 'bossState.json');
        if (fs.existsSync(stateFile)) {
            const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            console.log('\n=== 보스 상태 파일 ===');
            console.log('lastSpawnTime:', state.lastSpawnTime ? new Date(state.lastSpawnTime).toLocaleString('ko-KR') : '없음');
            console.log('activeBoss:', state.activeBoss ? '있음' : '없음');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('오류:', error);
        process.exit(1);
    }
}

checkWorldBoss();