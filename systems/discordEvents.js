// Discord 클라이언트 이벤트 핸들러
const { handleMainInteraction } = require('../interactionHandler');
const qaLogger = require('./qaLogger');
const messageHandlers = require('./messageHandlers');
const { startMonitoring, stopMonitoring } = require('./interactionMonitor');

// 이벤트 등록 함수
function registerDiscordEvents(client) {
    // 기존 리스너 제거
    client.removeAllListeners('interactionCreate');
    client.removeAllListeners('messageCreate');
    
    // 인터랙션 이벤트
    client.on('interactionCreate', async interaction => {
        console.log(`[DiscordEvents] InteractionCreate - Type: ${interaction.type}, Command: ${interaction.commandName || 'N/A'}, CustomId: ${interaction.customId || 'N/A'}, User: ${interaction.user.id}`);
        
        try {
            // 상호작용 모니터링 시작
            startMonitoring(interaction);
            
            await handleMainInteraction(interaction);
            
            // 상호작용 모니터링 종료
            stopMonitoring(interaction.id);
        } catch (error) {
            console.error('인터랙션 처리 오류:', error);
            
            // Unknown interaction 오류는 무시
            if (error.code === 10062) {
                return;
            }
            
            // QA 로거에 자동 기록
            await qaLogger.logError('인터랙션', error, {
                type: interaction.type,
                commandName: interaction.commandName || 'N/A',
                customId: interaction.customId || 'N/A',
                userId: interaction.user?.id,
                userName: interaction.user?.username,
                channelId: interaction.channel?.id,
                channelName: interaction.channel?.name,
                guildId: interaction.guild?.id,
                timestamp: new Date().toISOString()
            });
            
            // 이미 응답했는지 확인
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ 오류가 발생했습니다! `/버그발견`으로 신고해주세요.',
                        flags: 64
                    });
                } else if (interaction.deferred) {
                    await interaction.editReply({
                        content: '❌ 오류가 발생했습니다! `/버그발견`으로 신고해주세요.'
                    });
                }
            } catch (replyError) {
                // 응답 실패도 무시
                console.error('오류 응답 실패:', replyError);
            }
        }
    });

    // 테스트용 메시지 이벤트 (디버깅용)
    client.on('messageCreate', async (message) => {
        await messageHandlers.handleDebugMessage(message);
    });

    // 메시지 반응 추가 이벤트
    client.on('messageReactionAdd', async (reaction, user) => {
        await messageHandlers.handleMessageReactionAdd(reaction, user);
    });

    // 메시지 반응 제거 이벤트
    client.on('messageReactionRemove', async (reaction, user) => {
        await messageHandlers.handleMessageReactionRemove(reaction, user);
    });

    // 매크로 검증 및 댕댕봇 답변 처리를 위한 메시지 이벤트
    client.on('messageCreate', async (message) => {
        await messageHandlers.handleMacroVerificationMessage(message);
    });
}

module.exports = {
    registerDiscordEvents
};