const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber, ADMIN_IDS } = require('../common/utils');
const { calculateCombatPower } = require('../common/combatPower');
const spectatorBetting = require('../../data/spectatorBetting');
const { createPVPWaitingRoom } = require('./pvpWaitingRoom');
const MissionHelper = require('../../utils/missionHelper');
const GAME_GIFS = require('../../data/gameGifs');

class PVPSystem {
    constructor() {
        this.matchmakingQueue = new Map();
        this.activeMatches = new Map();
        this.botUsers = new Map();
        this.tierRanges = {
            'Bronze': { min: 0, max: 1199 },
            'Silver': { min: 1200, max: 1399 },
            'Gold': { min: 1400, max: 1599 },
            'Platinum': { min: 1600, max: 1799 },
            'Master': { min: 1800, max: 1999 },
            'Grandmaster': { min: 2000, max: 2299 },
            'Challenger': { min: 2300, max: 9999 }
        };
        this.initializeBotUsers();
        
        // 오래된 매치 정리 (매 5분마다)
        setInterval(() => this.cleanupOldMatches(), 5 * 60 * 1000);
    }

    // 오래된 매치 정리
    cleanupOldMatches() {
        const now = Date.now();
        const timeout = 30 * 60 * 1000; // 30분
        
        for (const [matchId, match] of this.activeMatches.entries()) {
            if (now - match.startTime > timeout) {
                console.log(`[PVP] 오래된 매치 제거: ${matchId}`);
                if (match.roundTimer) {
                    clearTimeout(match.roundTimer);
                }
                // 임시 채널 삭제
                if (match.tempChannelCreated && match.pvpChannel) {
                    match.pvpChannel.delete().catch(console.error);
                }
                this.activeMatches.delete(matchId);
            }
        }
    }

    // 봇 유저 데이터 초기화
    async initializeBotUsers() {
        const botProfiles = [
            { name: '강화왕', rating: 1500, tier: 'Gold' },
            { name: '검성', rating: 1800, tier: 'Master' },
            { name: '마검사', rating: 1350, tier: 'Silver' },
            { name: '초보냥이', rating: 1000, tier: 'Bronze' },
            { name: '행운아', rating: 1600, tier: 'Platinum' }
        ];

        for (const profile of botProfiles) {
            this.botUsers.set(profile.name, {
                discordId: `bot_${profile.name}`,
                nickname: profile.name,
                pvp: { rating: profile.rating, tier: profile.tier },
                level: Math.floor(profile.rating / 100),
                stats: {
                    strength: 10 + Math.floor(profile.rating / 100),
                    agility: 10 + Math.floor(profile.rating / 100),
                    intelligence: 10 + Math.floor(profile.rating / 100),
                    vitality: 10 + Math.floor(profile.rating / 100),
                    luck: 10 + Math.floor(profile.rating / 100)
                },
                equipment: {},
                inventory: []
            });
        }
    }

    // 티어 계산
    getTierByRating(rating) {
        for (const [tier, range] of Object.entries(this.tierRanges)) {
            if (rating >= range.min && rating <= range.max) {
                return tier;
            }
        }
        return 'Bronze';
    }

    // 티어 이모지
    getTierEmoji(tier) {
        const emojis = {
            'Bronze': '🥉',
            'Silver': '🥈',
            'Gold': '🥇',
            'Platinum': '💎',
            'Master': '🏆',
            'Grandmaster': '👑',
            'Challenger': '🌟'
        };
        return emojis[tier] || '🥉';
    }

    // PVP 대기실 생성
    async createWaitingRoom(interaction, user) {
        return await createPVPWaitingRoom(interaction, user, this);
    }

    // 오프라인 상대 찾기
    async findOfflineOpponent(user) {
        const playerRating = user.pvp?.rating || 1000;
        
        try {
            // 적절한 레이팅의 유저들 찾기
            let opponents = await User.find({
                discordId: { $ne: user.discordId },
                'pvp.rating': { 
                    $gte: playerRating - 300, 
                    $lte: playerRating + 300 
                },
                registered: true
            }).limit(10);
            
            // 범위 확대
            if (opponents.length === 0) {
                opponents = await User.find({
                    discordId: { $ne: user.discordId },
                    'pvp.rating': { 
                        $gte: playerRating - 500, 
                        $lte: playerRating + 500 
                    },
                    registered: true
                }).limit(10);
            }
            
            // 그래도 없으면 아무나
            if (opponents.length === 0) {
                opponents = await User.find({
                    discordId: { $ne: user.discordId },
                    registered: true
                }).limit(10);
            }
            
            // 유저가 정말 없으면 기본 봇 사용
            if (opponents.length === 0) {
                return {
                    discordId: 'bot_초보냥이',
                    nickname: '초보냥이',
                    pvp: { rating: 1000, tier: 'Bronze' },
                    level: 10,
                    stats: {
                        strength: 10,
                        agility: 10,
                        intelligence: 10,
                        vitality: 10,
                        luck: 10
                    },
                    equipment: {},
                    inventory: []
                };
            }
            
            // 랜덤으로 한 명 선택
            return opponents[Math.floor(Math.random() * opponents.length)];
            
        } catch (error) {
            console.error('[PVP] 오프라인 상대 찾기 오류:', error);
            // 오류 시 기본 봇 반환
            return this.botUsers.get('초보냥이');
        }
    }

    // 매치메이킹 큐 참가
    async joinQueue(userId, user, channel) {
        if (this.matchmakingQueue.has(userId)) {
            return { success: false, message: '이미 매치메이킹 중입니다.' };
        }
        
        // pvp 객체 초기화
        if (!user.pvp) {
            user.pvp = {
                rating: 1000,
                tier: 'Bronze',
                duelTickets: 20,
                wins: 0,
                losses: 0,
                winStreak: 0,
                maxWinStreak: 0,
                highestRating: 1000,
                attackEnhancement: { high: 0, middle: 0, low: 0 }
            };
            await user.save();
        }

        if (!user.pvp.duelTickets || user.pvp.duelTickets < 1) {
            return { success: false, message: '결투권이 부족합니다!' };
        }

        // 큐에 추가
        this.matchmakingQueue.set(userId, {
            userId,
            user,
            rating: user.pvp.rating,
            tier: user.pvp.tier,
            timestamp: Date.now(),
            channel
        });

        // 결투권 차감
        user.pvp.duelTickets--;
        await user.save();
        
        // 매치메이킹 시작
        this.startMatchmaking(userId);
        
        return { 
            success: true, 
            message: '🔍 온라인 유저를 찾는 중... (20초 후 오프라인 유저와 매칭됩니다)', 
            tickets: user.pvp.duelTickets 
        };
    }
    
    // 매치메이킹 진행
    async startMatchmaking(userId) {
        const updateMatchmakingProgress = async () => {
            const currentPlayer = this.matchmakingQueue.get(userId);
            if (!currentPlayer) return;

            const waitTime = Date.now() - currentPlayer.timestamp;
            const waitSeconds = Math.floor(waitTime / 1000);
            
            // 시간에 따라 매칭 범위 확대
            const expandedRange = 200 + Math.floor(waitSeconds / 5) * 100;
            
            // 확대된 범위로 상대 찾기
            const opponent = this.findOpponentWithRange(currentPlayer, expandedRange);
            
            if (opponent) {
                this.matchmakingQueue.delete(userId);
                
                // 플레이어 매칭 성공 알림
                if (currentPlayer.channel) {
                    try {
                        const playerMatchEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('⚔️ 플레이어 매치 성사!')
                            .setDescription(`**${opponent.user.nickname}**님과 매칭되었습니다!`)
                            .addFields(
                                { name: '👤 상대', value: `${opponent.user.nickname} (${opponent.rating}점)`, inline: true },
                                { name: '📊 레이팅 차이', value: `±${Math.abs(currentPlayer.rating - opponent.rating)}점`, inline: true }
                            );
                        
                        await currentPlayer.channel.send({ embeds: [playerMatchEmbed] });
                        
                        // 상대방 채널에도 알림
                        if (opponent.channel && opponent.channel !== currentPlayer.channel) {
                            await opponent.channel.send({ embeds: [playerMatchEmbed] });
                        }
                    } catch (error) {
                        console.error('플레이어 매칭 성공 알림 전송 오류:', error);
                    }
                }
                
                await this.createMatch(currentPlayer, opponent);
                return;
            }
            
            // 20초 후에도 매칭이 안되면 봇 매칭
            if (waitTime >= 20000) {
                // 오프라인 매칭 시작 알림
                if (currentPlayer.channel) {
                    try {
                        const offlineMatchEmbed = new EmbedBuilder()
                            .setColor('#FFA500')
                            .setTitle('📊 오프라인 유저 매칭')
                            .setDescription(`데이터베이스에서 적절한 실력의 유저를 찾아 매칭합니다!`)
                            .addFields(
                                { name: '⏱️ 총 대기 시간', value: `${waitSeconds}초`, inline: true },
                                { name: '🎯 매칭 범위', value: `±${expandedRange}점`, inline: true },
                                { name: '🎮 전투 방식', value: '비동기 PVP', inline: true }
                            );
                        
                        await currentPlayer.channel.send({ embeds: [offlineMatchEmbed] });
                    } catch (error) {
                        console.error('오프라인 매칭 알림 전송 오류:', error);
                    }
                }
                
                this.createBotMatch(userId);
                return;
            }
            
            // 15초마다 진행 상황 알림
            if (waitSeconds % 15 === 0 && waitSeconds > 0) {
                if (currentPlayer.channel) {
                    try {
                        const progressEmbed = new EmbedBuilder()
                            .setColor('#3498db')
                            .setTitle('🔍 매칭 진행 중...')
                            .setDescription(`더 넓은 범위에서 상대를 찾고 있습니다!`)
                            .addFields(
                                { name: '⏱️ 대기 시간', value: `${waitSeconds}초`, inline: true },
                                { name: '🎯 현재 매칭 범위', value: `±${expandedRange}점`, inline: true },
                                { name: '⏳ 오프라인 매칭까지', value: `${Math.max(0, 20 - waitSeconds)}초`, inline: true }
                            );
                        
                        await currentPlayer.channel.send({ embeds: [progressEmbed] });
                    } catch (error) {
                        console.error('매칭 진행 알림 전송 오류:', error);
                    }
                }
            }
            
            // 5초 후 다시 확인
            setTimeout(updateMatchmakingProgress, 5000);
        };

        // 5초 후부터 매칭 상황 확인 시작
        setTimeout(updateMatchmakingProgress, 5000);

        const player = this.matchmakingQueue.get(userId);
        return {
            success: true,
            message: '매치메이킹을 시작합니다! 20초 동안 온라인 플레이어를 찾고, 못 찾으면 오프라인 유저와 매칭됩니다.',
            tickets: player ? player.user.pvp.duelTickets : 0
        };
    }

    // 큐에서 나가기
    leaveQueue(userId) {
        if (!this.matchmakingQueue.has(userId)) {
            return { success: false, message: '매치메이킹 중이 아닙니다.' };
        }

        this.matchmakingQueue.delete(userId);
        return { success: true, message: '매치메이킹을 취소했습니다.' };
    }

    // 지정된 범위로 상대 찾기
    findOpponentWithRange(player, maxRatingDiff) {
        let bestOpponent = null;
        let smallestDiff = Infinity;
        
        for (const [opponentId, opponent] of this.matchmakingQueue) {
            if (opponentId === player.userId) continue;
            
            const ratingDiff = Math.abs(player.rating - opponent.rating);
            if (ratingDiff <= maxRatingDiff && ratingDiff < smallestDiff) {
                bestOpponent = opponent;
                smallestDiff = ratingDiff;
            }
        }
        
        if (bestOpponent) {
            this.matchmakingQueue.delete(bestOpponent.userId);
            return bestOpponent;
        }
        
        return null;
    }

    // 오프라인 유저와 매치 생성 (기존 봇 매치를 대체)
    async createBotMatch(userId) {
        const player = this.matchmakingQueue.get(userId);
        if (!player) return;

        const playerRating = player.rating;
        
        try {
            // DB에서 적절한 레이팅의 유저들 찾기
            let opponents = await User.find({
                discordId: { $ne: player.user.discordId },
                'pvp.rating': { 
                    $gte: playerRating - 300, 
                    $lte: playerRating + 300 
                },
                registered: true
            }).limit(10);
            
            // 범위 확대
            if (opponents.length === 0) {
                opponents = await User.find({
                    discordId: { $ne: player.user.discordId },
                    'pvp.rating': { 
                        $gte: playerRating - 500, 
                        $lte: playerRating + 500 
                    },
                    registered: true
                }).limit(10);
            }
            
            // 그래도 없으면 아무나
            if (opponents.length === 0) {
                opponents = await User.find({
                    discordId: { $ne: player.user.discordId },
                    registered: true
                }).limit(10);
            }
            
            // 유저가 정말 없으면 기본 봇 사용
            if (opponents.length === 0) {
                const defaultBot = {
                    discordId: 'bot_default',
                    nickname: '초보냥이',
                    pvp: { rating: 1000, tier: 'Bronze' },
                    level: 10,
                    stats: {
                        strength: 10,
                        agility: 10,
                        intelligence: 10,
                        vitality: 10,
                        luck: 10
                    },
                    equipment: {},
                    inventory: []
                };
                opponents = [defaultBot];
            }
            
            // 랜덤으로 한 명 선택
            const opponent = opponents[Math.floor(Math.random() * opponents.length)];
            const ratingDiff = Math.abs(opponent.pvp.rating - playerRating);
            
            const opponentData = {
                userId: opponent.discordId,
                user: opponent,
                rating: opponent.pvp.rating,
                tier: opponent.pvp.tier,
                isBot: true,
                isOfflineUser: true
            };

            this.matchmakingQueue.delete(userId);
            
            // 매칭 알림
            if (player.channel) {
                try {
                    const matchFoundEmbed = new EmbedBuilder()
                        .setColor('#e67e22')
                        .setTitle('⚔️ 비동기 매치 성사!')
                        .setDescription(`**${opponent.nickname}**님의 데이터와 매칭되었습니다!`)
                        .addFields(
                            { name: '👤 상대', value: `${opponent.nickname} (${opponent.pvp.rating}점)`, inline: true },
                            { name: '📊 레이팅 차이', value: `±${ratingDiff}점`, inline: true },
                            { name: '🎮 전투 방식', value: '비동기 PVP', inline: true }
                        )
                        .setFooter({ text: '상대방은 오프라인이지만 실제 유저 데이터입니다!' });
                    
                    await player.channel.send({ embeds: [matchFoundEmbed] });
                } catch (error) {
                    console.error('오프라인 매칭 알림 전송 오류:', error);
                }
            }
            
            await this.createMatch(player, opponentData);
            
        } catch (error) {
            console.error('[PVP] 오프라인 유저 매칭 오류:', error);
            this.matchmakingQueue.delete(userId);
            if (player.channel) {
                await player.channel.send('❌ 매칭 시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            }
        }
    }

    // 매치 생성
    async createMatch(player1, player2) {
        const matchId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // 티켓은 이미 joinQueue에서 차감했으므로 중복 차감 방지

        // 플레이어 스탯 계산
        const p1Stats = this.calculateCombatStats(player1);
        const p2Stats = this.calculateCombatStats(player2);
        
        // PVP 임시 채널 생성
        let pvpChannel = null;
        try {
            const guild = player1.channel.guild;
            
            // PVP 카테고리 찾기 또는 생성
            let pvpCategory = guild.channels.cache.find(c => c.name === '🔥 PVP 경기장' && c.type === 4);
            if (!pvpCategory) {
                pvpCategory = await guild.channels.create({
                    name: '🔥 PVP 경기장',
                    type: 4,
                    reason: 'PVP 전용 카테고리'
                });
            }
            
            // 먼저 대기실 생성
            const player1Name = player1.isBot ? player1.user.nickname : player1.user.nickname || 'Player1';
            const player2Name = player2.isBot ? player2.user.nickname : player2.user.nickname || 'Player2';
            
            // 대기실 채널 생성
            const waitingChannel = await guild.channels.create({
                name: `⏳pvp-대기실-${matchId.substring(0, 8)}`,
                type: 0,
                parent: pvpCategory.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: ['ViewChannel', 'ReadMessageHistory'],
                        deny: ['SendMessages']
                    }
                ],
                reason: 'PVP 대기실'
            });
            
            // 대기실 메시지
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const waitingEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('⚔️ PVP 매치 대기실')
                .setDescription(`**${player1Name}** VS **${player2Name}**`)
                .addFields(
                    { name: '👤 플레이어 1', value: player1Name, inline: true },
                    { name: '👤 플레이어 2', value: player2Name, inline: true },
                    { name: '⏰ 상태', value: '잠시 후 경기가 시작됩니다!', inline: false }
                )
                .setFooter({ text: '관전자는 아래 버튼을 눌러 베팅에 참여하세요!' });
            
            const waitingButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`pvp_spectate_${matchId}`)
                        .setLabel('👁️ 관전자로 참여')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await waitingChannel.send({
                content: `<@${player1.user.discordId}> ${!player2.isBot ? `<@${player2.user.discordId}>` : ''}`,
                embeds: [waitingEmbed],
                components: [waitingButtons]
            });
            
            // 5초 후 실제 경기장 생성
            setTimeout(async () => {
                // 임시 채널 생성
                pvpChannel = await guild.channels.create({
                    name: `${player1Name}-vs-${player2Name}`,
                    type: 0,
                    parent: pvpCategory.id,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            allow: ['ViewChannel', 'ReadMessageHistory'],
                            deny: ['SendMessages']
                        },
                        {
                            id: player1.user.discordId || player1.user.id,
                            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                        },
                        ...(player2.isBot ? [] : [{
                            id: player2.user.discordId,
                            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                        }])
                    ],
                    reason: 'PVP 매치 임시 채널'
                });
                
                // 대기실 삭제
                await waitingChannel.delete().catch(console.error);
            
            // 참가자들에게 채널 안내
            const joinEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('⚔️ PVP 매치 시작!')
                .setDescription(`${pvpChannel}에서 대결이 시작됩니다!`)
                .addFields(
                    { name: '🥊 대결', value: `**${player1Name}** VS **${player2Name}**`, inline: false },
                    { name: '📍 전투 채널', value: `${pvpChannel}로 이동하세요!`, inline: false }
                )
                .setFooter({ text: '10초 후 자동으로 시작됩니다!' });
            
            // 원래 채널에 안내 메시지
            if (player1.channel) {
                await player1.channel.send({ embeds: [joinEmbed] });
            }
            if (!player2.isBot && player2.channel && player2.channel.id !== player1.channel.id) {
                await player2.channel.send({ embeds: [joinEmbed] });
            }
            
            // 5초 후 관전자 확인 후 베팅 생성
            const bettingPlayers = [
                {
                    id: player1.user.discordId,
                    username: player1Name,
                    rating: player1.rating
                },
                {
                    id: player2.isBot ? 'bot_' + player2.user.nickname : player2.user.discordId,
                    username: player2Name,
                    rating: player2.rating
                }
            ];
            
                // match 객체 먼저 생성
                const match = {
                    matchId: matchId,
                    player1,
                    player2,
                    status: 'preparing',
                    startTime: Date.now(),
                    round: 0,
                    battleLog: [],
                    pendingActions: new Map(),
                    roundTimer: null,
                    player1HP: p1Stats.maxHp,
                    player2HP: p2Stats.maxHp,
                    pvpChannel: pvpChannel,
                    tempChannelCreated: pvpChannel !== player1.channel,
                    bettingEnabled: false,
                    bettingDelay: 0
                };

                this.activeMatches.set(matchId, match);
                
                // 10초 후 관전자 확인 없이 바로 시작
                setTimeout(async () => {
                    await this.startPendulumBattle(match);
                }, 10000);
                
            }, 5000); // 대기실에서 5초 후 시작
            
        } catch (error) {
            console.error('PVP 채널 생성 오류:', error);
            pvpChannel = player1.channel;
        }
        
        return { 
            success: true, 
            message: '매치가 성사되었습니다!',
            matchId 
        };
    }

    // 전투력 계산
    calculateCombatStats(player) {
        const user = player.user;
        
        // 기본 스탯
        const baseStats = {
            str: user.stats?.strength || 10,
            def: user.stats?.vitality || 10,
            hp: user.stats?.vitality || 10,
            int: user.stats?.intelligence || 10,
            dex: user.stats?.agility || 10,
            luk: user.stats?.luck || 10
        };

        // 장비 스탯
        let equipmentStats = {
            str: 0,
            def: 0,
            hp: 0,
            int: 0,
            dex: 0,
            luk: 0
        };

        // 장비 효과 적용
        const equipmentTypes = ['weapon', 'armor', 'accessory'];
        for (const type of equipmentTypes) {
            const item = this.getEquippedItem(user, type);
            if (item) {
                equipmentStats.str += item.attack || 0;
                equipmentStats.def += item.defense || 0;
                equipmentStats.hp += item.vitality || 0;
                equipmentStats.int += item.intelligence || 0;
                equipmentStats.dex += item.agility || 0;
                equipmentStats.luk += item.luck || 0;
            }
        }

        // PVP 강화 보너스
        const pvpBonus = (user.pvp?.attackEnhancement?.high || 0) + 
                        (user.pvp?.attackEnhancement?.middle || 0) + 
                        (user.pvp?.attackEnhancement?.low || 0);
        
        // 최종 스탯 계산
        const totalStats = {
            attack: Math.floor((baseStats.str + equipmentStats.str) * (1 + pvpBonus * 0.02)),
            defense: baseStats.def + equipmentStats.def,
            maxHp: (baseStats.hp + equipmentStats.hp) * 10,
            critRate: Math.min(0.5, (baseStats.luk + equipmentStats.luk) * 0.01),
            accuracy: Math.min(0.95, 0.8 + (baseStats.dex + equipmentStats.dex) * 0.002),
            evasion: Math.min(0.3, (baseStats.dex + equipmentStats.dex) * 0.002)
        };

        return totalStats;
    }

    // 장비 아이템 조회
    getEquippedItem(user, equipmentType) {
        const slotIndex = user.equipment[equipmentType];
        
        if (slotIndex === -1 || slotIndex === null || slotIndex === undefined || 
            typeof slotIndex === 'object' || isNaN(Number(slotIndex))) {
            if (slotIndex !== -1 && slotIndex !== null && slotIndex !== undefined) {
                user.equipment[equipmentType] = -1;
            }
            return null;
        }
        
        const slotNumber = Number(slotIndex);
        const item = user.inventory.find(item => item.inventorySlot === slotNumber);
        
        if (!item) {
            user.equipment[equipmentType] = -1;
            return null;
        }
        
        if (item.type !== equipmentType) {
            user.equipment[equipmentType] = -1;
            item.equipped = false;
            return null;
        }
        
        if (!item.equipped) {
            item.equipped = true;
        }
        
        return item;
    }

    // 펜들럼 배틀 시작
    async startPendulumBattle(match) {
        match.status = 'active';
        match.round = 1;
        
        const channel = match.pvpChannel;
        if (!channel) return;

        const p1Name = match.player1.user.nickname || 'Player 1';
        const p2Name = match.player2.isBot ? match.player2.user.nickname : match.player2.user.nickname || 'Player 2';

        const battleEmbed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('⚔️ 펜들럼 배틀 시작!')
            .setDescription('상대의 공격 위치를 예측하고 방어하세요!')
            .setImage(GAME_GIFS.pvp.challenge)
            .addFields(
                { 
                    name: '🥊 대결', 
                    value: `**${p1Name}** VS **${p2Name}**`, 
                    inline: false 
                },
                {
                    name: '⚡ 게임 방식',
                    value: '• 상/중/하 중 공격 위치를 선택\n• 같은 위치를 선택하면 방어 성공\n• 다른 위치면 공격이 적중',
                    inline: false
                },
                {
                    name: '⏱️ 제한시간',
                    value: '각 라운드 10초',
                    inline: true
                },
                {
                    name: '🎯 승리조건',
                    value: '상대 HP를 0으로 만들기',
                    inline: true
                }
            );

        await channel.send({ embeds: [battleEmbed] });

        // 첫 라운드 시작
        setTimeout(() => this.startRound(match), 3000);
    }

    // 라운드 시작
    async startRound(match) {
        const channel = match.pvpChannel;
        if (!channel || match.status !== 'active') return;

        match.pendingActions.clear();

        const p1Stats = this.calculateCombatStats(match.player1);
        const p2Stats = this.calculateCombatStats(match.player2);
        const p1Name = match.player1.user.nickname;
        const p2Name = match.player2.isBot ? match.player2.user.nickname : match.player2.user.nickname;

        const roundEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle(`🔔 라운드 ${match.round}`)
            .setDescription('공격 위치를 선택하세요!')
            .addFields(
                {
                    name: `❤️ ${p1Name}`,
                    value: `HP: ${match.player1HP}/${p1Stats.maxHp}`,
                    inline: true
                },
                {
                    name: `❤️ ${p2Name}`,
                    value: `HP: ${match.player2HP}/${p2Stats.maxHp}`,
                    inline: true
                }
            )
            .setFooter({ text: '10초 안에 선택하세요!' });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`pvp_pendulum_${match.matchId}_high`)
                    .setLabel('⬆️ 상단')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`pvp_pendulum_${match.matchId}_middle`)
                    .setLabel('➡️ 중단')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`pvp_pendulum_${match.matchId}_low`)
                    .setLabel('⬇️ 하단')
                    .setStyle(ButtonStyle.Primary)
            );

        await channel.send({
            embeds: [roundEmbed],
            components: [buttons]
        });

        // 봇인 경우 자동 선택
        if (match.player2.isBot) {
            setTimeout(() => {
                const botChoices = ['high', 'middle', 'low'];
                const botChoice = botChoices[Math.floor(Math.random() * 3)];
                match.pendingActions.set(match.player2.user.discordId, botChoice);
                this.checkRoundComplete(match);
            }, Math.random() * 5000 + 2000);
        }

        // 10초 타이머
        match.roundTimer = setTimeout(() => {
            this.forceRoundEnd(match);
        }, 10000);
    }

    // 펜들럼 선택 처리
    async handlePendulumChoice(interaction, matchId, position) {
        const match = this.activeMatches.get(matchId);
        if (!match || match.status !== 'active') {
            return await interaction.reply({ 
                content: '❌ 진행 중인 매치를 찾을 수 없습니다.', 
                flags: 64 
            });
        }

        const userId = interaction.user.id;
        
        // 참가자인지 확인
        if (userId !== match.player1.user.discordId && 
            (!match.player2.isBot && userId !== match.player2.user.discordId)) {
            return await interaction.reply({ 
                content: '❌ 이 매치의 참가자가 아닙니다.', 
                flags: 64 
            });
        }

        // 이미 선택했는지 확인
        if (match.pendingActions.has(userId)) {
            return await interaction.reply({ 
                content: '⚠️ 이미 선택하셨습니다!', 
                flags: 64 
            });
        }

        // 선택 저장
        match.pendingActions.set(userId, position);
        
        await interaction.reply({ 
            content: `✅ **${position === 'high' ? '상단' : position === 'middle' ? '중단' : '하단'}** 공격을 선택했습니다!`, 
            flags: 64 
        });

        // 두 플레이어 모두 선택했는지 확인
        this.checkRoundComplete(match);
    }

    // 라운드 완료 확인
    checkRoundComplete(match) {
        const p1Id = match.player1.user.discordId;
        const p2Id = match.player2.user.discordId;

        if (match.pendingActions.has(p1Id) && match.pendingActions.has(p2Id)) {
            if (match.roundTimer) {
                clearTimeout(match.roundTimer);
                match.roundTimer = null;
            }
            this.resolveRound(match);
        }
    }

    // 강제 라운드 종료
    forceRoundEnd(match) {
        const p1Id = match.player1.user.discordId;
        const p2Id = match.player2.user.discordId;

        // 선택하지 않은 플레이어는 중단 선택
        if (!match.pendingActions.has(p1Id)) {
            match.pendingActions.set(p1Id, 'middle');
        }
        if (!match.pendingActions.has(p2Id)) {
            match.pendingActions.set(p2Id, 'middle');
        }

        this.resolveRound(match);
    }

    // 라운드 결과 처리
    async resolveRound(match) {
        const channel = match.pvpChannel;
        if (!channel) return;

        const p1Id = match.player1.user.discordId;
        const p2Id = match.player2.user.discordId;
        const p1Choice = match.pendingActions.get(p1Id);
        const p2Choice = match.pendingActions.get(p2Id);

        const p1Stats = this.calculateCombatStats(match.player1);
        const p2Stats = this.calculateCombatStats(match.player2);

        let p1Damage = 0;
        let p2Damage = 0;
        let resultText = '';

        // 공격 결과 계산
        if (p1Choice === p2Choice) {
            resultText = '🛡️ 두 플레이어가 같은 위치를 선택! 공격이 모두 방어되었습니다!';
        } else {
            // Player 1 공격
            if (Math.random() < p1Stats.accuracy) {
                p1Damage = Math.floor(p1Stats.attack * (0.8 + Math.random() * 0.4));
                const isCrit = Math.random() < p1Stats.critRate;
                if (isCrit) p1Damage *= 2;
                
                p1Damage = Math.max(1, p1Damage - p2Stats.defense);
                match.player2HP = Math.max(0, match.player2HP - p1Damage);
                
                resultText += `⚔️ **${match.player1.user.nickname}**의 ${this.getPositionName(p1Choice)} 공격! `;
                resultText += isCrit ? `**치명타!** ` : '';
                resultText += `데미지: ${p1Damage}\n`;
            } else {
                resultText += `❌ **${match.player1.user.nickname}**의 공격이 빗나갔습니다!\n`;
            }

            // Player 2 공격
            if (Math.random() < p2Stats.accuracy) {
                p2Damage = Math.floor(p2Stats.attack * (0.8 + Math.random() * 0.4));
                const isCrit = Math.random() < p2Stats.critRate;
                if (isCrit) p2Damage *= 2;
                
                p2Damage = Math.max(1, p2Damage - p1Stats.defense);
                match.player1HP = Math.max(0, match.player1HP - p2Damage);
                
                resultText += `⚔️ **${match.player2.user.nickname}**의 ${this.getPositionName(p2Choice)} 공격! `;
                resultText += isCrit ? `**치명타!** ` : '';
                resultText += `데미지: ${p2Damage}`;
            } else {
                resultText += `❌ **${match.player2.user.nickname}**의 공격이 빗나갔습니다!`;
            }
        }

        const resultEmbed = new EmbedBuilder()
            .setColor('#ffa500')
            .setTitle(`⚔️ 라운드 ${match.round} 결과`)
            .setDescription(resultText)
            .addFields(
                {
                    name: `${match.player1.user.nickname}`,
                    value: `선택: ${this.getPositionName(p1Choice)}\nHP: ${match.player1HP}/${p1Stats.maxHp}`,
                    inline: true
                },
                {
                    name: `${match.player2.user.nickname}`,
                    value: `선택: ${this.getPositionName(p2Choice)}\nHP: ${match.player2HP}/${p2Stats.maxHp}`,
                    inline: true
                }
            );

        await channel.send({ embeds: [resultEmbed] });

        // 승부 확인
        if (match.player1HP <= 0 || match.player2HP <= 0) {
            await this.endMatch(match);
        } else {
            match.round++;
            setTimeout(() => this.startRound(match), 3000);
        }
    }

    // 위치 이름 변환
    getPositionName(position) {
        const names = {
            'high': '상단',
            'middle': '중단',
            'low': '하단'
        };
        return names[position] || position;
    }

    // 매치 종료
    async endMatch(match) {
        match.status = 'finished';
        
        const channel = match.pvpChannel;
        if (!channel) return;

        const winner = match.player1HP > 0 ? match.player1 : match.player2;
        const loser = match.player1HP > 0 ? match.player2 : match.player1;

        // 레이팅 변경 계산
        const ratingChange = this.calculateRatingChange(winner.rating, loser.rating, true);

        // 양쪽 모두 레이팅 업데이트
        if (!winner.isBot) {
            winner.user.pvp.rating += ratingChange;
            winner.user.pvp.wins++;
            winner.user.pvp.totalDuels++;
            winner.user.pvp.winStreak++;
            winner.user.pvp.maxWinStreak = Math.max(winner.user.pvp.maxWinStreak, winner.user.pvp.winStreak);
            winner.user.pvp.tier = this.getTierByRating(winner.user.pvp.rating);
            await winner.user.save();
            
            // 미션 진행도 업데이트 (승리)
            await MissionHelper.updatePVPBattle(winner.user.discordId, true);
        }

        // 패자도 오프라인이 아닌 경우에만 업데이트
        if (!loser.isBot || loser.isOfflineUser) {
            if (loser.isOfflineUser) {
                // 오프라인 유저의 경우 DB에서 직접 업데이트
                await User.updateOne(
                    { discordId: loser.user.discordId },
                    {
                        $inc: {
                            'pvp.rating': -ratingChange,
                            'pvp.losses': 1,
                            'pvp.totalDuels': 1
                        },
                        $set: {
                            'pvp.winStreak': 0
                        }
                    }
                );
            } else {
                loser.user.pvp.rating -= ratingChange;
                loser.user.pvp.losses++;
                loser.user.pvp.totalDuels++;
                loser.user.pvp.winStreak = 0;
                loser.user.pvp.tier = this.getTierByRating(loser.user.pvp.rating);
                await loser.user.save();
                
                // 미션 진행도 업데이트 (패배)
                await MissionHelper.updatePVPBattle(loser.user.discordId, false);
            }
        }

        // 보상 계산
        const baseGoldReward = 5000;
        const ratingBonus = winner.user.pvp.rating * 10;
        const goldReward = Math.floor(baseGoldReward + ratingBonus + (ratingChange * 20));
        const expReward = Math.floor(2000 + (winner.user.pvp.rating * 5));
        
        if (!winner.isBot) {
            winner.user.gold += goldReward;
            winner.user.exp += expReward;
            await winner.user.save();
        }
        
        // 패배자 보상 (절반)
        if (!loser.isBot) {
            const loserGoldReward = Math.floor(goldReward * 0.5);
            const loserExpReward = Math.floor(expReward * 0.5);
            loser.user.gold += loserGoldReward;
            loser.user.exp += loserExpReward;
            await loser.user.save();
        }

        // 베팅 정산
        if (match.bettingEnabled && spectatorBetting.bettingPools.has(match.matchId)) {
            const winnerId = winner.user.discordId;
            const rewards = spectatorBetting.resolveBetting(match.matchId, winnerId);
            
            if (rewards.length > 0) {
                let rewardText = '💰 **베팅 정산 결과:**\n';
                for (const reward of rewards) {
                    rewardText += `<@${reward.userId}> - ${reward.amount.toLocaleString()}G 획득!\n`;
                }
                await channel.send(rewardText);
            }
        }

        // 결과 임베드
        const resultEmbed = new EmbedBuilder()
            .setColor(winner === match.player1 ? '#00ff00' : '#ff0000')
            .setTitle('🏆 매치 종료!')
            .setDescription(`**${winner.user.nickname}** 승리!`)
            .setImage(winner === match.player1 ? GAME_GIFS.pvp.win : GAME_GIFS.pvp.lose)
            .addFields(
                {
                    name: '📊 레이팅 변화',
                    value: `${winner.user.nickname}: +${ratingChange}\n${loser.user.nickname}: -${ratingChange}`,
                    inline: true
                },
                {
                    name: '💰 승리 보상',
                    value: `골드: +${goldReward.toLocaleString()}G\n경험치: +${expReward.toLocaleString()} EXP`,
                    inline: true
                },
                {
                    name: '💰 패배 보상',
                    value: `골드: +${Math.floor(goldReward * 0.5).toLocaleString()}G\n경험치: +${Math.floor(expReward * 0.5).toLocaleString()} EXP`,
                    inline: true
                },
                {
                    name: '⏱️ 경기 시간',
                    value: `${Math.floor((Date.now() - match.startTime) / 1000)}초`,
                    inline: true
                }
            );

        await channel.send({ embeds: [resultEmbed] });

        // 임시 채널 10초 후 삭제
        if (match.tempChannelCreated && channel) {
            setTimeout(async () => {
                try {
                    await channel.send('📢 이 채널은 10초 후 삭제됩니다.');
                    setTimeout(async () => {
                        await channel.delete().catch(console.error);
                    }, 10000);
                } catch (error) {
                    console.error('채널 삭제 예고 실패:', error);
                }
            }, 10000);
        }

        // 매치 정리
        this.activeMatches.delete(match.matchId);
    }

    // 레이팅 변화 계산
    calculateRatingChange(winnerRating, loserRating, isWin) {
        const expectedScore = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
        const actualScore = isWin ? 1 : 0;
        const kFactor = 32;
        return Math.floor(kFactor * (actualScore - expectedScore));
    }

    // PVP 정보 조회
    async getPVPInfo(user) {
        const info = {
            tier: user.pvp.tier || 'Bronze',
            tierEmoji: this.getTierEmoji(user.pvp.tier || 'Bronze'),
            rating: user.pvp.rating || 1000,
            duelTickets: user.pvp.duelTickets || 0,
            totalDuels: user.pvp.totalDuels || 0,
            wins: user.pvp.wins || 0,
            losses: user.pvp.losses || 0,
            winRate: user.pvp.totalDuels > 0 ? 
                ((user.pvp.wins / user.pvp.totalDuels) * 100).toFixed(1) : '0.0',
            winStreak: user.pvp.winStreak || 0,
            maxWinStreak: user.pvp.maxWinStreak || 0,
            highestRating: user.pvp.highestRating || user.pvp.rating || 1000,
            matchHistory: user.pvp.matchHistory || []
        };

        return info;
    }
}

module.exports = PVPSystem;