class KimHunterIDE {
    constructor() {
        this.isAuthenticated = false;
        this.botRunning = false;
        this.claudeRunning = false;
        this.chatHistory = [];
        this.ws = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.connectWebSocket();
        this.checkAuthentication();
    }

    initializeElements() {
        // 모달 요소들 제거됨 - 자동 인증

        // 헤더 요소들
        this.startBotBtn = document.getElementById('start-bot-btn');
        this.stopBotBtn = document.getElementById('stop-bot-btn');
        this.startClaudeBtn = document.getElementById('start-claude-btn');
        this.statusIndicator = document.getElementById('status-indicator');

        // Claude 터미널 요소들
        this.claudeTerminal = document.getElementById('claude-terminal');
        this.claudeInput = document.getElementById('claude-input');
        this.sendClaudeBtn = document.getElementById('send-claude');
        this.clearClaudeBtn = document.getElementById('clear-claude');

        // 봇 콘솔 요소들
        this.botConsole = document.getElementById('bot-console');
        this.clearBotBtn = document.getElementById('clear-bot');

        // 채팅 요소들
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendMessageBtn = document.getElementById('send-message');
        this.clearChatBtn = document.getElementById('clear-chat');
        this.saveChatBtn = document.getElementById('save-chat');

        // 연결 상태
        this.connectionStatus = document.getElementById('connection-status');
        
        // 초기 연결 상태 설정
        if (this.connectionStatus) {
            this.connectionStatus.textContent = '🟡 서버 연결 확인 중...';
            this.connectionStatus.className = 'connection-status warning';
        }
    }

    setupEventListeners() {
        // 인증 이벤트 제거됨 - 자동 인증

        // 봇 제어 이벤트
        if (this.startBotBtn) this.startBotBtn.addEventListener('click', () => this.startBot());
        if (this.stopBotBtn) this.stopBotBtn.addEventListener('click', () => this.stopBot());

        // Claude 터미널 이벤트
        if (this.startClaudeBtn) this.startClaudeBtn.addEventListener('click', () => this.startClaudeTerminal());
        if (this.sendClaudeBtn) this.sendClaudeBtn.addEventListener('click', () => this.sendClaudeInput());
        if (this.claudeInput) this.claudeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendClaudeInput();
            }
        });
        if (this.clearClaudeBtn) this.clearClaudeBtn.addEventListener('click', () => this.clearClaudeTerminal());

        // 봇 콘솔 이벤트
        if (this.clearBotBtn) this.clearBotBtn.addEventListener('click', () => this.clearBotConsole());

        // 채팅 이벤트
        if (this.sendMessageBtn) this.sendMessageBtn.addEventListener('click', () => this.sendChatMessage());
        if (this.userInput) this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        if (this.clearChatBtn) this.clearChatBtn.addEventListener('click', () => this.clearChat());
        if (this.saveChatBtn) this.saveChatBtn.addEventListener('click', () => this.saveChat());
    }

    async connectWebSocket() {
        // HTTP API 사용으로 WebSocket 제거, 대신 서버 연결 상태 확인
        await this.checkServerConnection();
        
        // 봇 콘솔 주기적 업데이트
        this.startBotConsolePolling();
        
        // 주기적으로 서버 연결 상태 확인
        this.startConnectionPolling();
    }
    
    async checkServerConnection() {
        try {
            // AbortController를 사용한 타임아웃 구현
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('/api/health', { 
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                this.connectionStatus.textContent = '🟢 서버 연결됨';
                this.connectionStatus.className = 'connection-status connected';
                return true;
            } else {
                throw new Error(`서버 응답 오류: ${response.status}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                this.connectionStatus.textContent = '🟡 서버 응답 지연';
                this.connectionStatus.className = 'connection-status warning';
            } else {
                this.connectionStatus.textContent = '🔴 서버 연결 실패';
                this.connectionStatus.className = 'connection-status disconnected';
            }
            console.error('서버 연결 확인 실패:', error);
            return false;
        }
    }
    
    startConnectionPolling() {
        // 30초마다 서버 연결 상태 확인
        setInterval(async () => {
            await this.checkServerConnection();
        }, 30000);
    }
    
    startBotConsolePolling() {
        // 봇 상태 및 로그 주기적 확인
        setInterval(async () => {
            try {
                const response = await fetch('/api/bot-logs');
                if (response.ok) {
                    const result = await response.json();
                    if (result.logs && result.logs.length > 0) {
                        result.logs.forEach(log => {
                            this.appendBotOutput(log);
                        });
                    }
                }
            } catch (error) {
                // 조용히 실패
            }
        }, 2000); // 2초마다 체크
    }

    // WebSocket 메시지 핸들러 제거됨 - HTTP API 사용

    async checkAuthentication() {
        try {
            const response = await fetch('/api/check-auth');
            const result = await response.json();
            
            if (result.authenticated) {
                this.isAuthenticated = true;
                this.updateStatus('자동 인증됨 (.env)', 'online');
                this.showNotification('✅ API 키로 자동 인증 완료!', 'success');
                return;
            }
        } catch (error) {
            console.error('인증 확인 실패:', error);
        }
        
        // 인증 실패 시에도 모달 표시 안함
        this.updateStatus('인증 실패', 'offline');
        this.showNotification('❌ API 키 설정을 확인해주세요.', 'error');
    }

    // 인증 모달 함수들 제거됨 - 자동 인증

    // 수동 인증 함수 제거됨 - 자동 인증만 사용

    updateStatus(text, type) {
        this.statusIndicator.textContent = `● ${text}`;
        this.statusIndicator.className = `status ${type}`;
    }

    async startBot() {
        if (!this.isAuthenticated) {
            this.showNotification('먼저 Claude 계정으로 로그인해주세요.', 'warning');
            return;
        }

        this.startBotBtn.disabled = true;
        this.startBotBtn.textContent = '시작 중...';

        try {
            const response = await fetch('/api/start-bot', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.botRunning = true;
                this.startBotBtn.style.display = 'none';
                this.stopBotBtn.style.display = 'inline-block';
                this.showNotification(result.message, 'success');
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (error) {
            this.showNotification('봇 시작 중 오류가 발생했습니다.', 'error');
        } finally {
            this.startBotBtn.disabled = false;
            this.startBotBtn.textContent = '🚀 봇 시작';
        }
    }

    async stopBot() {
        this.stopBotBtn.disabled = true;
        this.stopBotBtn.textContent = '중지 중...';

        try {
            const response = await fetch('/api/stop-bot', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.botRunning = false;
                this.stopBotBtn.style.display = 'none';
                this.startBotBtn.style.display = 'inline-block';
                this.showNotification(result.message, 'success');
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (error) {
            this.showNotification('봇 중지 중 오류가 발생했습니다.', 'error');
        } finally {
            this.stopBotBtn.disabled = false;
            this.stopBotBtn.textContent = '⏹️ 봇 중지';
        }
    }

    async startClaudeTerminal() {
        if (!this.isAuthenticated) {
            this.showNotification('먼저 Claude 계정으로 로그인해주세요.', 'warning');
            return;
        }

        this.startClaudeBtn.disabled = true;
        this.startClaudeBtn.textContent = '시작 중...';

        try {
            const response = await fetch('/api/start-claude', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.claudeRunning = true;
                this.startClaudeBtn.textContent = '🤖 Claude 실행중';
                this.startClaudeBtn.style.backgroundColor = '#4caf50';
                this.showNotification(result.message, 'success');
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (error) {
            this.showNotification('Claude Code 시작 중 오류가 발생했습니다.', 'error');
        } finally {
            this.startClaudeBtn.disabled = false;
            if (!this.claudeRunning) {
                this.startClaudeBtn.textContent = '🤖 Claude Code';
            }
        }
    }

    async sendClaudeInput() {
        const input = this.claudeInput.value.trim();
        
        if (!input || !this.claudeRunning) return;

        this.claudeInput.value = '';

        try {
            const response = await fetch('/api/claude-input', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input })
            });
        } catch (error) {
            this.appendClaudeOutput(`오류: ${error.message}\n`);
        }
    }

    appendClaudeOutput(data) {
        this.claudeTerminal.textContent += data;
        this.claudeTerminal.scrollTop = this.claudeTerminal.scrollHeight;
    }

    clearClaudeTerminal() {
        this.claudeTerminal.textContent = '';
    }

    appendBotOutput(data) {
        const formattedData = this.formatBotOutput(data);
        this.botConsole.innerHTML += formattedData;
        this.botConsole.scrollTop = this.botConsole.scrollHeight;
    }

    formatBotOutput(data) {
        let formatted = data.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        if (formatted.includes('ERROR') || formatted.includes('Error')) {
            formatted = `<span class="error">${formatted}</span>`;
        } else if (formatted.includes('WARN') || formatted.includes('Warning')) {
            formatted = `<span class="warning">${formatted}</span>`;
        } else if (formatted.includes('INFO') || formatted.includes('로그인') || formatted.includes('연결')) {
            formatted = `<span class="info">${formatted}</span>`;
        }
        
        return formatted.replace(/\n/g, '<br>');
    }

    clearBotConsole() {
        this.botConsole.innerHTML = '';
    }

    async sendChatMessage() {
        const message = this.userInput.value.trim();
        
        if (!message) return;

        if (!this.isAuthenticated) {
            this.showNotification('먼저 인증을 완료해주세요.', 'warning');
            return;
        }

        this.addChatMessage('user', message);
        this.userInput.value = '';
        
        // 실제 Claude API 호출
        this.addChatMessage('claude', '💭 Claude가 응답을 생성하고 있습니다...');
        
        try {
            const response = await fetch('/api/claude-input', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input: message })
            });
            
            const result = await response.json();
            
            // 마지막 메시지(로딩 메시지) 제거
            const lastMessage = this.chatMessages.lastElementChild;
            if (lastMessage) {
                this.chatMessages.removeChild(lastMessage);
                this.chatHistory.pop();
            }
            
            if (result.success) {
                this.addChatMessage('claude', result.output);
            } else {
                this.addChatMessage('claude', `❌ 오류: ${result.output || '응답을 받을 수 없습니다.'}`);
            }
        } catch (error) {
            // 마지막 메시지(로딩 메시지) 제거
            const lastMessage = this.chatMessages.lastElementChild;
            if (lastMessage) {
                this.chatMessages.removeChild(lastMessage);
                this.chatHistory.pop();
            }
            
            this.addChatMessage('claude', `❌ 네트워크 오류: ${error.message}`);
        }
    }

    addChatMessage(sender, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';
        headerDiv.textContent = sender === 'user' ? '👤 사용자' : '🤖 Claude';
        
        const contentDiv = document.createElement('div');
        contentDiv.textContent = content;
        
        messageDiv.appendChild(headerDiv);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        this.chatHistory.push({ sender, content, timestamp: new Date() });
    }

    // 시뮬레이션 함수 제거됨 - 실제 Claude API 사용

    clearChat() {
        this.chatMessages.innerHTML = '';
        this.chatHistory = [];
        this.showNotification('대화 내역이 삭제되었습니다.', 'success');
    }

    saveChat() {
        if (this.chatHistory.length === 0) {
            this.showNotification('저장할 대화 내역이 없습니다.', 'warning');
            return;
        }

        const chatData = {
            timestamp: new Date().toISOString(),
            messages: this.chatHistory
        };

        const dataStr = JSON.stringify(chatData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showNotification('대화 내역이 저장되었습니다.', 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1001;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#4caf50';
                break;
            case 'error':
                notification.style.backgroundColor = '#f44336';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ff9800';
                break;
            default:
                notification.style.backgroundColor = '#2196f3';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.style.opacity = '1', 100);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    new KimHunterIDE();
});