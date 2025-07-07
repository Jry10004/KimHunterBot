// 전리품 시세 변동 시스템
const LOOT_MARKET = {
    // 전리품 카테고리별 시장
    categories: {
        materials: {
            name: '재료',
            items: [
                { id: 'slime_jelly', name: '슬라임 젤리', emoji: '💧', basePrice: 100, currentPrice: 100, volume: 0, change: 0 },
                { id: 'rabbit_foot', name: '토끼발', emoji: '🐰', basePrice: 300, currentPrice: 300, volume: 0, change: 0 },
                { id: 'mushroom_spore', name: '버섯 포자', emoji: '🍄', basePrice: 250, currentPrice: 250, volume: 0, change: 0 },
                { id: 'butterfly_dust', name: '나비 가루', emoji: '🦋', basePrice: 150, currentPrice: 150, volume: 0, change: 0 },
                { id: 'wool_ball', name: '양털 뭉치', emoji: '🐑', basePrice: 500, currentPrice: 500, volume: 0, change: 0 }
            ]
        },
        rare_materials: {
            name: '희귀 재료',
            items: [
                { id: 'rainbow_flower', name: '무지개 꽃잎', emoji: '🌈', basePrice: 600, currentPrice: 600, volume: 0, change: 0 },
                { id: 'frog_tongue', name: '개구리 혓바닥', emoji: '🐸', basePrice: 800, currentPrice: 800, volume: 0, change: 0 },
                { id: 'crystal_shard', name: '크리스탈 조각', emoji: '💎', basePrice: 2000, currentPrice: 2000, volume: 0, change: 0 },
                { id: 'dragon_scale', name: '용의 비늘', emoji: '🐉', basePrice: 5000, currentPrice: 5000, volume: 0, change: 0 },
                { id: 'unicorn_hair', name: '유니콘 갈기', emoji: '🦄', basePrice: 10000, currentPrice: 10000, volume: 0, change: 0 }
            ]
        },
        mutation_drops: {
            name: '변이 드롭',
            items: [
                { id: 'blazing_essence', name: '불꽃 정수', emoji: '🔥', basePrice: 5000, currentPrice: 5000, volume: 0, change: 0 },
                { id: 'frozen_crystal', name: '얼음 결정', emoji: '🧊', basePrice: 4500, currentPrice: 4500, volume: 0, change: 0 },
                { id: 'venom_sac', name: '맹독 주머니', emoji: '🧪', basePrice: 5500, currentPrice: 5500, volume: 0, change: 0 },
                { id: 'thunder_core', name: '천둥 핵', emoji: '⚡', basePrice: 6000, currentPrice: 6000, volume: 0, change: 0 },
                { id: 'shadow_fragment', name: '그림자 파편', emoji: '🌑', basePrice: 10000, currentPrice: 10000, volume: 0, change: 0 },
                { id: 'holy_orb', name: '성스러운 구슬', emoji: '🔮', basePrice: 15000, currentPrice: 15000, volume: 0, change: 0 }
            ]
        },
        appraisal_results: {
            name: '감정 결과물',
            items: [
                { id: 'rusty_nail', name: '녹슨 못', emoji: '🔩', basePrice: 2, currentPrice: 2, volume: 0, change: 0 },
                { id: 'small_gem', name: '작은 보석', emoji: '💠', basePrice: 300, currentPrice: 300, volume: 0, change: 0 },
                { id: 'magic_powder', name: '마법 가루', emoji: '✨', basePrice: 800, currentPrice: 800, volume: 0, change: 0 },
                { id: 'dragon_scale_rare', name: '희귀 용비늘', emoji: '🐲', basePrice: 5000, currentPrice: 5000, volume: 0, change: 0 },
                { id: 'phoenix_feather', name: '불사조의 깃털', emoji: '🪶', basePrice: 15000, currentPrice: 15000, volume: 0, change: 0 },
                { id: 'divine_grail', name: '신성한 성배', emoji: '🏆', basePrice: 150000, currentPrice: 150000, volume: 0, change: 0 },
                { id: 'fate_dice', name: '운명의 주사위', emoji: '🎲', basePrice: 100000, currentPrice: 100000, volume: 0, change: 0 },
                { id: 'absolute_ring', name: '절대반지', emoji: '💍', basePrice: 500000, currentPrice: 500000, volume: 0, change: 0 }
            ]
        }
    },
    
    // 시장 상태
    marketState: {
        trend: 0,               // -100 ~ +100 (하락장/상승장)
        volatility: 30,         // 0 ~ 100 (변동성)
        lastUpdate: Date.now(),
        updateInterval: 30000   // 30초마다 업데이트 (더 역동적인 시세)
    },
    
    // 시세 히스토리 (차트용)
    priceHistory: new Map(),  // itemId -> [{time, price, volume}]
    
    // 이벤트 영향
    events: {
        hunterActivity: 0,      // 사냥 활동량
        appraisalActivity: 0,   // 감정 활동량
        mutationSightings: 0,   // 변이 몬스터 목격
        legendaryDrops: 0       // 전설 아이템 드롭
    },
    
    // 감정사 NPC 설정
    appraiser: {
        name: '현명한 감정사 로버트',
        emoji: '🧙',
        personality: 'wise',
        dialogues: {
            greeting: [
                "오호! 좋은 물건을 가져오셨군요.",
                "이런 보물은 처음 봅니다!",
                "시세가 좋을 때 오셨네요.",
                "요즘 이런 물건이 인기가 많죠."
            ],
            marketUp: [
                "📈 지금이 팔 때입니다! 시세가 최고조예요!",
                "📈 이런 호황은 오랜만이네요!",
                "📈 서둘러 파세요, 곧 떨어질 수도 있어요!"
            ],
            marketDown: [
                "📉 지금은 좀... 시세가 안 좋네요.",
                "📉 조금 기다리시는 게 어떨까요?",
                "📉 불황이라 가격이 많이 떨어졌어요."
            ],
            jackpot: [
                "🎊 대박! 이건 정말 희귀한 물건입니다!",
                "🎊 평생 한 번 볼까 말까 한 보물이네요!",
                "🎊 축하합니다! 엄청난 가치를 지닌 물건입니다!"
            ]
        },
        // 감정사 등장 확률 (사냥 중)
        appearanceChance: 0.01,  // 1% 기본 확률 (100번에 1번)
        // 특수 상황 보너스
        bonusChance: {
            mutationKill: 0.005,   // 변이 몬스터 처치 시 +0.5%
            bossKill: 0.01,        // 보스 처치 시 +1%
            streak10: 0.005,       // 10연속 사냥 시 +0.5%
            streak50: 0.02         // 50연속 사냥 시 +2%
        }
    }
};

// 시세 업데이트 함수
function updateMarketPrices() {
    const now = Date.now();
    
    // 1분마다 업데이트
    if (now - LOOT_MARKET.marketState.lastUpdate < LOOT_MARKET.marketState.updateInterval) {
        return;
    }
    
    LOOT_MARKET.marketState.lastUpdate = now;
    
    // 시장 트렌드 계산
    const trendChange = (Math.random() - 0.5) * 20;
    LOOT_MARKET.marketState.trend = Math.max(-100, Math.min(100, 
        LOOT_MARKET.marketState.trend + trendChange
    ));
    
    // 이벤트 영향 계산
    const eventMultiplier = 1 + 
        (LOOT_MARKET.events.hunterActivity * 0.001) +
        (LOOT_MARKET.events.mutationSightings * 0.005) +
        (LOOT_MARKET.events.legendaryDrops * 0.01);
    
    // 모든 아이템 가격 업데이트
    Object.values(LOOT_MARKET.categories).forEach(category => {
        category.items.forEach(item => {
            // 기본 변동률 (변동성에 따라)
            const baseChange = (Math.random() - 0.5) * (LOOT_MARKET.marketState.volatility / 100);
            
            // 트렌드 영향
            const trendInfluence = LOOT_MARKET.marketState.trend / 1000;
            
            // 최종 변동률
            const changeRate = (baseChange + trendInfluence) * eventMultiplier;
            
            // 새 가격 계산 (0원 ~ 100만원 제한)
            const newPrice = Math.max(0, Math.min(1000000, 
                item.currentPrice * (1 + changeRate)
            ));
            
            // 변화율 계산
            item.change = ((newPrice - item.currentPrice) / item.currentPrice) * 100;
            item.currentPrice = Math.floor(newPrice);
            
            // 히스토리 저장
            if (!LOOT_MARKET.priceHistory.has(item.id)) {
                LOOT_MARKET.priceHistory.set(item.id, []);
            }
            
            const history = LOOT_MARKET.priceHistory.get(item.id);
            history.push({
                time: now,
                price: item.currentPrice,
                volume: item.volume
            });
            
            // 최대 100개 데이터포인트만 유지
            if (history.length > 100) {
                history.shift();
            }
        });
    });
    
    // 이벤트 카운터 감소
    LOOT_MARKET.events.hunterActivity *= 0.95;
    LOOT_MARKET.events.appraisalActivity *= 0.95;
    LOOT_MARKET.events.mutationSightings *= 0.9;
    LOOT_MARKET.events.legendaryDrops *= 0.8;
}

// 아이템 시세 조회
function getItemPrice(itemId) {
    for (const category of Object.values(LOOT_MARKET.categories)) {
        const item = category.items.find(i => i.id === itemId);
        if (item) {
            return item.currentPrice;
        }
    }
    return 0;
}

// 차트 데이터 생성 (주식 차트 API 활용)
function generateChartData(itemId, period = '1h') {
    const history = LOOT_MARKET.priceHistory.get(itemId) || [];
    
    // 캔들스틱 데이터 생성
    const candles = [];
    const intervalMs = period === '1m' ? 60000 : period === '5m' ? 300000 : 3600000;
    
    let currentCandle = null;
    history.forEach(point => {
        const candleTime = Math.floor(point.time / intervalMs) * intervalMs;
        
        if (!currentCandle || currentCandle.time !== candleTime) {
            if (currentCandle) candles.push(currentCandle);
            currentCandle = {
                time: candleTime,
                open: point.price,
                high: point.price,
                low: point.price,
                close: point.price,
                volume: point.volume
            };
        } else {
            currentCandle.high = Math.max(currentCandle.high, point.price);
            currentCandle.low = Math.min(currentCandle.low, point.price);
            currentCandle.close = point.price;
            currentCandle.volume += point.volume;
        }
    });
    
    if (currentCandle) candles.push(currentCandle);
    
    return candles;
}

// 감정사 등장 확률 계산
function calculateAppraiserChance(huntResult) {
    let chance = LOOT_MARKET.appraiser.appearanceChance;
    
    if (huntResult.mutation) {
        chance += LOOT_MARKET.appraiser.bonusChance.mutationKill;
    }
    if (huntResult.isBoss) {
        chance += LOOT_MARKET.appraiser.bonusChance.bossKill;
    }
    if (huntResult.streak >= 50) {
        chance += LOOT_MARKET.appraiser.bonusChance.streak50;
    } else if (huntResult.streak >= 10) {
        chance += LOOT_MARKET.appraiser.bonusChance.streak10;
    }
    
    return chance;
}

// 시장 이벤트 기록
function recordMarketEvent(eventType, value = 1) {
    if (LOOT_MARKET.events[eventType] !== undefined) {
        LOOT_MARKET.events[eventType] += value;
    }
}

module.exports = {
    LOOT_MARKET,
    updateMarketPrices,
    getItemPrice,
    generateChartData,
    calculateAppraiserChance,
    recordMarketEvent
};