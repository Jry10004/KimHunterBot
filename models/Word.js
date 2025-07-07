const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
    word: {
        type: String,
        required: true,
        unique: true
    },
    length: {
        type: Number,
        required: true
    },
    firstChar: {
        type: String,
        required: true
    },
    lastChar: {
        type: String,
        required: true
    },
    chosung: {
        type: String
    },
    source: {
        type: String,
        enum: ['local', 'urimal', 'user'],
        default: 'local'
    },
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsed: {
        type: Date
    },
    verifiedAt: {
        type: Date,
        default: Date.now
    },
    category: [{
        type: String
    }],
    difficulty: {
        type: String,
        enum: ['easy', 'normal', 'hard'],
        default: 'normal'
    },
    isHanBang: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// 인덱스 설정
wordSchema.index({ word: 1 });
wordSchema.index({ firstChar: 1 });
wordSchema.index({ lastChar: 1 });
wordSchema.index({ chosung: 1 });
wordSchema.index({ usageCount: -1 });

// 단어 사용 시 카운트 증가
wordSchema.methods.incrementUsage = async function() {
    this.usageCount += 1;
    this.lastUsed = new Date();
    return await this.save();
};

// 초성 추출 함수
wordSchema.statics.extractChosung = function(word) {
    const cho = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    let result = '';
    
    for (let i = 0; i < word.length; i++) {
        const code = word.charCodeAt(i) - 44032;
        if (code > -1 && code < 11172) {
            result += cho[Math.floor(code / 588)];
        }
    }
    
    return result;
};

// 단어 추가 또는 업데이트
wordSchema.statics.addOrUpdate = async function(wordText, source = 'user') {
    try {
        const chosung = this.extractChosung(wordText);
        const wordData = {
            word: wordText,
            length: wordText.length,
            firstChar: wordText[0],
            lastChar: wordText[wordText.length - 1],
            chosung: chosung,
            source: source,
            verifiedAt: new Date()
        };
        
        // 한방단어 체크
        const hanBangChars = ['늄', '듐', '퀸', '슘', '녘', '숍', '늬'];
        if (hanBangChars.includes(wordData.lastChar)) {
            wordData.isHanBang = true;
        }
        
        const existingWord = await this.findOne({ word: wordText });
        if (existingWord) {
            existingWord.usageCount += 1;
            existingWord.lastUsed = new Date();
            if (source !== 'local' && existingWord.source === 'local') {
                existingWord.source = source;
            }
            return await existingWord.save();
        }
        
        return await this.create(wordData);
    } catch (error) {
        console.error('단어 추가/업데이트 오류:', error);
        return null;
    }
};

// 끝말잇기 가능한 단어 찾기
wordSchema.statics.findWordsByStartChar = async function(startChar, excludeWords = []) {
    return await this.find({
        firstChar: startChar,
        word: { $nin: excludeWords }
    })
    .sort({ usageCount: -1 })
    .limit(100)
    .lean();
};

// 초성에 맞는 단어 찾기
wordSchema.statics.findWordsByChosung = async function(chosung) {
    return await this.find({ chosung })
        .sort({ usageCount: -1 })
        .limit(50)
        .lean();
};

// 단어 존재 확인
wordSchema.statics.exists = async function(word) {
    const count = await this.countDocuments({ word });
    return count > 0;
};

module.exports = mongoose.model('Word', wordSchema);