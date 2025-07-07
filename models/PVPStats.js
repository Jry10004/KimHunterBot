const mongoose = require('mongoose');

const pvpStatsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    rating: {
        type: Number,
        default: 1000
    },
    wins: {
        type: Number,
        default: 0
    },
    losses: {
        type: Number,
        default: 0
    },
    draws: {
        type: Number,
        default: 0
    },
    streak: {
        type: Number,
        default: 0
    },
    bestStreak: {
        type: Number,
        default: 0
    },
    matchHistory: [{
        opponentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        result: {
            type: String,
            enum: ['win', 'loss', 'draw']
        },
        ratingChange: Number,
        date: {
            type: Date,
            default: Date.now
        },
        goldChange: Number
    }],
    lastMatchDate: Date,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// 인덱스
pvpStatsSchema.index({ rating: -1 });
pvpStatsSchema.index({ wins: -1 });

// 업데이트 시 updatedAt 자동 갱신
pvpStatsSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('PVPStats', pvpStatsSchema);