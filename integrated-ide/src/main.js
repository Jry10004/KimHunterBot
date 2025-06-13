const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const pty = require('node-pty');

let mainWindow;
let botProcess = null;
let claudeProcess = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        title: 'KimHunter IDE - Claude Code & Bot 통합 환경'
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
    
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        if (botProcess) botProcess.kill();
        if (claudeProcess) claudeProcess.kill();
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// 인증 관련
ipcMain.handle('authenticate', async (event, authCode) => {
    try {
        // Authentication Code에서 sessionKey 추출
        const sessionKey = extractSessionKey(authCode);
        
        if (!sessionKey) {
            return { success: false, message: 'Authentication Code에서 sessionKey를 찾을 수 없습니다.' };
        }
        
        // Claude API 연결 테스트
        const axios = require('axios');
        const testResponse = await axios.post('https://claude.ai/api/organizations', {}, {
            headers: {
                'Cookie': `sessionKey=${sessionKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'KimHunter-IDE/1.0'
            }
        });
        
        if (testResponse.status === 200) {
            // 인증 성공시 설정 저장
            const configPath = path.join(__dirname, '../config.json');
            fs.writeFileSync(configPath, JSON.stringify({ 
                sessionKey,
                authTime: new Date().toISOString()
            }, null, 2));
            
            return { success: true, message: 'Claude Authentication Code 인증이 완료되었습니다!' };
        } else {
            return { success: false, message: 'Authentication Code가 유효하지 않습니다.' };
        }
    } catch (error) {
        console.error('인증 오류:', error);
        return { success: false, message: 'Authentication Code가 만료되었거나 유효하지 않습니다.' };
    }
});

// Authentication Code에서 sessionKey 추출 함수
function extractSessionKey(authCode) {
    try {
        // Authentication Code는 보통 JSON 형태이거나 특정 패턴을 가짐
        if (authCode.includes('sessionKey')) {
            // JSON 형태인 경우
            const parsed = JSON.parse(authCode);
            return parsed.sessionKey;
        } else if (authCode.includes('sk-ant-')) {
            // sessionKey가 직접 포함된 경우
            const match = authCode.match(/sk-ant-[a-zA-Z0-9_-]+/);
            return match ? match[0] : null;
        } else {
            // 전체가 sessionKey인 경우
            return authCode.trim();
        }
    } catch (error) {
        // JSON 파싱 실패시 전체 문자열을 sessionKey로 사용
        return authCode.trim();
    }
}

// 봇 프로세스 관리
ipcMain.handle('start-bot', async (event) => {
    try {
        const botPath = path.join(__dirname, '../../index.js');
        
        if (botProcess) {
            botProcess.kill();
        }
        
        botProcess = spawn('node', [botPath], {
            cwd: path.join(__dirname, '../..'),
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        botProcess.stdout.on('data', (data) => {
            mainWindow.webContents.send('bot-output', data.toString());
        });
        
        botProcess.stderr.on('data', (data) => {
            mainWindow.webContents.send('bot-output', `ERROR: ${data.toString()}`);
        });
        
        botProcess.on('close', (code) => {
            mainWindow.webContents.send('bot-output', `\n봇이 종료되었습니다. 종료 코드: ${code}\n`);
            botProcess = null;
        });
        
        return { success: true, message: '봇이 시작되었습니다!' };
    } catch (error) {
        return { success: false, message: `봇 시작 실패: ${error.message}` };
    }
});

ipcMain.handle('stop-bot', async (event) => {
    if (botProcess) {
        botProcess.kill();
        botProcess = null;
        return { success: true, message: '봇이 중지되었습니다!' };
    }
    return { success: false, message: '실행 중인 봇이 없습니다.' };
});

// Claude Code 터미널 관리
let claudeTerminal = null;

ipcMain.handle('start-claude-terminal', async (event) => {
    try {
        if (claudeTerminal) {
            claudeTerminal.kill();
        }
        
        claudeTerminal = pty.spawn('claude-code', [], {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: path.join(__dirname, '../..'),
            env: process.env
        });
        
        claudeTerminal.on('data', (data) => {
            mainWindow.webContents.send('claude-output', data);
        });
        
        claudeTerminal.on('exit', (code) => {
            mainWindow.webContents.send('claude-output', `\nClaude Code 세션이 종료되었습니다. 종료 코드: ${code}\n`);
            claudeTerminal = null;
        });
        
        return { success: true, message: 'Claude Code가 시작되었습니다!' };
    } catch (error) {
        return { success: false, message: `Claude Code 시작 실패: ${error.message}` };
    }
});

ipcMain.handle('send-claude-input', async (event, input) => {
    if (claudeTerminal) {
        claudeTerminal.write(input);
        return { success: true };
    }
    return { success: false, message: 'Claude Code가 실행 중이지 않습니다.' };
});

// 파일 선택
ipcMain.handle('select-directory', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, path: result.filePaths[0] };
    }
    return { success: false };
});

// 외부 링크 열기
ipcMain.handle('open-external', async (event, url) => {
    shell.openExternal(url);
});