const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

// 매크로 방지 시스템
const ANTI_MACRO = {
    // 사용자별 행동 패턴 추적
    userPatterns: new Map(),
    // 현재 진행 중인 검증
    activeVerifications: new Map(),
    // 사용자별 제재 기록
    penaltyHistory: new Map(),
    
    // 의심스러운 행동 기준
    suspiciousThresholds: {
        minResponseTime: 300, // 최소 반응 시간 (ms) - 너무 엄격하지 않게 조정
        maxActionsPerMinute: 30, // 분당 최대 액션 수 - 정상적인 게임 플레이 고려
        repeatActionThreshold: 10, // 동일 행동 반복 임계값 - 너무 민감하지 않게
        patternSimilarity: 0.85, // 패턴 유사도 임계값
        rapidClickThreshold: 5, // 연속 빠른 클릭 임계값 - 여유롭게
        timeWindowMs: 120000 // 패턴 분석 시간 창 (2분)
    },
    
    // 검증 시스템 설정
    verificationConfig: {
        responseTimeSeconds: 60, // 응답 제한 시간 (60초로 변경)
        codeLength: 6, // 인증 코드 길이
        codeCharacters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', // 사용할 문자
        imageWidth: 500, // 너비 늘림
        imageHeight: 200,
        fontColors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'], // 무작위 색상
        backgroundPatterns: ['dots', 'lines', 'grid', 'noise'], // 배경 패턴
        distortionLevel: 0.3 // 이미지 왜곡 수준
    },
    
    // 8단계 제재 시스템
    penaltyTiers: [
        { level: 1, duration: 5 * 60 * 1000, name: '경고', message: '⚠️ 첫 번째 경고: 5분 타임아웃' },
        { level: 2, duration: 10 * 60 * 1000, name: '주의', message: '⏰ 두 번째 경고: 10분 타임아웃' },
        { level: 3, duration: 30 * 60 * 1000, name: '경계', message: '🚨 세 번째 경고: 30분 타임아웃' },
        { level: 4, duration: 60 * 60 * 1000, name: '위험', message: '🔥 네 번째 경고: 1시간 타임아웃' },
        { level: 5, duration: 3 * 60 * 60 * 1000, name: '심각', message: '💀 다섯 번째 경고: 3시간 타임아웃' },
        { level: 6, duration: 24 * 60 * 60 * 1000, name: '위기', message: '🚫 여섯 번째 경고: 24시간 타임아웃' },
        { level: 7, duration: 30 * 24 * 60 * 60 * 1000, name: '최종경고', message: '⛔ 일곱 번째 경고: 30일 타임아웃' },
        { level: 8, duration: null, name: '영구정지', message: '🔨 영구 정지: 서비스 이용이 금지되었습니다' }
    ],
    
    // 탐지 가중치 (각 행동별 의심도 점수)
    detectionWeights: {
        tooFastResponse: 20, // 너무 빠른 응답 - 가중치 감소
        identicalTiming: 20, // 동일한 타이밍 반복 - 가중치 감소
        noVariation: 15, // 행동 패턴 변화 없음 - 가중치 감소
        rapidActions: 10, // 급속한 연속 행동 - 가중치 감소
        impossiblePattern: 50 // 불가능한 패턴 (예: 0.001초 반응) - 이것만 증가
    },
    
    // 화이트리스트 (검증된 사용자)
    whitelist: new Set(),
    
    // 임시 면제 (일시적 검증 면제)
    temporaryExemptions: new Map()
};

// 사용자 행동 기록
function recordUserAction(userId, actionType, timestamp = Date.now()) {
    if (!ANTI_MACRO.userPatterns.has(userId)) {
        ANTI_MACRO.userPatterns.set(userId, {
            actions: [],
            suspicionScore: 0,
            lastCheck: timestamp
        });
    }
    
    const userPattern = ANTI_MACRO.userPatterns.get(userId);
    userPattern.actions.push({ type: actionType, timestamp });
    
    // 시간 창을 벗어난 오래된 행동 제거
    const cutoffTime = timestamp - ANTI_MACRO.suspiciousThresholds.timeWindowMs;
    userPattern.actions = userPattern.actions.filter(action => action.timestamp > cutoffTime);
    
    // 패턴 분석
    const analysisResult = analyzeUserPattern(userId);
    
    // CAPTCHA가 필요한 경우 반환
    if (analysisResult && analysisResult.needsCaptcha) {
        return analysisResult;
    }
}

// 사용자 패턴 분석
function analyzeUserPattern(userId) {
    const userPattern = ANTI_MACRO.userPatterns.get(userId);
    if (!userPattern || userPattern.actions.length < 5) return;
    
    let suspicionScore = 0;
    const actions = userPattern.actions;
    
    // 1. 반응 시간 분석
    const reactionTimes = [];
    for (let i = 1; i < actions.length; i++) {
        const timeDiff = actions[i].timestamp - actions[i-1].timestamp;
        reactionTimes.push(timeDiff);
        
        // 너무 빠른 반응
        if (timeDiff < ANTI_MACRO.suspiciousThresholds.minResponseTime) {
            suspicionScore += ANTI_MACRO.detectionWeights.tooFastResponse;
        }
        
        // 불가능한 속도 (0.1초 미만)
        if (timeDiff < 100) {
            suspicionScore += ANTI_MACRO.detectionWeights.impossiblePattern;
        }
    }
    
    // 2. 타이밍 패턴 분석
    if (reactionTimes.length >= 3) {
        const avgTime = reactionTimes.reduce((a, b) => a + b) / reactionTimes.length;
        const variance = reactionTimes.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / reactionTimes.length;
        const stdDev = Math.sqrt(variance);
        
        // 너무 일정한 타이밍 (표준편차가 매우 낮음)
        if (stdDev < 50 && avgTime < 2000) {
            suspicionScore += ANTI_MACRO.detectionWeights.identicalTiming;
        }
    }
    
    // 3. 행동 다양성 분석
    const actionTypes = new Set(actions.map(a => a.type));
    if (actionTypes.size === 1 && actions.length >= 10) {
        suspicionScore += ANTI_MACRO.detectionWeights.noVariation;
    }
    
    // 4. 연속 빠른 클릭 감지
    let rapidClickCount = 0;
    for (let i = 1; i < Math.min(actions.length, 5); i++) {
        if (actions[i].timestamp - actions[i-1].timestamp < 500) {
            rapidClickCount++;
        }
    }
    if (rapidClickCount >= ANTI_MACRO.suspiciousThresholds.rapidClickThreshold) {
        suspicionScore += ANTI_MACRO.detectionWeights.rapidActions;
    }
    
    userPattern.suspicionScore = suspicionScore;
    
    // 의심 점수가 임계값을 넘으면 검증 트리거
    if (suspicionScore >= 50 && !ANTI_MACRO.activeVerifications.has(userId)) {
        // 화이트리스트에 있는 사용자는 검증 제외
        if (!isExempted(userId)) {
            return { needsCaptcha: true, userId, suspicionScore };
        }
    }
    
    return { needsCaptcha: false, userId, suspicionScore };
}

// CAPTCHA 검증 트리거
async function triggerCaptchaVerification(userId, channel = null) {
    // 화이트리스트 확인
    if (isExempted(userId)) {
        return null;
    }
    
    // 이미 검증 중인지 확인
    if (ANTI_MACRO.activeVerifications.has(userId)) {
        return null;
    }
    
    // 인증 코드 생성
    const captchaData = generateCaptchaCode();
    
    // 캡챠 이미지 생성
    const captchaImage = await generateCaptchaImage(captchaData);
    
    // 검증 정보 저장
    const verificationData = {
        code: captchaData.answer, // 정답 저장
        type: captchaData.type,
        timestamp: Date.now(),
        attempts: 0,
        channel: channel
    };
    
    console.log(`[antiMacro.triggerCaptcha] 검증 정보 저장 - userId: ${userId}, data:`, verificationData);
    ANTI_MACRO.activeVerifications.set(userId, verificationData);
    console.log(`[antiMacro.triggerCaptcha] 저장 후 확인:`, ANTI_MACRO.activeVerifications.get(userId));
    
    // 검증 메시지 전송을 위한 이벤트 발생
    let message = '🤖 매크로 방지 검증이 필요합니다.\n\n';
    if (captchaData.type === 'math') {
        message += '🧮 아래 수학 문제의 답을 입력하세요:';
    } else {
        message += '📝 아래 이미지의 문자를 입력하세요:';
    }
    
    return {
        type: 'captcha_required',
        userId,
        code: captchaData.answer,
        image: captchaImage,
        message: message,
        question: captchaData.question
    };
}

// CAPTCHA 코드 생성
function generateCaptchaCode() {
    const type = Math.random();
    
    if (type < 0.4) {
        // 수학 문제 (40% 확률)
        const num1 = Math.floor(Math.random() * 50) + 30; // 30-79
        const num2 = Math.floor(Math.random() * 20) + 5;  // 5-24
        const operators = ['+', '-'];
        const operator = operators[Math.floor(Math.random() * operators.length)];
        
        let answer;
        let display;
        if (operator === '+') {
            answer = num1 + num2;
            display = `${num1} + ${num2}`;
        } else {
            // 빼기는 항상 큰 수에서 작은 수를 빼도록
            if (num1 > num2) {
                answer = num1 - num2;
                display = `${num1} - ${num2}`;
            } else {
                answer = num2 - num1;
                display = `${num2} - ${num1}`;
            }
        }
        
        return {
            type: 'math',
            question: '이미지의 수학 문제를 계산하세요',
            answer: answer.toString(),
            display: display
        };
    } else {
        // 영문+숫자 조합 (60% 확률)
        const chars = ANTI_MACRO.verificationConfig.codeCharacters;
        let code = '';
        for (let i = 0; i < ANTI_MACRO.verificationConfig.codeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return {
            type: 'text',
            question: '아래 문자를 입력하세요',
            answer: code,
            display: code
        };
    }
}

// CAPTCHA 이미지 생성
async function generateCaptchaImage(captchaData) {
    try {
        const { imageWidth, imageHeight } = ANTI_MACRO.verificationConfig;
        const displayText = captchaData.display;
        
        // 기본 이미지 생성 (Jimp 1.6.0 문법)
        const { Jimp: JimpClass } = require('jimp');
        const image = new JimpClass({ width: imageWidth, height: imageHeight, color: 0xF0F0F0FF });
        
        // 배경 노이즈 (간단하게)
        for (let i = 0; i < 50; i++) {
            const x = Math.floor(Math.random() * imageWidth);
            const y = Math.floor(Math.random() * imageHeight);
            const size = Math.floor(Math.random() * 5 + 2);
            const color = 0xCCCCCCFF;
            
            for (let dx = 0; dx < size; dx++) {
                for (let dy = 0; dy < size; dy++) {
                    if (x + dx < imageWidth && y + dy < imageHeight) {
                        image.setPixelColor(color, x + dx, y + dy);
                    }
                }
            }
        }
        
        // 방해선 추가
        for (let i = 0; i < 8; i++) {
            const y = Math.random() * imageHeight;
            const amplitude = Math.random() * 10 + 5;
            const frequency = Math.random() * 0.02 + 0.01;
            const color = [0x00000066, 0xFF000044, 0x0000FF44][Math.floor(Math.random() * 3)];
            
            for (let x = 0; x < imageWidth; x++) {
                const offsetY = Math.sin(x * frequency) * amplitude;
                const py = Math.floor(y + offsetY);
                if (py >= 0 && py < imageHeight) {
                    image.setPixelColor(color, x, py);
                    if (py + 1 < imageHeight) image.setPixelColor(color, x, py + 1);
                }
            }
        }
        
        // 문자 그리기 (폰트 없이 직접 픽셀로 그리기)
        const charWidth = imageWidth / displayText.length;
        
        for (let i = 0; i < displayText.length; i++) {
            const char = displayText[i];
            
            // 문자 색상 (진한 색상들)
            const colors = [0x000000FF, 0x330000FF, 0x003300FF, 0x000033FF, 0x333300FF];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            // 위치 계산
            const baseX = i * charWidth + charWidth / 2;
            const baseY = imageHeight / 2;
            
            // 간단한 문자 렌더링 (픽셀 아트 스타일)
            drawCharacter(image, char, baseX, baseY, color);
        }
        
        // 추가 노이즈 점
        for (let i = 0; i < 200; i++) {
            const x = Math.floor(Math.random() * imageWidth);
            const y = Math.floor(Math.random() * imageHeight);
            image.setPixelColor(0x00000033, x, y);
        }
        
        // 버퍼로 변환
        return await image.getBuffer('image/png');
    } catch (error) {
        console.error('CAPTCHA 이미지 생성 오류:', error);
        // 에러 시 간단한 대체 이미지
        const { Jimp: JimpClass } = require('jimp');
        const fallback = new JimpClass({ width: 300, height: 100, color: 0xFFFFFFFF });
        
        // 에러 메시지를 픽셀로 그리기
        const errorText = captchaData.display || 'ERROR';
        const charWidth = 300 / errorText.length;
        for (let i = 0; i < errorText.length; i++) {
            drawCharacter(fallback, errorText[i], i * charWidth + charWidth/2, 50, 0x000000FF);
        }
        
        return await fallback.getBuffer('image/png');
    }
}

// 픽셀로 문자 그리기 함수
function drawCharacter(image, char, x, y, color) {
    // 간단한 5x7 픽셀 폰트 (숫자와 일부 문자만)
    const pixelChars = {
        '0': [
            [1,1,1,1,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,1]
        ],
        '1': [
            [0,0,1,0,0],
            [0,1,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [1,1,1,1,1]
        ],
        '2': [
            [1,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [1,1,1,1,1],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,1,1,1,1]
        ],
        '3': [
            [1,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [1,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [1,1,1,1,1]
        ],
        '4': [
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [0,0,0,0,1]
        ],
        '5': [
            [1,1,1,1,1],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [1,1,1,1,1]
        ],
        '6': [
            [1,1,1,1,1],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,1,1,1,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,1]
        ],
        '7': [
            [1,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,1,0],
            [0,0,1,0,0],
            [0,1,0,0,0],
            [1,0,0,0,0],
            [1,0,0,0,0]
        ],
        '8': [
            [1,1,1,1,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,1]
        ],
        '9': [
            [1,1,1,1,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [1,1,1,1,1]
        ],
        'A': [
            [0,1,1,1,0],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1]
        ],
        'B': [
            [1,1,1,1,0],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,0],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,0]
        ],
        'C': [
            [0,1,1,1,1],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [0,1,1,1,1]
        ],
        'D': [
            [1,1,1,1,0],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,0]
        ],
        'E': [
            [1,1,1,1,1],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,1,1,1,0],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,1,1,1,1]
        ],
        'F': [
            [1,1,1,1,1],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,1,1,1,0],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,0,0,0,0]
        ],
        'G': [
            [0,1,1,1,1],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,0,1,1,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [0,1,1,1,1]
        ],
        'H': [
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1]
        ],
        'I': [
            [1,1,1,1,1],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [1,1,1,1,1]
        ],
        'J': [
            [0,0,0,0,1],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [1,0,0,0,1],
            [0,1,1,1,0]
        ],
        'K': [
            [1,0,0,0,1],
            [1,0,0,1,0],
            [1,0,1,0,0],
            [1,1,0,0,0],
            [1,0,1,0,0],
            [1,0,0,1,0],
            [1,0,0,0,1]
        ],
        'L': [
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,1,1,1,1]
        ],
        'M': [
            [1,0,0,0,1],
            [1,1,0,1,1],
            [1,0,1,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1]
        ],
        'N': [
            [1,0,0,0,1],
            [1,1,0,0,1],
            [1,0,1,0,1],
            [1,0,0,1,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1]
        ],
        'O': [
            [0,1,1,1,0],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [0,1,1,1,0]
        ],
        'P': [
            [1,1,1,1,0],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,0],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [1,0,0,0,0]
        ],
        'Q': [
            [0,1,1,1,0],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,1,0,1],
            [1,0,0,1,0],
            [0,1,1,0,1]
        ],
        'R': [
            [1,1,1,1,0],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,1,1,1,0],
            [1,0,1,0,0],
            [1,0,0,1,0],
            [1,0,0,0,1]
        ],
        'S': [
            [0,1,1,1,1],
            [1,0,0,0,0],
            [1,0,0,0,0],
            [0,1,1,1,0],
            [0,0,0,0,1],
            [0,0,0,0,1],
            [1,1,1,1,0]
        ],
        'T': [
            [1,1,1,1,1],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0]
        ],
        'U': [
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [0,1,1,1,0]
        ],
        'V': [
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [0,1,0,1,0],
            [0,1,0,1,0],
            [0,0,1,0,0]
        ],
        'W': [
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,0,0,1],
            [1,0,1,0,1],
            [1,0,1,0,1],
            [1,1,0,1,1],
            [1,0,0,0,1]
        ],
        'X': [
            [1,0,0,0,1],
            [0,1,0,1,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,1,0,1,0],
            [1,0,0,0,1]
        ],
        'Y': [
            [1,0,0,0,1],
            [0,1,0,1,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0],
            [0,0,1,0,0]
        ],
        'Z': [
            [1,1,1,1,1],
            [0,0,0,0,1],
            [0,0,0,1,0],
            [0,0,1,0,0],
            [0,1,0,0,0],
            [1,0,0,0,0],
            [1,1,1,1,1]
        ]
    };
    
    // 문자가 정의되어 있지 않으면 기본 블록으로
    const charData = pixelChars[char.toUpperCase()] || [
        [1,1,1,1,1],
        [1,1,1,1,1],
        [1,1,1,1,1],
        [1,1,1,1,1],
        [1,1,1,1,1],
        [1,1,1,1,1],
        [1,1,1,1,1]
    ];
    
    // 크기와 회전 적용
    const scale = 4 + Math.floor(Math.random() * 3); // 4-6 픽셀 크기
    const angle = (Math.random() - 0.5) * 30; // -15 ~ +15도 회전
    const rad = angle * Math.PI / 180;
    
    // 문자 그리기
    for (let row = 0; row < charData.length; row++) {
        for (let col = 0; col < charData[row].length; col++) {
            if (charData[row][col] === 1) {
                // 크기와 회전 적용
                for (let dx = 0; dx < scale; dx++) {
                    for (let dy = 0; dy < scale; dy++) {
                        // 회전 변환
                        const offsetX = (col * scale + dx - 2.5 * scale) * Math.cos(rad) - 
                                       (row * scale + dy - 3.5 * scale) * Math.sin(rad);
                        const offsetY = (col * scale + dx - 2.5 * scale) * Math.sin(rad) + 
                                       (row * scale + dy - 3.5 * scale) * Math.cos(rad);
                        
                        const pixelX = Math.floor(x + offsetX);
                        const pixelY = Math.floor(y + offsetY);
                        
                        // 이미지 범위 내에 있는지 확인
                        if (pixelX >= 0 && pixelX < image.bitmap.width && 
                            pixelY >= 0 && pixelY < image.bitmap.height) {
                            image.setPixelColor(color, pixelX, pixelY);
                        }
                    }
                }
            }
        }
    }
}

// 배경 패턴 추가
async function addBackgroundPattern(image) {
    const pattern = ANTI_MACRO.verificationConfig.backgroundPatterns[
        Math.floor(Math.random() * ANTI_MACRO.verificationConfig.backgroundPatterns.length)
    ];
    
    switch (pattern) {
        case 'dots':
            for (let i = 0; i < 100; i++) {
                const x = Math.random() * image.bitmap.width;
                const y = Math.random() * image.bitmap.height;
                const radius = Math.random() * 3 + 1;
                const color = 0xE0E0E0FF;
                
                for (let dx = -radius; dx <= radius; dx++) {
                    for (let dy = -radius; dy <= radius; dy++) {
                        if (dx * dx + dy * dy <= radius * radius) {
                            image.setPixelColor(color, Math.floor(x + dx), Math.floor(y + dy));
                        }
                    }
                }
            }
            break;
            
        case 'lines':
            for (let i = 0; i < 20; i++) {
                const x1 = Math.random() * image.bitmap.width;
                const y1 = Math.random() * image.bitmap.height;
                const x2 = Math.random() * image.bitmap.width;
                const y2 = Math.random() * image.bitmap.height;
                drawLine(image, x1, y1, x2, y2, 0xF0F0F0FF);
            }
            break;
            
        case 'grid':
            const gridSize = 20;
            for (let x = 0; x < image.bitmap.width; x += gridSize) {
                for (let y = 0; y < image.bitmap.height; y++) {
                    image.setPixelColor(0xF5F5F5FF, x, y);
                }
            }
            for (let y = 0; y < image.bitmap.height; y += gridSize) {
                for (let x = 0; x < image.bitmap.width; x++) {
                    image.setPixelColor(0xF5F5F5FF, x, y);
                }
            }
            break;
    }
}

// 선 그리기 헬퍼
function drawLine(image, x1, y1, x2, y2, color) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    
    while (true) {
        image.setPixelColor(color, Math.floor(x1), Math.floor(y1));
        
        if (x1 === x2 && y1 === y2) break;
        
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x1 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y1 += sy;
        }
    }
}

// 노이즈 추가
async function addNoise(image, level) {
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        if (Math.random() < level) {
            const noise = Math.random() * 100 - 50;
            this.bitmap.data[idx + 0] = Math.max(0, Math.min(255, this.bitmap.data[idx + 0] + noise));
            this.bitmap.data[idx + 1] = Math.max(0, Math.min(255, this.bitmap.data[idx + 1] + noise));
            this.bitmap.data[idx + 2] = Math.max(0, Math.min(255, this.bitmap.data[idx + 2] + noise));
        }
    });
}

// 라인 추가
async function addLines(image) {
    const lineCount = Math.floor(Math.random() * 3) + 2;
    
    for (let i = 0; i < lineCount; i++) {
        const startX = 0;
        const startY = Math.random() * image.bitmap.height;
        const endX = image.bitmap.width;
        const endY = Math.random() * image.bitmap.height;
        const color = Math.random() > 0.5 ? 0x000000FF : 0x808080FF;
        
        drawLine(image, startX, startY, endX, endY, color);
    }
}

// 파도 효과
async function addWaveEffect(image) {
    const amplitude = 5;
    const frequency = 0.05;
    const tempImage = image.clone();
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
        const offsetY = Math.sin(x * frequency) * amplitude;
        const sourceY = Math.round(y + offsetY);
        
        if (sourceY >= 0 && sourceY < tempImage.bitmap.height) {
            const sourceIdx = (tempImage.bitmap.width * sourceY + x) << 2;
            this.bitmap.data[idx + 0] = tempImage.bitmap.data[sourceIdx + 0];
            this.bitmap.data[idx + 1] = tempImage.bitmap.data[sourceIdx + 1];
            this.bitmap.data[idx + 2] = tempImage.bitmap.data[sourceIdx + 2];
            this.bitmap.data[idx + 3] = tempImage.bitmap.data[sourceIdx + 3];
        }
    });
}

// CAPTCHA 검증
async function verifyCaptcha(userId, userInput) {
    console.log(`[antiMacro.verifyCaptcha] 호출됨 - userId: ${userId}, userInput: ${userInput}`);
    
    const verification = ANTI_MACRO.activeVerifications.get(userId);
    if (!verification) {
        console.log(`[antiMacro.verifyCaptcha] 검증 정보 없음 - userId: ${userId}`);
        return { success: false, reason: 'no_verification' };
    }
    
    console.log(`[antiMacro.verifyCaptcha] 검증 정보 찾음 - code: ${verification.code}, type: ${verification.type}`);
    
    // 시간 초과 확인
    const timeElapsed = Date.now() - verification.timestamp;
    if (timeElapsed > ANTI_MACRO.verificationConfig.responseTimeSeconds * 1000) {
        ANTI_MACRO.activeVerifications.delete(userId);
        await applyPenalty(userId);
        return { success: false, reason: 'timeout' };
    }
    
    // 시도 횟수 증가
    verification.attempts++;
    
    // 공백 제거 및 대소문자 구분 없이 비교 (문자열로 변환하여 비교)
    const cleanInput = userInput.toString().trim().toUpperCase();
    const cleanCode = verification.code.toString().trim().toUpperCase();
    
    console.log(`[antiMacro.verifyCaptcha] 비교 - 입력: "${cleanInput}", 정답: "${cleanCode}"`);
    
    if (cleanInput === cleanCode) {
        // 검증 성공 - 채널 정보를 포함해서 반환
        const successResult = { 
            success: true, 
            channel: verification.channel 
        };
        
        // 검증 정보 삭제
        ANTI_MACRO.activeVerifications.delete(userId);
        
        // 의심 점수 초기화
        if (ANTI_MACRO.userPatterns.has(userId)) {
            ANTI_MACRO.userPatterns.get(userId).suspicionScore = 0;
        }
        
        return successResult;
    } else {
        // 실패
        if (verification.attempts >= 3) {
            ANTI_MACRO.activeVerifications.delete(userId);
            await applyPenalty(userId);
            return { success: false, reason: 'max_attempts' };
        }
        return { success: false, reason: 'incorrect', attemptsLeft: 3 - verification.attempts };
    }
}

// 제재 적용
async function applyPenalty(userId) {
    // 제재 기록 가져오기 또는 생성
    if (!ANTI_MACRO.penaltyHistory.has(userId)) {
        ANTI_MACRO.penaltyHistory.set(userId, {
            level: 0,
            lastPenalty: null,
            totalViolations: 0
        });
    }
    
    const history = ANTI_MACRO.penaltyHistory.get(userId);
    history.level = Math.min(history.level + 1, ANTI_MACRO.penaltyTiers.length);
    history.lastPenalty = Date.now();
    history.totalViolations++;
    
    const penalty = ANTI_MACRO.penaltyTiers[history.level - 1];
    
    return {
        level: penalty.level,
        duration: penalty.duration,
        name: penalty.name,
        message: penalty.message,
        isPermanent: penalty.duration === null
    };
}

// 제재 상태 확인
function checkPenaltyStatus(userId) {
    const history = ANTI_MACRO.penaltyHistory.get(userId);
    if (!history || !history.lastPenalty) return { restricted: false };
    
    const penalty = ANTI_MACRO.penaltyTiers[history.level - 1];
    if (penalty.duration === null) {
        return { restricted: true, reason: 'permanent_ban', message: penalty.message };
    }
    
    const timeElapsed = Date.now() - history.lastPenalty;
    if (timeElapsed < penalty.duration) {
        const timeLeft = penalty.duration - timeElapsed;
        return { 
            restricted: true, 
            reason: 'temporary_ban', 
            message: penalty.message,
            timeLeft: timeLeft
        };
    }
    
    return { restricted: false };
}

// 사용자 패턴 초기화
function resetUserPattern(userId) {
    ANTI_MACRO.userPatterns.delete(userId);
    ANTI_MACRO.activeVerifications.delete(userId);
}

// 제재 기록 초기화 (관리자용)
function resetPenaltyHistory(userId) {
    ANTI_MACRO.penaltyHistory.delete(userId);
}

// 화이트리스트 관리
function addToWhitelist(userId) {
    ANTI_MACRO.whitelist.add(userId);
}

function removeFromWhitelist(userId) {
    ANTI_MACRO.whitelist.delete(userId);
}

// 임시 면제
function grantTemporaryExemption(userId, duration) {
    ANTI_MACRO.temporaryExemptions.set(userId, {
        until: Date.now() + duration
    });
}

// 면제 상태 확인
function isExempted(userId) {
    // 화이트리스트 확인
    if (ANTI_MACRO.whitelist.has(userId)) return true;
    
    // 임시 면제 확인
    const exemption = ANTI_MACRO.temporaryExemptions.get(userId);
    if (exemption) {
        if (Date.now() < exemption.until) {
            return true;
        } else {
            ANTI_MACRO.temporaryExemptions.delete(userId);
        }
    }
    
    return false;
}

// 통계 가져오기
function getStatistics() {
    return {
        totalTrackedUsers: ANTI_MACRO.userPatterns.size,
        activeVerifications: ANTI_MACRO.activeVerifications.size,
        penalizedUsers: ANTI_MACRO.penaltyHistory.size,
        whitelistedUsers: ANTI_MACRO.whitelist.size,
        temporaryExemptions: ANTI_MACRO.temporaryExemptions.size
    };
}

module.exports = {
    recordUserAction,
    checkPenaltyStatus,
    triggerCaptchaVerification,
    verifyCaptcha,
    applyPenalty,
    resetUserPattern,
    resetPenaltyHistory,
    addToWhitelist,
    removeFromWhitelist,
    grantTemporaryExemption,
    isExempted,
    getStatistics,
    ANTI_MACRO
};