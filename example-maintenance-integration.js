// 예시: 사냥 명령어에 점검 체크 추가하는 방법

const { replyWithMaintenance } = require('../utils/maintenanceChecker');

// 사냥 명령어 실행 함수 내부
async function executeHunt(interaction) {
    // 점검 체크 (사냥 기능)
    const isUnderMaintenance = await replyWithMaintenance(interaction, 'hunting', '사냥');
    if (isUnderMaintenance) return; // 점검 중이면 종료
    
    // 정상적인 사냥 로직 진행
    // ...
}

// 또는 게임 메뉴에서 체크
async function showGameMenu(interaction) {
    // 전체 게임 점검 체크
    const isUnderMaintenance = await replyWithMaintenance(interaction, 'game', '게임');
    if (isUnderMaintenance) return;
    
    // 정상적인 게임 메뉴 표시
    // ...
}

// PVP 시스템에서 체크
async function startPVP(interaction) {
    // PVP 점검 체크
    const isUnderMaintenance = await replyWithMaintenance(interaction, 'pvp', 'PVP');
    if (isUnderMaintenance) return;
    
    // 정상적인 PVP 로직
    // ...
}