// 간소화된 사용자 기본 정보 모델
const mongoose = require('mongoose');

const userSimplifiedSchema = new mongoose.Schema({
    // Discord 정보
    discordId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // 기본 정보
    nickname: {
        type: String,
        required: false,
        maxLength: 12
    },
    gender: {
        type: String,
        required: false,
        enum: ['남', '여']
    },
    
    // 계정 정보
    email: {
        type: String,
        required: false,
        sparse: true
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
    
    // 보안 정보
    registrationIP: {
        type: String,
        default: null
    },
    lastLoginIP: {
        type: String,
        default: null
    },
    ipHistory: [{
        ip: String,
        timestamp: { type: Date, default: Date.now },
        action: String // 'register', 'login', 'verify' 등
    }],
    
    // 게임 기본 정보
    level: {
        type: Number,
        default: 1,
        min: 1,
        max: 100
    },
    exp: {
        type: Number,
        default: 0,
        min: 0
    },
    gold: {
        type: Number,
        default: 1000,
        min: 0
    },
    
    // 엠블럼 시스템
    emblem: {
        type: { type: String, default: null },
        tier: { type: Number, default: 0 },
        obtainedAt: { type: Date, default: null }
    },
    
    // 계정 상태
    accountStatus: {
        type: String,
        enum: ['active', 'suspended', 'banned', 'inactive'],
        default: 'active'
    },
    suspensionReason: { type: String, default: null },
    suspensionExpires: { type: Date, default: null },
    
    // 추천인
    referral: {
        type: String,
        required: false
    },
    referredUsers: [{
        discordId: String,
        joinedAt: { type: Date, default: Date.now }
    }],
    
    // 마지막 활동
    lastDaily: {
        type: String,
        default: null
    },
    lastWork: {
        type: Number,
        default: 0
    },
    lastActiveDate: {
        type: Date,
        default: Date.now
    },
    
    // 출석 시스템
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
    
    // 설정
    settings: {
        notifications: { type: Boolean, default: true },
        dmNotifications: { type: Boolean, default: true },
        language: { type: String, default: 'ko' },
        timezone: { type: String, default: 'Asia/Seoul' }
    },
    
    // 프리미엄/VIP 상태
    premium: {
        isPremium: { type: Boolean, default: false },
        expiresAt: { type: Date, default: null },
        tier: { type: String, enum: ['bronze', 'silver', 'gold', 'diamond'], default: null }
    }
}, {
    timestamps: true
});

// 인덱스 설정
userSimplifiedSchema.index({ nickname: 1 });
userSimplifiedSchema.index({ level: -1 });
userSimplifiedSchema.index({ 'accountStatus': 1 });
userSimplifiedSchema.index({ 'lastActiveDate': -1 });
userSimplifiedSchema.index({ createdAt: -1 });

// 가상 필드: 전투력 계산
userSimplifiedSchema.virtual('combatPower').get(function() {
    const basePower = this.level * 100;
    const emblemBonus = this.emblem.tier * 50;
    return basePower + emblemBonus;
});

// 메서드: 경험치 추가 및 레벨업
userSimplifiedSchema.methods.addExp = function(amount) {
    this.exp += amount;
    
    // 레벨업 체크
    let leveledUp = false;
    while (this.exp >= this.getExpRequired()) {
        this.exp -= this.getExpRequired();
        this.level++;
        leveledUp = true;
    }
    
    return { leveledUp, newLevel: this.level, currentExp: this.exp };
};

// 메서드: 필요 경험치 계산
userSimplifiedSchema.methods.getExpRequired = function() {
    return this.level * 100 + (this.level - 1) * 50;
};

// 메서드: 출석 체크
userSimplifiedSchema.methods.checkAttendance = function() {
    const today = new Date();
    const lastDaily = this.lastDaily ? new Date(this.lastDaily) : null;
    
    if (!lastDaily || 
        today.getDate() !== lastDaily.getDate() || 
        today.getMonth() !== lastDaily.getMonth() || 
        today.getFullYear() !== lastDaily.getFullYear()) {
        
        // 연속 출석 체크
        if (lastDaily) {
            const diffTime = Math.abs(today - lastDaily);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                this.attendanceStreak++;
            } else {
                this.attendanceStreak = 1;
            }
        } else {
            this.attendanceStreak = 1;
        }
        
        this.lastDaily = today.toISOString().split('T')[0];
        
        // 주간 출석 업데이트
        const dayOfWeek = today.getDay();
        this.weeklyAttendance[dayOfWeek] = true;
        
        return true;
    }
    
    return false;
};

// 메서드: 계정 정지
userSimplifiedSchema.methods.suspend = function(reason, duration) {
    this.accountStatus = 'suspended';
    this.suspensionReason = reason;
    this.suspensionExpires = new Date(Date.now() + duration);
    return this.save();
};

// 메서드: 정지 해제 체크
userSimplifiedSchema.methods.checkSuspension = function() {
    if (this.accountStatus === 'suspended' && this.suspensionExpires) {
        if (new Date() > this.suspensionExpires) {
            this.accountStatus = 'active';
            this.suspensionReason = null;
            this.suspensionExpires = null;
            return this.save();
        }
    }
    return Promise.resolve(this);
};

module.exports = mongoose.model('UserSimplified', userSimplifiedSchema);