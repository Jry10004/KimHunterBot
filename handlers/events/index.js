const { 
    handlePrelaunchEventButton,
    startPrelaunchEvent,
    loadPrelaunchData,
    savePrelaunchData 
} = require('./prelaunchEvent');

const {
    scheduleDogBotEvent,
    rememberDogChannel,
    checkDogBotAnswer,
    triggerDogBotEvent
} = require('./dogBotEvent');

// 이벤트 인터랙션 핸들러
async function handleEventInteraction(interaction) {
    const customId = interaction.customId;
    
    // 사전강화 이벤트 버튼
    if (customId === 'prelaunch_event_info' || customId === 'prelaunch_leaderboard') {
        return await handlePrelaunchEventButton(interaction);
    }
    
    // 추가 이벤트 처리는 여기에
}

// 모든 이벤트 초기화
function initializeAllEvents(client) {
    // 사전강화 이벤트 시작 - 이벤트 종료로 비활성화
    // startPrelaunchEvent(client);
    
    // 댕댕봇 이벤트 스케줄러 시작 - 댕댕봇 구출 이벤트 중에는 비활성화
    // scheduleDogBotEvent(client);
    
    // 뉴스 시스템 초기화
    const newsSystem = require('../../systems/newsSystem');
    if (newsSystem && newsSystem.setClient) {
        newsSystem.setClient(client);
        console.log('✅ 뉴스 시스템 클라이언트 설정 완료');
    }
    
    // 광산 시스템 초기화
    const { initializeMineScheduler } = require('../../systems/mineScheduler');
    initializeMineScheduler(client);
    console.log('✅ 광산 시스템 스케줄러 시작');
    
    // 추가 이벤트 초기화는 여기에
}

module.exports = {
    handleEventInteraction,
    initializeAllEvents,
    loadPrelaunchData,
    savePrelaunchData,
    checkDogBotAnswer,
    rememberDogChannel,
    triggerDogBotEvent
};