// 프로페셔널 공지 시스템
const NOTICE_SYSTEM = {
    templates: {
        basic: {
            name: '기본 공지',
            icon: '📢',
            fields: ['title', 'category', 'priority', 'content', 'tags'],
            style: 'simple'
        },
        maintenance: {
            name: '점검 공지',
            icon: '🔧',
            fields: ['title', 'category', 'priority', 'startTime', 'endTime', 'content', 'compensation', 'tags'],
            style: 'urgent'
        },
        event: {
            name: '이벤트 공지',
            icon: '🎉',
            fields: ['title', 'category', 'priority', 'eventPeriod', 'content', 'rewards', 'howToJoin', 'tags'],
            style: 'festive'
        },
        update: {
            name: '업데이트 공지',
            icon: '📋',
            fields: ['title', 'category', 'priority', 'version', 'content', 'changes', 'fixes', 'tags'],
            style: 'technical'
        }
    },
    categories: {
        notice: { name: '공지', emoji: '📌', color: '#0099ff' },
        maintenance: { name: '점검', emoji: '🔧', color: '#ff9900' },
        event: { name: '이벤트', emoji: '🎉', color: '#00ff00' },
        update: { name: '업데이트', emoji: '📋', color: '#9900ff' },
        important: { name: '중요', emoji: '⚠️', color: '#ff0000' }
    },
    priorities: {
        low: { name: '일반', emoji: '🔵', color: '#0099ff' },
        medium: { name: '중요', emoji: '🟡', color: '#ffcc00' },
        high: { name: '긴급', emoji: '🔴', color: '#ff0000' },
        critical: { name: '필독', emoji: '🚨', color: '#ff0000', blink: true }
    },
    savedNotices: new Map(), // 공지 저장소
    
    // 공지 저장
    saveNotice(noticeData) {
        const id = Date.now().toString();
        this.savedNotices.set(id, {
            id,
            ...noticeData,
            createdAt: new Date()
        });
        return id;
    },
    
    // 공지 가져오기
    getNotice(id) {
        return this.savedNotices.get(id);
    },
    
    // 모든 공지 가져오기
    getAllNotices() {
        return Array.from(this.savedNotices.values());
    },
    
    // 공지 삭제
    deleteNotice(id) {
        return this.savedNotices.delete(id);
    }
};

module.exports = NOTICE_SYSTEM;