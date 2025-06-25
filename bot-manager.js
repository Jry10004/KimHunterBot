const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 봇 프로세스 관리
let testBot = null;
let productionBot = null;

// 색상 코드 (Windows 호환성을 위해 간소화)
const colors = {
    reset: '',
    bright: '',
    green: '',
    red: '',
    yellow: '',
    blue: '',
    cyan: '',
    magenta: ''
};

// 로그 함수
function log(message, color = 'reset') {
    console.log(message);
}

// 메뉴 표시
function showMenu() {
    console.clear();
    log('========================================================');
    log('         KIM HUNTER BOT MANAGEMENT SYSTEM              ');
    log('========================================================');
    
    log('\n[Status]');
    log(`  Test Bot: ${testBot ? '[RUNNING]' : '[STOPPED]'}`);
    log(`  Production Bot: ${productionBot ? '[RUNNING]' : '[STOPPED]'}`);
    
    log('\n[Menu]');
    log('  [1] Start Test Bot');
    log('  [2] Stop Test Bot');
    log('  [3] Start Production Bot');
    log('  [4] Stop Production Bot');
    log('  [5] Deploy Code (Test -> Production)');
    log('  [6] Restart All Bots');
    log('  [7] View Logs');
    log('  [8] Settings');
    log('  [9] Exit');
    
    process.stdout.write('\nSelect: ');
}

// 봇 시작 함수
function startBot(type) {
    return new Promise((resolve, reject) => {
        const envFile = type === 'test' ? '.env' : '.env.production.private';
        const botName = type === 'test' ? '테스트봇' : '프로덕션봇';
        
        log(`\n🚀 ${botName} 시작 중...`, 'yellow');
        
        // 환경 변수 설정
        const env = { ...process.env };
        
        // .env 파일 읽기
        const envContent = fs.readFileSync(envFile, 'utf8');
        envContent.split('\n').forEach(line => {
            // 주석 무시
            if (line.startsWith('#') || !line.includes('=')) return;
            
            // = 기준으로 첫 번째만 분리 (URL에 = 가 여러개 있을 수 있음)
            const equalIndex = line.indexOf('=');
            if (equalIndex > 0) {
                const key = line.substring(0, equalIndex).trim();
                const value = line.substring(equalIndex + 1).trim();
                if (key && value) {
                    env[key] = value;
                }
            }
        });
        
        // 봇 프로세스 시작
        const botProcess = spawn('node', ['--max-old-space-size=4096', 'index.js'], {
            env: env,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        // 로그 출력
        botProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            // 모든 로그 표시
            if (message) {
                console.log(`[${botName}] ${message}`);
            }
        });
        
        botProcess.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (message) {
                console.error(`[${botName} Error] ${message}`);
            }
        });
        
        botProcess.on('close', (code) => {
            log(`[${botName}] 프로세스 종료 (코드: ${code})`, 'yellow');
            if (type === 'test') {
                testBot = null;
            } else {
                productionBot = null;
            }
        });
        
        if (type === 'test') {
            testBot = botProcess;
        } else {
            productionBot = botProcess;
        }
        
        setTimeout(() => {
            log(`✅ ${botName} 시작 완료!`, 'green');
            resolve();
        }, 3000);
    });
}

// 봇 중지 함수
function stopBot(type) {
    const botProcess = type === 'test' ? testBot : productionBot;
    const botName = type === 'test' ? '테스트봇' : '프로덕션봇';
    
    if (!botProcess) {
        log(`❌ ${botName}이 실행중이 아닙니다.`, 'red');
        return Promise.resolve();
    }
    
    return new Promise((resolve) => {
        log(`\n🛑 ${botName} 중지 중...`, 'yellow');
        
        botProcess.kill('SIGTERM');
        
        setTimeout(() => {
            if (botProcess && !botProcess.killed) {
                botProcess.kill('SIGKILL');
            }
            
            if (type === 'test') {
                testBot = null;
            } else {
                productionBot = null;
            }
            
            log(`✅ ${botName} 중지 완료!`, 'green');
            resolve();
        }, 2000);
    });
}

// 코드 배포 함수
async function deployCode() {
    log('\n📦 코드 배포 시작 (테스트 → 프로덕션)', 'magenta');
    
    // 1. 버전 정보 업데이트
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const currentVersion = packageJson.version;
    const versionParts = currentVersion.split('.');
    versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
    const newVersion = versionParts.join('.');
    
    packageJson.version = newVersion;
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    
    log(`📌 버전 업데이트: ${currentVersion} → ${newVersion}`, 'cyan');
    
    // 2. 배포 로그 작성
    const deployLog = {
        version: newVersion,
        deployedAt: new Date().toISOString(),
        deployedBy: process.env.USERNAME || 'admin',
        changes: []
    };
    
    const deployLogPath = 'deploy-log.json';
    let deployHistory = [];
    
    if (fs.existsSync(deployLogPath)) {
        deployHistory = JSON.parse(fs.readFileSync(deployLogPath, 'utf8'));
    }
    
    deployHistory.push(deployLog);
    fs.writeFileSync(deployLogPath, JSON.stringify(deployHistory, null, 2));
    
    // 3. Git 커밋 (선택사항)
    try {
        await execPromise('git add -A');
        await execPromise(`git commit -m "🚀 Deploy v${newVersion} to production"`);
        log('✅ Git 커밋 완료', 'green');
    } catch (error) {
        log('⚠️ Git 커밋 실패 (이미 커밋되었거나 변경사항 없음)', 'yellow');
    }
    
    // 4. 프로덕션봇 재시작
    if (productionBot) {
        await stopBot('production');
    }
    await startBot('production');
    
    log(`\n✅ 배포 완료! 버전 ${newVersion}이 프로덕션에 적용되었습니다.`, 'green');
}

// exec을 Promise로 변환
function execPromise(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

// 로그 보기
function showLogs() {
    console.clear();
    log('📜 로그 옵션:', 'yellow');
    log('  [1] 테스트봇 로그', 'white');
    log('  [2] 프로덕션봇 로그', 'white');
    log('  [3] 배포 히스토리', 'white');
    log('  [4] 돌아가기', 'white');
    
    return new Promise((resolve) => {
        rl.question('\n선택: ', async (answer) => {
            switch(answer) {
                case '1':
                    log('\n📄 테스트봇 로그는 실시간으로 메인 화면에 표시됩니다.', 'blue');
                    break;
                case '2':
                    log('\n📄 프로덕션봇 로그는 실시간으로 메인 화면에 표시됩니다.', 'green');
                    break;
                case '3':
                    if (fs.existsSync('deploy-log.json')) {
                        const history = JSON.parse(fs.readFileSync('deploy-log.json', 'utf8'));
                        log('\n📊 배포 히스토리:', 'magenta');
                        history.slice(-10).forEach(deploy => {
                            log(`  v${deploy.version} - ${new Date(deploy.deployedAt).toLocaleString()}`, 'white');
                        });
                    } else {
                        log('\n❌ 배포 히스토리가 없습니다.', 'red');
                    }
                    break;
            }
            
            setTimeout(resolve, 3000);
        });
    });
}

// 환경 설정
function showSettings() {
    console.clear();
    log('⚙️ 환경 설정:', 'yellow');
    log('  [1] 테스트 서버 ID 변경', 'white');
    log('  [2] 프로덕션 서버 ID 변경', 'white');
    log('  [3] 자동 백업 설정', 'white');
    log('  [4] 돌아가기', 'white');
    
    return new Promise((resolve) => {
        rl.question('\n선택: ', async (answer) => {
            // 설정 변경 로직 (필요시 구현)
            log('\n⚠️ 설정 변경은 수동으로 .env 파일을 수정해주세요.', 'yellow');
            setTimeout(resolve, 2000);
        });
    });
}

// readline 인터페이스
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// 메인 루프
async function main() {
    while (true) {
        showMenu();
        
        const answer = await new Promise((resolve) => {
            rl.question('', resolve);
        });
        
        switch(answer) {
            case '1':
                await startBot('test');
                break;
            case '2':
                await stopBot('test');
                break;
            case '3':
                await startBot('production');
                break;
            case '4':
                await stopBot('production');
                break;
            case '5':
                await deployCode();
                break;
            case '6':
                log('\n🔄 모든 봇 재시작 중...', 'yellow');
                await Promise.all([
                    stopBot('test'),
                    stopBot('production')
                ]);
                await Promise.all([
                    startBot('test'),
                    startBot('production')
                ]);
                break;
            case '7':
                await showLogs();
                break;
            case '8':
                await showSettings();
                break;
            case '9':
                log('\n👋 봇 관리자를 종료합니다...', 'yellow');
                await Promise.all([
                    stopBot('test'),
                    stopBot('production')
                ]);
                process.exit(0);
                break;
            default:
                log('\n❌ 잘못된 선택입니다.', 'red');
                await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// 종료 핸들러
process.on('SIGINT', async () => {
    log('\n\n⚠️ 종료 신호 감지...', 'yellow');
    await Promise.all([
        stopBot('test'),
        stopBot('production')
    ]);
    process.exit(0);
});

// 프로그램 시작
log('🚀 김헌터 봇 관리 시스템 시작...', 'cyan');
main();