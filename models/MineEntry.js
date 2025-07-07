const mongoose = require('mongoose');

// 광산 입장 기록 스키마
const mineEntrySchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    mineId: {
        type: String,
        required: true,
        index: true
    },
    sessionId: {
        type: Number,  // 광산이 열린 시간 (timestamp)
        required: true,
        index: true
    },
    enteredAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// 복합 인덱스 - 유저가 특정 세션에 입장했는지 빠르게 확인
mineEntrySchema.index({ userId: 1, mineId: 1, sessionId: 1 }, { unique: true });

// 오래된 기록 자동 삭제를 위한 TTL 인덱스 (30일 후 삭제)
mineEntrySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const MineEntry = mongoose.model('MineEntry', mineEntrySchema);

module.exports = MineEntry;