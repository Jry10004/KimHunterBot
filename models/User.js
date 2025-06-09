const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    nickname: {
        type: String,
        required: false,
        maxLength: 12
    },
    email: {
        type: String,
        required: false
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationCode: {
        type: String,
        default: null
    },
    emailVerificationExpires: {
        type: Date,
        default: null
    },
    gender: {
        type: String,
        required: false,
        enum: ['남', '여']
    },
    referral: {
        type: String,
        required: false
    },
    gold: {
        type: Number,
        default: 1000
    },
    level: {
        type: Number,
        default: 1
    },
    exp: {
        type: Number,
        default: 0
    },
    lastDaily: {
        type: String,
        default: null
    },
    lastWork: {
        type: Number,
        default: 0
    },
    attendanceStreak: {
        type: Number,
        default: 0
    },
    weeklyAttendance: {
        type: [Boolean],
        default: [false, false, false, false, false, false, false]
    },
    weekStart: {
        type: Date,
        default: null
    },
    unlockedAreas: {
        type: [Number],
        default: [1] // 1번 지역(꽃잎 마을)부터 시작
    },
    lastHunt: {
        type: Number,
        default: 0
    },
    huntingArea: {
        type: Number,
        default: 0
    },
    registered: {
        type: Boolean,
        default: false
    },
    registeredAt: {
        type: Date,
        default: null
    },
    popularity: {
        type: Number,
        default: 0
    },
    dailyPopularityGain: {
        type: Number,
        default: 0
    },
    dailyPopularityLoss: {
        type: Number,
        default: 0
    },
    lastPopularityReset: {
        type: String,
        default: null
    },
    lastPopularityUpdate: {
        type: Date,
        default: null
    },
    popularityHistory: [{
        messageId: String,
        emoji: String,
        value: Number,
        date: {
            type: Date,
            default: Date.now
        }
    }],
    stats: {
        strength: { type: Number, default: 10 },
        agility: { type: Number, default: 10 },
        intelligence: { type: Number, default: 10 },
        vitality: { type: Number, default: 10 },
        luck: { type: Number, default: 10 }
    },
    statPoints: {
        type: Number,
        default: 0
    },
    skills: [{
        id: String,
        name: String,
        level: { type: Number, default: 1 },
        exp: { type: Number, default: 0 }
    }],
    inventory: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, required: true },
        rarity: { type: String, required: true },
        setName: { type: String, required: true },
        level: { type: Number, default: 1 }, // 아이템 착용 가능 레벨
        quantity: { type: Number, default: 1 },
        enhanceLevel: { type: Number, default: 0 }, // 강화 단계 (0~30성)
        stats: {
            attack: { type: Number, default: 0 },
            defense: { type: Number, default: 0 },
            dodge: { type: Number, default: 0 },
            luck: { type: Number, default: 0 }
        },
        price: { type: Number, default: 0 },
        description: { type: String, default: '' }
    }],
    equipment: {
        weapon: { type: Object, default: null },
        armor: { type: Object, default: null },
        helmet: { type: Object, default: null },
        gloves: { type: Object, default: null },
        boots: { type: Object, default: null },
        accessory: { type: Object, default: null }
    },
    enhancementLevel: {
        type: Number,
        default: 0
    },
    // 강화 통계
    enhanceStats: {
        totalAttempts: { type: Number, default: 0 }, // 총 강화 시도 횟수
        totalCost: { type: Number, default: 0 }, // 총 사용 골드
        destroyCount: { type: Number, default: 0 }, // 파괴 횟수
        successCount: { type: Number, default: 0 }, // 성공 횟수
        maxEnhanceLevel: { type: Number, default: 0 } // 최고 강화 단계
    },
    // 엠블럼 시스템
    emblem: {
        type: String,
        default: null // null이면 엠블럼 없음, 문자열이면 엠블럼 이름
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);