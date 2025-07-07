// 시장 및 경매장 시스템

const AUCTION_HOUSE = require('./auctionHouse');

// 현재 시장 상황 저장소
let currentMarketEvent = null;
let lastMarketUpdate = 0;

// 시장 가격 계산 함수
function calculateItemMarketPrice(itemName, rarity, basePrice) {
    const now = Date.now();
    
    // 시장 이벤트 업데이트 (6시간마다)
    if (now - lastMarketUpdate > 6 * 60 * 60 * 1000) {
        updateMarketEvent();
        lastMarketUpdate = now;
    }
    
    // 기본 가격에 희귀도 배수 적용
    const rarityMultipliers = {
        '일반': 1.0,
        '레어': 3.0,
        '에픽': 10.0,
        '레전드리': 50.0,
        '신화': 200.0
    };
    
    let finalPrice = basePrice * (rarityMultipliers[rarity] || 1.0);
    
    // 시장 이벤트 적용
    if (currentMarketEvent) {
        if (currentMarketEvent.affectedItems.includes(itemName) || 
            currentMarketEvent.affectedItems.includes('all')) {
            finalPrice *= currentMarketEvent.priceMultiplier;
        }
    }
    
    // 거래량에 따른 가격 변동
    const volume = AUCTION_HOUSE.marketVolume.get(itemName) || 0;
    if (volume > 100) finalPrice *= 1.2;
    else if (volume > 50) finalPrice *= 1.1;
    else if (volume < 10) finalPrice *= 0.9;
    
    return Math.floor(finalPrice);
}

// 시장 이벤트 업데이트
function updateMarketEvent() {
    const events = [
        { name: '🔥 아이템 대란', affectedItems: ['all'], priceMultiplier: 1.5, duration: 2 },
        { name: '⚔️ 무기 수요 급증', affectedItems: ['weapon'], priceMultiplier: 2.0, duration: 3 },
        { name: '🛡️ 방어구 할인', affectedItems: ['armor'], priceMultiplier: 0.7, duration: 2 },
        { name: '🧪 포션 부족', affectedItems: ['potion'], priceMultiplier: 3.0, duration: 1 },
        { name: '📦 재료 가격 폭락', affectedItems: ['material'], priceMultiplier: 0.5, duration: 2 },
        null // 평상시
    ];
    
    currentMarketEvent = events[Math.floor(Math.random() * events.length)];
    if (currentMarketEvent) {
        AUCTION_HOUSE.events.push({
            ...currentMarketEvent,
            startTime: Date.now(),
            endTime: Date.now() + currentMarketEvent.duration * 60 * 60 * 1000
        });
    }
}

// 아이템 타입 구분
function getItemType(itemName) {
    const weaponKeywords = ['검', '도끼', '활', '지팡이', '단검', '창'];
    const armorKeywords = ['갑옷', '투구', '장갑', '부츠', '방패'];
    const potionKeywords = ['포션', '물약', '엘릭서'];
    const materialKeywords = ['가죽', '광석', '나무', '천', '돌'];
    
    if (weaponKeywords.some(keyword => itemName.includes(keyword))) return 'weapon';
    if (armorKeywords.some(keyword => itemName.includes(keyword))) return 'armor';
    if (potionKeywords.some(keyword => itemName.includes(keyword))) return 'potion';
    if (materialKeywords.some(keyword => itemName.includes(keyword))) return 'material';
    return 'misc';
}

// 경매 등록
function addAuctionListing(sellerId, item, startPrice, buyoutPrice, duration = 24) {
    const listingId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const listing = {
        id: listingId,
        sellerId: sellerId,
        item: item,
        startPrice: startPrice,
        buyoutPrice: buyoutPrice,
        currentPrice: startPrice,
        bids: [],
        startTime: Date.now(),
        endTime: Date.now() + duration * 60 * 60 * 1000,
        sold: false
    };
    
    AUCTION_HOUSE.listings.set(listingId, listing);
    
    // 가격 기록 업데이트
    if (!AUCTION_HOUSE.priceHistory.has(item.name)) {
        AUCTION_HOUSE.priceHistory.set(item.name, []);
    }
    
    return listingId;
}

// 입찰
function placeBid(listingId, bidderId, bidAmount) {
    const listing = AUCTION_HOUSE.listings.get(listingId);
    if (!listing || listing.sold || Date.now() > listing.endTime) {
        return { success: false, message: '유효하지 않은 경매입니다.' };
    }
    
    if (bidAmount <= listing.currentPrice) {
        return { success: false, message: '현재 가격보다 높은 금액을 입찰해야 합니다.' };
    }
    
    if (listing.buyoutPrice && bidAmount >= listing.buyoutPrice) {
        // 즉시 구매
        listing.sold = true;
        listing.winnerId = bidderId;
        listing.finalPrice = listing.buyoutPrice;
        
        // 가격 기록
        AUCTION_HOUSE.priceHistory.get(listing.item.name).push({
            price: listing.buyoutPrice,
            timestamp: Date.now()
        });
        
        // 거래량 업데이트
        const currentVolume = AUCTION_HOUSE.marketVolume.get(listing.item.name) || 0;
        AUCTION_HOUSE.marketVolume.set(listing.item.name, currentVolume + 1);
        
        return { success: true, message: '즉시 구매 완료!', instantBuy: true };
    }
    
    listing.currentPrice = bidAmount;
    listing.bids.push({
        bidderId: bidderId,
        amount: bidAmount,
        timestamp: Date.now()
    });
    
    return { success: true, message: '입찰 성공!' };
}

// 아이템 가격 차트 생성
function getItemPriceChart(itemName, period = 7) {
    const history = AUCTION_HOUSE.priceHistory.get(itemName) || [];
    const now = Date.now();
    const periodMs = period * 24 * 60 * 60 * 1000;
    
    const relevantData = history.filter(record => now - record.timestamp <= periodMs);
    
    if (relevantData.length === 0) {
        return null;
    }
    
    // 일별 평균 가격 계산
    const dailyPrices = {};
    relevantData.forEach(record => {
        const date = new Date(record.timestamp).toDateString();
        if (!dailyPrices[date]) {
            dailyPrices[date] = [];
        }
        dailyPrices[date].push(record.price);
    });
    
    const chartData = Object.entries(dailyPrices).map(([date, prices]) => ({
        date: date,
        avgPrice: Math.floor(prices.reduce((a, b) => a + b, 0) / prices.length),
        volume: prices.length
    }));
    
    return chartData;
}

module.exports = {
    calculateItemMarketPrice,
    updateMarketEvent,
    getItemType,
    addAuctionListing,
    placeBid,
    getItemPriceChart,
    getCurrentMarketEvent: () => currentMarketEvent
};