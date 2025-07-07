require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, StringSelectMenuBuilder } = require('discord.js');
const connectDB = require('./database/connection');
const User = require('./models/User');
const IPBan = require('./models/IPBan');
const MineEntry = require('./models/MineEntry');
const { generateVerificationCode, sendVerificationEmail } = require('./services/emailService');
const { startWebServer, generateAuthToken } = require('./webServer');
const { huntingAreas, DROP_ITEMS } = require('./data/huntingAreas');
const STOCK_MARKET = require('./data/stockMarket');
const RANDOM_EVENTS = require('./data/randomEvents');
const shopItems = require('./data/shopItems');
const MONSTER_BATTLE = require('./data/oddEvenGame');
const MUSHROOM_GAME = require('./data/mushroomGame');
const { mushroomItemSystem, reactionSystem, tournamentSystem, achievementSystem } = require('./data/mushroomGameEnhanced');
const { gameHelpers, improvedBotBattle, createImprovedMushroomButtons, improvedMultiplayerRound, animateBotChoice, showMultiplayerResults } = require('./data/mushroomGameImproved');
const ARTIFACT_SYSTEM = require('./data/artifactSystem');
const EXERCISE_SYSTEM = require('./data/exerciseSystem');
const { QUEST_SYSTEM, checkQuestProgress } = require('./data/questSystem');
const BOSS_SYSTEM = require('./data/bossSystem');
const { WORD_LIST, ALL_WORDS, extractChosung, findWordsByChosung, findWordsByStartChar } = require('./data/wordList');
const Jimp = require('jimp');
const spectatorBetting = require('./data/spectatorBetting');
const { initializeAllEmblemShops, handleEmblemShopInteraction } = require('./systems/emblemShop');
const { handleMainInteraction } = require('./interactionHandler');
const { initializeAllEvents, loadPrelaunchData, savePrelaunchData } = require('./handlers/events');
const { setupErrorHandlers } = require('./systems/enhancedErrorHandler');
const qaLogger = require('./systems/qaLogger');
const { setupInteractionMonitor } = require('./systems/interactionMonitor');
const antiMacro = require('./systems/antiMacro');

// Import configuration
const { config, validateEnvironment, isAdmin, gameConfig, pvpConfig, channelsConfig } = require('./config');
const { ADMIN_IDS, DEV_MODE, DEV_CHANNEL_IDS } = require('./config/constants');
const { ENHANCEMENT_RATES, COST_COEFFICIENTS } = require('./config/enhancementConfig');
const countdownSystem = require('./systems/countdownSystem');
const energyFragmentSystem = require('./systems/energyFragmentSystem');
const marketSystem = require('./systems/marketSystem');
const environmentSystem = require('./systems/environmentSystem');
const gameUtils = require('./utils/gameUtils');
const permissions = require('./utils/permissions');

// 게임 시스템 모듈들
const { DUNGEON_CRAWLER: DUNGEON_CRAWLER_MODULE, startDungeonFloorTemp, executeDungeonBattleTemp, endDungeonRunTemp } = require('./systems/dungeonTempChannel');
const { RPS_GAME: RPS_GAME_MODULE, initializeSessions, startRpsMultiplayerGame, startRpsRound, processRpsRoundEnd, endRpsMultiplayerGame, createGameStartEmbed } = require('./systems/rpsMultiplayerGame');
const { registerDiscordEvents } = require('./systems/discordEvents');
const { setUpdatePopularityFunction } = require('./systems/messageHandlers');
const slotMachineSystem = require('./systems/slotMachine');

// 아이템 경매장 시스템
const AUCTION_HOUSE = require('./systems/auctionHouse');

// PVP 시스템은 아래에서 PVPSystem 클래스로 정의됨
let pvpSystem; // 나중에 인스턴스 할당

// 프로페셔널 공지 시스템
const NOTICE_SYSTEM = require('./systems/noticeSystem');

// 현재 시장 상황 저장소
let currentMarketEvent = null;
let lastMarketUpdate = 0;

// 상태 파일 경로
const COUNTDOWN_STATE_PATH = path.join(__dirname, 'countdownState.json');
const PRELAUNCH_DATA_PATH = path.join(__dirname, 'prelaunchEventData.json');

// 카운트다운 함수들은 countdownSystem 모듈에서 가져옴

// countdownSystem 모듈에서 함수들을 불러옴
const { 
    loadCountdownState, 
    saveCountdownState, 
    getCountdownMessage, 
    createCountdownEmbed,
    createAnimatedCountdown,
    createCelebrationImage 
} = countdownSystem;

let openCountdown = {
    isActive: false,
    launchTime: null,
    channelId: null,
    messageId: null,
    startTime: null,
    interval: null,
    totalTime: null
};

// 전역 사전강화 데이터 초기화 - handlers/events로 이동
// global.prelaunchEventData = loadPrelaunchData();

// 사전강화 처리 중인 유저 추적 (중복 실행 방지)
global.enhancingUsers = new Set();
// 사전강화 쿨다운 추적 (스팸 방지)
global.enhanceCooldowns = new Map();

// 서버 오픈 상태 (기본값: false - 서버오픈 명령어 실행 전까지는 항상 카운트다운 모드)
global.serverOpened = false;

// 사전강화 이벤트 종료 상태 (기본값: false - 데이터 파일에서 로드됨)
global.prelaunchEventEnded = false;

console.log('🔍 서버 오픈 상태:', global.serverOpened ? '오픈됨' : '카운트다운 중');

// 사전강화 데이터 로드
try {
    // require 캐시 삭제
    delete require.cache[require.resolve('./prelaunchEventData.json')];
    global.prelaunchEventData = require('./prelaunchEventData.json');
    console.log('📂 사전강화 데이터 로드 성공');
    // 하연94 데이터 확인
    if (global.prelaunchEventData['295980447849250817']) {
        console.log('✅ 하연94 데이터 확인됨:', {
            level: global.prelaunchEventData['295980447849250817'].currentLevel,
            points: global.prelaunchEventData['295980447849250817'].points
        });
    }
} catch (error) {
    console.log('📂 사전강화 데이터 파일이 없거나 오류 발생, 새로 생성');
    global.prelaunchEventData = {};
}

// 디버그: 로드된 데이터 확인
console.log('📊 로드된 사전강화 데이터:');
if (global.prelaunchEventData && typeof global.prelaunchEventData === 'object') {
    Object.entries(global.prelaunchEventData).forEach(([userId, data]) => {
        if (userId === '295980447849250817' || userId === '563406206362845224') {
            console.log(`  - ${userId}: ${data.points}점, 레벨 ${data.currentLevel}`);
        }
    });
} else {
    console.log('  - 데이터가 아직 로드되지 않았습니다.');
}

// 저장 스케줄러
let prelaunchSaveTimeout = null;
let lastSaveTime = Date.now();

// 지연 저장 함수 (1초 후 저장)
function schedulePrelaunchSave() {
    // 이미 예약된 저장이 있으면 취소
    if (prelaunchSaveTimeout) {
        clearTimeout(prelaunchSaveTimeout);
    }

    // 1초 후 저장 예약
    prelaunchSaveTimeout = setTimeout(() => {
        savePrelaunchData();
        lastSaveTime = Date.now();
        prelaunchSaveTimeout = null;
    }, 1000);
}

async function spawnBoss(channel) {
    // 랜덤 보스 선택
    const availableBosses = BOSS_SYSTEM.bosses.filter(boss => {
        // 레벨에 따라 보스 필터링 (선택사항)
        return true;
    });

    const boss = availableBosses[Math.floor(Math.random() * availableBosses.length)];

    // 보스 활성화
    BOSS_SYSTEM.activeBoss = {
        ...boss,
        currentHp: boss.hp,
        spawnTime: Date.now(),
        endTime: Date.now() + BOSS_SYSTEM.spawnSettings.duration,
        channelId: channel.id
    };

    BOSS_SYSTEM.participants.clear();
    BOSS_SYSTEM.damageDealt.clear();
    BOSS_SYSTEM.battleState.isActive = false;

    // 보스 출현 알림
    const bossEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🚨 보스 출현 알림! 🚨')
        .setDescription(`**${boss.emoji} ${boss.name}**이(가) 나타났습니다!`)
        .addFields(
            { name: '⚔️ 레벨', value: `${boss.level}`, inline: true },
            { name: '❤️ HP', value: `${boss.hp.toLocaleString()}`, inline: true },
            { name: '🎯 요구 레벨', value: `${boss.requiredLevel}`, inline: true }
        )
        .setFooter({ text: '30분 후 사라집니다! 서둘러 파티를 구성하세요!' })
        .setTimestamp();

    const bossButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('boss_challenge')
                .setLabel('🗡️ 보스 도전하기')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('boss_info')
                .setLabel('📊 보스 정보')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('boss_participants')
                .setLabel('👥 참가자 목록')
                .setStyle(ButtonStyle.Primary)
        );

    await channel.send({
        content: '@everyone',
        embeds: [bossEmbed],
        components: [bossButtons]
    });

    // 30분 후 보스 사라짐
    setTimeout(async () => {
        if (BOSS_SYSTEM.activeBoss && !BOSS_SYSTEM.battleState.isActive) {
            BOSS_SYSTEM.activeBoss = null;
            await channel.send('⏰ 보스가 사라졌습니다... 다음 기회를 기다려주세요!');
        }
    }, BOSS_SYSTEM.spawnSettings.duration);
}

// 보스 스폰 스케줄러
function scheduleBossSpawn() {
    const interval = Math.random() * 
        (BOSS_SYSTEM.spawnSettings.maxInterval - BOSS_SYSTEM.spawnSettings.minInterval) + 
        BOSS_SYSTEM.spawnSettings.minInterval;

    setTimeout(async () => {
        // 보스 채널 찾기 (설정 필요)
        const bossChannel = client.channels.cache.get(process.env.BOSS_CHANNEL_ID || '1380684353998426122');
        if (bossChannel && !BOSS_SYSTEM.activeBoss) {
            await spawnBoss(bossChannel);
        }
        scheduleBossSpawn(); // 다음 스폰 예약
    }, interval);
}

// 게임 메뉴 표시 함수
async function showGameMenu(interaction) {
    const gameCommand = client.application.commands.cache.find(cmd => cmd.name === '게임');
    if (!gameCommand) {
        await interaction.reply({ content: '게임 명령어를 찾을 수 없습니다.', flags: 64 });
        return;
    }

    // /게임 명령어 실행
    await interaction.deferUpdate();
    await interaction.editReply({
        content: '게임 메뉴로 돌아갑니다...',
        embeds: [],
        components: []
    });

    // 메인 메뉴 표시
    const categoryEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎮 강화왕 김헌터 RPG 게임')
        .setDescription('원하시는 카테고리를 선택해주세요!')
        .setFooter({ text: '아래 메뉴에서 카테고리를 선택하세요' });

    const categoryOptions = Object.entries(MENU_CATEGORIES).map(([key, category]) => ({
        label: category.name,
        description: category.description,
        value: key,
        emoji: category.emoji
    }));

    const categoryMenu = new StringSelectMenuBuilder()
        .setCustomId('category_menu')
        .setPlaceholder('📁 카테고리를 선택하세요')
        .addOptions(categoryOptions);

    const categoryRow = new ActionRowBuilder().addComponents(categoryMenu);

    await interaction.editReply({
        content: null,
        embeds: [categoryEmbed],
        components: [categoryRow]
    });
}

// 에너지 융합 메뉴 표시 함수
async function showEnergyFusionMenu(interaction) {
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
        return;
    }

    // 에너지 조각 현황
    const fragments = user.energyFragments?.fragments || new Map();
    let fragmentText = '';
    let totalFragments = 0;

    const sortedLevels = Array.from(fragments.keys()).sort((a, b) => a - b);

    if (sortedLevels.length === 0) {
        fragmentText = '보유한 조각이 없습니다.\n채굴을 통해 조각을 획득하세요!';
    } else {
        sortedLevels.slice(0, 10).forEach(level => {
            const count = fragments.get(level);
            totalFragments += count;
            fragmentText += `Lv.${level}: ${count}개 | `;
            if ((sortedLevels.indexOf(level) + 1) % 3 === 0) {
                fragmentText = fragmentText.slice(0, -3) + '\n';
            }
        });
        if (sortedLevels.length > 10) {
            fragmentText += `\n... 외 ${sortedLevels.length - 10}종류`;
        }
    }

    const fusionEmbed = new EmbedBuilder()
        .setColor('#ff00ff')
        .setTitle('⚡ 에너지 융합 시스템')
        .setDescription('3개의 같은 레벨 조각을 융합하여 다음 레벨 조각을 만드세요!')
        .addFields(
            { name: '📊 보유 조각', value: fragmentText.trim() || '없음', inline: false },
            { name: '💎 총 조각', value: `${totalFragments}개`, inline: true },
            { name: '🎯 최고 레벨', value: `Lv.${user.energyFragments?.highestLevel || 0}`, inline: true },
            { name: '🔄 일일 융합', value: `${user.energyFragments?.dailyFusions || 0}/20회`, inline: true },
            { name: '📈 실패 스택', value: `${user.energyFragments?.failureStack || 0}/10`, inline: true },
            { name: '🎫 융합권', value: `${user.energyFragments?.fusionTickets || 0}개`, inline: true }
        )
        .setFooter({ text: '실패 시 스택이 쌓이며, 10스택 시 100% 성공!' });

    const fusionButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('fragment_auto_fusion')
                .setLabel('🔄 자동 융합')
                .setStyle(ButtonStyle.Success)
                .setDisabled(totalFragments < 3),
            new ButtonBuilder()
                .setCustomId('fragment_manual_fusion')
                .setLabel('🎯 수동 융합')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(totalFragments < 3),
            new ButtonBuilder()
                .setCustomId('fusion_info')
                .setLabel('📖 융합 정보')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('fusion_back')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [fusionEmbed], components: [fusionButtons] });
    } else {
        await interaction.reply({ embeds: [fusionEmbed], components: [fusionButtons], flags: 64 });
    }
}

// 현재 활성 이벤트들
let dailyFortune = null;
let currentWeather = null;
let activeMissions = new Map();
let lastWeatherUpdate = 0;
let lastFortuneUpdate = 0;

// 독버섯 게임 세션 관리
const mushroomGameSessions = new Map();
const mushroomMatchmakingQueue = new Map();
const mushroomTempChannels = new Map(); // 임시 채널 관리
const mushroomMultiplayerSessions = new Map(); // lobbyId로 멀티플레이어 세션 직접 접근

// 개선된 매치메이킹 시스템
const matchmakingSystem = {
    intervals: new Map(), // userId -> intervalId

    // 매치메이킹 시작
    startPeriodicCheck(userId, interaction, user) {
        if (this.intervals.has(userId)) {
            clearInterval(this.intervals.get(userId));
        }

        // 즉시 한 번 체크
        this.checkForMatch(userId, interaction, user);

        // 2초마다 매칭 체크
        const intervalId = setInterval(() => {
            this.checkForMatch(userId, interaction, user);
        }, 2000);

        this.intervals.set(userId, intervalId);

        // 30초 후 자동 정리
        setTimeout(() => {
            this.stopPeriodicCheck(userId);
        }, 30000);
    },

    // 매칭 체크
    async checkForMatch(userId, interaction, user) {
        if (!mushroomMatchmakingQueue.has(userId)) {
            this.stopPeriodicCheck(userId);
            return;
        }

        // 대기 중인 다른 플레이어 찾기
        for (const [otherId, otherData] of mushroomMatchmakingQueue.entries()) {
            if (otherId !== userId && otherData.difficulty === 'pvp') {
                // 매칭 성공!
                console.log(`[매치메이킹] 매칭 성공: ${userId} <-> ${otherId}`);

                // 큐에서 제거
                mushroomMatchmakingQueue.delete(userId);
                mushroomMatchmakingQueue.delete(otherId);

                // 주기적 체크 중지
                this.stopPeriodicCheck(userId);
                this.stopPeriodicCheck(otherId);

                // 양쪽에 알림
                await this.notifyMatchFound(interaction, user, otherData.interaction, otherData.user);
                return;
            }
        }

        // 대기열 상태 업데이트
        await this.updateQueueStatus(userId, interaction);
    },

    // 매칭 성공 알림
    async notifyMatchFound(interaction1, user1, interaction2, user2) {
        const mushroomGame = new MushroomGame();

        // 첫 번째 플레이어에게 매칭 성공 알림
        try {
            await mushroomGame.createPvPSession(interaction1, user1, user2.discordId, user2);
        } catch (error) {
            console.error('[매치메이킹] 세션 생성 실패:', error);
        }
    },

    // 대기열 상태 업데이트
    async updateQueueStatus(userId, interaction) {
        const queueSize = Array.from(mushroomMatchmakingQueue.values())
            .filter(data => data.difficulty === 'pvp').length;

        const elapsedTime = Math.floor((Date.now() - mushroomMatchmakingQueue.get(userId).timestamp) / 1000);
        const remainingTime = Math.max(0, 30 - elapsedTime);

        const waitingEmbed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('🔍 상대방을 찾고 있습니다...')
            .setDescription(`매칭 대기 중...\\n\\n👥 대기 중인 플레이어: **${queueSize}명**\\n⏱️ 남은 시간: **${remainingTime}초**\\n\\n30초 후 봇과 대결로 자동 전환됩니다.`)
            .setFooter({ text: '2초마다 자동으로 매칭을 확인합니다!' });

        try {
            await interaction.editReply({
                embeds: [waitingEmbed]
            });
        } catch (error) {
            // 인터랙션이 만료되었을 수 있음
        }
    },

    // 주기적 체크 중지
    stopPeriodicCheck(userId) {
        if (this.intervals.has(userId)) {
            clearInterval(this.intervals.get(userId));
            this.intervals.delete(userId);
        }
    }
};

// 가위바위보 게임 시스템 - 모듈에서 가져옴
const RPS_GAME = RPS_GAME_MODULE;

// 가위바위보 멀티플레이어 세션 관리
const rpsMultiplayerSessions = new Map(); // lobbyId로 직접 접근
const rpsTempChannels = new Map(); // 임시 채널 관리

// 김헌터 슬롯머신 시스템 - 모듈에서 가져옴
const { SLOT_MACHINE, slotMachineSessions, slotMachineHistory } = slotMachineSystem;

// 던전 탐험 시스템 - 모듈에서 가져옴
const DUNGEON_CRAWLER = DUNGEON_CRAWLER_MODULE;

// 던전 탐험 세션 관리
const dungeonSessions = new Map();

// 가위바위보 게임 대기열
const rpsMatchQueue = new Map(); // 유저 대전 대기열
const rpsGameSessions = new Map(); // 진행중인 게임 세션

// 임시 채널 관리 (다른 게임들도 사용)
const tempGameChannels = new Map();

class PVPSystem {
    constructor() {
        this.matchmakingQueue = new Map(); // userId -> {rating, timestamp, preference}
        this.activeMatches = new Map(); // matchId -> match data
        this.botUsers = new Map(); // 봇 유저 데이터 캐시
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
            { name: '전설의기사', rating: 2100, tier: 'Grandmaster' },
            { name: '초보냥이', rating: 900, tier: 'Bronze' },
            { name: '사냥꾼', rating: 1600, tier: 'Platinum' },
            { name: '마법사', rating: 1400, tier: 'Gold' },
            { name: '암살자', rating: 1750, tier: 'Master' }
        ];

        for (const bot of botProfiles) {
            this.botUsers.set(bot.name, {
                nickname: bot.name,
                rating: bot.rating,
                tier: bot.tier,
                level: Math.floor(bot.rating / 50) + 1,
                stats: this.generateBotStats(bot.rating),
                equipment: this.generateBotEquipment(bot.rating)
            });
        }
    }

    // 봇 스탯 생성
    generateBotStats(rating) {
        const baseStats = Math.floor(rating / 100) + 10;
        return {
            strength: baseStats + Math.floor(Math.random() * 5),
            agility: baseStats + Math.floor(Math.random() * 5),
            intelligence: baseStats + Math.floor(Math.random() * 5),
            vitality: baseStats + Math.floor(Math.random() * 5),
            luck: baseStats + Math.floor(Math.random() * 5)
        };
    }

    // 봇 장비 생성
    generateBotEquipment(rating) {
        const level = Math.floor(rating / 100);
        return {
            weapon: {
                name: `${level}성 전설 무기`,
                enhanceLevel: Math.min(level, 30),
                stats: { attack: level * 10, defense: 0, dodge: 0, luck: 0 }
            },
            armor: {
                name: `${level}성 전설 갑옷`,
                enhanceLevel: Math.min(level, 30),
                stats: { attack: 0, defense: level * 8, dodge: 0, luck: 0 }
            }
        };
    }

    // 티켓 재생성
    async regenerateTickets(user) {
        const now = new Date();
        const lastRegen = user.pvp.lastTicketRegen || now;
        const hoursPassed = Math.floor((now - lastRegen) / (1000 * 60 * 60));

        if (hoursPassed > 0 && user.pvp.duelTickets < 20) {
            const newTickets = Math.min(20, user.pvp.duelTickets + hoursPassed);
            user.pvp.duelTickets = newTickets;
            user.pvp.lastTicketRegen = now;
            await user.save();
        }

        return user.pvp.duelTickets;
    }

    // 매치메이킹 큐 참가
    async joinQueue(userId, user, channel) {
        // PVP 데이터 초기화 확인
        if (!user.pvp) {
            user.pvp = {
                rating: 1000,
                tier: 'Bronze',
                duelTickets: 20,
                lastTicketRegen: Date.now(),
                totalDuels: 0,
                wins: 0,
                losses: 0,
                winStreak: 0,
                maxWinStreak: 0,
                highestRating: 1000,
                matchHistory: [],
                attackEnhancement: { high: 0, middle: 0, low: 0 }
            };
            await user.save();
        }

        // 티켓 재생성
        await this.regenerateTickets(user);

        // 티켓 확인
        if (user.pvp.duelTickets <= 0) {
            return { 
                success: false, 
                message: '결투권이 부족합니다! 1시간마다 1장씩 재생성됩니다.' 
            };
        }

        // 이미 큐에 있는지 확인
        if (this.matchmakingQueue.has(userId)) {
            return { 
                success: false, 
                message: '이미 매치메이킹 큐에 참가중입니다!' 
            };
        }

        const playerData = {
            userId,
            user,
            rating: user.pvp.rating,
            tier: this.getTierByRating(user.pvp.rating),
            timestamp: Date.now(),
            channel,
            isBot: false
        };

        this.matchmakingQueue.set(userId, playerData);

        // 매치메이킹 시작 공개 알림
        if (channel) {
            try {
                const matchmakingStartEmbed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle('🔍 매치메이킹 시작!')
                    .setDescription(`**${user.nickname || user.username}**님이 PVP 매칭을 시작했습니다!`)
                    .addFields(
                        { name: '🏆 레이팅', value: `${user.pvp.rating}점`, inline: true },
                        { name: '🎖️ 티어', value: playerData.tier, inline: true },
                        { name: '⏱️ 대기 시간', value: '최대 20초', inline: true }
                    )
                    .setFooter({ text: '20초 동안 적절한 상대를 찾고, 못 찾으면 봇과 매칭됩니다.' });

                await channel.send({ embeds: [matchmakingStartEmbed] });
            } catch (error) {
                console.error('매치메이킹 시작 알림 전송 오류:', error);
            }
        }

        // 즉시 매치 시도 (초기 범위: 200)
        const opponent = this.findOpponent(playerData);
        if (opponent) {
            // 즉시 매칭 성사 알림
            const ratingDiff = Math.abs(playerData.rating - opponent.rating);

            if (channel) {
                try {
                    const instantMatchEmbed = new EmbedBuilder()
                        .setColor('#27ae60')
                        .setTitle('⚡ 즉시 매칭 성사!')
                        .setDescription(`**${opponent.user.nickname || opponent.user.username || '상대 플레이어'}** 님과 바로 매칭되었습니다!`)
                        .addFields(
                            { name: '👤 상대 플레이어', value: `${opponent.user.nickname} (${opponent.rating}점)`, inline: true },
                            { name: '📊 레이팅 차이', value: `±${ratingDiff}점`, inline: true },
                            { name: '⚔️ 전투 시작', value: '최고의 매칭이 성사되었습니다!', inline: true }
                        );

                    await channel.send({ embeds: [instantMatchEmbed] });

                    // 상대방 채널에도 알림
                    if (opponent.channel && opponent.channel !== channel) {
                        await opponent.channel.send({ embeds: [instantMatchEmbed] });
                    }
                } catch (error) {
                    console.error('즉시 매칭 성공 알림 전송 오류:', error);
                }
            }

            return await this.createMatch(playerData, opponent);
        }

        // 매칭 진행 상황 업데이트
        const updateMatchmakingProgress = async () => {
            if (!this.matchmakingQueue.has(userId)) return;

            const currentPlayer = this.matchmakingQueue.get(userId);
            const waitTime = Date.now() - currentPlayer.timestamp;
            const waitSeconds = Math.floor(waitTime / 1000);

            // 매칭 범위 계산 (15초마다 100씩 증가, 최대 2000)
            const baseRange = 200;
            const expandedRange = Math.min(2000, baseRange + Math.floor(waitTime / 15000) * 100);

            // 상대 찾기 시도
            const opponent = this.findOpponentWithRange(currentPlayer, expandedRange);
            if (opponent) {
                // 실제 플레이어 매칭 성사 알림
                const ratingDiff = Math.abs(currentPlayer.rating - opponent.rating);

                if (channel) {
                    try {
                        const playerMatchEmbed = new EmbedBuilder()
                            .setColor('#e74c3c')
                            .setTitle('🔥 실제 플레이어 매칭 성사!')
                            .setDescription(`**${opponent.user.nickname || opponent.user.username || '상대 플레이어'}** 님과 매칭되었습니다!`)
                            .addFields(
                                { name: '👤 상대 플레이어', value: `${opponent.user.nickname} (${opponent.rating}점)`, inline: true },
                                { name: '📊 레이팅 차이', value: `±${ratingDiff}점`, inline: true },
                                { name: '⚔️ 전투 시작', value: '열띤 전투가 시작됩니다!', inline: true }
                            );

                        await channel.send({ embeds: [playerMatchEmbed] });

                        // 상대방 채널에도 알림
                        if (opponent.channel && opponent.channel !== channel) {
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
                // 봇 매칭 시작 알림
                if (channel) {
                    try {
                        const botMatchEmbed = new EmbedBuilder()
                            .setColor('#FFA500')
                            .setTitle('🤖 봇 매칭 시작')
                            .setDescription(`10초 대기 후 적절한 실력의 봇과 매칭됩니다!`)
                            .addFields(
                                { name: '⏱️ 대기 시간', value: `${waitSeconds}초`, inline: true },
                                { name: '🎯 최종 매칭 범위', value: `±${expandedRange}점`, inline: true }
                            );

                        await channel.send({ embeds: [botMatchEmbed] });
                    } catch (error) {
                        console.error('봇 매칭 알림 전송 오류:', error);
                    }
                }

                this.createBotMatch(userId);
                return;
            }

            // 15초마다 진행 상황 알림
            if (waitSeconds % 15 === 0 && waitSeconds > 0) {
                if (channel) {
                    try {
                        const progressEmbed = new EmbedBuilder()
                            .setColor('#3498db')
                            .setTitle('🔍 매칭 진행 중...')
                            .setDescription(`더 넓은 범위에서 상대를 찾고 있습니다!`)
                            .addFields(
                                { name: '⏱️ 대기 시간', value: `${waitSeconds}초`, inline: true },
                                { name: '🎯 현재 매칭 범위', value: `±${expandedRange}점`, inline: true },
                                { name: '⏳ 봇 매칭까지', value: `${Math.max(0, 20 - waitSeconds)}초`, inline: true }
                            );

                        await channel.send({ embeds: [progressEmbed] });
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

        return {
            success: true,
            message: '매치메이킹을 시작합니다! 20초 동안 실제 플레이어를 찾고, 못 찾으면 봇과 매칭됩니다.',
            tickets: user.pvp.duelTickets
        };
    }

    // 상대 찾기 (기본 범위 200)
    findOpponent(player) {
        return this.findOpponentWithRange(player, 200);
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
            const User = require('./models/User');

            // 1차: ±300 범위의 유저 찾기
            let opponents = await User.find({
                discordId: { $ne: player.user.discordId }, // 자신 제외
                'pvp.rating': { 
                    $gte: playerRating - 300, 
                    $lte: playerRating + 300 
                },
                registered: true
            }).limit(10);

            // 2차: 300 범위에 없으면 ±500으로 확대
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

            // 3차: 그래도 없으면 아무나
            if (opponents.length === 0) {
                opponents = await User.find({
                    discordId: { $ne: player.user.discordId },
                    registered: true
                }).limit(10);
            }

            // 유저가 정말 없으면 기본 봇 사용
            if (opponents.length === 0) {
                console.log('[PVP] DB에 다른 유저가 없어 기본 봇 사용');
                // 기본 봇 데이터로 대체
                const defaultBot = {
                    discordId: 'bot_default',
                    nickname: '초보냥이',
                    pvp: {
                        rating: 1000,
                        tier: 'Bronze'
                    },
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

            // 오프라인 유저 데이터 확인 로그
            console.log(`[PVP] 오프라인 유저 매칭 - ${opponent.nickname}:`, {
                level: opponent.level,
                stats: opponent.stats,
                equipment: Object.keys(opponent.equipment || {}),
                rating: opponent.pvp?.rating
            });

            // 오프라인 유저 데이터로 봇처럼 매칭
            const opponentData = {
                userId: opponent.discordId,
                user: opponent,
                rating: opponent.pvp.rating,
                tier: opponent.pvp.tier,
                isBot: true, // 봇처럼 행동하지만 실제 유저 데이터
                isOfflineUser: true // 오프라인 유저임을 표시
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
        // 더 고유한 매치 ID 생성 (타임스탬프 + 랜덤 문자열)
        const matchId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // 티켓 소모
        if (!player1.isBot) {
            player1.user.pvp.duelTickets -= 1;
            await player1.user.save();
        }
        if (!player2.isBot) {
            player2.user.pvp.duelTickets -= 1;
            await player2.user.save();
        }

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
                    type: 4, // 카테고리
                    reason: 'PVP 전용 카테고리'
                });
            }

            // 임시 채널 생성
            const player1Name = player1.isBot ? player1.user.nickname : player1.user.nickname || 'Player1';
            const player2Name = player2.isBot ? player2.user.nickname : player2.user.nickname || 'Player2';

            pvpChannel = await guild.channels.create({
                name: `⚔️-pvp-${player1Name}-vs-${player2Name}`,
                type: 0, // 텍스트 채널
                parent: pvpCategory.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: ['ViewChannel', 'ReadMessageHistory'], // 모든 사용자가 관전 가능
                        deny: ['SendMessages'] // 메시지는 못 보냄
                    },
                    {
                        id: player1.user.discordId,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    },
                    ...(player2.isBot ? [] : [{
                        id: player2.user.discordId,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    }])
                ],
                reason: 'PVP 매치 임시 채널'
            });

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
            const spectatorBetting = require('./data/spectatorBetting');
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

            // 5초 후에 관전자 확인 및 베팅 시작
            setTimeout(async () => {
                try {
                    // 길드 및 채널 정보 새로고침
                    const guild = pvpChannel.guild;
                    await guild.members.fetch();

                    // 채널을 볼 수 있는 멤버들만 필터링
                    const channelMembers = guild.members.cache.filter(member => 
                        pvpChannel.permissionsFor(member).has('ViewChannel')
                    );

                    // 참가자 ID 목록
                    const participantIds = [player1.user.discordId];
                    if (!player2.isBot) participantIds.push(player2.user.discordId);

                    // 관전자만 필터링 (봇과 관리자 제외)
                    const spectators = channelMembers.filter(member => 
                        !participantIds.includes(member.id) && 
                        !member.user.bot &&
                        !ADMIN_IDS.includes(member.id)
                    );
                    const spectatorCount = spectators.size;

                    console.log(`[PVP] 채널 접근 가능한 멤버: ${channelMembers.size}명`);
                    console.log(`[PVP] 참가자: ${participantIds.join(', ')}`);
                    console.log(`[PVP] 관전자 수: ${spectatorCount}명`);

                    // 디버깅용 상세 로그
                    channelMembers.forEach(member => {
                        const isParticipant = participantIds.includes(member.id);
                        const isBot = member.user.bot;
                        const isAdmin = ADMIN_IDS.includes(member.id);
                        const isSpectator = !isParticipant && !isBot && !isAdmin;
                        console.log(`[PVP] ${member.user.username} (${member.id}): 참가자=${isParticipant}, 봇=${isBot}, 관리자=${isAdmin}, 관전자=${isSpectator}`);
                    });

                    if (spectatorCount > 0) {
                        // 관전자가 있으면 베팅 생성
                        const bettingPool = spectatorBetting.createBettingPool(matchId, 'pvp', bettingPlayers);

                        // 베팅 메시지 전송
                        const bettingEmbed = spectatorBetting.createBettingEmbed(bettingPool);
                        const bettingButtons = spectatorBetting.createBettingButtons(matchId);

                        await pvpChannel.send({
                            content: `🎰 **관전자 베팅이 시작되었습니다!** (관전자 ${spectatorCount}명)\n⏱️ 베팅 시간: **10초**\n🎮 베팅 마감 후 경기가 시작됩니다!`,
                            embeds: [bettingEmbed],
                            components: bettingButtons
                        });

                        // 10초 베팅 시간
                        setTimeout(async () => {
                            spectatorBetting.closeBetting(matchId);
                            await pvpChannel.send('🔒 **베팅이 마감되었습니다!**');
                        }, 10000);

                        // 매치에 베팅 시작 표시
                        match.bettingEnabled = true;
                        match.bettingDelay = 10000; // 10초 대기
                    } else {
                        // 관전자가 없으면 바로 시작
                        await pvpChannel.send('👥 **관전자가 없어 베팅 없이 바로 시작합니다!**');
                        match.bettingEnabled = false;
                        match.bettingDelay = 0;
                    }
                } catch (error) {
                    console.error('관전자 확인 중 오류:', error);
                    match.bettingEnabled = false;
                    match.bettingDelay = 0;
                }
            }, 5000); // 5초 후 확인

        } catch (error) {
            console.error('PVP 채널 생성 오류:', error);
            // 채널 생성 실패해도 계속 진행 (기존 채널에서)
            pvpChannel = player1.channel;
        }

        const match = {
            matchId: matchId,
            player1,
            player2,
            status: 'preparing',
            startTime: Date.now(),
            round: 0,
            battleLog: [],
            pendingActions: new Map(), // 각 라운드의 선택 상태
            roundTimer: null, // 라운드 타이머
            player1HP: p1Stats.maxHp,
            player2HP: p2Stats.maxHp,
            pvpChannel: pvpChannel, // PVP 전용 채널
            tempChannelCreated: pvpChannel !== player1.channel, // 임시 채널 여부
            bettingEnabled: false, // 베팅 활성화 여부
            bettingDelay: 0 // 베팅 대기 시간
        };

        this.activeMatches.set(matchId, match);

        // 잠시 대기 후 펜들럼 배틀 시작
        setTimeout(async () => {
            // 베팅 대기 시간이 있으면 추가로 대기
            const totalDelay = match.bettingDelay || 0;
            setTimeout(async () => {
                await this.startPendulumBattle(match);
            }, totalDelay);
        }, 5000); // 5초 후 베팅 확인

        return { 
            success: true, 
            message: '매치가 성사되었습니다!',
            matchId 
        };
    }

    // 전투 시뮬레이션
    async simulateBattle(player1, player2) {
        const p1Stats = this.calculateCombatStats(player1);
        const p2Stats = this.calculateCombatStats(player2);

        const battles = [];
        let p1Hp = p1Stats.maxHp;
        let p2Hp = p2Stats.maxHp;
        let turn = 1;

        while (p1Hp > 0 && p2Hp > 0 && turn <= 20) {
            const round = {};

            // 플레이어 1 공격
            if (Math.random() < p1Stats.accuracy) {
                let damage = Math.floor(p1Stats.attack * (0.8 + Math.random() * 0.4));
                const critChance = p1Stats.critRate;
                const isCrit = Math.random() < critChance;
                if (isCrit) damage *= 2;

                p2Hp = Math.max(0, p2Hp - Math.max(1, damage - p2Stats.defense));
                round.p1Action = {
                    damage,
                    isCrit,
                    remainingHp: p2Hp
                };
            } else {
                round.p1Action = { miss: true };
            }

            // 플레이어 2 공격 (생존시)
            if (p2Hp > 0) {
                if (Math.random() < p2Stats.accuracy) {
                    let damage = Math.floor(p2Stats.attack * (0.8 + Math.random() * 0.4));
                    const critChance = p2Stats.critRate;
                    const isCrit = Math.random() < critChance;
                    if (isCrit) damage *= 2;

                    p1Hp = Math.max(0, p1Hp - Math.max(1, damage - p1Stats.defense));
                    round.p2Action = {
                        damage,
                        isCrit,
                        remainingHp: p1Hp
                    };
                } else {
                    round.p2Action = { miss: true };
                }
            }

            battles.push(round);
            turn++;
        }

        const winner = p1Hp > p2Hp ? 'player1' : 'player2';

        return {
            winner,
            battles,
            finalHp: { p1: p1Hp, p2: p2Hp },
            totalTurns: turn - 1
        };
    }

    // 전투력 계산 - 통합 전투력 시스템 사용
    calculateCombatStats(player) {
        const user = player.user;

        console.log(`[PVP] ${user.nickname} 장비 데이터 확인:`, {
            equipment: user.equipment,
            inventory: user.inventory?.length || 0,
            hasStats: !!user.stats
        });

        // 기본 스탯 가져오기
        const baseStats = {
            str: user.stats?.strength || 10,
            def: user.stats?.vitality || 10, // vitality를 방어력으로 사용
            hp: user.stats?.vitality || 10,
            int: user.stats?.intelligence || 10,
            dex: user.stats?.agility || 10, // agility를 dex로 사용
            luk: user.stats?.luck || 10
        };

        // 장비 스탯 계산
        let equipStats = {
            str: 0,
            def: 0,
            hp: 0,
            int: 0,
            dex: 0,
            luk: 0
        };

        const equipmentSlots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];

        equipmentSlots.forEach(slot => {
            const item = getEquippedItem(user, slot);
            if (item && item.stats) {
                console.log(`[PVP] ${user.nickname} - ${slot} 장비:`, item.name, '스탯:', item.stats);
                // 장비의 attack/defense를 str/def로 변환
                equipStats.str += item.stats.attack || 0;
                equipStats.def += item.stats.defense || 0;
                equipStats.hp += item.stats.hp || 0;
                equipStats.int += item.stats.int || 0;
                equipStats.dex += item.stats.dodge || 0; // dodge를 dex로
                equipStats.luk += item.stats.luck || 0;  // luck을 luk으로
            }
        });

        // 최종 스탯 계산
        const finalStats = {
            str: baseStats.str + equipStats.str,
            def: baseStats.def + equipStats.def,
            hp: baseStats.hp + equipStats.hp,
            int: baseStats.int + equipStats.int,
            dex: baseStats.dex + equipStats.dex,
            luk: baseStats.luk + equipStats.luk
        };

        console.log(`[PVP] ${user.nickname} 스탯 계산:`, {
            baseStats,
            equipStats,
            finalStats
        });

        // 전투 스탯 계산 (더 높은 기본값과 스탯 영향)
        let attack = Math.floor(50 + finalStats.str * 5 + finalStats.dex * 2 + user.level * 2); // 기본 50, STR당 5
        let defense = Math.floor(20 + finalStats.def * 3 + user.level); // 기본 20, DEF당 3
        let maxHp = Math.floor(500 + finalStats.hp * 20 + user.level * 10); // 기본 500, HP당 20

        // PVP 강화 보너스 (공격력에만 적용)
        if (user.pvp?.attackEnhancement) {
            const totalEnhancement = (user.pvp.attackEnhancement.high || 0) +
                                   (user.pvp.attackEnhancement.middle || 0) +
                                   (user.pvp.attackEnhancement.low || 0);
            const pvpBonus = 1 + (totalEnhancement * 0.02); // 각 강화당 2% 보너스
            attack = Math.floor(attack * pvpBonus);
        }

        // INT는 스킬 데미지에 영향 (추후 구현)
        // DEX는 명중률과 회피율에 영향
        // LUK은 치명타율에 영향

        const accuracy = Math.min(0.95, 0.6 + (finalStats.dex / 200)); // DEX 기반 명중률
        const critRate = Math.min(0.4, 0.05 + (finalStats.luk / 150)); // LUK 기반 치명타율
        const dodge = Math.min(0.3, (finalStats.dex / 300)); // DEX 기반 회피율

        // 통합 전투력 계산 (표시용)
        const totalCombatPower = calculateCombatPower(user);

        return {
            attack: attack,
            defense: defense,
            maxHp: maxHp,
            accuracy: accuracy,
            critRate: critRate,
            dodge: dodge,
            combatPower: totalCombatPower, // 전투력 표시용
            stats: finalStats // 디버깅용
        };
    }

    // 매치 결과 처리
    async processMatchResult(match, battleResult) {
        const winner = battleResult.winner === 'player1' ? match.player1 : match.player2;
        const loser = battleResult.winner === 'player1' ? match.player2 : match.player1;

        // 레이팅 계산
        const { winnerNewRating, loserNewRating, ratingChange } = this.calculateRatingChange(
            winner.rating, 
            loser.rating, 
            battleResult.winner === 'player1'
        );

        // 골드 변화 저장을 위한 변수
        let winnerGoldChange = 0;
        let loserGoldChange = 0;

        // 결과 저장 (봇이 아닌 경우만, 오프라인 유저도 포함)
        if (!winner.isBot || winner.isOfflineUser) {
            const winnerBefore = winner.user.gold || 0;
            await this.updatePlayerStats(winner.user, true, ratingChange, loser.user.nickname || loser.user.name);
            winnerGoldChange = winner.user.gold - winnerBefore;
        }
        if (!loser.isBot || loser.isOfflineUser) {
            const loserBefore = loser.user.gold || 0;
            await this.updatePlayerStats(loser.user, false, -ratingChange, winner.user.nickname || winner.user.name);
            loserGoldChange = loser.user.gold - loserBefore;
        }

        // 골드 변화 정보를 match에 저장
        match.winnerGoldChange = winnerGoldChange;
        match.loserGoldChange = loserGoldChange;

        // 베팅 결과 처리
        const spectatorBetting = require('./data/spectatorBetting');
        const winnerStats = this.calculateCombatStats(winner);
        const winnerHP = battleResult.winner === 'player1' ? battleResult.finalHp.p1 : battleResult.finalHp.p2;
        const perfectWin = (winnerHP / winnerStats.maxHp) >= 0.8;

        const bettingResults = {
            winner: {
                id: winner.isBot ? 'bot_' + winner.user.nickname : winner.user.discordId
            },
            firstBlood: match.firstBloodPlayer ? { id: match.firstBloodPlayer } : null,
            perfectWin: perfectWin,
            totalRounds: battleResult.totalTurns,
            totalDamage: match.totalDamageDealt || 0
        };

        const resolvedPool = await spectatorBetting.resolvePool(match.matchId, bettingResults);

        // 베팅 승자들에게 보상 지급
        if (resolvedPool && resolvedPool.winners.length > 0) {
            for (const winner of resolvedPool.winners) {
                const betUser = await User.findOne({ discordId: winner.userId });
                if (betUser) {
                    betUser.gold += winner.payout;
                    await betUser.save();
                }
            }

            // PVP 채널에 베팅 결과 공지
            if (match.pvpChannel) {
                const bettingResultEmbed = new EmbedBuilder()
                    .setColor('#ffd700')
                    .setTitle('🎰 베팅 결과')
                    .setDescription(`총 베팅액: ${resolvedPool.totalPot.toLocaleString()}G`)
                    .addFields(
                        { 
                            name: '🏆 베팅 승자', 
                            value: resolvedPool.winners.length > 0 
                                ? resolvedPool.winners.map(w => `<@${w.userId}> - ${w.payout.toLocaleString()}G`).join('\n')
                                : '없음',
                            inline: false
                        }
                    );

                await match.pvpChannel.send({ embeds: [bettingResultEmbed] });
            }
        }

        // 결과 메시지 전송
        await this.sendBattleResult(match, battleResult, winner, loser, ratingChange);

        // 매치 정리
        match.status = 'finished';
        if (match.roundTimer) {
            clearTimeout(match.roundTimer);
        }
        this.activeMatches.delete(match.matchId);
    }

    // 레이팅 변화 계산
    calculateRatingChange(winnerRating, loserRating, player1Won) {
        const K = 32; // K-factor
        const expectedWin = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
        const ratingChange = Math.round(K * (1 - expectedWin));

        return {
            winnerNewRating: winnerRating + ratingChange,
            loserNewRating: loserRating - ratingChange,
            ratingChange
        };
    }

    // 플레이어 통계 업데이트
    async updatePlayerStats(user, isWin, ratingChange, opponentName) {
        user.pvp.rating += ratingChange;
        user.pvp.tier = this.getTierByRating(user.pvp.rating);
        user.pvp.totalDuels += 1;

        // 골드 보상/패널티 계산
        const baseGold = 10000; // 기본 금액
        const ratingBonus = Math.floor(user.pvp.rating / 100) * 1000; // 레이팅에 따른 보너스
        let goldChange = 0;

        if (isWin) {
            user.pvp.wins += 1;
            user.pvp.winStreak += 1;
            user.pvp.maxWinStreak = Math.max(user.pvp.maxWinStreak, user.pvp.winStreak);

            // 승리 시 골드 획득
            goldChange = baseGold + ratingBonus + (user.pvp.winStreak * 2000); // 연승 보너스
            user.gold += goldChange;
        } else {
            user.pvp.losses += 1;
            user.pvp.winStreak = 0;

            // 패배 시 골드 손실
            goldChange = -Math.floor((baseGold + ratingBonus) * 0.5); // 승리 보상의 50% 손실
            user.gold = Math.max(0, user.gold + goldChange); // 0 이하로 떨어지지 않도록
        }

        user.pvp.highestRating = Math.max(user.pvp.highestRating, user.pvp.rating);
        user.pvp.lastMatchTime = new Date();

        // 매치 히스토리 업데이트 (최근 10경기)
        user.pvp.matchHistory.unshift({
            opponent: opponentName,
            opponentRating: user.pvp.rating - ratingChange,
            result: isWin ? 'win' : 'lose',
            ratingChange: ratingChange,
            goldChange: goldChange,
            date: new Date()
        });

        if (user.pvp.matchHistory.length > 10) {
            user.pvp.matchHistory = user.pvp.matchHistory.slice(0, 10);
        }

        await user.save();
    }

    // 레이팅으로 티어 계산
    getTierByRating(rating) {
        for (const [tier, range] of Object.entries(this.tierRanges)) {
            if (rating >= range.min && rating <= range.max) {
                return tier;
            }
        }
        return 'Bronze';
    }

    // 전투 결과 전송
    async sendBattleResult(match, battleResult, winner, loser, ratingChange) {
        const p1Name = match.player1.user.nickname || match.player1.user.name || '플레이어1';
        const p2Name = match.player2.user.nickname || match.player2.user.name || '플레이어2';

        const winnerName = winner === match.player1 ? p1Name : p2Name;
        const loserName = loser === match.player1 ? p1Name : p2Name;

        // 전투 과정 텍스트 생성 (펜들럼 배틀 형식)
        let battleLog = '';
        if (battleResult.battles && battleResult.battles.length > 0) {
            battleResult.battles.forEach((round, index) => {
                battleLog += `**Round ${round.round || index + 1}**\n`;

                // 펜들럼 배틀 형식
                if (round.p1Damage !== undefined && round.p2Damage !== undefined) {
                    battleLog += `${p1Name}: ${round.p1Damage} 피해 입힘\n`;
                    battleLog += `${p2Name}: ${round.p2Damage} 피해 입힘\n`;
                }
                // 기존 시뮬레이션 형식 (호환성)
                else if (round.p1Action) {
                    if (round.p1Action.miss) {
                        battleLog += `${p1Name}: 공격 실패!\n`;
                    } else {
                        const critText = round.p1Action.isCrit ? ' **크리티컬!**' : '';
                        battleLog += `${p1Name}: ${round.p1Action.damage} 피해${critText}\n`;
                    }

                    if (round.p2Action) {
                        if (round.p2Action.miss) {
                            battleLog += `${p2Name}: 공격 실패!\n`;
                        } else {
                            const critText = round.p2Action.isCrit ? ' **크리티컬!**' : '';
                            battleLog += `${p2Name}: ${round.p2Action.damage} 피해${critText}\n`;
                        }
                    }
                }
                battleLog += '\n';
            });
        }

        const resultEmbed = new EmbedBuilder()
            .setTitle('⚔️ PVP 결투 결과')
            .setColor(winner === match.player1 ? 0x00ff00 : 0xff0000)
            .addFields(
                {
                    name: '🏆 승자',
                    value: `${winnerName}\n레이팅: ${winner.rating} (+${ratingChange})\n💰 골드: ${match.winnerGoldChange >= 0 ? '+' : ''}${match.winnerGoldChange?.toLocaleString() || 0}G`,
                    inline: true
                },
                {
                    name: '💔 패자',
                    value: `${loserName}\n레이팅: ${loser.rating} (-${ratingChange})\n💰 골드: ${match.loserGoldChange?.toLocaleString() || 0}G`,
                    inline: true
                },
                {
                    name: '⚔️ 전투 과정',
                    value: battleLog.length > 1024 ? battleLog.substring(0, 1021) + '...' : battleLog,
                    inline: false
                }
            )
            .setFooter({ text: `총 ${battleResult.totalTurns}턴 진행 | ${winner.isOfflineUser || loser.isOfflineUser ? '비동기 PVP' : '실시간 PVP'}` })
            .setTimestamp();

        // PVP 임시 채널에 결과 전송
        if (match.pvpChannel) {
            await match.pvpChannel.send({ embeds: [resultEmbed] });
            await match.pvpChannel.send('🏁 **매치가 종료되었습니다! 5초 후 채널이 삭제됩니다.**');
        }

        // 원래 채널들에도 결과 전송
        const channelsToNotify = new Set();
        if (match.player1.channel) channelsToNotify.add(match.player1.channel);
        if (match.player2.channel) channelsToNotify.add(match.player2.channel);

        for (const channel of channelsToNotify) {
            await channel.send({ embeds: [resultEmbed] });
        }
    }

    // 큐 떠나기
    leaveQueue(userId) {
        if (this.matchmakingQueue.has(userId)) {
            this.matchmakingQueue.delete(userId);
            return { success: true, message: '매치메이킹 큐에서 나왔습니다.' };
        }
        return { success: false, message: '매치메이킹 큐에 참가하지 않았습니다.' };
    }

    // PVP 정보 조회
    async getPVPInfo(user) {
        await this.regenerateTickets(user);

        const tierEmoji = {
            'Bronze': '🥉',
            'Silver': '🥈', 
            'Gold': '🥇',
            'Platinum': '💎',
            'Master': '🌟',
            'Grandmaster': '👑',
            'Challenger': '🏆'
        };

        const winRate = user.pvp.totalDuels > 0 ? 
            ((user.pvp.wins / user.pvp.totalDuels) * 100).toFixed(1) : 0;

        return {
            rating: user.pvp.rating,
            tier: user.pvp.tier,
            tierEmoji: tierEmoji[user.pvp.tier] || '🥉',
            duelTickets: user.pvp.duelTickets,
            totalDuels: user.pvp.totalDuels,
            wins: user.pvp.wins,
            losses: user.pvp.losses,
            winRate,
            winStreak: user.pvp.winStreak,
            maxWinStreak: user.pvp.maxWinStreak,
            highestRating: user.pvp.highestRating,
            matchHistory: user.pvp.matchHistory || []
        };
    }

    // 펜들럼 배틀 시스템
    async startPendulumBattle(match) {
        match.round = 1;
        match.battleLog = [];
        match.pendingActions = new Map(); // 초기화 확실히
        match.status = 'in_progress';
        console.log(`[PVP] 펜들럼 배틀 시작 - matchId: ${match.matchId}`);

        // 게임 시작 알림
        if (match.pvpChannel) {
            const getPlayerName = (player) => {
                if (player.isBot) return player.user.nickname || '봇';
                return player.user.nickname || '플레이어';
            };

            const startEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🎮 경기 시작!')
                .setDescription(`**${getPlayerName(match.player1)}** VS **${getPlayerName(match.player2)}**\n\n⚔️ 펜들럼 배틀이 시작됩니다!`)
                .setFooter({ text: '각 라운드마다 10초 내에 공격 위치를 선택하세요!' });

            await match.pvpChannel.send({ embeds: [startEmbed] });
        }

        // 베팅이 활성화되어 있으면 이미 마감됨 (10초 타이머로)
        // 베팅이 없으면 아무것도 하지 않음
        if (match.bettingEnabled) {
            console.log(`[PVP] 베팅이 이미 마감되었습니다 - matchId: ${match.matchId}`);
        }

        // 첫 번째 데미지를 기록하기 위한 플래그
        match.firstBloodPlayer = null;
        match.totalDamageDealt = 0;

        await this.showBattleRound(match);
    }

    async showBattleRound(match) {
        // 매치 상태 업데이트
        match.status = 'in_progress';

        const { player1, player2 } = match;
        const p1Stats = this.calculateCombatStats(player1);
        const p2Stats = this.calculateCombatStats(player2);

        // HP 바 생성
        const createHPBar = (current, max) => {
            const percentage = Math.max(0, Math.floor((current / max) * 10));
            const filled = '🟩'.repeat(percentage);
            const empty = '⬜'.repeat(10 - percentage);
            return `${filled}${empty} ${current}/${max}`;
        };

        // 플레이어 정보 가져오기 (봇 대응)
        const getPlayerName = (player) => {
            if (player.isBot) {
                return player.user.nickname || '봇';
            }
            return player.user.nickname || '플레이어';
        };

        const getPlayerRating = (player) => {
            if (player.isBot) {
                return player.rating || player.user.rating || 1000;
            }
            return player.user.pvp?.rating || 1000;
        };

        const battleEmbed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle(`⚔️ 전투 레이드 - Round ${match.round}`)
            .setDescription('🎯 **공격 타이밍을 선택하세요!** (10초 제한)\n\n' +
                '**📍 공격 위치 설명:**\n' +
                '• 🌟 **별똥베기** - 상단 공격\n' +
                '• 🍬 **슈가스팅** - 중단 공격\n' +
                '• 🍄 **버섯팡** - 하단 공격\n\n' +
                '**⚔️ 전투 규칙:**\n' +
                '• 상대와 **같은 위치** 선택 → 🛡️ 방어 성공! (데미지 50% 감소)\n' +
                '• 상대와 **다른 위치** 선택 → 💥 공격 성공! (풀 데미지)')
            .addFields(
                { 
                    name: `⚔️ ${getPlayerName(player1)} (전투력: ${p1Stats.combatPower})`,
                    value: `${createHPBar(match.player1HP, p1Stats.maxHp)}\n🗡️ 공격력: ${p1Stats.attack}\n🛡️ 방어력: ${p1Stats.defense}\n💫 종합전투력: ${p1Stats.combatPower}\n🏆 레이팅: ${getPlayerRating(player1)}`,
                    inline: true
                },
                { 
                    name: '​', 
                    value: '​', 
                    inline: true 
                },
                { 
                    name: `⚔️ ${getPlayerName(player2)} (전투력: ${p2Stats.combatPower})`,
                    value: `${createHPBar(match.player2HP, p2Stats.maxHp)}\n🗡️ 공격력: ${p2Stats.attack}\n🛡️ 방어력: ${p2Stats.defense}\n💫 종합전투력: ${p2Stats.combatPower}\n🏆 레이팅: ${getPlayerRating(player2)}`,
                    inline: true
                }
            );

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`pvp_pendulum_${match.matchId}_high`)
                    .setLabel('별똥베기')
                    .setEmoji('🌟')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`pvp_pendulum_${match.matchId}_middle`)
                    .setLabel('슈가스팅')
                    .setEmoji('🍬')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`pvp_pendulum_${match.matchId}_low`)
                    .setLabel('버섯팡')
                    .setEmoji('🍄')
                    .setStyle(ButtonStyle.Danger)
            );

        // PVP 채널에만 메시지 전송 (중복 방지)
        if (match.pvpChannel && match.tempChannelCreated) {
            // 임시 채널이 생성된 경우 해당 채널에만 전송
            try {
                await match.pvpChannel.send({ 
                    embeds: [battleEmbed], 
                    components: [actionRow] 
                });
            } catch (error) {
                console.error('배틀 메시지 전송 실패:', error);
                // 실패 시 원래 채널로 폴백
                const channels = [];
                if (!player1.isBot && player1.channel) channels.push(player1.channel);
                if (!player2.isBot && player2.channel && player2.channel.id !== player1.channel.id) {
                    channels.push(player2.channel);
                }

                for (const channel of channels) {
                    try {
                        await channel.send({ 
                            embeds: [battleEmbed], 
                            components: [actionRow] 
                        });
                    } catch (err) {
                        console.error('폴백 채널 전송도 실패:', err);
                    }
                }
            }
        } else if (!match.tempChannelCreated) {
            // 임시 채널이 생성되지 않은 경우 원래 채널에 전송
            const channels = [];
            if (!player1.isBot && player1.channel) channels.push(player1.channel);
            if (!player2.isBot && player2.channel && player2.channel.id !== player1.channel.id) {
                channels.push(player2.channel);
            }

            for (const channel of channels) {
                try {
                    await channel.send({ 
                        embeds: [battleEmbed], 
                        components: [actionRow] 
                    });
                } catch (err) {
                    console.error('채널 전송 실패:', err);
                }
            }
        }

        // 봇인 경우 자동 선택
        if (player1.isBot) {
            setTimeout(() => this.makeBotChoice(match, 'player1'), Math.random() * 5000 + 2000);
        }
        if (player2.isBot) {
            setTimeout(() => this.makeBotChoice(match, 'player2'), Math.random() * 5000 + 2000);
        }

        // 10초 타이머 설정 (중복 방지를 위해 기존 타이머 취소)
        if (match.roundTimer) {
            clearTimeout(match.roundTimer);
        }
        match.roundTimer = setTimeout(() => {
            console.log(`[PVP] 라운드 ${match.round} 타임아웃`);
            this.resolveRound(match);
        }, 10000);
    }

    makeBotChoice(match, playerKey) {
        const positions = ['high', 'middle', 'low'];
        const choice = positions[Math.floor(Math.random() * positions.length)];
        match.pendingActions.set(playerKey, choice);
    }

    async handlePendulumChoice(interaction, matchId, position) {
        // 먼저 defer로 응답 대기 상태로 만들기
        await interaction.deferReply({ flags: 64 });

        const match = this.activeMatches.get(matchId);
        if (!match) {
            console.error(`[PVP] 매치를 찾을 수 없음: ${matchId}`);
            await interaction.editReply({ content: '매치를 찾을 수 없습니다!' });
            return;
        }

        // 매치 상태 확인
        if (match.status !== 'preparing' && match.status !== 'in_progress') {
            console.log(`[PVP] 잘못된 매치 상태: ${match.status}`);
            await interaction.editReply({ content: '이미 종료된 매치입니다!' });
            return;
        }

        const userId = interaction.user.id;
        let playerKey;

        // 디버깅용 로그
        console.log(`펜들럼 선택 - User ID: ${userId}`);
        console.log(`Player1 전체 데이터:`, JSON.stringify({
            userId: match.player1.userId,
            isBot: match.player1.isBot,
            discordId: match.player1.user?.discordId,
            nickname: match.player1.user?.nickname
        }));
        console.log(`Player2 전체 데이터:`, JSON.stringify({
            userId: match.player2.userId,
            isBot: match.player2.isBot,
            discordId: match.player2.user?.discordId,
            nickname: match.player2.user?.nickname
        }));

        // userId로 비교 (봇이 아닌 경우)
        if (!match.player1.isBot && match.player1.userId === userId) {
            playerKey = 'player1';
        } else if (!match.player2.isBot && match.player2.userId === userId) {
            playerKey = 'player2';
        } else {
            // 디스코드 ID로도 확인 (호환성)
            if (!match.player1.isBot && match.player1.user && match.player1.user.discordId === userId) {
                playerKey = 'player1';
            } else if (!match.player2.isBot && match.player2.user && match.player2.user.discordId === userId) {
                playerKey = 'player2';
            } else {
                console.log(`매치 참가자 확인 실패 - 요청 userId: ${userId}`);
                console.log(`Player1 userId: ${match.player1.userId}, discordId: ${match.player1.user?.discordId}`);
                console.log(`Player2 userId: ${match.player2.userId}, discordId: ${match.player2.user?.discordId}`);
                await interaction.editReply({ content: '이 대결의 참가자가 아닙니다!' });
                return;
            }
        }

        // 이미 선택했는지 확인 (현재 라운드만 체크)
        if (match.pendingActions.has(playerKey)) {
            console.log(`[PVP] 중복 선택 시도 - userId: ${userId}, playerKey: ${playerKey}, round: ${match.round}`);
            await interaction.editReply({ content: '이미 공격 타이밍을 선택했습니다!' });
            return;
        }

        match.pendingActions.set(playerKey, position);
        console.log(`[PVP] 선택 저장 - userId: ${userId}, playerKey: ${playerKey}, position: ${position}, round: ${match.round}`);

        const attackNames = {
            'high': '🌟 별똥베기',
            'middle': '🍬 슈가스팅',
            'low': '🍄 버섯팡'
        };

        await interaction.editReply({ 
            content: `⚔️ **${attackNames[position]}** 준비 완료! 반짝~✨`
        });

        // 두 플레이어 모두 선택했으면 즉시 라운드 종료
        if (match.pendingActions.size === 2) {
            console.log(`[PVP] 두 플레이어 모두 선택 완료 - 즉시 라운드 종료`);
            clearTimeout(match.roundTimer);
            await this.resolveRound(match);
        }
    }

    async resolveRound(match) {
        // 이미 종료된 매치인지 확인
        if (match.status === 'finished') {
            console.log('[PVP] resolveRound - 이미 종료된 매치');
            return;
        }

        const { player1, player2 } = match;
        const p1Stats = this.calculateCombatStats(player1);
        const p2Stats = this.calculateCombatStats(player2);

        const p1Choice = match.pendingActions.get('player1') || 'middle';
        const p2Choice = match.pendingActions.get('player2') || 'middle';

        console.log(`[PVP] 라운드 ${match.round} 결과 처리 - p1: ${p1Choice}, p2: ${p2Choice}`);

        // 플레이어 정보 가져오기
        const getPlayerName = (player) => {
            if (player.isBot) return player.user.nickname || '봇';
            return player.user.nickname || '플레이어';
        };

        // 공격 이름 변환
        const getAttackName = (choice) => {
            switch(choice) {
                case 'high': return '별똥베기 ✨';
                case 'middle': return '슈가스팅 🍭';
                case 'low': return '버섯팡 🍄';
                default: return '기본 공격';
            }
        };

        // PVP 강화 보너스 적용
        const getEnhancementBonus = (player, position) => {
            if (player.isBot) return 0;
            const enhancement = player.user.pvp?.attackEnhancement?.[position] || 0;
            return enhancement * 5; // 강화당 +5 데미지
        };

        const p1Enhancement = getEnhancementBonus(player1, p1Choice);
        const p2Enhancement = getEnhancementBonus(player2, p2Choice);

        console.log(`[PVP 강화] ${getPlayerName(player1)} - ${p1Choice} 강화: ${player1.user.pvp?.attackEnhancement?.[p1Choice] || 0}개 = +${p1Enhancement} 데미지`);
        console.log(`[PVP 강화] ${getPlayerName(player2)} - ${p2Choice} 강화: ${player2.user.pvp?.attackEnhancement?.[p2Choice] || 0}개 = +${p2Enhancement} 데미지`);

        let p1ActualDamage = 0;
        let p2ActualDamage = 0;
        let battleDescription = '';

        if (p1Choice === p2Choice) {
            // 같은 위치 - 방어 성공 (50% 데미지)
            const p1RawDamage = Math.floor((p1Stats.attack + p1Enhancement) * 0.5);
            const p2RawDamage = Math.floor((p2Stats.attack + p2Enhancement) * 0.5);
            p1ActualDamage = Math.max(5, p1RawDamage - Math.floor(p2Stats.defense * 0.5));
            p2ActualDamage = Math.max(5, p2RawDamage - Math.floor(p1Stats.defense * 0.5));

            battleDescription = `🛡️ **동시 공격!** 두 전사 모두 ${getAttackName(p1Choice)}를 시전!\n\n`;
            battleDescription += `⚔️ **${getPlayerName(player1)}**의 공격!\n`;
            battleDescription += `• 기본 공격력: ${p1Stats.attack + p1Enhancement} → 방어 성공! (50% 감소)\n`;
            battleDescription += `• **${getPlayerName(player2)}**가 ${p1ActualDamage} 데미지 받음!\n\n`;
            battleDescription += `⚔️ **${getPlayerName(player2)}**의 반격!\n`;
            battleDescription += `• 기본 공격력: ${p2Stats.attack + p2Enhancement} → 방어 성공! (50% 감소)\n`;
            battleDescription += `• **${getPlayerName(player1)}**가 ${p2ActualDamage} 데미지 받음!`;
        } else {
            // 다른 위치 - 풀 데미지
            p1ActualDamage = Math.max(10, (p1Stats.attack + p1Enhancement) - p2Stats.defense);
            p2ActualDamage = Math.max(10, (p2Stats.attack + p2Enhancement) - p1Stats.defense);

            battleDescription = `💥 **크로스 카운터!** 서로 다른 공격 패턴!\n\n`;
            battleDescription += `⚔️ **${getPlayerName(player1)}**의 ${getAttackName(p1Choice)}!\n`;
            battleDescription += `• 공격력: ${p1Stats.attack}${p1Enhancement > 0 ? ` (+${p1Enhancement}강)` : ''} - 방어력: ${p2Stats.defense}\n`;
            battleDescription += `• 💢 **${getPlayerName(player2)}**에게 ${p1ActualDamage} 데미지!\n\n`;
            battleDescription += `⚔️ **${getPlayerName(player2)}**의 ${getAttackName(p2Choice)}!\n`;
            battleDescription += `• 공격력: ${p2Stats.attack}${p2Enhancement > 0 ? ` (+${p2Enhancement}강)` : ''} - 방어력: ${p1Stats.defense}\n`;
            battleDescription += `• 💢 **${getPlayerName(player1)}**에게 ${p2ActualDamage} 데미지!`;
        }

        // 데미지 적용
        match.player2HP = Math.max(0, match.player2HP - p1ActualDamage);
        match.player1HP = Math.max(0, match.player1HP - p2ActualDamage);

        // 베팅 통계 추적
        if (!match.firstBloodPlayer && (p1ActualDamage > 0 || p2ActualDamage > 0)) {
            if (p1ActualDamage > p2ActualDamage) {
                match.firstBloodPlayer = player1.user.discordId;
            } else if (p2ActualDamage > p1ActualDamage) {
                match.firstBloodPlayer = player2.isBot ? 'bot_' + player2.user.nickname : player2.user.discordId;
            }
        }
        match.totalDamageDealt = (match.totalDamageDealt || 0) + p1ActualDamage + p2ActualDamage;

        // HP 바 생성
        const createHPBar = (current, max) => {
            const percentage = Math.max(0, Math.floor((current / max) * 10));
            const filled = '🟩'.repeat(percentage);
            const empty = '⬜'.repeat(10 - percentage);
            return `${filled}${empty} ${current}/${max}`;
        };

        // 전투 결과 임베드
        const resultEmbed = new EmbedBuilder()
            .setColor(p1Choice === p2Choice ? '#FFA500' : '#FF0000')
            .setTitle(`⚔️ Round ${match.round} 결과`)
            .setDescription(battleDescription)
            .addFields(
                {
                    name: `${getPlayerName(player1)} 상태`,
                    value: createHPBar(match.player1HP, p1Stats.maxHp),
                    inline: true
                },
                {
                    name: `${getPlayerName(player2)} 상태`,
                    value: createHPBar(match.player2HP, p2Stats.maxHp),
                    inline: true
                }
            )
            .setTimestamp();

        // PVP 채널에만 결과 전송 (중복 방지)
        if (match.pvpChannel && match.tempChannelCreated) {
            try {
                await match.pvpChannel.send({ embeds: [resultEmbed] });
            } catch (error) {
                console.error('전투 결과 전송 실패:', error);
                // 실패 시 원래 채널로 폴백
                const channels = [];
                if (!player1.isBot && player1.channel) channels.push(player1.channel);
                if (!player2.isBot && player2.channel && player2.channel.id !== player1.channel.id) {
                    channels.push(player2.channel);
                }

                for (const channel of channels) {
                    try {
                        await channel.send({ embeds: [resultEmbed] });
                    } catch (err) {
                        console.error('폴백 채널 전송도 실패:', err);
                    }
                }
            }
        } else if (!match.tempChannelCreated) {
            // 임시 채널이 없는 경우 원래 채널에 전송
            const channels = [];
            if (!player1.isBot && player1.channel) channels.push(player1.channel);
            if (!player2.isBot && player2.channel && player2.channel.id !== player1.channel.id) {
                channels.push(player2.channel);
            }

            for (const channel of channels) {
                try {
                    await channel.send({ embeds: [resultEmbed] });
                } catch (error) {
                    console.error('채널 전송 실패:', error);
                }
            }
        }

        match.battleLog.push({
            round: match.round,
            p1Choice,
            p2Choice,
            p1Damage: p1ActualDamage,
            p2Damage: p2ActualDamage,
            result: battleDescription
        });

        // 전투 종료 체크
        if (match.player1HP <= 0 || match.player2HP <= 0 || match.round >= 10) {
            // 2초 후 최종 결과 표시
            setTimeout(() => this.endPendulumBattle(match), 2000);
        } else {
            // 다음 라운드 (3초 대기)
            match.round++;
            match.pendingActions.clear(); // 다음 라운드를 위해 선택 초기화
            console.log(`[PVP] 라운드 ${match.round} 시작, pendingActions 초기화`);
            setTimeout(() => this.showBattleRound(match), 3000);
        }
    }

    async endPendulumBattle(match) {
        // 이미 종료된 매치인지 확인
        if (match.status === 'finished') {
            console.log('[PVP] 이미 종료된 매치 재처리 시도 방지');
            return;
        }

        match.status = 'finished';
        const winner = match.player1HP > match.player2HP ? 'player1' : 'player2';
        const battleResult = {
            winner,
            battles: match.battleLog,
            finalHp: { p1: match.player1HP, p2: match.player2HP },
            totalTurns: match.round
        };

        await this.processMatchResult(match, battleResult);

        // 임시 채널 삭제 (5초 후)
        if (match.pvpChannel) {
            setTimeout(async () => {
                try {
                    await match.pvpChannel.delete();
                    console.log(`[PVP] 임시 채널 삭제 완료 - matchId: ${match.matchId}`);
                } catch (error) {
                    console.error('[PVP] 임시 채널 삭제 실패:', error);
                }
            }, 5000);
        }
    }
}

// 의뢰 시스템 함수들
function getRandomQuest() {
    const allClients = [
        ...QUEST_CLIENTS.villagers,
        ...QUEST_CLIENTS.merchants,
        ...QUEST_CLIENTS.scammers,
        ...QUEST_CLIENTS.travelers
    ];
    return allClients[Math.floor(Math.random() * allClients.length)];
}

function calculateQuestReward(userLevel, questType) {
    if (questType === 'scam') {
        return null; // 사기 의뢰는 보상 없음
    }

    // 레벨에 비례한 보상 (100레벨을 기준으로 100~1000 골드)
    const baseReward = Math.floor(Math.random() * 900) + 100; // 100~1000 골드
    const levelMultiplier = userLevel / 100; // 레벨 배율
    const finalReward = Math.floor(baseReward * (0.5 + levelMultiplier)); // 최소 50% 보장

    return {
        gold: finalReward,
        exp: Math.floor(finalReward / 10) // 골드의 10% 경험치
    };
}

function addQuestCooldown(userId) {
    if (!global.questCooldowns) {
        global.questCooldowns = new Map();
    }
    global.questCooldowns.set(userId, Date.now() + (30 * 60 * 1000)); // 30분 쿨타임
}

function checkQuestCooldown(userId) {
    if (!global.questCooldowns) {
        global.questCooldowns = new Map();
    }
    const cooldownEnd = global.questCooldowns.get(userId);
    if (!cooldownEnd) return false;

    const timeLeft = cooldownEnd - Date.now();
    return timeLeft > 0 ? Math.ceil(timeLeft / (60 * 1000)) : false; // 남은 분 수 반환
}

// 🔮 에너지 조각 융합 시스템 상수
const ENERGY_FRAGMENT_SYSTEM = {
    MINE_COST: 500, // 채굴 비용
    MINE_COOLDOWN: 2 * 60 * 1000, // 2분 쿨타임
    DAILY_FUSION_LIMIT: 20, // 일일 융합 제한

    // 단계별 이름과 이모지
    TIER_NAMES: {
        '1-10': { name: '기초 에너지 조각', emoji: '🔸' },
        '11-25': { name: '마법 에너지 조각', emoji: '💠' },
        '26-50': { name: '크리스탈 에너지 조각', emoji: '💎' },
        '51-75': { name: '별빛 에너지 조각', emoji: '⭐' },
        '76-99': { name: '창조 에너지 조각', emoji: '🌌' },
        '100': { name: '궁극의 창조석', emoji: '✨' }
    },

    // 성공 확률
    SUCCESS_RATES: {
        '1-25': 85,
        '26-50': 80,
        '51-75': 75,
        '76-99': 70,
        '99-100': 50
    },

    // 실패 시 하락 범위
    FAIL_DROP: { min: 10, max: 30 },
    CRITICAL_FAIL_CHANCE: 1, // 대실패 확률 1%

    // 사냥터 드롭률
    HUNTING_DROP_CHANCE: 0.1, // 0.1%

    // 실패 스택
    FAILURE_STACK_CHANCE: 50, // 실패 시 50% 확률로 스택
    FAILURE_STACK_REQUIRED: 10, // 10스택 시 성공 확정

    // 주식 영향도
    STOCK_IMPACT: {
        '1-10': { company: '크리스탈 채굴공사', success: 5, fail: -3 },
        '11-25': { company: '마법 연구원', success: 8, fail: -4 },
        '26-50': { company: '수정 가공업체', success: 12, fail: -5 },
        '51-75': { company: '별빛 연구소', success: 15, fail: -6 },
        '76-99': { company: '창조 기술원', success: 20, fail: -8 },
        '100': { company: '전체시장', success: 50, fail: -25 }
    }
};

// 에너지 조각 관련 모든 함수들은 energyFragmentSystem 모듈에서 가져옴
const { 
    getFragmentTier, 
    getFragmentInfo, 
    getSuccessRate, 
    calculateFusionCost, 
    calculateCombatPowerFromFragment 
} = energyFragmentSystem;

// PVP 시스템 인스턴스 생성
pvpSystem = new PVPSystem();

// 🏪 아이템 경매장 시스템 함수들
// 시장 가격 계산 함수는 marketSystem 모듈에서 가져옴
const { calculateItemMarketPrice } = marketSystem;

// 시장 이벤트 업데이트 (ITEM_MARKET용)
function updateItemMarketEvent() {
    if (Math.random() < 0.3) { // 30% 확률로 이벤트 발생
        const randomEvent = ITEM_MARKET.dailyEvents[Math.floor(Math.random() * ITEM_MARKET.dailyEvents.length)];
        currentMarketEvent = {
            ...randomEvent,
            startTime: Date.now(),
            duration: 6 * 60 * 60 * 1000 // 6시간 지속
        };

        // 이벤트 알림 (서버 전체에 공지)
        AUCTION_HOUSE.events.push({
            type: 'market_event',
            message: `🌟 **${currentMarketEvent.name}** 이벤트가 시작되었습니다!`,
            timestamp: Date.now()
        });
    } else {
        currentMarketEvent = null;
    }
}

// 아이템 타입 분류
function getItemType(itemName) {
    if (itemName.includes('주문서')) return 'scrolls';
    if (itemName.includes('포션') || itemName.includes('물약') || itemName.includes('가루') || itemName.includes('엘릭서')) return 'consumables';
    if (itemName.includes('조각') || itemName.includes('코어') || itemName.includes('수액') || itemName.includes('원석')) return 'currency';
    return 'rare';
}

// 경매장 아이템 등록
function addAuctionListing(seller, item, startPrice, buyNowPrice, duration = 24) {
    const listingId = `auction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const listing = {
        id: listingId,
        sellerId: seller.discordId,
        sellerName: seller.nickname,
        item: item,
        startPrice: startPrice,
        currentPrice: startPrice,
        buyNowPrice: buyNowPrice,
        highestBidder: null,
        highestBidderName: null,
        bids: [],
        startTime: Date.now(),
        endTime: Date.now() + (duration * 60 * 60 * 1000),
        status: 'active'
    };

    AUCTION_HOUSE.listings.set(listingId, listing);
    saveGameData(); // 데이터 자동 저장
    return listingId;
}

// 입찰 처리
function placeBid(bidder, listingId, bidAmount) {
    const listing = AUCTION_HOUSE.listings.get(listingId);
    if (!listing || listing.status !== 'active') {
        return { success: false, message: '경매가 존재하지 않거나 종료되었습니다.' };
    }

    if (Date.now() > listing.endTime) {
        return { success: false, message: '경매가 이미 종료되었습니다.' };
    }

    if (bidAmount <= listing.currentPrice) {
        return { success: false, message: `현재 입찰가(${listing.currentPrice.toLocaleString()}G)보다 높게 입찰해주세요.` };
    }

    if (bidder.discordId === listing.sellerId) {
        return { success: false, message: '자신이 등록한 경매에는 입찰할 수 없습니다.' };
    }

    if (bidder.gold < bidAmount) {
        return { success: false, message: '골드가 부족합니다.' };
    }

    // 이전 최고 입찰자에게 골드 반환
    if (listing.highestBidder) {
        // 실제 구현시에는 User.findOne으로 이전 입찰자 찾아서 골드 반환
    }

    // 새로운 입찰 정보 업데이트
    listing.currentPrice = bidAmount;
    listing.highestBidder = bidder.discordId;
    listing.highestBidderName = bidder.nickname;
    listing.bids.push({
        bidderId: bidder.discordId,
        bidderName: bidder.nickname,
        amount: bidAmount,
        timestamp: Date.now()
    });

    // 입찰자 골드 차감 (임시 보관)
    bidder.gold -= bidAmount;

    saveGameData(); // 데이터 자동 저장
    return { success: true, message: '입찰이 완료되었습니다!' };
}

// 시세 조회 함수 (주식 차트와 유사)
function getItemPriceChart(itemName) {
    const history = AUCTION_HOUSE.priceHistory.get(itemName) || [];
    if (history.length === 0) {
        return { message: '해당 아이템의 거래 기록이 없습니다.' };
    }

    const latest = history[history.length - 1];
    const previous = history.length > 1 ? history[history.length - 2] : latest;
    const change = ((latest.price - previous.price) / previous.price * 100);

    return {
        itemName,
        currentPrice: latest.price,
        change: change,
        volume: latest.volume || 0,
        history: history.slice(-30) // 최근 30개 기록
    };
}

// 🎲 랜덤 이벤트 시스템 함수들
// 날씨 시스템 업데이트 (6시간마다)
function updateWeather() {
    const weatherList = RANDOM_EVENTS.weatherEffects;
    currentWeather = weatherList[Math.floor(Math.random() * weatherList.length)];
    saveGameData(); // 데이터 자동 저장
    return currentWeather;
}

// 일일 운세 업데이트 (24시간마다)
function updateDailyFortune() {
    const fortunes = RANDOM_EVENTS.dailyFortune;
    dailyFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    return dailyFortune;
}

// 랜덤 인카운터 체크
function checkRandomEncounter() {
    for (const encounter of RANDOM_EVENTS.randomEncounters) {
        if (Math.random() * 100 < encounter.rarity) {
            return encounter;
        }
    }
    return null;
}

// 신비한 상자 열기
function openMysteryBox(boxType, user) {
    const box = RANDOM_EVENTS.mysteryBoxes.find(b => b.name === boxType);
    if (!box) return { success: false, message: '존재하지 않는 상자입니다.' };

    if (user.gold < box.price) {
        return { success: false, message: '골드가 부족합니다.' };
    }

    // 가중치 기반 랜덤 선택
    const totalWeight = box.rewards.reduce((sum, reward) => sum + reward.weight, 0);
    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    for (const reward of box.rewards) {
        currentWeight += reward.weight;
        if (random <= currentWeight) {
            // 골드 차감
            user.gold -= box.price;

            // 보상 지급
            let rewardText = '';
            if (reward.item === '골드' || reward.item === '대량 골드') {
                const amount = Array.isArray(reward.amount) ? 
                    Math.floor(Math.random() * (reward.amount[1] - reward.amount[0] + 1)) + reward.amount[0] :
                    reward.amount;
                user.gold += amount;
                rewardText = `${amount.toLocaleString()}G`;
            } else if (reward.item === '경험치') {
                const amount = Array.isArray(reward.amount) ? 
                    Math.floor(Math.random() * (reward.amount[1] - reward.amount[0] + 1)) + reward.amount[0] :
                    reward.amount;
                user.exp += amount;
                rewardText = `${amount.toLocaleString()} EXP`;
            } else if (reward.item === '스탯 포인트') {
                const amount = Array.isArray(reward.amount) ? 
                    Math.floor(Math.random() * (reward.amount[1] - reward.amount[0] + 1)) + reward.amount[0] :
                    reward.amount;
                user.statPoints += amount;
                rewardText = `스탯 포인트 ${amount}개`;
            } else if (reward.item === '보호권') {
                const amount = Array.isArray(reward.amount) ? 
                    Math.floor(Math.random() * (reward.amount[1] - reward.amount[0] + 1)) + reward.amount[0] :
                    reward.amount;
                user.protectionScrolls += amount;
                rewardText = `보호권 ${amount}개`;
            } else {
                rewardText = reward.item;
            }

            return { 
                success: true, 
                reward: reward.item,
                rewardText: rewardText,
                message: `🎁 **${rewardText}**를 획득했습니다!`
            };
        }
    }

    return { success: false, message: '상자 열기에 실패했습니다.' };
}

// 현재 활성 효과들 적용
function getActiveEffects() {
    let effects = {};

    // 날씨 효과
    if (currentWeather) {
        Object.assign(effects, currentWeather.effect);
    }

    // 일일 운세 효과
    if (dailyFortune) {
        Object.assign(effects, dailyFortune.effect);
    }

    return effects;
}

// 📦 새로운 인벤토리 시스템 함수들
function getAvailableInventorySlot(user) {
    const usedSlots = user.inventory.map(item => item.inventorySlot).filter(slot => slot !== null && slot !== undefined);
    for (let i = 0; i < user.maxInventorySlots; i++) {
        if (!usedSlots.includes(i)) {
            return i;
        }
    }
    return -1; // 슬롯 부족
}

// 인벤토리 데이터 무결성 검사 및 복구
function validateAndFixInventory(user) {
    let needsFix = false;

    // 1. inventorySlot 중복 제거 및 재할당
    const slotMap = new Map();
    const itemsToReassign = [];

    user.inventory.forEach((item, index) => {
        if (item.inventorySlot === null || item.inventorySlot === undefined) {
            itemsToReassign.push(item);
            needsFix = true;
        } else if (slotMap.has(item.inventorySlot)) {
            // 중복된 슬롯 발견
            itemsToReassign.push(item);
            needsFix = true;
        } else {
            slotMap.set(item.inventorySlot, item);
        }
    });

    // 중복되거나 없는 슬롯을 가진 아이템들에 새 슬롯 할당
    itemsToReassign.forEach(item => {
        const newSlot = getAvailableInventorySlot(user);
        if (newSlot !== -1) {
            item.inventorySlot = newSlot;
            console.log(`[인벤토리 복구] ${item.name}에 새 슬롯 ${newSlot} 할당`);
        }
    });

    // 2. equipment 슬롯 검증
    const equipmentSlots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];
    equipmentSlots.forEach(slot => {
        const slotIndex = user.equipment[slot];

        // ObjectId 타입이거나 잘못된 타입인 경우 초기화
        if (typeof slotIndex === 'object' || (slotIndex !== -1 && slotIndex !== null && slotIndex !== undefined && isNaN(Number(slotIndex)))) {
            console.log(`[장비 복구] ${user.nickname}의 ${slot} 슬롯에 잘못된 데이터 타입: ${typeof slotIndex}`);
            user.equipment[slot] = -1;
            needsFix = true;
            return;
        }

        if (slotIndex !== -1 && slotIndex !== null && slotIndex !== undefined) {
            const slotNumber = Number(slotIndex);
            const item = user.inventory.find(i => i.inventorySlot === slotNumber);

            if (!item) {
                // 장착된 슬롯에 아이템이 없음
                console.log(`[장비 복구] ${user.nickname}의 ${slot} 슬롯 초기화: ${slotNumber} -> -1`);
                user.equipment[slot] = -1;
                needsFix = true;
            } else if (item.type !== slot) {
                // 잘못된 타입의 아이템이 장착됨
                console.log(`[장비 복구] ${user.nickname}의 ${slot} 슬롯에 잘못된 타입: ${item.type}`);
                user.equipment[slot] = -1;
                item.equipped = false;
                needsFix = true;
            } else if (!item.equipped) {
                // equipped 상태 동기화
                item.equipped = true;
                needsFix = true;
            }
        }
    });

    // 3. equipped 상태와 equipment 슬롯 동기화
    user.inventory.forEach(item => {
        if (item.equipped) {
            const slot = item.type;
            if (equipmentSlots.includes(slot)) {
                if (user.equipment[slot] !== item.inventorySlot) {
                    console.log(`[장비 동기화] ${item.name}의 장착 상태 동기화`);
                    user.equipment[slot] = item.inventorySlot;
                    needsFix = true;
                }
            } else {
                // 장착 불가능한 아이템이 equipped 상태
                item.equipped = false;
                needsFix = true;
            }
        }
    });

    return needsFix;
}

function addItemToInventory(user, itemData) {
    const slot = getAvailableInventorySlot(user);
    if (slot === -1) {
        return { success: false, message: '인벤토리가 가득 찼습니다!' };
    }

    const newItem = {
        ...itemData,
        inventorySlot: slot,
        equipped: false
    };

    user.inventory.push(newItem);
    return { success: true, slot: slot };
}

function equipItem(user, inventorySlot, equipmentType) {
    // inventorySlot을 숫자로 변환
    const slotNumber = typeof inventorySlot === 'string' ? parseInt(inventorySlot) : inventorySlot;

    const item = user.inventory.find(item => item.inventorySlot === slotNumber);
    if (!item) {
        console.log(`[장비 오류] inventorySlot ${slotNumber}에 아이템을 찾을 수 없음`);
        return { success: false, message: '아이템을 찾을 수 없습니다!' };
    }

    // 아이템 타입 확인
    if (item.type !== equipmentType) {
        return { success: false, message: `이 아이템은 ${equipmentType} 슬롯에 장착할 수 없습니다!` };
    }

    // 레벨 체크
    if (user.level < item.level) {
        return { success: false, message: `레벨이 부족합니다! (필요: Lv.${item.level})` };
    }

    // 이전 장비 해제
    const previousSlot = user.equipment[equipmentType];
    if (previousSlot !== -1 && previousSlot !== null && previousSlot !== undefined) {
        const previousItem = user.inventory.find(item => item.inventorySlot === previousSlot);
        if (previousItem) {
            previousItem.equipped = false;
        }
    }

    // 새 장비 장착
    user.equipment[equipmentType] = slotNumber;
    item.equipped = true;

    console.log(`[장비 장착] ${user.nickname}가 ${item.name}을(를) ${equipmentType} 슬롯에 장착`);

    // 능력치 재계산
    calculateUserStats(user);

    return { success: true, message: '장비를 착용했습니다!', itemName: item.name };
}

// 사용자의 최종 능력치 계산 함수
function calculateUserStats(user) {
    // stats 필드 초기화 확인
    if (!user.stats) {
        user.stats = {
            strength: 5,
            agility: 5,
            intelligence: 5,
            vitality: 5,
            luck: 5
        };
    }

    // 각 스탯 값 검증
    user.stats.strength = user.stats.strength || 5;
    user.stats.agility = user.stats.agility || 5;
    user.stats.intelligence = user.stats.intelligence || 5;
    user.stats.vitality = user.stats.vitality || 5;
    user.stats.luck = user.stats.luck || 5;

    // 엠블럼 타입 확인
    const emblemType = getEmblemType(user.emblem);

    // 엠블럼 강화 스탯 추가
    const enhanceStats = user.emblemEnhancement?.stats || {};
    const totalStats = {
        strength: user.stats.strength + (enhanceStats.strength || 0),
        agility: user.stats.agility + (enhanceStats.agility || 0),
        intelligence: user.stats.intelligence + (enhanceStats.intelligence || 0),
        vitality: user.stats.vitality + (enhanceStats.vitality || 0),
        luck: user.stats.luck + (enhanceStats.luck || 0)
    };

    console.log(`[스탯 계산] 유저: ${user.nickname}, 엠블럼: ${user.emblem}, 타입: ${emblemType}`);
    console.log(`[스탯 계산] 기본 스탯: STR ${user.stats.strength}, AGI ${user.stats.agility}, INT ${user.stats.intelligence}, VIT ${user.stats.vitality}, LUK ${user.stats.luck}`);
    console.log(`[스탯 계산] 강화 스탯: STR +${enhanceStats.strength || 0}, AGI +${enhanceStats.agility || 0}, INT +${enhanceStats.intelligence || 0}, VIT +${enhanceStats.vitality || 0}, LUK +${enhanceStats.luck || 0}`);

    // 직업별 스탯 가중치에 따른 공격력/방어력 계산
    let baseAttack, baseDefense, baseHealth;

    switch(emblemType) {
        case 'warrior': // 전사: 힘 위주
            baseAttack = totalStats.strength * 3 + totalStats.vitality * 1;
            baseDefense = totalStats.vitality * 2 + totalStats.strength * 1;
            baseHealth = 100 + totalStats.vitality * 15;
            break;

        case 'archer': // 궁수: 민첩 위주
            baseAttack = totalStats.agility * 3 + totalStats.luck * 1;
            baseDefense = totalStats.agility * 1 + totalStats.vitality * 1.5;
            baseHealth = 100 + totalStats.vitality * 10;
            break;

        case 'defender': // 수호자: 체력 위주
            baseAttack = totalStats.strength * 1.5 + totalStats.vitality * 1;
            baseDefense = totalStats.vitality * 3 + totalStats.strength * 1;
            baseHealth = 100 + totalStats.vitality * 20;
            break;

        case 'wizard': // 마법사: 지능 위주
            baseAttack = totalStats.intelligence * 3 + totalStats.agility * 1;
            baseDefense = totalStats.intelligence * 1.5 + totalStats.vitality * 1;
            baseHealth = 100 + totalStats.vitality * 8;
            break;

        case 'rogue': // 도적: 행운/민첩 위주
            baseAttack = totalStats.agility * 2 + totalStats.luck * 2;
            baseDefense = totalStats.agility * 1.5 + totalStats.luck * 1;
            baseHealth = 100 + totalStats.vitality * 10;
            break;

        default: // 엠블럼 없는 경우 기본 공식
            baseAttack = totalStats.strength * 2 + totalStats.agility;
            baseDefense = totalStats.vitality * 2 + totalStats.intelligence;
            baseHealth = 100 + totalStats.vitality * 10;
    }

    let totalAttack = Math.floor(baseAttack);
    let totalDefense = Math.floor(baseDefense);

    // 장비 스탯 합산
    const equipmentTypes = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];
    for (const type of equipmentTypes) {
        const slotIndex = user.equipment[type];
        if (slotIndex !== -1 && slotIndex != null) {
            const item = user.inventory.find(item => item.inventorySlot === slotIndex);
            if (item && item.stats) {
                totalAttack += item.stats.attack || 0;
                totalDefense += item.stats.defense || 0;

                // 강화 보너스 적용
                if (item.enhanceLevel > 0) {
                    const enhanceBonus = calculateEnhancementBonus(item.enhanceLevel);
                    totalAttack += Math.floor((item.stats.attack || 0) * enhanceBonus / 100);
                    totalDefense += Math.floor((item.stats.defense || 0) * enhanceBonus / 100);
                }

                // 랜덤 옵션 적용
                if (item.randomOptions) {
                    item.randomOptions.forEach(option => {
                        if (option.type === 'attack') totalAttack += option.value;
                        if (option.type === 'defense') totalDefense += option.value;
                    });
                }
            }
        }
    }

    // PVP 강화 보너스
    if (user.pvp && user.pvp.attackEnhancement) {
        const pvpBonus = (user.pvp.attackEnhancement.high || 0) + 
                        (user.pvp.attackEnhancement.middle || 0) + 
                        (user.pvp.attackEnhancement.low || 0);
        totalAttack += pvpBonus;
    }

    // NaN 체크 및 기본값 설정
    if (isNaN(totalAttack) || totalAttack === null || totalAttack === undefined) {
        totalAttack = 10;
    }
    if (isNaN(totalDefense) || totalDefense === null || totalDefense === undefined) {
        totalDefense = 10;
    }
    if (isNaN(baseHealth) || baseHealth === null || baseHealth === undefined) {
        baseHealth = 100;
    }

    // 사용자 능력치 업데이트
    user.attack = totalAttack;
    user.defense = totalDefense;
    user.health = baseHealth;

    return { attack: totalAttack, defense: totalDefense, health: baseHealth };
}

function unequipItem(user, equipmentType) {
    const slotIndex = user.equipment[equipmentType];
    if (slotIndex === -1 || slotIndex === null || slotIndex === undefined) {
        return { success: false, error: '착용된 장비가 없습니다!', message: '착용된 장비가 없습니다!' };
    }

    const item = user.inventory.find(item => item.inventorySlot === slotIndex);
    let itemName = '알 수 없는 아이템';

    if (item) {
        item.equipped = false;
        itemName = item.name;
        console.log(`[장비 해제] ${user.nickname}가 ${item.name}을(를) 해제`);
    } else {
        console.log(`[장비 오류] ${user.nickname}의 ${equipmentType} 슬롯 ${slotIndex}에 아이템이 없음`);
    }

    user.equipment[equipmentType] = -1;

    // 능력치 재계산
    calculateUserStats(user);

    return { success: true, message: '장비를 해제했습니다!', itemName: itemName };
}

function sellEquippedItem(user, equipmentType) {
    const item = getEquippedItem(user, equipmentType);
    if (!item) return { success: false, message: '착용된 장비가 없습니다!' };

    // 판매가격 계산: 기본가격 70% × 강화레벨
    const basePrice = Math.floor(item.price * 0.7);
    const enhanceMultiplier = item.enhanceLevel > 0 ? (1 + item.enhanceLevel * 0.1) : 1;
    const sellPrice = Math.floor(basePrice * enhanceMultiplier);

    // 장비 해제 및 인벤토리에서 제거
    user.equipment[equipmentType] = -1;
    user.inventory = user.inventory.filter(invItem => invItem.inventorySlot !== item.inventorySlot);
    user.gold += sellPrice;

    return { success: true, sellPrice: sellPrice, itemName: item.name };
}

// 엠블럼 시스템 데이터
const EMBLEMS = {
    warrior: {
        name: '전사',
        emoji: '⚔️',
        emblems: [
            { name: '초보전사', price: 300000, level: 20, roleName: '초보전사' },
            { name: '튼튼한 기사', price: 500000, level: 35, roleName: '튼튼한 기사' },
            { name: '용맹한 검사', price: 1500000, level: 50, roleName: '용맹한 검사' },
            { name: '맹령한 전사', price: 3000000, level: 65, roleName: '맹령한 전사' },
            { name: '전설의 기사', price: 10000000, level: 80, roleName: '전설의 기사' }
        ]
    },
    archer: {
        name: '궁수',
        emoji: '🏹',
        emblems: [
            { name: '마을사냥꾼', price: 300000, level: 20, roleName: '마을사냥꾼' },
            { name: '숲의 궁수', price: 500000, level: 35, roleName: '숲의 궁수' },
            { name: '바람 사수', price: 1500000, level: 50, roleName: '바람 사수' },
            { name: '정확한 사격수', price: 3000000, level: 65, roleName: '정확한 사격수' },
            { name: '전설의 명궁', price: 10000000, level: 80, roleName: '전설의 명궁' }
        ]
    },
    defender: {
        name: '수호자',
        emoji: '🛡️',
        emblems: [
            { name: '초보 수호자', price: 300000, level: 20, roleName: '초보 수호자' },
            { name: '철벽 방패병', price: 500000, level: 35, roleName: '철벽 방패병' },
            { name: '불굴의 수호자', price: 1500000, level: 50, roleName: '불굴의 수호자' },
            { name: '강철 파수꾼', price: 3000000, level: 65, roleName: '강철 파수꾼' },
            { name: '전설의 철벽', price: 10000000, level: 80, roleName: '전설의 철벽' }
        ]
    },
    wizard: {
        name: '마법사',
        emoji: '🧙',
        emblems: [
            { name: '견습 마법사', price: 300000, level: 20, roleName: '견습 마법사' },
            { name: '원소 술사', price: 500000, level: 35, roleName: '원소 술사' },
            { name: '신비한 현자', price: 1500000, level: 50, roleName: '신비한 현자' },
            { name: '대마법사', price: 3000000, level: 65, roleName: '대마법사' },
            { name: '전설의 아크메이지', price: 10000000, level: 80, roleName: '전설의 아크메이지' }
        ]
    },
    rogue: {
        name: '도적',
        emoji: '🗡️',
        emblems: [
            { name: '떠돌이 도적', price: 300000, level: 20, roleName: '떠돌이 도적' },
            { name: '운 좋은 도둑', price: 500000, level: 35, roleName: '운 좋은 도둑' },
            { name: '행운의 닌자', price: 1500000, level: 50, roleName: '행운의 닌자' },
            { name: '복 많은 도적', price: 3000000, level: 65, roleName: '복 많은 도적' },
            { name: '전설의 행운아', price: 10000000, level: 80, roleName: '전설의 행운아' }
        ]
    }
};

// 엠블럼 채널 ID
const EMBLEM_CHANNEL_ID = '1381614153399140412';

// 유저 칭호 가져오기 함수
function getUserTitle(user) {
    if (user.emblem) {
        return user.emblem; // 엠블럼이 있으면 엠블럼을 칭호로 사용
    }
    return '모험가'; // 엠블럼이 없으면 기본 칭호
}

// 장비 카테고리 이름 가져오기 함수
function getCategoryName(category) {
    const names = {
        weapon: '무기',
        armor: '갑옷',
        helmet: '헬멧',
        gloves: '장갑',
        boots: '부츠',
        accessory: '액세서리'
    };
    return names[category] || category;
}

// 장비 카테고리 이모지 가져오기 함수
function getCategoryEmoji(category) {
    const emojis = {
        weapon: '⚔️',
        armor: '🛡️',
        helmet: '⛑️',
        gloves: '🧤',
        boots: '👢',
        accessory: '💎'
    };
    return emojis[category] || '⚙️';
}

// 봇 설정
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

// 봇 토큰 (환경변수에서 가져오거나 직접 입력)
console.log('🔍 환경 변수 확인:', {
    BOT_TOKEN: process.env.BOT_TOKEN ? 'SET' : 'NOT SET',
    TOKEN: process.env.TOKEN ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    ALL_KEYS: Object.keys(process.env).filter(key => key.includes('TOKEN') || key.includes('BOT'))
});

// Railway가 따옴표를 추가하는 경우를 처리
const TOKEN = (process.env.BOT_TOKEN || process.env.TOKEN || '').replace(/^["']|["']$/g, '') || 'YOUR_BOT_TOKEN_HERE';
console.log('🔍 토큰 확인:', TOKEN ? `${TOKEN.substring(0, 10)}...` : 'TOKEN NOT FOUND');
const CLIENT_ID = process.env.CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
// DEV_CHANNEL_IDS와 DEV_MODE는 config/constants.js에서 import됨
const GAME_CHANNEL_ID = process.env.GAME_CHANNEL_ID;
const DEVELOPER_ID = process.env.DEVELOPER_ID;
const POPULAR_KING_ROLE_NAME = '👑 인기왕';
const PRODUCTION_TEST_CHANNEL_ID = '1387483613913944145'; // 본서버 테스트 채널

// 관리자 설정
const ADMIN_CHANNEL_ID = '1387483613913944145'; // 관리자 전용 채널 ID - 설정 시 해당 채널에서는 모든 명령어 사용 가능

// 클로즈베타 설정
const BETA_MODE = process.env.BETA_MODE === 'true';
const BETA_CHANNEL_IDS = process.env.BETA_CHANNEL_IDS ? process.env.BETA_CHANNEL_IDS.split(',').map(id => id.trim()) : [];
const BETA_USER_IDS = process.env.BETA_USER_IDS ? process.env.BETA_USER_IDS.split(',').map(id => id.trim()) : [];

// 베타 테스터 확인 함수 - 이 프로젝트에 맞게 수정됨
function isBetaTester(userId) {
    return BETA_USER_IDS.includes(userId) || isAdmin(userId);
}

// 베타 채널 확인 함수
function isBetaChannel(channelId) {
    return BETA_CHANNEL_IDS.includes(channelId) || DEV_CHANNEL_IDS.includes(channelId);
}

// 관리자 전용 채널 확인 함수
function isAdminChannel(channelId) {
    return ADMIN_CHANNEL_ID && channelId === ADMIN_CHANNEL_ID;
}

// 카운트다운 상태 확인 함수
const { isCountdownActive } = countdownSystem;

// 개발자 체크 함수
function isDeveloper(userId) {
    return DEVELOPER_ID && userId === DEVELOPER_ID;
}

// 본서버 테스트 채널에서 사용 가능한지 확인
function canUseInProductionTest(interaction) {
    // 개발자는 항상 허용
    if (isDeveloper(interaction.user.id)) return true;

    // 본서버 테스트 채널에서만 허용
    if (interaction.channelId === PRODUCTION_TEST_CHANNEL_ID) {
        // 특정 사용자만 허용하려면 여기에 조건 추가
        return true;
    }

    return false;
}

// 미니게임 채널 확인 함수
function isMinigameChannel(channelId) {
    return channelId === PRODUCTION_TEST_CHANNEL_ID;
}

// 게임 유틸리티 함수들은 gameUtils 모듈에서 가져옴
const { getRarityEmoji, generateExpBar } = gameUtils;

// 랜덤 아이템 능력치 생성 함수
function generateRandomStats(statRanges) {
    const randomStats = {};
    for (const [statName, range] of Object.entries(statRanges)) {
        if (range[0] === range[1]) {
            // 고정값인 경우
            randomStats[statName] = range[0];
        } else {
            // 범위에서 랜덤 생성
            randomStats[statName] = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
        }
    }
    return randomStats;
}

// 랜덤 추가 옵션 생성 함수
function generateRandomOptions(rarity) {
    const options = [];
    const optionChances = {
        '일반': { chance: 20, maxOptions: 1 },
        '고급': { chance: 40, maxOptions: 2 },
        '희귀': { chance: 60, maxOptions: 2 },
        '영웅': { chance: 80, maxOptions: 3 },
        '전설': { chance: 100, maxOptions: 3 }
    };

    const optionPool = [
        { name: '추가 공격력', type: 'attack', value: [1, 5] },
        { name: '추가 방어력', type: 'defense', value: [1, 5] },
        { name: '추가 회피율', type: 'dodge', value: [1, 3] },
        { name: '추가 행운', type: 'luck', value: [1, 3] },
        { name: '골드 획득량', type: 'goldBonus', value: [5, 15] },
        { name: '경험치 획득량', type: 'expBonus', value: [5, 15] },
        { name: '체력 회복', type: 'hpRegen', value: [1, 3] },
        { name: '치명타 확률', type: 'critChance', value: [1, 5] },
        { name: '치명타 피해', type: 'critDamage', value: [10, 30] }
    ];

    const rarityConfig = optionChances[rarity] || optionChances['일반'];

    // 추가 옵션이 붙을지 확률 계산
    if (Math.random() * 100 > rarityConfig.chance) {
        return options;
    }

    // 옵션 개수 결정
    const numOptions = Math.floor(Math.random() * rarityConfig.maxOptions) + 1;
    const selectedOptions = new Set();

    for (let i = 0; i < numOptions && i < optionPool.length; i++) {
        let option;
        do {
            option = optionPool[Math.floor(Math.random() * optionPool.length)];
        } while (selectedOptions.has(option.type));

        selectedOptions.add(option.type);

        const value = Math.floor(Math.random() * (option.value[1] - option.value[0] + 1)) + option.value[0];
        options.push({
            name: option.name,
            type: option.type,
            value: value,
            displayValue: option.type.includes('Bonus') || option.type.includes('Damage') ? `+${value}%` : `+${value}`
        });
    }

    return options;
}

// 강화 확률표와 비용 계수는 config/enhancementConfig.js에서 import됨

// 아이템 레벨별 설정 (모든 상점 아이템 포함)
const ITEM_LEVELS = {
    // 기본 아이템
    '기본 검': 1,
    '기본 갑옷': 1,
    '체력 포션': 1,
    '마나 포션': 1,

    // 무기류
    '나무 검': 1,
    '철 검': 10,
    '강철 검': 25,
    '미스릴 검': 40,
    '드래곤 검': 60,

    // 갑옷류
    '가죽 갑옷': 1,
    '사슬 갑옷': 15,
    '판금 갑옷': 30,
    '드래곤 갑옷': 50,

    // 헬멧류
    '가죽 헬멧': 1,
    '철 헬멧': 10,
    '강철 헬멧': 20,
    '미스릴 헬멧': 35,

    // 장갑류
    '가죽 장갑': 1,
    '사슬 장갑': 10,
    '판금 장갑': 25,

    // 부츠류
    '가죽 부츠': 1,
    '철 부츠': 10,
    '강철 부츠': 25,

    // 액세서리류
    '나무 반지': 1,
    '은 반지': 10,
    '금 반지': 20,
    '다이아몬드 반지': 40,

    // 세트 아이템
    '꽃잎 세트': 1,
    '별빛 세트': 20,
    '드래곤 세트': 40,
    '시공 세트': 60,
    '강화왕 세트': 80
};

// 강화 비용 계산 함수 (Discord 봇에 맞게 조정된 골드 경제)
function calculateEnhanceCost(itemLevel, currentStar) {
    if (currentStar >= 30) return 0; // 30강은 최대

    const L = itemLevel;
    const S = currentStar;
    const coefficient = COST_COEFFICIENTS[S] || 200;

    // 기본 공식: 100 + L × 3^(S+1) × 계수
    // Discord 봇 경제에 맞게 1/10000 스케일로 조정
    const baseCost = 100 + L * Math.pow(3, S + 1) * coefficient;
    const adjustedCost = Math.floor(baseCost / 10000);

    // 최소 비용 보장 및 십의 자리 반올림
    const finalCost = Math.max(100, adjustedCost);
    return Math.round(finalCost / 10) * 10;
}

// 강화 성공률 계산 함수
function calculateSuccessRate(currentStar) {
    // ENHANCEMENT_RATES 테이블에서 확률 가져오기
    if (ENHANCEMENT_RATES[currentStar]) {
        return ENHANCEMENT_RATES[currentStar].success / 100; // 백분율을 소수로 변환
    }
    return 0.01; // 기본값
}

// 강화 스탯 보너스 계산 함수
function calculateEnhancementBonus(itemLevel, enhanceLevel) {
    if (enhanceLevel <= 0) return { attack: 0, defense: 0 };

    // 강화 공식: 레벨/20 + 강화당 고정 보너스
    const baseBonus = Math.floor(itemLevel / 20) + 1;

    let attack = 0;
    let defense = 0;

    // 1-5강: 기본 보너스
    for (let i = 1; i <= Math.min(enhanceLevel, 5); i++) {
        attack += baseBonus;
        defense += baseBonus;
    }

    // 6-10강: 보너스 증가
    for (let i = 6; i <= Math.min(enhanceLevel, 10); i++) {
        attack += baseBonus + 1;
        defense += baseBonus + 1;
    }

    // 11-15강: 더 큰 보너스
    for (let i = 11; i <= Math.min(enhanceLevel, 15); i++) {
        attack += baseBonus + 2;
        defense += baseBonus + 2;
    }

    // 16-25강: 최고 보너스
    for (let i = 16; i <= Math.min(enhanceLevel, 25); i++) {
        attack += baseBonus + 3;
        defense += baseBonus + 3;
    }

    // 26-30강: 극한 보너스
    for (let i = 26; i <= Math.min(enhanceLevel, 30); i++) {
        attack += baseBonus + 5;
        defense += baseBonus + 5;
    }

    return { attack, defense };
}

// 집중력 확률 조정 함수
function applyFocus(rates) {
    const newSuccess = Math.min(100, rates.success * 1.05);
    const remaining = 100 - newSuccess;
    const failRatio = rates.fail / (rates.fail + rates.destroy);

    return {
        success: newSuccess,
        fail: remaining * failRatio,
        destroy: remaining * (1 - failRatio)
    };
}

// 축복받은날 확률 조정 함수 (15~22강만)
function applyBlessedDay(rates, enhanceLevel) {
    if (enhanceLevel < 15 || enhanceLevel > 22) return rates;

    const newDestroy = rates.destroy * 0.7;
    const newFail = rates.fail + (rates.destroy - newDestroy);

    return {
        success: rates.success,
        fail: newFail,
        destroy: newDestroy
    };
}

// 강화 시도 함수
function attemptEnhance(rates, isFocusMode = false, isBlessedDay = false, enhanceLevel = 0) {
    let finalRates = { ...rates };

    if (isFocusMode) {
        finalRates = applyFocus(finalRates);
    }

    if (isBlessedDay) {
        finalRates = applyBlessedDay(finalRates, enhanceLevel);
    }

    const random = Math.random() * 100;

    if (random <= finalRates.success) {
        return 'success';
    } else if (random <= finalRates.success + finalRates.fail) {
        return 'fail';
    } else {
        return 'destroy';
    }
}

// 보호권을 사용한 강화 시도 함수
function attemptEnhanceWithProtection(rates, isFocusMode = false, isBlessedDay = false, enhanceLevel = 0, useProtection = false) {
    const baseResult = attemptEnhance(rates, isFocusMode, isBlessedDay, enhanceLevel);

    // 보호권 사용 시 파괴 결과를 실패로 변경
    if (useProtection && baseResult === 'destroy') {
        return 'fail';
    }

    return baseResult;
}

// 최고 강화 장비 찾기 함수
async function getTopEnhancedUser() {
    try {
        const users = await User.find({ registered: true });
        let topUser = null;
        let maxEnhance = -1;
        let topItem = null;

        for (const user of users) {
            // 착용 장비 확인
            for (const [slot, equipment] of Object.entries(user.equipment)) {
                if (equipment && equipment.enhanceLevel > maxEnhance) {
                    maxEnhance = equipment.enhanceLevel;
                    topUser = user;
                    topItem = equipment;
                }
            }
        }

        return { user: topUser, item: topItem, enhanceLevel: maxEnhance };
    } catch (error) {
        console.error('최고 강화 유저 조회 오류:', error);
        return null;
    }
}

// 강화왕 역할 업데이트 함수
async function updateEnhanceKingRole(guild) {
    try {
        const ENHANCE_KING_ROLE_NAME = '강화왕';

        // 강화왕 역할 찾기 또는 생성
        let enhanceKingRole = guild.roles.cache.find(role => role.name === ENHANCE_KING_ROLE_NAME);

        if (!enhanceKingRole) {
            enhanceKingRole = await guild.roles.create({
                name: ENHANCE_KING_ROLE_NAME,
                color: '#FF6B00', // 주황색
                hoist: true,
                reason: '강화왕 시스템 자동 생성'
            });
        }

        // 현재 강화왕 찾기
        const currentKing = guild.members.cache.find(member => 
            member.roles.cache.has(enhanceKingRole.id)
        );

        // 최고 강화 유저 찾기
        const topData = await getTopEnhancedUser();

        if (!topData || !topData.user) return;

        const newKing = guild.members.cache.get(topData.user.discordId);

        if (!newKing) return;

        // 현재 왕이 새로운 왕과 다르면 역할 변경
        if (!currentKing || currentKing.id !== newKing.id) {
            // 기존 왕에서 역할 제거
            if (currentKing) {
                await currentKing.roles.remove(enhanceKingRole);
            }

            // 새로운 왕에게 역할 부여
            await newKing.roles.add(enhanceKingRole);
        }

    } catch (error) {
        console.error('강화왕 역할 업데이트 오류:', error);
    }
}

// 통합 전투력 계산 함수
function calculateCombatPower(user) {
    let basePower = 0;

    // 1. 저장된 공격력/방어력 사용 (이미 기본 스탯과 장비가 반영됨)
    const storedAttack = user.attack || 10;
    const storedDefense = user.defense || 10;
    basePower = storedAttack + storedDefense;

    // 2. 엠블럼 보너스
    if (user.emblem) {
        const emblemLevel = getEmblemLevel(user.emblem);
        const emblemBonus = emblemLevel * 50; // 엠블럼 단계당 50 전투력
        basePower += emblemBonus;
    }

    // 3. 장비의 회피/행운 스탯만 추가 (attack/defense는 이미 저장된 값에 포함)
    let additionalPower = 0;
    const equipmentSlots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];

    equipmentSlots.forEach(slot => {
        const item = getEquippedItem(user, slot);
        if (item && item.stats) {
            const dodge = item.stats.dodge || 0;
            const luck = item.stats.luck || 0;
            additionalPower += dodge + luck;
        }
    });

    // 4. PVP 강화 전투력
    let pvpPower = 0;
    if (user.pvp?.attackEnhancement) {
        pvpPower = (user.pvp.attackEnhancement.high || 0) * 5 +
                   (user.pvp.attackEnhancement.middle || 0) * 5 +
                   (user.pvp.attackEnhancement.low || 0) * 5;
    }

    // 5. 에너지 조각 전투력
    let fragmentPower = 0;
    if (user.energyFragments?.highestLevel) {
        fragmentPower = calculateCombatPowerFromFragment(user.energyFragments.highestLevel);
    }

    // 6. 레벨 보너스
    const levelBonus = user.level * 10;

    // 7. 운동 시스템 보너스
    let fitnessPower = 0;
    if (user.fitness?.stats) {
        fitnessPower = (user.fitness.stats.strength || 0) * 2 +
                       (user.fitness.stats.stamina || 0) * 2 +
                       (user.fitness.stats.flexibility || 0) * 1 +
                       (user.fitness.stats.agility || 0) * 1 +
                       (user.fitness.stats.mental || 0) * 1;
    }

    // 총 전투력 계산
    const totalPower = Math.floor(
        basePower + 
        additionalPower + 
        pvpPower + 
        fragmentPower + 
        levelBonus + 
        fitnessPower
    );

    return totalPower;
}

// 아이템 점수 계산 함수 (최적화 장착용)
function calculateItemScore(item) {
    if (!item) return 0;

    let score = 0;

    // 1. 강화 레벨 (가장 중요, 레벨당 1000점)
    score += (item.enhanceLevel || 0) * 1000;

    // 2. 등급 점수 (rarity 필드 사용)
    const rarityScores = {
        '일반': 10,      // 일반 (흰색)
        '고급': 50,      // 고급 (녹색)
        '레어': 100,     // 레어 (파란색)
        '에픽': 200,     // 에픽 (보라색)
        '유니크': 400,   // 유니크 (빨간색)
        '레전드리': 800  // 레전드리 (노란색) - 최고 등급
    };
    score += rarityScores[item.rarity] || 10;

    // 3. 기본 스탯 합계 (stats 객체 사용)
    if (item.stats) {
        score += (item.stats.attack || 0) * 2;
        score += (item.stats.defense || 0) * 2;
        score += (item.stats.dodge || 0) * 1;
        score += (item.stats.luck || 0) * 1;
    }

    // 4. 장비 레벨 (높은 레벨 장비일수록 가치 있음)
    score += (item.level || 1) * 5;

    // 5. 랜덤 옵션 보너스
    if (item.randomOptions && item.randomOptions.length > 0) {
        item.randomOptions.forEach(option => {
            score += (option.value || 0) * 10;
        });
    }

    return score;
}

// 데이터 무결성 검사 함수
async function validateUserData(user) {
    const issues = [];
    let modified = false;

    // 1. 기본 필드 검사
    if (typeof user.level !== 'number' || user.level < 1 || user.level > 9999) {
        issues.push(`레벨 오류: ${user.level}`);
        user.level = Math.max(1, Math.min(9999, parseInt(user.level) || 1));
        modified = true;
    }

    if (typeof user.exp !== 'number' || user.exp < 0) {
        issues.push(`경험치 오류: ${user.exp}`);
        user.exp = Math.max(0, parseInt(user.exp) || 0);
        modified = true;
    }

    if (typeof user.gold !== 'number' || user.gold < 0) {
        issues.push(`골드 오류: ${user.gold}`);
        user.gold = Math.max(0, parseInt(user.gold) || 0);
        modified = true;
    }

    // 2. 출석 데이터 검사
    if (typeof user.attendanceStreak !== 'number' || user.attendanceStreak < 0) {
        issues.push(`연속출석 오류: ${user.attendanceStreak}`);
        user.attendanceStreak = Math.max(0, parseInt(user.attendanceStreak) || 0);
        modified = true;
    }

    // 3. 스탯 검사
    if (!user.stats || typeof user.stats !== 'object') {
        issues.push('스탯 객체 누락');
        user.stats = {
            strength: 10,
            agility: 10,
            intelligence: 10,
            vitality: 10,
            luck: 10
        };
        modified = true;
    } else {
        ['strength', 'agility', 'intelligence', 'vitality', 'luck'].forEach(stat => {
            if (typeof user.stats[stat] !== 'number' || user.stats[stat] < 0) {
                issues.push(`${stat} 스탯 오류: ${user.stats[stat]}`);
                user.stats[stat] = Math.max(10, parseInt(user.stats[stat]) || 10);
                modified = true;
            }
        });
    }

    // 4. 인벤토리 검사
    if (!Array.isArray(user.inventory)) {
        issues.push('인벤토리 배열 누락');
        user.inventory = [];
        modified = true;
    } else {
        // 인벤토리 슬롯 중복 제거
        const slotMap = new Map();
        const validItems = [];

        user.inventory.forEach(item => {
            if (item && item.inventorySlot !== undefined) {
                if (!slotMap.has(item.inventorySlot)) {
                    slotMap.set(item.inventorySlot, true);
                    validItems.push(item);
                } else {
                    issues.push(`중복 슬롯 번호: ${item.inventorySlot}`);
                    modified = true;
                }
            }
        });

        if (modified) {
            user.inventory = validItems;
        }
    }

    // 5. 장비 검사
    if (!user.equipment || typeof user.equipment !== 'object') {
        issues.push('장비 객체 누락');
        user.equipment = {
            weapon: -1,
            armor: -1,
            helmet: -1,
            gloves: -1,
            boots: -1,
            accessory: -1
        };
        modified = true;
    }

    // 6. 인기도 검사
    if (typeof user.popularity !== 'number' || user.popularity < 0) {
        issues.push(`인기도 오류: ${user.popularity}`);
        user.popularity = Math.max(0, parseInt(user.popularity) || 0);
        modified = true;
    }

    // 7. 게임 통계 검사
    if (!user.gameStats || typeof user.gameStats !== 'object') {
        issues.push('게임 통계 객체 누락');
        user.gameStats = {
            dice: { played: 0, won: 0 },
            slot: { played: 0, won: 0 },
            rps: { played: 0, won: 0 },
            quiz: { played: 0, won: 0 },
            blackjack: { played: 0, won: 0 },
            oddeven: { played: 0, won: 0 },
            mushroom: { played: 0, won: 0 },
            chosung: { played: 0, won: 0 },
            wordchain: { played: 0, won: 0 }
        };
        modified = true;
    }

    return { issues, modified };
}

// 엠블럼 단계 확인 함수
function getEmblemLevel(emblemName) {
    for (const [categoryKey, categoryData] of Object.entries(EMBLEMS)) {
        const emblemIndex = categoryData.emblems.findIndex(emblem => emblem.name === emblemName);
        if (emblemIndex !== -1) {
            return emblemIndex + 1; // 1단계부터 시작
        }
    }
    return 1; // 기본값
}

// 엠블럼 계열 확인 함수
function getEmblemType(emblemName) {
    for (const [categoryKey, categoryData] of Object.entries(EMBLEMS)) {
        const hasEmblem = categoryData.emblems.some(emblem => emblem.name === emblemName);
        if (hasEmblem) {
            return categoryKey;
        }
    }
    return null;
}

// 몬스터 전투력 계산 함수
function calculateMonsterPower(monster, level) {
    return Math.floor(monster.stats.atk + monster.stats.def + (level * 3));
}

// 다음 사냥권 재생성까지 남은 시간 계산
function getNextTicketRegenTime(user) {
    if (!user.huntingTickets || user.huntingTickets >= 20) {
        return null; // 티켓이 가득 차면 표시하지 않음
    }

    const now = new Date();
    const lastRegen = new Date(user.lastTicketRegen || now);
    const timeSinceLastRegen = now - lastRegen;
    const timeToNextRegen = (5 * 60 * 1000) - (timeSinceLastRegen % (5 * 60 * 1000));

    const minutes = Math.floor(timeToNextRegen / 60000);
    const seconds = Math.floor((timeToNextRegen % 60000) / 1000);

    return `${minutes}분 ${seconds}초`;
}

// 피로도 업데이트 함수
function updateFatigue(user) {
    if (!user.fitness) return;

    const now = Date.now();
    const lastExercise = user.fitness.lastExercise || now;
    const timeDiff = now - lastExercise;
    const hoursRested = timeDiff / (1000 * 60 * 60);

    // 시간당 피로도 회복
    const recovery = Math.floor(hoursRested * EXERCISE_SYSTEM.fatigue.recoveryRate);
    user.fitness.fatigue = Math.max(0, user.fitness.fatigue - recovery);
}

// 오늘 운동 시간 계산 함수
function getTodayExerciseTime(user) {
    if (!user.fitness || !user.fitness.exerciseHistory) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return user.fitness.exerciseHistory
        .filter(record => new Date(record.date) >= today)
        .reduce((total, record) => total + record.duration, 0);
}

// 유저 초기화/조회 함수
async function getUser(discordId) {
    try {
        let user = await User.findOne({ discordId });
        if (!user) {
            try {
                user = new User({ discordId });
                await user.save();
                console.log(`새 유저 생성: ${discordId}`);
            } catch (saveError) {
                // 중복 키 오류 발생 시 다시 조회
                if (saveError.code === 11000) {
                    user = await User.findOne({ discordId });
                    if (!user) {
                        throw new Error('유저 생성 실패');
                    }
                } else {
                    throw saveError;
                }
            }
        }

        // 전체 데이터 무결성 검사
        const { issues, modified } = await validateUserData(user);

        if (issues.length > 0) {
            console.log(`[데이터 검사] ${user.nickname || discordId} 사용자:`);
            issues.forEach(issue => console.log(`  - ${issue}`));
        }

        let needsSave = modified;

        // 인벤토리 데이터 무결성 검사 및 복구
        const needsInventoryFix = validateAndFixInventory(user);
        needsSave = needsSave || needsInventoryFix;

        // 장비 데이터 무결성 확인 및 복구
        if (user.equipment) {
            const equipmentSlots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];

            // 장비 슬롯 초기화 확인
            equipmentSlots.forEach(slot => {
                if (user.equipment[slot] === undefined) {
                    user.equipment[slot] = -1;
                    needsSave = true;
                }

                // ObjectId나 이상한 값이면 -1로 초기화
                if (user.equipment[slot] && typeof user.equipment[slot] !== 'number') {
                    console.log(`[장비 복구] ${user.nickname}의 ${slot} 슬롯 복구: ${user.equipment[slot]} -> -1`);
                    user.equipment[slot] = -1;
                    needsSave = true;
                }

                // 장착된 슬롯 번호가 있다면 해당 아이템의 equipped 상태 확인
                if (user.equipment[slot] !== -1) {
                    const equippedItem = user.inventory.find(item => item.inventorySlot === user.equipment[slot]);
                    if (equippedItem && !equippedItem.equipped) {
                        equippedItem.equipped = true;
                        needsSave = true;
                        console.log(`[장비 복구] ${user.nickname}의 ${equippedItem.name} equipped 상태 복구`);
                    } else if (!equippedItem && user.equipment[slot] !== -1) {
                        // 장착된 아이템을 찾을 수 없으면 슬롯 초기화
                        console.log(`[장비 복구] ${user.nickname}의 ${slot} 슬롯에 해당하는 아이템이 없음: ${user.equipment[slot]} -> -1`);
                        user.equipment[slot] = -1;
                        needsSave = true;
                    }
                }
            });

            // 인벤토리의 equipped 상태와 equipment 슬롯 동기화
            user.inventory.forEach(item => {
                // inventorySlot이 없는 아이템에 자동 할당
                if (item.inventorySlot === undefined || item.inventorySlot === null) {
                    const availableSlot = getAvailableInventorySlot(user);
                    if (availableSlot !== -1) {
                        item.inventorySlot = availableSlot;
                        needsSave = true;
                        console.log(`[인벤토리 복구] ${item.name}에 inventorySlot ${availableSlot} 할당`);
                    }
                }

                if (item.equipped) {
                    const slot = item.type;
                    if (user.equipment[slot] !== item.inventorySlot) {
                        console.log(`[장비 동기화] ${user.nickname}의 ${item.name} 장착 상태 동기화`);
                        user.equipment[slot] = item.inventorySlot;
                        needsSave = true;
                    }
                }
            });

            // 강화 데이터 무결성 확인
            user.inventory.forEach(item => {
                if (item.enhanceLevel === undefined) {
                    item.enhanceLevel = 0;
                    needsSave = true;
                }
                if (!item.stats) {
                    item.stats = { attack: 0, defense: 0, dodge: 0, luck: 0 };
                    needsSave = true;
                }
            });

            if (needsSave) {
                await user.save();
                console.log(`[장비 복구] ${user.nickname}의 장비 데이터 복구 완료`);
            }
        }

        // 출석 데이터 무결성 확인
        if (user.lastDaily === null || user.lastDaily === undefined) {
            user.lastDaily = null;
        }
        if (!Array.isArray(user.weeklyAttendance)) {
            user.weeklyAttendance = [false, false, false, false, false, false, false];
        }
        if (!user.weekStart) {
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            user.weekStart = weekStart;
        }

        // 사냥 티켓 재생성 로직
        if (!user.huntingTickets) user.huntingTickets = 20;
        if (!user.lastTicketRegen) user.lastTicketRegen = new Date();

        if (user.huntingTickets < 20) {
            const now = new Date();
            const lastRegen = new Date(user.lastTicketRegen);
            const timeDiff = now - lastRegen;
            const ticketsToRegen = Math.floor(timeDiff / (5 * 60 * 1000)); // 5분마다 1장

            if (ticketsToRegen > 0) {
                user.huntingTickets = Math.min(20, user.huntingTickets + ticketsToRegen);
                user.lastTicketRegen = now;
                needsSave = true;
            }
        }

        if (needsSave) {
            await user.save();
        }

        return user;
    } catch (error) {
        console.error('유저 조회/생성 오류:', error);
        return null;
    }
}

// 개별 마이그레이션 함수 제거 (일괄 정리로 대체)

// 기존 ObjectId 장비 데이터 정리 함수
async function cleanupEquipmentData() {
    try {
        const result = await User.updateMany(
            {}, 
            {
                $set: {
                    'equipment.weapon': -1,
                    'equipment.armor': -1,
                    'equipment.helmet': -1,
                    'equipment.gloves': -1,
                    'equipment.boots': -1,
                    'equipment.accessory': -1
                }
            }
        );
        console.log(`✅ ${result.modifiedCount}명의 유저 장비 데이터가 초기화되었습니다.`);
    } catch (error) {
        console.error('장비 데이터 정리 실패:', error);
    }
}

// 유물 데이터 수정 함수
async function fixArtifactData() {
    try {
        // baseValue와 currentPrice가 없는 유물을 가진 유저 찾기
        const users = await User.find({ 'artifacts.0': { $exists: true } });
        let fixedCount = 0;

        for (const user of users) {
            let needUpdate = false;

            for (const artifact of user.artifacts) {
                if (!artifact.baseValue || !artifact.currentPrice) {
                    // value가 있으면 그 값을 사용, 없으면 1000 기본값
                    const baseValue = artifact.value || 1000;
                    artifact.baseValue = baseValue;
                    artifact.currentPrice = baseValue;
                    needUpdate = true;
                }
            }

            if (needUpdate) {
                await user.save();
                fixedCount++;
            }
        }

        console.log(`✅ ${fixedCount}명의 유저 유물 데이터가 수정되었습니다.`);
    } catch (error) {
        console.error('유물 데이터 수정 실패:', error);
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

        // 레벨업 시 스탯포인트 지급 (레벨당 5포인트)
        user.statPoints += 5;

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

// 인기도 업데이트 함수
async function updatePopularity(messageAuthorId, emoji, value, messageId, guild) {
    try {
        const user = await getUser(messageAuthorId);
        if (!user || !user.registered) return { success: false, message: '등록되지 않은 사용자입니다.' };

        // 같은 메시지에 대한 이전 반응 확인
        const existingReaction = user.popularityHistory.find(h => h.messageId === messageId && h.emoji === emoji);
        if (existingReaction) {
            return { success: false, message: '이미 반응한 메시지입니다.' };
        }

        // 일일 제한 리셋 확인
        const today = new Date().toDateString();
        if (user.lastPopularityReset !== today) {
            user.dailyPopularityGain = 0;
            user.dailyPopularityLoss = 0;
            user.lastPopularityReset = today;
        }

        // 일일 제한 확인
        if (value > 0 && user.dailyPopularityGain >= 10) {
            return { success: false, message: '오늘 받을 수 있는 인기도 상승치를 모두 받았습니다. (+10)' };
        }
        if (value < 0 && user.dailyPopularityLoss <= -10) {
            return { success: false, message: '오늘 받을 수 있는 인기도 하락치를 모두 받았습니다. (-10)' };
        }

        // 실제로 적용할 값 계산
        let actualChange = value;
        if (value > 0) {
            actualChange = Math.min(value, 10 - user.dailyPopularityGain);
            user.dailyPopularityGain += actualChange;
        } else {
            actualChange = Math.max(value, -10 - user.dailyPopularityLoss);
            user.dailyPopularityLoss += actualChange;
        }

        if (actualChange === 0) {
            return { success: false, message: `오늘의 인기도 ${value > 0 ? '상승' : '하락'} 한도에 도달했습니다.` };
        }

        // 인기도 업데이트
        user.popularity += actualChange;
        user.lastPopularityUpdate = new Date();
        user.popularityHistory.push({
            messageId,
            emoji,
            value: actualChange,
            date: new Date()
        });

        await user.save();

        // 인기왕 역할 업데이트
        await updatePopularKingRole(guild);

        const dailyStatus = value > 0 
            ? `(오늘 +${user.dailyPopularityGain}/10)`
            : `(오늘 ${user.dailyPopularityLoss}/10)`;

        return { 
            success: true, 
            newPopularity: user.popularity,
            change: actualChange,
            message: `인기도가 ${actualChange > 0 ? '+' : ''}${actualChange}되어 ${user.popularity}가 되었습니다. ${dailyStatus}`
        };
    } catch (error) {
        console.error('인기도 업데이트 오류:', error);
        return { success: false, message: '인기도 업데이트 중 오류가 발생했습니다.' };
    }
}

// 인기왕 역할 업데이트 함수
async function updatePopularKingRole(guild) {
    try {
        // 인기왕 역할 찾기 또는 생성
        let popularKingRole = guild.roles.cache.find(role => role.name === POPULAR_KING_ROLE_NAME);

        if (!popularKingRole) {
            popularKingRole = await guild.roles.create({
                name: POPULAR_KING_ROLE_NAME,
                color: '#FFD700',
                hoist: true,
                reason: '인기왕 시스템 자동 생성'
            });
        }

        // 현재 인기왕 찾기
        const currentKing = guild.members.cache.find(member => 
            member.roles.cache.has(popularKingRole.id)
        );

        // 가장 높은 인기도를 가진 유저 찾기
        const topUser = await User.findOne({ registered: true })
            .sort({ popularity: -1 })
            .limit(1);

        if (!topUser || topUser.popularity <= 0) {
            // 인기도가 양수인 사람이 없으면 역할 회수
            if (currentKing) {
                await currentKing.roles.remove(popularKingRole);
            }
            return;
        }

        // 새로운 인기왕이 필요한 경우
        if (!currentKing || currentKing.id !== topUser.discordId) {
            // 기존 인기왕 역할 회수
            if (currentKing) {
                await currentKing.roles.remove(popularKingRole);
            }

            // 새로운 인기왕에게 역할 부여
            const newKing = await guild.members.fetch(topUser.discordId);
            if (newKing) {
                await newKing.roles.add(popularKingRole);

                // 채널에 알림 (선택사항)
                const channel = guild.channels.cache.get(GAME_CHANNEL_ID);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('👑 새로운 인기왕 탄생!')
                        .setDescription(`**${topUser.nickname}**님이 인기도 ${topUser.popularity}점으로 새로운 인기왕이 되었습니다!`)
                        .setTimestamp();

                    await channel.send({ embeds: [embed] });
                }
            }
        }
    } catch (error) {
        console.error('인기왕 역할 업데이트 오류:', error);
    }
}

// 프로페셔널 공지 임베드 생성 함수
function createNoticeEmbed(notice) {
    const category = NOTICE_SYSTEM.categories[notice.category] || NOTICE_SYSTEM.categories.notice;
    const priority = NOTICE_SYSTEM.priorities[notice.priority] || NOTICE_SYSTEM.priorities.medium;
    const template = NOTICE_SYSTEM.templates[notice.templateType] || NOTICE_SYSTEM.templates.basic;

    // 기본 임베드 설정
    const embed = new EmbedBuilder()
        .setColor(priority.color || category.color)
        .setTimestamp(new Date(notice.createdAt));

    // 우선순위별 타이틀 설정
    let title = '';
    if (priority.emoji) title += priority.emoji + ' ';
    if (priority.blink && notice.priority === 'critical') {
        title += `**[필독]** `;
    }
    title += notice.title;
    embed.setTitle(title);

    // 작성자 정보
    if (notice.author) {
        embed.setAuthor({ 
            name: notice.author.name, 
            iconURL: notice.author.avatar 
        });
    }

    // 카테고리 표시
    if (template && template.icon) {
        embed.setFooter({ 
            text: `${category.emoji} ${category.name} | ${template.icon} ${template.name}` 
        });
    } else {
        embed.setFooter({ 
            text: `${category.emoji} ${category.name}` 
        });
    }

    // 템플릿별 필드 구성
    switch (notice.templateType) {
        case 'basic':
            embed.setDescription(notice.content);
            break;

        case 'maintenance':
            embed.setDescription(notice.content || '');

            // 보상을 먼저 추가
            if (notice.compensation) {
                embed.addFields({ 
                    name: '🎁 보상', 
                    value: notice.compensation 
                });
            }

            // 시간 정보는 나중에 추가
            embed.addFields(
                { 
                    name: '🕐 점검 시간', 
                    value: notice.time || '미정', 
                    inline: true 
                },
                { 
                    name: '⏱️ 예상 소요시간', 
                    value: notice.duration || '약 2시간', 
                    inline: true 
                }
            );
            break;

        case 'event':
            embed.setDescription(notice.content || ''); // 메인 내용을 description에 추가
            embed.addFields(
                { 
                    name: '📅 이벤트 기간', 
                    value: notice.period || '미정', 
                    inline: false 
                }
            );

            if (notice.rewards) {
                embed.addFields({ 
                    name: '🎁 이벤트 보상', 
                    value: notice.rewards 
                });
            }

            if (notice.howToJoin) {
                embed.addFields({ 
                    name: '📝 참여 방법', 
                    value: notice.howToJoin 
                });
            }
            break;

        case 'update':
            if (notice.version) {
                embed.setDescription(`**버전**: ${notice.version}\n\n${notice.content}`);
            } else {
                embed.setDescription(notice.content);
            }

            if (notice.changes) {
                embed.addFields({ 
                    name: '✨ 변경사항', 
                    value: notice.changes 
                });
            }

            if (notice.fixes) {
                embed.addFields({ 
                    name: '🔧 버그 수정', 
                    value: notice.fixes 
                });
            }
            break;
    }

    // 태그 추가
    if (notice.tags && notice.tags.length > 0) {
        embed.addFields({ 
            name: '🏷️ 태그', 
            value: notice.tags.map(tag => `\`${tag}\``).join(' '), 
            inline: false 
        });
    }

    // 중요도에 따른 추가 효과
    if (notice.priority === 'critical') {
        embed.setThumbnail('https://cdn.discordapp.com/attachments/1234567890/critical_notice.png');
    }

    return embed;
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
        .setDescription('회원가입 채널에 안내 메시지를 게시합니다'),

    new SlashCommandBuilder()
        .setName('인기도테스트')
        .setDescription('테스트용 인기도 조작 명령어')
        .addStringOption(option =>
            option.setName('행동')
                .setDescription('수행할 행동')
                .setRequired(true)
                .addChoices(
                    { name: '인기도 증가 (+5)', value: 'add' },
                    { name: '인기도 감소 (-5)', value: 'subtract' },
                    { name: '일일 한도 리셋', value: 'reset' },
                    { name: '인기도 확인', value: 'check' }
                )),

    new SlashCommandBuilder()
        .setName('전투력수정')
        .setDescription('관리자 전용: 전투력 수정 명령어')
        .addStringOption(option =>
            option.setName('타입')
                .setDescription('수정할 능력치')
                .setRequired(true)
                .addChoices(
                    { name: '힘 (+10)', value: 'strength' },
                    { name: '민첩 (+10)', value: 'agility' },
                    { name: '지능 (+10)', value: 'intelligence' },
                    { name: '체력 (+10)', value: 'vitality' },
                    { name: '행운 (+10)', value: 'luck' },
                    { name: '전투력 확인', value: 'check' }
                )),

    new SlashCommandBuilder()
        .setName('강화')
        .setDescription('장비를 강화합니다 (0-30강)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기', value: 'weapon' },
                    { name: '갑옷', value: 'armor' },
                    { name: '투구', value: 'helmet' },
                    { name: '장갑', value: 'gloves' },
                    { name: '신발', value: 'boots' },
                    { name: '액세서리', value: 'accessory' }
                ))
        .addBooleanOption(option =>
            option.setName('보호권사용')
                .setDescription('보호권을 사용하여 파괴를 방지합니다 (20강 이상만 사용 가능)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('결투')
        .setDescription('PVP 결투를 시작합니다'),

    new SlashCommandBuilder()
        .setName('결투정보')
        .setDescription('PVP 통계 및 정보를 확인합니다'),

    new SlashCommandBuilder()
        .setName('랭킹')
        .setDescription('PVP 랭킹을 확인합니다'),

    new SlashCommandBuilder()
        .setName('집중력')
        .setDescription('집중력 축복으로 장비를 강화합니다 (성공률 5% 증가)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기', value: 'weapon' },
                    { name: '갑옷', value: 'armor' },
                    { name: '투구', value: 'helmet' },
                    { name: '장갑', value: 'gloves' },
                    { name: '신발', value: 'boots' },
                    { name: '액세서리', value: 'accessory' }
                ))
        .addBooleanOption(option =>
            option.setName('보호권사용')
                .setDescription('보호권을 사용하여 파괴를 방지합니다 (20강 이상만 사용 가능)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('축복받은날')
        .setDescription('축복받은 날로 강화합니다 (15-22강 파괴율 30% 감소)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기', value: 'weapon' },
                    { name: '갑옷', value: 'armor' },
                    { name: '투구', value: 'helmet' },
                    { name: '장갑', value: 'gloves' },
                    { name: '신발', value: 'boots' },
                    { name: '액세서리', value: 'accessory' }
                ))
        .addBooleanOption(option =>
            option.setName('보호권사용')
                .setDescription('보호권을 사용하여 파괴를 방지합니다 (20강 이상만 사용 가능)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('강화랭킹')
        .setDescription('강화 랭킹을 확인합니다'),

    new SlashCommandBuilder()
        .setName('강화통계')
        .setDescription('나의 강화 통계를 확인합니다'),

    new SlashCommandBuilder()
        .setName('의뢰')
        .setDescription('마을 의뢰를 수행합니다'),

    new SlashCommandBuilder()
        .setName('주식')
        .setDescription('혁신적인 주식 시장에 참여합니다'),

    // 🔮 에너지 조각 시스템 명령어
    new SlashCommandBuilder()
        .setName('에너지채굴')
        .setDescription('⛏️ 1단계 에너지 조각을 채굴합니다 (500골드, 쿨타임 2분)'),

    new SlashCommandBuilder()
        .setName('조각융합')
        .setDescription('🔄 보유한 같은 단계 조각들을 자동으로 융합합니다 (일일 20회 제한)'),

    new SlashCommandBuilder()
        .setName('내조각')
        .setDescription('💎 현재 보유한 에너지 조각을 확인합니다'),

    new SlashCommandBuilder()
        .setName('융합랭킹')
        .setDescription('🏆 이번 주 에너지 조각 융합 랭킹을 확인합니다'),

    new SlashCommandBuilder()
        .setName('내전투력')
        .setDescription('⚔️ 현재 전투력과 에너지 조각 정보를 확인합니다'),

    // 관리자 전용 명령어
    new SlashCommandBuilder()
        .setName('카운트다운')
        .setDescription('🚀 [관리자] 게임 오픈 카운트다운 설정')
        .addSubcommand(subcommand =>
            subcommand
                .setName('시작')
                .setDescription('카운트다운 시작')
                .addStringOption(option =>
                    option.setName('시간')
                        .setDescription('오픈 시간 (예: 2025-01-15 20:00 또는 시간 단위: 24)')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('채널')
                        .setDescription('카운트다운을 표시할 채널')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('중지')
                .setDescription('카운트다운 중지')),
    new SlashCommandBuilder()
        .setName('게임데이터초기화')
        .setDescription('🔧 [관리자 전용] 모든 게임 데이터를 초기화합니다'),

    new SlashCommandBuilder()
        .setName('융합수동')
        .setDescription('🎯 특정 단계의 조각을 선택하여 수동으로 융합합니다'),

    new SlashCommandBuilder()
        .setName('홀짝')
        .setDescription('🎲 홀짝 게임을 플레이합니다'),

    new SlashCommandBuilder()
        .setName('독버섯')
        .setDescription('🍄 독버섯 게임을 플레이합니다 - 안전한 버섯을 찾아 생존하세요!')
        .addStringOption(option =>
            option.setName('난이도')
                .setDescription('게임 난이도 선택')
                .setRequired(false)
                .addChoices(
                    { name: '🌱 혼자 플레이', value: 'solo' },
                    { name: '⚔️ 유저와 대결', value: 'pvp' },
                    { name: '🤖 봇과 대결', value: 'bot' }
                )),

    new SlashCommandBuilder()
        .setName('초성')
        .setDescription('🎯 초성 게임 메뉴를 표시합니다'),

    new SlashCommandBuilder()
        .setName('끝말잇기')
        .setDescription('🔤 끝말잇기 게임을 시작합니다'),

    new SlashCommandBuilder()
        .setName('주식복구')
        .setDescription('📈 잃어버린 주식 데이터를 복구합니다 (관리자 전용)')
        .addUserOption(option =>
            option.setName('유저')
                .setDescription('주식을 복구할 유저')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('기업')
                .setDescription('기업 ID (예: traveler_inn)')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('수량')
                .setDescription('보유 주식 수량')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('평균가')
                .setDescription('평균 매수가')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('유물탐사')
        .setDescription('🏺 유물을 탐사하여 보물을 찾아보세요!'),

    new SlashCommandBuilder()
        .setName('돈지급')
        .setDescription('💰 사용자에게 골드를 지급합니다 (관리자 전용)')
        .addUserOption(option =>
            option.setName('유저')
                .setDescription('골드를 받을 유저')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('금액')
                .setDescription('지급할 골드 금액')
                .setRequired(true)
                .setMinValue(1)),
    new SlashCommandBuilder()
        .setName('보스')
        .setDescription('🗡️ 보스 레이드 관리 (관리자 전용)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('스폰')
                .setDescription('보스를 즉시 스폰합니다')
                .addStringOption(option =>
                    option.setName('보스')
                        .setDescription('스폰할 보스 선택')
                        .setRequired(false)
                        .addChoices(
                            { name: '🗡️ 그림자 암살자', value: 'shadow_assassin' },
                            { name: '🐉 서리 드래곤', value: 'frost_dragon' },
                            { name: '👹 데몬 로드', value: 'demon_lord' },
                            { name: '🗿 고대 골렘', value: 'ancient_golem' },
                            { name: '👑 공허의 황제', value: 'void_emperor' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('종료')
                .setDescription('현재 보스를 제거합니다'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('정보')
                .setDescription('현재 보스 상태를 확인합니다')),

    new SlashCommandBuilder()
        .setName('말')
        .setDescription('봇이 메시지를 전송합니다 (관리자 전용)')
        .addStringOption(option =>
            option.setName('메시지')
                .setDescription('전송할 메시지')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('채널')
                .setDescription('메시지를 전송할 채널 (기본: 현재 채널)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('ip관리')
        .setDescription('IP 관련 정보를 관리합니다 (관리자 전용)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('조회')
                .setDescription('사용자의 IP 정보를 조회합니다')
                .addUserOption(option =>
                    option.setName('사용자')
                        .setDescription('조회할 사용자')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('차단')
                .setDescription('특정 IP를 차단합니다')
                .addStringOption(option =>
                    option.setName('ip')
                        .setDescription('차단할 IP 주소')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('사유')
                        .setDescription('차단 사유')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('차단해제')
                .setDescription('IP 차단을 해제합니다')
                .addStringOption(option =>
                    option.setName('ip')
                        .setDescription('차단 해제할 IP 주소')
                        .setRequired(true))),
    new SlashCommandBuilder()
        .setName('매크로테스트')
        .setDescription('매크로 방지 시스템을 테스트합니다 (관리자 전용)')
        .addStringOption(option =>
            option.setName('타입')
                .setDescription('테스트 유형을 선택하세요')
                .setRequired(true)
                .addChoices(
                    { name: '기본 검증', value: 'basic' },
                    { name: '빠른 클릭 패턴', value: 'rapid' },
                    { name: '반복 패턴', value: 'pattern' },
                    { name: '상태 확인', value: 'status' },
                    { name: '특정 유저 초기화', value: 'reset' },
                    { name: '전체 초기화', value: 'reset_all' }
                ))
        .addUserOption(option =>
            option.setName('대상')
                .setDescription('테스트 대상 유저 (비워두면 자신)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('공지작성')
        .setDescription('프로페셔널 공지사항을 작성합니다 (관리자 전용)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('새공지')
                .setDescription('새로운 공지사항을 작성합니다')
                .addStringOption(option =>
                    option.setName('템플릿')
                        .setDescription('공지 템플릿을 선택하세요')
                        .setRequired(true)
                        .addChoices(
                            { name: '📢 기본 공지', value: 'basic' },
                            { name: '🔧 점검 공지', value: 'maintenance' },
                            { name: '🎉 이벤트 공지', value: 'event' },
                            { name: '📋 업데이트 공지', value: 'update' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('미리보기')
                .setDescription('저장된 공지를 미리보기합니다')
                .addStringOption(option =>
                    option.setName('공지id')
                        .setDescription('미리보기할 공지 ID')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('발송')
                .setDescription('저장된 공지를 발송합니다')
                .addStringOption(option =>
                    option.setName('공지id')
                        .setDescription('발송할 공지 ID')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('채널')
                        .setDescription('공지를 발송할 채널')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('멘션')
                        .setDescription('멘션 옵션')
                        .setRequired(false)
                        .addChoices(
                            { name: '@everyone', value: 'everyone' },
                            { name: '@here', value: 'here' },
                            { name: '멘션 없음', value: 'none' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('목록')
                .setDescription('저장된 공지 목록을 확인합니다'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('삭제')
                .setDescription('저장된 공지를 삭제합니다')
                .addStringOption(option =>
                    option.setName('공지id')
                        .setDescription('삭제할 공지 ID')
                        .setRequired(true))),

    new SlashCommandBuilder()
        .setName('사전강화')
        .setDescription('카운트다운 중 특별 강화 이벤트! 실패해도 레벨이 내려가지 않습니다!'),

    new SlashCommandBuilder()
        .setName('엠블럼')
        .setDescription('🏆 엠블럼을 구매하여 직업을 선택합니다'),

    new SlashCommandBuilder()
        .setName('댕댕봇소환')
        .setDescription('댕댕봇을 이 채널에 소환합니다 (개발자 전용)'),

    new SlashCommandBuilder()
        .setName('백업복원')
        .setDescription('사전강화 데이터 백업 복원 (개발자 전용)')
        .addStringOption(option =>
            option.setName('백업파일')
                .setDescription('복원할 백업 파일명 (예: prelaunchEventData_backup_1750873525091.json)')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('권한테스트')
        .setDescription('봇과 사용자의 권한을 확인합니다'),

    new SlashCommandBuilder()
        .setName('데이터검사')
        .setDescription('유저 데이터 무결성 검사 (관리자 전용)')
        .addUserOption(option =>
            option.setName('유저')
                .setDescription('검사할 유저 (비워두면 전체 검사)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('테스트계정생성')
        .setDescription('테스트용 계정 생성 (관리자 전용)'),

    new SlashCommandBuilder()
        .setName('명령어등록')
        .setDescription('슬래시 명령어 수동 등록 (관리자 전용)'),
    new SlashCommandBuilder()
        .setName('보스소환테스트')
        .setDescription('월드 보스를 테스트로 소환합니다 (관리자 전용)')
];

// 봇이 준비되었을 때
client.once('ready', async () => {
    try {
        console.log(`${client.user.tag} 봇이 온라인 상태입니다! - 자동 재시작 테스트 v2`);
        console.log(`개발 모드: ${DEV_MODE ? '활성화' : '비활성화'}`);
        if (DEV_MODE && DEV_CHANNEL_IDS.length > 0) {
            console.log(`개발 채널들: ${DEV_CHANNEL_IDS.join(', ')}`);
        }

        // 전역 에러 핸들러 설치
        setupErrorHandlers(client);

        // 상호작용 모니터 설치
        setupInteractionMonitor(client);

        // MongoDB 연결
        await connectDB();

        // 웹 서버 시작 (IP 수집용)
        startWebServer();

        // 사전강화 데이터 로드
        global.prelaunchEventData = loadPrelaunchData();
        console.log('📊 사전강화 데이터 로드 결과:', {
            exists: !!global.prelaunchEventData,
            hasEventData: !!(global.prelaunchEventData && global.prelaunchEventData.eventData),
            userCount: global.prelaunchEventData && global.prelaunchEventData.eventData ? 
                Object.keys(global.prelaunchEventData.eventData).length : 0
        });

        // 모든 이벤트 초기화
        initializeAllEvents(client);

        // 던전 스케줄러 시작
        const dungeonScheduler = require('./systems/dungeonScheduler');
        dungeonScheduler.start(client);

        // 인기도 관리 시스템 초기화
        const PopularityManager = require('./systems/popularityManager');
        global.popularityManager = new PopularityManager(client);

        // 백업 시스템 초기화
        const backupSystem = require('./systems/backupSystem');
        backupSystem.startAutoBackup();
        console.log('✅ 자동 백업 시스템 활성화');

        // 보스 시스템 초기화
        const worldBossSystem = require('./systems/worldBossSystem');
        worldBossSystem.startAutoSpawn(client);
        console.log('⚔️ 보스 시스템 활성화');
        
        // 댕댕봇 구출 이벤트 자동 공지 확인
        const dogBotStateManager = require('./systems/dogBotStateManager');
        const dogBotAnnouncer = require('./systems/dogBotEventAnnouncer');
        const dogBotHostageSystem = require('./systems/dogBotHostageSystem');
        
        // 3초 후 상태 확인 (로드 시간 대기)
        setTimeout(async () => {
            // 상태 파일 다시 로드
            await dogBotStateManager.loadState();
            
            if (dogBotStateManager.state && 
                dogBotStateManager.state.status && 
                dogBotStateManager.state.status.isActive &&
                !dogBotStateManager.state.status.rescueComplete) {
                console.log('🐕 댕댕봇 구출 이벤트가 진행 중입니다.');
                console.log(`   - 현재 층: ${dogBotStateManager.state.status.currentFloor}/5`);
                console.log(`   - 참여자: ${dogBotStateManager.state.statistics.participants.length}명`);
                
                // 자동 공지가 이미 실행 중이 아닌 경우에만 시작
                if (!dogBotAnnouncer.isAnnouncementRunning) {
                    console.log('📢 자동 공지를 시작합니다...');
                    dogBotAnnouncer.startAnnouncements(client);
                }
                
                // 인질 시스템 비활성화
                // if (!dogBotHostageSystem.isHostageSystemRunning) {
                //     console.log('🚨 인질 시스템을 시작합니다...');
                //     dogBotHostageSystem.startHostageSystem(client);
                // }
                console.log('ℹ️ 인질 시스템은 비활성화되었습니다.');
            } else {
                console.log('💤 댕댕봇 구출 이벤트가 비활성화 상태입니다.');
                console.log('   /댕댕봇구출시작 명령어로 이벤트를 시작하세요.');
            }
        }, 3000);

        ADMIN_IDS.forEach(adminId => {
            antiMacro.addToWhitelist(adminId);
        });
        console.log('✅ 매크로 방지 시스템 초기화 완료');

        // 카운트다운 자동 복원 제거 - 수동으로 /카운트시작 명령어로만 시작
        if (openCountdown.isActive) {
            console.log('📢 카운트다운 상태가 활성화되어 있지만 자동 복원하지 않습니다.');
            console.log('💡 /카운트시작 명령어를 사용하여 수동으로 시작해주세요.');
            // 카운트다운 상태를 비활성화
            openCountdown.isActive = false;
            openCountdown.interval = null;
            openCountdown.messageId = null;
            openCountdown.channelId = null;
            saveCountdownState();
        }

        // 데이터베이스 마이그레이션 실행 (일회성)
        const { runAllMigrations } = require('./database/migrations');
        const migrationList = require('./database/migrationList');
        await runAllMigrations(migrationList);

        // 데이터 보호 시스템 활성화
        const { scheduleAutoBackup, validateUserData } = require('./database/dataProtection');
        scheduleAutoBackup();
        console.log('🛡️ 데이터 보호 시스템 활성화 완료');

        // 게임 데이터 로드 - 함수가 주석 처리되어 있으므로 제거
        // loadGameData();

        // 댕댕봇 이벤트 스케줄러는 handlers/events에서 시작됨

        // 슬래시 명령어 등록 (환경변수로 제어)
        console.log('🔍 명령어 등록 조건 확인:');
        console.log('  - REGISTER_COMMANDS:', process.env.REGISTER_COMMANDS);
        console.log('  - DEV_MODE:', DEV_MODE);
        console.log('  - 조건 결과:', process.env.REGISTER_COMMANDS === 'true' || DEV_MODE);

        // 임시로 항상 명령어 등록 (테스트용)
        if (true || process.env.REGISTER_COMMANDS === 'true' || DEV_MODE) {
            try {
                const rest = new REST().setToken(TOKEN);
                console.log('슬래시 명령어 등록 중...');

                // 길드별로 명령어 등록 (즉시 사용 가능)
                let totalRegistered = 0;
                for (const guild of client.guilds.cache.values()) {
                    try {
                        const data = await rest.put(
                            Routes.applicationGuildCommands(CLIENT_ID, guild.id),
                            { body: commands }
                        );
                        console.log(`✅ ${guild.name} 서버에 ${data.length}개 명령어 등록 완료`);
                        totalRegistered++;
                    } catch (error) {
                        console.error(`❌ ${guild.name} 서버 명령어 등록 실패:`, error.message);
                    }
                }

                console.log(`✅ 총 ${totalRegistered}개 서버에 명령어 등록 완료!`);
                console.log('📋 등록된 명령어:', commands.map(cmd => cmd.name).join(', '));
            } catch (error) {
                console.error('❌ 명령어 등록 실패:', error);
                console.error('CLIENT_ID:', CLIENT_ID);
                console.error('TOKEN 존재:', !!TOKEN);
            }
        } else {
            console.log('ℹ️ 명령어 등록 스킵 (REGISTER_COMMANDS !== true)');
        }

        // 엠블럼 시스템 초기화 (영구 상점)
        await initializeAllEmblemShops(client);
        console.log('🏆 엠블럼 영구 상점 시스템 초기화 완료');

        // Discord 이벤트 등록
        setUpdatePopularityFunction(updatePopularity);
        registerDiscordEvents(client);
        console.log('✅ Discord 이벤트 핸들러 등록 완료');
        
        // 뉴스 시스템 초기화
        const newsSystem = require('./systems/newsSystem');
        await newsSystem.start(client);
        console.log('📰 뉴스 시스템 초기화 완료');
        
        // 실시간 주식 동기화 시작 (선택사항)
        const realStockSync = require('./systems/realStockSync');
        realStockSync.start();
        console.log('📈 실시간 주식 동기화 시작');
    } catch (error) {
        console.error('봇 초기화 중 오류 발생:', error);
    }
});

// 엠블럼 시스템 초기화 함수
async function initializeEmblemSystem() {
    try {
        // 채널 접근 권한 확인
        let channel;
        try {
            channel = await client.channels.fetch(EMBLEM_CHANNEL_ID);
        } catch (error) {
            if (error.code === 50001) {
                console.log('🚫 엠블럼 채널 접근 권한이 없습니다. 엠블럼 시스템을 건너뜁니다.');
                return;
            }
            throw error;
        }

        if (!channel) {
            console.log('엠블럼 채널을 찾을 수 없습니다.');
            return;
        }

        // 엠블럼 상점 임베드 생성
        const emblemEmbed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🏆 엠블럼 상점')
            .setDescription('**레벨 20 이상**부터 엠블럼을 구매할 수 있습니다!\n\n엠블럼을 구매하면 특별한 칭호 역할을 받게 됩니다.\n**⚠️ 엠블럼은 한 번 구매하면 변경할 수 없습니다!**')
            .addFields(
                { name: '⚔️ 전사 계열', value: '초보전사 → 튼튼한 기사 → 용맹한 검사 → 맹령한 전사 → 전설의 기사', inline: false },
                { name: '🏹 궁수 계열', value: '마을사냥꾼 → 숲의 궁수 → 바람 사수 → 정확한 사격수 → 전설의 명궁', inline: false },
                { name: '🔮 마검사 계열', value: '마법 학도 → 마법 검사 → 현명한 기사 → 마도 검사 → 전설의 마검사', inline: false },
                { name: '🗡️ 도적 계열', value: '떠돌이 도적 → 운 좋은 도둑 → 행운의 닌자 → 복 많은 도적 → 전설의 행운아', inline: false }
            )
            .setFooter({ text: '원하는 계열을 선택하여 엠블럼을 구매하세요!' });

        // 엠블럼 계열 선택 드롭다운
        const emblemSelect = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('emblem_category')
                    .setPlaceholder('엠블럼 계열을 선택하세요')
                    .addOptions([
                        {
                            label: '전사 계열',
                            description: '초보전사부터 전설의 기사까지',
                            value: 'warrior',
                            emoji: '⚔️'
                        },
                        {
                            label: '궁수 계열',
                            description: '마을사냥꾼부터 전설의 명궁까지',
                            value: 'archer',
                            emoji: '🏹'
                        },
                        {
                            label: '마검사 계열',
                            description: '마법 학도부터 전설의 마검사까지',
                            value: 'swordmage',
                            emoji: '🔮'
                        },
                        {
                            label: '도적 계열',
                            description: '떠돌이 도적부터 전설의 행운아까지',
                            value: 'rogue',
                            emoji: '🗡️'
                        }
                    ])
            );

        // 최근 메시지 검색하여 업데이트 또는 새로 전송
        const messages = await channel.messages.fetch({ limit: 50 });
        const existingMessage = messages.find(msg => 
            msg.author.id === client.user.id && 
            msg.embeds.length > 0 && 
            msg.embeds[0].title === '🏆 엠블럼 상점'
        );

        if (existingMessage) {
            await existingMessage.edit({
                embeds: [emblemEmbed],
                components: [emblemSelect]
            });
            console.log('✅ 기존 엠블럼 상점 메시지를 업데이트했습니다.');
        } else {
            await channel.send({
                embeds: [emblemEmbed],
                components: [emblemSelect]
            });
            console.log('✅ 새로운 엠블럼 상점 메시지를 생성했습니다.');
        }
    } catch (error) {
        console.error('엠블럼 시스템 초기화 중 오류:', error);
    }

    // RPS 멀티플레이어 세션 초기화
    initializeSessions(rpsMultiplayerSessions, rpsTempChannels);
    console.log('✅ RPS 멀티플레이어 세션 초기화 완료');
}

client.login(TOKEN);

// 프로세스 종료 시 데이터 저장
process.on('SIGINT', () => {
    console.log('\n⚠️ 봇 종료 중...');

    // 예약된 저장이 있으면 즉시 실행
    if (prelaunchSaveTimeout) {
        clearTimeout(prelaunchSaveTimeout);
        savePrelaunchData();
        console.log('✅ 예약된 사전강화 데이터 저장 완료');
    }

    // 사전강화 데이터 저장
    if (global.prelaunchEventData && Object.keys(global.prelaunchEventData).length > 0) {
        savePrelaunchData();
        console.log('✅ 사전강화 데이터 저장 완료');
    }

    // 카운트다운 상태 저장
    if (openCountdown.isActive) {
        saveCountdownState();
        console.log('✅ 카운트다운 상태 저장 완료');
    }

    process.exit(0);
});

// 가위바위보 멀티플레이어 게임 함수들은 rpsMultiplayerGame 모듈에서 import됨

// 예기치 않은 종료 시에도 저장
process.on('beforeExit', () => {
    if (global.prelaunchEventData && Object.keys(global.prelaunchEventData).length > 0) {
        savePrelaunchData();
    }
});
