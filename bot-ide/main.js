const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let testBot = null;
let productionBot = null;

// 봇 상태
const botStatus = {
    test: { running: false, pid: null, startTime: null },
    production: { running: false, pid: null, startTime: null }
};

// 통계 데이터
const stats = {
    test: { commands: 0, errors: 0, uptime: 0 },
    production: { commands: 0, errors: 0, uptime: 0 }
};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        frame: false,
        backgroundColor: '#1e1e1e'
    });

    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools({ mode: 'detach' }); // 개발자 도구 자동 실행 비활성화

    // 메뉴 설정
    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                { label: 'New Terminal', click: () => mainWindow.webContents.send('new-terminal') },
                { type: 'separator' },
                { label: 'Exit', click: () => app.quit() }
            ]
        },
        {
            label: 'Bots',
            submenu: [
                { label: 'Start All', click: () => startAllBots() },
                { label: 'Stop All', click: () => stopAllBots() },
                { type: 'separator' },
                { label: 'Deploy to Production', click: () => deployToProduction() }
            ]
        },
        {
            label: 'Tools',
            submenu: [
                { label: 'Clear Logs', click: () => mainWindow.webContents.send('clear-logs') },
                { label: 'Export Logs', click: () => exportLogs() },
                { type: 'separator' },
                { label: 'Settings', click: () => openSettings() }
            ]
        },
        {
            label: 'Help',
            submenu: [
                { label: 'Documentation', click: () => {} },
                { label: 'About', click: () => showAbout() }
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);
}

// IPC 핸들러
ipcMain.handle('start-bot', async (event, type) => {
    return startBot(type);
});

ipcMain.handle('stop-bot', async (event, type) => {
    return stopBot(type);
});

ipcMain.handle('get-status', async () => {
    return { botStatus, stats };
});

ipcMain.handle('deploy', async () => {
    return deployToProduction();
});

ipcMain.handle('minimize', () => {
    mainWindow.minimize();
});

ipcMain.handle('maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.handle('close', () => {
    app.quit();
});

// 봇 시작 함수
function startBot(type) {
    return new Promise((resolve, reject) => {
        const envFile = type === 'test' ? '.env' : '.env.production.private';
        const env = loadEnvFile(path.join(__dirname, '..', envFile));
        
        const botProcess = spawn('node', ['--max-old-space-size=4096', 'index.js'], {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, ...env, FORCE_COLOR: '1' },
            shell: true,
            windowsHide: true
        });

        if (type === 'test') {
            testBot = botProcess;
        } else {
            productionBot = botProcess;
        }

        botStatus[type] = {
            running: true,
            pid: botProcess.pid,
            startTime: Date.now()
        };

        // 로그 전송 - 라인 단위로 처리
        const readline = require('readline');
        
        const stdoutReader = readline.createInterface({
            input: botProcess.stdout,
            crlfDelay: Infinity
        });
        
        const stderrReader = readline.createInterface({
            input: botProcess.stderr,
            crlfDelay: Infinity
        });
        
        stdoutReader.on('line', (line) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', { type, message: line, level: 'info' });
                
                // 통계 업데이트
                if (line.includes('명령어')) stats[type].commands++;
            }
        });
        
        stderrReader.on('line', (line) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', { type, message: line, level: 'error' });
                stats[type].errors++;
            }
        });
        
        // 스트림 플러시 강제
        botProcess.stdout.setEncoding('utf8');
        botProcess.stderr.setEncoding('utf8');

        botProcess.on('close', (code) => {
            botStatus[type] = { running: false, pid: null, startTime: null };
            mainWindow.webContents.send('bot-status-changed', { type, running: false });
            
            if (type === 'test') {
                testBot = null;
            } else {
                productionBot = null;
            }
        });

        setTimeout(() => {
            mainWindow.webContents.send('bot-status-changed', { type, running: true });
            resolve({ success: true });
        }, 2000);
    });
}

// 봇 중지 함수
function stopBot(type) {
    const bot = type === 'test' ? testBot : productionBot;
    
    if (!bot) {
        return Promise.resolve({ success: false, error: 'Bot not running' });
    }

    bot.kill('SIGTERM');
    
    return new Promise((resolve) => {
        setTimeout(() => {
            if (bot && !bot.killed) {
                bot.kill('SIGKILL');
            }
            resolve({ success: true });
        }, 2000);
    });
}

// 환경 변수 로드
function loadEnvFile(filepath) {
    const env = {};
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        content.split('\n').forEach(line => {
            if (line.startsWith('#') || !line.includes('=')) return;
            const equalIndex = line.indexOf('=');
            if (equalIndex > 0) {
                const key = line.substring(0, equalIndex).trim();
                const value = line.substring(equalIndex + 1).trim();
                if (key && value) {
                    env[key] = value;
                }
            }
        });
    } catch (error) {
        console.error('Error loading env file:', error);
    }
    return env;
}

// 모든 봇 시작
function startAllBots() {
    startBot('test');
    setTimeout(() => startBot('production'), 1000);
}

// 모든 봇 중지
function stopAllBots() {
    stopBot('test');
    stopBot('production');
}

// 프로덕션 배포
async function deployToProduction() {
    const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Deploy', 'Cancel'],
        defaultId: 0,
        title: 'Deploy to Production',
        message: 'Are you sure you want to deploy the test code to production?',
        detail: 'This will restart the production bot with the latest code.'
    });

    if (result.response === 0) {
        // 버전 업데이트
        const packagePath = path.join(__dirname, '..', 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        const versionParts = packageJson.version.split('.');
        versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
        packageJson.version = versionParts.join('.');
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

        // 프로덕션 봇 재시작
        if (productionBot) {
            await stopBot('production');
        }
        await startBot('production');

        mainWindow.webContents.send('deploy-complete', { version: packageJson.version });
        return { success: true, version: packageJson.version };
    }

    return { success: false };
}

// 로그 내보내기
function exportLogs() {
    dialog.showSaveDialog(mainWindow, {
        defaultPath: `bot-logs-${new Date().toISOString().split('T')[0]}.txt`,
        filters: [{ name: 'Text files', extensions: ['txt'] }]
    }).then(result => {
        if (!result.canceled) {
            mainWindow.webContents.send('export-logs', result.filePath);
        }
    });
}

// 설정 창
function openSettings() {
    const settingsWindow = new BrowserWindow({
        width: 600,
        height: 400,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    
    settingsWindow.loadFile('settings.html');
}

// About 다이얼로그
function showAbout() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About',
        message: 'KimHunter Bot IDE',
        detail: 'Version 1.0.0\n\nProfessional Discord Bot Management IDE\n\n© 2025 KimHunter',
        buttons: ['OK']
    });
}

// 통계 업데이트 타이머
setInterval(() => {
    Object.keys(botStatus).forEach(type => {
        if (botStatus[type].running) {
            stats[type].uptime = Date.now() - botStatus[type].startTime;
        }
    });
    mainWindow.webContents.send('stats-update', stats);
}, 1000);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // 봇 프로세스 정리
        if (testBot) testBot.kill();
        if (productionBot) productionBot.kill();
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});