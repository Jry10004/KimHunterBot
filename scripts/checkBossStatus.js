const worldBossSystem = require('../systems/worldBossSystem');

console.log('=== 보스 시스템 상태 확인 ===');
console.log('activeWorldBoss:', worldBossSystem.activeWorldBoss);
console.log('SPAWN_CHANNEL_ID:', worldBossSystem.SPAWN_CHANNEL_ID);
console.log('lastSpawnTime:', new Date(worldBossSystem.lastSpawnTime).toLocaleString('ko-KR'));
console.log('canSpawnBoss:', worldBossSystem.canSpawnBoss());

if (worldBossSystem.activeWorldBoss) {
    console.log('\n=== 활성 보스 정보 ===');
    console.log('보스 이름:', worldBossSystem.activeWorldBoss.boss.name);
    console.log('현재 HP:', worldBossSystem.activeWorldBoss.currentHp);
    console.log('최대 HP:', worldBossSystem.activeWorldBoss.maxHp);
    console.log('참가자 수:', worldBossSystem.activeWorldBoss.participants.length);
    console.log('메시지 ID:', worldBossSystem.activeWorldBoss.messageId);
    console.log('채널 ID:', worldBossSystem.activeWorldBoss.channelId);
}

process.exit(0);