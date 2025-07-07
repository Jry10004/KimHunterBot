// 시세 자동 업데이트 시스템
const { updateMarketPrices } = require('../data/lootMarket');

let updateInterval = null;

// 시세 업데이트 시작
function startMarketUpdater() {
    // 이미 실행 중이면 중복 실행 방지
    if (updateInterval) {
        console.log('시세 업데이터가 이미 실행 중입니다.');
        return;
    }
    
    // 즉시 한번 업데이트
    updateMarketPrices();
    console.log('📊 시세 업데이트 시스템 시작');
    
    // 30초마다 업데이트 (테스트를 위해 1분보다 짧게 설정)
    updateInterval = setInterval(() => {
        updateMarketPrices();
        console.log(`📈 시세 업데이트 완료 - ${new Date().toLocaleTimeString()}`);
    }, 30000); // 30초
}

// 시세 업데이트 중지
function stopMarketUpdater() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
        console.log('📊 시세 업데이트 시스템 중지');
    }
}

module.exports = {
    startMarketUpdater,
    stopMarketUpdater
};