const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
require('dotenv').config();
const ClaudeAPI = require('./claude-api');

const app = express();

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'web')));
app.use(express.json());

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// 간단한 테스트 페이지
app.get('/test', (req, res) => {
    res.send(`
        <h1>🎮 KimHunter IDE 연결 테스트</h1>
        <p>서버가 정상적으로 작동 중입니다!</p>
        <p>현재 시간: ${new Date().toLocaleString()}</p>
        <a href="/">메인 페이지로 이동</a>
    `);
});

// Claude API 인스턴스
let claudeAPI = null;

// 서버 시작 시 자동으로 Claude API 초기화
if (process.env.ANTHROPIC_API_KEY) {
    claudeAPI = new ClaudeAPI(process.env.ANTHROPIC_API_KEY);
    console.log('✅ Claude API가 자동으로 초기화되었습니다!');
}

// 인증 API (수동 인증용)
app.post('/api/authenticate', (req, res) => {
    if (claudeAPI) {
        res.json({ success: true, message: '이미 인증되어 있습니다.' });
    } else {
        const { authCode } = req.body;
        if (authCode && authCode.startsWith('sk-ant-')) {
            try {
                claudeAPI = new ClaudeAPI(authCode);
                res.json({ success: true, message: '수동 인증 성공!' });
            } catch (error) {
                res.json({ success: false, message: '인증 실패: ' + error.message });
            }
        } else {
            res.json({ success: false, message: 'sk-ant-로 시작하는 API 키를 입력해주세요.' });
        }
    }
});

// 실제 봇 프로세스 관리
let botProcess = null;

// 봇 상태 확인 API
app.get('/api/bot-status', (req, res) => {
    res.json({ 
        success: true, 
        running: botProcess !== null,
        message: botProcess ? '봇이 실행 중입니다' : '봇이 중지 상태입니다'
    });
});

// 인증 상태 확인 API
app.get('/api/check-auth', (req, res) => {
    if (claudeAPI) {
        res.json({
            authenticated: true,
            autoAuth: true,
            message: '.env 파일의 API 키로 자동 인증되었습니다.'
        });
    } else {
        res.json({
            authenticated: false,
            autoAuth: false,
            message: 'API 키가 설정되지 않았습니다.'
        });
    }
});

// 봇 시작 API
app.post('/api/start-bot', (req, res) => {
    console.log('봇 시작 요청');
    
    if (botProcess) {
        return res.json({ success: false, message: '봇이 이미 실행 중입니다!' });
    }
    
    try {
        // Windows에서 node 명령으로 봇 실행
        const botPath = path.join(__dirname, '..', 'index.js');
        console.log('봇 경로:', botPath);
        
        botProcess = spawn('node', [botPath], {
            cwd: path.join(__dirname, '..'),
            shell: true
        });
        
        botProcess.stdout.on('data', (data) => {
            console.log('[BOT]:', data.toString());
        });
        
        botProcess.stderr.on('data', (data) => {
            console.error('[BOT ERROR]:', data.toString());
        });
        
        botProcess.on('close', (code) => {
            console.log(`봇 프로세스 종료 (코드: ${code})`);
            botProcess = null;
        });
        
        res.json({ success: true, message: '김헌터 봇이 실제로 시작되었습니다!' });
    } catch (error) {
        console.error('봇 시작 오류:', error);
        res.json({ success: false, message: '봇 시작 중 오류 발생: ' + error.message });
    }
});

app.post('/api/stop-bot', (req, res) => {
    console.log('봇 중지 요청');
    
    if (!botProcess) {
        return res.json({ success: false, message: '실행 중인 봇이 없습니다!' });
    }
    
    try {
        // Windows에서 프로세스 종료
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', botProcess.pid, '/f', '/t']);
        } else {
            botProcess.kill('SIGTERM');
        }
        botProcess = null;
        res.json({ success: true, message: '봇이 중지되었습니다!' });
    } catch (error) {
        console.error('봇 중지 오류:', error);
        res.json({ success: false, message: '봇 중지 중 오류 발생: ' + error.message });
    }
});

app.post('/api/start-claude', (req, res) => {
    console.log('Claude 터미널 시작 요청');
    res.json({ success: true, message: 'Claude Code가 시작되었습니다!' });
});

// Claude 터미널 입력 처리 - 실제 Claude API 사용
app.post('/api/claude-input', async (req, res) => {
    const { input } = req.body;
    console.log('Claude 입력:', input);
    
    if (!claudeAPI) {
        return res.json({ 
            success: false, 
            output: '❌ 먼저 API 키로 인증해주세요!' 
        });
    }
    
    // 기본 명령어는 로컬에서 처리
    if (input.toLowerCase() === 'clear') {
        return res.json({ success: true, output: '[CLEAR]' });
    }
    
    if (input.toLowerCase() === 'help') {
        return res.json({ 
            success: true, 
            output: '🤖 실제 Claude API와 연결되었습니다!\n명령어:\n- clear: 화면 지우기\n- 그 외: Claude와 직접 대화' 
        });
    }
    
    try {
        // 실제 Claude API 호출
        const response = await claudeAPI.sendMessage(input);
        res.json({ success: true, output: response });
    } catch (error) {
        console.error('Claude API 오류:', error);
        res.json({ 
            success: false, 
            output: `❌ API 오류: ${error.message}\n\nAPI 키가 올바른지 확인하세요.` 
        });
    }
});

// 모든 IP에서 접근 가능하도록 설정
const PORT = 9999;
const server = app.listen(PORT, () => {
    console.log(`🎮 KimHunter IDE 서버가 시작되었습니다!`);
    console.log(`\n📍 접속 가능한 주소:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   http://127.0.0.1:${PORT}`);
    
    // Windows 환경에서는 WSL IP 건너뛰기
    if (process.platform !== 'win32') {
        const { execSync } = require('child_process');
        try {
            const wslIP = execSync("hostname -I | awk '{print $1}'", { encoding: 'utf8' }).trim();
            if (wslIP) {
                console.log(`   http://${wslIP}:${PORT} (WSL IP)`);
            }
        } catch (e) {
            // WSL IP 가져오기 실패 시 조용히 무시
        }
    }
    
    console.log(`\n🧪 테스트 페이지: http://localhost:${PORT}/test`);
    console.log(`\n💡 연결이 안되면 Windows에서 다음을 시도하세요:`);
    console.log(`   1. Windows 명령 프롬프트에서: curl http://localhost:${PORT}/test`);
    console.log(`   2. 브라우저에서: http://localhost:${PORT}/test`);
});

// 봇 로그 조회 API
app.get('/api/bot-logs', (req, res) => {
    const { from } = req.query;
    const fromIndex = parseInt(from) || lastLogIndex;
    
    // 새로운 로그만 반환
    const newLogs = botLogs.slice(fromIndex);
    lastLogIndex = botLogs.length;
    
    res.json({
        success: true,
        logs: newLogs.map(log => log.content),
        totalLogs: botLogs.length,
        fromIndex: fromIndex
    });
});

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

// 우아한 종료
process.on('SIGINT', () => {
    console.log('\n🛑 서버를 종료합니다...');
    server.close(() => {
        console.log('서버가 종료되었습니다.');
        process.exit(0);
    });
});