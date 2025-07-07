// 테스트 환경 설정
require('dotenv').config({ path: '.env.test' });

// 테스트용 MongoDB 메모리 서버
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// 테스트 시작 전
beforeAll(async () => {
    // MongoDB 메모리 서버 시작
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
});

// 각 테스트 후 데이터 정리
afterEach(async () => {
    const collections = mongoose.connection.collections;
    
    for (let key in collections) {
        const collection = collections[key];
        await collection.deleteMany();
    }
});

// 테스트 종료 후
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// 테스트 헬퍼 함수들
global.createTestUser = async (overrides = {}) => {
    const User = require('../models/User');
    
    const defaultUser = {
        discordId: '123456789012345678',
        username: 'testuser',
        nickname: '테스트유저',
        email: 'test@example.com',
        registered: true,
        level: 1,
        gold: 1000,
        exp: 0,
        ...overrides
    };
    
    return await User.create(defaultUser);
};

global.createTestStock = async (overrides = {}) => {
    const Stock = require('../models/Stock');
    
    const defaultStock = {
        symbol: 'TEST',
        name: '테스트 주식',
        price: 1000,
        change: 0,
        volume: 0,
        marketCap: 1000000,
        ...overrides
    };
    
    return await Stock.create(defaultStock);
};

// 테스트 타임아웃 설정
jest.setTimeout(10000);

// Discord.js 모킹
jest.mock('discord.js', () => ({
    Client: jest.fn().mockImplementation(() => ({
        login: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        user: { id: 'bot123', tag: 'TestBot#0001' },
        channels: {
            cache: new Map(),
            fetch: jest.fn()
        },
        users: {
            cache: new Map(),
            fetch: jest.fn()
        },
        guilds: {
            cache: new Map()
        }
    })),
    GatewayIntentBits: {
        Guilds: 1,
        GuildMessages: 2,
        MessageContent: 3
    },
    EmbedBuilder: jest.fn().mockImplementation(() => ({
        setTitle: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis()
    })),
    ActionRowBuilder: jest.fn(),
    ButtonBuilder: jest.fn(),
    ButtonStyle: {},
    StringSelectMenuBuilder: jest.fn()
}));