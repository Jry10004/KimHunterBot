const qaLogger = require('./qaLogger');

// 상호작용 타임아웃 추적
const interactionTimeouts = new Map();

// 상호작용 모니터링 설정
function setupInteractionMonitor(client) {
    // interactionCreate 이벤트는 discordEvents.js에서 처리하므로 여기서는 제거
    // 대신 모니터링 함수만 제공
    console.log('✅ 상호작용 모니터 초기화 완료');
}

// 상호작용 모니터링 시작
function startMonitoring(interaction) {
    const interactionId = interaction.id;
    
    // 5초 후 응답이 없으면 상호작용 실패로 간주
    const timeoutId = setTimeout(async () => {
        if (!interaction.replied && !interaction.deferred) {
            // 상호작용 실패 로깅
            await qaLogger.logError('상호작용 타임아웃', new Error('5초 내 응답 없음'), {
                type: interaction.type,
                commandName: interaction.commandName || 'N/A',
                customId: interaction.customId || 'N/A',
                userId: interaction.user?.id,
                userName: interaction.user?.username,
                channelName: interaction.channel?.name,
                guildName: interaction.guild?.name,
                timestamp: new Date().toISOString()
            });
            
            console.warn(`⚠️ 상호작용 타임아웃: ${interactionId}`);
        }
        
        interactionTimeouts.delete(interactionId);
    }, 5000);
    
    interactionTimeouts.set(interactionId, timeoutId);
}

// 상호작용 모니터링 종료
function stopMonitoring(interactionId) {
    if (interactionTimeouts.has(interactionId)) {
        clearTimeout(interactionTimeouts.get(interactionId));
        interactionTimeouts.delete(interactionId);
    }
}

// 상호작용 실패 직접 로깅
async function logInteractionFailure(interaction, reason = 'Unknown') {
    await qaLogger.logError('상호작용 실패', new Error(reason), {
        type: interaction.type,
        commandName: interaction.commandName || 'N/A',
        customId: interaction.customId || 'N/A',
        userId: interaction.user?.id,
        userName: interaction.user?.username,
        channelName: interaction.channel?.name,
        reason: reason,
        timestamp: new Date().toISOString()
    });
}

module.exports = {
    setupInteractionMonitor,
    startMonitoring,
    stopMonitoring,
    logInteractionFailure
};