class KimHunterIDE {
    constructor() {
        this.isAuthenticated = false;
        this.botRunning = false;
        this.claudeRunning = false;
        this.chatHistory = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkAuthentication();
        this.updateConnectionStatus('connected');
    }

    initializeElements() {
        // 모달 요소들
        this.authModal = document.getElementById('auth-modal');
        this.authCodeInput = document.getElementById('auth-code');
        this.authBtn = document.getElementById('auth-btn');
        this.cancelAuthBtn = document.getElementById('cancel-auth');
        this.authStatus = document.getElementById('auth-status');

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
    }

    setupEventListeners() {
        // 인증 이벤트
        this.authBtn.addEventListener('click', () => this.authenticate());
        this.cancelAuthBtn.addEventListener('click', () => this.hideAuthModal());
        this.authCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) this.authenticate();
        });

        // 봇 제어 이벤트
        this.startBotBtn.addEventListener('click', () => this.startBot());
        this.stopBotBtn.addEventListener('click', () => this.stopBot());

        // Claude 터미널 이벤트
        this.startClaudeBtn.addEventListener('click', () => this.startClaudeTerminal());
        this.sendClaudeBtn.addEventListener('click', () => this.sendClaudeInput());
        this.claudeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendClaudeInput();
            }
        });
        this.clearClaudeBtn.addEventListener('click', () => this.clearClaudeTerminal());

        // 봇 콘솔 이벤트
        this.clearBotBtn.addEventListener('click', () => this.clearBotConsole());

        // 채팅 이벤트
        this.sendMessageBtn.addEventListener('click', () => this.sendChatMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        this.clearChatBtn.addEventListener('click', () => this.clearChat());
        this.saveChatBtn.addEventListener('click', () => this.saveChat());

        // 정기적으로 봇 출력 폴링
        this.startPolling();
    }

    updateConnectionStatus(status) {
        if (status === 'connected') {
            this.connectionStatus.textContent = '🟢 서버 연결됨';
            this.connectionStatus.className = 'connection-status connected';
        } else {
            this.connectionStatus.textContent = '🔴 서버 연결 끊어짐';
            this.connectionStatus.className = 'connection-status disconnected';
        }
    }

    async checkAuthentication() {
        try {
            const response = await fetch('/api/check-auth');
            const result = await response.json();
            
            if (result.authenticated) {
                this.isAuthenticated = true;
                this.hideAuthModal();
                this.updateStatus('인증됨', 'online');
                return;
            }
        } catch (error) {
            console.error('인증 확인 실패:', error);
        }
        
        this.showAuthModal();
    }

    showAuthModal() {
        this.authModal.style.display = 'flex';
        this.authCodeInput.focus();
    }

    hideAuthModal() {
        this.authModal.style.display = 'none';
        this.authStatus.textContent = '';
    }

    async authenticate() {
        const authCode = this.authCodeInput.value.trim();
        
        if (!authCode) {
            this.showAuthStatus('Authentication Code를 입력해주세요.', 'error');
            return;
        }

        if (authCode.length < 10) {
            this.showAuthStatus('올바른 Authentication Code를 입력해주세요.', 'error');
            return;
        }

        this.authBtn.disabled = true;
        this.authBtn.textContent = '인증 중...';
        this.showAuthStatus('Authentication Code를 확인하는 중입니다...', 'info');

        try {
            const response = await fetch('/api/authenticate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ authCode })
            });

            const result = await response.json();
            
            if (result.success) {
                this.isAuthenticated = true;
                this.showAuthStatus(result.message, 'success');
                this.updateStatus('인증됨', 'online');
                
                setTimeout(() => {
                    this.hideAuthModal();
                }, 1500);
            } else {
                this.showAuthStatus(result.message, 'error');
            }
        } catch (error) {
            this.showAuthStatus('인증 중 오류가 발생했습니다.', 'error');
            console.error('인증 오류:', error);
        } finally {
            this.authBtn.disabled = false;
            this.authBtn.textContent = '인증';
        }
    }

    showAuthStatus(message, type) {
        this.authStatus.textContent = message;
        this.authStatus.className = type;
    }

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
            const response = await fetch('/api/start-bot', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.botRunning = true;
                this.startBotBtn.style.display = 'none';
                this.stopBotBtn.style.display = 'inline-block';
                this.showNotification(result.message, 'success');
                this.appendBotOutput('🚀 봇 시작 요청이 전송되었습니다...\n');
            } else {
                this.showNotification(result.message, 'error');
                this.appendBotOutput(`❌ 봇 시작 실패: ${result.message}\n`);
            }
        } catch (error) {
            this.showNotification('봇 시작 중 오류가 발생했습니다.', 'error');
            this.appendBotOutput(`❌ 네트워크 오류: ${error.message}\n`);
            console.error('봇 시작 오류:', error);
        } finally {
            this.startBotBtn.disabled = false;
            this.startBotBtn.textContent = '🚀 봇 시작';
        }
    }

    async stopBot() {
        this.stopBotBtn.disabled = true;
        this.stopBotBtn.textContent = '중지 중...';

        try {
            const response = await fetch('/api/stop-bot', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.botRunning = false;
                this.stopBotBtn.style.display = 'none';
                this.startBotBtn.style.display = 'inline-block';
                this.showNotification(result.message, 'success');
                this.appendBotOutput('⏹️ 봇이 중지되었습니다.\n');
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (error) {
            this.showNotification('봇 중지 중 오류가 발생했습니다.', 'error');
            console.error('봇 중지 오류:', error);
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
            const response = await fetch('/api/start-claude', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.claudeRunning = true;
                this.startClaudeBtn.textContent = '🤖 Claude 실행중';
                this.startClaudeBtn.style.backgroundColor = '#4caf50';
                this.showNotification(result.message, 'success');
                this.appendClaudeOutput('🤖 Claude Code 터미널이 시작되었습니다!\n');
                this.appendClaudeOutput('사용 가능한 명령어: help, status, files\n\n');
            } else {
                this.showNotification(result.message, 'error');
            }
        } catch (error) {
            this.showNotification('Claude Code 시작 중 오류가 발생했습니다.', 'error');
            console.error('Claude 시작 오류:', error);
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

        this.appendClaudeOutput(`> ${input}\n`);
        this.claudeInput.value = '';

        try {
            const response = await fetch('/api/claude-input', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 응답은 서버에서 별도로 처리되므로 여기서는 기다리지 않음
        } catch (error) {
            this.appendClaudeOutput(`오류: ${error.message}\n`);
            console.error('Claude 입력 오류:', error);
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

        this.addChatMessage('user', message);
        this.userInput.value = '';

        // Claude API 호출 시뮬레이션
        setTimeout(() => {
            const response = this.generateClaudeResponse(message);
            this.addChatMessage('claude', response);
        }, 1000);
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

    generateClaudeResponse(message) {
        const responses = [
            "네, 이해했습니다. 어떤 부분을 도와드릴까요?",
            "좋은 질문이네요! 더 자세한 정보를 알려주시면 더 정확한 답변을 드릴 수 있습니다.",
            "김헌터 봇 프로젝트에 관련된 질문인가요? 구체적으로 어떤 부분이 궁금하신지 알려주세요.",
            "코드 수정이나 새로운 기능 추가에 대해 도움을 드릴 수 있습니다. 무엇을 원하시나요?",
            "봇이 현재 실행 중인지 확인해보시고, 문제가 있다면 콘솔 출력을 확인해보세요."
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }

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
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // 정기적으로 서버에서 출력 폴링
    startPolling() {
        // 실제 구현에서는 폴링 대신 Server-Sent Events나 주기적 API 호출 사용
        setInterval(() => {
            // 연결 상태 확인
            this.checkConnection();
        }, 5000);
    }

    async checkConnection() {
        try {
            const response = await fetch('/api/check-auth');
            if (response.ok) {
                this.updateConnectionStatus('connected');
            } else {
                this.updateConnectionStatus('disconnected');
            }
        } catch (error) {
            this.updateConnectionStatus('disconnected');
        }
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    new KimHunterIDE();
});