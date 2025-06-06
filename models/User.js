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
    phone: {
        type: String,
        required: false
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