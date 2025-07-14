const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { createGameStartEmbed } = require('../../data/mushroomGameImproved');
const { WORD_LIST, ALL_WORDS } = require('../../data/wordList');
const spectatorBetting = require('../../data/spectatorBetting');
const channelCleanup = require('../../systems/channelCleanup');
const { validateWord, extractChosung, isHanBangWord, botWords } = require('../../utils/wordValidator');
const MinigameUI = require('../../utils/minigameUI');
const { applyGoldBonus } = require('../common/specialEffects');

// 워드게임 설정
const WORD_GAME = {
    초성게임: {
        초성목록: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'],
        난이도별초성: {
            쉬움: [['ㅅ', 'ㄹ'], ['ㄱ', 'ㅁ'], ['ㅂ', 'ㅅ']], // 2글자
            보통: [['ㅅ', 'ㅎ', 'ㅂ'], ['ㄱ', 'ㅅ', 'ㅈ'], ['ㅁ', 'ㄹ', 'ㅇ']], // 3글자
            어려움: [['ㅎ', 'ㄱ', 'ㅅ', 'ㅈ'], ['ㅂ', 'ㄹ', 'ㅁ', 'ㅊ']] // 4글자
        },
        timeLimit: 15000, // 15초
        rewards: { 1: 10000, 2: 3000, 3: 1000 }
    },
    끝말잇기: {
        startWords: ['사과', '바나나', '컴퓨터', '김치', '한국', '게임', '친구', '학교', '음악', '영화'],
        timeLimit: 10000, // 10초
        rewards: { 1: 10000, 2: 3000, 3: 1000 }
    },
    maxPlayers: 5,
    minPlayers: 2
};

// 워드게임 세션 관리
const wordGameSessions = new Map();
const wordGameQueues = new Map(); // 대기열
const tempGameChannels = new Map();

// 게임 봇 생성
function createGameBot(name, difficulty = '보통') {
    const difficulties = {
        쉬움: { errorRate: 0.3, responseTime: { min: 3000, max: 10000 } },
        보통: { errorRate: 0.2, responseTime: { min: 2000, max: 8000 } },
        어려움: { errorRate: 0.1, responseTime: { min: 1000, max: 5000 } }
    };
    
    return {
        id: `bot_${Date.now()}_${Math.random()}`,
        name: name,
        isBot: true,
        difficulty: difficulty,
        ...difficulties[difficulty],
        vocabulary: botWords[difficulty] || []
    };
}

class WordGamesSystem {
    constructor() {
        this.sessions = wordGameSessions;
        this.queues = wordGameQueues;
        
        // 5분마다 오래된 세션 정리
        setInterval(() => {
            this.cleanupOldSessions();
        }, 5 * 60 * 1000);
    }
    
    // 오래된 세션 정리
    async cleanupOldSessions() {
        const now = Date.now();
        const timeout = 10 * 60 * 1000; // 10분
        
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.createdAt && (now - session.createdAt) > timeout) {
                console.log(`[WordGames] 오래된 세션 정리: ${sessionId}`);
                
                // 채널 삭제
                if (session.channel) {
                    try {
                        await channelCleanup.safeDeleteChannel(session.channel, '세션 타임아웃');
                    } catch (error) {
                        console.error('[WordGames] 채널 삭제 실패:', error);
                    }
                }
                
                // 세션 삭제
                this.sessions.delete(sessionId);
                
                // 플레이어 대기열 정리
                if (session.players) {
                    const playerArray = session.players instanceof Map ? Array.from(session.players.values()) : session.players;
                    playerArray.forEach(player => {
                        this.queues.delete(player.id);
                    });
                }
            }
        }
    }

    // 메인 메뉴
    async showMainMenu(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setTitle('🔤 워드 게임')
            .setDescription(
                '**🎯 게임 방식**: 단어를 활용한 두뇌 싸움!\n' +
                '**🔤 초성게임**: 제시된 초성에 맞는 단어를 가장 빨리 맞추기\n' +
                '**🔗 끝말잇기**: 이전 단어의 끝 글자로 시작하는 단어 이어가기\n\n' +
                '🎮 **플레이 모드를 선택하세요!**'
            )
            .addFields(
                { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '🎯 총 승리', value: `${(user.wordGameStats?.chosung?.wins || 0) + (user.wordGameStats?.wordchain?.wins || 0)}회`, inline: true },
                { name: '🔥 최근 성적', value: `${user.wordGameStats?.recentPerformance || '-'}`, inline: true },
                { name: '🔤 초성게임', value: `${user.wordGameStats?.chosung?.wins || 0}승`, inline: true },
                { name: '🔗 끝말잇기', value: `${user.wordGameStats?.wordchain?.wins || 0}승`, inline: true },
                { name: '🏆 승률', value: `${this.calculateWinRate(user)}%`, inline: true }
            )
            .setColor('#4169E1');

        const gameButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('word_multi')
                    .setLabel('⚔️ 워드게임 시작')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('word_stats')
                    .setLabel('📊 상세 통계')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [embed],
            components: [gameButtons]
        });
    }

    // 승률 계산
    calculateWinRate(user) {
        const stats = user.wordGameStats;
        if (!stats) return '0.0';
        
        const totalWins = (stats.chosung?.wins || 0) + (stats.wordchain?.wins || 0);
        const totalGames = (stats.chosung?.totalGames || 0) + (stats.wordchain?.totalGames || 0);
        
        if (totalGames === 0) return '0.0';
        return ((totalWins / totalGames) * 100).toFixed(1);
    }

    // 혼자하기 모드 선택
    async showSoloMode(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🌱 혼자하기 모드')
            .setDescription(
                '봇과 함께 워드 게임을 즐겨보세요!\n\n' +
                '**게임 선택**\n' +
                '🔤 **초성게임** - 제시된 초성에 맞는 단어 맞추기\n' +
                '🔗 **끝말잇기** - 이어지는 단어로 대결하기\n\n' +
                '**난이도 선택**\n' +
                '• 쉬움: 초보자를 위한 난이도\n' +
                '• 보통: 일반적인 난이도\n' +
                '• 어려움: 도전적인 난이도'
            )
            .setColor('#4169E1');

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('solo_chosung_easy')
                    .setLabel('🔤 초성게임 (쉬움)')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('solo_chosung_normal')
                    .setLabel('🔤 초성게임 (보통)')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('solo_chosung_hard')
                    .setLabel('🔤 초성게임 (어려움)')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('word_main')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        const buttons2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('solo_wordchain_easy')
                    .setLabel('🔗 끝말잇기 (쉬움)')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('solo_wordchain_normal')
                    .setLabel('🔗 끝말잇기 (보통)')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('solo_wordchain_hard')
                    .setLabel('🔗 끝말잇기 (어려움)')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.update({
            embeds: [embed],
            components: [buttons, buttons2]
        });
    }

    // 멀티플레이 모드 선택
    async showMultiMode(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('⚔️ 유저와 플레이')
            .setDescription(
                '다른 플레이어들과 함께 워드 게임을 즐겨보세요!\n\n' +
                '**게임 선택**\n' +
                '🔤 **초성게임** - 제시된 초성에 맞는 단어 맞추기\n' +
                '🔗 **끝말잇기** - 이어지는 단어로 대결하기\n\n' +
                '**게임 방식**\n' +
                '• 최소 2명, 최대 5명까지 참여 가능\n' +
                '• 부족한 인원은 봇이 채웁니다\n' +
                '• 우승자가 전체 상금을 획득합니다'
            )
            .setColor('#00CED1');

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('chosung_menu')
                    .setLabel('🔤 초성게임')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('wordchain_menu')
                    .setLabel('🔗 끝말잇기')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('word_main')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 초성게임 메뉴
    async showChosungMenu(interaction) {
        const queueSize = Array.from(this.queues.values()).filter(q => q.gameType === 'chosung').length;

        const embed = new EmbedBuilder()
            .setTitle('🔤 초성게임')
            .setDescription(
                '초성을 보고 해당하는 단어를 가장 빨리 맞추는 게임!\n\n' +
                '**게임 규칙**\n' +
                '• 제시된 초성에 맞는 단어를 입력\n' +
                '• 15초 안에 답해야 합니다\n' +
                '• 총 5라운드 진행\n' +
                '• 라운드가 진행될수록 난이도 상승\n\n' +
                `**현재 대기 중:** ${queueSize}명`
            )
            .setColor('#4169E1');

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('chosung_join')
                    .setLabel('🎮 참가하기')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('chosung_create')
                    .setLabel('🏠 방 만들기')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('word_main')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 끝말잇기 메뉴
    async showWordchainMenu(interaction) {
        const queueSize = Array.from(this.queues.values()).filter(q => q.gameType === 'wordchain').length;

        const embed = new EmbedBuilder()
            .setTitle('🔗 끝말잇기')
            .setDescription(
                '앞 사람이 말한 단어의 끝 글자로 시작하는 단어를 이어가는 게임!\n\n' +
                '**게임 규칙**\n' +
                '• 앞 단어의 마지막 글자로 시작하는 단어 입력\n' +
                '• 10초 안에 답해야 합니다\n' +
                '• 이미 사용된 단어는 사용 불가\n' +
                '• 2글자 이상의 명사만 가능\n' +
                '• 마지막까지 살아남은 사람이 승리\n\n' +
                `**현재 대기 중:** ${queueSize}명`
            )
            .setColor('#00CED1');

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('wordchain_join')
                    .setLabel('🎮 참가하기')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('wordchain_create')
                    .setLabel('🏠 방 만들기')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('word_multi')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 혼자하기 게임 시작
    async startSoloGame(interaction, gameType, difficulty) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        // 봇 플레이어 생성
        const bots = [
            createGameBot('🤖 AI 마스터', difficulty),
            createGameBot('🧠 두뇌왕', difficulty),
            createGameBot('💡 아이큐봇', difficulty),
            createGameBot('🎓 박사봇', difficulty)
        ];

        // 게임 세션 생성
        const sessionId = `solo_${gameType}_${interaction.user.id}_${Date.now()}`;
        const session = {
            id: sessionId,
            gameType: gameType,
            players: new Map(),
            currentPlayerIndex: 0,
            round: 1,
            maxRounds: 5,
            usedWords: new Set(),
            status: 'playing',
            isPrivate: true,
            difficulty: difficulty,
            createdAt: Date.now()
        };

        // 플레이어 추가
        session.players.set(interaction.user.id, {
            id: interaction.user.id,
            name: user.nickname || interaction.user.username,
            score: 0,
            isAlive: true,
            isReady: true
        });

        // 봇 추가 (난이도에 따라 개수 조정)
        const botCount = difficulty === 'easy' ? 1 : difficulty === 'normal' ? 2 : 3;
        for (let i = 0; i < botCount; i++) {
            const bot = bots[i];
            session.players.set(bot.id, {
                ...bot,
                score: 0,
                isAlive: true,
                isReady: true
            });
        }

        this.sessions.set(sessionId, session);

        // 게임 시작
        await interaction.update({
            content: `🎮 ${gameType === 'chosung' ? '초성게임' : '끝말잇기'} (${difficulty} 난이도) 시작!`,
            embeds: [],
            components: []
        });

        if (gameType === 'chosung') {
            await this.startChosungGame(interaction, session);
        } else {
            await this.startWordchainGame(interaction, session);
        }
    }

    // 게임 참가 (대기열)
    async joinQueue(interaction, gameType) {
        // 먼저 defer 처리
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }
        } catch (error) {
            console.error('[WordGames] joinQueue defer error:', error);
        }
        
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.editReply({ content: '❌ 등록되지 않은 사용자입니다.', embeds: [], components: [] });
        }

        const userId = interaction.user.id;
        const queueKey = `${gameType}_${interaction.guild.id}`;

        // 이미 대기 중인지 확인
        if (this.queues.has(userId)) {
            return interaction.editReply({ content: '❌ 이미 게임 대기 중입니다!', embeds: [], components: [] });
        }

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
        
        // 미니게임 대기실 찾기 또는 생성
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

        // 대기열에 추가
        this.queues.set(userId, {
            user: user,
            interaction: interaction,
            gameType: gameType,
            joinedAt: Date.now()
        });

        // 같은 게임 타입의 대기자들 확인
        const waitingPlayers = Array.from(this.queues.entries())
            .filter(([id, data]) => data.gameType === gameType)
            .map(([id, data]) => ({
                id: id,
                name: data.user.nickname || data.interaction.user.username,
                user: data.user,
                interaction: data.interaction
            }));

        // 원래 채널에 안내 메시지
        await interaction.editReply({
            content: `🔤 ${gameType === 'chosung' ? '초성게임' : '끝말잇기'} 대기 중!\n<#${minigameChannel.id}>에서 다른 플레이어를 기다리고 있습니다.`,
            embeds: [],
            components: []
        });

        // 최소 인원이 모이면 게임 시작
        if (waitingPlayers.length >= WORD_GAME.minPlayers) {
            // 대기열에서 제거
            waitingPlayers.forEach(p => this.queues.delete(p.id));

            // 게임 시작
            if (gameType === 'chosung') {
                await this.startChosungGame(minigameChannel, waitingPlayers);
            } else {
                await this.startWordchainGame(minigameChannel, waitingPlayers);
            }
        } else {
            // 대기실에 대기 메시지
            const sessionId = `word_${gameType}_${userId}_${Date.now()}`;
            const waitEmbed = new EmbedBuilder()
                .setTitle(`🔤 ${gameType === 'chosung' ? '초성게임' : '끝말잇기'} 대기실`)
                .setDescription(`**호스트**: ${user.nickname || interaction.user.username}`)
                .addFields(
                    { name: '🎮 게임', value: gameType === 'chosung' ? '초성게임' : '끝말잇기', inline: true },
                    { name: '👥 현재 인원', value: `${waitingPlayers.length}/${WORD_GAME.maxPlayers}명`, inline: true },
                    { name: '⏰ 대기 시간', value: '최대 30초', inline: true }
                )
                .setColor('#4169E1')
                .setFooter({ text: `${WORD_GAME.minPlayers}명이 모이면 호스트가 시작할 수 있습니다!` });

            const gameButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`word_join_${sessionId}`)
                        .setLabel('🎮 참가하기')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`word_start_${sessionId}`)
                        .setLabel('🎯 게임 시작')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(waitingPlayers.length < WORD_GAME.minPlayers),
                    new ButtonBuilder()
                        .setCustomId('word_cancel_queue')
                        .setLabel('❌ 대기 취소')
                        .setStyle(ButtonStyle.Danger)
                );

            const waitingMessage = await minigameChannel.send({
                embeds: [waitEmbed],
                components: [gameButtons]
            });

            // 대기 세션 정보 저장
            this.sessions.set(sessionId, {
                id: sessionId,
                type: gameType,
                gameType: gameType,
                hostId: userId,
                hostName: user.nickname || interaction.user.username,
                players: waitingPlayers,
                waitingMessage: waitingMessage,
                channelId: minigameChannel.id,
                status: 'waiting',
                betAmount: null
            });

            // 30초 후 자동 취소
            setTimeout(() => {
                if (this.queues.has(userId)) {
                    this.queues.delete(userId);
                    minigameChannel.send(`⏰ **${user.nickname || interaction.user.username}**님의 대기 시간이 초과되었습니다.`).catch(() => {});
                }
            }, 30000);
        }
    }

    // 방 만들기
    async createRoom(interaction, gameType) {
        // 먼저 defer 처리
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }
        } catch (error) {
            console.error('[WordGames] createRoom defer error:', error);
        }
        
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.editReply({ content: '❌ 등록되지 않은 사용자입니다.', embeds: [], components: [] });
        }
        
        const userId = interaction.user.id;
        
        // 이미 진행 중인 게임이나 대기 중인지 확인
        if (this.sessions.has(userId) || this.queues.has(userId)) {
            return interaction.editReply({ 
                content: '❌ 이미 진행 중인 게임이나 대기 중인 방이 있습니다!',
                embeds: [],
                components: []
            });
        }

        // 게임 카테고리 찾기 또는 생성
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

        // 대기실 채널 사용 (미니게임 대기실)
        const gameTypeKr = gameType === 'chosung' ? '초성게임' : '끝말잇기';
        const players = [{ id: userId, name: user.nickname || interaction.user.username }];
        
        // 미니게임 대기실 찾기 또는 생성
        let waitingChannel = guild.channels.cache.find(
            c => c.name === '🎮-대기실' && c.parentId === gameCategory.id
        );
        
        if (!waitingChannel) {
            waitingChannel = await guild.channels.create({
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
        
        // 채널 정리 시스템에 등록
        channelCleanup.registerChannel(waitingChannel, `${gameTypeKr} 대기실`, user.nickname || interaction.user.username);

        // 세션 ID 생성
        const sessionId = `word_${gameType}_${userId}_${Date.now()}`;
        
        // 대기실 세션 생성
        const session = {
            id: sessionId,
            type: gameType,
            hostId: userId,
            hostName: user.nickname || interaction.user.username,
            players: new Map([[userId, {
                id: userId,
                name: user.nickname || interaction.user.username,
                user: user,
                ready: true,
                isHost: true
            }]]),
            status: 'waiting',
            waitingChannel: waitingChannel,
            originalChannelId: interaction.channel.id,
            betAmount: null,
            createdAt: Date.now()
        };
        
        // 세션 저장
        this.sessions.set(sessionId, session);
        this.sessions.set(userId, session);
        wordGameSessions.set(sessionId, session);

        // 대기실 메시지
        const waitingEmbed = new EmbedBuilder()
            .setTitle(`🔤 ${gameTypeKr} 대기실`)
            .setDescription(`**호스트**: ${user.nickname || interaction.user.username}`)
            .addFields(
                { name: '🎮 게임', value: gameTypeKr, inline: true },
                { name: '👥 현재 인원', value: `${session.players.size}/${WORD_GAME.maxPlayers}명`, inline: true },
                { name: '💰 배팅금', value: '미설정', inline: true },
                { name: '⏰ 대기 시간', value: '최대 60초', inline: true },
                { name: '👥 참여자', value: `• ${user.nickname || interaction.user.username}`, inline: false }
            )
            .setColor('#4169E1')
            .setFooter({ text: '2명 이상이 모이고 배팅금이 설정되면 시작할 수 있습니다!' });

        const waitingButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`word_bet_${sessionId}`)
                    .setLabel('💰 배팅금 설정')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`word_join_${sessionId}`)
                    .setLabel('🎮 참가하기')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`word_start_${sessionId}`)
                    .setLabel('🎯 게임 시작')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true), // 2명 + 배팅금 설정 후 활성화
                new ButtonBuilder()
                    .setCustomId(`word_spectate_${sessionId}`)
                    .setLabel('👁️ 관전자로 참여')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`word_leave_${sessionId}`)
                    .setLabel('🚪 나가기')
                    .setStyle(ButtonStyle.Danger)
            );

        const waitingMessage = await waitingChannel.send({
            embeds: [waitingEmbed],
            components: [waitingButtons]
        });
        
        session.waitingMessage = waitingMessage;
        session.waitingMessageId = waitingMessage.id;

        // 원래 채널에 안내
        await interaction.editReply({
            content: `🎮 ${gameTypeKr} 대기실이 생성되었습니다!\n<#${waitingChannel.id}>로 이동하세요!`,
            embeds: [],
            components: []
        });

        // 60초 후 자동 삭제
        setTimeout(async () => {
            if (this.sessions.has(sessionId) && session.status === 'waiting') {
                try {
                    await channelCleanup.safeDeleteChannel(waitingChannel, '대기 시간 초과');
                    this.sessions.delete(sessionId);
                    this.sessions.delete(userId);
                    wordGameSessions.delete(sessionId);
                } catch (error) {
                    console.error('대기실 삭제 실패:', error);
                }
            }
        }, 60000);
    }

    // 대기실 메시지 업데이트
    async updateWaitingMessage(session) {
        // players가 Map인지 배열인지 확인
        let playerList, playerCount;
        
        if (session.players instanceof Map) {
            playerList = Array.from(session.players.values())
                .map(p => `• ${p.name}`)
                .join('\n');
            playerCount = session.players.size;
        } else if (Array.isArray(session.players)) {
            playerList = session.players
                .map(p => `• ${p.name}`)
                .join('\n');
            playerCount = session.players.length;
        } else {
            playerList = '없음';
            playerCount = 0;
        }
        
        const gameTypeKr = session.type === 'chosung' ? '초성게임' : '끝말잇기';
        
        const updatedEmbed = new EmbedBuilder()
            .setTitle(`🔤 ${gameTypeKr} 대기실`)
            .setDescription(`**호스트**: ${session.hostName || '알 수 없음'}`)
            .addFields(
                { name: '🎮 게임', value: gameTypeKr, inline: true },
                { name: '👥 현재 인원', value: `${playerCount}/${WORD_GAME.maxPlayers}명`, inline: true },
                { name: '💰 배팅금', value: session.betAmount ? `${session.betAmount.toLocaleString()}G` : '미설정', inline: true },
                { name: '⏰ 대기 시간', value: '최대 60초', inline: true },
                { name: '👥 참여자', value: playerList || '없음', inline: false }
            )
            .setColor('#4169E1')
            .setFooter({ text: '2명 이상이 모이고 배팅금이 설정되면 시작할 수 있습니다!' });

        const waitingButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`word_bet_${session.id}`)
                    .setLabel('💰 배팅금 설정')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`word_join_${session.id}`)
                    .setLabel('🎮 참가하기')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(playerCount >= WORD_GAME.maxPlayers),
                new ButtonBuilder()
                    .setCustomId(`word_start_${session.id}`)
                    .setLabel('🎯 게임 시작')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(playerCount < WORD_GAME.minPlayers || !session.betAmount),
                new ButtonBuilder()
                    .setCustomId(`word_spectate_${session.id}`)
                    .setLabel('👁️ 관전자로 참여')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`word_leave_${session.id}`)
                    .setLabel('🚪 나가기')
                    .setStyle(ButtonStyle.Danger)
            );

        await session.waitingMessage.edit({
            embeds: [updatedEmbed],
            components: [waitingButtons]
        });
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
                    .setCustomId(`word_set_bet_${sessionId}_10000`)
                    .setLabel('10,000G')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`word_set_bet_${sessionId}_30000`)
                    .setLabel('30,000G')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`word_set_bet_${sessionId}_50000`)
                    .setLabel('50,000G')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`word_set_bet_${sessionId}_100000`)
                    .setLabel('100,000G')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`word_set_bet_${sessionId}_custom`)
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
        // defer 처리
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }
        } catch (error) {
            console.error('[WordGames] setBetAmount defer error:', error);
        }
        
        const session = this.sessions.get(sessionId);
        if (!session || session.hostId !== interaction.user.id) {
            return interaction.editReply({ 
                content: '❌ 오류가 발생했습니다.', 
                embeds: [],
                components: []
            });
        }
        
        if (amount === 'custom') {
            return interaction.editReply({
                content: '🛠️ 직접 설정 기능은 개발 중입니다.',
                embeds: [],
                components: []
            });
        }
        
        const betAmount = parseInt(amount);
        session.betAmount = betAmount;
        
        await interaction.editReply({
            content: `✅ 배팅금이 ${betAmount.toLocaleString()}G로 설정되었습니다.`,
            embeds: [],
            components: []
        });
        
        // 대기실 메시지 업데이트
        await this.updateWaitingMessage(session);
    }

    // 참가 처리
    async handleJoin(interaction, sessionId) {
        // 먼저 defer 처리
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: 64 });
            }
        } catch (error) {
            console.error('[WordGames] handleJoin defer error:', error);
        }
        
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'waiting') {
            return interaction.editReply({ 
                content: '❌ 유효하지 않은 게임 세션입니다.'
            });
        }
        
        const userId = interaction.user.id;
        
        // players가 Map인지 Array인지 확인
        const isPlayerInGame = session.players instanceof Map ? 
            session.players.has(userId) : 
            Array.isArray(session.players) && session.players.some(p => p.id === userId);
            
        if (isPlayerInGame) {
            return interaction.editReply({ 
                content: '❌ 이미 참가한 게임입니다.'
            });
        }
        
        const playerCount = session.players instanceof Map ? 
            session.players.size : 
            session.players.length;
            
        if (playerCount >= WORD_GAME.maxPlayers) {
            return interaction.editReply({ 
                content: '❌ 방이 가득 찼습니다.'
            });
        }
        
        if (session.betAmount) {
            const user = await User.findOne({ discordId: userId });
            if (!user || user.gold < session.betAmount) {
                return interaction.editReply({ 
                    content: `❌ 골드가 부족합니다. (필요: ${session.betAmount.toLocaleString()}G)`
                });
            }
        }
        
        const user = await User.findOne({ discordId: userId });
        const playerData = {
            id: userId,
            name: user.nickname || interaction.user.username,
            user: user,
            ready: true
        };
        
        // players가 Map인지 Array인지에 따라 다르게 처리
        if (session.players instanceof Map) {
            session.players.set(userId, playerData);
        } else if (Array.isArray(session.players)) {
            session.players.push(playerData);
        }
        
        await interaction.editReply({
            content: `✅ 게임에 참가했습니다!`
        });
        
        await this.updateWaitingMessage(session);
    }
    
    // 나가기 처리
    async handleLeave(interaction, sessionId) {
        // 먼저 defer 처리
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: 64 });
            }
        } catch (error) {
            console.error('[WordGames] handleLeave defer error:', error);
        }
        
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'waiting') {
            return interaction.editReply({ 
                content: '❌ 유효하지 않은 게임 세션입니다.'
            });
        }
        
        const userId = interaction.user.id;
        
        if (userId === session.hostId) {
            // 호스트가 나가면 게임 취소
            try {
                // 먼저 응답하고 채널 삭제
                await interaction.editReply({
                    content: '✅ 게임을 나갔습니다. 대기실이 삭제됩니다.'
                });
                
                await channelCleanup.safeDeleteChannel(session.waitingChannel, '호스트가 게임을 나갔습니다');
            } catch (error) {
                console.error('대기실 삭제 오류:', error);
            }
            
            this.sessions.delete(sessionId);
            this.sessions.delete(userId);
            wordGameSessions.delete(sessionId);
        } else {
            // 일반 플레이어가 나가는 경우
            if (session.players instanceof Map) {
                session.players.delete(userId);
            } else if (Array.isArray(session.players)) {
                session.players = session.players.filter(p => p.id !== userId);
            }
            
            await interaction.editReply({
                content: '✅ 게임을 나갔습니다.'
            });
            
            await this.updateWaitingMessage(session);
        }
    }
    
    // 게임 시작 처리
    async handleGameStart(interaction, sessionId) {
        // 먼저 defer 처리
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: 64 });
            }
        } catch (error) {
            console.error('[WordGames] handleGameStart defer error:', error);
        }
        
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'waiting') {
            return interaction.editReply({ 
                content: '❌ 유효하지 않은 게임 세션입니다.'
            });
        }
        
        if (interaction.user.id !== session.hostId) {
            return interaction.editReply({ 
                content: '❌ 호스트만 게임을 시작할 수 있습니다.'
            });
        }
        
        if (session.players.size < WORD_GAME.minPlayers) {
            return interaction.editReply({ 
                content: `❌ 최소 ${WORD_GAME.minPlayers}명이 필요합니다.`
            });
        }
        
        if (!session.betAmount) {
            return interaction.editReply({ 
                content: '❌ 배팅금을 설정해주세요.'
            });
        }
        
        session.status = 'starting';
        
        // 배팅금 차감
        for (const [playerId, playerData] of session.players) {
            const user = await User.findOne({ discordId: playerId });
            if (user) {
                user.gold -= session.betAmount;
                await user.save();
            }
        }
        
        await interaction.editReply({
            content: '🎮 게임을 시작합니다!'
        });
        
        // 게임 시작
        if (session.type === 'chosung') {
            await this.startChosungGame(session);
        } else {
            await this.startWordchainGame(session);
        }
    }
    
    // 관전자로 참여 처리
    async handleSpectate(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'waiting') {
            return interaction.reply({ 
                content: '❌ 유효하지 않은 게임 세션입니다.', 
                flags: 64 
            });
        }
        
        // 이미 플레이어인지 확인
        if (session.players.has(interaction.user.id)) {
            return interaction.editReply({ 
                content: '❌ 이미 플레이어로 참가 중입니다!'
            });
        }
        
        // 베팅금이 설정되었넸지 확인
        if (!session.betAmount) {
            return interaction.editReply({ 
                content: '❌ 아직 베팅금이 설정되지 않았습니다. 잠시 후 다시 시도해주세요.'
            });
        }
        
        // 관전자 베팅 UI 표시
        const bettingEmbed = new EmbedBuilder()
            .setTitle('🎰 관전자 베팅')
            .setDescription(
                `**${session.type === 'chosung' ? '초성게임' : '끝말잇기'}** 관전 베팅\n\n` +
                `💰 **배팅 가능 금액**\n` +
                `최소: 100G / 최대: 1,000,000G\n\n` +
                `🎮 **참가자 목록**\n` +
                Array.from(session.players.values()).map(p => `• ${p.name}`).join('\n') +
                `\n\n📌 베팅 금액을 선택한 후 승자를 예측해주세요!`
            )
            .setColor('#FFD700')
            .setFooter({ text: '게임이 시작되면 베팅이 마감됩니다!' });
        
        // 베팅 금액 버튼
        const amountButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`betting_${sessionId}_10000`)
                    .setLabel('1만')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('💰'),
                new ButtonBuilder()
                    .setCustomId(`betting_${sessionId}_50000`)
                    .setLabel('5만')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💎'),
                new ButtonBuilder()
                    .setCustomId(`betting_${sessionId}_100000`)
                    .setLabel('10만')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💎'),
                new ButtonBuilder()
                    .setCustomId(`betting_${sessionId}_500000`)
                    .setLabel('50만')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔥'),
                new ButtonBuilder()
                    .setCustomId(`betting_${sessionId}_1000000`)
                    .setLabel('100만')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('👑')
            );
        
        await interaction.editReply({
            embeds: [bettingEmbed],
            components: [amountButtons]
        });
    }

    // 초성게임 시작
    async startChosungGame(session) {
        const gameId = `chosung_${Date.now()}`;
        
        try {
            // 현재 채널을 게임 채널로 사용 (대기실 채널)
            const gameChannel = session.waitingChannel;
            const guild = gameChannel.guild;
            
            // 플레이어 정보 준비
            const players = Array.from(session.players.values()).map(p => ({
                id: p.userId || p.id,
                name: p.name
            }));
            
            // 플레이어에 인덱스 추가
            const playersWithIndex = Array.from(session.players.values()).map((p, idx) => ({
                ...p,
                score: 0,
                eliminated: false,
                order: idx
            }));
            
            // 관전자 베팅 풀은 나중에 생성 (관전자가 참여할 때)

            // 게임 세션 생성
            const gameSession = {
                id: gameId,
                type: 'chosung',
                channel: gameChannel, // 현재 채널 사용
                originalChannelId: session.originalChannelId,
                createdAt: Date.now(),
                players: players,
                betAmount: session.betAmount,
                totalPot: session.betAmount * session.players.size,
                currentRound: 1,
                maxRounds: 5,
                currentWord: null,
                usedWords: new Set(),
                roundAnswers: new Map(),
                turnTimer: null,
                state: 'starting'
            };
            
            this.sessions.set(gameId, gameSession);
            tempGameChannels.set(gameChannel.id, gameId);
            
            // 대기실 메시지 삭제
            if (session.waitingMessage) {
                try {
                    await session.waitingMessage.delete();
                } catch (error) {
                    console.error('대기실 메시지 삭제 실패:', error);
                }
            }

            // 게임 시작 메시지
            const startEmbed = new EmbedBuilder()
                .setTitle('🆕 초성게임 시작!')
                .setDescription('잠시 후 첫 번째 초성이 제시됩니다!')
                .addFields(
                    { name: '🎮 게임 종류', value: '초성게임', inline: true },
                    { name: '👥 참가자 수', value: `${players.length}명`, inline: true },
                    { name: '💰 총 상금', value: `${gameSession.totalPot.toLocaleString()}G`, inline: true },
                    { name: '🎯 총 라운드', value: `${gameSession.maxRounds} 라운드`, inline: true },
                    { name: '⏰ 제한 시간', value: spectatorBetting.hasSpectators(gameId) ? '20초 (관전자 보너스)' : '15초', inline: true }
                )
                .setColor('#4169E1');
            
            await gameChannel.send({ embeds: [startEmbed] });
            
            // 관전자 베팅은 관전자가 참여할 때 시작됨

            // 3초 후 첫 라운드 시작
            setTimeout(() => this.startChosungRound(gameSession), 3000);

        } catch (error) {
            console.error('초성게임 시작 오류:', error);
            // 원래 채널에 오류 알림
            const originalChannel = session.waitingChannel.guild.channels.cache.get(session.originalChannelId);
            if (originalChannel) {
                await originalChannel.send('❌ 게임 시작 중 오류가 발생했습니다.');
            }
        }
    }

    // 초성게임 라운드 시작
    async startChosungRound(session) {
        if (session.currentRound > session.maxRounds || session.players.filter(p => !p.eliminated).length < 2) {
            return await this.endWordGame(session);
        }

        // 첫 라운드 시작 시 베팅 마감
        if (session.currentRound === 1) {
            spectatorBetting.closeBetting(session.id);
        }

        // 난이도 선택
        const difficulty = session.currentRound <= 2 ? '쉬움' : session.currentRound <= 4 ? '보통' : '어려움';
        const chosungList = WORD_GAME.초성게임.난이도별초성[difficulty];
        const selectedChosung = chosungList[Math.floor(Math.random() * chosungList.length)];
        
        session.currentWord = selectedChosung.join('');
        session.roundAnswers.clear();
        session.roundStartTime = Date.now();

        const hasSpectators = spectatorBetting.hasSpectators(session.id);
        const timeLimitText = hasSpectators ? '20초' : '15초';
        
        const roundEmbed = new EmbedBuilder()
            .setColor('#4169E1')
            .setTitle(`📝 라운드 ${session.currentRound}`)
            .setDescription(`다음 초성에 맞는 단어를 입력하세요!`)
            .addFields(
                { name: '초성', value: `**${session.currentWord}**`, inline: false },
                { name: '제한시간', value: timeLimitText, inline: true },
                { name: '난이도', value: difficulty, inline: true }
            );
        
        await session.channel.send({ embeds: [roundEmbed] });

        // 라운드 초기화
        session.isProcessing = new Set(); // 각 플레이어별 처리 상태 추적
        
        // 메시지 수집기 생성
        const filter = m => session.players.some(p => p.id === m.author.id && !p.eliminated);
        const timeLimit = spectatorBetting.hasSpectators(session.id) ? 20000 : WORD_GAME.초성게임.timeLimit;
        const collector = session.channel.createMessageCollector({ 
            filter, 
            time: timeLimit 
        });

        collector.on('collect', async (message) => {
            const player = session.players.find(p => p.id === message.author.id);
            if (!player || player.eliminated || session.roundAnswers.has(player.id)) return;
            
            // 이미 처리 중인 플레이어면 무시
            if (session.isProcessing.has(player.id)) {
                return;
            }
            
            session.isProcessing.add(player.id); // 처리 시작

            try {
                const answer = message.content.trim();
                
                // 중복 답변 체크 (다른 플레이어가 이미 제출한 답변)
                const existingAnswers = Array.from(session.roundAnswers.values()).map(a => a.answer);
                if (existingAnswers.includes(answer)) {
                    await message.react('🚫');
                    await session.channel.send(`❌ **${player.name}**님! 다른 플레이어가 이미 제출한 단어입니다!`);
                    session.isProcessing.delete(player.id);
                    return;
                }
            
            // 초성 확인
            const isValidWord = await (global.validateWord || validateWordFallback)(answer);
            if (extractChosung(answer) === session.currentWord && isValidWord) {
                session.roundAnswers.set(player.id, {
                    answer: answer,
                    time: Date.now() - session.roundStartTime
                });

                await message.react('✅');
                
                // 모든 생존자가 답했는지 확인
                const alivePlayers = session.players.filter(p => !p.eliminated);
                if (session.roundAnswers.size >= alivePlayers.length) {
                    collector.stop('all_answered');
                }
            } else {
                await message.react('❌');
            }
            } catch (error) {
                console.error('초성게임 답변 처리 오류:', error);
                await message.react('⚠️');
            } finally {
                session.isProcessing.delete(player.id);
            }
        });

        collector.on('end', async (collected, reason) => {
            await this.processChosungRoundEnd(session);
        });

        // 봇 플레이어 답변 처리
        session.players.forEach(player => {
            if (player.isBot && !player.eliminated) {
                const responseTime = player.responseTime || { min: 2000, max: 8000 };
                const botThinkTime = Math.random() * (responseTime.max - responseTime.min) + responseTime.min;
                
                setTimeout(async () => {
                    if (!session.roundAnswers.has(player.id) && !player.eliminated) {
                        // 실수 확률
                        if (Math.random() < (player.errorRate || 0.2)) return;
                        
                        // 초성에 맞는 단어 찾기 (봇 단어 목록 사용)
                        const possibleWords = player.vocabulary.filter(word => 
                            extractChosung(word) === session.currentWord && 
                            !session.usedWords.has(word)
                        );
                        
                        if (possibleWords.length > 0) {
                            const word = possibleWords[Math.floor(Math.random() * possibleWords.length)];
                            
                            session.roundAnswers.set(player.id, {
                                answer: word,
                                time: Date.now() - session.roundStartTime
                            });
                            
                            await session.channel.send(`**${player.name}**: ${word}`);
                        }
                    }
                }, botThinkTime);
            }
        });

        // 15초 타이머 (관전자가 있으면 20초)
        const timerDuration = spectatorBetting.hasSpectators(session.id) ? 20000 : WORD_GAME.초성게임.timeLimit;
        session.turnTimer = setTimeout(() => {
            this.processChosungRoundEnd(session);
        }, timerDuration);
    }

    // 초성게임 라운드 종료
    async processChosungRoundEnd(session) {
        if (session.turnTimer) {
            clearTimeout(session.turnTimer);
            session.turnTimer = null;
        }

        // 결과 집계
        const results = Array.from(session.roundAnswers.entries())
            .map(([playerId, data]) => ({
                player: session.players.find(p => p.id === playerId),
                ...data
            }))
            .sort((a, b) => a.time - b.time);

        // 점수 부여 (1등: 3점, 2등: 2점, 3등: 1점)
        results.forEach((result, index) => {
            if (index < 3) {
                result.player.score += (3 - index);
            }
        });

        // 답을 못한 플레이어 탈락
        session.players.forEach(player => {
            if (!player.eliminated && !session.roundAnswers.has(player.id)) {
                player.eliminated = true;
            }
        });

        // 결과 표시
        const resultEmbed = new EmbedBuilder()
            .setTitle(`라운드 ${session.currentRound} 결과`)
            .setDescription(`정답 초성: **${session.currentWord}**`)
            .setColor('#32CD32');

        if (results.length > 0) {
            const resultText = results.slice(0, 3).map((r, i) => 
                `${['🥇', '🥈', '🥉'][i]} ${r.player.name}: ${r.answer} (${(r.time/1000).toFixed(1)}초)`
            ).join('\n');
            
            resultEmbed.addFields({ 
                name: '🏆 순위', 
                value: resultText || '답변 없음', 
                inline: false 
            });
        }

        // 현재 점수
        const scoreText = session.players
            .filter(p => !p.eliminated)
            .sort((a, b) => b.score - a.score)
            .map(p => `${p.name}: ${p.score}점`)
            .join('\n');
        
        resultEmbed.addFields({ 
            name: '📊 점수 현황', 
            value: scoreText || '없음', 
            inline: false 
        });

        await session.channel.send({ embeds: [resultEmbed] });

        // 다음 라운드 진행
        session.currentRound++;
        setTimeout(() => this.startChosungRound(session), 3000);
    }

    // 끝말잇기 시작
    async startWordchainGame(session) {
        const gameId = `wordchain_${Date.now()}`;
        
        try {
            // 현재 채널을 게임 채널로 사용 (대기실 채널)
            const gameChannel = session.waitingChannel;
            const guild = gameChannel.guild;
            
            // 플레이어 배열 생성
            const players = Array.from(session.players.values()).map((p, idx) => ({
                ...p,
                eliminated: false,
                order: idx,
                lastWord: null,
                consecutiveFails: 0
            }));
            
            // 관전자 베팅 풀 생성
            // 관전자 베팅 풀은 나중에 생성 (관전자가 참여할 때)

            // 게임 세션 생성
            const startWord = WORD_GAME.끝말잇기.startWords[Math.floor(Math.random() * WORD_GAME.끝말잇기.startWords.length)];
            const gameSession = {
                id: gameId,
                type: 'wordchain',
                channel: gameChannel, // 현재 채널 사용
                originalChannelId: session.originalChannelId,
                createdAt: Date.now(),
                players: players,
                betAmount: session.betAmount,
                totalPot: session.betAmount * session.players.size,
                currentPlayerIndex: 0,
                currentWord: startWord,
                usedWords: new Set([startWord]),
                turnTimer: null,
                state: 'playing',
                totalWords: 0,
                startTime: Date.now()
            };
            
            this.sessions.set(gameId, gameSession);
            tempGameChannels.set(gameChannel.id, gameId);
            
            // 대기실 메시지 삭제
            if (session.waitingMessage) {
                try {
                    await session.waitingMessage.delete();
                } catch (error) {
                    console.error('대기실 메시지 삭제 실패:', error);
                }
            }

            // 게임 시작 메시지
            const gameRules = [
                '✅ 사전에 있는 단어만 가능',
                '❌ 이미 사용한 단어 불가',
                '⚡ 한방단어 사용시 나머지 전원 탈락',
                '🎯 마지막 생존자가 승리!'
            ].join('\n');
            
            const startEmbed = new EmbedBuilder()
                .setTitle('🆕 끝말잇기 시작!')
                .setDescription(`시작 단어: **${startWord}**\n\n**게임 규칙:**\n${gameRules}`)
                .addFields(
                    { name: '🎮 게임 종류', value: '끝말잇기', inline: true },
                    { name: '👥 참가자 수', value: `${players.length}명`, inline: true },
                    { name: '💰 총 상금', value: `${gameSession.totalPot.toLocaleString()}G`, inline: true },
                    { name: '🎯 현재 차례', value: players[0].name, inline: true },
                    { name: '⏰ 제한 시간', value: '10초', inline: true },
                    { name: '💣 특수 규칙', value: '3연속 실패시 탈락!', inline: true }
                )
                .setColor('#00CED1');
            
            await gameChannel.send({ embeds: [startEmbed] });
            
            // 관전자 베팅은 관전자가 참여할 때 시작됨

            // 첫 턴 시작
            setTimeout(() => this.startWordchainTurn(gameSession), 3000);

        } catch (error) {
            console.error('끝말잇기 시작 오류:', error);
            // 원래 채널에 오류 알림
            const originalChannel = session.waitingChannel.guild.channels.cache.get(session.originalChannelId);
            if (originalChannel) {
                await originalChannel.send('❌ 게임 시작 중 오류가 발생했습니다.');
            }
        }
    }

    // 끝말잇기 턴 시작
    async startWordchainTurn(session) {
        const alivePlayers = session.players.filter(p => !p.eliminated);
        if (alivePlayers.length < 2) {
            return await this.endWordGame(session);
        }

        // 첫 턴 시작 시 베팅 마감
        if (session.totalWords === 0) {
            spectatorBetting.closeBetting(session.id);
        }

        // 턴 시작 시 초기화
        session.turnAnswered = false;
        session.isProcessing = false; // 메시지 처리 중복 방지

        // 현재 플레이어 찾기
        let currentPlayer = session.players[session.currentPlayerIndex];
        while (currentPlayer.eliminated) {
            session.currentPlayerIndex = (session.currentPlayerIndex + 1) % session.players.length;
            currentPlayer = session.players[session.currentPlayerIndex];
        }

        const lastChar = session.currentWord[session.currentWord.length - 1];
        const hasSpectators = spectatorBetting.hasSpectators(session.id);
        const timeLimitSeconds = hasSpectators ? 20 : 10;
        
        const turnEmbed = new EmbedBuilder()
            .setColor('#00CED1')
            .setTitle(`🎯 ${currentPlayer.name}님의 차례입니다!`)
            .setDescription(
                `**${currentPlayer.name}**님! **'${lastChar}'**(으)로 시작하는 단어를 입력하세요!\n` +
                `\n⏰ 제한시간: **${timeLimitSeconds}초** (5초부터 독촉)\n` +
                (hasSpectators ? `👁️ 관전자가 있어 시간이 연장되었습니다!\n` : '') +
                `💡 다른 플레이어들은 잠시 기다려주세요...`
            )
            .addFields(
                { name: '📝 현재 단어', value: `**${session.currentWord}**`, inline: true },
                { name: '⏱️ 제한 시간', value: `**${timeLimitSeconds}초**`, inline: true },
                { name: '👥 생존자', value: `**${alivePlayers.length}명**`, inline: true }
            )
            .setFooter({ text: `총 ${session.totalWords}개 단어 | 라운드 ${Math.floor(session.totalWords / session.players.length) + 1}` });

        await session.channel.send({ embeds: [turnEmbed] });

        // 5초 후 독촉 메시지 시작 (관전자 여부와 상관없이)
        const countdownMessages = [];
        const countdownDelay = timeLimitSeconds - 5; // 전체시간 - 5초
        const countdownTimer = setTimeout(async () => {
            for (let i = 5; i > 0; i--) {
                if (session.turnAnswered) break; // 이미 답변했으면 중단
                
                const urgentMsg = await session.channel.send(
                    `⏰ **${i}초** 남았습니다! 서두르세요! **${currentPlayer.name}**님!`
                );
                countdownMessages.push(urgentMsg);
                
                if (i > 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }, countdownDelay * 1000); // 초를 밀리초로 변환

        // 턴 종료 시 카운트다운 메시지 삭제를 위한 정리 함수
        session.cleanupCountdown = async () => {
            clearTimeout(countdownTimer);
            for (const msg of countdownMessages) {
                try {
                    await msg.delete();
                } catch (error) {
                    // 이미 삭제된 메시지 무시
                }
            }
        };

        // 봇 플레이어 처리
        if (currentPlayer.isBot) {
            const responseTime = currentPlayer.responseTime || { min: 2000, max: 8000 };
            const botThinkTime = Math.random() * (responseTime.max - responseTime.min) + responseTime.min;
            
            setTimeout(async () => {
                // 실수 확률
                if (Math.random() < (currentPlayer.errorRate || 0.2)) {
                    await this.processWordchainTimeout(session);
                    return;
                }

                // 봇 단어 목록에서 가능한 단어 찾기
                const possibleWords = currentPlayer.vocabulary.filter(word => 
                    word[0] === lastChar && 
                    !session.usedWords.has(word)
                );
                
                const validWords = possibleWords.filter(w => 
                    w.length >= 2 &&
                    !isHanBangWord(w)
                );

                if (validWords.length > 0) {
                    const word = validWords[Math.floor(Math.random() * Math.min(10, validWords.length))];
                    await session.channel.send(`**${currentPlayer.name}**: ${word}`);
                    await this.processWordchainAnswer(session, word);
                } else {
                    await this.processWordchainTimeout(session);
                }
            }, botThinkTime);
        } else {
            // 사용자 입력 대기
            const filter = m => m.author.id === currentPlayer.id;
            const timeLimit = spectatorBetting.hasSpectators(session.id) ? 20000 : WORD_GAME.끝말잇기.timeLimit;
            const collector = session.channel.createMessageCollector({ 
                filter, 
                time: timeLimit,
                max: 1
            });

            collector.on('collect', async (message) => {
                // 이미 처리 중이면 무시
                if (session.isProcessing || session.turnAnswered) {
                    return;
                }
                
                session.isProcessing = true; // 처리 시작
                
                try {
                    const answer = message.content.trim();
                    
                    // 답변 검증
                    session.turnAnswered = true; // 답변 처리 시작
                    
                    // 카운트다운 메시지 정리
                    if (session.cleanupCountdown) {
                        await session.cleanupCountdown();
                    }
                    
                    if (answer === session.currentWord) {
                        await message.react('🚫');
                        await session.channel.send(`❌ **${currentPlayer.name}**님! 이전 단어와 똑같은 단어는 사용할 수 없습니다!`);
                        currentPlayer.consecutiveFails = (currentPlayer.consecutiveFails || 0) + 1;
                        if (currentPlayer.consecutiveFails >= 3) {
                            await this.eliminatePlayer(session, currentPlayer, '3연속 실패');
                        } else {
                            await session.channel.send(`⚠️ 경고 ${currentPlayer.consecutiveFails}/3`);
                            setTimeout(() => this.startWordchainTurn(session), 2000);
                        }
                        session.isProcessing = false;
                        session.turnAnswered = false; // 다시 시도 가능
                        return;
                    }
                    
                    // 두음법칙 처리
                    const duumLaw = {
                        // ㄹ → ㅇ 변화 (i계열)
                        '리': ['이', '리'],  // 리발 → 이발
                        '료': ['요', '료'],  // 료금 → 요금
                        '류': ['유', '류'],  // 류도 → 유도
                        '력': ['역', '력'],  // 력사 → 역사
                        '련': ['연', '련'],  // 련습 → 연습
                        '렬': ['열', '렬'],  // 렬차 → 열차
                        '령': ['영', '령'],  // 령향 → 영향
                        '례': ['예', '례'],  // 례절 → 예절
                        '륜': ['윤', '륜'],  // 륜리 → 윤리
                        '률': ['율', '률'],  // 률법 → 율법
                        '륭': ['융', '륭'],  // 륭성 → 융성
                        '륵': ['늑', '륵'],  // 륵골 → 늑골
                        
                        // ㄹ → ㄴ 변화 (기타)
                        '로': ['노', '로'],  // 로동 → 노동
                        '루': ['누', '루'],  // 루각 → 누각
                        '라': ['나', '라'],  // 라침반 → 나침반
                        '래': ['내', '래'],  // 래일 → 내일
                        '람': ['남', '람'],  // 람색 → 남색
                        '랑': ['낭', '랑'],  // 랑만 → 낭만
                        
                        // ㄴ → ㅇ 변화 (i계열)
                        '녀': ['여', '녀'],  // 녀성 → 여성
                        '년': ['연', '년'],  // 년대 → 연대
                        '념': ['염', '념'],  // 념불 → 염불
                        '뇨': ['요', '뇨'],  // 뇨도 → 요도
                        '닉': ['익', '닉'],  // 닉명 → 익명
                        '냥': ['양', '냥']   // 냥반 → 양반
                    };
                    
                    // 두음법칙 체크
                    let isValidStart = false;
                    if (answer[0] === lastChar) {
                        isValidStart = true;
                    } else if (duumLaw[lastChar]) {
                        // 두음법칙 적용 가능한 글자인지 확인
                        isValidStart = duumLaw[lastChar].includes(answer[0]);
                    }
                    
                    if (!isValidStart) {
                    await message.react('❌');
                    let startHint = `'${lastChar}'`;
                    if (duumLaw[lastChar]) {
                        startHint = duumLaw[lastChar].join(' 또는 ');
                    }
                    await session.channel.send(`❌ **${currentPlayer.name}**님! ${startHint}로 시작해야 합니다!`);
                    currentPlayer.consecutiveFails = (currentPlayer.consecutiveFails || 0) + 1;
                    if (currentPlayer.consecutiveFails >= 3) {
                        await this.eliminatePlayer(session, currentPlayer, '3연속 실패');
                    } else {
                        await session.channel.send(`⚠️ 경고 ${currentPlayer.consecutiveFails}/3`);
                        // 다시 차례 주기
                        setTimeout(() => this.startWordchainTurn(session), 2000);
                    }
                    session.isProcessing = false;
                    session.turnAnswered = false; // 다시 시도 가능
                    return; // 여기서 리턴하여 다음 처리 방지
                } else if (session.usedWords.has(answer)) {
                    await message.react('❌');
                    await session.channel.send(`❌ **${currentPlayer.name}**님! 이미 사용된 단어입니다!`);
                    currentPlayer.consecutiveFails = (currentPlayer.consecutiveFails || 0) + 1;
                    if (currentPlayer.consecutiveFails >= 3) {
                        await this.eliminatePlayer(session, currentPlayer, '3연속 실패');
                    } else {
                        await session.channel.send(`⚠️ 경고 ${currentPlayer.consecutiveFails}/3`);
                        setTimeout(() => this.startWordchainTurn(session), 2000);
                    }
                    session.isProcessing = false;
                    session.turnAnswered = false; // 다시 시도 가능
                    return;
                } else if (!(await validateWord(answer))) {
                    await message.react('❌');
                    await session.channel.send(`❌ **${currentPlayer.name}**님! 사전에 없는 단어입니다!`);
                    currentPlayer.consecutiveFails = (currentPlayer.consecutiveFails || 0) + 1;
                    if (currentPlayer.consecutiveFails >= 3) {
                        await this.eliminatePlayer(session, currentPlayer, '3연속 실패');
                    } else {
                        await session.channel.send(`⚠️ 경고 ${currentPlayer.consecutiveFails}/3`);
                        setTimeout(() => this.startWordchainTurn(session), 2000);
                    }
                    session.isProcessing = false;
                    session.turnAnswered = false; // 다시 시도 가능
                    return;
                } else if (isHanBangWord(answer)) {
                    await message.react('⚡');
                    await session.channel.send(`⚡ **${currentPlayer.name}**님이 한방 단어를 사용했습니다! 나머지 모두 탈락!`);
                    // 한방 단어 사용자만 생존
                    session.players.forEach(p => {
                        if (p.id !== currentPlayer.id) {
                            p.eliminated = true;
                        }
                    });
                    await this.endWordGame(session);
                } else {
                    await message.react('✅');
                    currentPlayer.consecutiveFails = 0; // 성공하면 경고 초기화
                    
                    // 추가 보너스 체크
                    let bonus = '';
                    if (answer.length >= 5) {
                        bonus = ' 🌟 (긴 단어 보너스!)';
                    } else if (answer.length === 2 && Math.random() < 0.3) {
                        bonus = ' 💀 (2글자 단어는 위험해요!)';
                    }
                    
                    if (bonus) {
                        await session.channel.send(`✨ ${bonus}`);
                    }
                    
                    await this.processWordchainAnswer(session, answer);
                }
                } catch (error) {
                    console.error('끝말잇기 답변 처리 오류:', error);
                    session.isProcessing = false;
                    session.turnAnswered = false;
                    // 에러 발생 시에도 게임 진행
                    await message.react('⚠️');
                    await this.processWordchainAnswer(session, message.content.trim());
                } finally {
                    session.isProcessing = false;
                }
            });

            collector.on('end', async (collected, reason) => {
                if (collected.size === 0) {
                    await this.processWordchainTimeout(session);
                }
            });

            // 타이머 설정 (관전자가 있으면 20초)
            session.turnTimer = setTimeout(() => {
                collector.stop('timeout');
            }, timeLimit);
        }
    }

    // 끝말잇기 답변 처리
    async processWordchainAnswer(session, word) {
        if (session.turnTimer) {
            clearTimeout(session.turnTimer);
            session.turnTimer = null;
        }

        // 턴 답변 완료 표시 및 카운트다운 정리
        session.turnAnswered = true;
        if (session.cleanupCountdown) {
            await session.cleanupCountdown();
        }

        session.currentWord = word;
        session.usedWords.add(word);
        session.totalWords++;
        
        const currentPlayer = session.players[session.currentPlayerIndex];
        currentPlayer.lastWord = word;
        currentPlayer.consecutiveFails = 0;

        // 특수 이벤트 체크
        const events = [];
        
        // 10단어마다 특별 이벤트
        if (session.totalWords % 10 === 0) {
            events.push('🎉 10단어 돌파! 속도가 빨라집니다!');
        }
        
        // 같은 글자로 시작하고 끝나는 단어
        if (word[0] === word[word.length - 1] && word.length > 2) {
            events.push('🔄 순환 단어! 보너스 포인트!');
        }
        
        // 5글자 이상 단어
        if (word.length >= 5) {
            events.push(`📏 ${word.length}글자 단어! 다음 사람 압박!`);
        }
        
        // 20단어마다 생존자 보너스
        if (session.totalWords % 20 === 0) {
            events.push('🏆 20단어 돌파! 생존자 전원 보너스!');
        }
        
        // 이벤트 메시지 출력
        if (events.length > 0) {
            const eventEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎊 특별 이벤트!')
                .setDescription(events.join('\n'))
                .setFooter({ text: `현재 ${session.totalWords}개 단어 진행` });
            await session.channel.send({ embeds: [eventEmbed] });
        }

        // 다음 플레이어로
        session.currentPlayerIndex = (session.currentPlayerIndex + 1) % session.players.length;
        
        // 1.5초 후 다음 턴
        setTimeout(() => this.startWordchainTurn(session), 1500);
    }

    // 끝말잇기 시간 초과
    async processWordchainTimeout(session) {
        // 카운트다운 정리
        if (session.cleanupCountdown) {
            await session.cleanupCountdown();
        }

        const currentPlayer = session.players[session.currentPlayerIndex];
        currentPlayer.consecutiveFails = (currentPlayer.consecutiveFails || 0) + 1;
        
        if (currentPlayer.consecutiveFails >= 3) {
            await this.eliminatePlayer(session, currentPlayer, '3연속 시간 초과');
        } else {
            await session.channel.send(`⏰ **${currentPlayer.name}**님 시간 초과! ⚠️ 경고 ${currentPlayer.consecutiveFails}/3`);
            // 다음 턴으로
            session.currentPlayerIndex = (session.currentPlayerIndex + 1) % session.players.length;
            setTimeout(() => this.startWordchainTurn(session), 2000);
        }
    }

    // 플레이어 탈락 처리
    async eliminatePlayer(session, player, reason) {
        player.eliminated = true;
        
        const eliminateEmbed = new EmbedBuilder()
            .setTitle('💀 탈락!')
            .setDescription(`**${player.name}**님이 탈락했습니다!\n사유: ${reason}`)
            .setColor('#FF0000');
        
        await session.channel.send({ embeds: [eliminateEmbed] });
        
        // 다음 플레이어로
        session.currentPlayerIndex = (session.currentPlayerIndex + 1) % session.players.length;
        
        // 게임 계속 진행
        setTimeout(() => this.startWordchainTurn(session), 2000);
    }

    // 게임 종료
    async endWordGame(session) {
        // 승자 결정
        let winners;
        if (session.type === 'chosung') {
            // 초성게임: 점수 기준
            const maxScore = Math.max(...session.players.map(p => p.score));
            winners = session.players.filter(p => p.score === maxScore);
        } else {
            // 끝말잇기: 생존자
            winners = session.players.filter(p => !p.eliminated);
        }

        // 결과 임베드
        const endEmbed = new EmbedBuilder()
            .setTitle('🏆 게임 종료!')
            .setColor('#FFD700');
        
        let winnerId = null;
        let winnerName = null;
        let losers = [];

        if (winners.length === 1) {
            const winner = winners[0];
            winnerId = winner.id;
            winnerName = winner.name;
            endEmbed.setDescription(`🎉 **${winner.name}**님이 우승했습니다!`);
            
            // 배팅금 전체 획듍 (봇 제외)
            if (!winner.isBot && session.totalPot) {
                const user = await User.findOne({ discordId: winner.id });
                if (user) {
                    // 칭호 효과 적용
                    const originalReward = session.totalPot;
                    const goldReward = applyGoldBonus(session.totalPot, user);
                    const bonusAmount = goldReward - originalReward;
                    
                    user.gold += goldReward;
                    
                    // 통계 업데이트
                    if (!user.wordGameStats) {
                        user.wordGameStats = { chosung: { wins: 0, totalGames: 0 }, wordchain: { wins: 0, totalGames: 0 } };
                    }
                    user.wordGameStats[session.type].wins++;
                    user.wordGameStats[session.type].totalGames++;
                    
                    // gameStats 업데이트
                    if (!user.gameStats) user.gameStats = {};
                    const gameType = session.type === 'chosung' ? 'chosung' : 'wordchain';
                    if (!user.gameStats[gameType]) user.gameStats[gameType] = { played: 0, won: 0 };
                    user.gameStats[gameType].played++;
                    user.gameStats[gameType].won++;
                    
                    await user.save();
                    
                    // 미션 진행도 업데이트
                    const MissionHelper = require('../../utils/missionHelper');
                    await MissionHelper.updateMiniGame(winner.id);
                    await MissionHelper.updateGoldEarned(winner.id, goldReward);
                    
                    endEmbed.addFields({ 
                        name: '💰 획득 상금', 
                        value: `${goldReward.toLocaleString()}G` + (bonusAmount > 0 ? `\n🏷️ 칭호 효과 +${bonusAmount.toLocaleString()}G` : ''), 
                        inline: true 
                    });
                }
            }
            
            // 패배자 목록 및 통계 업데이트
            losers = session.players.filter(p => p.id !== winnerId && !p.isBot);
            
            // 패자들의 gameStats 업데이트
            for (const loser of losers) {
                const loserUser = await User.findOne({ discordId: loser.id });
                if (loserUser) {
                    if (!loserUser.gameStats) loserUser.gameStats = {};
                    const gameType = session.type === 'chosung' ? 'chosung' : 'wordchain';
                    if (!loserUser.gameStats[gameType]) loserUser.gameStats[gameType] = { played: 0, won: 0 };
                    loserUser.gameStats[gameType].played++;
                    await loserUser.save();
                }
            }
            
        } else if (winners.length > 1) {
            endEmbed.setDescription(`🤝 무승부!\n우승자: ${winners.map(w => w.name).join(', ')}`);
        } else {
            endEmbed.setDescription('😢 승자가 없습니다...');
        }

        // 게임 통계
        if (session.type === 'chosung') {
            const stats = session.players
                .sort((a, b) => b.score - a.score)
                .map((p, i) => `${i + 1}. ${p.name}: ${p.score}점`)
                .join('\n');
            
            endEmbed.addFields({ 
                name: '📊 최종 점수', 
                value: stats || '없음', 
                inline: false 
            });
        } else {
            const duration = Date.now() - session.startTime;
            const minutes = Math.floor(duration / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);
            
            endEmbed.addFields(
                { name: '⏱️ 게임 시간', value: `${minutes}분 ${seconds}초`, inline: true },
                { name: '📝 총 단어 수', value: `${session.totalWords}개`, inline: true }
            );
        }

        await session.channel.send({ embeds: [endEmbed] });

        // 관전자 베팅 결과 처리
        if (winners.length === 1 && !winners[0].isBot) {
            const gameResults = {
                winner: { id: winners[0].id, username: winners[0].name }
            };
            
            if (session.type === 'chosung') {
                gameResults.totalRounds = session.currentRound - 1;
                gameResults.perfectGame = winners[0].score === (session.currentRound - 1) * 3; // 모든 라운드 1등
            } else {
                gameResults.totalWords = session.totalWords;
                gameResults.duration = Date.now() - session.startTime;
            }
            
            const betResult = await spectatorBetting.resolvePool(session.id, gameResults);

            if (betResult) {
                const resultEmbed = spectatorBetting.createResultEmbed(session.id);
                await session.channel.send({ embeds: [resultEmbed] });
                
                // 당첨금 지급
                if (betResult.payouts && betResult.payouts instanceof Map) {
                    for (const [userId, payout] of betResult.payouts) {
                        const user = await User.findOne({ discordId: userId });
                        if (user) {
                            // 관전 베팅 당첨금에도 칭호 효과 적용
                            const goldReward = applyGoldBonus(payout, user);
                            user.gold += goldReward;
                            await user.save();
                            
                            // 미션 진행도 업데이트
                            const MissionHelper = require('../../utils/missionHelper');
                            await MissionHelper.updateGoldEarned(userId, payout);
                        }
                    }
                }
            }
        }

        // 원래 채널에 결과 알림
        const originalChannel = session.channel.guild.channels.cache.get(session.originalChannelId);
        if (originalChannel && winnerId) {
            const gameTypeKr = session.type === 'chosung' ? '초성게임' : '끝말잇기';
            const resultEmbed = new EmbedBuilder()
                .setTitle(`🎮 ${gameTypeKr} 결과!`)
                .setColor('#FFD700')
                .setDescription(
                    `## 🏆 **${winnerName}**님의 승리!\n` +
                    `### 🎊 축하합니다! ${gameTypeKr}의 챔피언이 되셨습니다!\n\n` +
                    (session.type === 'chosung' ? 
                        `**최종 점수**: ${winners[0].score}점\n` :
                        `**생존 라운드**: ${session.totalWords}개 단어\n`) +
                    `### 💰 배팅 결과\n` +
                    `**${winnerName}**: +${session.totalPot.toLocaleString()}G 💎 *대박! 모든 배팅금을 획듍!*\n`
                );
                
            if (losers.length > 0) {
                const loserText = losers.map(l => 
                    `**${l.name}**: -${session.betAmount.toLocaleString()}G 💸 *다음엔 꼭 이기세요!*`
                ).join('\n');
                
                resultEmbed.addFields({
                    name: '패배자',
                    value: loserText,
                    inline: false
                });
            }
            
            resultEmbed.addFields({
                name: '📊 게임 통계',
                value: session.type === 'chosung' ?
                    `총 ${session.maxRounds}라운드 진행` :
                    `총 ${session.totalWords}개 단어 사용`,
                inline: true
            });
            
            resultEmbed.setFooter({ text: `${gameTypeKr} - 두뇌 싸움의 결정판!` })
                .setTimestamp();
            
            await originalChannel.send({ embeds: [resultEmbed] });
        }

        // 게임 종료 버튼 (채널은 삭제하지 않음)
        const endButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('word_play_again')
                    .setLabel('🔄 다시 플레이')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        await session.channel.send({
            content: '게임이 종료되었습니다! 다시 플레이하시겠습니까?',
            components: [endButtons]
        });

        // 세션 정리 (채널은 유지)
        this.sessions.delete(session.id);
        tempGameChannels.delete(session.channel?.id);
    }


    // 통계 표시
    async showStats(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const stats = user.wordGameStats || { chosung: { wins: 0 }, wordchain: { wins: 0 } };

        const statsEmbed = new EmbedBuilder()
            .setTitle('📊 워드 게임 통계')
            .setDescription(`${user.nickname || interaction.user.username}님의 기록`)
            .addFields(
                { name: '🔤 초성게임 우승', value: `${stats.chosung.wins}회`, inline: true },
                { name: '🔗 끝말잇기 우승', value: `${stats.wordchain.wins}회`, inline: true },
                { name: '🏆 총 우승', value: `${stats.chosung.wins + stats.wordchain.wins}회`, inline: true }
            )
            .setColor('#9370DB')
            .setTimestamp();

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('word_main')
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
const wordGames = new WordGamesSystem();

// 인터랙션 핸들러
async function handleWordGamesInteraction(interaction) {
    const customId = interaction.customId;

    // 메인 메뉴
    if (customId === 'word_games' || customId === 'word_main') {
        return await wordGames.showMainMenu(interaction);
    }
    
    // 혼자하기 모드
    else if (customId === 'word_solo') {
        return await wordGames.showSoloMode(interaction);
    }
    
    // 멀티플레이 모드
    else if (customId === 'word_multi') {
        return await wordGames.showMultiMode(interaction);
    }
    
    // 혼자하기 게임 시작
    else if (customId.startsWith('solo_')) {
        const [, gameType, difficulty] = customId.split('_');
        return await wordGames.startSoloGame(interaction, gameType, difficulty);
    }
    
    // 초성게임 메뉴
    else if (customId === 'chosung_menu' || customId === 'chosung_game') {
        return await wordGames.showChosungMenu(interaction);
    }
    
    // 끝말잇기 메뉴
    else if (customId === 'wordchain_menu' || customId === 'wordchain_game') {
        return await wordGames.showWordchainMenu(interaction);
    }
    
    // 게임 참가
    else if (customId === 'chosung_join') {
        return await wordGames.joinQueue(interaction, 'chosung');
    }
    else if (customId === 'wordchain_join') {
        return await wordGames.joinQueue(interaction, 'wordchain');
    }
    
    // 방 만들기
    else if (customId === 'chosung_create') {
        return await wordGames.createRoom(interaction, 'chosung');
    }
    else if (customId === 'wordchain_create') {
        return await wordGames.createRoom(interaction, 'wordchain');
    }
    
    // 대기 취소
    else if (customId === 'word_cancel_queue') {
        wordGames.queues.delete(interaction.user.id);
        // defer 처리
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: 64 });
            }
            await interaction.editReply({
                content: '❌ 대기가 취소되었습니다.'
            });
        } catch (error) {
            console.error('[WordGames] cancel queue error:', error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: '❌ 대기가 취소되었습니다.',
                    ephemeral: true
                });
            }
        }
    }
    
    // 통계
    else if (customId === 'word_stats') {
        return await wordGames.showStats(interaction);
    }
    
    // 게임 참가
    else if (customId.startsWith('word_join_')) {
        const sessionId = customId.replace('word_join_', '');
        return await wordGames.handleJoin(interaction, sessionId);
    }
    
    // 게임 시작
    else if (customId.startsWith('word_start_')) {
        const sessionId = customId.replace('word_start_', '');
        return await wordGames.handleGameStart(interaction, sessionId);
    }
    
    // 나가기
    else if (customId.startsWith('word_leave_')) {
        const sessionId = customId.replace('word_leave_', '');
        return await wordGames.handleLeave(interaction, sessionId);
    }
    
    // 배팅금 선택
    else if (customId.startsWith('word_bet_')) {
        const sessionId = customId.replace('word_bet_', '');
        return await wordGames.showBetSelection(interaction, sessionId);
    }
    
    // 배팅금 설정
    else if (customId.startsWith('word_set_bet_')) {
        const prefix = 'word_set_bet_';
        const remaining = customId.substring(prefix.length);
        const lastUnderscoreIndex = remaining.lastIndexOf('_');
        const sessionId = remaining.substring(0, lastUnderscoreIndex);
        const amount = remaining.substring(lastUnderscoreIndex + 1);
        return await wordGames.setBetAmount(interaction, sessionId, amount);
    }
    
    // 관전자로 참여
    else if (customId.startsWith('word_spectate_')) {
        const { handleSpectatorInteraction } = require('../../systems/spectatorBettingHandler');
        const sessionId = customId.replace('word_spectate_', '');
        const session = wordGameQueues.get(sessionId) || wordGames.sessions.get(sessionId);
        
        if (!session) {
            // defer 처리
            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ flags: 64 });
                }
                return await interaction.editReply({ content: '❌ 게임을 찾을 수 없습니다.' });
            } catch (error) {
                console.error('[WordGames] spectate session error:', error);
                return interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
            }
        }
        
        // 게임 타입 확인
        const gameType = session.type || (sessionId.includes('chosung') ? 'chosung' : 'wordchain');
        return await handleSpectatorInteraction(interaction, gameType, session);
    }
    
    // 관전자 베팅 처리
    else if (customId.startsWith('spectator_bet_') || customId.startsWith('spectator_confirm_')) {
        const { handleSpectatorInteraction } = require('../../systems/spectatorBettingHandler');
        const gameId = customId.split('_')[2] || customId.split('_')[3];
        
        // 먼저 게임 세션에서 찾기
        let session = wordGameSessions.get(gameId);
        let gameType = 'wordchain';
        
        if (!session) {
            // 대기열에서 찾기
            session = wordGameQueues.get(gameId);
            if (session) {
                gameType = session.type || (gameId.includes('chosung') ? 'chosung' : 'wordchain');
            }
        } else {
            gameType = session.type || 'wordchain';
        }
        
        if (!session) {
            return interaction.reply({ content: '❌ 게임을 찾을 수 없습니다.', ephemeral: true });
        }
        
        return await handleSpectatorInteraction(interaction, gameType, session);
    }
}

// 세션 정리 함수
function cleanupGameSession(gameId) {
    const session = wordGameSessions.get(gameId);
    if (session) {
        // 타이머 정리
        if (session.turnTimer) clearTimeout(session.turnTimer);
        if (session.roundTimer) clearTimeout(session.roundTimer);
        
        // 임시 채널 삭제
        if (session.channel && !session.channel.deleted) {
            session.channel.delete('게임 종료').catch(console.error);
        }
        
        // 세션 삭제
        wordGameSessions.delete(gameId);
        tempGameChannels.delete(session.channel?.id);
        
        console.log(`[게임 세션 정리] ${gameId} 세션 정리 완료`);
    }
}

// 만료된 세션 자동 정리 (5분마다)
setInterval(() => {
    const now = Date.now();
    for (const [gameId, session] of wordGameSessions) {
        // 30분 이상된 세션 정리
        if (session.createdAt && now - session.createdAt > 30 * 60 * 1000) {
            console.log(`[세션 만료] ${gameId} - 30분 초과`);
            cleanupGameSession(gameId);
        }
    }
}, 5 * 60 * 1000);

module.exports = {
    handleWordGamesInteraction,
    wordGames,
    wordGamesSystem: wordGames,  // cleanupWordGames 명령어용
    WORD_GAME,
    cleanupGameSession,
    wordGameSessions
};