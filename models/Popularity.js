const mongoose = require('mongoose');

const popularitySchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    nickname: { 
        type: String, 
        required: true 
    },
    
    // 인기도 점수
    totalLikes: { 
        type: Number, 
        default: 0 
    },
    weeklyLikes: { 
        type: Number, 
        default: 0 
    },
    
    // 좋아요 기록
    givenLikes: [{
        targetUserId: String,
        date: Date
    }],
    receivedLikes: [{
        fromUserId: String,
        date: Date
    }],
    
    // 일일 좋아요 제한
    dailyGiven: {
        date: String, // YYYY-MM-DD 형식
        users: [String] // 오늘 좋아요를 준 유저 ID 목록
    },
    
    // 칭호 관련
    hasTitle: { 
        type: Boolean, 
        default: false 
    },
    titleHistory: [{
        startDate: Date,
        endDate: Date,
        rank: Number
    }],
    
    // 통계
    statistics: {
        peakWeeklyLikes: { type: Number, default: 0 },
        totalWeeksAsChampion: { type: Number, default: 0 },
        lastWeekRank: { type: Number, default: null }
    }
}, {
    timestamps: true
});

// 복합 인덱스
popularitySchema.index({ weeklyLikes: -1, totalLikes: -1 });

// 자동 인덱스 생성 비활성화
popularitySchema.set('autoIndex', false);

module.exports = mongoose.model('Popularity', popularitySchema);