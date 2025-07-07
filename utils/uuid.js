// UUID v4 생성 유틸리티 (crypto 모듈만 사용)
const crypto = require('crypto');

function v4() {
    const bytes = crypto.randomBytes(16);
    
    // UUID v4 형식으로 변환
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
    
    // 하이픈 포함한 문자열로 변환
    const hex = bytes.toString('hex');
    return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
    ].join('-');
}

module.exports = { v4 };