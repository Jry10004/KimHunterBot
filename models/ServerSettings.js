const mongoose = require('mongoose');

const serverSettingsSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    newsChannelId: {
        type: String,
        default: null
    },
    bossChannelId: {
        type: String,
        default: null
    },
    announcementChannelId: {
        type: String,
        default: null
    },
    registrationChannelId: {
        type: String,
        default: null
    },
    emblemChannelId: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// 업데이트 시 updatedAt 자동 갱신
serverSettingsSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('ServerSettings', serverSettingsSchema);