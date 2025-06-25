const { ipcRenderer } = require('electron');
const fs = require('fs');

// 터미널 로그 저장
const logs = {
    test: [],
    production: []
};

// 차트 설정
let activityChart;

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    initializeChart();
    setupEventListeners();
    setupKeyboardShortcuts();
    updateStatus();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    // 타이틀바 버튼
    document.getElementById('minimize-btn').addEventListener('click', () => {
        ipcRenderer.invoke('minimize');
    });

    document.getElementById('maximize-btn').addEventListener('click', () => {
        ipcRenderer.invoke('maximize');
    });

    document.getElementById('close-btn').addEventListener('click', () => {
        ipcRenderer.invoke('close');
    });

    // 봇 컨트롤 버튼
    document.getElementById('test-control').addEventListener('click', (e) => {
        toggleBot('test', e.currentTarget);
    });

    document.getElementById('production-control').addEventListener('click', (e) => {
        toggleBot('production', e.currentTarget);
    });

    // 액션 버튼
    document.getElementById('deploy-btn').addEventListener('click', deployToProduction);
    document.getElementById('restart-all-btn').addEventListener('click', restartAllBots);
    document.getElementById('clear-logs-btn').addEventListener('click', clearAllLogs);
    
    // 터미널 복사 기능 향상
    setupTerminalCopyPaste();
    
    // 터미널 자동 스크롤 토글
    setupAutoScrollToggle();
}

// 봇 토글
async function toggleBot(type, button) {
    const icon = button.querySelector('i');
    const isRunning = icon.classList.contains('fa-stop');

    button.disabled = true;
    
    try {
        if (isRunning) {
            await ipcRenderer.invoke('stop-bot', type);
        } else {
            await ipcRenderer.invoke('start-bot', type);
        }
    } catch (error) {
        console.error('Bot toggle error:', error);
    } finally {
        button.disabled = false;
    }
}

// 봇 로그 수신
ipcRenderer.on('bot-log', (event, data) => {
    const { type, message, level } = data;
    const terminal = document.getElementById(`${type}-terminal`);
    const timestamp = new Date().toLocaleTimeString();
    
    // 로그 저장 (최대 500개로 제한)
    logs[type].push({ timestamp, message, level });
    if (logs[type].length > 500) {
        logs[type].shift();
    }
    
    // 터미널 자식 요소 수 제한 (최대 500개)
    while (terminal.children.length >= 500) {
        terminal.removeChild(terminal.firstChild);
    }
    
    // 로그 표시
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> <span class="log-${level}">${escapeHtml(message)}</span>`;
    terminal.appendChild(logEntry);
    
    // 자동 스크롤 (사용자가 스크롤 중이 아니고 자동 스크롤이 활성화되어 있을 때만)
    if (shouldAutoScroll(terminal, type)) {
        requestAnimationFrame(() => {
            terminal.scrollTop = terminal.scrollHeight;
        });
    }
    
    // 에러 처리
    if (level === 'error') {
        addError(type, message);
    }
});

// 봇 상태 변경
ipcRenderer.on('bot-status-changed', (event, data) => {
    const { type, running } = data;
    const statusIcon = document.querySelector(`#${type}-status .status-icon`);
    const controlBtn = document.getElementById(`${type}-control`);
    const icon = controlBtn.querySelector('i');
    
    if (running) {
        statusIcon.classList.remove('offline');
        statusIcon.classList.add('online');
        icon.classList.remove('fa-play');
        icon.classList.add('fa-stop');
        controlBtn.classList.add('stop');
        updateStatusBar(`${type} bot started`);
    } else {
        statusIcon.classList.remove('online');
        statusIcon.classList.add('offline');
        icon.classList.remove('fa-stop');
        icon.classList.add('fa-play');
        controlBtn.classList.remove('stop');
        updateStatusBar(`${type} bot stopped`);
    }
});

// 통계 업데이트
ipcRenderer.on('stats-update', (event, stats) => {
    document.getElementById('test-commands').textContent = stats.test.commands;
    document.getElementById('prod-commands').textContent = stats.production.commands;
    document.getElementById('test-errors').textContent = stats.test.errors;
    document.getElementById('prod-errors').textContent = stats.production.errors;
    
    // Uptime 업데이트
    document.getElementById('uptime-test').textContent = `Test: ${formatUptime(stats.test.uptime)}`;
    document.getElementById('uptime-prod').textContent = `Prod: ${formatUptime(stats.production.uptime)}`;
    
    // 차트 업데이트
    updateChart(stats);
});

// 배포 완료
ipcRenderer.on('deploy-complete', (event, data) => {
    addDeployHistory(data.version);
    updateStatusBar(`Deployed version ${data.version} successfully`);
});

// 로그 지우기
ipcRenderer.on('clear-logs', () => {
    clearAllLogs();
});

// 로그 내보내기
ipcRenderer.on('export-logs', (event, filepath) => {
    const allLogs = {
        test: logs.test,
        production: logs.production,
        exported: new Date().toISOString()
    };
    
    fs.writeFileSync(filepath, JSON.stringify(allLogs, null, 2));
    updateStatusBar(`Logs exported to ${filepath}`);
});

// 배포 함수
async function deployToProduction() {
    const deployBtn = document.getElementById('deploy-btn');
    deployBtn.disabled = true;
    deployBtn.classList.add('deploying');
    
    try {
        const result = await ipcRenderer.invoke('deploy');
        if (result.success) {
            updateStatusBar('Deployment successful!');
        }
    } catch (error) {
        console.error('Deploy error:', error);
        updateStatusBar('Deployment failed!');
    } finally {
        deployBtn.disabled = false;
        deployBtn.classList.remove('deploying');
    }
}

// 모든 봇 재시작
async function restartAllBots() {
    const restartBtn = document.getElementById('restart-all-btn');
    restartBtn.disabled = true;
    
    try {
        // 터미널 클리어
        clearTerminal('test');
        clearTerminal('production');
        
        // 봇 중지
        await ipcRenderer.invoke('stop-bot', 'test');
        await ipcRenderer.invoke('stop-bot', 'production');
        
        // 상태 업데이트
        updateStatusBar('봇을 재시작하는 중...');
        
        // 잠시 대기 후 재시작
        setTimeout(async () => {
            await ipcRenderer.invoke('start-bot', 'test');
            await ipcRenderer.invoke('start-bot', 'production');
            updateStatusBar('봇이 재시작되었습니다.');
        }, 3000);
    } catch (error) {
        console.error('Restart error:', error);
        updateStatusBar('재시작 중 오류가 발생했습니다.');
    } finally {
        setTimeout(() => {
            restartBtn.disabled = false;
        }, 5000);
    }
}

// 터미널 지우기
function clearTerminal(type) {
    const terminal = document.getElementById(`${type}-terminal`);
    terminal.innerHTML = '';
    logs[type] = [];
}

// 모든 로그 지우기
function clearAllLogs() {
    clearTerminal('test');
    clearTerminal('production');
    updateStatusBar('All logs cleared');
}

// 로그 내보내기
function exportLogs(type) {
    const data = logs[type].map(log => 
        `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-bot-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// 탭 전환
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    event.target.classList.add('active');
    document.getElementById(`${tabName}-content`).style.display = 'block';
}

// 차트 초기화
function initializeChart() {
    const ctx = document.getElementById('activity-chart').getContext('2d');
    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Test Bot',
                data: [],
                borderColor: '#4ec9b0',
                backgroundColor: 'rgba(78, 201, 176, 0.1)',
                tension: 0.4
            }, {
                label: 'Production Bot',
                data: [],
                borderColor: '#007acc',
                backgroundColor: 'rgba(0, 122, 204, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#cccccc',
                        font: { size: 11 }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#2d2d30' },
                    ticks: { color: '#969696', font: { size: 10 } }
                },
                y: {
                    grid: { color: '#2d2d30' },
                    ticks: { color: '#969696', font: { size: 10 } }
                }
            }
        }
    });
}

// 차트 업데이트
function updateChart(stats) {
    const time = new Date().toLocaleTimeString();
    
    activityChart.data.labels.push(time);
    activityChart.data.datasets[0].data.push(stats.test.commands);
    activityChart.data.datasets[1].data.push(stats.production.commands);
    
    // 최대 20개 데이터 포인트 유지
    if (activityChart.data.labels.length > 20) {
        activityChart.data.labels.shift();
        activityChart.data.datasets[0].data.shift();
        activityChart.data.datasets[1].data.shift();
    }
    
    activityChart.update('none');
}

// 배포 히스토리 추가
function addDeployHistory(version) {
    const historyDiv = document.getElementById('deploy-history');
    const item = document.createElement('div');
    item.className = 'deploy-item';
    item.innerHTML = `
        <div class="version">Version ${version}</div>
        <div class="time">${new Date().toLocaleString()}</div>
    `;
    historyDiv.insertBefore(item, historyDiv.firstChild);
}

// 에러 추가
function addError(bot, message) {
    const errorList = document.getElementById('error-list');
    const item = document.createElement('div');
    item.className = 'error-item';
    item.innerHTML = `
        <div class="error-time">[${bot.toUpperCase()}] ${new Date().toLocaleString()}</div>
        <div class="error-message">${escapeHtml(message)}</div>
    `;
    errorList.insertBefore(item, errorList.firstChild);
    
    // 최대 50개 에러 유지
    while (errorList.children.length > 50) {
        errorList.removeChild(errorList.lastChild);
    }
}

// 상태바 업데이트
function updateStatusBar(message) {
    document.getElementById('status-text').textContent = message;
}

// 상태 업데이트
async function updateStatus() {
    try {
        const status = await ipcRenderer.invoke('get-status');
        // 초기 상태 설정
    } catch (error) {
        console.error('Status update error:', error);
    }
}

// 유틸리티 함수
function formatUptime(ms) {
    if (!ms) return '--:--:--';
    
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 터미널 복사/붙여넣기 기능 설정
function setupTerminalCopyPaste() {
    const terminals = document.querySelectorAll('.terminal');
    
    terminals.forEach(terminal => {
        // 복사 단축키 (Ctrl+C)
        terminal.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'c') {
                const selection = window.getSelection();
                if (selection.toString()) {
                    navigator.clipboard.writeText(selection.toString());
                    showCopyNotification(terminal);
                }
            }
        });
        
        // 마우스 우클릭 메뉴
        terminal.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const selection = window.getSelection();
            if (selection.toString()) {
                navigator.clipboard.writeText(selection.toString());
                showCopyNotification(terminal);
            }
        });
        
        // 드래그 후 자동 복사 (옵션)
        terminal.addEventListener('mouseup', () => {
            const selection = window.getSelection();
            if (selection.toString() && selection.toString().length > 0) {
                // 선택된 텍스트가 있으면 클립보드에 복사
                setTimeout(() => {
                    navigator.clipboard.writeText(selection.toString());
                }, 100);
            }
        });
    });
}

// 복사 알림 표시
function showCopyNotification(terminal) {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = 'Copied!';
    notification.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: #4ec9b0;
        color: #1e1e1e;
        padding: 5px 10px;
        border-radius: 3px;
        font-size: 12px;
        z-index: 1000;
        animation: fadeOut 2s ease-in-out;
    `;
    
    terminal.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// 자동 스크롤 토글 설정
const autoScrollEnabled = { test: true, production: true };

function setupAutoScrollToggle() {
    const terminals = ['test', 'production'];
    
    terminals.forEach(type => {
        const header = document.querySelector(`#${type}-terminal`).parentElement.querySelector('.terminal-header');
        
        // 자동 스크롤 토글 버튼 추가
        const scrollToggle = document.createElement('button');
        scrollToggle.className = 'terminal-btn';
        scrollToggle.innerHTML = '<i class="fas fa-arrow-down"></i>';
        scrollToggle.title = 'Toggle Auto-scroll';
        scrollToggle.style.color = '#4ec9b0';
        
        scrollToggle.addEventListener('click', () => {
            autoScrollEnabled[type] = !autoScrollEnabled[type];
            scrollToggle.style.color = autoScrollEnabled[type] ? '#4ec9b0' : '#969696';
            
            // 자동 스크롤이 켜지면 즉시 맨 아래로 스크롤
            if (autoScrollEnabled[type]) {
                const terminal = document.getElementById(`${type}-terminal`);
                terminal.scrollTop = terminal.scrollHeight;
            }
        });
        
        header.querySelector('.terminal-controls').appendChild(scrollToggle);
    });
}

// 자동 스크롤 로직 수정
function shouldAutoScroll(terminal, type) {
    if (!autoScrollEnabled[type]) return false;
    
    const isScrolledToBottom = terminal.scrollHeight - terminal.clientHeight <= terminal.scrollTop + 50;
    return isScrolledToBottom;
}

// 키보드 단축키 설정
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+C: 터미널 클리어
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            clearAllLogs();
            updateStatusBar('All terminals cleared (Ctrl+Shift+C)');
        }
        
        // Ctrl+R: 모든 봇 재시작
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            restartAllBots();
        }
        
        // Ctrl+D: 배포
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            deployToProduction();
        }
        
        // F1: 테스트 봇 토글
        if (e.key === 'F1') {
            e.preventDefault();
            const testBtn = document.getElementById('test-control');
            testBtn.click();
        }
        
        // F2: 프로덕션 봇 토글
        if (e.key === 'F2') {
            e.preventDefault();
            const prodBtn = document.getElementById('production-control');
            prodBtn.click();
        }
        
        // Ctrl+S: 로그 저장
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filepath = `bot-logs-${timestamp}.json`;
            ipcRenderer.invoke('export-logs', filepath);
        }
        
        // Alt+1, Alt+2, Alt+3: 탭 전환
        if (e.altKey) {
            if (e.key === '1') {
                document.querySelector('.tab[onclick*="activity"]').click();
            } else if (e.key === '2') {
                document.querySelector('.tab[onclick*="deploy"]').click();
            } else if (e.key === '3') {
                document.querySelector('.tab[onclick*="errors"]').click();
            }
        }
    });
}

// 터미널 빠른 검색 기능 추가
function setupQuickSearch() {
    const terminals = document.querySelectorAll('.terminal');
    
    terminals.forEach(terminal => {
        let searchBox = null;
        
        terminal.addEventListener('keydown', (e) => {
            // Ctrl+F: 검색 박스 토글
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                
                if (!searchBox) {
                    searchBox = createSearchBox(terminal);
                    terminal.parentElement.insertBefore(searchBox, terminal);
                } else {
                    searchBox.style.display = searchBox.style.display === 'none' ? 'block' : 'none';
                    if (searchBox.style.display === 'block') {
                        searchBox.querySelector('input').focus();
                    }
                }
            }
        });
    });
}

// 검색 박스 생성
function createSearchBox(terminal) {
    const searchBox = document.createElement('div');
    searchBox.className = 'search-box';
    searchBox.style.cssText = `
        background: #2d2d30;
        padding: 8px;
        display: none;
        border-bottom: 1px solid #3e3e42;
    `;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search in terminal...';
    input.style.cssText = `
        background: #1e1e1e;
        border: 1px solid #3e3e42;
        color: #cccccc;
        padding: 4px 8px;
        width: 300px;
        font-size: 12px;
    `;
    
    let currentHighlight = null;
    
    input.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        // 이전 하이라이트 제거
        if (currentHighlight) {
            terminal.innerHTML = terminal.innerHTML.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '$1');
        }
        
        if (searchTerm) {
            // 새 하이라이트 추가
            const content = terminal.innerHTML;
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            terminal.innerHTML = content.replace(regex, '<mark style="background: #ff9900; color: #000;">$1</mark>');
            currentHighlight = searchTerm;
        }
    });
    
    searchBox.appendChild(input);
    return searchBox;
}

// 터미널 향상 기능 초기화
setupQuickSearch();

// 스타일 추가 (복사 알림 애니메이션)
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        0% { opacity: 1; transform: translateY(0); }
        70% { opacity: 1; }
        100% { opacity: 0; transform: translateY(-10px); }
    }
    
    /* 단축키 도움말 스타일 */
    .shortcut-help {
        position: fixed;
        bottom: 30px;
        right: 10px;
        background: #2d2d30;
        border: 1px solid #3e3e42;
        padding: 10px;
        border-radius: 5px;
        font-size: 11px;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
        z-index: 1000;
    }
    
    .shortcut-help.show {
        opacity: 0.9;
    }
    
    .shortcut-help h4 {
        margin: 0 0 8px 0;
        color: #007acc;
    }
    
    .shortcut-help div {
        color: #cccccc;
        margin: 2px 0;
    }
    
    .shortcut-help kbd {
        background: #1e1e1e;
        border: 1px solid #3e3e42;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: monospace;
    }
`;
document.head.appendChild(style);

// 단축키 도움말 표시
const helpDiv = document.createElement('div');
helpDiv.className = 'shortcut-help';
helpDiv.innerHTML = `
    <h4>Keyboard Shortcuts</h4>
    <div><kbd>Ctrl+R</kbd> Restart All</div>
    <div><kbd>Ctrl+D</kbd> Deploy</div>
    <div><kbd>Ctrl+Shift+C</kbd> Clear All</div>
    <div><kbd>Ctrl+S</kbd> Save Logs</div>
    <div><kbd>F1/F2</kbd> Toggle Bots</div>
    <div><kbd>Alt+1/2/3</kbd> Switch Tabs</div>
`;
document.body.appendChild(helpDiv);

// ? 키를 누르면 도움말 표시
document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.ctrlKey && !e.altKey) {
        helpDiv.classList.toggle('show');
        setTimeout(() => {
            helpDiv.classList.remove('show');
        }, 5000);
    }
});

// 로그 필터링 기능
const logFilters = {
    test: 'all',
    production: 'all'
};

function filterLogs(type, filter) {
    logFilters[type] = filter;
    const terminal = document.getElementById(`${type}-terminal`);
    const entries = terminal.querySelectorAll('.log-entry');
    
    entries.forEach(entry => {
        const logText = entry.textContent.toLowerCase();
        let shouldShow = false;
        
        switch (filter) {
            case 'all':
                shouldShow = true;
                break;
            case 'info':
                shouldShow = entry.querySelector('.log-info') !== null;
                break;
            case 'warning':
                shouldShow = entry.querySelector('.log-warning') !== null;
                break;
            case 'error':
                shouldShow = entry.querySelector('.log-error') !== null;
                break;
        }
        
        entry.style.display = shouldShow ? 'block' : 'none';
    });
}

// 전역 함수로 내보내기 (HTML onclick에서 사용)
window.clearTerminal = clearTerminal;
window.exportLogs = exportLogs;
window.switchTab = switchTab;
window.filterLogs = filterLogs;