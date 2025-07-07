const qaLogger = require('./qaLogger');

// 상호작용 타임아웃 추적
const interactionTimeouts = new Map();

// 상호작용 모니터링 설정
function setupInteractionMonitor(client) {
    // 상호작용 생성 시 타이머 시작
    client.on('interactionCreate', (interaction) => {
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
    });
    
    // 상호작용 응답 시 타이머 제거
    const originalReply = client.rest.handlers.post;
    client.rest.handlers.post = async function(...args) {
        const [route] = args;
        
        // 상호작용 응답 감지
        if (route && route.includes('/interactions/') && route.includes('/callback')) {
            const interactionId = route.split('/')[2];
            if (interactionTimeouts.has(interactionId)) {
                clearTimeout(interactionTimeouts.get(interactionId));
                interactionTimeouts.delete(interactionId);
            }
        }
        
        return originalReply.apply(this, args);
    };
    
    // Discord API 에러 감지
    client.rest.on('restDebug', async (info) => {
        if (info.includes('Unknown interaction') || info.includes('This interaction has already been acknowledged')) {
            await qaLogger.logWarning('Discord API', info, {
                timestamp: new Date().toISOString()
            });
        }
    });
    
    console.log('✅ 상호작용 모니터 설치 완료');
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
    logInteractionFailure
};