const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './.env.production' });

const commands = [];
const commandsPath = path.join(__dirname, '../index.js');

// Production bot credentials
const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
    console.error('❌ Missing BOT_TOKEN or CLIENT_ID in .env.production');
    process.exit(1);
}

// Load commands from index.js (you'll need to export commands from there)
// For now, we'll register basic commands
const productionCommands = [
    {
        name: '가입',
        description: '김헌터 게임에 가입합니다',
        type: 1,
    },
    {
        name: '정보',
        description: '내 캐릭터 정보를 확인합니다',
        type: 1,
    },
    {
        name: '사냥',
        description: '사냥을 시작합니다',
        type: 1,
    },
    {
        name: '상점',
        description: '상점을 엽니다',
        type: 1,
    },
    {
        name: '인벤토리',
        description: '인벤토리를 확인합니다',
        type: 1,
    },
    {
        name: '장착',
        description: '아이템을 장착합니다',
        type: 1,
        options: [
            {
                name: '아이템명',
                description: '장착할 아이템의 이름',
                type: 3,
                required: true,
            },
        ],
    },
    {
        name: '룰렛',
        description: '룰렛 게임을 시작합니다',
        type: 1,
    },
    {
        name: '홀짝',
        description: '홀짝 게임을 시작합니다',
        type: 1,
    },
    {
        name: '독버섯',
        description: '독버섯 찾기 게임을 시작합니다',
        type: 1,
    },
    {
        name: '운동',
        description: '운동을 시작합니다',
        type: 1,
    },
    {
        name: '주식',
        description: '주식 시장을 확인합니다',
        type: 1,
    },
    {
        name: '퀘스트',
        description: '퀘스트 목록을 확인합니다',
        type: 1,
    },
    {
        name: '일일보상',
        description: '일일 보상을 받습니다',
        type: 1,
    },
    {
        name: '랭킹',
        description: '전체 랭킹을 확인합니다',
        type: 1,
    },
    {
        name: '도움말',
        description: '게임 도움말을 확인합니다',
        type: 1,
    },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`🚀 Production bot (${clientId}) 슬래시 커맨드 등록 시작...`);
        console.log(`📝 총 ${productionCommands.length}개의 커맨드를 등록합니다.`);

        // Register commands globally for production
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: productionCommands },
        );

        console.log(`✅ 성공적으로 ${data.length}개의 프로덕션 커맨드를 등록했습니다!`);
        console.log('📌 글로벌 커맨드는 모든 서버에서 사용 가능합니다.');
        console.log('⏰ 글로벌 커맨드는 최대 1시간까지 반영이 지연될 수 있습니다.');
    } catch (error) {
        console.error('❌ 커맨드 등록 중 오류 발생:', error);
        process.exit(1);
    }
})();