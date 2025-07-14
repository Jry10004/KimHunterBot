const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const MUSHROOM_GAME = require('../../data/mushroomGame');
const { mushroomItemSystem, reactionSystem, tournamentSystem, achievementSystem } = require('../../data/mushroomGameEnhanced');
const { gameHelpers, improvedBotBattle, createImprovedMushroomButtons, improvedMultiplayerRound, animateBotChoice, showMultiplayerResults, createGameStartEmbed, createMinigameChannel } = require('../../data/mushroomGameImproved');
const spectatorBetting = require('../../data/spectatorBetting');
const { applyMinigameBonus } = require('../common/specialEffects');
const channelCleanup = require('../../systems/channelCleanup');
const MissionHelper = require('../../utils/missionHelper');
const MinigameUI = require('../../utils/minigameUI');
const TicketManager = require('../../utils/ticketManager');

// 전역 변수들
const mushroomGameSessions = new Map();
const mushroomMatchmakingQueue = new Map();
const mushroomMultiplayerSessions = new Map();
const mushroomTempChannels = new Map();

// 매치메이킹 시스템
const matchmakingSystem = {
    intervals: new Map(),
    
    startPeriodicCheck(userId, interaction, user) {
        // 2초마다 매칭 체크
        const interval = setInterval(async () => {
            const waitingPlayer = Array.from(mushroomMatchmakingQueue.entries())
                .find(([id, data]) => id !== userId && data.difficulty === 'pvp');
                
            if (waitingPlayer) {
                clearInterval(interval);
                this.intervals.delete(userId);
                
                const [opponentId, opponentData] = waitingPlayer;
                mushroomMatchmakingQueue.delete(userId);
                mushroomMatchmakingQueue.delete(opponentId);
                
                // PvP 게임 시작
                const mushroomGame = new MushroomGameSystem();
                await mushroomGame.createPvPSession(interaction, user, opponentId, opponentData.user);
            }
        }, 2000);
        
        this.intervals.set(userId, interval);
    },
    
    stopPeriodicCheck(userId) {
        if (this.intervals.has(userId)) {
            clearInterval(this.intervals.get(userId));
            this.intervals.delete(userId);
        }
    }
};

// 🍄 독버섯 게임 시스템
class MushroomGameSystem {
    constructor() {
        this.sessions = mushroomGameSessions;
    }

    // 게임 시작
    async startGame(interaction, user, difficulty) {
        const userId = interaction.user.id;
        
        // 이미 진행 중인 게임이나 매칭 중인지 확인
        if (this.sessions.has(userId) || mushroomMatchmakingQueue.has(userId)) {
            // interaction이 이미 defer되었으므로 editReply 사용
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ 
                    content: '이미 진행 중인 게임이나 매칭이 있습니다!'
                });
            } else {
                await interaction.reply({ 
                    content: '이미 진행 중인 게임이나 매칭이 있습니다!', 
                    flags: 64 
                });
            }
            return;
        }

        // 티켓 확인 및 사용
        const ticketResult = await TicketManager.useTicket(interaction.user.id, 'minigame');
        if (!ticketResult.success) {
            const ticketInfo = await TicketManager.getTicketInfo(interaction.user.id);
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply({
                    content: `❌ ${ticketResult.error}\n🎟️ 남은 미니게임 티켓: ${ticketInfo.minigame}장\n⏱️ 티켓은 5분마다 1장씩 충전됩니다.`
                });
            } else {
                return interaction.reply({
                    content: `❌ ${ticketResult.error}\n🎟️ 남은 미니게임 티켓: ${ticketInfo.minigame}장\n⏱️ 티켓은 5분마다 1장씩 충전됩니다.`,
                    flags: 64
                });
            }
        }
        
        // 티켓이 차감된 최신 user 객체로 업데이트
        user = ticketResult.user;

        if (difficulty === 'pvp') {
            // 유저와 대결: 멀티플레이어 대기실로 이동
            await this.createMultiplayerLobby(interaction, user);
        } else {
            // 혼자 플레이 또는 봇과 대결: 바로 게임 시작
            await this.createGameSession(interaction, user, difficulty);
        }
    }

    // 멀티플레이어 로비 생성 (임시 채널)
    async createMultiplayerLobby(interaction, user) {
        const userId = interaction.user.id;
        
        try {
            // 게임 카테고리 찾기 또는 생성
            const guild = interaction.guild;
            let gameCategory = guild.channels.cache.find(
                c => c.name === '🎮 미니게임' && c.type === 4 // 4 = GUILD_CATEGORY
            );
            
            if (!gameCategory) {
                gameCategory = await guild.channels.create({
                    name: '🎮 미니게임',
                    type: 4,
                    position: 99,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            allow: ['ViewChannel'], // 모든 사람이 카테고리를 볼 수 있음
                        }
                    ]
                });
            }
            
            // 통합 채널 생성 함수 사용
            const players = [{ id: userId, name: user.nickname || interaction.user.username }];
            const tempChannel = await createMinigameChannel(
                guild,
                '독버섯',
                user.nickname || interaction.user.username,
                players,
                true // 관전 가능하도록 변경
            );
            
            // 채널 생성 실패 체크
            if (!tempChannel) {
                await interaction.editReply({
                    content: '❌ 게임 채널 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
                    embeds: [],
                    components: []
                });
                return;
            }
            
            // 게임 세션 ID 생성
            const gameId = `mushroom_multi_${Date.now()}`;
            const lobbyId = gameId; // lobbyId와 gameId 동일하게 사용
            
            // 멀티플레이어 세션 생성
            const session = {
                gameId: gameId,
                lobbyId: lobbyId,
                hostId: userId,
                hostName: user.nickname || interaction.user.username,
                players: new Map([[userId, {
                    userId: userId,
                    userName: user.nickname || interaction.user.username,
                    ready: true,
                    isHost: true,
                    totalReward: 0,
                    survivedRounds: 0,
                    isAlive: true,
                    shields: 0,  // 보호막 개수
                    items: [],   // 보유 아이템 배열
                    streak: 0    // 연승 카운트
                }]]),
                gameStarted: false,
                currentRound: 0,
                totalPot: 0,
                tempChannel: tempChannel,
                tempChannelId: tempChannel.id, // 채널 정리 시스템을 위해 추가
                playerChoices: new Map(),
                itemsUsedThisRound: new Map(),
                mushroomType: 'slime', // 기본 버섯 타입 설정
                multiplayer: true,
                roundLimitRemoved: false, // 라운드 제한 해제 여부
                spectators: new Map() // 관전자 목록 추가
            };
            
            // 세션을 여러 곳에 저장
            this.sessions.set(gameId, session);
            this.sessions.set(userId, session);
            mushroomMultiplayerSessions.set(gameId, session); // 멀티플레이어 세션 맵에도 저장
            
            console.log(`🍄 멀티플레이어 세션 생성 - gameId: ${gameId}, lobbyId: ${lobbyId}`);
            
            // 임시 채널 정보 저장
            mushroomTempChannels.set(gameId, {
                channelId: tempChannel.id,
                hostId: userId,
                players: [userId],
                createdAt: Date.now()
            });
            
            // 채널 정리 시스템에 등록
            channelCleanup.registerChannel(tempChannel, '독버섯', user.nickname || interaction.user.username);
            
            // 세션에 대기실 메시지 저장 위치 추가
            session.originalChannelId = interaction.channel.id;
            session.betAmount = null; // 배팅금 추가
            
            // 게임 대기실 임베드
            const sessionPlayers = Array.from(session.players.values());
            const lobbyEmbed = MinigameUI.createLobbyEmbed(
                '독버섯 게임',
                '🍄',
                user.nickname || interaction.user.username,
                sessionPlayers,
                {
                    betAmount: 0,
                    minPlayers: 2,
                    maxPlayers: 4
                }
            );
            
            // 참여자 및 관전자 목록 필드 추가
            const spectatorsList = session.spectators ? Array.from(session.spectators.values()).map(s => `👁️ ${s.userName}`).join('\n') : '없음';
            
            lobbyEmbed.addFields(
                {
                    name: '👥 참여자 목록',
                    value: sessionPlayers.map(p => `• ${p.userName}`).join('\n') || '• 없음',
                    inline: true
                },
                {
                    name: '👁️ 관전자 목록', 
                    value: spectatorsList || '• 없음',
                    inline: true
                }
            );
            
            lobbyEmbed.setFooter({ text: '2명 이상이 모이고 배팅금이 설정되면 시작할 수 있습니다!' });
            
            // 게임 버튼들
            const gameButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mushroom_bet_${gameId}`)
                        .setLabel('💰 배팅금 설정')
                        .setStyle(MinigameUI.ButtonStyles.NAVIGATION),
                    new ButtonBuilder()
                        .setCustomId(`mushroom_join_${gameId}`)
                        .setLabel('🎮 참가하기')
                        .setStyle(MinigameUI.ButtonStyles.POSITIVE),
                    new ButtonBuilder()
                        .setCustomId(`mushroom_spectate_${gameId}`)
                        .setLabel('👁️ 관전자로 참여')
                        .setStyle(MinigameUI.ButtonStyles.NAVIGATION),
                    new ButtonBuilder()
                        .setCustomId(`mushroom_start_multi_${gameId}`)
                        .setLabel('🎯 게임 시작')
                        .setStyle(MinigameUI.ButtonStyles.MAIN_ACTION)
                        .setDisabled(true), // 2명 + 배팅금 설정 후 활성화
                    new ButtonBuilder()
                        .setCustomId(`mushroom_leave_${gameId}`)
                        .setLabel('🚪 나가기')
                        .setStyle(MinigameUI.ButtonStyles.NEGATIVE)
                );
            
            // 원래 채널에 응답
            await interaction.editReply({
                content: `🍄 독버섯 게임 방이 생성되었습니다!\n<#${tempChannel.id}>로 이동하세요!`,
                embeds: [],
                components: []
            });
            
            // 임시 채널에 메시지 전송 및 저장
            const waitingMessage = await tempChannel.send({
                embeds: [lobbyEmbed],
                components: [gameButtons]
            });
            
            // 세션에 대기실 메시지 저장
            session.waitingMessage = waitingMessage;
            
            // 30분 후 자동 삭제
            setTimeout(async () => {
                if (mushroomTempChannels.has(gameId)) {
                    try {
                        await channelCleanup.safeDeleteChannel(tempChannel, '게임 시간 초과');
                        mushroomTempChannels.delete(gameId);
                        mushroomGameSessions.delete(gameId);
                    } catch (error) {
                        console.error('임시 채널 삭제 실패:', error);
                    }
                }
            }, 30 * 60 * 1000); // 30분
            
        } catch (error) {
            console.error('멀티플레이어 로비 생성 오류:', error);
            await interaction.editReply({
                content: '❌ 게임 방 생성 중 오류가 발생했습니다!',
                embeds: [],
                components: []
            });
        }
    }
    
    // 매칭 시스템 (개선된 버전)
    async startMatchmaking(interaction, user) {
        const userId = interaction.user.id;
        
        // 즉시 매칭 가능한 플레이어 확인
        const waitingPlayer = Array.from(mushroomMatchmakingQueue.entries())
            .find(([id, data]) => id !== userId && data.difficulty === 'pvp');

        if (waitingPlayer) {
            // 즉시 매칭 성공
            console.log(`[매치메이킹] 즉시 매칭 성공: ${userId} <-> ${waitingPlayer[0]}`);
            const [opponentId, opponentData] = waitingPlayer;
            mushroomMatchmakingQueue.delete(opponentId);
            
            // 주기적 체크 중지
            matchmakingSystem.stopPeriodicCheck(opponentId);

            // PvP 게임 세션 생성
            await this.createPvPSession(interaction, user, opponentId, opponentData.user);
        } else {
            // 매칭 대기열에 추가
            mushroomMatchmakingQueue.set(userId, {
                timestamp: Date.now(),
                difficulty: 'pvp',
                user: user,
                interaction: interaction
            });

            const queueSize = Array.from(mushroomMatchmakingQueue.values())
                .filter(data => data.difficulty === 'pvp').length;

            const waitingEmbed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('🔍 상대방을 찾고 있습니다...')
                .setDescription(`${user.nickname || interaction.user.username}님, 다른 플레이어를 찾고 있습니다!\n\n👥 대기 중인 플레이어: **${queueSize}명**\n⏱️ 남은 시간: **30초**\n\n30초 후 봇과 대결로 자동 전환됩니다.`)
                .setFooter({ text: '2초마다 자동으로 매칭을 확인합니다!' })
                .setThumbnail(`attachment://${MUSHROOM_GAME.effects.thinking}`);

            const cancelButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mushroom_cancel_${userId}`)
                        .setLabel('❌ 매칭 취소')
                        .setStyle(ButtonStyle.Danger)
                );

            const thinkingAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.thinking}`);

            await interaction.reply({
                embeds: [waitingEmbed],
                components: [cancelButton],
                files: [thinkingAttachment]
            });

            // 주기적 매칭 체크 시작
            matchmakingSystem.startPeriodicCheck(userId, interaction, user);

            // 30초 후 봇 매칭으로 전환
            setTimeout(async () => {
                if (mushroomMatchmakingQueue.has(userId)) {
                    mushroomMatchmakingQueue.delete(userId);
                    matchmakingSystem.stopPeriodicCheck(userId);
                    
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#ff9900')
                        .setTitle('⏰ 매칭 시간 초과')
                        .setDescription('상대방을 찾지 못해 봇과 대결로 전환됩니다!');

                    try {
                        await interaction.editReply({
                            embeds: [timeoutEmbed],
                            components: []
                        });
                    } catch (error) {
                        console.error('[매치메이킹] 타임아웃 메시지 편집 실패:', error);
                    }

                    // 1초 후 봇 게임 시작
                    setTimeout(async () => {
                        await this.createGameSession(interaction, user, 'bot', true);
                    }, 1000);
                }
            }, MUSHROOM_GAME.gameSettings.matchmakingTimeout);
        }
    }

    // PvP 게임 세션 생성
    async createPvPSession(interaction1, user1, user2Id, user2) {
        const sessionId = `pvp_${user1.discordId}_${user2Id}`;
        
        const session = {
            sessionId: sessionId,
            type: 'pvp',
            players: {
                [user1.discordId]: {
                    userId: user1.discordId,
                    userName: user1.nickname,
                    isAlive: true,
                    survivedRounds: 0,
                    totalReward: 0,
                    lastChoice: null,
                    interaction: interaction1
                },
                [user2Id]: {
                    userId: user2Id,
                    userName: user2.nickname,
                    isAlive: true,
                    survivedRounds: 0,
                    totalReward: 0,
                    lastChoice: null,
                    interaction: mushroomMatchmakingQueue.get(user2Id)?.interaction
                }
            },
            currentRound: 1,
            startTime: Date.now(),
            currentMushrooms: [],
            waitingForChoices: new Set([user1.discordId, user2Id])
        };

        this.sessions.set(user1.discordId, session);
        this.sessions.set(user2Id, session);

        // 매칭 성공 알림
        const matchEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('⚔️ 매칭 성공!')
            .setDescription(`**${user1.nickname}** VS **${user2.nickname}**\n\n버섯 사냥 대결이 시작됩니다!\n\n⚡ 동시에 버섯을 선택하여 대결하세요!`)
            .addFields(
                { name: '🎮 게임 방식', value: '두 플레이어가 동시에 버섯을 선택합니다', inline: false },
                { name: '💀 독버섯', value: '독버섯을 먹으면 즉시 탈락!', inline: true },
                { name: '🍄 일반 버섯', value: '안전하게 다음 라운드로', inline: true }
            )
            .setFooter({ text: '준비되면 아래 버튼을 눌러주세요!' });

        const startButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`mushroom_pvp_start_${sessionId}`)
                    .setLabel('🍄 대결 시작!')
                    .setStyle(ButtonStyle.Primary)
            );

        // 플레이어 1에게 알림
        try {
            await interaction1.editReply({
                embeds: [matchEmbed],
                components: [startButton],
                files: []
            });
        } catch (error) {
            console.error('[매치메이킹] 플레이어1 알림 실패:', error);
        }

        // 플레이어 2에게 알림
        const interaction2 = session.players[user2Id].interaction;
        if (interaction2) {
            try {
                await interaction2.editReply({
                    embeds: [matchEmbed],
                    components: [startButton],
                    files: []
                });
            } catch (error) {
                console.error('[매치메이킹] 플레이어2 알림 실패:', error);
                // 실패 시 DM으로 시도
                try {
                    const opponent = await interaction1.client.users.fetch(user2Id);
                    await opponent.send({
                        embeds: [matchEmbed],
                        components: [startButton]
                    });
                } catch (dmError) {
                    console.error('[매치메이킹] DM 전송도 실패:', dmError);
                }
            }
        }

        console.log(`[매치메이킹] PvP 세션 생성 완료: ${sessionId}`);
    }

    // 게임 세션 생성 (솔로/봇)
    async createGameSession(interaction, user, difficulty, isTimeout = false) {
        const userId = interaction.user.id;
        const gameId = Date.now().toString();

        const session = {
            gameId: gameId,
            userId: userId,
            userName: user.nickname,
            difficulty: difficulty,
            currentRound: 1,
            survivedRounds: 0,
            isAlive: true,
            totalReward: 0,
            startTime: Date.now(),
            bot: difficulty === 'bot' ? this.selectBot() : null,
            botAlive: difficulty === 'bot',
            currentMushrooms: [],
            multiplayer: false,  // 싱글플레이어 표시
            hasShield: false,  // 방어권 보유 여부
            shieldUsed: false,  // 방어권 사용 여부
            roundLimitRemoved: false  // 라운드 제한 해제 여부
        };

        this.sessions.set(gameId, session);
        // userId로도 찾을 수 있도록 매핑 추가
        this.sessions.set(userId, session);

        // 게임 시작 화면 표시
        const startEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(MUSHROOM_GAME.messages.gameStart)
            .setDescription(`${user.nickname || user.username || '플레이어'}님의 버섯 사냥이 시작됩니다!\n\n모드: ${this.getDifficultyName(difficulty)}`)
            .setImage(`attachment://${MUSHROOM_GAME.backgrounds.gameStart}`)
            .setThumbnail(`attachment://${MUSHROOM_GAME.effects.gameStart}`);

        const startButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`mushroom_start_${gameId}`)
                    .setLabel('🍄 탐험 시작!')
                    .setStyle(ButtonStyle.Primary)
            );

        const gameStartAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.backgrounds.gameStart}`);
        const effectAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.gameStart}`);

        // interaction 상태에 따라 적절한 응답 방식 선택
        if (interaction.deferred || interaction.replied || isTimeout) {
            await interaction.editReply({
                embeds: [startEmbed],
                components: [startButton],
                files: [gameStartAttachment, effectAttachment]
            });
        } else {
            await interaction.reply({
                embeds: [startEmbed],
                components: [startButton],
                files: [gameStartAttachment, effectAttachment]
            });
        }
    }

    // 난이도 이름 반환
    getDifficultyName(difficulty) {
        const names = {
            solo: '🌱 혼자 플레이',
            pvp: '⚔️ 유저와 대결',
            bot: '🤖 봇과 대결'
        };
        return names[difficulty] || names.solo;
    }

    // 봇 선택
    selectBot() {
        const botTypes = Object.keys(MUSHROOM_GAME.botCharacters);
        const randomBot = botTypes[Math.floor(Math.random() * botTypes.length)];
        return {
            type: randomBot,
            ...MUSHROOM_GAME.botCharacters[randomBot],
            choiceIndex: 0
        };
    }

    // 라운드 시작
    async startRound(interaction, userId) {
        const session = this.sessions.get(userId);
        if (!session) return;

        const roundInfo = MUSHROOM_GAME.difficultyByRound[session.currentRound];
        
        // 버섯 배치 생성 (12개 중 독버섯 개수만큼 랜덤 배치)
        const mushrooms = this.generateMushrooms(roundInfo.poisonCount);
        session.mushrooms = mushrooms.map((m, index) => ({
            ...m,
            revealed: false,
            selectedBy: null
        }));
        session.round = session.currentRound;
        session.earnings = session.totalReward;
        session.mushroomType = 'normal'; // 기본 버섯 타입
        session.currentMushrooms = session.mushrooms; // 현재 버섯 저장

        // 개선된 봇 대전 UI 사용
        if (session.difficulty === 'bot' && session.bot) {
            const botBattleUI = await improvedBotBattle(interaction, session, session.gameId);
            await interaction.update(botBattleUI);
            
            // 봇 선택 처리
            if (session.botAlive) {
                setTimeout(() => this.processBotChoice(interaction, userId), MUSHROOM_GAME.gameSettings.botThinkingTime);
            }
        } else {
            // 싱글플레이어용 기본 UI
            const roundEmbed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle(`🍄 라운드 ${session.currentRound}`)
                .setDescription(`${roundInfo.message}\n\n${MUSHROOM_GAME.messages.selectPrompt}`)
                .setImage(`attachment://${MUSHROOM_GAME.backgrounds.mushroomSelect}`)
                .setFooter({ text: `생존 라운드: ${session.survivedRounds} | 획득 골드: ${session.totalReward}G` });

            // 개선된 버튼 시스템 사용 - 매 라운드마다 새로 생성
            const buttons = createImprovedMushroomButtons(session.gameId, session.mushrooms, 'player');
            
            // 버튼이 정확히 3줄 (12개)인지 확인
            if (buttons.length !== 3) {
                console.error(`[독버섯] 버튼 수 오류 - 예상: 3줄, 실제: ${buttons.length}줄`);
            }

            const backgroundAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.backgrounds.mushroomSelect}`);

            await interaction.update({
                embeds: [roundEmbed],
                components: buttons,
                files: [backgroundAttachment]
            });
        }
    }

    // 버섯 생성 (12개)
    generateMushrooms(poisonCount) {
        const mushrooms = [];
        const types = Object.keys(MUSHROOM_GAME.mushroomTypes);
        const mushroomCount = 12; // 12개로 고정
        
        // 12개 위치 중 독버섯 위치 선택
        const poisonPositions = new Set();
        while (poisonPositions.size < poisonCount) {
            poisonPositions.add(Math.floor(Math.random() * mushroomCount));
        }

        // 특수 버섯 위치 선택 (황금, 미스터리)
        const specialPositions = new Set();
        const specialChance = 0.1; // 10% 확률
        for (let i = 0; i < mushroomCount; i++) {
            if (!poisonPositions.has(i) && Math.random() < specialChance) {
                specialPositions.add(i);
            }
        }

        // 버섯 배치
        for (let i = 0; i < mushroomCount; i++) {
            let mushroomType;
            
            if (specialPositions.has(i)) {
                // 특수 버섯 중 하나 선택
                mushroomType = Math.random() < 0.7 ? 'golden' : 'mystery';
            } else {
                // 일반 버섯 중 하나 선택
                const normalTypes = types.filter(t => !['golden', 'mystery'].includes(t));
                mushroomType = normalTypes[Math.floor(Math.random() * normalTypes.length)];
            }
            
            mushrooms.push({
                type: mushroomType,
                isPoisonous: poisonPositions.has(i),
                position: i + 1,
                isSpecial: specialPositions.has(i)
            });
        }

        return mushrooms;
    }

    // 버섯 선택 처리
    async processMushroomSelection(interaction, userId, position) {
        // 즉시 defer 처리
        await interaction.deferUpdate().catch(() => {});
        
        const session = this.sessions.get(userId);
        if (!session || !session.isAlive) return;
        
        // position은 0부터 시작하는 인덱스로 전달됨
        const selectedMushroom = session.mushrooms[position];
        const mushroomType = MUSHROOM_GAME.mushroomTypes[selectedMushroom.type];

        let resultEmbed;
        let resultAttachment;
        let effectAttachment;

        if (selectedMushroom.isPoisonous) {
            // 독버섯 선택
            if (session.hasShield && !session.shieldUsed) {
                // 방어권이 있고 아직 사용하지 않은 경우
                session.shieldUsed = true;
                session.roundLimitRemoved = true; // 라운드 제한 해제
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🛡️ 방어권 발동!')
                    .setDescription(
                        `${mushroomType.emoji} **${mushroomType.name}**\n\n` +
                        `독버섯을 선택했지만 방어권이 당신을 보호했습니다!\n\n` +
                        `⚡ **특별 효과**: 라운드 제한이 해제되었습니다!\n` +
                        `이제 5라운드를 넘어서도 계속 도전할 수 있습니다!`
                    )
                    .setImage(`attachment://${mushroomType.poisonGif}`)
                    .setThumbnail(`attachment://shield_effect.gif`)
                    .addFields(
                        { name: '🛡️ 방어권', value: '사용됨', inline: true },
                        { name: '🎯 현재 라운드', value: `${session.currentRound}`, inline: true },
                        { name: '♾️ 라운드 제한', value: '해제됨', inline: true }
                    );

                resultAttachment = new AttachmentBuilder(`resource/${mushroomType.poisonGif}`);
                effectAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.safeSparkle}`); // shield_effect.gif가 없으면 기본 이펙트 사용
                
                // 다음 라운드로 진행
                session.currentRound++;
            } else {
                // 방어권이 없거나 이미 사용한 경우
                session.isAlive = false;
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle(MUSHROOM_GAME.messages.poisonSelected)
                    .setDescription(`${mushroomType.emoji} **${mushroomType.name}**\n\n${mushroomType.poisonDesc}`)
                    .setImage(`attachment://${mushroomType.poisonGif}`)
                    .setThumbnail(`attachment://${MUSHROOM_GAME.effects.poisonDeath}`)
                    .addFields(
                        { name: '🏆 최종 성과', value: `생존 라운드: ${session.survivedRounds}\n획득 골드: ${session.totalReward}G`, inline: true }
                    );

                resultAttachment = new AttachmentBuilder(`resource/${mushroomType.poisonGif}`);
                effectAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.poisonDeath}`);
            }
        } else {
            // 안전한 버섯 선택
            session.survivedRounds++;
            let roundReward = MUSHROOM_GAME.gameSettings.baseReward + (session.currentRound - 1) * MUSHROOM_GAME.gameSettings.survivalBonus;
            
            // 특수 버섯 효과 적용
            let specialMessage = '';
            if (selectedMushroom.isSpecial) {
                if (selectedMushroom.type === 'golden') {
                    const goldenBonus = 2000;
                    roundReward += goldenBonus;
                    specialMessage = `\n\n✨ **황금버섯 보너스!** +${goldenBonus}G`;
                } else if (selectedMushroom.type === 'mystery') {
                    // 미스터리 버섯 효과 (15% 확률로 방어권 획득)
                    const mysteryRoll = Math.random();
                    if (mysteryRoll < 0.15 && !session.hasShield) {
                        session.hasShield = true;
                        specialMessage = `\n\n🛡️ **미스터리 효과!** 방어권을 획득했습니다!\n독버섯을 선택해도 한 번 보호받고 라운드 제한이 해제됩니다!`;
                    } else {
                        const mysteryBonus = Math.floor(Math.random() * 3000) + 500;
                        roundReward += mysteryBonus;
                        specialMessage = `\n\n❓ **미스터리 보너스!** +${mysteryBonus}G`;
                    }
                }
            }
            
            session.totalReward += roundReward;

            resultEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(MUSHROOM_GAME.messages.safeSelected)
                .setDescription(`${mushroomType.emoji} **${mushroomType.name}**\n\n${mushroomType.safeDesc}${specialMessage}`)
                .setImage(`attachment://${mushroomType.safeGif}`)
                .setThumbnail(`attachment://${MUSHROOM_GAME.effects.safeSparkle}`)
                .addFields(
                    { name: '💰 획득 골드', value: `+${roundReward}G`, inline: true },
                    { name: '📊 현재 상태', value: `라운드 ${session.currentRound} 통과!`, inline: true },
                    session.hasShield ? { name: '🛡️ 보유 아이템', value: '방어권 보유중', inline: true } : { name: '⚡ 라운드', value: session.roundLimitRemoved ? '무제한' : `${session.currentRound}/${MUSHROOM_GAME.gameSettings.maxRounds}`, inline: true }
                );

            resultAttachment = new AttachmentBuilder(`resource/${mushroomType.safeGif}`);
            effectAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.safeSparkle}`);
        }

        // 다음 액션 버튼
        const nextActions = new ActionRowBuilder();
        
        if (session.isAlive && session.currentRound < MUSHROOM_GAME.gameSettings.maxRounds) {
            session.currentRound++;
            nextActions.addComponents(
                new ButtonBuilder()
                    .setCustomId(`mushroom_continue_${session.gameId}`)
                    .setLabel('🍄 다음 라운드')
                    .setStyle(ButtonStyle.Primary)
            );
        }

        nextActions.addComponents(
            new ButtonBuilder()
                .setCustomId(`mushroom_end_${session.gameId}`)
                .setLabel('🏁 게임 종료')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            embeds: [resultEmbed],
            components: [nextActions],
            files: [resultAttachment, effectAttachment]
        });

        // 게임 완료 체크 (방어권 사용 시 라운드 제한 해제)
        const maxRounds = session.roundLimitRemoved ? Infinity : MUSHROOM_GAME.gameSettings.maxRounds;
        if (session.isAlive && session.currentRound > maxRounds) {
            await this.completeGame(interaction, userId, true);
        } else if (!session.isAlive) {
            // 패배 시에도 버튼 표시
            await this.saveGameResult(userId);
            
            // 게임 종료 후 버튼 추가
            const endButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('mushroom_play_again')
                        .setLabel('🍄 한판 더하기')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('game_main_menu')
                        .setLabel('🏠 메인 메뉴로')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            // 잠시 후 버튼 표시
            setTimeout(async () => {
                await interaction.editReply({
                    components: [endButtons]
                });
            }, 1000);
        }
    }

    // 봇 선택 처리
    async processBotChoice(interaction, userId) {
        const session = this.sessions.get(userId);
        if (!session || !session.bot || !session.botAlive) return;

        let choice;
        const bot = session.bot;

        switch (bot.strategy) {
            case 'sequential':
                choice = bot.pattern[bot.choiceIndex % bot.pattern.length];
                bot.choiceIndex++;
                break;
            case 'random':
                choice = Math.floor(Math.random() * 6) + 1;
                break;
            case 'safe_guess':
                // 통계적으로 가장 안전한 위치 선택 (중간 번호 선호)
                choice = [3, 4, 2, 5, 1, 6][Math.floor(Math.random() * 6)];
                break;
            case 'dangerous_guess':
                // 극단적인 번호 선호
                choice = [1, 6, 1, 6, 2, 5][Math.floor(Math.random() * 6)];
                break;
            default:
                choice = Math.floor(Math.random() * 6) + 1;
        }

        const selectedMushroom = session.mushrooms[choice - 1];
        
        if (selectedMushroom.isPoisonous) {
            session.botAlive = false;
        }

        // 봇 선택 결과 표시 (현재 embed에 추가)
        const channel = interaction.channel;
        await channel.send({
            content: `${bot.emoji} **${bot.name}**이(가) ${choice}번 버섯을 선택했습니다!${selectedMushroom.isPoisonous ? ' 💀 독버섯이었습니다!' : ' ✨ 안전했습니다!'}`
        });
    }

    // 게임 완료
    async completeGame(interaction, userId, perfectClear = false) {
        const session = this.sessions.get(userId);
        if (!session) return;

        // 완벽 클리어 보너스
        if (perfectClear) {
            session.totalReward += MUSHROOM_GAME.gameSettings.perfectBonus;
        }

        const user = await User.findOne({ discordId: userId });
        let bonusApplied = false;
        let bonusAmount = 0;
        
        if (user) {
            // 버그 사냥꾼 칭호 효과 적용
            const { applyMinigameBonus } = require('../common/specialEffects');
            const originalReward = session.totalReward;
            const finalReward = applyMinigameBonus(session.totalReward, user);
            
            if (finalReward > originalReward) {
                bonusApplied = true;
                bonusAmount = finalReward - originalReward;
                console.log(`[MushroomGame] ${user.nickname || user.discordId} - 특수 효과 적용: ${originalReward} → ${finalReward} (+${bonusAmount})`);
                session.totalReward = finalReward;
            }
            
            user.gold += finalReward;
            await user.save();
            
            // 미션 진행도 업데이트
            await MissionHelper.updateMiniGame(userId);
            if (session.totalReward > 0) {
                await MissionHelper.updateGoldEarned(userId, session.totalReward);
            }
        }

        const victoryEmbed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle(perfectClear ? MUSHROOM_GAME.messages.perfectVictory : MUSHROOM_GAME.messages.survivalVictory.replace('{rounds}', session.survivedRounds))
            .setDescription(`🎉 축하합니다! ${session.userName}님!` + 
                (bonusApplied ? `\n\n🏷️ **버그 사냥꾼 칭호 효과** +${bonusAmount}G` : ''))
            .setImage(`attachment://${MUSHROOM_GAME.backgrounds.victory}`)
            .setThumbnail(`attachment://${MUSHROOM_GAME.effects.victory}`)
            .addFields(
                { name: '🏆 생존 라운드', value: `${session.survivedRounds}/${MUSHROOM_GAME.gameSettings.maxRounds}`, inline: true },
                { name: '💰 총 획득 골드', value: `${session.totalReward}G`, inline: true },
                { name: '⏱️ 플레이 시간', value: `${Math.floor((Date.now() - session.startTime) / 1000)}초`, inline: true }
            );

        if (session.difficulty === 'bot' && session.bot) {
            victoryEmbed.addFields({
                name: '🤖 봇 대결 결과',
                value: session.botAlive ? `${session.bot.emoji} ${session.bot.name} 생존! 무승부!` : `${session.bot.emoji} ${session.bot.name} 탈락! 승리!`,
                inline: false
            });
        }

        const backgroundAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.backgrounds.victory}`);
        const effectAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.victory}`);

        // 게임 종료 후 버튼 추가
        const endButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('mushroom_play_again')
                    .setLabel('🍄 한판 더하기')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('game_main_menu')
                    .setLabel('🏠 메인 메뉴로')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [victoryEmbed],
            components: [endButtons],
            files: [backgroundAttachment, effectAttachment]
        });

        this.sessions.delete(userId);
    }

    // 게임 결과 저장
    async saveGameResult(userId) {
        const session = this.sessions.get(userId);
        if (!session) return;

        const user = await User.findOne({ discordId: userId });
        if (user && session.totalReward > 0) {
            // 버그 사냥꾼 칭호 효과 적용
            const { applyMinigameBonus } = require('../common/specialEffects');
            const originalReward = session.totalReward;
            const finalReward = applyMinigameBonus(session.totalReward, user);
            
            if (finalReward > originalReward) {
                console.log(`[MushroomGame] ${user.nickname || user.discordId} - 특수 효과 적용: ${originalReward} → ${finalReward} (+${finalReward - originalReward})`);
                session.totalReward = finalReward;
            }
            
            user.gold += finalReward;
            await user.save();
            
            // 미션 진행도 업데이트
            await MissionHelper.updateMiniGame(userId);
            await MissionHelper.updateGoldEarned(userId, session.totalReward);
        }

        this.sessions.delete(userId);
    }

    // 멀티플레이어 게임 시작
    async startMultiplayerGame(channel, lobbyId) {
        const session = mushroomMultiplayerSessions.get(lobbyId) || this.sessions.get(lobbyId);
        console.log(`🍄 멀티플레이어 게임 시작 - lobbyId: ${lobbyId}, session 찾음: ${!!session}`);
        if (!session || session.gameStarted) {
            console.log(`🍄 게임 시작 실패 - gameStarted: ${session?.gameStarted}`);
            return;
        }

        // 타이머 정리
        if (session.waitingTimer) {
            clearTimeout(session.waitingTimer);
            session.waitingTimer = null;
        }

        session.gameStarted = true;
        session.currentRound = 1;
        
        // 배팅금 계산
        const betAmount = session.betAmount; // 배팅금 필수
        session.totalPot = session.players.size * betAmount;

        // 각 플레이어의 배팅금 차감
        for (const [playerId, playerData] of session.players) {
            const user = await User.findOne({ discordId: playerId });
            if (user) {
                user.gold -= betAmount;
                await user.save();
            }
        }

        // 대기실이 아닌 새로운 게임 채널 생성 (가위바위보와 동일)
        const guild = channel.guild;
        const players = Array.from(session.players.values()).map(p => ({
            id: p.userId,
            name: p.userName
        }));
        
        // 대기실 채널을 게임 채널로 재사용
        const gameChannel = session.tempChannel;
        
        // 세션에 게임 채널 저장
        session.gameChannel = gameChannel;
        session.gameChannelId = gameChannel.id;
        
        // 채널 정리 시스템 - 이미 등록되어 있으므로 재등록하지 않음
        
        // 대기실 메시지 삭제
        if (session.waitingMessage) {
            await session.waitingMessage.delete().catch(() => {});
        }
        
        // 대기실 채널 삭제는 나중에 수행
        const tempChannelToDelete = session.tempChannel;

        // 통일된 게임 시작 메시지 사용
        const startEmbed = createGameStartEmbed(
            '독버섯',
            session.hostName,
            Array.from(session.players.values()),
            {
                status: '게임 진행 중',
                footer: '곧 첫 번째 라운드가 시작됩니다!',
                extraFields: [
                    { name: '💰 총 상금', value: `${session.totalPot.toLocaleString()}G`, inline: true },
                    { name: '🏆 우승 보상', value: '전액 독식!', inline: true }
                ]
            }
        );

        // 채널이 존재하는지 확인
        if (!gameChannel || !gameChannel.isTextBased()) {
            console.error('[독버섯] 게임 채널을 찾을 수 없습니다');
            return;
        }
        
        try {
            await gameChannel.send({ embeds: [startEmbed] });
        } catch (error) {
            console.error('[독버섯] 메시지 전송 실패:', error);
            if (error.code === 10003) {
                // 채널이 삭제된 경우 세션 정리
                this.sessions.delete(lobbyId);
                mushroomMultiplayerSessions.delete(lobbyId);
                if (gameChannel && gameChannel.id) {
                    mushroomTempChannels.delete(gameChannel.id);
                }
            }
            return;
        }
        
        // 관전자 베팅 시작 (2명 이상의 플레이어가 있을 때만)
        if (session.players.size >= 2) {
            try {
                const playerData = Array.from(session.players.values()).map(p => ({
                    id: p.userId,
                    username: p.userName
                }));
                
                const bettingPool = spectatorBetting.createBettingPool(
                    lobbyId,
                    'mushroom',
                    playerData
                );
                
                if (bettingPool && session.spectators && session.spectators.size > 0) {
                    const bettingEmbed = spectatorBetting.createBettingEmbed(bettingPool);
                    const bettingButtons = spectatorBetting.createBettingButtons(lobbyId);
                    
                    // 관전자들에게만 DM으로 베팅 안내 전송
                    for (const [spectatorId, spectator] of session.spectators) {
                        try {
                            const user = await gameChannel.client.users.fetch(spectatorId);
                            await user.send({
                                content: '🎰 **독버섯 게임 베팅이 시작되었습니다!** (🕒 10초 동안 베팅 가능)',
                                embeds: [bettingEmbed],
                                components: bettingButtons
                            });
                        } catch (error) {
                            console.error(`관전자 ${spectatorId}에게 DM 전송 실패:`, error);
                        }
                    }
                    
                    // 게임 채널에는 베팅 시작 안내만 (버튼 없이)
                    await gameChannel.send({
                        content: '🎰 **관전자 베팅이 시작되었습니다!**',
                        embeds: [],
                        components: []
                    });
                    
                    // 10초 후 베팅 마감
                    setTimeout(async () => {
                        spectatorBetting.closeBetting(lobbyId);
                        try {
                            // 관전자들에게 DM으로 마감 알림
                            for (const [spectatorId, spectator] of session.spectators) {
                                try {
                                    const user = await gameChannel.client.users.fetch(spectatorId);
                                    await user.send({
                                        content: '🔒 **베팅이 마감되었습니다!** 게임 결과를 기다려주세요.',
                                        embeds: [],
                                        components: []
                                    });
                                } catch (error) {
                                    console.error(`관전자 ${spectatorId}에게 DM 전송 실패:`, error);
                                }
                            }
                        } catch (error) {
                            console.error('베팅 마감 알림 전송 실패:', error);
                        }
                    }, 10000);
                }
            } catch (error) {
                console.error('관전자 베팅 설정 오류:', error);
            }
        }
        
        // 원래 채널에 게임 시작 안내 (게임이 같은 채널에서 진행되므로 안내 불필요)

        // 첫 라운드 시작
        setTimeout(() => this.startMultiplayerRound(lobbyId), 3000);
        
        // 대기실 채널 삭제하지 않음 (게임 채널로 재사용중)
    }

    // 멀티플레이어 라운드 시작
    async startMultiplayerRound(lobbyId) {
        console.log(`🍄 startMultiplayerRound 호출 - lobbyId: ${lobbyId}`);
        console.log(`🍄 mushroomMultiplayerSessions 키 목록:`, Array.from(mushroomMultiplayerSessions.keys()));
        const session = mushroomMultiplayerSessions.get(lobbyId) || this.sessions.get(lobbyId);
        if (!session) {
            console.log(`🍄 세션을 찾을 수 없음 - lobbyId: ${lobbyId}`);
            return;
        }
        console.log(`🍄 세션 찾음 - lobbyId: ${session.lobbyId}, gameStarted: ${session.gameStarted}`);
        
        // 이미 라운드가 진행 중인지 확인
        if (session.roundInProgress) {
            console.log(`🍄 라운드가 이미 진행 중 - lobbyId: ${lobbyId}`);
            return;
        }
        session.roundInProgress = true;

        const roundInfo = MUSHROOM_GAME.difficultyByRound[session.currentRound];
        const mushrooms = this.generateMushrooms(roundInfo.poisonCount);
        session.mushrooms = mushrooms;
        session.playerChoices = new Map();

        // 생존한 플레이어 수 확인
        const alivePlayers = Array.from(session.players.values()).filter(p => p.isAlive);
        
        // 아이템 사용 초기화
        session.itemsUsedThisRound.clear();
        
        // 개선된 라운드 시작 메시지
        const roundStartEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(`${gameHelpers.getRoundMessage(session.currentRound)}`)
            .setDescription(
                `🎮 **라운드 ${session.currentRound} 시작!**\n\n` +
                `${roundInfo.message}\n\n` +
                `⏱️ **15초** 안에 버섯을 선택하세요!\n` +
                `선택하지 않으면 랜덤으로 선택됩니다!`
            )
            .addFields(
                { name: '👥 생존자', value: alivePlayers.map(p => p.userName).join(', '), inline: false },
                { name: '💰 총 상금', value: `${session.totalPot.toLocaleString()}G`, inline: true },
                { name: '🎯 생존 보너스', value: `${(MUSHROOM_GAME.gameSettings.survivalBonus * session.currentRound).toLocaleString()}G`, inline: true },
                { name: '🎯 특수 효과', value: `${gameHelpers.getActiveEffects(session)}`, inline: true }
            )
            .setFooter({ text: '🍄 신중하게 선택하세요! 행운을 빕니다!' });
        
        // 라운드 시작 메시지
        const channel = session.gameChannel || session.tempChannel;
        if (!channel) {
            console.error('[독버섯] 게임 채널을 찾을 수 없습니다');
            console.error('[독버섯] session.gameChannel:', session.gameChannel);
            console.error('[독버섯] session.tempChannel:', session.tempChannel);
            return;
        }
        
        try {
            await channel.send({ embeds: [roundStartEmbed] });
        } catch (error) {
            console.error('[독버섯] 라운드 시작 메시지 전송 실패:', error);
            if (error.code === 10003) {
                // 채널이 삭제된 경우
                console.error('[독버섯] 채널이 삭제되었습니다. 세션을 정리합니다.');
                this.sessions.delete(session.lobbyId);
                mushroomMultiplayerSessions.delete(session.lobbyId);
            }
            return;
        }
        
        // 3, 2, 1 카운트다운
        for (let i = 3; i > 0; i--) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            // 채널이 삭제되었는지 확인
            if (!channel.guild.channels.cache.has(channel.id)) {
                console.log('🍄 게임 채널이 삭제되어 라운드를 중단합니다.');
                return;
            }
            await channel.send(`**${i}**... ${i === 1 ? '🍄 시작!' : ''}`);
        }

        // 버섯 종류 정보 표시
        const mushroomInfo = MUSHROOM_GAME.mushroomTypes[session.mushroomType || 'slime'];
        const gameEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🍄 버섯을 선택하세요!')
            .setDescription(
                `${mushroomInfo.emoji} **${mushroomInfo.name}**들이 자라있습니다!\n` +
                `이 중 **${roundInfo.poisonCount}개**가 독버섯입니다!\n\n` +
                `${gameHelpers.getStatusEmoji(mushrooms)} 진행도`
            );

        // mushrooms 배열을 개선된 형식으로 변환
        session.mushrooms = mushrooms.map((m, index) => ({
            ...m,
            revealed: false,
            selectedBy: null
        }));
        
        // 개선된 버섯 버튼 생성 (멀티플레이어 모드)
        console.log(`🍄 멀티플레이어 버튼 생성 - lobbyId: ${lobbyId}, mushrooms: ${session.mushrooms.length}`);
        console.log(`🍄 세션 저장 확인 - mushroomMultiplayerSessions에 ${lobbyId} 존재: ${mushroomMultiplayerSessions.has(lobbyId)}`);
        const mushroomButtons = createImprovedMushroomButtons(lobbyId, session.mushrooms, 'player', true);

        await channel.send({
            embeds: [gameEmbed],
            components: mushroomButtons
        });
        
        // 스캐너를 가진 플레이어에게 버섯 정보 전송
        for (const [playerId, player] of session.players) {
            if (!player.isAlive || !player.items || player.items.length === 0) continue;
            
            // 스캐너 아이템 확인
            const scannerIndex = player.items.findIndex(item => item.effect === 'reveal');
            if (scannerIndex !== -1) {
                // 스캐너 사용 (1회용)
                player.items.splice(scannerIndex, 1);
                
                // 랜덤으로 3개의 버섯 정보 공개
                const revealCount = 3;
                const revealedIndices = [];
                const availableIndices = Array.from({length: mushrooms.length}, (_, i) => i);
                
                for (let i = 0; i < revealCount && availableIndices.length > 0; i++) {
                    const randomIndex = Math.floor(Math.random() * availableIndices.length);
                    const mushroomIndex = availableIndices.splice(randomIndex, 1)[0];
                    revealedIndices.push(mushroomIndex);
                }
                
                // 스캔 결과 메시지 생성
                const scanResults = revealedIndices.map(idx => {
                    const mushroom = mushrooms[idx];
                    const icon = mushroom.isPoisonous ? '☠️' : '✅';
                    return `${idx + 1}번 버섯: ${icon} ${mushroom.isPoisonous ? '독버섯' : '안전'}`;
                }).join('\n');
                
                const scanEmbed = new EmbedBuilder()
                    .setColor('#00CED1')
                    .setTitle('🔍 버섯 스캐너 작동!')
                    .setDescription(
                        `**${player.userName}**님의 스캐너가 버섯 정보를 분석했습니다!\n\n` +
                        `**스캔 결과:**\n${scanResults}\n\n` +
                        `⚠️ 이 정보는 다른 플레이어에게는 보이지 않습니다.`
                    )
                    .setFooter({ text: '스캐너는 1회용입니다.' });
                
                try {
                    // DM으로 전송 시도
                    const guild = channel.guild;
                    const member = await guild.members.fetch(playerId);
                    await member.send({ embeds: [scanEmbed] });
                    
                    // 채널에 스캐너 사용 알림
                    await channel.send(`🔍 **${player.userName}**님이 버섯 스캐너를 사용했습니다!`);
                } catch (error) {
                    // DM 실패 시 채널에 임시 메시지로 전송 (5초 후 삭제)
                    const tempMsg = await channel.send({
                        content: `<@${playerId}> 스캐너 결과 (5초 후 삭제)`,
                        embeds: [scanEmbed]
                    });
                    setTimeout(() => tempMsg.delete().catch(() => {}), 5000);
                }
            }
        }

        // 이전 라운드 타이머가 있으면 취소
        if (session.roundTimer) {
            clearTimeout(session.roundTimer);
        }
        
        // 15초 후 자동 선택
        session.roundTimer = setTimeout(() => this.processMultiplayerRoundEnd(channel, lobbyId), 15000);
    }

    // 멀티플레이어 라운드 종료 처리
    async processMultiplayerRoundEnd(channel, lobbyId) {
        const session = mushroomMultiplayerSessions.get(lobbyId) || this.sessions.get(lobbyId);
        if (!session || !session.gameStarted) return;
        
        // 라운드 진행 상태 해제
        session.roundInProgress = false;
        
        // 라운드 타이머 정리
        if (session.roundTimer) {
            clearTimeout(session.roundTimer);
            session.roundTimer = null;
        }

        // 선택하지 않은 플레이어는 랜덤 선택
        const alivePlayers = Array.from(session.players.values()).filter(p => p.isAlive);
        const mushroomCount = session.mushrooms ? session.mushrooms.length : 12;
        for (const player of alivePlayers) {
            if (!session.playerChoices.has(player.userId)) {
                // 이미 선택되지 않은 버섯 중에서 랜덤 선택
                const availableMushrooms = [];
                for (let i = 0; i < mushroomCount; i++) {
                    if (!session.mushrooms || !session.mushrooms[i].revealed) {
                        availableMushrooms.push(i);
                    }
                }
                if (availableMushrooms.length > 0) {
                    const randomChoice = availableMushrooms[Math.floor(Math.random() * availableMushrooms.length)];
                    session.playerChoices.set(player.userId, randomChoice);
                }
            }
        }

        // 결과 집계 중 애니메이션
        const calculatingEmbed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('🎲 결과 집계 중...')
            .setDescription('누가 살아남았을까요?');
        
        await channel.send({ embeds: [calculatingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 결과 처리
        const resultEmbed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle(`🍄 라운드 ${session.currentRound} 결과`);

        let resultText = '';
        const eliminatedPlayers = [];
        const survivors = [];

        for (const [playerId, choice] of session.playerChoices) {
            const player = session.players.get(playerId);
            if (!player || !player.isAlive) continue;

            const mushroom = session.mushrooms[choice];
            const mushroomType = MUSHROOM_GAME.mushroomTypes[mushroom.type];

            if (mushroom.isPoisonous) {
                // 보호막 확인
                if (player.shields > 0) {
                    player.shields--;
                    resultText += `🛡️ ${player.userName}: ${mushroomType.emoji} 독버섯! (보호막으로 방어)\n`;
                    player.survivedRounds++;
                    player.streak++;
                } else {
                    player.isAlive = false;
                    player.streak = 0;
                    eliminatedPlayers.push(player.userName);
                    resultText += `❌ **${player.userName}** - 탈락! ${mushroomType.emoji} 독버섯!\n`;
                    
                    // 탈락 반응 추가
                    const reaction = reactionSystem.addReaction(lobbyId, playerId, 'fear');
                    if (reaction) resultText += `   ${reaction} "${player.userName}님이 탈락했습니다!"\n`;
                }
            } else {
                player.survivedRounds++;
                player.streak++;
                let reward = MUSHROOM_GAME.gameSettings.baseReward;
                
                // 연승 보너스
                if (player.streak >= 3) {
                    const streakBonus = 100 * (player.streak - 2);
                    reward += streakBonus;
                    resultText += `🔥 연승 보너스! (+${streakBonus}G)\n`;
                }
                
                // 특수 아이템 획득 확률
                if (Math.random() < 0.1) { // 10% 확률
                    const item = mushroomItemSystem.grantRandomItem(playerId);
                    player.items = player.items || [];
                    
                    // 아이템 효과 즉시 적용
                    if (item.effect === 'protection') {
                        player.shields = (player.shields || 0) + 1;
                        resultText += `🛡️ ${player.userName}: 보호막 획득! (현재 ${player.shields}개)\n`;
                    } else if (item.effect === 'reveal') {
                        // 다음 라운드 버섯 1개 미리보기 효과는 나중에 적용
                        player.items.push(item);
                        resultText += `🔍 ${player.userName}: 버섯 스캐너 획득!\n`;
                    } else if (item.effect === 'luck') {
                        // 행운 부적은 보상 2배
                        reward *= 2;
                        resultText += `🍀 ${player.userName}: 행운의 부적 발동! (보상 2배)\n`;
                    }
                }
                
                if (mushroom.isSpecial) {
                    if (mushroom.type === 'golden') {
                        const goldenBonus = 2000;
                        reward += goldenBonus;
                        resultText += `✨ ${player.userName}: ${mushroomType.emoji} 황금버섯! (+${goldenBonus}G)\n`;
                        
                        // 축하 반응
                        const reaction = reactionSystem.addReaction(lobbyId, playerId, 'celebrate');
                        if (reaction) resultText += `   ${reaction}\n`;
                    } else if (mushroom.type === 'mystery') {
                        const bonus = Math.floor(Math.random() * 3000) + 500;
                        reward += bonus;
                        resultText += `❓ ${player.userName}: ${mushroomType.emoji} 미스터리! (+${bonus}G)\n`;
                    }
                } else {
                    resultText += `✅ **${player.userName}** - 생존! ${mushroomType.emoji} 안전한 버섯\n`;
                }
                survivors.push(`✅ **${player.userName}** - 생존!`);
                
                player.totalReward += reward;
            }
        }

        resultEmbed.setDescription(
            eliminatedPlayers.length > 0 
                ? `${resultText}\n🎯 **이번 라운드 결과**`
                : `🎉 모든 플레이어가 생존했습니다!\n\n${resultText}`
        );

        const survivingPlayers = Array.from(session.players.values()).filter(p => p.isAlive);
        
        if (eliminatedPlayers.length > 0) {
            resultEmbed.addFields({
                name: '💀 탈락자',
                value: eliminatedPlayers.join(', '),
                inline: false
            });
        }

        await channel.send({ embeds: [resultEmbed] });

        // 게임 종료 조건 확인
        if (survivingPlayers.length <= 1) {
            // 생존자가 1명 이하면 종료
            await this.endMultiplayerGame(lobbyId);
        } else if (session.currentRound >= MUSHROOM_GAME.gameSettings.maxRounds && !session.roundLimitRemoved) {
            // 6라운드 도달 시 보호막 확인
            const playersWithShields = survivingPlayers.filter(p => p.shields > 0);
            if (playersWithShields.length > 0) {
                // 보호막을 가진 플레이어가 있으면 계속 진행
                session.roundLimitRemoved = true;
                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('⚠️ 특별 연장!')
                        .setDescription(`🛡️ 보호막을 가진 플레이어가 있어 게임이 계속됩니다!\n이제부터는 생존자가 1명이 될 때까지 진행됩니다!`)
                    ]
                });
                session.currentRound++;
                setTimeout(() => this.startMultiplayerRound(lobbyId), 3000);
            } else {
                // 보호막이 없으면 종료
                await this.endMultiplayerGame(lobbyId);
            }
        } else {
            // 다음 라운드
            session.currentRound++;
            setTimeout(() => this.startMultiplayerRound(lobbyId), 3000);
        }
    }

    // 멀티플레이어 게임 종료
    async endMultiplayerGame(lobbyId) {
        const session = mushroomMultiplayerSessions.get(lobbyId) || this.sessions.get(lobbyId);
        if (!session) return;

        const survivors = Array.from(session.players.values())
            .filter(p => p.isAlive)
            .sort((a, b) => b.survivedRounds - a.survivedRounds);

        const channel = session.gameChannel;
        if (!channel) {
            console.error('[독버섯] 게임 채널을 찾을 수 없습니다');
            return;
        }
        
        const endEmbed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('🏆 게임 종료!')
            .setDescription('버섯 사냥이 끝났습니다!');

        if (survivors.length === 0) {
            endEmbed.addFields({
                name: '😢 결과',
                value: '모든 플레이어가 탈락했습니다...',
                inline: false
            });
        } else {
            const winner = survivors[0];
            // 승자가 전액 독식
            const winnerPrize = session.totalPot;

            // 상금 지급
            const winnerUser = await User.findOne({ discordId: winner.userId });
            if (winnerUser) {
                // 미니게임 보상 특수 효과 적용
                const totalReward = applyMinigameBonus(winnerPrize + winner.totalReward, winnerUser);
                winnerUser.gold += totalReward;
                
                // gameStats 업데이트 (승자)
                if (!winnerUser.gameStats) winnerUser.gameStats = {};
                if (!winnerUser.gameStats.mushroom) winnerUser.gameStats.mushroom = { played: 0, won: 0 };
                winnerUser.gameStats.mushroom.played++;
                winnerUser.gameStats.mushroom.won++;
                
                await winnerUser.save();
                
                // 미션 진행도 업데이트
                await MissionHelper.updateMiniGame(winner.userId);
                if (totalReward > 0) {
                    await MissionHelper.updateGoldEarned(winner.userId, totalReward);
                }
            }

            endEmbed.addFields(
                { name: '🥇 우승자', value: `**${winner.userName}**`, inline: true },
                { name: '💰 상금', value: `${winnerPrize.toLocaleString()}G`, inline: true },
                { name: '🏃 생존 라운드', value: `${winner.survivedRounds}라운드`, inline: true }
            );

            // 준우승자는 상금 없음 (배팅금 시스템에서는 승자 독식)
        }
        
        // 관전자 베팅 결과 처리 (승자 여부와 관계없이 처리)
        if (spectatorBetting && spectatorBetting.resolvePool) {
            try {
                const betResults = {
                    totalRounds: session.currentRound,
                    duration: Date.now() - session.startTime,
                    survivors: survivors.length
                };
                
                // 승자가 있는 경우에만 승자 정보 추가
                if (survivors.length > 0) {
                    betResults.winner = { 
                        id: survivors[0].userId, 
                        username: survivors[0].userName 
                    };
                }
                
                const betResult = await spectatorBetting.resolvePool(lobbyId, betResults);
                
                if (betResult && betResult.payouts && betResult.payouts.size > 0) {
                    // 당첨금 지급
                    for (const [userId, payout] of betResult.payouts) {
                        const betUser = await User.findOne({ discordId: userId });
                        if (betUser) {
                            betUser.gold += payout;
                            await betUser.save();
                            
                            // 골드 획득 미션 업데이트
                            await MissionHelper.updateGoldEarned(userId, payout);
                        }
                    }
                    
                    // 관전자 베팅 결과 임베드
                    const betResultEmbed = spectatorBetting.createResultEmbed(lobbyId);
                    if (betResultEmbed) {
                        await channel.send({ embeds: [betResultEmbed] });
                    }
                }
            } catch (error) {
                console.error('관전자 베팅 결과 처리 오류:', error);
            }
        }

        // 전체 순위
        const allPlayers = Array.from(session.players.values())
            .sort((a, b) => b.survivedRounds - a.survivedRounds);

        endEmbed.addFields({
            name: '📊 최종 순위',
            value: allPlayers.map((p, i) => 
                `${i + 1}. ${p.userName} - ${p.survivedRounds}라운드 생존 ${p.isAlive ? '✅' : '💀'}`
            ).join('\n'),
            inline: false
        });

        await channel.send({ embeds: [endEmbed] });
        
        // 모든 참가자의 미션 진행도 및 gameStats 업데이트
        for (const player of session.players.values()) {
            await MissionHelper.updateMiniGame(player.userId);
            
            // 패자들의 gameStats 업데이트
            if (player.userId !== survivors[0]?.userId) {
                const loserUser = await User.findOne({ discordId: player.userId });
                if (loserUser) {
                    if (!loserUser.gameStats) loserUser.gameStats = {};
                    if (!loserUser.gameStats.mushroom) loserUser.gameStats.mushroom = { played: 0, won: 0 };
                    loserUser.gameStats.mushroom.played++;
                    await loserUser.save();
                }
            }
        }
        
        // 원래 채널에 결과 알림
        if (session.originalChannelId && survivors.length > 0) {
            try {
                const originalChannel = channel.guild.channels.cache.get(session.originalChannelId);
                if (originalChannel) {
                    const winner = survivors[0];
                    const betAmount = session.betAmount || 0;
                    const totalPlayers = session.players.size;
                    const winnerPrize = session.betAmount ? session.totalPot : Math.floor(session.totalPot * 0.7);
                    
                    const resultEmbed = new EmbedBuilder()
                        .setTitle('🍄 독버섯 게임 결과!')
                        .setColor('#9b59b6')
                        .setDescription(
                            `## 🏆 **${winner.userName}**님의 승리!\n` +
                            `### 🎊 ${winner.survivedRounds}라운드를 생존하여 최후의 1인이 되었습니다!\n\n` +
                            `**참가자:** ${totalPlayers}명\n` +
                            `**생존 라운드:** ${winner.survivedRounds}라운드\n` +
                            `### 💰 배팅 결과\n` +
                            `**배팅금:** ${betAmount.toLocaleString()}G × ${totalPlayers}명\n` +
                            `**${winner.userName}**: +${winnerPrize.toLocaleString()}G 💎 *잭팟! 모든 배팅금을 가져갑니다!*\n` +
                            `**패배자들**: -${betAmount.toLocaleString()}G 💸 *아쉽네요... 독버섯은 무서워요*\n\n` +
                            `> "${winner.userName}님은 독버섯을 피하는 달인이시네요! 🍄"\n` +
                            `> "패배자들이여, 다음엔 더 신중하게!"`
                        )
                        .setFooter({ text: '독버섯 게임 - 생존자가 승자다!' })
                        .setTimestamp();
                    
                    await originalChannel.send({ embeds: [resultEmbed] });
                }
            } catch (error) {
                console.error('원래 채널 알림 실패:', error);
            }
        }

        // 게임 채널 10초 후 삭제 (가위바위보와 동일하게)
        const channelToDelete = session.gameChannel || session.tempChannel;
        if (channelToDelete) {
            setTimeout(async () => {
                try {
                    await channelCleanup.safeDeleteChannel(channelToDelete, '게임 종료');
                    mushroomTempChannels.delete(lobbyId);
                } catch (error) {
                    console.error('게임 채널 삭제 실패:', error);
                }
            }, 10 * 1000); // 10초
        }

        // 세션 정리
        session.players.forEach((player, id) => {
            this.sessions.delete(id);
        });
        mushroomMultiplayerSessions.delete(lobbyId);
    }

    // 대기실 메시지 업데이트
    async updateWaitingMessage(session) {
        const playerList = Array.from(session.players.values())
            .map(p => `• ${p.userName}`)
            .join('\n');
        
        const spectatorsList = session.spectators ? 
            Array.from(session.spectators.values()).map(s => `👁️ ${s.userName}`).join('\n') : 
            '없음';
        
        const updatedEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🍄 독버섯 게임 대기실')
            .setDescription(`**호스트**: ${session.hostName}`)
            .addFields(
                { name: '🎮 게임', value: '독버섯 게임', inline: true },
                { name: '👥 현재 인원', value: `${session.players.size}/4명`, inline: true },
                { name: '💰 배팅금', value: session.betAmount ? `${session.betAmount.toLocaleString()}G` : '미설정', inline: true },
                { name: '⏰ 대기 시간', value: '최대 60초', inline: true },
                { name: '👥 참여자', value: playerList || '없음', inline: true },
                { name: '👁️ 관전자', value: spectatorsList, inline: true }
            )
            .setFooter({ text: '2명 이상이 모이고 배팅금이 설정되면 시작할 수 있습니다!' });

        const gameButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`mushroom_bet_${session.gameId}`)
                    .setLabel('💰 배팅금 설정')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`mushroom_join_${session.gameId}`)
                    .setLabel('🎮 참가하기')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(session.players.size >= 4),
                new ButtonBuilder()
                    .setCustomId(`mushroom_start_multi_${session.gameId}`)
                    .setLabel('🎯 게임 시작')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(session.players.size < 2 || !session.betAmount),
                new ButtonBuilder()
                    .setCustomId(`mushroom_spectate_${session.gameId}`)
                    .setLabel('👁️ 관전자로 참여')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`mushroom_leave_${session.gameId}`)
                    .setLabel('🚪 나가기')
                    .setStyle(ButtonStyle.Danger)
            );

        await session.waitingMessage.edit({
            embeds: [updatedEmbed],
            components: [gameButtons]
        });
    }

    // 배팅금 선택 화면
    async showBetSelection(interaction, gameId) {
        const session = mushroomMultiplayerSessions.get(gameId) || this.sessions.get(gameId);
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
                    .setCustomId(`mushroom_set_bet_${gameId}_10000`)
                    .setLabel('10,000G')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`mushroom_set_bet_${gameId}_30000`)
                    .setLabel('30,000G')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`mushroom_set_bet_${gameId}_50000`)
                    .setLabel('50,000G')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`mushroom_set_bet_${gameId}_100000`)
                    .setLabel('100,000G')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`mushroom_set_bet_${gameId}_custom`)
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
    async setBetAmount(interaction, gameId, amount) {
        const session = mushroomMultiplayerSessions.get(gameId) || this.sessions.get(gameId);
        if (!session || session.hostId !== interaction.user.id) {
            return interaction.reply({ 
                content: '❌ 오류가 발생했습니다.', 
                flags: 64 
            });
        }
        
        if (amount === 'custom') {
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

    // 대기실 메시지 업데이트 (별칭 메서드)
    async updateLobbyMessage(session) {
        return await this.updateWaitingMessage(session);
    }

    // 게임 메뉴 표시
    async showGameMenu(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const menuEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🍄 독버섯 게임')
            .setDescription(
                '**김헌터의 신비한 숲에서 버섯 사냥을 시작하세요!**\n\n' +
                '🎮 **게임 방법**\n' +
                '• 12개의 버섯 중에서 하나를 선택하세요\n' +
                '• 독버섯을 피하고 안전한 버섯을 찾으세요\n' +
                '• 라운드가 진행될수록 독버섯이 늘어납니다\n' +
                '• 최대한 오래 살아남아 보상을 획득하세요!\n\n' +
                '🎮 **플레이 모드를 선택하세요!**'
            )
            .addFields(
                { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '🎯 총 승리', value: `${user.mushroomGameData?.wins || 0}회`, inline: true },
                { name: '🔥 최고 기록', value: `${user.mushroomGameData?.bestRound || 0}라운드`, inline: true }
            );

        const modeButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('mushroom_mode_solo')
                    .setLabel('🌱 혼자하기')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('mushroom_mode_pvp')
                    .setLabel('⚔️ 유저와 플레이')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('mushroom_stats')
                    .setLabel('📊 상세 통계')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [menuEmbed],
            components: [modeButtons]
        });
    }
}

// 싱글톤 인스턴스
const mushroomGame = new MushroomGameSystem();

// 인터랙션 핸들러
async function handleMushroomInteraction(interaction) {
    const customId = interaction.customId;
    
    // 게임 메뉴
    if (customId === 'mushroom_game') {
        return await mushroomGame.showGameMenu(interaction);
    }
    
    // 모드 선택
    else if (customId.startsWith('mushroom_mode_')) {
        const mode = customId.replace('mushroom_mode_', '');
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }
        
        // defer 처리
        await interaction.deferUpdate();
        
        return await mushroomGame.startGame(interaction, user, mode);
    }
    
    // 게임 시작
    else if (customId.startsWith('mushroom_start_') && !customId.includes('multi')) {
        const gameId = customId.replace('mushroom_start_', '');
        return await mushroomGame.startRound(interaction, interaction.user.id);
    }
    
    // 버섯 선택 (싱글플레이어)
    else if (customId.startsWith('mushroom_select_') && !customId.includes('multi')) {
        const parts = customId.split('_');
        const gameId = parts[2];
        const position = parseInt(parts[3]);
        return await mushroomGame.processMushroomSelection(interaction, interaction.user.id, position);
    }
    
    // 멀티플레이어 버섯 선택
    else if (customId.startsWith('mushroom_multi_select_')) {
        // customId 형식: mushroom_multi_select_{lobbyId}_{position}
        const prefix = 'mushroom_multi_select_';
        const remaining = customId.substring(prefix.length);
        const lastUnderscoreIndex = remaining.lastIndexOf('_');
        const lobbyId = remaining.substring(0, lastUnderscoreIndex);
        const position = parseInt(remaining.substring(lastUnderscoreIndex + 1));
        
        console.log(`🍄 멀티플레이어 버섯 선택 - lobbyId: ${lobbyId}, position: ${position}`);
        console.log(`🍄 세션 검색 - mushroomMultiplayerSessions: ${mushroomMultiplayerSessions.has(lobbyId)}`);
        console.log(`🍄 세션 검색 - mushroomGameSessions: ${mushroomGameSessions.has(lobbyId)}`);
        
        const session = mushroomMultiplayerSessions.get(lobbyId) || mushroomGameSessions.get(lobbyId);
        
        if (!session) {
            console.log(`🍄 세션을 찾을 수 없음 - lobbyId: ${lobbyId}`);
            return interaction.reply({ content: '❌ 게임 세션을 찾을 수 없습니다.', flags: 64 });
        }
        
        const player = session.players.get(interaction.user.id);
        if (!player || !player.isAlive) {
            return interaction.reply({ content: '❌ 게임에 참여하지 않았거나 이미 탈락했습니다.', flags: 64 });
        }
        
        if (session.playerChoices.has(interaction.user.id)) {
            return interaction.reply({ content: '이미 선택했습니다!', flags: 64 });
        }
        
        // 선택 저장
        session.playerChoices.set(interaction.user.id, position);
        
        // 버섯 표시 업데이트
        session.mushrooms[position].revealed = true;
        session.mushrooms[position].selectedBy = interaction.user.id;
        
        await interaction.reply({ 
            content: `🍄 ${position + 1}번 버섯을 선택했습니다!`, 
            flags: 64 
        });
        
        // 모든 플레이어가 선택했는지 확인
        const alivePlayers = Array.from(session.players.values()).filter(p => p.isAlive);
        if (session.playerChoices.size >= alivePlayers.length) {
            // 즉시 라운드 종료
            clearTimeout(session.roundTimer);
            await mushroomGame.processMultiplayerRoundEnd(interaction.channel, lobbyId);
        }
    }
    
    // 다음 라운드 계속
    else if (customId.startsWith('mushroom_continue_')) {
        const gameId = customId.replace('mushroom_continue_', '');
        return await mushroomGame.startRound(interaction, interaction.user.id);
    }
    
    // 게임 종료
    else if (customId.startsWith('mushroom_end_')) {
        const gameId = customId.replace('mushroom_end_', '');
        await mushroomGame.saveGameResult(interaction.user.id);
        
        const endEmbed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🏁 게임 종료')
            .setDescription('버섯 사냥을 종료했습니다. 다음에 또 도전해보세요!');
        
        const endButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('mushroom_play_again')
                    .setLabel('🍄 한판 더하기')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('game_main_menu')
                    .setLabel('🏠 메인 메뉴로')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({
            embeds: [endEmbed],
            components: [endButtons]
        });
    }
    
    // 다시 플레이
    else if (customId === 'mushroom_play_again') {
        return await mushroomGame.showGameMenu(interaction);
    }
    
    // 매칭 취소
    else if (customId.startsWith('mushroom_cancel_')) {
        const userId = customId.replace('mushroom_cancel_', '');
        mushroomMatchmakingQueue.delete(userId);
        matchmakingSystem.stopPeriodicCheck(userId);
        
        const cancelEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ 매칭 취소됨')
            .setDescription('매칭을 취소했습니다.');
        
        await interaction.update({
            embeds: [cancelEmbed],
            components: []
        });
        
        // 메인 메뉴로 돌아가기
        setTimeout(() => mushroomGame.showGameMenu(interaction), 1000);
    }
    
    // 관전자로 참여
    else if (customId.startsWith('mushroom_spectate_')) {
        const lobbyId = customId.replace('mushroom_spectate_', '');
        const session = mushroomMultiplayerSessions.get(lobbyId) || mushroomGameSessions.get(lobbyId);
        
        if (!session) {
            return interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', flags: 64 });
        }
        
        const userId = interaction.user.id;
        const user = await User.findOne({ discordId: userId });
        
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }
        
        // 이미 참가자인지 확인
        if (session.players.has(userId)) {
            return interaction.reply({ content: '❌ 이미 플레이어로 참가 중입니다.', flags: 64 });
        }
        
        // 관전자로 추가
        if (!session.spectators) {
            session.spectators = new Map();
        }
        
        session.spectators.set(userId, {
            userId: userId,
            userName: user.nickname || interaction.user.username,
            user: user
        });
        
        // 채널 권한 추가 (읽기만 가능)
        if (session.tempChannel && session.tempChannel.permissionOverwrites) {
            try {
                await session.tempChannel.permissionOverwrites.create(userId, {
                    ViewChannel: true,
                    SendMessages: false,
                    ReadMessageHistory: true
                });
            } catch (error) {
                console.error('채널 권한 설정 실패:', error);
            }
        }
        
        // 대기실 메시지 업데이트
        await mushroomGame.updateLobbyMessage(session);
        
        // 관전자에게만 베팅 버튼 표시 (DM으로)
        if (session.gameStarted && spectatorBetting) {
            try {
                const bettingEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🎰 관전자 베팅')
                    .setDescription(
                        `독버섯 게임을 관전하며 베팅할 수 있습니다!\n\n` +
                        `베팅을 원하시면 아래 버튼을 클릭하세요.`
                    );
                
                const bettingButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`spectator_bet_intro_${lobbyId}`)
                            .setLabel('💰 베팅하기')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                await interaction.user.send({
                    embeds: [bettingEmbed],
                    components: [bettingButton]
                });
            } catch (error) {
                console.error('DM 전송 실패:', error);
            }
        }
        
        return interaction.reply({ 
            content: `✅ 관전자로 참여했습니다! <#${session.tempChannel.id}>에서 게임을 관전할 수 있습니다.`, 
            flags: 64 
        });
    }
    
    // 멀티플레이어 관련
    else if (customId.startsWith('mushroom_join_')) {
        const lobbyId = customId.replace('mushroom_join_', '');
        const session = mushroomMultiplayerSessions.get(lobbyId) || mushroomGameSessions.get(lobbyId);
        
        if (!session) {
            return interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', flags: 64 });
        }
        
        if (session.gameStarted) {
            return interaction.reply({ content: '❌ 이미 시작된 게임입니다.', flags: 64 });
        }
        
        if (session.players.size >= 4) { // 최대 4명
            return interaction.reply({ content: '❌ 인원이 가득 찼습니다.', flags: 64 });
        }
        
        const userId = interaction.user.id;
        const user = await User.findOne({ discordId: userId });
        
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }
        
        // 배팅금은 게임 시작 시 확인하므로 여기서는 체크하지 않음
        
        // 플레이어 추가
        session.players.set(userId, {
            userId: userId,
            userName: user.nickname || interaction.user.username,
            ready: false,
            isHost: false,
            totalReward: 0,
            survivedRounds: 0,
            isAlive: true,
            hasShield: false,
            shieldUsed: false
        });
        
        // 플레이어 추가 시 필수 속성 초기화
        session.players.set(userId, {
            userId: userId,
            userName: user.nickname || interaction.user.username,
            ready: false,
            isHost: false,
            totalReward: 0,
            survivedRounds: 0,
            isAlive: true,
            shields: 0,    // 보호막 개수 초기화
            items: [],     // 아이템 배열 초기화
            streak: 0      // 연승 카운트 초기화
        });
        
        // 세션 연결
        mushroomGameSessions.set(userId, session);
        mushroomGame.sessions.set(userId, session); // mushroomGame 인스턴스 사용
        
        // 임시 채널 권한 추가
        if (session.tempChannel && session.tempChannel.permissionOverwrites) {
            try {
                await session.tempChannel.permissionOverwrites.create(userId, {
                    ViewChannel: true,
                    SendMessages: true
                });
            } catch (error) {
                console.error('채널 권한 설정 실패:', error);
            }
        }
        
        // 참가자 목록 업데이트
        const playerList = Array.from(session.players.values())
            .map((p, i) => `${i + 1}. ${p.userName} ${p.isHost ? '(호스트)' : ''} ${p.ready ? '✅' : '⏳'}`)
            .join('\n');
        
        const updateEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🍄 독버섯 게임 대기실')
            .setDescription(`**방장**: ${session.hostName}\n\n${interaction.user.username}님이 참가했습니다!`)
            .addFields(
                { name: '👥 참가자', value: playerList, inline: false },
                { name: '🎮 게임 ID', value: lobbyId, inline: true }
            )
            .setFooter({ text: `${session.players.size}/4명 | 최소 2명이 모이면 30초 후 자동 시작` });
        
        // 대기실 업데이트
        await mushroomGame.updateWaitingMessage(session);
        
        await interaction.reply({ 
            content: '✅ 게임에 참가했습니다!', 
            flags: 64 
        });
        
        // 자동 시작 제거 - 호스트가 수동으로 시작해야 함
    }
    
    // 멀티플레이어 시작
    else if (customId.startsWith('mushroom_start_multi_')) {
        const lobbyId = customId.replace('mushroom_start_multi_', '');
        const session = mushroomMultiplayerSessions.get(lobbyId) || mushroomGameSessions.get(lobbyId);
        
        if (!session) {
            return interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', flags: 64 });
        }
        
        if (interaction.user.id !== session.hostId) {
            return interaction.reply({ content: '❌ 호스트만 게임을 시작할 수 있습니다.', flags: 64 });
        }
        
        if (session.players.size < 2) {
            return interaction.reply({ content: '❌ 최소 2명이 필요합니다.', flags: 64 });
        }
        
        // 배팅금 확인
        if (!session.betAmount) {
            return interaction.reply({ 
                content: '❌ 배팅금을 먼저 설정해주세요.', 
                flags: 64 
            });
        }
        
        // 참가자들의 골드 확인
        for (const [userId, playerData] of session.players) {
            const user = await User.findOne({ discordId: userId });
            if (!user || user.gold < session.betAmount) {
                return interaction.reply({ 
                    content: `❌ ${playerData.userName}님의 골드가 부족합니다. (필요: ${session.betAmount.toLocaleString()}G)`, 
                    flags: 64 
                });
            }
        }
        
        await interaction.deferUpdate();
        await mushroomGame.startMultiplayerGame(session.tempChannel || interaction.channel, lobbyId);
    }
    
    // 배팅금 설정
    else if (customId.startsWith('mushroom_bet_')) {
        const gameId = customId.replace('mushroom_bet_', '');
        return await mushroomGame.showBetSelection(interaction, gameId);
    }
    
    // 배팅금 선택
    else if (customId.startsWith('mushroom_set_bet_')) {
        const parts = customId.split('_');
        const gameId = parts.slice(3, -1).join('_');
        const amount = parts[parts.length - 1];
        return await mushroomGame.setBetAmount(interaction, gameId, amount);
    }
    
    // 관전자로 참여
    else if (customId.startsWith('mushroom_spectate_')) {
        const { handleSpectatorInteraction } = require('../../systems/spectatorBettingHandler');
        const gameId = customId.replace('mushroom_spectate_', '');
        const session = mushroomMultiplayerSessions.get(gameId);
        
        if (!session) {
            return interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', flags: 64 });
        }
        
        // 통합 핸들러로 처리
        return await handleSpectatorInteraction(interaction, 'mushroom', session);
    }
    
    // 관전자 베팅 처리
    else if (customId.startsWith('spectator_bet_') || customId.startsWith('spectator_confirm_')) {
        const { handleSpectatorInteraction } = require('../../systems/spectatorBettingHandler');
        const gameId = customId.split('_')[2] || customId.split('_')[3];
        const session = mushroomMultiplayerSessions.get(gameId);
        
        if (!session) {
            return interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', flags: 64 });
        }
        
        return await handleSpectatorInteraction(interaction, 'mushroom', session);
    }
    
    // 멀티플레이어 나가기
    else if (customId.startsWith('mushroom_leave_')) {
        const lobbyId = customId.replace('mushroom_leave_', '');
        const session = mushroomMultiplayerSessions.get(lobbyId) || mushroomGameSessions.get(lobbyId);
        
        if (!session) {
            return interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', flags: 64 });
        }
        
        if (session.gameStarted) {
            return interaction.reply({ content: '❌ 이미 시작된 게임은 나갈 수 없습니다.', flags: 64 });
        }
        
        const userId = interaction.user.id;
        session.players.delete(userId);
        mushroomGameSessions.delete(userId);
        
        // 임시 채널 권한 제거
        if (session.tempChannel && session.tempChannel.permissionOverwrites) {
            try {
                await session.tempChannel.permissionOverwrites.delete(userId);
            } catch (error) {
                console.error('채널 권한 제거 실패:', error);
            }
        }
        
        // 호스트가 나가면 게임 취소
        if (userId === session.hostId || session.players.size === 0) {
            const cancelEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ 게임 취소')
                .setDescription('호스트가 나가서 게임이 취소되었습니다.');
            
            await interaction.update({
                embeds: [cancelEmbed],
                components: []
            });
            
            // 임시 채널 삭제
            if (session.tempChannel) {
                setTimeout(() => channelCleanup.safeDeleteChannel(session.tempChannel, '게임 취소').catch(console.error), 5000);
            }
            
            // 세션 정리
            session.players.forEach((player, id) => {
                mushroomGameSessions.delete(id);
            });
            mushroomMultiplayerSessions.delete(lobbyId);
            mushroomTempChannels.delete(lobbyId);
        } else {
            // 플레이어 목록 업데이트
            const playerList = Array.from(session.players.values())
                .map((p, i) => `${i + 1}. ${p.userName} ${p.isHost ? '(호스트)' : ''} ${p.ready ? '✅' : '⏳'}`)
                .join('\n');
            
            const updateEmbed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🍄 독버섯 게임 대기실')
                .setDescription(`${interaction.user.username}님이 나갔습니다.`)
                .addFields(
                    { name: '👥 참가자', value: playerList, inline: false },
                    { name: '🎮 게임 ID', value: lobbyId, inline: true }
                )
                .setFooter({ text: `${session.players.size}/4명` });
            
            await interaction.update({
                embeds: [updateEmbed]
            });
        }
    }
}

module.exports = {
    handleMushroomInteraction,
    mushroomGame,
    MushroomGameSystem,
    mushroomGameSessions,
    mushroomMatchmakingQueue,
    mushroomMultiplayerSessions,
    mushroomTempChannels
};