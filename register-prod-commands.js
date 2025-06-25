require('dotenv').config();
const { REST, Routes } = require('discord.js');

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PRODUCTION_GUILD_ID = '1386384507032039558'; // 프로덕션 서버

// index.js에서 명령어 정의 부분을 가져옴
const { SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('핑')
        .setDescription('봇의 응답속도를 확인합니다'),
    
    new SlashCommandBuilder()
        .setName('댕댕봇소환')
        .setDescription('댕댕봇을 이 채널에 소환합니다 (개발자 전용)')
        .setDefaultMemberPermissions(8),
    
    // 필요한 다른 명령어들도 추가...
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🚀 프로덕션 서버에 명령어 등록 시작...');
        console.log(`📍 대상 서버 ID: ${PRODUCTION_GUILD_ID}`);
        
        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, PRODUCTION_GUILD_ID),
            { body: commands.map(cmd => cmd.toJSON()) }
        );
        
        console.log(`✅ ${data.length}개의 명령어가 프로덕션 서버에 등록되었습니다!`);
        console.log('📋 등록된 명령어:', data.map(cmd => cmd.name).join(', '));
        
    } catch (error) {
        console.error('❌ 명령어 등록 실패:', error);
        
        if (error.code === 50001) {
            console.log('\n⚠️  봇이 프로덕션 서버에 없거나 권한이 부족합니다.');
            console.log('1. 봇이 프로덕션 서버의 멤버인지 확인하세요');
            console.log('2. 봇이 application.commands 권한을 가지고 있는지 확인하세요');
        }
    }
})();