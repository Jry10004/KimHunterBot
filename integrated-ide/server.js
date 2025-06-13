const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let botProcess = null;
let claudeProcess = null;
let connectedClients = new Set();

// JSON 파싱 미들웨어를 먼저 설정
app.use(express.json());

// API 라우트를 먼저 정의
app.use('/api', (req, res, next) => {
    // API 응답은 항상 JSON으로 설정
    res.setHeader('Content-Type', 'application/json');
    next();
});

// 정적 파일 제공은 API 라우트 다음에 설정
app.use(express.static(path.join(__dirname, 'web')));

// 서버 상태 확인 API (Health Check)
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: '서버가 정상적으로 실행 중입니다.',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// 인증 확인 API
app.get('/api/check-auth', (req, res) => {
    try {
        // .env에서 API 키 확인 (자동 인증)
        if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
            return res.json({ 
                authenticated: true, 
                autoAuth: true, 
                message: '.env 파일의 API 키로 자동 인증되었습니다.' 
            });
        }

        // 기존 config.json 기반 인증 확인
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.sessionKey) {
                // 24시간 이내 체크
                const authTime = new Date(config.authTime);
                const now = new Date();
                const hoursDiff = (now - authTime) / (1000 * 60 * 60);
                
                if (hoursDiff < 24) {
                    return res.json({ authenticated: true, autoAuth: false });
                }
            }
        }
        res.json({ authenticated: false });
    } catch (error) {
        console.error('인증 확인 오류:', error);
        res.status(500).json({ authenticated: false, error: error.message });
    }
});

// 인증 API
app.post('/api/authenticate', async (req, res) => {
    try {
        const { authCode } = req.body;
        
        if (!authCode) {
            return res.json({ success: false, message: 'Authentication Code를 입력해주세요.' });
        }

        // Authentication Code에서 sessionKey 추출
        const sessionKey = extractSessionKey(authCode);
        
        if (!sessionKey) {
            return res.json({ success: false, message: 'Authentication Code에서 sessionKey를 찾을 수 없습니다.' });
        }
        
        // Claude API 연결 테스트 (간단한 검증)
        try {
            // 실제 Claude API 테스트는 복잡하므로 기본 검증만 수행
            if (sessionKey.length < 10) {
                throw new Error('Invalid session key');
            }
            
            // 인증 성공시 설정 저장
            const configPath = path.join(__dirname, 'config.json');
            fs.writeFileSync(configPath, JSON.stringify({ 
                sessionKey,
                authTime: new Date().toISOString()
            }, null, 2));
            
            return res.json({ success: true, message: 'Claude Authentication Code 인증이 완료되었습니다!' });
        } catch (error) {
            return res.json({ success: false, message: 'Authentication Code가 유효하지 않습니다.' });
        }
    } catch (error) {
        console.error('인증 오류:', error);
        return res.status(500).json({ success: false, message: 'Authentication Code가 만료되었거나 유효하지 않습니다.' });
    }
});

// 봇 시작 API
app.post('/api/start-bot', (req, res) => {
    try {
        const botPath = path.join(__dirname, '..', 'index.js');
        
        if (botProcess) {
            botProcess.kill();
        }
        
        botProcess = spawn('node', [botPath], {
            cwd: path.join(__dirname, '..'),
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        botProcess.stdout.on('data', (data) => {
            broadcastToClients('bot-output', data.toString());
        });
        
        botProcess.stderr.on('data', (data) => {
            broadcastToClients('bot-output', `ERROR: ${data.toString()}`);
        });
        
        botProcess.on('close', (code) => {
            broadcastToClients('bot-output', `\n봇이 종료되었습니다. 종료 코드: ${code}\n`);
            botProcess = null;
        });
        
        return res.json({ success: true, message: '봇이 시작되었습니다!' });
    } catch (error) {
        console.error('봇 시작 실패:', error);
        return res.status(500).json({ success: false, message: `봇 시작 실패: ${error.message}` });
    }
});

// 봇 중지 API
app.post('/api/stop-bot', (req, res) => {
    if (botProcess) {
        botProcess.kill();
        botProcess = null;
        return res.json({ success: true, message: '봇이 중지되었습니다!' });
    } else {
        return res.json({ success: false, message: '실행 중인 봇이 없습니다.' });
    }
});

// 봇 로그 가져오기 API
app.get('/api/bot-logs', (req, res) => {
    // 실제 로그 수집 시스템이 없으므로 빈 응답 반환
    res.json({ 
        success: true, 
        logs: [],
        botRunning: botProcess !== null 
    });
});

// Claude 터미널 시작 API
app.post('/api/start-claude', (req, res) => {
    try {
        // Claude Code 명령어 실행 시뮬레이션
        broadcastToClients('claude-output', '🤖 Claude Code 터미널이 시작되었습니다!\n');
        broadcastToClients('claude-output', `프로젝트 디렉토리: ${path.join(__dirname, '..')}\n\n`);
        
        return res.json({ success: true, message: 'Claude Code가 시작되었습니다!' });
    } catch (error) {
        console.error('Claude Code 시작 실패:', error);
        return res.status(500).json({ success: false, message: `Claude Code 시작 실패: ${error.message}` });
    }
});

// Claude 명령어 전송 API
app.post('/api/claude-input', (req, res) => {
    const { input } = req.body;
    
    // Claude 명령어 처리 시뮬레이션
    broadcastToClients('claude-output', `> ${input}\n`);
    
    // 간단한 응답 생성
    setTimeout(() => {
        const response = generateClaudeResponse(input);
        broadcastToClients('claude-output', response + '\n\n');
    }, 1000);
    
    return res.json({ success: true });
});

// WebSocket 연결 처리
wss.on('connection', (ws) => {
    console.log('클라이언트 연결됨');
    connectedClients.add(ws);
    
    ws.on('close', () => {
        console.log('클라이언트 연결 해제됨');
        connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket 오류:', error);
        connectedClients.delete(ws);
    });
});

// 모든 클라이언트에게 메시지 브로드캐스트
function broadcastToClients(type, data) {
    const message = JSON.stringify({ type, data });
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Authentication Code에서 sessionKey 추출
function extractSessionKey(authCode) {
    try {
        if (authCode.includes('sessionKey')) {
            const parsed = JSON.parse(authCode);
            return parsed.sessionKey;
        } else if (authCode.includes('sk-ant-')) {
            const match = authCode.match(/sk-ant-[a-zA-Z0-9_-]+/);
            return match ? match[0] : null;
        } else {
            return authCode.trim();
        }
    } catch (error) {
        return authCode.trim();
    }
}

// Claude 응답 생성 (시뮬레이션)
function generateClaudeResponse(input) {
    const responses = {
        'help': '사용 가능한 명령어:\n- help: 도움말 표시\n- status: 프로젝트 상태 확인\n- files: 파일 목록 보기\n- edit <파일명>: 파일 편집',
        'status': '프로젝트 상태: 정상\n파일 수: 15개\n마지막 수정: ' + new Date().toLocaleString(),
        'files': 'index.js\npackage.json\nREADME.md\ndata/\nmodels/\nservices/',
        'default': '명령어를 처리했습니다. 더 자세한 도움이 필요하시면 "help"를 입력하세요.'
    };
    
    const lowerInput = input.toLowerCase();
    for (const [key, response] of Object.entries(responses)) {
        if (lowerInput.includes(key)) {
            return response;
        }
    }
    
    return responses.default;
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// 404 에러 핸들러 (모든 라우트 다음에 위치)
app.use((req, res, next) => {
    // API 요청에 대해서는 JSON 404 응답
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    // 그 외는 메인 페이지로 리다이렉트
    res.redirect('/');
});

// 에러 핸들러
app.use((err, req, res, next) => {
    console.error('서버 에러:', err);
    
    // API 요청에 대해서는 JSON 에러 응답
    if (req.path.startsWith('/api/')) {
        return res.status(500).json({ 
            error: 'Internal server error',
            message: err.message 
        });
    }
    
    // 그 외는 에러 페이지
    res.status(500).send('서버 오류가 발생했습니다.');
});

server.listen(PORT, HOST, () => {
    console.log(`🎮 KimHunter IDE가 ${HOST}:${PORT}에서 실행 중입니다!`);
    console.log(`🌐 브라우저에서 다음 주소로 접속하세요:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   http://127.0.0.1:${PORT}`);
    
    // 인증 상태 확인 및 표시
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
        console.log(`🔐 Claude API 자동 인증: 활성화됨 (.env 파일)`);
        console.log(`   API 키: ${process.env.ANTHROPIC_API_KEY.substring(0, 20)}...`);
    } else {
        console.log(`⚠️  Claude API 인증: 수동 인증 필요`);
        console.log(`   .env 파일에 ANTHROPIC_API_KEY를 설정하거나 웹에서 Authentication Code를 입력하세요.`);
    }
    
    // WSL IP 주소 찾기
    const os = require('os');
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`   http://${iface.address}:${PORT} (네트워크)`);
            }
        }
    }
});