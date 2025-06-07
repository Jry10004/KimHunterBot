require('dotenv').config();
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const connectDB = require('./database/connection');
const User = require('./models/User');
const { generateVerificationCode, sendVerificationEmail } = require('./services/emailService');
const huntingAreas = require('./data/huntingAreas');

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
const GAME_CHANNEL_ID = process.env.GAME_CHANNEL_ID;
const DEV_MODE = process.env.DEV_MODE === 'true';

// 유저 초기화/조회 함수
async function getUser(discordId) {
    try {
        let user = await User.findOne({ discordId });
        if (!user) {
            user = new User({ discordId });
            await user.save();
            console.log(`새 유저 생성: ${discordId}`);
        }
        return user;
    } catch (error) {
        console.error('유저 조회/생성 오류:', error);
        return null;
    }
}

// 레벨업 처리 함수
function processLevelUp(user) {
    let leveledUp = false;
    let levelsGained = 0;
    const oldLevel = user.level;
    
    while (user.exp >= user.level * 100) {
        user.exp -= user.level * 100;
        user.level += 1;
        levelsGained += 1;
        leveledUp = true;

        // 새로운 사냥터 해금 체크
        const newUnlockArea = huntingAreas.find(area => 
            area.unlockLevel === user.level && !user.unlockedAreas.includes(area.id)
        );
        if (newUnlockArea) {
            user.unlockedAreas.push(newUnlockArea.id);
        }
    }
    
    return { leveledUp, levelsGained, oldLevel };
}

// 슬래시 명령어 정의
const commands = [
    new SlashCommandBuilder()
        .setName('게임')
        .setDescription('강화왕 김헌터 게임 메뉴'),
    
    new SlashCommandBuilder()
        .setName('핑')
        .setDescription('봇의 응답 속도를 확인합니다'),
    
    new SlashCommandBuilder()
        .setName('회원가입')
        .setDescription('강화왕 김헌터 회원가입'),
    
    new SlashCommandBuilder()
        .setName('db테스트')
        .setDescription('데이터베이스 연결 테스트'),
    
    new SlashCommandBuilder()
        .setName('이메일테스트')
        .setDescription('이메일 전송 테스트'),
    
    new SlashCommandBuilder()
        .setName('회원가입채널설정')
        .setDescription('회원가입 채널에 안내 메시지를 게시합니다')
];

// 봇이 준비되었을 때
client.once('ready', async () => {
    console.log(`${client.user.tag} 봇이 온라인 상태입니다! - 자동 재시작 테스트`);
    console.log(`개발 모드: ${DEV_MODE ? '활성화' : '비활성화'}`);
    if (DEV_MODE && DEV_CHANNEL_ID) {
        console.log(`개발 채널: ${DEV_CHANNEL_ID}`);
    }
    
    // MongoDB 연결
    await connectDB();
    
    // 슬래시 명령어 등록
    try {
        const rest = new REST().setToken(TOKEN);
        console.log('슬래시 명령어 등록 중...');
        
        // 개발 모드에서는 길드(서버) 명령어 사용 (즉시 적용)
        const guildId = DEV_MODE ? '1371885859649097849' : null; // 개발 서버 ID
        
        const data = await rest.put(
            guildId ? Routes.applicationGuildCommands(CLIENT_ID, guildId) : Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        
        console.log(`슬래시 명령어 ${data.length}개가 등록되었습니다!`);
        console.log('등록된 명령어:', data.map(cmd => cmd.name).join(', '));
    } catch (error) {
        console.error('명령어 등록 실패:', error);
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
        await interaction.reply({ content: '개발 모드에서는 지정된 채널에서만 사용 가능합니다!', ephemeral: true });
        return;
    }

    const { commandName } = interaction;

    try {
        if (commandName === '핑') {
            const ping = Date.now() - interaction.createdTimestamp;
            await interaction.reply(`퐁! 지연시간: ${ping}ms`);
        }
        
        else if (commandName === '게임') {
            const user = await getUser(interaction.user.id);
            if (!user) {
                await interaction.reply({ content: '유저 데이터를 불러올 수 없습니다!', ephemeral: true });
                return;
            }
            
            // 시간대별 이미지 및 인사말 설정
            const now = new Date();
            const hour = now.getHours();
            
            let timeImage = '';
            let timeColor = '';
            
            if (hour >= 6 && hour < 12) {
                // 아침 시간대 (6:00 - 11:59)
                timeImage = 'kim_main_morning.png';
                timeColor = '#ffeb3b'; // 노란색
            } else if (hour >= 12 && hour < 18) {
                // 점심 시간대 (12:00 - 17:59)
                timeImage = 'kim_main_lunch.png';
                timeColor = '#ff9800'; // 주황색
            } else {
                // 저녁/밤 시간대 (18:00 - 5:59)
                timeImage = 'kim_main_night.png';
                timeColor = '#3f51b5'; // 남색
            }

            // 상태창 (RPG 스타일)
            const greetings = [
                '오늘도 힘차게 모험을 떠나볼까요?',
                '새로운 하루가 시작되었네요!',
                '모험가님, 준비는 되셨나요?',
                '오늘은 어떤 재미있는 일이 있을까요?',
                '강화왕의 세계에 오신 것을 환영합니다!',
                '레벨업을 향해 달려가볼까요?',
                '오늘도 좋은 하루 되세요!',
                '모험이 여러분을 기다리고 있어요!',
                '행운이 함께하길 바랍니다!',
                '새로운 도전이 시작됩니다!'
            ];
            
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            
            // 경험치 계산 수정 (레벨업 시 필요 경험치 = 레벨 * 100)
            const maxExp = user.level * 100;
            
            // 출석 현황 계산 (오늘 출석체크 여부)
            const today = new Date().toDateString();
            const attendanceStatus = user.lastDaily === today ? '출석' : '결석';
            
            const statusEmbed = new EmbedBuilder()
                .setColor(timeColor)
                .setTitle(`${user.nickname}님, ${randomGreeting}`)
                .addFields(
                    { name: '⭐ 레벨', value: `\`\`\`Lv.${user.level}\`\`\``, inline: true },
                    { name: '✨ 경험치', value: `\`\`\`${user.exp}/${maxExp}\`\`\``, inline: true },
                    { name: '💰 골드', value: `\`\`\`${user.gold.toLocaleString()}G\`\`\``, inline: true },
                    { name: '📅 출석현황', value: `\`\`\`${attendanceStatus}\`\`\``, inline: true },
                    { name: '🏆 종합순위', value: `\`\`\`준비중\`\`\``, inline: true },
                    { name: '💖 인기도', value: `\`\`\`준비중\`\`\``, inline: true }
                )
                .setImage(`attachment://${timeImage}`)
                .setFooter({ text: '아래에서 원하는 활동을 선택하세요!' });

            // 페이지별 버튼 정의
            const pages = [
                // 페이지 1: 일일 활동
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('daily')
                            .setLabel('🎁 출석체크')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('work')
                            .setLabel('⚒️ 일하기')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                // 페이지 2: 전투
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('hunting')
                            .setLabel('⚔️ 사냥하기')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('pvp')
                            .setLabel('🛡️ PvP')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true) // 준비중
                    ]
                },
                // 페이지 3: 상점/강화
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('shop')
                            .setLabel('🛒 상점')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('enhancement')
                            .setLabel('⚡ 강화')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(user.level < 10) // 레벨 10 이상만 사용 가능
                    ]
                },
                // 페이지 4: 정보
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🎒 인벤토리')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('ranking')
                            .setLabel('🏆 랭킹')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('info')
                            .setLabel('👤 내정보')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                }
            ];

            // 페이지 네비게이션 버튼
            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true), // 첫 페이지에서는 비활성화
                    new ButtonBuilder()
                        .setCustomId('page_info')
                        .setLabel('1/4')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                );

            // 첫 페이지 버튼 row
            const contentRow = new ActionRowBuilder()
                .addComponents(pages[0].buttons);

            // 시간대별 이미지 첨부파일
            const timeAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', timeImage), { name: timeImage });
            
            await interaction.reply({ 
                embeds: [statusEmbed], 
                components: [contentRow, navigationRow], 
                files: [timeAttachment],
                ephemeral: true 
            });
        }
        
        else if (commandName === '회원가입') {
            const attachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_join.png'), { name: 'kim_join.png' });
            
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('강화왕 김헌터 회원가입')
                .setDescription('환영합니다! 강화왕 김헌터의 세계로 오신 것을 환영합니다.\n\n게임을 시작하기 위해 회원가입을 진행해주세요.')
                .setImage('attachment://kim_join.png')
                .addFields(
                    { name: '이메일 문의', value: 'support@kimhunter.com', inline: true },
                    { name: '디스코드 문의', value: '김헌터#0001', inline: true },
                    { name: '기타 문의', value: '티켓 시스템 이용', inline: true }
                )
                .setFooter({ text: '아래 버튼을 눌러 회원가입을 진행하세요!' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('register')
                        .setLabel('회원가입')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ embeds: [embed], components: [row], files: [attachment] });
        }
        
        else if (commandName === 'db테스트') {
            try {
                const user = await getUser(interaction.user.id);
                const totalUsers = await User.countDocuments();
                
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('데이터베이스 테스트')
                    .setDescription('MongoDB 연결 상태를 확인합니다.')
                    .addFields(
                        { name: '연결 상태', value: 'MongoDB 연결 성공', inline: true },
                        { name: '총 유저 수', value: `${totalUsers}명`, inline: true },
                        { name: '내 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                        { name: '내 레벨', value: `Lv.${user.level}`, inline: true },
                        { name: 'Discord ID', value: user.discordId, inline: true },
                        { name: '가입일', value: user.createdAt.toLocaleDateString('ko-KR'), inline: true }
                    );
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                console.error('DB 테스트 오류:', error);
                await interaction.reply({ content: '데이터베이스 연결 실패!', ephemeral: true });
            }
        }
        
        else if (commandName === '이메일테스트') {
            try {
                // 먼저 응답을 지연시켜 시간 제한 문제 해결
                await interaction.deferReply({ ephemeral: true });
                
                const testCode = generateVerificationCode();
                const emailSent = await sendVerificationEmail('sup.kimhunter@gmail.com', testCode);
                
                if (emailSent) {
                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('이메일 테스트 성공!')
                        .setDescription('테스트 이메일이 성공적으로 전송되었습니다.')
                        .addFields(
                            { name: '수신 이메일', value: 'sup.kimhunter@gmail.com', inline: true },
                            { name: '테스트 코드', value: testCode, inline: true },
                            { name: '전송 시간', value: new Date().toLocaleString('ko-KR'), inline: true }
                        );
                    
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({ content: '이메일 전송에 실패했습니다!' });
                }
            } catch (error) {
                console.error('이메일 테스트 오류:', error);
                if (interaction.deferred) {
                    await interaction.editReply({ content: '이메일 테스트 중 오류가 발생했습니다!' });
                } else {
                    await interaction.reply({ content: '이메일 테스트 중 오류가 발생했습니다!', ephemeral: true });
                }
            }
        }
        
        else if (commandName === '회원가입채널설정') {
            try {
                await interaction.deferReply({ ephemeral: true });
                
                const SIGNUP_CHANNEL_ID = '1380684353998426122';
                const signupChannel = await client.channels.fetch(SIGNUP_CHANNEL_ID);
                
                if (signupChannel) {
                    const signupAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_join.png'), { name: 'kim_join.png' });
                    
                    const signupEmbed = new EmbedBuilder()
                        .setColor('#ff6b6b')
                        .setTitle('강화왕 김헌터 회원가입')
                        .setDescription('환영합니다! 강화왕 김헌터의 세계로 오신 것을 환영합니다.\n\n게임을 시작하기 위해 회원가입을 진행해주세요.\n\n**회원가입 혜택:**\n• 가입 즉시 1,000G 지급\n• 경험치 부스터 및 초보자 무기 제공\n• 일일보상 및 다양한 게임 컨텐츠 이용 가능')
                        .setImage('attachment://kim_join.png')
                        .addFields(
                            { name: '📧 이메일 문의', value: 'sup.kimhunter@gmail.com', inline: true },
                            { name: '💬 디스코드 문의', value: 'JRY_10004', inline: true },
                            { name: '🎫 티켓 문의', value: '추후 버튼링크 생성 예정', inline: true }
                        )
                        .setFooter({ text: '아래 버튼을 눌러 회원가입을 진행하세요!' });

                    const signupRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('register')
                                .setLabel('회원가입')
                                .setStyle(ButtonStyle.Primary)
                        );

                    await signupChannel.send({ embeds: [signupEmbed], components: [signupRow], files: [signupAttachment] });
                    
                    await interaction.editReply({ content: '회원가입 채널에 안내 메시지를 성공적으로 게시했습니다!' });
                } else {
                    await interaction.editReply({ content: '회원가입 채널을 찾을 수 없습니다!' });
                }
            } catch (error) {
                console.error('회원가입 채널 설정 오류:', error);
                if (interaction.deferred) {
                    await interaction.editReply({ content: '회원가입 채널 설정 중 오류가 발생했습니다!' });
                } else {
                    await interaction.reply({ content: '회원가입 채널 설정 중 오류가 발생했습니다!', ephemeral: true });
                }
            }
        }
    } catch (error) {
        console.error('명령어 처리 오류:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: '오류가 발생했습니다!', ephemeral: true });
        }
    }
});

// 버튼 클릭 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // 개발 모드에서 채널 제한
    if (DEV_MODE && DEV_CHANNEL_ID && interaction.channelId !== DEV_CHANNEL_ID) {
        console.log(`채널 불일치 - 현재: ${interaction.channelId}, 개발: ${DEV_CHANNEL_ID}`);
        await interaction.reply({ content: '개발 모드에서는 지정된 채널에서만 사용 가능합니다!', ephemeral: true });
        return;
    }

    const user = await getUser(interaction.user.id);
    if (!user) {
        await interaction.reply({ content: '유저 데이터를 불러올 수 없습니다!', ephemeral: true });
        return;
    }
    const now = Date.now();

    try {
        // 메인화면의 게임하기 버튼 처리
        if (interaction.customId === 'game_start') {
            const user = await getUser(interaction.user.id);
            if (!user) {
                await interaction.reply({ content: '유저 데이터를 불러올 수 없습니다!', ephemeral: true });
                return;
            }
            
            // 게임 채널 안내 메시지
            const gameGuideEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('게임 시작!')
                .setDescription(`**${user.nickname || interaction.user.username}**님, 게임을 시작합니다!\n\n게임 채널에서 \`/게임\` 명령어를 사용하여 게임을 플레이하세요.\n\n**게임 채널로 이동하여 본격적인 모험을 시작해보세요!**`)
                .addFields(
                    { name: '명령어 안내', value: '`/게임` - 게임 메뉴 열기', inline: true },
                    { name: '현재 상태', value: `골드: ${user.gold.toLocaleString()}G\n레벨: Lv.${user.level}`, inline: true }
                )
                .setFooter({ text: '게임 채널에서 더 많은 기능을 이용할 수 있습니다!' });

            await interaction.reply({ embeds: [gameGuideEmbed], ephemeral: true });
        }
        
        else if (interaction.customId === 'support_info') {
            // 후원 안내 (추후 구현)
            const supportEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('후원 안내')
                .setDescription('후원 기능은 준비 중입니다.\n\n개발자를 응원해주시는 마음에 감사드립니다!')
                .setFooter({ text: '곧 후원 시스템이 추가될 예정입니다.' });
                
            await interaction.reply({ embeds: [supportEmbed], ephemeral: true });
        }
        
        else if (interaction.customId === 'inventory') {
            // 인벤토리 기능 (추후 구현)
            const inventoryEmbed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('🎒 인벤토리')
                .setDescription('인벤토리 시스템은 준비 중입니다.\n\n아이템 관리 기능이 곧 추가될 예정입니다!')
                .setFooter({ text: '장비, 소모품, 재료 등을 관리할 수 있게 됩니다.' });
                
            await interaction.reply({ embeds: [inventoryEmbed], ephemeral: true });
        }
        
        else if (interaction.customId === 'hunting') {
            // 개발 모드에서는 모든 사냥터 접근 가능, 일반 모드에서는 레벨 제한
            const availableAreas = DEV_MODE ? 
                huntingAreas : 
                huntingAreas.filter(area => user.unlockedAreas.includes(area.id));

            if (availableAreas.length === 0) {
                await interaction.reply({ content: '사용 가능한 사냥터가 없습니다!', ephemeral: true });
                return;
            }

            // 사냥터 페이지네이션 (한 페이지에 3개씩)
            const areasPerPage = 3;
            const totalPages = Math.ceil(availableAreas.length / areasPerPage);
            const currentPage = 0; // 첫 페이지부터 시작

            const startIndex = currentPage * areasPerPage;
            const endIndex = startIndex + areasPerPage;
            const currentAreas = availableAreas.slice(startIndex, endIndex);

            // 사냥터 선택 임베드
            const huntingEmbed = new EmbedBuilder()
                .setColor('#8b0000')
                .setTitle('⚔️ 사냥터 선택')
                .setDescription(`**${user.nickname}**님의 사냥터 목록\n\n현재 레벨: **Lv.${user.level}**`)
                .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages} | 사냥터를 선택하세요!` });

            // 사냥터별 필드 추가
            currentAreas.forEach(area => {
                const monsterNames = area.monsters.map(m => m.name).join(', ');
                huntingEmbed.addFields({
                    name: `${area.name} ${area.levelRange}`,
                    value: `출현몬스터: ${monsterNames}`,
                    inline: true
                });
            });

            // 사냥터 버튼들
            const huntingButtons = new ActionRowBuilder();
            currentAreas.forEach(area => {
                huntingButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`hunt_area_${area.id}`)
                        .setLabel(area.name)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            // 네비게이션 버튼
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('hunt_prev_page')
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('hunt_page_info')
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('hunt_next_page')
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴')
                        .setStyle(ButtonStyle.Success)
                );

            const components = [huntingButtons];
            if (totalPages > 1) components.push(navButtons);
            else {
                // 페이지가 1개면 게임 메뉴 버튼만 추가
                const backOnly = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('back_to_game_menu')
                            .setLabel('🎮 게임 메뉴로 돌아가기')
                            .setStyle(ButtonStyle.Success)
                    );
                components.push(backOnly);
            }

            await interaction.reply({ embeds: [huntingEmbed], components, ephemeral: true });
        }
        
        else if (interaction.customId === 'shop') {
            // 상점 기능 (추후 구현)
            const shopEmbed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('🛒 상점')
                .setDescription('상점 시스템은 준비 중입니다.\n\n다양한 아이템과 장비를 구매할 수 있습니다!')
                .addFields(
                    { name: '⚔️ 무기상점', value: '준비 중', inline: true },
                    { name: '🛡️ 방어구상점', value: '준비 중', inline: true },
                    { name: '💊 소모품상점', value: '준비 중', inline: true }
                )
                .setFooter({ text: '골드로 다양한 아이템을 구매하세요!' });
                
            await interaction.reply({ embeds: [shopEmbed], ephemeral: true });
        }
        
        else if (interaction.customId === 'enhancement') {
            // 강화 기능 (추후 구현)
            const enhancementEmbed = new EmbedBuilder()
                .setColor('#ff4500')
                .setTitle('⚡ 강화')
                .setDescription('강화 시스템은 준비 중입니다.\n\n장비를 강화하여 더 강력하게 만들 수 있습니다!')
                .addFields(
                    { name: '🔨 장비 강화', value: '준비 중', inline: true },
                    { name: '💎 강화석 시스템', value: '준비 중', inline: true },
                    { name: '✨ 성공 확률', value: '준비 중', inline: true }
                )
                .setFooter({ text: '강화에는 골드와 강화석이 필요합니다!' });
                
            await interaction.reply({ embeds: [enhancementEmbed], ephemeral: true });
        }
        
        else if (interaction.customId === 'ranking') {
            // 랭킹 기능 (추후 구현)
            const rankingEmbed = new EmbedBuilder()
                .setColor('#daa520')
                .setTitle('🏆 랭킹')
                .setDescription('랭킹 시스템은 준비 중입니다.\n\n다른 플레이어들과 경쟁해보세요!')
                .addFields(
                    { name: '⭐ 레벨 랭킹', value: '준비 중', inline: true },
                    { name: '💰 골드 랭킹', value: '준비 중', inline: true },
                    { name: '🏰 던전 클리어 랭킹', value: '준비 중', inline: true }
                )
                .setFooter({ text: '상위 랭커에게는 특별한 보상이 주어집니다!' });
                
            await interaction.reply({ embeds: [rankingEmbed], ephemeral: true });
        }
        
        else if (interaction.customId === 'daily') {
            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            
            // 테스트용: 쿨타임 제거
            // if (user.lastDaily === today) {
            //     await interaction.reply({ content: '오늘은 이미 출석체크를 했습니다!', ephemeral: true });
            //     return;
            // }

            // 연속 출석 체크
            if (user.lastDaily === yesterday) {
                user.attendanceStreak += 1;
            } else {
                user.attendanceStreak = 1;
            }

            // 주간 출석 체크 (주 시작 체크)
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay()); // 일요일 시작
            weekStart.setHours(0, 0, 0, 0);
            
            if (!user.weekStart || user.weekStart < weekStart) {
                user.weeklyAttendance = [false, false, false, false, false, false, false];
                user.weekStart = weekStart;
            }
            
            user.weeklyAttendance[now.getDay()] = true;

            // 이미지 첨부
            const dailyAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_daily.png'), { name: 'kim_daily.png' });

            // 보상 옵션들
            const rewards = [
                { name: '💰 500G', gold: 500, exp: 0, item: null },
                { name: '💰 1000G', gold: 1000, exp: 0, item: null },
                { name: '💰 2000G', gold: 2000, exp: 0, item: null },
                { name: '✨ 경험치 부스터', gold: 0, exp: 500, item: null },
                { name: '🎁 미스터리 박스', gold: 1500, exp: 100, item: 'mystery_box' }
            ];

            // 초기 룰렛 표시
            const rouletteEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🎡 출석 체크 보상 돌려돌려 돌림판!')
                .setDescription(`**${user.nickname || interaction.user.username}**님의 출석 체크!\\n\\n연속 출석: **${user.attendanceStreak}일** 🔥`)
                .addFields(
                    { name: '주간 출석 현황', value: `${user.weeklyAttendance.map((attended, i) => {
                        const days = ['일', '월', '화', '수', '목', '금', '토'];
                        return attended ? `${days[i]}✅` : `${days[i]}❌`;
                    }).join(' ')} (${user.weeklyAttendance.filter(x => x).length}/7)`, inline: false },
                )
                .setImage('attachment://kim_daily.png')
                .setFooter({ text: '아래 버튼을 눌러 돌림판을 돌리세요!' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('spin_roulette')
                        .setLabel('🎡 돌림판 돌리기!')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ embeds: [rouletteEmbed], components: [row], files: [dailyAttachment], ephemeral: true });
        }
        
        else if (interaction.customId === 'spin_roulette') {
            // 먼저 응답 지연 처리
            await interaction.deferUpdate();
            
            // 돌림판 애니메이션
            const rewards = [
                { name: '💰 500G + ✨ 100EXP', gold: 500, exp: 100 },
                { name: '💰 1000G + ✨ 200EXP', gold: 1000, exp: 200 },
                { name: '💰 1500G + ✨ 300EXP', gold: 1500, exp: 300 },
                { name: '💰 2000G + ✨ 400EXP', gold: 2000, exp: 400 },
                { name: '💰 2500G + ✨ 500EXP', gold: 2500, exp: 500 }
            ];

            const selectedReward = rewards[Math.floor(Math.random() * rewards.length)];
            const rewardIndex = rewards.indexOf(selectedReward);

            // 애니메이션 프레임들
            const frames = [
                '❓ 🎁 ❓ ❓ ❓',
                '❓ ❓ 🎁 ❓ ❓',
                '❓ ❓ ❓ 🎁 ❓',
                '❓ ❓ ❓ ❓ 🎁',
                '🎁 ❓ ❓ ❓ ❓'
            ];

            // 최종 결과 프레임
            const finalFrame = rewards.map((r, i) => i === rewardIndex ? '🎉' : '❌').join(' ');

            // 1단계: 돌리는 중 GIF
            const turntableAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_turntable.gif'), { name: 'kim_turntable.gif' });

            // GIF와 함께 돌림판 시작 표시
            const gifEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🎡 돌림판 돌리는 중...')
                .setDescription(`연속 출석: **${user.attendanceStreak}일** 🔥`)
                .setImage('attachment://kim_turntable.gif');

            await interaction.editReply({ embeds: [gifEmbed], components: [], files: [turntableAttachment] });
            
            // GIF 재생 시간 (4초)
            await new Promise(resolve => setTimeout(resolve, 4000));

            // 최종 결과 표시
            user.gold += selectedReward.gold;
            user.exp += selectedReward.exp;
            user.lastDaily = new Date().toDateString();
            
            // 레벨업 체크
            const { leveledUp, levelsGained, oldLevel } = processLevelUp(user);
            
            // 연속 출석 보너스
            let streakBonus = '';
            if (user.attendanceStreak >= 7) {
                const bonusGold = 1000;
                user.gold += bonusGold;
                streakBonus = `\\n🔥 **7일 연속 출석 보너스**: +${bonusGold}G`;
            }
            
            // 주간 미션 완료 체크
            let weeklyBonus = '';
            if (user.weeklyAttendance.filter(x => x).length === 7) {
                const weeklyGold = 5000;
                user.gold += weeklyGold;
                weeklyBonus = `\\n🏆 **주간 미션 완료**: +${weeklyGold}G`;
            }
            
            await user.save();

            // 3단계: 보상 강도에 따른 감정 멘트와 결과 표시
            const resultAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_turntable2.gif'), { name: 'kim_turntable2.gif' });
            
            // 보상 강도별 감정 멘트 설정
            let emotionTitle = '';
            let emotionDescription = '';
            let embedColor = '';
            
            // 레벨업 메시지 추가
            const levelUpMessage = leveledUp ? `\n\n🎉 **레벨업!** Lv.${oldLevel} → Lv.${user.level}` : '';
            
            if (selectedReward.gold >= 2000) {
                // 최고 보상
                emotionTitle = '🚀 대박!! 최고의 운이군요!';
                emotionDescription = `와! **${selectedReward.name}**을 당첨시키다니! 정말 대단해요! 오늘은 분명 좋은 일이 가득할 거예요! ✨${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#ffd700'; // 금색
            } else if (selectedReward.gold >= 1500) {
                // 높은 보상
                emotionTitle = '🎉 훌륭해요! 좋은 보상이네요!';
                emotionDescription = `**${selectedReward.name}** 당첨! 오늘 운이 좋으시네요! 계속 이런 행운이 이어지길 바라요! 😊${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#ff6b6b'; // 빨간색
            } else if (selectedReward.gold >= 1000) {
                // 중간 보상
                emotionTitle = '⭐ 좋은 결과예요!';
                emotionDescription = `**${selectedReward.name}** 당첨! 꾸준한 성장과 골드 획득이네요! 💪${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#9b59b6'; // 보라색
            } else {
                // 일반 보상
                emotionTitle = '😊 좋은 시작이에요!';
                emotionDescription = `**${selectedReward.name}** 당첨! 꾸준히 모으면 큰 힘이 될 거예요! 매일매일 출석해서 더 큰 보상을 노려봐요! 🎯${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#3498db'; // 파란색
            }
            
            const resultEmbed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(emotionTitle)
                .setDescription(emotionDescription)
                .addFields(
                    { name: '💰 획득 내역', value: `골드: +${selectedReward.gold.toLocaleString()}G\n경험치: +${selectedReward.exp} EXP`, inline: true },
                    { name: '💎 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                    { name: '🔥 연속 출석', value: `${user.attendanceStreak}일`, inline: true }
                )
                .setImage('attachment://kim_turntable2.gif')
                .setFooter({ text: '내일도 잊지 말고 출석체크 해주세요!' });

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴로 돌아가기')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.editReply({ embeds: [resultEmbed], components: [backButton], files: [resultAttachment] });
        }
        
        // 사냥터 선택 처리
        else if (interaction.customId.startsWith('hunt_area_')) {
            const areaId = parseInt(interaction.customId.split('_')[2]);
            const selectedArea = huntingAreas.find(area => area.id === areaId);
            
            if (!selectedArea) {
                await interaction.reply({ content: '존재하지 않는 사냥터입니다!', ephemeral: true });
                return;
            }
            
            // 사냥 시작 - 3단계 프로세스
            // 사냥터별 GIF 설정
            const huntingGifName = selectedArea.huntingGif || 'kim_hunting.gif'; // 기본값 설정
            const huntGifAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', huntingGifName), { name: huntingGifName });

            // 1단계: 사냥중 GIF (2초)
            const huntingMessages = [
                `**${selectedArea.name}**에서 열심히 사냥중입니다...`,
                `**${selectedArea.name}**에서 힘겹게 전투중입니다...`,
                `**${selectedArea.name}**의 몬스터들과 격투중입니다...`,
                `**${selectedArea.name}**를 탐험하며 사냥중입니다...`,
                `**${selectedArea.name}**에서 치열한 전투를 벌이고 있습니다...`
            ];
            
            const randomMessage = huntingMessages[Math.floor(Math.random() * huntingMessages.length)];
            
            const huntGifEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('⚔️ 사냥중...')
                .setDescription(`${randomMessage}\n\n현재 레벨: **Lv.${user.level}**`)
                .setImage(`attachment://${huntingGifName}`);
            
            await interaction.update({ embeds: [huntGifEmbed], components: [], files: [huntGifAttachment] });
            
            // 2초 대기 후 바로 결과로
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 랜덤 몬스터 선택
            const availableMonsters = selectedArea.monsters.filter(monster => {
                const minLevel = monster.level[0];
                const maxLevel = monster.level[1];
                return user.level >= minLevel - 5 && user.level <= maxLevel + 5; // 레벨 범위 여유
            });

            if (availableMonsters.length === 0) {
                await interaction.editReply({ 
                    content: '이 지역에서 사냥할 수 있는 몬스터가 없습니다!', 
                    embeds: [], 
                    components: [], 
                    files: [] 
                });
                return;
            }

            const selectedMonster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
            const monsterLevel = Math.floor(Math.random() * (selectedMonster.level[1] - selectedMonster.level[0] + 1)) + selectedMonster.level[0];

            // 전투 결과 계산
            const baseExp = Math.floor(Math.random() * (selectedMonster.exp[1] - selectedMonster.exp[0] + 1)) + selectedMonster.exp[0];
            const baseGold = Math.floor(Math.random() * (selectedMonster.gold[1] - selectedMonster.gold[0] + 1)) + selectedMonster.gold[0];
            
            // 레벨 차이에 따른 보상 조정
            const levelDiff = user.level - monsterLevel;
            let expMultiplier = 1;
            let goldMultiplier = 1;
            
            if (levelDiff > 5) {
                expMultiplier = 0.5; // 너무 쉬운 몬스터
                goldMultiplier = 0.7;
            } else if (levelDiff < -5) {
                expMultiplier = 1.5; // 어려운 몬스터
                goldMultiplier = 1.3;
            }

            const finalExp = Math.floor(baseExp * expMultiplier);
            const finalGold = Math.floor(baseGold * goldMultiplier);

            // 레어도에 따른 보너스
            let rarityBonus = 1;
            let rarityEmoji = '';
            switch (selectedMonster.rarity) {
                case '레어':
                    rarityBonus = 1.2;
                    rarityEmoji = '✨';
                    break;
                case '에픽':
                    rarityBonus = 1.5;
                    rarityEmoji = '🌟';
                    break;
                case '유니크':
                    rarityBonus = 2.0;
                    rarityEmoji = '💎';
                    break;
                case '레전드':
                    rarityBonus = 3.0;
                    rarityEmoji = '👑';
                    break;
                default:
                    rarityEmoji = '⚔️';
            }

            const bonusExp = Math.floor(finalExp * (rarityBonus - 1));
            const bonusGold = Math.floor(finalGold * (rarityBonus - 1));

            // 유저 데이터 업데이트
            user.exp += finalExp + bonusExp;
            user.gold += finalGold + bonusGold;
            user.lastHunt = Date.now();

            // 레벨업 체크
            const { leveledUp, levelsGained, oldLevel } = processLevelUp(user);

            await user.save();

            // 결과 임베드 (승리 GIF와 함께)
            const winGifAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_hunting_win.gif'), { name: 'kim_hunting_win.gif' });
            
            const resultEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`${rarityEmoji} 전투 승리!`)
                .setDescription(`**${selectedMonster.name}** Lv.${monsterLevel}을(를) 처치했습니다!${leveledUp ? `\n\n🎉 **레벨업!** Lv.${oldLevel} → Lv.${user.level}` : ''}`)
                .addFields(
                    { name: '💰 획득 골드', value: `${finalGold.toLocaleString()}G${bonusGold > 0 ? ` (+${bonusGold.toLocaleString()}G 보너스)` : ''}`, inline: true },
                    { name: '✨ 획득 경험치', value: `${finalExp.toLocaleString()} EXP${bonusExp > 0 ? ` (+${bonusExp.toLocaleString()} 보너스)` : ''}`, inline: true },
                    { name: '📊 현재 상태', value: `Lv.${user.level} | ${user.gold.toLocaleString()}G\nEXP: ${user.exp}/${user.level * 100}`, inline: true }
                )
                .setImage('attachment://kim_hunting_win.gif')
                .setFooter({ text: `${selectedArea.name}에서 사냥 완료!` });

            const continueButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`hunt_area_${areaId}`)
                        .setLabel('🔄 계속 사냥')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('hunting')
                        .setLabel('🗺️ 사냥터 변경')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴')
                        .setStyle(ButtonStyle.Success)
                );

            await interaction.editReply({ 
                embeds: [resultEmbed], 
                components: [continueButtons], 
                files: [winGifAttachment] 
            });
        }
        
        else if (interaction.customId === 'work') {
            const cooldown = 30 * 60 * 1000; // 30분 쿨타임
            
            if (now - user.lastWork < cooldown) {
                const remaining = Math.ceil((cooldown - (now - user.lastWork)) / 60000);
                await interaction.reply({ content: `쿨타임 ${remaining}분 남았습니다!`, ephemeral: true });
                return;
            }

            const goldReward = Math.floor(Math.random() * 300) + 200; // 200-500골드
            const expReward = Math.floor(Math.random() * 50) + 25; // 25-75경험치
            
            user.gold += goldReward;
            user.exp += expReward;
            user.lastWork = now;
            
            // 레벨업 체크
            const { leveledUp, levelsGained, oldLevel } = processLevelUp(user);
            
            await user.save();

            const levelUpMessage = leveledUp ? `\n\n🎉 **레벨업!** Lv.${oldLevel} → Lv.${user.level}` : '';

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('일하기 완료!')
                .setDescription(`열심히 일해서 골드와 경험치를 얻었습니다!${levelUpMessage}`)
                .addFields(
                    { name: '획득 골드', value: `+${goldReward.toLocaleString()}G`, inline: true },
                    { name: '획득 경험치', value: `+${expReward} EXP`, inline: true },
                    { name: '현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (interaction.customId === 'info') {
            const maxExp = user.level * 100;
            const embed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('내 정보')
                .setDescription(`**${user.nickname}**님의 게임 정보`)
                .addFields(
                    { name: '레벨', value: `Lv.${user.level}`, inline: true },
                    { name: '경험치', value: `${user.exp}/${maxExp} EXP`, inline: true },
                    { name: '골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                    { name: '출석체크', value: user.lastDaily === new Date().toDateString() ? '완료' : '미완료', inline: true },
                    { name: '일하기', value: now - user.lastWork < 30 * 60 * 1000 ? '쿨타임' : '가능', inline: true },
                    { name: '연속 출석', value: `${user.attendanceStreak || 0}일 🔥`, inline: true },
                    { name: '주간 출석', value: `${user.weeklyAttendance ? user.weeklyAttendance.filter(x => x).length : 0}/7일`, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (interaction.customId === 'register') {
            const modal = new ModalBuilder()
                .setCustomId('registerModal')
                .setTitle('강화왕 김헌터 회원가입');

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
                        .setLabel('이메일 (인증 필요)')
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

            modal.addComponents(nicknameRow, emailRow, genderRow, referralRow);
            await interaction.showModal(modal);
        }
        
        else if (interaction.customId === 'verify_email') {
            const modal = new ModalBuilder()
                .setCustomId('verifyEmailModal')
                .setTitle('이메일 인증코드 입력');

            const codeRow = new ActionRowBuilder()
                .addComponents(
                    new TextInputBuilder()
                        .setCustomId('verification_code')
                        .setLabel('인증코드 (6자리)')
                        .setPlaceholder('123456')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(6)
                        .setMaxLength(6)
                );

            modal.addComponents(codeRow);
            await interaction.showModal(modal);
        }
        
        // 페이지 네비게이션 처리
        else if (interaction.customId === 'prev_page' || interaction.customId === 'next_page') {
            // 현재 페이지 찾기 (버튼 라벨에서 추출)
            const pageInfo = interaction.message.components[1].components[1].data.label;
            let currentPage = parseInt(pageInfo.split('/')[0]) - 1; // 0부터 시작하는 인덱스로 변환
            
            // 페이지 변경
            if (interaction.customId === 'prev_page') {
                currentPage--;
            } else {
                currentPage++;
            }
            
            // 페이지별 버튼 정의 (다시 정의해야 함)
            const pages = [
                // 페이지 1: 일일 활동
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('daily')
                            .setLabel('🎁 출석체크')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('work')
                            .setLabel('⚒️ 일하기')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                // 페이지 2: 전투
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('hunting')
                            .setLabel('⚔️ 사냥하기')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('pvp')
                            .setLabel('⚔️ PvP')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true)
                    ]
                },
                // 페이지 3: 상점/강화
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('shop')
                            .setLabel('🛒 상점')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('enhancement')
                            .setLabel('⚡ 강화')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(user.level < 10)
                    ]
                },
                // 페이지 4: 정보
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🎒 인벤토리')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('ranking')
                            .setLabel('🏆 랭킹')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('info')
                            .setLabel('👤 내정보')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                }
            ];
            
            // 새로운 네비게이션 버튼
            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('page_info')
                        .setLabel(`${currentPage + 1}/4`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === pages.length - 1)
                );
            
            // 현재 페이지의 컨텐츠 버튼
            const contentRow = new ActionRowBuilder()
                .addComponents(pages[currentPage].buttons);
            
            // 버튼만 업데이트
            await interaction.update({
                components: [contentRow, navigationRow]
            });
        }
        
        // 사냥터 페이지네이션 처리
        else if (interaction.customId === 'hunt_prev_page' || interaction.customId === 'hunt_next_page') {
            // 현재 페이지 찾기
            const pageInfo = interaction.message.components[1].components[1].data.label;
            let currentPage = parseInt(pageInfo.split('/')[0]) - 1;
            
            // 페이지 변경
            if (interaction.customId === 'hunt_prev_page') {
                currentPage--;
            } else {
                currentPage++;
            }
            
            // 사용자가 접근 가능한 사냥터 다시 필터링
            const availableAreas = DEV_MODE ? 
                huntingAreas : 
                huntingAreas.filter(area => user.unlockedAreas.includes(area.id));
            
            const areasPerPage = 3;
            const totalPages = Math.ceil(availableAreas.length / areasPerPage);
            
            const startIndex = currentPage * areasPerPage;
            const endIndex = startIndex + areasPerPage;
            const currentAreas = availableAreas.slice(startIndex, endIndex);
            
            // 새로운 임베드
            const huntingEmbed = new EmbedBuilder()
                .setColor('#8b0000')
                .setTitle('⚔️ 사냥터 선택')
                .setDescription(`**${user.nickname}**님의 사냥터 목록\n\n현재 레벨: **Lv.${user.level}**`)
                .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages} | 사냥터를 선택하세요!` });
            
            currentAreas.forEach(area => {
                const monsterNames = area.monsters.map(m => m.name).join(', ');
                huntingEmbed.addFields({
                    name: `${area.name} ${area.levelRange}`,
                    value: `출현몬스터: ${monsterNames}`,
                    inline: true
                });
            });
            
            // 사냥터 버튼들
            const huntingButtons = new ActionRowBuilder();
            currentAreas.forEach(area => {
                huntingButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`hunt_area_${area.id}`)
                        .setLabel(area.name)
                        .setStyle(ButtonStyle.Primary)
                );
            });
            
            // 네비게이션 버튼
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('hunt_prev_page')
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('hunt_page_info')
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('hunt_next_page')
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴')
                        .setStyle(ButtonStyle.Success)
                );
            
            const components = [huntingButtons];
            if (totalPages > 1) components.push(navButtons);
            else {
                const backOnly = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('back_to_game_menu')
                            .setLabel('🎮 게임 메뉴로 돌아가기')
                            .setStyle(ButtonStyle.Success)
                    );
                components.push(backOnly);
            }
            
            await interaction.update({ embeds: [huntingEmbed], components });
        }
        
        // 게임 메뉴로 돌아가기 버튼 처리
        else if (interaction.customId === 'back_to_game_menu') {
            // 게임 메뉴를 다시 표시
            const user = await getUser(interaction.user.id);
            if (!user) {
                await interaction.update({ content: '유저 데이터를 불러올 수 없습니다!', embeds: [], components: [] });
                return;
            }
            
            // 시간대별 이미지 및 인사말 다시 설정
            const now = new Date();
            const hour = now.getHours();
            
            let timeImage = '';
            let timeColor = '';
            
            if (hour >= 6 && hour < 12) {
                timeImage = 'kim_main_morning.png';
                timeColor = '#ffeb3b';
            } else if (hour >= 12 && hour < 18) {
                timeImage = 'kim_main_lunch.png';
                timeColor = '#ff9800';
            } else {
                timeImage = 'kim_main_night.png';
                timeColor = '#3f51b5';
            }

            // 상태창 다시 생성 (동일한 로직 적용)
            const greetings = [
                '오늘도 힘차게 모험을 떠나볼까요?',
                '새로운 하루가 시작되었네요!',
                '모험가님, 준비는 되셨나요?',
                '오늘은 어떤 재미있는 일이 있을까요?',
                '강화왕의 세계에 오신 것을 환영합니다!',
                '레벨업을 향해 달려가볼까요?',
                '오늘도 좋은 하루 되세요!',
                '모험이 여러분을 기다리고 있어요!',
                '행운이 함께하길 바랍니다!',
                '새로운 도전이 시작됩니다!'
            ];
            
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            const maxExp = user.level * 100;
            const today = new Date().toDateString();
            const attendanceStatus = user.lastDaily === today ? '출석' : '결석';
            
            const statusEmbed = new EmbedBuilder()
                .setColor(timeColor)
                .setTitle(`${user.nickname}님, ${randomGreeting}`)
                .addFields(
                    { name: '⭐ 레벨', value: `\`\`\`Lv.${user.level}\`\`\``, inline: true },
                    { name: '✨ 경험치', value: `\`\`\`${user.exp}/${maxExp}\`\`\``, inline: true },
                    { name: '💰 골드', value: `\`\`\`${user.gold.toLocaleString()}G\`\`\``, inline: true },
                    { name: '📅 출석현황', value: `\`\`\`${attendanceStatus}\`\`\``, inline: true },
                    { name: '🏆 종합순위', value: `\`\`\`준비중\`\`\``, inline: true },
                    { name: '💖 인기도', value: `\`\`\`준비중\`\`\``, inline: true }
                )
                .setImage(`attachment://${timeImage}`)
                .setFooter({ text: '아래에서 원하는 활동을 선택하세요!' });

            // 첫 페이지 버튼들
            const pages = [
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('daily')
                            .setLabel('🎁 출석체크')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('work')
                            .setLabel('⚒️ 일하기')
                            .setStyle(ButtonStyle.Primary)
                    ]
                }
            ];

            const contentRow = new ActionRowBuilder()
                .addComponents(pages[0].buttons);

            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('page_info')
                        .setLabel('1/4')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                );

            const timeAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', timeImage), { name: timeImage });

            await interaction.update({ 
                embeds: [statusEmbed], 
                components: [contentRow, navigationRow], 
                files: [timeAttachment]
            });
        }
    } catch (error) {
        console.error('버튼 처리 오류:', error);
        if (!interaction.replied) {
            await interaction.reply({ content: '오류가 발생했습니다!', ephemeral: true });
        }
    }
});

// Modal 제출 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    if (interaction.customId === 'registerModal') {
        const nickname = interaction.fields.getTextInputValue('nickname');
        const email = interaction.fields.getTextInputValue('email');
        const gender = interaction.fields.getTextInputValue('gender');
        const referral = interaction.fields.getTextInputValue('referral');
        
        try {
            // 먼저 응답을 지연시켜 이메일 전송 시간 확보
            await interaction.deferReply({ ephemeral: true });
            
            const user = await getUser(interaction.user.id);
            if (!user) {
                await interaction.editReply({ content: '유저 데이터를 불러올 수 없습니다!' });
                return;
            }

            // 이미 회원가입 했는지 확인
            if (user.registered) {
                await interaction.editReply({ content: '이미 회원가입을 완료하셨습니다!' });
                return;
            }

            // 닉네임 중복 체크
            const existingUser = await User.findOne({ nickname });
            if (existingUser) {
                await interaction.editReply({ content: '이미 사용 중인 닉네임입니다!' });
                return;
            }

            // 이메일 형식 검증
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                await interaction.editReply({ content: '올바른 이메일 형식이 아닙니다!' });
                return;
            }

            // 인증코드 생성 및 저장
            const verificationCode = generateVerificationCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 후 만료

            user.nickname = nickname;
            user.email = email;
            user.gender = gender;
            user.referral = referral;
            user.emailVerificationCode = verificationCode;
            user.emailVerificationExpires = expiresAt;
            await user.save();

            // 이메일 전송
            const emailSent = await sendVerificationEmail(email, verificationCode);
            
            if (!emailSent) {
                await interaction.editReply({ content: '인증 이메일 전송에 실패했습니다. 이메일 주소를 확인해주세요.' });
                return;
            }

            // 인증코드 입력 버튼이 있는 응답
            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('이메일 인증 필요')
                .setDescription(`**${email}**로 인증코드를 전송했습니다.`)
                .addFields(
                    { name: '유효시간', value: '10분', inline: true },
                    { name: '이메일 확인', value: '스팸함도 확인해주세요', inline: true }
                )
                .setFooter({ text: '인증코드를 받으셨다면 아래 버튼을 클릭하세요!' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('verify_email')
                        .setLabel('인증코드 입력')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.editReply({ embeds: [embed], components: [row] });
            return;
        } catch (error) {
            console.error('회원가입 처리 오류:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: '회원가입 처리 중 오류가 발생했습니다!' });
            } else {
                await interaction.reply({ content: '회원가입 처리 중 오류가 발생했습니다!', ephemeral: true });
            }
            return;
        }
    }
    
    else if (interaction.customId === 'verifyEmailModal') {
        const verificationCode = interaction.fields.getTextInputValue('verification_code');
        
        try {
            const user = await getUser(interaction.user.id);
            if (!user) {
                await interaction.reply({ content: '유저 데이터를 불러올 수 없습니다!', ephemeral: true });
                return;
            }

            // 인증코드가 없거나 만료된 경우
            if (!user.emailVerificationCode || !user.emailVerificationExpires) {
                await interaction.reply({ content: '인증코드가 없습니다. 다시 회원가입을 시도해주세요.', ephemeral: true });
                return;
            }

            // 인증코드 만료 확인
            if (new Date() > user.emailVerificationExpires) {
                await interaction.reply({ content: '인증코드가 만료되었습니다. 다시 회원가입을 시도해주세요.', ephemeral: true });
                return;
            }

            // 인증코드 확인
            if (user.emailVerificationCode !== verificationCode) {
                await interaction.reply({ content: '인증코드가 올바르지 않습니다. 다시 확인해주세요.', ephemeral: true });
                return;
            }

            // 이메일 인증 완료 처리
            user.emailVerified = true;
            user.registered = true;
            user.registeredAt = new Date();
            user.gold += 1000; // 가입 보너스
            user.emailVerificationCode = null;
            user.emailVerificationExpires = null;
            await user.save();

            const attachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_join.png'), { name: 'kim_join.png' });
            
            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('회원가입 완료!')
                .setDescription(`**${user.nickname}**님, 강화왕 김헌터에 오신 것을 환영합니다!\n\n게임을 시작하여 더 많은 보상을 얻어보세요!`)
                .setImage('attachment://kim_join.png')
                .addFields(
                    { name: '가입 보상', value: '골드 1,000G\n경험치 부스터 x1\n초보자 무기 x1', inline: false },
                    { name: '이메일 인증', value: '완료', inline: true },
                    { name: '현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
                )
                .setFooter({ text: '이제 /게임 명령어로 게임을 시작하세요!' });
                
            await interaction.reply({ embeds: [successEmbed], files: [attachment], ephemeral: true });
            
            // 메인 채널에 메인화면 메시지 보내기
            const MAIN_CHANNEL_ID = '1380678306067779614';
            try {
                const mainChannel = await client.channels.fetch(MAIN_CHANNEL_ID);
                if (mainChannel) {
                        const mainAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_main.png'), { name: 'kim_main.png' });
                        
                        const mainEmbed = new EmbedBuilder()
                            .setColor('#ff6b6b')
                            .setTitle('강화왕 김헌터에 오신 것을 환영합니다!')
                            .setDescription(`**${user.nickname}**님, 회원가입을 축하드립니다!\n\n✨ **강화와 모험의 세계로 떠나보세요!** ✨\n\n🎯 **게임 안내**\n• 장비를 강화하여 더 강한 캐릭터를 만들어보세요\n• 다양한 던전에서 모험을 즐기고 보상을 획득하세요\n• 다른 플레이어들과 경쟁하며 랭킹을 올려보세요\n• 일일보상과 다양한 활동으로 골드와 경험치를 얻으세요\n\n📜 **법적 준수 사항**\n• 본 게임은 만 13세 이상 이용 가능합니다\n• 게임내 화폐는 실물 가치가 없으며, 현금으로 교환되지 않습니다\n• 게임 이용 시 예의를 지키고 공정한 플레이를 부탁드립니다\n• 부정행위나 욕설, 스팸 등은 제재 대상입니다\n• 문의사항은 티켓 시스템을 이용해주세요`)
                            .setImage('attachment://kim_main.png')
                            .setFooter({ text: '준비가 되셨다면 아래 버튼을 눌러 게임을 시작하세요!' });

                        const mainRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('game_start')
                                    .setLabel('게임하기')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId('support_info')
                                    .setLabel('후원 안내')
                                    .setStyle(ButtonStyle.Secondary)
                            );

                        await mainChannel.send({ 
                            content: `<@${user.discordId}>`, 
                            embeds: [mainEmbed], 
                            components: [mainRow], 
                            files: [mainAttachment] 
                        });
                }
            } catch (error) {
                console.error('메인 채널 메시지 전송 오류:', error);
            }
        } catch (error) {
            console.error('이메일 인증 처리 오류:', error);
            await interaction.reply({ content: '인증 처리 중 오류가 발생했습니다!', ephemeral: true });
        }
    }
});

// 봇 로그인
client.login(TOKEN);