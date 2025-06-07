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
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);