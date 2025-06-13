const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
let botProcess = null;

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'web')));
app.use(express.json());

console.log('📁 정적 파일 경로:', path.join(__dirname, 'web'));

// 메인 페이지
app.get('/', (req, res) => {
    console.log('메인 페이지 요청');
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// 인증 확인 API
app.get('/api/check-auth', (req, res) => {
    console.log('인증 확인 요청');
    try {
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.authenticated) {
                return res.json({ authenticated: true });
            }
        }
        res.json({ authenticated: false });
    } catch (error) {
        console.error('인증 확인 오류:', error);
        res.json({ authenticated: false });
    }
});

// 인증 API
app.post('/api/authenticate', (req, res) => {
    console.log('인증 요청 받음');
    try {
        const { authCode } = req.body;
        
        if (!authCode || authCode.length < 10) {
            return res.json({ success: false, message: '올바른 Authentication Code를 입력해주세요.' });
        }

        // 설정 저장
        const config = { 
            sessionKey: authCode,
            authTime: new Date().toISOString(),
            authenticated: true
        };
        
        fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
        console.log('✅ 인증 성공');
        
        res.json({ success: true, message: '인증이 완료되었습니다!' });
    } catch (error) {
        console.error('❌ 인증 오류:', error);
        res.json({ success: false, message: '인증 중 오류가 발생했습니다.' });
    }
});

// 봇 시작 API
app.post('/api/start-bot', (req, res) => {
    console.log('🚀 봇 시작 요청');
    try {
        // 기존 프로세스 종료
        if (botProcess) {
            console.log('기존 봇 프로세스 종료');
            botProcess.kill();
            botProcess = null;
        }
        
        // 봇 파일 경로
        const botPath = path.join(__dirname, '..', 'index.js');
        console.log('봇 파일 경로:', botPath);
        
        if (!fs.existsSync(botPath)) {
            console.log('❌ 봇 파일 없음');
            return res.json({ success: false, message: '봇 파일을 찾을 수 없습니다.' });
        }
        
        // 봇 프로세스 시작
        botProcess = spawn('node', [botPath], {
            cwd: path.join(__dirname, '..'),
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        console.log('✅ 봇 프로세스 시작됨, PID:', botProcess.pid);
        
        // 출력 로깅
        botProcess.stdout.on('data', (data) => {
            console.log('봇 출력:', data.toString());
        });
        
        botProcess.stderr.on('data', (data) => {
            console.log('봇 오류:', data.toString());
        });
        
        botProcess.on('close', (code) => {
            console.log('봇 프로세스 종료, 코드:', code);
            botProcess = null;
        });
        
        res.json({ success: true, message: '봇이 시작되었습니다!' });
    } catch (error) {
        console.error('❌ 봇 시작 오류:', error);
        res.json({ success: false, message: `봇 시작 실패: ${error.message}` });
    }
});

// 봇 중지 API
app.post('/api/stop-bot', (req, res) => {
    console.log('⏹️ 봇 중지 요청');
    try {
        if (botProcess) {
            botProcess.kill();
            botProcess = null;
            console.log('✅ 봇 중지됨');
            res.json({ success: true, message: '봇이 중지되었습니다!' });
        } else {
            console.log('❌ 실행 중인 봇 없음');
            res.json({ success: false, message: '실행 중인 봇이 없습니다.' });
        }
    } catch (error) {
        console.error('❌ 봇 중지 오류:', error);
        res.json({ success: false, message: `봇 중지 실패: ${error.message}` });
    }
});

// Claude 터미널 시작 API
app.post('/api/start-claude', (req, res) => {
    console.log('🤖 Claude 터미널 시작 요청');
    res.json({ success: true, message: 'Claude Code가 시작되었습니다!' });
});

// Claude 명령어 처리 API
app.post('/api/claude-input', (req, res) => {
    console.log('🤖 Claude 입력:', req.body.input);
    res.json({ success: true });
});

// 봇 상태 확인 API
app.get('/api/bot-status', (req, res) => {
    res.json({ 
        running: botProcess !== null,
        pid: botProcess ? botProcess.pid : null
    });
});

// 404 처리
app.use((req, res) => {
    console.log('404 요청:', req.path);
    res.status(404).send('페이지를 찾을 수 없습니다.');
});

const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 KimHunter IDE 간단 서버가 포트 ${PORT}에서 실행 중입니다!`);
    console.log(`🌐 브라우저에서 http://localhost:${PORT} 에 접속하세요`);
    console.log(`📂 현재 디렉토리: ${__dirname}`);
    console.log(`📁 웹 파일 경로: ${path.join(__dirname, 'web')}`);
    
    // 웹 파일 존재 확인
    const indexPath = path.join(__dirname, 'web', 'index.html');
    if (fs.existsSync(indexPath)) {
        console.log('✅ index.html 파일 확인됨');
    } else {
        console.log('❌ index.html 파일 없음');
    }
});