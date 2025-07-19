require('dotenv').config();
const connectDB = require('../database/connection');
const worldBossSystem = require('../systems/worldBossSystem');
const fs = require('fs');
const path = require('path');

async function forceWorldBossSpawn() {
    try {
        await connectDB();
        console.log('=== 월드보스 강제 소환 ===\n');
        
        // 현재 상태 출력
        console.log('현재 활성 보스:', worldBossSystem.activeWorldBoss ? '있음' : '없음');
        console.log('마지막 소환 시간:', new Date(worldBossSystem.lastSpawnTime).toLocaleString('ko-KR'));
        console.log('소환 쿨다운:', worldBossSystem.SPAWN_COOLDOWN / 60000, '분');
        console.log('자동 소환 인터벌:', worldBossSystem.spawnCheckInterval ? '실행중' : '정지됨');
        
        // 마지막 소환 시간을 2시간 전으로 설정
        const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
        worldBossSystem.lastSpawnTime = twoHoursAgo;
        
        // 상태 파일 업데이트
        const stateFile = path.join(__dirname, '..', 'data', 'bossState.json');
        const state = {
            lastSpawnTime: twoHoursAgo,
            activeWorldBoss: null
        };
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
        
        console.log('\n마지막 소환 시간을 2시간 전으로 설정했습니다.');
        console.log('새로운 마지막 소환 시간:', new Date(twoHoursAgo).toLocaleString('ko-KR'));
        console.log('\n이제 봇에서 자동 소환이 가능합니다!');
        console.log('또는 관리자가 /보스소환 명령어를 사용할 수 있습니다.');
        
        // canSpawnBoss 체크
        const canSpawn = await worldBossSystem.canSpawnBoss();
        console.log('\n소환 가능 여부:', canSpawn);
        
        process.exit(0);
    } catch (error) {
        console.error('오류:', error);
        process.exit(1);
    }
}

forceWorldBossSpawn();