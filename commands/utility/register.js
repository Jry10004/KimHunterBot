const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { sendVerificationEmail, generateVerificationCode } = require('../../services/emailService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('회원가입')
        .setDescription('김헌터 게임에 회원가입합니다 (이메일 인증 필요)'),
    
    async execute(interaction) {
        try {
            console.log('[회원가입] execute 시작 - 사용자:', interaction.user.tag);
            console.log('[회원가입] interaction.deferred:', interaction.deferred, 'interaction.replied:', interaction.replied);
            
            // 이미 가입한 유저인지 확인
            const existingUser = await User.findOne({ discordId: interaction.user.id });
            if (existingUser && existingUser.registered) {
                console.log('[회원가입] 이미 가입된 사용자:', interaction.user.tag);
                // interactionHandler에서 이미 defer했으므로 editReply 사용
                if (interaction.deferred) {
                    return await interaction.editReply({ 
                        content: '❌ 이미 회원가입이 완료되었습니다!'
                    });
                } else if (interaction.replied) {
                    return; // 이미 응답한 경우 무시
                } else {
                    return await interaction.reply({ 
                        content: '❌ 이미 회원가입이 완료되었습니다!', 
                        flags: 64 
                    });
                }
            }
        
        // 이메일 및 닉네임 입력 모달 표시
        const modal = new ModalBuilder()
            .setCustomId('registration_email_modal')
            .setTitle('회원가입 - 정보 입력');
        
        const emailInput = new TextInputBuilder()
            .setCustomId('email_input')
            .setLabel('이메일 주소')
            .setPlaceholder('example@email.com')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(5)
            .setMaxLength(100);
            
        const nicknameInput = new TextInputBuilder()
            .setCustomId('nickname_input')
            .setLabel('게임 닉네임 (2~10자, 한글/영문/숫자)')
            .setPlaceholder('김헌터')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(10);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(emailInput),
            new ActionRowBuilder().addComponents(nicknameInput)
        );
        
        console.log('[회원가입] 모달 표시 시도');
        await interaction.showModal(modal);
        console.log('[회원가입] 모달 표시 완료');
        } catch (error) {
            console.error('[회원가입] execute 오류:', error);
            throw error;
        }
    },
    
    // 모달 제출 처리
    async handleModal(interaction) {
        if (interaction.customId !== 'registration_email_modal') return;
        
        const email = interaction.fields.getTextInputValue('email_input');
        const nickname = interaction.fields.getTextInputValue('nickname_input');
        
        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return await interaction.reply({
                content: '❌ 올바른 이메일 형식이 아닙니다!',
                flags: 64
            });
        }
        
        // 닉네임 형식 검증 (한글, 영문, 숫자만 허용)
        const nicknameRegex = /^[가-힣a-zA-Z0-9]+$/;
        if (!nicknameRegex.test(nickname)) {
            return await interaction.reply({
                content: '❌ 닉네임은 한글, 영문, 숫자만 사용할 수 있습니다!',
                flags: 64
            });
        }
        
        await interaction.deferReply({ flags: 64 });
        
        try {
            // 이메일 중복 확인
            const emailExists = await User.findOne({ email: email });
            if (emailExists) {
                return await interaction.editReply({
                    content: '❌ 이미 사용 중인 이메일입니다!'
                });
            }
            
            // 닉네임 중복 확인
            const nicknameExists = await User.findOne({ nickname: nickname });
            if (nicknameExists) {
                return await interaction.editReply({
                    content: '❌ 이미 사용 중인 닉네임입니다!'
                });
            }
            
            // 인증 코드 생성
            const verificationCode = generateVerificationCode();
            const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10분 후 만료
            
            // 유저 생성 또는 업데이트
            let user = await User.findOne({ discordId: interaction.user.id });
            if (!user) {
                user = new User({ discordId: interaction.user.id });
            }
            
            // 임시 등록 정보 저장
            user.email = email;
            user.nickname = nickname;  // 사용자가 입력한 닉네임 저장
            user.emailVerificationCode = verificationCode;
            user.emailVerificationExpires = verificationExpires;
            
            await user.save();
            
            // 인증 이메일 발송
            const emailSent = await sendVerificationEmail(email, verificationCode, interaction.user.id);
            
            if (emailSent) {
                // 인증 코드 입력 모달 표시를 위한 버튼
                const verifyButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`verify_email_${interaction.user.id}`)
                            .setLabel('인증 코드 입력')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('✉️')
                    );
                
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('📧 이메일 인증')
                    .setDescription(`${email}로 인증 코드를 발송했습니다!`)
                    .addFields(
                        { name: '⏰ 유효 시간', value: '10분', inline: true },
                        { name: '📝 인증 코드', value: '6자리 숫자', inline: true },
                        { name: '💡 대안', value: '버튼이 작동하지 않으면 `/인증 코드:123456` 명령어를 사용하세요', inline: false }
                    )
                    .setFooter({ text: '아래 버튼을 눌러 인증 코드를 입력하세요' });
                
                await interaction.editReply({
                    embeds: [embed],
                    components: [verifyButton]
                });
            } else {
                // 개발 모드에서는 인증 코드를 직접 보여줌
                if (process.env.DEV_MODE === 'true') {
                    const verifyButton = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`verify_email_${interaction.user.id}`)
                                .setLabel('인증 코드 입력')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('✉️')
                        );
                    
                    const embed = new EmbedBuilder()
                        .setColor('#ffff00')
                        .setTitle('📧 이메일 인증 (개발 모드)')
                        .setDescription(`${email}로 인증 코드를 발송했습니다!`)
                        .addFields(
                            { name: '⏰ 유효 시간', value: '10분', inline: true },
                            { name: '📝 인증 코드', value: `**${verificationCode}**`, inline: true },
                            { name: '💡 대안', value: '버튼이 작동하지 않으면 `/인증 코드:${verificationCode}` 명령어를 사용하세요', inline: false }
                        )
                        .setFooter({ text: '개발 모드: 인증 코드가 표시됩니다' });
                    
                    await interaction.editReply({
                        embeds: [embed],
                        components: [verifyButton]
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ 이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.'
                    });
                }
            }
            
        } catch (error) {
            console.error('Registration error:', error);
            await interaction.editReply({
                content: '❌ 회원가입 처리 중 오류가 발생했습니다.'
            });
        }
    },
    
    // 인증 코드 입력 처리
    async handleVerification(interaction) {
        console.log('[회원가입] 인증 버튼 클릭됨:', interaction.customId);
        
        if (!interaction.customId.startsWith('verify_email_')) return;
        
        const userId = interaction.customId.split('_')[2];
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ 본인의 인증만 진행할 수 있습니다!',
                flags: 64
            });
        }
        
        try {
            // 인증 코드 입력 모달
            const modal = new ModalBuilder()
                .setCustomId('verification_code_modal')
                .setTitle('이메일 인증 코드 입력');
            
            const codeInput = new TextInputBuilder()
                .setCustomId('verification_code')
                .setLabel('인증 코드 (6자리)')
                .setPlaceholder('123456')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(6)
                .setMaxLength(6);
            
            modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
            
            console.log('[회원가입] 인증 코드 입력 모달 표시 시도');
            await interaction.showModal(modal);
            console.log('[회원가입] 인증 코드 입력 모달 표시 완료');
        } catch (error) {
            console.error('[회원가입] 인증 모달 표시 오류:', error);
            await interaction.reply({
                content: '❌ 인증 코드 입력창을 표시하는 중 오류가 발생했습니다. 다시 시도해주세요.',
                flags: 64
            });
        }
    },
    
    // 인증 코드 확인
    async handleCodeVerification(interaction) {
        if (interaction.customId !== 'verification_code_modal') return;
        
        const code = interaction.fields.getTextInputValue('verification_code');
        
        await interaction.deferReply({ flags: 64 });
        
        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user || !user.emailVerificationCode) {
                return await interaction.editReply({
                    content: '❌ 인증 정보를 찾을 수 없습니다. 다시 회원가입을 시도해주세요.'
                });
            }
            
            // 만료 시간 확인
            if (new Date() > user.emailVerificationExpires) {
                return await interaction.editReply({
                    content: '❌ 인증 코드가 만료되었습니다. 다시 회원가입을 시도해주세요.'
                });
            }
            
            // 인증 코드 확인
            if (user.emailVerificationCode !== code) {
                return await interaction.editReply({
                    content: '❌ 잘못된 인증 코드입니다!'
                });
            }
            
            // 회원가입 완료 처리
            user.registered = true;
            user.emailVerified = true;
            user.gold = 1000;
            user.level = 1;
            user.exp = 0;
            user.stats = {
                strength: 10,
                agility: 10,
                intelligence: 10,
                vitality: 10,
                luck: 10
            };
            user.statPoints = 0;
            user.inventory = [];
            user.equipment = {
                weapon: -1,
                armor: -1,
                helmet: -1,
                gloves: -1,
                boots: -1,
                accessory: -1
            };
            
            // 레벨에 맞는 사냥터 자동 해금
            user.unlockedAreas = [1];
            
            // 사냥 관련 초기화
            user.huntingTickets = 20;
            user.lastHuntingTicketRegen = new Date();
            user.huntingStreak = 0;
            user.totalHunts = 0;
            user.bossKills = 0;
            
            // PVP 초기화
            user.pvp = {
                rating: 1000,
                wins: 0,
                losses: 0,
                streak: 0,
                lastMatch: null,
                matchHistory: []
            };
            
            // 출석 초기화
            user.attendance = {
                lastDate: null,
                streak: 0,
                totalDays: 0
            };
            
            // 작업 초기화
            user.work = {
                lastWorked: null,
                totalEarnings: 0,
                consecutiveDays: 0
            };
            
            // 강화 관련 초기화
            user.totalEnhancements = 0;
            user.enhancementTickets = 0;
            
            // 사전강화 데이터 연동 (데이터만 저장, 보상 없음)
            if (global.prelaunchEventData && global.prelaunchEventData[interaction.user.id]) {
                const prelaunchData = global.prelaunchEventData[interaction.user.id];
                
                // 사전강화 기록만 저장
                user.prelaunchEnhancement = {
                    level: prelaunchData.currentLevel || 0,
                    totalEnhanced: prelaunchData.totalEnhanced || 0,
                    dogBotBonus: prelaunchData.dogBotBonus || 0,
                    points: prelaunchData.points || 0,
                    achievements: prelaunchData.achievements || []
                };
            }
            
            // 인증 정보 제거
            user.emailVerificationCode = undefined;
            user.emailVerificationExpires = undefined;
            
            await user.save();
            
            // 김헌터플레이어 역할 부여
            try {
                const playerRole = interaction.guild.roles.cache.find(role => role.name === '김헌터플레이어');
                if (playerRole) {
                    await interaction.member.roles.add(playerRole);
                    console.log(`✅ ${interaction.user.tag}에게 김헌터플레이어 역할 부여`);
                }
            } catch (roleError) {
                console.error('역할 부여 실패:', roleError);
            }
            
            // 회원가입 완료 메시지
            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎉 회원가입 완료!')
                .setDescription(`${user.nickname}님, 강화왕 김헌터의 세계에 오신 것을 환영합니다!`);
            
            // 기본 정보 필드
            const fields = [
                { name: '🎮 게임 닉네임', value: user.nickname, inline: true },
                { name: '💰 시작 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '📊 레벨', value: 'Lv.1', inline: true },
                { name: '✉️ 이메일', value: user.email, inline: true }
            ];
            
            // 사전강화 데이터 연동 시 추가 정보
            if (user.prelaunchEnhancement && user.prelaunchEnhancement.level > 0) {
                fields.push(
                    { name: '🎁 사전강화 연동', value: '✅ 완료!', inline: true },
                    { name: '⭐ 사전강화 레벨', value: `+${user.prelaunchEnhancement.level}`, inline: true },
                    { name: '📊 포인트', value: `${user.prelaunchEnhancement.points.toLocaleString()}P`, inline: true }
                );
            }
            
            successEmbed.addFields(fields)
                .setFooter({ text: '/게임 명령어로 게임을 시작하세요!' })
                .setTimestamp();
            
            await interaction.editReply({
                embeds: [successEmbed],
                components: []
            });
            
        } catch (error) {
            console.error('Verification error:', error);
            await interaction.editReply({
                content: '❌ 인증 처리 중 오류가 발생했습니다.'
            });
        }
    }
};