require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// 봇 설정
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 봇 토큰 (환경변수에서 가져오거나 직접 입력)
const TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const CLIENT_ID = process.env.CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
const DEV_CHANNEL_ID = process.env.DEV_CHANNEL_ID;
const DEV_MODE = process.env.DEV_MODE === 'true';

// 간단한 메모리 저장소 (나중에 데이터베이스로 교체)
const users = new Map();

// 유저 초기화 함수
function initUser(userId) {
    if (!users.has(userId)) {
        users.set(userId, {
            id: userId,
            gold: 1000,
            level: 1,
            exp: 0,
            lastDaily: null,
            lastWork: 0
        });
    }
    return users.get(userId);
}

// 슬래시 명령어 정의
const commands = [
    new SlashCommandBuilder()
        .setName('게임')
        .setDescription('🎮 강화왕 김헌터 게임 메뉴'),
    
    new SlashCommandBuilder()
        .setName('핑')
        .setDescription('봇의 응답 속도를 확인합니다'),
    
    new SlashCommandBuilder()
        .setName('회원가입')
        .setDescription('🎮 강화왕 김헌터 회원가입')
];

// 봇이 준비되었을 때
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} 봇이 온라인 상태입니다!`);
    console.log(`📌 개발 모드: ${DEV_MODE ? '활성화' : '비활성화'}`);
    if (DEV_MODE && DEV_CHANNEL_ID) {
        console.log(`📌 개발 채널: ${DEV_CHANNEL_ID}`);
    }
    
    // 슬래시 명령어 등록
    try {
        const rest = new REST().setToken(TOKEN);
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('✅ 슬래시 명령어가 등록되었습니다!');
    } catch (error) {
        console.error('❌ 명령어 등록 실패:', error);
    }
});

// 슬래시 명령어 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    console.log(`명령어 실행 - 채널: ${interaction.channelId}, 개발 채널: ${DEV_CHANNEL_ID}, 개발 모드: ${DEV_MODE}`);
    
    // 개발 모드에서 채널 제한
    if (DEV_MODE && DEV_CHANNEL_ID && interaction.channelId !== DEV_CHANNEL_ID) {
        console.log(`채널 불일치 - 현재: ${interaction.channelId}, 개발: ${DEV_CHANNEL_ID}`);
        console.log(`타입 확인 - 현재 채널 타입: ${typeof interaction.channelId}, 개발 채널 타입: ${typeof DEV_CHANNEL_ID}`);
        await interaction.reply({ content: '⚠️ 개발 모드에서는 지정된 채널에서만 사용 가능합니다!', ephemeral: true });
        return;
    }

    const { commandName } = interaction;

    try {
        if (commandName === '핑') {
            const ping = Date.now() - interaction.createdTimestamp;
            await interaction.reply(`🏓 퐁! 지연시간: ${ping}ms`);
        }
        
        else if (commandName === '게임') {
            const user = initUser(interaction.user.id);
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎮 강화왕 김헌터')
                .setDescription(`안녕하세요, **${interaction.user.username}**님!`)
                .addFields(
                    { name: '💰 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                    { name: '📊 레벨', value: `Lv.${user.level}`, inline: true },
                    { name: '✨ 경험치', value: `${user.exp} EXP`, inline: true }
                )
                .setFooter({ text: '게임 메뉴를 선택하세요!' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('daily')
                        .setLabel('일일보상')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🎁'),
                    new ButtonBuilder()
                        .setCustomId('work')
                        .setLabel('일하기')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💼'),
                    new ButtonBuilder()
                        .setCustomId('info')
                        .setLabel('내정보')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('👤')
                );

            await interaction.reply({ embeds: [embed], components: [row] });
        }
        
        else if (commandName === '회원가입') {
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🎮 강화왕 김헌터 회원가입')
                .setDescription('환영합니다! 강화왕 김헌터의 세계로 오신 것을 환영합니다.')
                .setImage('https://cdn.discordapp.com/attachments/1371885860143890564/1380581431562076190/newuser.png')
                .addFields(
                    { name: '📧 이메일', value: 'support@kimhunter.com', inline: true },
                    { name: '👤 디스코드', value: '김헌터#0001', inline: true },
                    { name: '🎫 티켓', value: '문의사항은 티켓으로', inline: true }
                )
                .setFooter({ text: '아래 버튼을 눌러 회원가입을 진행하세요!' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('register')
                        .setLabel('회원가입')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝')
                );

            await interaction.reply({ embeds: [embed], components: [row] });
        }
    } catch (error) {
        console.error('명령어 처리 오류:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: '❌ 오류가 발생했습니다!', ephemeral: true });
        }
    }
});

// 버튼 클릭 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // 개발 모드에서 채널 제한
    if (DEV_MODE && DEV_CHANNEL_ID && interaction.channelId !== DEV_CHANNEL_ID) {
        console.log(`채널 불일치 - 현재: ${interaction.channelId}, 개발: ${DEV_CHANNEL_ID}`);
        await interaction.reply({ content: '⚠️ 개발 모드에서는 지정된 채널에서만 사용 가능합니다!', ephemeral: true });
        return;
    }

    const user = initUser(interaction.user.id);
    const now = Date.now();

    try {
        if (interaction.customId === 'daily') {
            const today = new Date().toDateString();
            
            if (user.lastDaily === today) {
                await interaction.reply({ content: '❌ 오늘은 이미 일일보상을 받았습니다!', ephemeral: true });
                return;
            }

            const goldReward = Math.floor(Math.random() * 500) + 500; // 500-1000골드
            const expReward = Math.floor(Math.random() * 100) + 50;   // 50-150경험치
            
            user.gold += goldReward;
            user.exp += expReward;
            user.lastDaily = today;

            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🎁 일일보상 획득!')
                .setDescription(`오늘의 보상을 받았습니다!`)
                .addFields(
                    { name: '💰 골드', value: `+${goldReward.toLocaleString()}G`, inline: true },
                    { name: '✨ 경험치', value: `+${expReward} EXP`, inline: true },
                    { name: '💳 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (interaction.customId === 'work') {
            const cooldown = 30 * 60 * 1000; // 30분 쿨타임
            
            if (now - user.lastWork < cooldown) {
                const remaining = Math.ceil((cooldown - (now - user.lastWork)) / 60000);
                await interaction.reply({ content: `❌ 쿨타임 ${remaining}분 남았습니다!`, ephemeral: true });
                return;
            }

            const goldReward = Math.floor(Math.random() * 300) + 200; // 200-500골드
            user.gold += goldReward;
            user.lastWork = now;

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('💼 일하기 완료!')
                .setDescription(`열심히 일해서 골드를 벌었습니다!`)
                .addFields(
                    { name: '💰 획득 골드', value: `+${goldReward.toLocaleString()}G`, inline: true },
                    { name: '💳 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (interaction.customId === 'info') {
            const embed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('👤 내 정보')
                .setDescription(`**${interaction.user.username}**님의 게임 정보`)
                .addFields(
                    { name: '💰 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                    { name: '📊 레벨', value: `Lv.${user.level}`, inline: true },
                    { name: '✨ 경험치', value: `${user.exp} EXP`, inline: true },
                    { name: '🎁 일일보상', value: user.lastDaily === new Date().toDateString() ? '✅ 완료' : '❌ 미완료', inline: true },
                    { name: '💼 일하기', value: now - user.lastWork < 30 * 60 * 1000 ? '⏰ 쿨타임' : '✅ 가능', inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (interaction.customId === 'register') {
            const modal = new ModalBuilder()
                .setCustomId('registerModal')
                .setTitle('강화왕 김헌터 회원가입');

            const phoneRow = new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId('phone')
                        .setLabel('핸드폰 번호 (본인인증용)')
                        .setPlaceholder('010-1234-5678')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(13)
                );

            const nicknameRow = new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId('nickname')
                        .setLabel('게임 닉네임')
                        .setPlaceholder('사용하실 닉네임을 입력해주세요')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(2)
                        .setMaxLength(12)
                );

            const emailRow = new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId('email')
                        .setLabel('이메일')
                        .setPlaceholder('example@email.com')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                );

            const genderRow = new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId('gender')
                        .setLabel('성별 (남/여)')
                        .setPlaceholder('남 또는 여')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(1)
                );

            const referralRow = new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId('referral')
                        .setLabel('추천인 코드 (선택사항)')
                        .setPlaceholder('추천인 코드가 있다면 입력하세요')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                );

            modal.addComponents(phoneRow, nicknameRow, emailRow, genderRow, referralRow);
            await interaction.showModal(modal);
        }
    } catch (error) {
        console.error('버튼 처리 오류:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: '❌ 오류가 발생했습니다!', ephemeral: true });
        }
    }
});

// Modal 제출 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    if (interaction.customId === 'registerModal') {
        const phone = interaction.fields.getTextInputValue('phone');
        const nickname = interaction.fields.getTextInputValue('nickname');
        const email = interaction.fields.getTextInputValue('email');
        const gender = interaction.fields.getTextInputValue('gender');
        const referral = interaction.fields.getTextInputValue('referral');
        
        // 여기에 실제 회원가입 로직 추가
        // 닉네임 중복 체크, 데이터 저장 등
        
        const successEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ 회원가입 완료!')
            .setDescription(`**${nickname}**님, 강화왕 김헌터에 오신 것을 환영합니다!`)
            .addFields(
                { name: '🎁 가입 보상', value: '골드 1,000G\n경험치 부스터 x1\n초보자 무기 x1', inline: false }
            )
            .setFooter({ text: '이제 /게임 명령어로 게임을 시작하세요!' });
            
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    }
});

// 봇 로그인
client.login(TOKEN);