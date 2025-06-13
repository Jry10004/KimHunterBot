const { spawn } = require('child_process');
const path = require('path');

console.log('🎮 KimHunter IDE 시작 중...\n');

// Windows에서 Electron 실행
if (process.platform === 'win32') {
    const electronPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
    const child = spawn(electronPath, ['.'], {
        cwd: __dirname,
        stdio: 'inherit',
        env: {
            ...process.env,
            ELECTRON_ENABLE_LOGGING: '1'
        }
    });

    child.on('error', (error) => {
        console.error('❌ Electron 실행 오류:', error);
        console.log('\n해결 방법:');
        console.log('1. Node.js 버전을 확인하세요 (16.0.0 이상)');
        console.log('2. npm install을 다시 실행해보세요');
        console.log('3. Windows에서 실행해보세요 (WSL에서는 GUI 앱이 제한될 수 있습니다)');
    });

    child.on('close', (code) => {
        console.log(`\n프로그램이 종료되었습니다. 종료 코드: ${code}`);
    });
} else {
    console.log('❌ 이 프로그램은 Windows에서 실행하는 것을 권장합니다.');
    console.log('WSL 환경에서는 GUI 애플리케이션 실행에 제한이 있을 수 있습니다.');
    console.log('\n해결 방법:');
    console.log('1. Windows PowerShell 또는 명령 프롬프트에서 실행하세요');
    console.log('2. 또는 WSL GUI 지원을 설정하세요');
}