const mongoose = require('mongoose');

const ipBanSchema = new mongoose.Schema({
    ip: {
        type: String,
        required: true,
        unique: true
    },
    reason: {
        type: String,
        default: '규정 위반'
    },
    bannedBy: {
        type: String, // Discord ID of admin
        required: true
    },
    bannedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: null // null이면 영구 차단
    },
    active: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('IPBan', ipBanSchema);