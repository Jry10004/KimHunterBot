/**
 * 명령어용 안전한 인터랙션 처리 유틸리티
 */

/**
 * 명령어 시작 시 안전하게 defer 처리
 * @param {Interaction} interaction 
 * @param {Object} options - defer 옵션 (flags 등)
 * @returns {Promise<boolean>} 성공 여부
 */
async function safeCommandDefer(interaction, options = {}) {
    try {
        await interaction.deferReply(options);
        return true;
    } catch (error) {
        if (error.code === 10062) {
            console.log(`[${interaction.commandName}] Interaction expired`);
        } else {
            console.error(`[${interaction.commandName}] Defer error:`, error);
        }
        return false;
    }
}

/**
 * 명령어 실행을 위한 표준 래퍼
 * 자동으로 defer 처리하고 에러 핸들링
 * @param {Interaction} interaction 
 * @param {Function} executeFunction - 실제 명령어 로직
 * @param {Object} options - defer 옵션
 */
async function executeCommand(interaction, executeFunction, options = {}) {
    // 기본적으로 ephemeral 사용
    const deferOptions = { flags: 64, ...options };
    
    // defer 처리
    const deferSuccess = await safeCommandDefer(interaction, deferOptions);
    if (!deferSuccess) return;
    
    try {
        // 실제 명령어 로직 실행
        await executeFunction(interaction);
    } catch (error) {
        console.error(`[${interaction.commandName}] 실행 오류:`, error);
        
        // 에러 응답
        try {
            const errorMessage = '❌ 명령어 실행 중 오류가 발생했습니다.';
            
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else if (!interaction.replied) {
                await interaction.reply({ content: errorMessage, flags: 64 });
            }
        } catch (replyError) {
            console.error(`[${interaction.commandName}] 에러 응답 실패:`, replyError);
        }
    }
}

/**
 * 관리자 권한 체크
 * @param {Interaction} interaction 
 * @param {Array<string>} adminIds - 관리자 ID 목록 (선택적)
 * @returns {boolean} 관리자 여부
 */
function isAdmin(interaction, adminIds = null) {
    // 서버 관리자 권한 체크
    if (interaction.member?.permissions?.has('Administrator')) {
        return true;
    }
    
    // 특정 ID 목록 체크
    if (adminIds && Array.isArray(adminIds)) {
        return adminIds.includes(interaction.user.id);
    }
    
    return false;
}

/**
 * 명령어 응답을 안전하게 처리
 * @param {Interaction} interaction 
 * @param {Object} content - 응답 내용
 */
async function safeReply(interaction, content) {
    try {
        if (interaction.deferred) {
            await interaction.editReply(content);
        } else if (!interaction.replied) {
            await interaction.reply(content);
        } else {
            await interaction.followUp(content);
        }
    } catch (error) {
        console.error(`[${interaction.commandName}] 응답 오류:`, error);
    }
}

module.exports = {
    safeCommandDefer,
    executeCommand,
    isAdmin,
    safeReply
};