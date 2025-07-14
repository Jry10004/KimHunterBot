// 향상된 상호작용 처리 유틸리티

/**
 * 안전한 defer 처리 - 모든 상황을 처리
 * @param {Interaction} interaction 
 * @param {Object} options 
 * @returns {Object} { success: boolean, alreadyHandled: boolean, expired: boolean }
 */
async function safeDefer(interaction, options = {}) {
    // 이미 처리된 경우
    if (interaction.deferred || interaction.replied) {
        return { success: true, alreadyHandled: true };
    }
    
    try {
        // 버튼이나 선택 메뉴는 deferUpdate 사용
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isUserSelectMenu() || interaction.isChannelSelectMenu()) {
            await interaction.deferUpdate();
        } else {
            // 명령어나 모달은 deferReply 사용
            await interaction.deferReply(options);
        }
        return { success: true, alreadyHandled: false };
    } catch (error) {
        // Unknown interaction (타임아웃)
        if (error.code === 10062) {
            console.log('[InteractionUtils] Interaction expired:', interaction.customId || interaction.commandName);
            return { success: false, expired: true, error };
        } 
        // Already acknowledged
        else if (error.code === 40060) {
            console.log('[InteractionUtils] Already acknowledged');
            return { success: true, alreadyHandled: true };
        } 
        // 기타 오류
        else {
            console.error('[InteractionUtils] Defer error:', error.message);
            return { success: false, expired: false, error };
        }
    }
}

/**
 * 안전한 응답 처리
 * @param {Interaction} interaction 
 * @param {Object} response 
 * @returns {boolean} 성공 여부
 */
async function safeReply(interaction, response) {
    try {
        if (interaction.deferred) {
            await interaction.editReply(response);
        } else if (interaction.replied) {
            await interaction.followUp({ ...response, flags: response.flags || 64 });
        } else {
            await interaction.reply(response);
        }
        return true;
    } catch (error) {
        if (error.code === 10062) {
            console.log('[InteractionUtils] Cannot reply - interaction expired');
        } else if (error.code === 40060) {
            console.log('[InteractionUtils] Cannot reply - already acknowledged');
        } else {
            console.error('[InteractionUtils] Reply error:', error.message);
        }
        return false;
    }
}

/**
 * 타임아웃 안전 처리 래퍼
 * @param {Interaction} interaction 
 * @param {Function} handler 
 * @param {Object} options 
 */
async function handleInteractionSafely(interaction, handler, options = {}) {
    const { requireDefer = true, deferOptions = { flags: 64 } } = options;
    
    // 1. Defer 처리
    if (requireDefer) {
        const deferResult = await safeDefer(interaction, deferOptions);
        if (!deferResult.success && deferResult.expired) {
            // 이미 만료된 상호작용은 처리하지 않음
            return;
        }
    }
    
    try {
        // 2. 실제 핸들러 실행
        await handler(interaction);
    } catch (error) {
        console.error('[InteractionUtils] Handler error:', error);
        
        // 3. 오류 응답 시도
        await safeReply(interaction, {
            content: '❌ 처리 중 오류가 발생했습니다.',
            embeds: [],
            components: [],
            flags: 64
        });
    }
}

/**
 * 상호작용 상태 확인
 * @param {Interaction} interaction 
 * @returns {Object} 상태 정보
 */
function getInteractionState(interaction) {
    return {
        isExpired: false, // 직접 확인 불가, 시도해봐야 앎
        isDeferred: interaction.deferred,
        isReplied: interaction.replied,
        canReply: !interaction.replied && !interaction.deferred,
        canDefer: !interaction.replied && !interaction.deferred,
        canEditReply: interaction.deferred || interaction.replied,
        canFollowUp: interaction.replied
    };
}

/**
 * 버튼/선택메뉴용 안전한 업데이트
 * @param {Interaction} interaction 
 * @param {Object} updateData 
 */
async function safeUpdate(interaction, updateData) {
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(updateData);
        } else {
            await interaction.update(updateData);
        }
        return true;
    } catch (error) {
        if (error.code === 10062) {
            console.log('[InteractionUtils] Cannot update - interaction expired');
        } else {
            console.error('[InteractionUtils] Update error:', error.message);
        }
        return false;
    }
}

module.exports = {
    safeDefer,
    safeReply,
    handleInteractionSafely,
    getInteractionState,
    safeUpdate
};