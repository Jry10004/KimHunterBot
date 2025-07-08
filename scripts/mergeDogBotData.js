// 프로덕션 모드 강제 설정
process.env.NODE_ENV = 'production';

const stateManager = require('../systems/dogBotStateManager');

async function mergeDogBotData() {
    console.log('댕댕봇 데이터 병합 시작...');
    
    // 상태 재로드
    stateManager.initializeState();
    
    // 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('현재 데이터 상태:');
    console.log('1282609444151681186:', {
        damage: stateManager.state.statistics.userDamage['1282609444151681186'],
        attacks: stateManager.state.statistics.userAttackCount['1282609444151681186']
    });
    console.log('424480594542592009:', {
        damage: stateManager.state.statistics.userDamage['424480594542592009'],
        attacks: stateManager.state.statistics.userAttackCount['424480594542592009']
    });
    
    // 병합 실행
    await stateManager.mergeUserData('1282609444151681186', '424480594542592009');
    
    console.log('\n병합 후 데이터:');
    console.log('424480594542592009:', {
        damage: stateManager.state.statistics.userDamage['424480594542592009'],
        attacks: stateManager.state.statistics.userAttackCount['424480594542592009']
    });
    
    console.log('\n병합 완료!');
    process.exit(0);
}

// 실행
mergeDogBotData();