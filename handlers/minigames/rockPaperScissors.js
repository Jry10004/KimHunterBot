const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { createGameStartEmbed } = require('../../data/mushroomGameImproved');
const spectatorBetting = require('../../data/spectatorBetting');
const { applyMinigameBonus } = require('../common/specialEffects');
const TicketManager = require('../../utils/ticketManager');

const RPS_GAME = {
    choices: ['✊', '✌️', '✋'],
    choiceNames: { '✊': '바위', '✌️': '가위', '✋': '보' },
    winConditions: {
        '✊': '✌️', // 바위는 가위를 이김
        '✌️': '✋', // 가위는 보를 이김
        '✋': '✊'  // 보는 바위를 이김
    },
    rewards: {
        botWin: 500,      // 봇 대전 승리 보상
        userWin: 1000,    // 유저 대전 승리 보상
        draw: 100         // 무승부 보상
    },
    ticketRegen: 300000,  // 5분
    maxTickets: 20,      // 최대 티켓 수
    minBet: 100,        // 최소 베팅
    maxBet: 100000,     // 최대 베팅
    multiplayerSettings: {
        entryFee: 100,   // 참가비
        minPlayers: 2,   // 최소 인원
        maxPlayers: 2,   // 최대 인원 (가위바위보는 1:1)
        roundTime: 10000 // 라운드 시간 (10초)
    }
};

// 가위바위보 멀티플레이어 세션 관리
const rpsMultiplayerSessions = new Map(); // lobbyId로 직접 접근
const rpsTempChannels = new Map(); // 임시 채널 관리
const rpsMatchQueue = new Map(); // 유저 대전 대기열
const rpsGameSessions = new Map(); // 진행중인 게임 세션

class RockPaperScissorsSystem {
    constructor() {
        this.sessions = rpsMultiplayerSessions;
        this.matchQueue = rpsMatchQueue;
        this.gameSessions = rpsGameSessions;
    }

    // 메인 메뉴 표시
    async showMainMenu(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        // 티켓 재생성
        await TicketManager.regenerateTickets(user);

        const embed = new EmbedBuilder()
            .setTitle('✊✌️✋ 가위바위보 게임')
            .setDescription(
                '**🎯 게임 방식**: 가위, 바위, 보 중 하나를 선택하여 상대와 대결!\n' +
                '**🎫 티켓 시스템**: 대전마다 티켓 1개 소모, 5분마다 1개씩 회복\n' +
                '**🏆 보상**: 승리 시 골드를 획득하고 전적을 쌓아보세요!\n\n' +
                '🎮 **플레이 모드를 선택하세요!**'
            )
            .addFields(
                { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '🎯 승률', value: `${this.calculateWinRate(user)}%`, inline: true },
                { name: '🔥 연승', value: `${user.rpsGameData?.currentStreak || 0}회`, inline: true },
                { name: '🎫 봇 티켓', value: `${user.rpsGameData?.botTickets || 0}/${RPS_GAME.maxTickets}`, inline: true },
                { name: '🎟️ 유저 티켓', value: `${user.rpsGameData?.userTickets || 0}/${RPS_GAME.maxTickets}`, inline: true },
                { name: '🏆 전적', value: `${user.rpsGameData?.wins || 0}승 ${user.rpsGameData?.draws || 0}무 ${user.rpsGameData?.losses || 0}패`, inline: true }
            )
            .setColor('#FF6B6B');

        const modeButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rps_bot')
                    .setLabel('🌱 혼자하기')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.rpsGameData?.botTickets <= 0),
                new ButtonBuilder()
                    .setCustomId('rps_user')
                    .setLabel('⚔️ 유저와 플레이')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(user.rpsGameData?.userTickets <= 0),
                new ButtonBuilder()
                    .setCustomId('rps_tournament')
                    .setLabel('🏆 토너먼트 (준비중)')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('rps_stats')
                    .setLabel('📊 상세 통계')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [embed],
            components: [modeButtons]
        });
    }

    // 티켓 재생성
    async regenerateTickets(user) {
        // RPS 게임 데이터 초기화
        if (!user.rpsGameData) {
            user.rpsGameData = {
                botTickets: 20,
                userTickets: 20,
                lastBotTicketRegen: new Date(),
                lastUserTicketRegen: new Date(),
                wins: 0,
                draws: 0,
                losses: 0,
                currentStreak: 0,
                bestStreak: 0,
                totalGoldWon: 0,
                totalGoldBet: 0
            };
            await user.save();
            return;
        }

        const now = Date.now();
        
        // 봇 대전 티켓 재생성
        const timeSinceLastBotRegen = now - new Date(user.rpsGameData.lastBotTicketRegen).getTime();
        const botTicketsToRegen = Math.floor(timeSinceLastBotRegen / RPS_GAME.ticketRegen);
        
        if (botTicketsToRegen > 0 && user.rpsGameData.botTickets < RPS_GAME.maxTickets) {
            user.rpsGameData.botTickets = Math.min(RPS_GAME.maxTickets, user.rpsGameData.botTickets + botTicketsToRegen);
            user.rpsGameData.lastBotTicketRegen = new Date(now);
        }
        
        // 유저 대전 티켓 재생성
        const timeSinceLastUserRegen = now - new Date(user.rpsGameData.lastUserTicketRegen).getTime();
        const userTicketsToRegen = Math.floor(timeSinceLastUserRegen / RPS_GAME.ticketRegen);
        
        if (userTicketsToRegen > 0 && user.rpsGameData.userTickets < RPS_GAME.maxTickets) {
            user.rpsGameData.userTickets = Math.min(RPS_GAME.maxTickets, user.rpsGameData.userTickets + userTicketsToRegen);
            user.rpsGameData.lastUserTicketRegen = new Date(now);
        }
        
        await user.save();
    }

    // 승률 계산
    calculateWinRate(user) {
        const data = user.rpsGameData;
        if (!data) return '0.0';
        
        const totalGames = data.wins + data.draws + data.losses;
        if (totalGames === 0) return '0.0';
        
        return ((data.wins / totalGames) * 100).toFixed(1);
    }

    // 봇 대전 시작
    async startBotGame(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        // 티켓 확인 및 사용
        const ticketResult = await TicketManager.useTicket(interaction.user.id, 'rps_bot');
        if (!ticketResult.success) {
            const ticketInfo = await TicketManager.getTicketInfo(interaction.user.id);
            return interaction.reply({
                content: `❌ ${ticketResult.error}\n🎫 남은 가위바위보 봇 티켓: ${ticketInfo.rps_bot}장\n⏱️ 티켓은 5분마다 1장씩 충전됩니다.`,
                flags: 64
            });
        }
        
        // 티켓이 차감된 최신 user 객체로 업데이트
        user = ticketResult.user;

        const gameEmbed = new EmbedBuilder()
            .setTitle('🤖 봇과의 가위바위보 대결!')
            .setDescription('아래에서 하나를 선택하세요!\n\n봇이 당신의 선택을 기다리고 있습니다...')
            .setColor('#4169E1')
            .setFooter({ text: `남은 티켓: ${ticketResult.user.rpsGameData.botTickets}개` });

        const choiceButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rps_bot_rock')
                    .setLabel('바위')
                    .setEmoji('✊')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('rps_bot_scissors')
                    .setLabel('가위')
                    .setEmoji('✌️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('rps_bot_paper')
                    .setLabel('보')
                    .setEmoji('✋')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.update({
            embeds: [gameEmbed],
            components: [choiceButtons]
        });
    }

    // 봇 대전 처리
    async processBotGame(interaction, userChoice) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        // 봇 선택 (랜덤)
        const botChoice = RPS_GAME.choices[Math.floor(Math.random() * RPS_GAME.choices.length)];
        
        // 결과 판정
        let result;
        let reward = 0;
        let resultColor;
        let resultTitle;

        if (userChoice === botChoice) {
            result = 'draw';
            reward = RPS_GAME.rewards.draw;
            resultColor = '#FFA500';
            resultTitle = '🤝 무승부!';
            user.rpsGameData.draws++;
            user.rpsGameData.currentStreak = 0;
        } else if (RPS_GAME.winConditions[userChoice] === botChoice) {
            result = 'win';
            reward = RPS_GAME.rewards.botWin;
            resultColor = '#00FF00';
            resultTitle = '🎉 승리!';
            user.rpsGameData.wins++;
            user.rpsGameData.currentStreak++;
            if (user.rpsGameData.currentStreak > user.rpsGameData.bestStreak) {
                user.rpsGameData.bestStreak = user.rpsGameData.currentStreak;
            }
        } else {
            result = 'lose';
            resultColor = '#FF0000';
            resultTitle = '😢 패배!';
            user.rpsGameData.losses++;
            user.rpsGameData.currentStreak = 0;
        }

        // 골드 지급
        let bonusApplied = false;
        let bonusAmount = 0;
        let bonusReward = reward;
        
        if (reward > 0) {
            // 미니게임 보상 특수 효과 적용
            bonusReward = applyMinigameBonus(reward, user);
            if (bonusReward > reward) {
                bonusApplied = true;
                bonusAmount = bonusReward - reward;
            }
            user.gold += bonusReward;
            user.rpsGameData.totalGoldWon += bonusReward;
        }
        
        // gameStats 업데이트
        if (!user.gameStats) user.gameStats = {};
        if (!user.gameStats.rps) user.gameStats.rps = { played: 0, won: 0 };
        user.gameStats.rps.played++;
        if (result === 'win') {
            user.gameStats.rps.won++;
        }
        
        await user.save();
        
        // 미션 진행도 업데이트
        const MissionHelper = require('../../utils/missionHelper');
        await MissionHelper.updateMiniGame(interaction.user.id);
        
        // 골드 획득 미션 업데이트
        if (reward > 0) {
            await MissionHelper.updateGoldEarned(interaction.user.id, bonusReward);
        }

        // 결과 표시
        const resultEmbed = new EmbedBuilder()
            .setTitle(resultTitle)
            .setDescription(
                `**당신의 선택:** ${userChoice} ${RPS_GAME.choiceNames[userChoice]}\n` +
                `**봇의 선택:** ${botChoice} ${RPS_GAME.choiceNames[botChoice]}\n\n` +
                (reward > 0 ? `💰 **획득 골드:** ${bonusReward}G` : '골드를 획득하지 못했습니다.') +
                (bonusApplied ? `\n🏷️ **버그 사냥꾼 칭호 효과** +${bonusAmount}G` : '')
            )
            .addFields(
                { name: '🏆 현재 전적', value: `${user.rpsGameData.wins}승 ${user.rpsGameData.draws}무 ${user.rpsGameData.losses}패`, inline: true },
                { name: '🔥 연승', value: `${user.rpsGameData.currentStreak}회`, inline: true },
                { name: '💰 보유 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
            )
            .setColor(resultColor);

        const continueButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rps_bot')
                    .setLabel('🔄 다시 하기')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.rpsGameData.botTickets <= 0),
                new ButtonBuilder()
                    .setCustomId('rps_main')
                    .setLabel('📋 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [resultEmbed],
            components: [continueButtons]
        });
    }

    // 유저 대전 매칭
    async startUserMatching(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        if (user.rpsGameData.userTickets <= 0) {
            // 다음 티켓 재생성까지 남은 시간 계산
            const now = Date.now();
            const REGEN_TIME = 15 * 60 * 1000; // 15분
            const lastRegen = user.lastTicketRegen || now;
            const nextRegenTime = lastRegen + REGEN_TIME;
            const timeUntilRegen = Math.max(0, nextRegenTime - now);
            const minutesLeft = Math.ceil(timeUntilRegen / 60000);
            
            return interaction.reply({ 
                content: `❌ 유저 대전 티켓이 부족합니다!\n🕐 다음 티켓 재생성까지: **${minutesLeft}분**\n💡 미니게임 티켓은 15분마다 1장씩 재생성됩니다. (최대 10장)`, 
                flags: 64 
            });
        }

        const userId = interaction.user.id;

        // 미니게임 채널로 이동
        const guild = interaction.guild;
        let gameCategory = guild.channels.cache.find(
            c => c.name === '🎮 미니게임' && c.type === 4
        );
        
        if (!gameCategory) {
            gameCategory = await guild.channels.create({
                name: '🎮 미니게임',
                type: 4,
                position: 99
            });
        }
        
        // 미니게임 채널 찾기 또는 생성
        let minigameChannel = guild.channels.cache.find(
            c => c.name === '🎮-대기실' && c.parentId === gameCategory.id
        );
        
        if (!minigameChannel) {
            minigameChannel = await guild.channels.create({
                name: '🎮-대기실',
                type: 0, // TEXT
                parent: gameCategory,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: ['ViewChannel', 'SendMessages']
                    }
                ]
            });
        }

        // 대기열 확인
        if (this.matchQueue.size > 0) {
            // 대기 중인 상대가 있으면 즉시 매칭
            const [opponentId, opponentData] = this.matchQueue.entries().next().value;
            this.matchQueue.delete(opponentId);

            // 멀티플레이어 게임 생성
            await this.createMultiplayerGame(interaction, user, opponentId, opponentData);
        } else {
            // 대기열에 추가
            this.matchQueue.set(userId, {
                user: user,
                interaction: interaction,
                timestamp: Date.now()
            });

            // 원래 채널에 안내 메시지
            await interaction.update({
                content: `🎮 가위바위보 대전 대기 중!\n<#${minigameChannel.id}>에서 상대를 기다리고 있습니다.`,
                embeds: [],
                components: []
            });

            // 미니게임 채널에 대기 메시지
            const sessionId = `rps_${userId}_${Date.now()}`;
            const waitingEmbed = new EmbedBuilder()
                .setTitle('✊✌️✋ 가위바위보 대기실')
                .setDescription(`**호스트**: ${user.nickname || interaction.user.username}`)
                .addFields(
                    { name: '🎮 게임', value: '가위바위보', inline: true },
                    { name: '👥 현재 인원', value: `1/2명`, inline: true },
                    { name: '💰 배팅금', value: '미설정', inline: true },
                    { name: '👥 참여자', value: `• ${user.nickname || interaction.user.username}`, inline: false }
                )
                .setColor('#FF6B6B')
                .setFooter({ text: '배팅금을 설정하고 참여자를 기다리고 있습니다!' });

            const gameButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rps_bet_${sessionId}`)
                        .setLabel('💰 배팅금 설정')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`rps_join_${sessionId}`)
                        .setLabel('🎮 참가하기')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`rps_start_${sessionId}`)
                        .setLabel('🎯 게임 시작')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true), // 2명 + 배팅금 설정 후 활성화
                    new ButtonBuilder()
                        .setCustomId(`rps_spectate_${sessionId}`)
                        .setLabel('👁️ 관전자로 참여')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('rps_cancel_match')
                        .setLabel('❌ 대기 취소')
                        .setStyle(ButtonStyle.Danger)
                );

            const waitingMessage = await minigameChannel.send({
                embeds: [waitingEmbed],
                components: [gameButtons]
            });

            // 대기 세션 정보 저장
            this.sessions.set(sessionId, {
                id: sessionId,
                hostId: userId,
                players: new Map([[userId, { 
                    user: user, 
                    userId: userId,
                    userName: user.nickname || interaction.user.username,
                    ready: true 
                }]]),
                waitingMessage: waitingMessage,
                channelId: minigameChannel.id,
                originalChannelId: interaction.channel.id, // 원래 채널 ID 저장
                status: 'waiting',
                scores: new Map([[userId, 0]]),
                roundNumber: 1,
                playerChoices: new Map(),
                betAmount: null
            });

            // 60초 후 자동 취소
            setTimeout(() => {
                if (this.sessions.has(sessionId) && this.sessions.get(sessionId).status === 'waiting') {
                    this.sessions.delete(sessionId);
                    waitingMessage.delete().catch(() => {});
                }
            }, 60000);  // 60초로 연장
        }
    }

    // 멀티플레이어 게임 생성
    async createMultiplayerGame(interaction1, user1, userId2, data2) {
        const lobbyId = `rps_${Date.now()}`;
        
        try {
            // 현재 채널 사용 (대기실 채널)
            const gameChannel = interaction1.channel;

            // 게임 세션 생성
            const session = {
                lobbyId: lobbyId,
                hostId: user1.discordId,
                hostName: user1.nickname || interaction1.user.username,
                players: new Map([
                    [user1.discordId, {
                        userId: user1.discordId,
                        userName: user1.nickname || interaction1.user.username,
                        ready: true
                    }],
                    [userId2, {
                        userId: userId2,
                        userName: data2.user.nickname || 'Player 2',
                        ready: true
                    }]
                ]),
                scores: new Map([[user1.discordId, 0], [userId2, 0]]),
                roundNumber: 1,
                maxRounds: 3, // 3판 2선승
                gameStarted: false,
                channel: gameChannel, // 대기실 채널을 게임 채널로 사용
                playerChoices: new Map()
            };

            this.sessions.set(lobbyId, session);

            // 양쪽 플레이어에게 알림
            const matchEmbed = new EmbedBuilder()
                .setTitle('⚔️ 가위바위보 대결 매칭 완료!')
                .setDescription(`게임이 곧 시작됩니다!`)
                .setColor('#00FF00');

            await interaction1.editReply({
                embeds: [matchEmbed],
                components: []
            });

            // 상대방에게도 알림
            if (data2.interaction) {
                await data2.interaction.editReply({
                    embeds: [matchEmbed],
                    components: []
                }).catch(() => {});
            }

            // 게임 시작
            setTimeout(() => this.startMultiplayerGame(gameChannel, lobbyId), 3000);

        } catch (error) {
            console.error('멀티플레이어 게임 생성 오류:', error);
            await interaction1.editReply({
                content: '❌ 게임 생성 중 오류가 발생했습니다.',
                embeds: [],
                components: []
            });
        }
    }

    // 멀티플레이어 게임 시작
    async startMultiplayerGame(channel, lobbyId) {
        const session = this.sessions.get(lobbyId);
        if (!session || session.gameStarted) return;

        session.gameStarted = true;

        // 각 플레이어의 티켓 차감
        for (const [playerId, playerData] of session.players) {
            const user = await User.findOne({ discordId: playerId });
            if (user) {
                user.gold -= RPS_GAME.multiplayerSettings.entryFee;
                user.rpsGameData.userTickets--;
                await user.save();
            }
        }

        // 게임 시작 메시지
        const players = Array.from(session.players.values());
        const startEmbed = createGameStartEmbed(
            '가위바위보',
            session.hostName,
            players,
            {
                status: '3판 2선승제로 진행됩니다!',
                footer: '곧 첫 번째 라운드가 시작됩니다!',
                extraFields: [
                    { name: '💎 참가비', value: `${RPS_GAME.multiplayerSettings.entryFee.toLocaleString()}G`, inline: true },
                    { name: '🏆 총 상금', value: `${(RPS_GAME.multiplayerSettings.entryFee * players.length).toLocaleString()}G`, inline: true }
                ]
            }
        );

        await channel.send({ embeds: [startEmbed] });

        // 3초 후 첫 라운드 시작
        setTimeout(() => this.startRound(channel, lobbyId), 3000);
    }

    // 라운드 시작
    async startRound(channel, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.playerChoices.clear();

        // 관전자 확인 및 시간 설정
        const hasSpectators = spectatorBetting.hasSpectators(sessionId);
        const roundTime = hasSpectators ? 20000 : 10000; // 관전자가 있으면 20초, 없으면 10초
        const roundTimeSeconds = roundTime / 1000;
        
        // 라운드 시작 메시지
        const roundEmbed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle(`🎮 라운드 ${session.roundNumber}`)
            .setDescription(
                `**현재 스코어**\n` +
                Array.from(session.players.values())
                    .map(p => `${p.userName}: ${session.scores.get(p.userId)}승`)
                    .join('\n') +
                `\n\n⏱️ **${roundTimeSeconds}초** 안에 선택하세요!` +
                (hasSpectators ? '\n👁️ 관전자가 있어 시간이 연장되었습니다!' : '')
            );

        await channel.send({ embeds: [roundEmbed] });

        // 3, 2, 1 카운트다운
        for (let i = 3; i > 0; i--) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await channel.send(`**${i}**...`);
        }
        await channel.send('🎯 **가위바위보!**');

        // 선택 버튼 생성
        const choiceButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`rps_multi_choice_${sessionId}_rock`)
                    .setLabel('바위')
                    .setEmoji('✊')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`rps_multi_choice_${sessionId}_scissors`)
                    .setLabel('가위')
                    .setEmoji('✌️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`rps_multi_choice_${sessionId}_paper`)
                    .setLabel('보')
                    .setEmoji('✋')
                    .setStyle(ButtonStyle.Primary)
            );

        const choiceEmbed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('선택하세요!')
            .setDescription('✊ 바위, ✌️ 가위, ✋ 보 중 하나를 선택하세요!');

        const choiceMessage = await channel.send({
            embeds: [choiceEmbed],
            components: [choiceButtons]
        });
        
        // 세션에 메시지 저장
        session.currentChoiceMessage = choiceMessage;

        // 관전자가 있으면 20초, 없으면 10초 후 자동 처리
        session.roundTimer = setTimeout(() => this.processRoundEnd(channel, sessionId), roundTime);
    }

    // 라운드 종료 처리
    async processRoundEnd(channel, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        // 버튼 비활성화
        if (session.currentChoiceMessage) {
            try {
                await session.currentChoiceMessage.edit({
                    components: []
                });
            } catch (err) {
                console.error('버튼 비활성화 실패:', err);
            }
        }

        // 선택하지 않은 플레이어는 랜덤 선택
        for (const [playerId, playerData] of session.players) {
            if (!session.playerChoices.has(playerId)) {
                const randomChoice = RPS_GAME.choices[Math.floor(Math.random() * RPS_GAME.choices.length)];
                session.playerChoices.set(playerId, randomChoice);
            }
        }

        // 결과 계산
        const playerIds = Array.from(session.players.keys());
        const [player1Id, player2Id] = playerIds;
        const player1Data = session.players.get(player1Id);
        const player2Data = session.players.get(player2Id);
        const choice1 = session.playerChoices.get(player1Id);
        const choice2 = session.playerChoices.get(player2Id);

        let winner = null;
        let resultText = '';

        if (choice1 === choice2) {
            resultText = '🤝 무승부!';
        } else if (RPS_GAME.winConditions[choice1] === choice2) {
            winner = player1Data;
            session.scores.set(player1Id, session.scores.get(player1Id) + 1);
            resultText = `🎉 ${player1Data.user.nickname || 'Player 1'} 승리!`;
        } else {
            winner = player2Data;
            session.scores.set(player2Id, session.scores.get(player2Id) + 1);
            resultText = `🎉 ${player2Data.user.nickname || 'Player 2'} 승리!`;
        }

        // 결과 표시
        const resultEmbed = new EmbedBuilder()
            .setTitle(`라운드 ${session.roundNumber} 결과`)
            .setDescription(
                `**${player1Data.user.nickname || 'Player 1'}:** ${choice1} ${RPS_GAME.choiceNames[choice1]}\n` +
                `**${player2Data.user.nickname || 'Player 2'}:** ${choice2} ${RPS_GAME.choiceNames[choice2]}\n\n` +
                resultText
            )
            .setColor(winner ? '#00FF00' : '#FFA500');

        await channel.send({ embeds: [resultEmbed] });

        // 게임 종료 확인
        const player1Score = session.scores.get(player1Id);
        const player2Score = session.scores.get(player2Id);

        if (player1Score >= 2 || player2Score >= 2) {
            // 게임 종료
            await this.endMultiplayerGame(channel, sessionId);
        } else {
            // 다음 라운드
            session.roundNumber++;
            session.playerChoices.clear();
            
            // 기존 타이머 취소
            if (session.roundTimer) {
                clearTimeout(session.roundTimer);
                session.roundTimer = null;
            }
            
            setTimeout(() => this.startRound(channel, sessionId), 3000);
        }
    }

    // 멀티플레이어 게임 종료
    async endMultiplayerGame(channel, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const players = Array.from(session.players.values());
        const [player1, player2] = players;
        const player1Score = session.scores.get(player1.userId);
        const player2Score = session.scores.get(player2.userId);

        const winner = player1Score > player2Score ? player1 : player2;
        const loser = winner === player1 ? player2 : player1;
        const betAmount = session.betAmount || 0;
        const winAmount = betAmount * 2; // 배팅금의 2배

        // 승자에게 상금 지급
        const winnerUser = await User.findOne({ discordId: winner.userId });
        if (winnerUser && betAmount > 0) {
            // 미니게임 보상 특수 효과 적용
            const bonusWinAmount = applyMinigameBonus(winAmount, winnerUser);
            winnerUser.gold += bonusWinAmount;
            winnerUser.rpsGameData.wins++;
            winnerUser.rpsGameData.totalGoldWon += bonusWinAmount;
            await winnerUser.save();
            
            // 미션 진행도 업데이트
            const MissionHelper = require('../../utils/missionHelper');
            await MissionHelper.updateMiniGame(winner.userId);
            await MissionHelper.updateGoldEarned(winner.userId, bonusWinAmount);
        }

        // 패자 기록 업데이트
        const loserUser = await User.findOne({ discordId: loser.userId });
        if (loserUser) {
            loserUser.rpsGameData.losses++;
            loserUser.rpsGameData.totalGoldBet += betAmount;
            await loserUser.save();
        }

        // 게임 종료 메시지
        const endEmbed = new EmbedBuilder()
            .setTitle('🏆 게임 종료!')
            .setDescription(
                `**🎉 우승자: ${winner.userName}**\n\n` +
                `**최종 스코어**\n` +
                `${player1.userName}: ${player1Score}승\n` +
                `${player2.userName}: ${player2Score}승\n\n` +
                (betAmount > 0 ? 
                    `**💰 배팅 결과**\n` +
                    `${winner.userName}: +${winAmount.toLocaleString()}G (획득금액: ${winAmount.toLocaleString()})\n` +
                    `${loser.userName}: -${betAmount.toLocaleString()}G (잃은금액: ${betAmount.toLocaleString()})`
                    : '배팅 없음')
            )
            .setColor('#FFD700');

        await channel.send({ embeds: [endEmbed] });
        
        // 원래 채널에 결과 알림
        if (session.originalChannelId) {
            try {
                const originalChannel = channel.guild.channels.cache.get(session.originalChannelId);
                if (originalChannel) {
                    const resultEmbed = new EmbedBuilder()
                        .setTitle('✊✌️✋ 가위바위보 대결 결과!')
                        .setColor('#FFD700')
                        .setDescription(
                            `## 🏆 **${winner.userName}**님의 승리!\n` +
                            `### 🎊 축하합니다! 승리의 영광을 차지하셨습니다!\n\n` +
                            `**최종 스코어:** ${player1Score} : ${player2Score}\n` +
                            (betAmount > 0 ? 
                                `### 💰 배팅 결과\n` +
                                `**${winner.userName}**: +${winAmount.toLocaleString()}G 💎 *대박이네요!*\n` +
                                `**${loser.userName}**: -${betAmount.toLocaleString()}G 💸 *다음엔 꼭 이기세요!*\n\n` +
                                `> "${winner.userName}님은 오늘 운이 좋으시네요! 🍀"\n` +
                                `> "${loser.userName}님, 포기하지 마세요! 💪"`
                                : '')
                        )
                        .setFooter({ text: '가위바위보 - 운빨게임의 정석' })
                        .setTimestamp();
                    
                    await originalChannel.send({ embeds: [resultEmbed] });
                }
            } catch (error) {
                console.error('원래 채널 알림 실패:', error);
            }
        }
        
        // 게임 종료 버튼 (채널은 삭제하지 않음)
        const endButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rps_play_again')
                    .setLabel('🔄 다시 플레이')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        await channel.send({
            content: '게임이 종료되었습니다! 다시 플레이하시겠습니까?',
            components: [endButtons]
        });

        // 세션 정리 (채널은 유지)
        this.sessions.delete(sessionId);
    }

    // 베팅 모드
    async showBettingMode(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const bettingEmbed = new EmbedBuilder()
            .setTitle('💰 가위바위보 베팅 모드')
            .setDescription(
                '골드를 걸고 봇과 대결합니다!\n\n' +
                '**승리:** 베팅금의 2배\n' +
                '**무승부:** 베팅금 반환\n' +
                '**패배:** 베팅금 잃음\n\n' +
                '베팅 금액을 선택하세요:'
            )
            .addFields(
                { name: '💰 보유 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
            )
            .setColor('#FFD700');

        const betButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rps_bet_1000')
                    .setLabel('1,000G')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(user.gold < 1000),
                new ButtonBuilder()
                    .setCustomId('rps_bet_5000')
                    .setLabel('5,000G')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.gold < 5000),
                new ButtonBuilder()
                    .setCustomId('rps_bet_10000')
                    .setLabel('10,000G')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.gold < 10000),
                new ButtonBuilder()
                    .setCustomId('rps_bet_50000')
                    .setLabel('50,000G')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(user.gold < 50000),
                new ButtonBuilder()
                    .setCustomId('rps_main')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [bettingEmbed],
            components: [betButtons]
        });
    }

    // 베팅 게임 실행
    async executeBettingGame(interaction, betAmount) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        if (user.gold < betAmount) {
            return interaction.reply({ content: '❌ 골드가 부족합니다!', flags: 64 });
        }

        // 골드 차감
        user.gold -= betAmount;
        user.rpsGameData.totalGoldBet += betAmount;
        await user.save();

        const gameEmbed = new EmbedBuilder()
            .setTitle('💰 베팅 가위바위보!')
            .setDescription(
                `**베팅 금액:** ${betAmount.toLocaleString()}G\n\n` +
                '선택하세요!'
            )
            .setColor('#FFD700');

        const choiceButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`rps_betting_rock_${betAmount}`)
                    .setLabel('바위')
                    .setEmoji('✊')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`rps_betting_scissors_${betAmount}`)
                    .setLabel('가위')
                    .setEmoji('✌️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`rps_betting_paper_${betAmount}`)
                    .setLabel('보')
                    .setEmoji('✋')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.update({
            embeds: [gameEmbed],
            components: [choiceButtons]
        });
    }

    // 베팅 게임 결과 처리
    async processBettingResult(interaction, userChoice, betAmount) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        // 봇 선택
        const botChoice = RPS_GAME.choices[Math.floor(Math.random() * RPS_GAME.choices.length)];
        
        let winAmount = 0;
        let resultColor;
        let resultTitle;

        if (userChoice === botChoice) {
            // 무승부 - 베팅금 반환
            winAmount = betAmount;
            resultColor = '#FFA500';
            resultTitle = '🤝 무승부! 베팅금 반환';
            user.rpsGameData.draws++;
        } else if (RPS_GAME.winConditions[userChoice] === botChoice) {
            // 승리 - 베팅금의 2배
            winAmount = betAmount * 2;
            resultColor = '#00FF00';
            resultTitle = '🎉 승리! 베팅금의 2배 획득!';
            user.rpsGameData.wins++;
        } else {
            // 패배
            resultColor = '#FF0000';
            resultTitle = '😢 패배! 베팅금을 잃었습니다...';
            user.rpsGameData.losses++;
        }

        // 골드 지급
        if (winAmount > 0) {
            // 미니게임 보상 특수 효과 적용
            const bonusWinAmount = applyMinigameBonus(winAmount, user);
            user.gold += bonusWinAmount;
            user.rpsGameData.totalGoldWon += bonusWinAmount;
        }

        await user.save();
        
        // 미션 진행도 업데이트
        const MissionHelper = require('../../utils/missionHelper');
        await MissionHelper.updateMiniGame(interaction.user.id);
        
        // 골드 획득 미션 업데이트
        if (winAmount > 0) {
            await MissionHelper.updateGoldEarned(interaction.user.id, bonusWinAmount);
        }

        // 결과 표시
        const resultEmbed = new EmbedBuilder()
            .setTitle(resultTitle)
            .setDescription(
                `**당신의 선택:** ${userChoice} ${RPS_GAME.choiceNames[userChoice]}\n` +
                `**봇의 선택:** ${botChoice} ${RPS_GAME.choiceNames[botChoice]}\n\n` +
                `**베팅 금액:** ${betAmount.toLocaleString()}G\n` +
                `**획득 금액:** ${winAmount.toLocaleString()}G\n` +
                `**현재 골드:** ${user.gold.toLocaleString()}G`
            )
            .setColor(resultColor);

        const continueButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rps_betting')
                    .setLabel('🔄 다시 베팅')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('rps_main')
                    .setLabel('📋 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [resultEmbed],
            components: [continueButtons]
        });
    }

    // 게임 참가
    async joinGame(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'waiting') {
            return interaction.reply({ 
                content: '❌ 참가할 수 없는 게임입니다.', 
                flags: 64 
            });
        }

        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ 
                content: '❌ 등록되지 않은 사용자입니다.', 
                flags: 64 
            });
        }

        // 이미 참가했는지 확인
        if (session.players.has(interaction.user.id)) {
            return interaction.reply({ 
                content: '❌ 이미 참가한 게임입니다.', 
                flags: 64 
            });
        }

        // 티켓 확인
        if (user.rpsGameData.userTickets <= 0) {
            // 다음 티켓 재생성까지 남은 시간 계산
            const now = Date.now();
            const REGEN_TIME = 15 * 60 * 1000; // 15분
            const lastRegen = user.lastTicketRegen || now;
            const nextRegenTime = lastRegen + REGEN_TIME;
            const timeUntilRegen = Math.max(0, nextRegenTime - now);
            const minutesLeft = Math.ceil(timeUntilRegen / 60000);
            
            return interaction.reply({ 
                content: `❌ 유저 대전 티켓이 부족합니다!\n🕐 다음 티켓 재생성까지: **${minutesLeft}분**\n💡 미니게임 티켓은 15분마다 1장씩 재생성됩니다. (최대 10장)`, 
                flags: 64 
            });
        }

        // 플레이어 추가
        session.players.set(interaction.user.id, {
            user: user,
            userId: interaction.user.id,
            userName: user.nickname || interaction.user.username,
            ready: true
        });
        
        // 점수 초기화
        session.scores.set(interaction.user.id, 0);

        // 대기실 메시지 업데이트
        await this.updateWaitingMessage(session);

        await interaction.reply({ 
            content: '✅ 게임에 참가했습니다!', 
            flags: 64 
        });

        // 자동 시작 제거 - 호스트가 수동으로 시작
    }

    // 대기실에서 게임 시작
    async startGameFromLobby(interaction, sessionId, autoStart = false) {
        // defer 처리 (interaction이 있는 경우만)
        if (interaction) {
            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ flags: 64 });
                }
            } catch (error) {
                console.error('[RPS] startGameFromLobby defer 오류:', error);
            }
        }
        
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'waiting') {
            if (interaction) {
                return interaction.editReply({ 
                    content: '❌ 시작할 수 없는 게임입니다.'
                });
            }
            return;
        }

        // 호스트 확인
        if (interaction && interaction.user.id !== session.hostId) {
            return interaction.editReply({ 
                content: '❌ 호스트만 게임을 시작할 수 있습니다.'
            });
        }
        
        // 배팅금 확인
        if (!session.betAmount) {
            return interaction.editReply({ 
                content: '❌ 배팅금을 먼저 설정해주세요.'
            });
        }
        
        // 참가자들의 골드 확인
        for (const [userId, playerData] of session.players) {
            if (playerData.user.gold < session.betAmount) {
                if (interaction) {
                    return interaction.editReply({ 
                        content: `❌ ${playerData.userName}님의 골드가 부족합니다. (필요: ${session.betAmount.toLocaleString()}G)`
                    });
                }
                return;
            }
        }

        // 현재 채널 사용 (대기실 채널)
        const gameChannel = interaction ? interaction.channel : session.waitingMessage.channel;

        // 골드 및 티켓 차감
        for (const [userId, playerData] of session.players) {
            const user = await User.findOne({ discordId: userId });
            if (user) {
                if (session.betAmount) {
                    user.gold -= session.betAmount;
                }
                user.rpsGameData.userTickets--;
                await user.save();
            }
        }

        // 게임 세션 업데이트
        session.status = 'playing';
        session.channel = gameChannel;
        session.playerChoices = new Map();
        session.roundNumber = 1;
        
        // 점수가 이미 초기화되어 있음

        // 대기실 메시지 삭제
        await session.waitingMessage.delete().catch(() => {});

        // 게임 시작 메시지
        const startEmbed = new EmbedBuilder()
            .setTitle('✊✌️✋ 가위바위보 대결!')
            .setDescription(
                `**👥 플레이어**\n` +
                Array.from(session.players.values()).map(p => `• ${p.userName}`).join('\n') +
                `\n\n🏆 **3판 2선승제**로 진행됩니다!\n\n` +
                `잠시 후 게임이 시작됩니다...`
            )
            .setColor('#4169E1');

        await gameChannel.send({
            content: Array.from(session.players.keys()).map(id => `<@${id}>`).join(' '),
            embeds: [startEmbed]
        });
        
        // 관전자 배팅은 관전자가 참여할 때 시작됨

        // 3초 후 첫 라운드 시작
        setTimeout(() => this.startRound(gameChannel, sessionId), 3000);

        if (interaction) {
            try {
                // 안전한 응답 처리
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ flags: 64 });
                }
                await interaction.editReply({ 
                    content: `🎮 게임이 시작되었습니다!`
                });
            } catch (error) {
                console.error('[RPS] 게임 시작 응답 실패:', error);
            }
        }
    }

    // 배팅금 선택 화면
    async showBetSelection(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.hostId !== interaction.user.id) {
            return interaction.reply({ 
                content: '❌ 호스트만 배팅금을 설정할 수 있습니다.', 
                flags: 64 
            });
        }
        
        const betEmbed = new EmbedBuilder()
            .setTitle('💰 배팅금 설정')
            .setDescription('게임에 참여할 배팅금을 선택하세요.')
            .setColor('#FFD700');
            
        const betButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`rps_set_bet_${sessionId}_10000`)
                    .setLabel('10,000G')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`rps_set_bet_${sessionId}_30000`)
                    .setLabel('30,000G')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`rps_set_bet_${sessionId}_50000`)
                    .setLabel('50,000G')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`rps_set_bet_${sessionId}_100000`)
                    .setLabel('100,000G')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`rps_set_bet_${sessionId}_custom`)
                    .setLabel('직접 설정')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        await interaction.reply({
            embeds: [betEmbed],
            components: [betButtons],
            flags: 64
        });
    }
    
    // 배팅금 설정
    async setBetAmount(interaction, sessionId, amount) {
        const session = this.sessions.get(sessionId);
        if (!session || session.hostId !== interaction.user.id) {
            return interaction.reply({ 
                content: '❌ 오류가 발생했습니다.', 
                flags: 64 
            });
        }
        
        if (amount === 'custom') {
            // TODO: 직접 설정 기능
            return interaction.reply({
                content: '🛠️ 직접 설정 기능은 개발 중입니다.',
                flags: 64
            });
        }
        
        const betAmount = parseInt(amount);
        session.betAmount = betAmount;
        
        await interaction.reply({
            content: `✅ 배팅금이 ${betAmount.toLocaleString()}G로 설정되었습니다.`,
            flags: 64
        });
        
        // 대기실 메시지 업데이트
        await this.updateWaitingMessage(session);
    }
    
    // 대기실 메시지 업데이트
    async updateWaitingMessage(session) {
        const playerList = Array.from(session.players.entries())
            .map(([id, data]) => `• ${data.userName || data.user?.nickname || '알 수 없음'}`)
            .join('\n');
        
        const updatedEmbed = new EmbedBuilder()
            .setTitle('✊✌️✋ 가위바위보 대기실')
            .setDescription(`**호스트**: ${session.players.get(session.hostId).userName || session.players.get(session.hostId).user?.nickname || '알 수 없음'}`)
            .addFields(
                { name: '🎮 게임', value: '가위바위보', inline: true },
                { name: '👥 현재 인원', value: `${session.players.size}/2명`, inline: true },
                { name: '💰 배팅금', value: session.betAmount ? `${session.betAmount.toLocaleString()}G` : '미설정', inline: true },
                { name: '⏰ 대기 시간', value: '최대 60초', inline: true },
                { name: '👥 참여자', value: playerList || '없음', inline: false }
            )
            .setColor('#FF6B6B')
            .setFooter({ text: '2명이 모이고 배팅금이 설정되면 시작할 수 있습니다!' });

        const gameButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`rps_bet_${session.id}`)
                    .setLabel('💰 배팅금 설정')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`rps_join_${session.id}`)
                    .setLabel('🎮 참가하기')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(session.players.size >= 2),
                new ButtonBuilder()
                    .setCustomId(`rps_start_${session.id}`)
                    .setLabel('🎯 게임 시작')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(session.players.size < 2 || !session.betAmount),
                new ButtonBuilder()
                    .setCustomId(`rps_spectate_${session.id}`)
                    .setLabel('👁️ 관전자로 참여')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('rps_leave_match')
                    .setLabel('🚪 나가기')
                    .setStyle(ButtonStyle.Danger)
            );

        await session.waitingMessage.edit({
            embeds: [updatedEmbed],
            components: [gameButtons]
        });
    }
    
    // 상세 통계
    async showStats(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const data = user.rpsGameData || {};
        const totalGames = (data.wins || 0) + (data.draws || 0) + (data.losses || 0);
        const profit = (data.totalGoldWon || 0) - (data.totalGoldBet || 0);

        const statsEmbed = new EmbedBuilder()
            .setTitle('📊 가위바위보 상세 통계')
            .setDescription(`${user.nickname || interaction.user.username}님의 기록`)
            .addFields(
                { name: '🎮 총 게임 수', value: `${totalGames}회`, inline: true },
                { name: '🏆 승리', value: `${data.wins || 0}회`, inline: true },
                { name: '🤝 무승부', value: `${data.draws || 0}회`, inline: true },
                { name: '😢 패배', value: `${data.losses || 0}회`, inline: true },
                { name: '📊 승률', value: `${this.calculateWinRate(user)}%`, inline: true },
                { name: '🔥 최고 연승', value: `${data.bestStreak || 0}회`, inline: true },
                { name: '💸 총 베팅', value: `${(data.totalGoldBet || 0).toLocaleString()}G`, inline: true },
                { name: '💰 총 획득', value: `${(data.totalGoldWon || 0).toLocaleString()}G`, inline: true },
                { name: '📈 순수익', value: `${profit.toLocaleString()}G`, inline: true }
            )
            .setColor('#9370DB')
            .setTimestamp();

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rps_main')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [statsEmbed],
            components: [backButton]
        });
    }
}

// 싱글톤 인스턴스
const rpsGame = new RockPaperScissorsSystem();

// 인터랙션 핸들러
async function handleRPSInteraction(interaction) {
    const customId = interaction.customId;

    // 메인 메뉴
    if (customId === 'rock_paper_scissors' || customId === 'rps_main') {
        return await rpsGame.showMainMenu(interaction);
    }
    
    // 봇 대전
    else if (customId === 'rps_bot') {
        return await rpsGame.startBotGame(interaction);
    }
    
    // 봇 대전 선택
    else if (customId.startsWith('rps_bot_')) {
        const choice = customId.replace('rps_bot_', '');
        const userChoice = choice === 'rock' ? '✊' : choice === 'scissors' ? '✌️' : '✋';
        return await rpsGame.processBotGame(interaction, userChoice);
    }
    
    // 유저 대전
    else if (customId === 'rps_user') {
        return await rpsGame.startUserMatching(interaction);
    }
    
    // 매칭 취소
    else if (customId === 'rps_cancel_match') {
        rpsGame.matchQueue.delete(interaction.user.id);
        
        // 대기실 채널에서 왔으므로 reply 사용
        await interaction.reply({
            content: '❌ 매칭이 취소되었습니다.',
            flags: 64
        });
    }
    
    // 멀티플레이어 선택
    else if (customId.startsWith('rps_multi_choice_')) {
        // customId 형식: rps_multi_choice_{sessionId}_{choice}
        const parts = customId.split('_');
        // sessionId는 마지막에서 두번째까지 (타임스탬프 포함)
        const choice = parts[parts.length - 1]; // 마지막 요소가 choice
        const sessionId = parts.slice(3, -1).join('_'); // rps_multi_choice_ 다음부터 choice 전까지
        const userChoice = choice === 'rock' ? '✊' : choice === 'scissors' ? '✌️' : '✋';
        
        const session = rpsGame.sessions.get(sessionId);
        if (!session) {
            return interaction.reply({ content: '❌ 게임 세션을 찾을 수 없습니다.', flags: 64 });
        }
        
        if (session.playerChoices.has(interaction.user.id)) {
            return interaction.reply({ content: '이미 선택했습니다!', flags: 64 });
        }
        
        session.playerChoices.set(interaction.user.id, userChoice);
        await interaction.reply({ 
            content: `${userChoice} ${RPS_GAME.choiceNames[userChoice]}을(를) 선택했습니다!`, 
            flags: 64 
        });
        
        // 모든 플레이어가 선택했는지 확인
        if (session.playerChoices.size >= session.players.size) {
            if (session.roundTimer) {
                clearTimeout(session.roundTimer);
            }
            await rpsGame.processRoundEnd(interaction.channel, sessionId);
        }
    }
    
    // 베팅 모드
    else if (customId === 'rps_betting') {
        return await rpsGame.showBettingMode(interaction);
    }
    
    // 베팅 금액 선택 (숫자로만 이루어진 경우)
    else if (customId.startsWith('rps_bet_') && /^rps_bet_\d+$/.test(customId)) {
        const betAmount = parseInt(customId.replace('rps_bet_', ''));
        return await rpsGame.executeBettingGame(interaction, betAmount);
    }
    
    // 베팅 게임 선택
    else if (customId.startsWith('rps_betting_')) {
        const parts = customId.split('_');
        const choice = parts[2];
        const betAmount = parseInt(parts[3]);
        const userChoice = choice === 'rock' ? '✊' : choice === 'scissors' ? '✌️' : '✋';
        return await rpsGame.processBettingResult(interaction, userChoice, betAmount);
    }
    
    // 통계
    else if (customId === 'rps_stats') {
        return await rpsGame.showStats(interaction);
    }
    
    // 게임 참가
    else if (customId.startsWith('rps_join_')) {
        const sessionId = customId.replace('rps_join_', '');
        return await rpsGame.joinGame(interaction, sessionId);
    }
    
    // 게임 시작
    else if (customId.startsWith('rps_start_')) {
        const sessionId = customId.replace('rps_start_', '');
        return await rpsGame.startGameFromLobby(interaction, sessionId);
    }
    
    // 채널 즉시 닫기
    else if (customId === 'rps_close_channel') {
        const channel = interaction.channel;
        try {
            if (channel && !channel.deleted && channel.deletable) {
                await interaction.reply({ content: '채널을 닫는 중...', flags: 64 });
                setTimeout(async () => {
                    try {
                        if (!channel.deleted) {
                            await channel.delete('게임 종료');
                        }
                    } catch (error) {
                        console.error('채널 삭제 오류:', error);
                    }
                }, 1000);
            } else {
                await interaction.reply({ content: '❌ 채널을 닫을 수 없습니다.', flags: 64 });
            }
        } catch (error) {
            console.error('rps_close_channel 오류:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ 오류가 발생했습니다.', flags: 64 });
            }
        }
    }
    
    // 배팅금 설정 (세션ID가 포함된 경우)
    else if (customId.startsWith('rps_bet_') && !(/^rps_bet_\d+$/.test(customId))) {
        const sessionId = customId.replace('rps_bet_', '');
        return await rpsGame.showBetSelection(interaction, sessionId);
    }
    
    // 배팅금 선택
    else if (customId.startsWith('rps_set_bet_')) {
        const parts = customId.split('_');
        const sessionId = parts.slice(3, -1).join('_');
        const amount = parts[parts.length - 1];
        return await rpsGame.setBetAmount(interaction, sessionId, amount);
    }
    
    // 관전자로 참여
    else if (customId.startsWith('rps_spectate_')) {
        const { handleSpectatorInteraction } = require('../../systems/spectatorBettingHandler');
        const sessionId = customId.replace('rps_spectate_', '');
        const session = rpsGame.sessions.get(sessionId);
        
        if (!session) {
            return interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', flags: 64 });
        }
        
        return await handleSpectatorInteraction(interaction, 'pvp', session);
    }
    
    // 관전자 베팅 처리
    else if (customId.startsWith('spectator_bet_') || customId.startsWith('spectator_confirm_')) {
        const { handleSpectatorInteraction } = require('../../systems/spectatorBettingHandler');
        const gameId = customId.split('_')[2] || customId.split('_')[3];
        const session = rpsGame.sessions.get(gameId);
        
        if (!session) {
            return interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', flags: 64 });
        }
        
        return await handleSpectatorInteraction(interaction, 'pvp', session);
    }
}

module.exports = {
    handleRPSInteraction,
    rpsGame,
    RPS_GAME
};