// 주식 거래 안전 래퍼
const { logInteractionState, trackInteractionResponse } = require('../../utils/interactionDebug');

/**
 * 안전한 주식 거래 버튼 처리
 * @param {Object} interaction - Discord 인터랙션
 * @param {Function} handler - 실행할 핸들러 함수
 * @param {String} actionType - 'buy' 또는 'sell'
 */
async function safeStockTransaction(interaction, handler, actionType) {
    const startTime = Date.now();
    
    try {
        // 1. 인터랙션 상태 확인
        if (interaction.replied || interaction.deferred) {
            console.log(`[Stock Safe] ${actionType} - 이미 처리된 인터랙션`);
            return false;
        }
        
        // 2. 즉시 defer 처리 (3초 타임아웃 방지)
        await interaction.deferUpdate();
        logInteractionState(interaction, `Stock ${actionType} - deferred`);
        
        // 3. 실제 거래 처리
        const result = await handler();
        
        // 4. 처리 시간 체크
        const processingTime = Date.now() - startTime;
        if (processingTime > 2500) {
            console.warn(`[Stock Safe] ${actionType} 처리 시간 경고: ${processingTime}ms`);
        }
        
        // 5. 성공 로깅
        trackInteractionResponse(interaction, `stock_${actionType}`, true);
        
        return result;
        
    } catch (error) {
        console.error(`[Stock Safe] ${actionType} 오류:`, error);
        trackInteractionResponse(interaction, `stock_${actionType}`, false, error);
        
        // 에러 응답
        try {
            await interaction.editReply({
                content: `❌ ${actionType === 'buy' ? '매수' : '매도'} 처리 중 오류가 발생했습니다.`,
                embeds: [],
                components: []
            });
        } catch (replyError) {
            console.error('[Stock Safe] 에러 응답 실패:', replyError);
        }
        
        return false;
    }
}

/**
 * 모달 표시 안전 래퍼
 * @param {Object} interaction - Discord 인터랙션
 * @param {Object} modal - 표시할 모달
 */
async function safeShowModal(interaction, modal) {
    try {
        // 이미 응답된 경우 체크
        if (interaction.replied || interaction.deferred) {
            console.log('[Stock Safe] 모달 표시 불가 - 이미 응답됨');
            return false;
        }
        
        // 모달 표시
        await interaction.showModal(modal);
        logInteractionState(interaction, 'Modal shown');
        
        return true;
        
    } catch (error) {
        console.error('[Stock Safe] 모달 표시 오류:', error);
        
        // 에러 발생 시 일반 응답으로 대체
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ 거래 화면을 표시할 수 없습니다. 잠시 후 다시 시도해주세요.',
                    flags: 64
                });
            }
        } catch (replyError) {
            console.error('[Stock Safe] 에러 응답 실패:', replyError);
        }
        
        return false;
    }
}

/**
 * 주식 거래 결과 처리
 * @param {Object} interaction - Discord 인터랙션
 * @param {Object} result - 거래 결과
 * @param {String} actionType - 'buy' 또는 'sell'
 */
async function handleTransactionResult(interaction, result, actionType) {
    try {
        if (result.success) {
            // 성공 시 포트폴리오 표시
            const { showPortfolio } = require('./stockMarket');
            await showPortfolio(interaction);
        } else {
            // 실패 시 메시지 표시
            await interaction.editReply({
                content: result.message,
                embeds: [],
                components: []
            });
        }
    } catch (error) {
        console.error(`[Stock Safe] ${actionType} 결과 처리 오류:`, error);
        
        // 최소한의 응답
        try {
            await interaction.editReply({
                content: '❌ 거래 결과를 표시할 수 없습니다.',
                embeds: [],
                components: []
            });
        } catch (e) {
            console.error('[Stock Safe] 최종 응답 실패:', e);
        }
    }
}

module.exports = {
    safeStockTransaction,
    safeShowModal,
    handleTransactionResult
};