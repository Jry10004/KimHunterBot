// Discord.js 상호작용 모킹 유틸리티

class MockInteraction {
    constructor(options = {}) {
        this.id = options.id || Math.random().toString(36).substr(2, 9);
        this.userId = options.userId || '123456789012345678';
        this.user = {
            id: this.userId,
            username: options.username || 'testuser',
            discriminator: '0001',
            avatar: null
        };
        
        this.commandName = options.command || 'test';
        this.options = options.options || new Map();
        this.customId = options.customId || null;
        this.values = options.values || [];
        
        this.guild = {
            id: options.guildId || '987654321098765432',
            name: 'Test Guild'
        };
        
        this.channel = {
            id: options.channelId || '111111111111111111',
            send: jest.fn().mockResolvedValue({ id: 'message-id' })
        };
        
        this.replied = false;
        this.deferred = false;
        this.ephemeral = false;
        this.replies = [];
        this.updates = [];
        
        // 메서드 바인딩
        this.reply = this.reply.bind(this);
        this.editReply = this.editReply.bind(this);
        this.update = this.update.bind(this);
        this.deferReply = this.deferReply.bind(this);
        this.deferUpdate = this.deferUpdate.bind(this);
        this.followUp = this.followUp.bind(this);
    }
    
    async reply(content) {
        if (this.replied || this.deferred) {
            throw new Error('Interaction has already been acknowledged');
        }
        
        this.replied = true;
        this.replies.push(content);
        
        if (typeof content === 'string') {
            content = { content };
        }
        
        this.ephemeral = content.ephemeral || false;
        
        return { id: 'reply-' + this.replies.length };
    }
    
    async editReply(content) {
        if (!this.replied && !this.deferred) {
            throw new Error('Interaction has not been acknowledged');
        }
        
        if (this.replies.length > 0) {
            this.replies[this.replies.length - 1] = content;
        } else {
            this.replies.push(content);
        }
        
        return { id: 'edited-reply' };
    }
    
    async update(content) {
        this.updates.push(content);
        return { id: 'update-' + this.updates.length };
    }
    
    async deferReply(options = {}) {
        if (this.replied || this.deferred) {
            throw new Error('Interaction has already been acknowledged');
        }
        
        this.deferred = true;
        this.ephemeral = options.ephemeral || false;
        
        return Promise.resolve();
    }
    
    async deferUpdate() {
        this.deferred = true;
        return Promise.resolve();
    }
    
    async followUp(content) {
        this.replies.push(content);
        return { id: 'followup-' + this.replies.length };
    }
    
    // 옵션 관련 메서드
    getString(name) {
        return this.options.get(name);
    }
    
    getInteger(name) {
        return parseInt(this.options.get(name)) || null;
    }
    
    getUser(name) {
        const userId = this.options.get(name);
        return userId ? { id: userId, username: 'user' + userId } : null;
    }
    
    getBoolean(name) {
        return this.options.get(name) === 'true' || this.options.get(name) === true;
    }
    
    // 테스트 헬퍼 메서드
    getLastReply() {
        return this.replies[this.replies.length - 1];
    }
    
    getAllReplies() {
        return this.replies;
    }
    
    getLastUpdate() {
        return this.updates[this.updates.length - 1];
    }
    
    // 버튼/선택 메뉴 시뮬레이션
    async clickButton(customId) {
        this.customId = customId;
        this.isButton = () => true;
        this.isSelectMenu = () => false;
        
        // 버튼 핸들러 실행 시뮬레이션
        return Promise.resolve();
    }
    
    async selectMenu(customId, values) {
        this.customId = customId;
        this.values = values;
        this.isButton = () => false;
        this.isSelectMenu = () => true;
        
        // 선택 메뉴 핸들러 실행 시뮬레이션
        return Promise.resolve();
    }
    
    isButton() {
        return this.customId && !this.values.length;
    }
    
    isSelectMenu() {
        return this.customId && this.values.length > 0;
    }
    
    isCommand() {
        return !this.customId;
    }
}

// 상호작용 생성 헬퍼
function createMockInteraction(options = {}) {
    return new MockInteraction(options);
}

// 응답 대기 헬퍼
async function waitForReply(interaction, timeout = 100) {
    return new Promise((resolve) => {
        const checkReply = () => {
            if (interaction.replies.length > 0) {
                resolve(interaction.getLastReply());
            } else {
                setTimeout(checkReply, 10);
            }
        };
        
        setTimeout(checkReply, 10);
        
        // 타임아웃
        setTimeout(() => resolve(null), timeout);
    });
}

// 컬렉터 모킹
class MockCollector {
    constructor(filter, options = {}) {
        this.filter = filter;
        this.options = options;
        this.handlers = {};
        this.collected = new Map();
        this.ended = false;
    }
    
    on(event, handler) {
        this.handlers[event] = handler;
        return this;
    }
    
    emit(event, ...args) {
        if (this.handlers[event]) {
            this.handlers[event](...args);
        }
    }
    
    stop(reason = 'user') {
        this.ended = true;
        this.emit('end', this.collected, reason);
    }
    
    // 테스트용 상호작용 추가
    handleInteraction(interaction) {
        if (this.filter(interaction)) {
            this.collected.set(interaction.id, interaction);
            this.emit('collect', interaction);
        }
    }
}

// 메시지 모킹
class MockMessage {
    constructor(options = {}) {
        this.id = options.id || Math.random().toString(36).substr(2, 9);
        this.content = options.content || '';
        this.author = options.author || {
            id: '123456789012345678',
            username: 'testuser',
            bot: false
        };
        
        this.channel = options.channel || {
            id: '111111111111111111',
            send: jest.fn().mockResolvedValue(new MockMessage())
        };
        
        this.embeds = options.embeds || [];
        this.components = options.components || [];
        
        this.edits = [];
        this.reactions = new Map();
        this.deleted = false;
    }
    
    async edit(content) {
        this.edits.push(content);
        
        if (typeof content === 'string') {
            this.content = content;
        } else {
            Object.assign(this, content);
        }
        
        return this;
    }
    
    async delete() {
        this.deleted = true;
        return this;
    }
    
    async react(emoji) {
        this.reactions.set(emoji, { count: 1 });
        return { emoji };
    }
    
    createMessageComponentCollector(options = {}) {
        return new MockCollector(() => true, options);
    }
}

module.exports = {
    MockInteraction,
    MockCollector,
    MockMessage,
    createMockInteraction,
    waitForReply
};