// 디버그: 뉴스 채널 권한 확인
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

const HARDCODED_CHANNEL_ID = '1389401523418693723';

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} 로그인 완료`);
    
    try {
        // 1. 채널 가져오기 시도
        console.log(`\n📌 하드코딩된 채널 ID: ${HARDCODED_CHANNEL_ID}`);
        
        let channel;
        try {
            channel = await client.channels.fetch(HARDCODED_CHANNEL_ID);
            console.log('✅ 채널 가져오기 성공');
        } catch (error) {
            console.error('❌ 채널 가져오기 실패:', error.message);
            process.exit(1);
        }
        
        // 2. 채널 정보 확인
        console.log('\n📰 채널 정보:');
        console.log(`- 이름: ${channel.name}`);
        console.log(`- 타입: ${channel.type}`);
        console.log(`- 서버: ${channel.guild.name}`);
        console.log(`- 서버 ID: ${channel.guild.id}`);
        
        // 3. 봇의 권한 확인
        const botMember = channel.guild.members.cache.get(client.user.id);
        const permissions = channel.permissionsFor(botMember);
        
        console.log('\n🔐 봇의 권한:');
        const requiredPerms = [
            'ViewChannel',
            'SendMessages',
            'EmbedLinks',
            'AttachFiles',
            'ReadMessageHistory',
            'UseExternalEmojis'
        ];
        
        requiredPerms.forEach(perm => {
            const hasPermission = permissions.has(PermissionsBitField.Flags[perm]);
            console.log(`- ${perm}: ${hasPermission ? '✅' : '❌'}`);
        });
        
        // 4. 테스트 메시지 전송
        if (permissions.has(PermissionsBitField.Flags.SendMessages)) {
            console.log('\n📤 테스트 메시지 전송 시도...');
            try {
                await channel.send('🧪 뉴스 시스템 채널 권한 테스트');
                console.log('✅ 메시지 전송 성공!');
                
                // 임베드 테스트
                const { EmbedBuilder } = require('discord.js');
                const testEmbed = new EmbedBuilder()
                    .setTitle('📰 테스트 뉴스')
                    .setDescription('이것은 뉴스 시스템 테스트입니다.')
                    .setColor('#0099ff');
                    
                await channel.send({ embeds: [testEmbed] });
                console.log('✅ 임베드 전송 성공!');
            } catch (error) {
                console.error('❌ 메시지 전송 실패:', error.message);
            }
        } else {
            console.log('❌ 메시지 전송 권한이 없습니다!');
        }
        
        // 5. 뉴스 시스템 상태 확인
        console.log('\n📊 뉴스 시스템 상태:');
        const newsSystem = require('../systems/newsSystem');
        console.log(`- 초기화 상태: ${newsSystem.isInitialized}`);
        console.log(`- 뉴스 채널 수: ${newsSystem.newsChannels.size}`);
        console.log(`- 채널 목록: ${Array.from(newsSystem.newsChannels).join(', ')}`);
        
        // 6. 활성 유저 확인
        const mongoose = require('mongoose');
        await mongoose.connect(process.env.MONGODB_URI);
        
        const User = require('../models/User');
        const activeUsers = await User.find({
            lastActive: { $gte: new Date(Date.now() - 3 * 60 * 60 * 1000) },
            registered: true
        }).limit(5);
        
        console.log(`\n👥 활성 유저: ${activeUsers.length}명`);
        activeUsers.forEach(user => {
            console.log(`- ${user.nickname || user.discordId}`);
        });
        
    } catch (error) {
        console.error('테스트 중 오류:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
});

client.login(process.env.DISCORD_TOKEN);