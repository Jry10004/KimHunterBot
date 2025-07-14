// 안전한 인터랙션 처리 유틸리티
const { errorHandler, GameError } = require('../systems/enhancedErrorHandler');

/**
 * 인터랙션을 안전하게 처리하는 래퍼 함수
 * @param {Interaction} interaction Discord 인터랙션
 * @param {Function} handler 실행할 핸들러 함수
 * @param {Object} options 옵션
 */
async function safeInteractionHandler(interaction, handler, options = {}) {
    const {
        ephemeral = true,
        deferReply = false,
        requireUser = false
    } = options;

    try {
        // 이미 응답했는지 확인
        if (interaction.replied || interaction.deferred) {
            return;
        }

        // defer 옵션이 있으면 먼저 defer
        if (deferReply) {
            await interaction.deferReply({ ephemeral });
        }

        // 사용자 정보가 필요한 경우
        if (requireUser) {
            const User = require('../models/User');
            const user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user) {
                throw new GameError('먼저 회원가입을 해주세요.', 'USER_NOT_REGISTERED');
            }

            // 핸들러 실행 (user 전달)
            await handler(interaction, user);
        } else {
            // 핸들러 실행
            await handler(interaction);
        }

    } catch (error) {
        // 에러 처리
        const userMessage = await errorHandler.handleError(error, {
            interactionType: interaction.type,
            commandName: interaction.commandName || 'N/A',
            customId: interaction.customId || 'N/A',
            userId: interaction.user?.id,
            userName: interaction.user?.username,
            channelId: interaction.channel?.id,
            guildId: interaction.guild?.id
        });

        // 사용자에게 에러 메시지 전송
        try {
            const errorEmbed = errorHandler.createErrorEmbed(error, {
                user: interaction.user.username
            });

            if (interaction.deferred) {
                await interaction.editReply({
                    content: userMessage,
                    embeds: [errorEmbed],
                    components: []
                });
            } else if (!interaction.replied) {
                await interaction.reply({
                    content: userMessage,
                    embeds: [errorEmbed],
                    flags: 64
                });
            }
        } catch (replyError) {
            // 응답 실패도 로깅
            console.error('에러 응답 전송 실패:', replyError);
        }
    }
}

/**
 * 여러 인터랙션 핸들러를 안전하게 등록
 * @param {Client} client Discord 클라이언트
 * @param {Object} handlers 핸들러 맵
 */
function registerSafeHandlers(client, handlers) {
    client.on('interactionCreate', async (interaction) => {
        // 명령어 타입별 처리
        if (interaction.isChatInputCommand()) {
            const handler = handlers.commands?.[interaction.commandName];
            if (handler) {
                await safeInteractionHandler(interaction, handler, handler.options);
            }
        } 
        // 버튼 처리
        else if (interaction.isButton()) {
            // customId에서 핸들러 찾기
            for (const [prefix, handler] of Object.entries(handlers.buttons || {})) {
                if (interaction.customId.startsWith(prefix)) {
                    await safeInteractionHandler(interaction, handler, handler.options);
                    break;
                }
            }
        }
        // 선택 메뉴 처리
        else if (interaction.isStringSelectMenu()) {
            for (const [prefix, handler] of Object.entries(handlers.selectMenus || {})) {
                if (interaction.customId.startsWith(prefix)) {
                    await safeInteractionHandler(interaction, handler, handler.options);
                    break;
                }
            }
        }
        // 모달 처리
        else if (interaction.isModalSubmit()) {
            for (const [prefix, handler] of Object.entries(handlers.modals || {})) {
                if (interaction.customId.startsWith(prefix)) {
                    await safeInteractionHandler(interaction, handler, handler.options);
                    break;
                }
            }
        }
    });
}

/**
 * 안전한 비동기 함수 실행
 * @param {Function} fn 실행할 함수
 * @param {any} context 컨텍스트 정보
 * @returns {Promise<any>}
 */
async function safeExecute(fn, context = {}) {
    try {
        return await fn();
    } catch (error) {
        await errorHandler.handleError(error, context);
        throw error; // 에러를 다시 throw하여 호출자가 처리할 수 있도록 함
    }
}

/**
 * 재시도 로직이 포함된 안전한 실행
 * @param {Function} fn 실행할 함수
 * @param {Object} options 옵션
 * @returns {Promise<any>}
 */
async function safeExecuteWithRetry(fn, options = {}) {
    const {
        maxRetries = 3,
        retryDelay = 1000,
        context = {}
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries) {
                console.log(`재시도 ${attempt}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            }
        }
    }

    // 모든 재시도 실패
    await errorHandler.handleError(lastError, {
        ...context,
        retryAttempts: maxRetries
    });
    
    throw lastError;
}

module.exports = {
    safeInteractionHandler,
    registerSafeHandlers,
    safeExecute,
    safeExecuteWithRetry
};