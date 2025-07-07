const dataManager = require('./dataManager');

// 데이터 등록 함수
function registerAllGameData() {
    console.log('🎮 게임 데이터 등록 중...');

    // 1. 경매장 데이터
    dataManager.registerData('auctionHouse', 
        () => {
            const { AUCTION_HOUSE } = require('../index');
            return {
                listings: Array.from(AUCTION_HOUSE.listings.entries()),
                priceHistory: Array.from(AUCTION_HOUSE.priceHistory.entries()),
                marketVolume: Array.from(AUCTION_HOUSE.marketVolume.entries()),
                topItems: AUCTION_HOUSE.topItems,
                events: AUCTION_HOUSE.events
            };
        },
        (data) => {
            const { AUCTION_HOUSE } = require('../index');
            AUCTION_HOUSE.listings = new Map(data.listings || []);
            AUCTION_HOUSE.priceHistory = new Map(data.priceHistory || []);
            AUCTION_HOUSE.marketVolume = new Map(data.marketVolume || []);
            AUCTION_HOUSE.topItems = data.topItems || [];
            AUCTION_HOUSE.events = data.events || [];
        },
        { saveToFile: true, saveToMongo: true }
    );

    // 2. 공지사항 데이터
    dataManager.registerData('notices',
        () => {
            const { NOTICE_SYSTEM } = require('../index');
            return Array.from(NOTICE_SYSTEM.savedNotices.entries());
        },
        (data) => {
            const { NOTICE_SYSTEM } = require('../index');
            NOTICE_SYSTEM.savedNotices = new Map(data || []);
        },
        { saveToFile: true, saveToMongo: true }
    );

    // 3. PVP 매치 데이터
    dataManager.registerData('pvpMatches',
        () => {
            const pvpSystem = require('./pvpSystem');
            return {
                activeMatches: Array.from(pvpSystem.activeMatches.entries()),
                matchmakingQueue: Array.from(pvpSystem.matchmakingQueue.entries())
            };
        },
        (data) => {
            const pvpSystem = require('./pvpSystem');
            if (data) {
                pvpSystem.activeMatches = new Map(data.activeMatches || []);
                pvpSystem.matchmakingQueue = new Map(data.matchmakingQueue || []);
            }
        },
        { saveToFile: true, saveToMongo: false }
    );

    // 4. 베팅 풀 데이터
    dataManager.registerData('bettingPools',
        () => {
            const { bettingPools } = require('../data/spectatorBetting');
            return Array.from(bettingPools.entries());
        },
        (data) => {
            const spectatorBetting = require('../data/spectatorBetting');
            spectatorBetting.bettingPools = new Map(data || []);
        },
        { saveToFile: true, saveToMongo: true }
    );

    // 5. 시장 이벤트
    dataManager.registerData('marketEvent',
        () => {
            const { currentMarketEvent } = require('../index');
            return currentMarketEvent;
        },
        (data) => {
            const index = require('../index');
            if (data) {
                index.currentMarketEvent = data;
            }
        },
        { saveToFile: true, saveToMongo: false }
    );

    // 6. 게임 세션 데이터
    dataManager.registerData('gameSessions',
        () => {
            const waitingRoom = require('./waitingRoomCleanup');
            return {
                rpsMultiplayer: waitingRoom.rpsMultiplayerSessions,
                mushroomMultiplayer: waitingRoom.mushroomMultiplayerSessions,
                wordGame: Array.from(waitingRoom.wordGameSessions.entries())
            };
        },
        (data) => {
            const waitingRoom = require('./waitingRoomCleanup');
            if (data) {
                waitingRoom.rpsMultiplayerSessions = data.rpsMultiplayer || {};
                waitingRoom.mushroomMultiplayerSessions = data.mushroomMultiplayer || {};
                waitingRoom.wordGameSessions = new Map(data.wordGame || []);
            }
        },
        { saveToFile: true, saveToMongo: false }
    );

    // 7. 댕댕봇 이벤트
    dataManager.registerData('dogBotEvent',
        () => {
            try {
                const { dogBotEvent, rememberedChannel } = require('../handlers/events/dogBotEvent');
                return {
                    event: dogBotEvent,
                    rememberedChannel
                };
            } catch {
                return null;
            }
        },
        (data) => {
            try {
                const dogBot = require('../handlers/events/dogBotEvent');
                if (data) {
                    dogBot.dogBotEvent = data.event;
                    dogBot.rememberedChannel = data.rememberedChannel;
                }
            } catch {}
        },
        { saveToFile: true, saveToMongo: false }
    );

    // 8. 상점 메시지 ID
    dataManager.registerData('shopMessages',
        () => {
            const { permanentMessageIds } = require('./shop');
            return Array.from(permanentMessageIds.entries());
        },
        (data) => {
            const shop = require('./shop');
            if (data) {
                data.forEach(([key, value]) => {
                    shop.permanentMessageIds.set(key, value);
                });
            }
        },
        { saveToFile: true, saveToMongo: false }
    );

    // 9. 뉴스 채널 설정 (이미 DB에 저장되지만 백업용)
    dataManager.registerData('newsChannels',
        () => {
            const newsSystem = require('./newsSystem');
            return Array.from(newsSystem.newsChannels);
        },
        (data) => {
            const newsSystem = require('./newsSystem');
            if (data) {
                newsSystem.newsChannels = new Set(data);
            }
        },
        { saveToFile: true, saveToMongo: false }
    );

    // 10. 엠블럼 상점 메시지
    dataManager.registerData('emblemShopMessages',
        () => {
            const emblemShop = require('./emblemShop');
            return emblemShop.permanentMessageIds;
        },
        (data) => {
            const emblemShop = require('./emblemShop');
            if (data) {
                emblemShop.permanentMessageIds = data;
            }
        },
        { saveToFile: true, saveToMongo: false }
    );

    console.log('✅ 게임 데이터 등록 완료');
}

// 데이터 변경 시 호출할 함수들
function markAuctionHouseDirty() {
    dataManager.markDirty('auctionHouse');
}

function markNoticesDirty() {
    dataManager.markDirty('notices');
}

function markPvpDirty() {
    dataManager.markDirty('pvpMatches');
}

function markBettingDirty() {
    dataManager.markDirty('bettingPools');
}

function markMarketEventDirty() {
    dataManager.markDirty('marketEvent');
}

function markGameSessionsDirty() {
    dataManager.markDirty('gameSessions');
}

module.exports = {
    registerAllGameData,
    markAuctionHouseDirty,
    markNoticesDirty,
    markPvpDirty,
    markBettingDirty,
    markMarketEventDirty,
    markGameSessionsDirty
};