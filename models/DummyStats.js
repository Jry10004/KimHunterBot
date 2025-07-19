const mongoose = require('mongoose');

const dummyStatsSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        required: true
    },
    jobType: {
        type: String,
        required: true,
        index: true
    },
    emblem: {
        type: String,
        required: true
    },
    combatPower: {
        type: Number,
        default: 0
    },
    // 통계 데이터
    totalDamage: {
        type: Number,
        default: 0
    },
    attackCount: {
        type: Number,
        default: 0
    },
    critCount: {
        type: Number,
        default: 0
    },
    maxDamage: {
        type: Number,
        default: 0
    },
    minDamage: {
        type: Number,
        default: Infinity
    },
    avgDamage: {
        type: Number,
        default: 0
    },
    dps: {
        type: Number,
        default: 0
    },
    critRate: {
        type: Number,
        default: 0
    },
    // 세션 데이터
    lastSessionStart: {
        type: Date,
        default: Date.now
    },
    totalSessionTime: {
        type: Number,
        default: 0
    },
    // 타임스탬프
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// 인덱스 생성
dummyStatsSchema.index({ jobType: 1, avgDamage: -1 });
dummyStatsSchema.index({ combatPower: -1 });
dummyStatsSchema.index({ avgDamage: -1 });

// 평균 데미지 계산 메소드
dummyStatsSchema.methods.calculateAvgDamage = function() {
    if (this.attackCount > 0) {
        this.avgDamage = Math.floor(this.totalDamage / this.attackCount);
        this.critRate = (this.critCount / this.attackCount) * 100;
    }
    return this.avgDamage;
};

// 업데이트 시 타임스탬프 갱신
dummyStatsSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    this.calculateAvgDamage();
    next();
});

module.exports = mongoose.model('DummyStats', dummyStatsSchema);