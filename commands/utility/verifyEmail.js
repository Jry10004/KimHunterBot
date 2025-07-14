const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('인증')
        .setDescription('이메일 인증 코드를 입력합니다')
        .addStringOption(option =>
            option.setName('코드')
                .setDescription('6자리 인증 코드')
                .setRequired(true)
                .setMinLength(6)
                .setMaxLength(6)
        ),
    
    async execute(interaction) {
        const code = interaction.options.getString('코드');
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user || !user.emailVerificationCode) {
                return await interaction.editReply({
                    content: '❌ 인증 정보를 찾을 수 없습니다. 먼저 /회원가입 명령어를 사용해주세요.'
                });
            }
            
            if (user.registered) {
                return await interaction.editReply({
                    content: '❌ 이미 회원가입이 완료된 계정입니다.'
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
                embeds: [successEmbed]
            });
            
        } catch (error) {
            console.error('Verification error:', error);
            await interaction.editReply({
                content: '❌ 인증 처리 중 오류가 발생했습니다.'
            });
        }
    }
};