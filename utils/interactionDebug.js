// 인터랙션 디버깅 유틸리티
const fs = require('fs');
const path = require('path');

// 디버그 로그 파일 경로
const DEBUG_LOG_PATH = path.join(__dirname, '..', 'logs', 'interaction-debug.log');

// 로그 디렉토리 생성
if (!fs.existsSync(path.dirname(DEBUG_LOG_PATH))) {
    fs.mkdirSync(path.dirname(DEBUG_LOG_PATH), { recursive: true });
}

// 인터랙션 상태 로깅
function logInteractionState(interaction, context = '') {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        context,
        interactionId: interaction.id,
        customId: interaction.customId,
        type: interaction.type,
        isButton: interaction.isButton(),
        isStringSelectMenu: interaction.isStringSelectMenu(),
        isModalSubmit: interaction.isModalSubmit(),
        replied: interaction.replied,
        deferred: interaction.deferred,
        user: interaction.user?.tag,
        channelId: interaction.channelId,
        guildId: interaction.guildId
    };
    
    const logMessage = `[${timestamp}] ${context}\n${JSON.stringify(logEntry, null, 2)}\n---\n`;
    
    // 콘솔과 파일에 로그
    console.log(`[Interaction Debug] ${context}`, logEntry);
    fs.appendFileSync(DEBUG_LOG_PATH, logMessage);
    
    return logEntry;
}

// 인터랙션 응답 추적
function trackInteractionResponse(interaction, responseType, success = true, error = null) {
    const timestamp = new Date().toISOString();
    const trackEntry = {
        timestamp,
        interactionId: interaction.id,
        customId: interaction.customId,
        responseType, // 'reply', 'editReply', 'deferReply', 'deferUpdate', 'update', 'showModal'
        success,
        error: error ? error.message : null,
        stack: error ? error.stack : null
    };
    
    const logMessage = `[${timestamp}] Response: ${responseType} - ${success ? 'SUCCESS' : 'FAILED'}\n${JSON.stringify(trackEntry, null, 2)}\n---\n`;
    
    console.log(`[Response Track] ${responseType}`, success ? '✓' : '✗', interaction.customId);
    fs.appendFileSync(DEBUG_LOG_PATH, logMessage);
    
    return trackEntry;
}

// 중복 인터랙션 감지
const recentInteractions = new Map();
const INTERACTION_TIMEOUT = 5000; // 5초

function detectDuplicateInteraction(interaction) {
    const key = `${interaction.user.id}-${interaction.customId}`;
    const now = Date.now();
    
    // 오래된 항목 정리
    for (const [k, timestamp] of recentInteractions.entries()) {
        if (now - timestamp > INTERACTION_TIMEOUT) {
            recentInteractions.delete(k);
        }
    }
    
    // 중복 검사
    if (recentInteractions.has(key)) {
        const lastTime = recentInteractions.get(key);
        const timeDiff = now - lastTime;
        
        if (timeDiff < 1000) { // 1초 이내 중복
            console.warn(`[Duplicate Warning] 중복 인터랙션 감지: ${key} (${timeDiff}ms 간격)`);
            return true;
        }
    }
    
    recentInteractions.set(key, now);
    return false;
}

// 안전한 인터랙션 응답 래퍼
async function safeInteractionResponse(interaction, responseFunction, options = {}) {
    try {
        // 중복 체크
        if (detectDuplicateInteraction(interaction)) {
            console.log('[Safe Response] 중복 인터랙션 무시');
            return { success: false, reason: 'duplicate' };
        }
        
        // 상태 로깅
        logInteractionState(interaction, `Before ${responseFunction.name || 'response'}`);
        
        // 이미 응답된 경우 체크
        if (interaction.replied || interaction.deferred) {
            console.log('[Safe Response] 이미 응답된 인터랙션');
            return { success: false, reason: 'already_handled' };
        }
        
        // 응답 실행
        const result = await responseFunction();
        
        // 성공 추적
        trackInteractionResponse(interaction, responseFunction.name || 'unknown', true);
        
        return { success: true, result };
        
    } catch (error) {
        // 실패 추적
        trackInteractionResponse(interaction, responseFunction.name || 'unknown', false, error);
        
        // 에러 응답 시도
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: '❌ 처리 중 오류가 발생했습니다.', 
                    flags: 64 
                });
            }
        } catch (e) {
            console.error('[Safe Response] 에러 응답 실패:', e);
        }
        
        return { success: false, error };
    }
}

// 주식 버튼 클릭 디버깅
function debugStockButtonClick(interaction) {
    const debugInfo = {
        timestamp: new Date().toISOString(),
        customId: interaction.customId,
        user: interaction.user.tag,
        isStockBuy: interaction.customId === 'stock_buy',
        isStockSell: interaction.customId === 'stock_sell',
        isStockBuyExecution: interaction.customId.startsWith('stock_buy_'),
        isStockSellExecution: interaction.customId.startsWith('stock_sell_'),
        interactionState: {
            replied: interaction.replied,
            deferred: interaction.deferred
        }
    };
    
    console.log('[Stock Debug]', debugInfo);
    
    // 특별 로그 파일에 저장
    const stockLogPath = path.join(__dirname, '..', 'logs', 'stock-interactions.log');
    fs.appendFileSync(stockLogPath, JSON.stringify(debugInfo) + '\n');
    
    return debugInfo;
}

module.exports = {
    logInteractionState,
    trackInteractionResponse,
    detectDuplicateInteraction,
    safeInteractionResponse,
    debugStockButtonClick
};