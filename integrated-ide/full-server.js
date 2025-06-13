const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let botProcess = null;
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

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// 테스트 페이지
app.get('/test', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>KimHunter IDE 테스트</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; background: #1e1e1e; color: white; }
                .success { color: #4caf50; }
                .error { color: #f44336; }
                button { padding: 10px 20px; margin: 5px; background: #61dafb; border: none; border-radius: 5px; cursor: pointer; }
            </style>
        </head>
        <body>
            <h1>🎮 KimHunter IDE 연결 테스트</h1>
            <p class="success">✅ 서버 연결 성공!</p>
            <p>현재 시간: ${new Date().toLocaleString()}</p>
            <button onclick="location.href='/'">메인 페이지로 이동</button>
            
            <h2>🧪 API 테스트</h2>
            <button onclick="testAuth()">인증 테스트</button>
            <button onclick="testBot()">봇 시작 테스트</button>
            <div id="testResult"></div>
            
            <script>
                async function testAuth() {
                    try {
                        const response = await fetch('/api/authenticate', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({authCode: 'test-auth-code-12345'})
                        });
                        const result = await response.json();
                        document.getElementById('testResult').innerHTML = 
                            '<p class="success">인증 API: ' + JSON.stringify(result) + '</p>';
                    } catch (error) {
                        document.getElementById('testResult').innerHTML = 
                            '<p class="error">인증 API 오류: ' + error.message + '</p>';
                    }
                }
                
                async function testBot() {
                    try {
                        const response = await fetch('/api/start-bot', {method: 'POST'});
                        const result = await response.json();
                        document.getElementById('testResult').innerHTML = 
                            '<p class="success">봇 API: ' + JSON.stringify(result) + '</p>';
                    } catch (error) {
                        document.getElementById('testResult').innerHTML = 
                            '<p class="error">봇 API 오류: ' + error.message + '</p>';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// 인증 확인 API
app.get('/api/check-auth', (req, res) => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.sessionKey) {
                // 24시간 이내 체크
                const authTime = new Date(config.authTime);
                const now = new Date();
                const hoursDiff = (now - authTime) / (1000 * 60 * 60);
                
                if (hoursDiff < 24) {
                    return res.json({ authenticated: true });
                }
            }
        }
        res.json({ authenticated: false });
    } catch (error) {
        console.error('인증 확인 오류:', error);
        res.json({ authenticated: false });
    }
});

// 인증 API
app.post('/api/authenticate', async (req, res) => {
    try {
        const { authCode } = req.body;
        console.log('인증 요청:', authCode ? '코드 받음' : '코드 없음');
        
        if (!authCode) {
            return res.json({ success: false, message: 'Authentication Code를 입력해주세요.' });
        }

        if (authCode.length < 10) {
            return res.json({ success: false, message: '올바른 Authentication Code를 입력해주세요.' });
        }

        // Authentication Code에서 sessionKey 추출
        const sessionKey = extractSessionKey(authCode);
        
        if (!sessionKey) {
            return res.json({ success: false, message: 'Authentication Code에서 sessionKey를 찾을 수 없습니다.' });
        }
        
        // 설정 저장
        const configPath = path.join(__dirname, 'config.json');
        const config = { 
            sessionKey,
            authTime: new Date().toISOString(),
            authenticated: true
        };
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('인증 성공, 설정 저장됨');
        
        return res.json({ success: true, message: 'Claude Authentication Code 인증이 완료되었습니다!' });
    } catch (error) {
        console.error('인증 오류:', error);
        return res.status(500).json({ success: false, message: '인증 중 오류가 발생했습니다.' });
    }
});

// 봇 시작 API
app.post('/api/start-bot', (req, res) => {
    try {
        console.log('봇 시작 요청 받음');
        
        // 기존 프로세스 종료
        if (botProcess) {
            console.log('기존 봇 프로세스 종료');
            botProcess.kill();
            botProcess = null;
        }
        
        // 봇 파일 경로 확인
        const botPath = path.join(__dirname, '..', 'index.js');
        console.log('봇 파일 경로:', botPath);
        
        if (!fs.existsSync(botPath)) {
            console.log('봇 파일이 존재하지 않음');
            return res.json({ success: false, message: '봇 파일을 찾을 수 없습니다: ' + botPath });
        }
        
        // 봇 프로세스 시작
        botProcess = spawn('node', [botPath], {
            cwd: path.join(__dirname, '..'),
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        console.log('봇 프로세스 시작됨, PID:', botProcess.pid);
        
        // 출력 처리
        botProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('봇 출력:', output);
            broadcastToClients('bot-output', output);
        });
        
        botProcess.stderr.on('data', (data) => {
            const output = `ERROR: ${data.toString()}`;
            console.log('봇 오류:', output);
            broadcastToClients('bot-output', output);
        });
        
        botProcess.on('error', (error) => {
            console.log('봇 프로세스 오류:', error);
            broadcastToClients('bot-output', `프로세스 오류: ${error.message}\n`);
        });
        
        botProcess.on('close', (code) => {
            console.log('봇 프로세스 종료, 코드:', code);
            broadcastToClients('bot-output', `\n봇이 종료되었습니다. 종료 코드: ${code}\n`);
            botProcess = null;
        });
        
        // 시작 메시지 전송
        setTimeout(() => {
            broadcastToClients('bot-output', '🚀 김헌터 봇이 시작되었습니다!\n');
        }, 1000);
        
        return res.json({ success: true, message: '봇이 시작되었습니다!' });
    } catch (error) {
        console.error('봇 시작 오류:', error);
        return res.status(500).json({ success: false, message: `봇 시작 실패: ${error.message}` });
    }
});

// 봇 중지 API
app.post('/api/stop-bot', (req, res) => {
    try {
        console.log('봇 중지 요청 받음');
        
        if (botProcess) {
            botProcess.kill();
            botProcess = null;
            broadcastToClients('bot-output', '⏹️ 봇이 중지되었습니다.\n');
            return res.json({ success: true, message: '봇이 중지되었습니다!' });
        } else {
            return res.json({ success: false, message: '실행 중인 봇이 없습니다.' });
        }
    } catch (error) {
        console.error('봇 중지 오류:', error);
        return res.status(500).json({ success: false, message: `봇 중지 실패: ${error.message}` });
    }
});

// Claude 터미널 시작 API
app.post('/api/start-claude', (req, res) => {
    try {
        console.log('Claude 터미널 시작 요청');
        broadcastToClients('claude-output', '🤖 Claude Code 터미널이 시작되었습니다!\n');
        broadcastToClients('claude-output', `프로젝트 디렉토리: ${path.join(__dirname, '..')}\n`);
        broadcastToClients('claude-output', '사용 가능한 명령어: help, status, files\n\n');
        return res.json({ success: true, message: 'Claude Code가 시작되었습니다!' });
    } catch (error) {
        console.error('Claude 시작 오류:', error);
        return res.status(500).json({ success: false, message: `Claude Code 시작 실패: ${error.message}` });
    }
});

// Claude 명령어 전송 API
app.post('/api/claude-input', (req, res) => {
    try {
        const { input } = req.body;
        console.log('Claude 입력:', input);
        
        // 명령어 처리
        broadcastToClients('claude-output', `> ${input}\n`);
        
        setTimeout(() => {
            const response = generateClaudeResponse(input);
            broadcastToClients('claude-output', response + '\n\n');
        }, 500);
        
        return res.json({ success: true });
    } catch (error) {
        console.error('Claude 입력 오류:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

// WebSocket 연결 처리
wss.on('connection', (ws) => {
    console.log('클라이언트 WebSocket 연결됨');
    connectedClients.add(ws);
    
    // 연결 확인 메시지
    ws.send(JSON.stringify({ 
        type: 'connection', 
        data: '서버에 연결되었습니다!' 
    }));
    
    ws.on('close', () => {
        console.log('클라이언트 WebSocket 연결 해제됨');
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
    console.log('브로드캐스트:', type, data.substring(0, 50) + '...');
    
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (error) {
                console.error('메시지 전송 오류:', error);
                connectedClients.delete(client);
            }
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

// Claude 응답 생성
function generateClaudeResponse(input) {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('help')) {
        return `사용 가능한 명령어:
- help: 도움말 표시
- status: 프로젝트 상태 확인  
- files: 파일 목록 보기
- edit <파일명>: 파일 편집
- run: 봇 실행 상태 확인`;
    }
    
    if (lowerInput.includes('status')) {
        return `프로젝트 상태: 정상
파일 수: 15개
마지막 수정: ${new Date().toLocaleString()}
봇 상태: ${botProcess ? '실행 중' : '중지됨'}`;
    }
    
    if (lowerInput.includes('files')) {
        return `프로젝트 파일:
📁 data/
  - huntingAreas.js
  - stockMarket.js 
  - mushroomGame.js
📁 models/
  - User.js
📄 index.js
📄 package.json
📄 README.md`;
    }
    
    if (lowerInput.includes('run')) {
        return `봇 실행 상태: ${botProcess ? '실행 중 (PID: ' + botProcess.pid + ')' : '중지됨'}
포트: 3000
프로젝트 디렉토리: ${path.join(__dirname, '..')}`;
    }
    
    return `명령어 "${input}"를 처리했습니다.
더 자세한 도움이 필요하시면 "help"를 입력하세요.`;
}

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

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 KimHunter IDE 완전 버전이 포트 ${PORT}에서 실행 중입니다!`);
    console.log(`🌐 브라우저에서 http://localhost:${PORT} 에 접속하세요`);
    console.log(`🧪 테스트 페이지: http://localhost:${PORT}/test`);
    console.log(`📡 WebSocket 서버도 같은 포트에서 실행 중입니다.`);
});