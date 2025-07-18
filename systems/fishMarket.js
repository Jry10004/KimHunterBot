// 🏪 수산시장 시스템
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class FishMarket {
    constructor() {
        // 시장 상태
        this.marketPrices = new Map();  // 현재 시세 배율
        this.specialBuyers = [];        // 특별 구매자
        this.lastUpdate = Date.now();
        this.nextUpdate = Date.now() + (30 * 60 * 1000); // 30분 후
        
        // 초기화
        this.initializeMarket();
        
        // 30분마다 시장 업데이트
        setInterval(() => this.updateMarket(), 30 * 60 * 1000);
    }
    
    // 시장 초기화
    initializeMarket() {
        // 모든 물고기 종류 가져오기
        const { FISHING_SYSTEM } = require('../data/fishingSystemNew');
        const allFish = [
            ...Object.keys(FISHING_SYSTEM.fishTypes.freshwater),
            ...Object.keys(FISHING_SYSTEM.fishTypes.saltwater),
            ...Object.keys(FISHING_SYSTEM.specialFishTypes)
        ];
        
        // 각 물고기별 초기 시세 설정 (0.5 ~ 1.5배)
        allFish.forEach(fish => {
            this.marketPrices.set(fish, 0.5 + Math.random());
        });
        
        // 특별 구매자 생성
        this.generateSpecialBuyers();
    }
    
    // 시장 업데이트 (30분마다)
    updateMarket() {
        const { FISHING_SYSTEM } = require('../data/fishingSystemNew');
        
        // 시세 변동 (등급별 변동폭)
        this.marketPrices.forEach((currentPrice, fishName) => {
            // 물고기 데이터 찾기
            let fishData;
            if (FISHING_SYSTEM.fishTypes.freshwater[fishName]) {
                fishData = FISHING_SYSTEM.fishTypes.freshwater[fishName];
            } else if (FISHING_SYSTEM.fishTypes.saltwater[fishName]) {
                fishData = FISHING_SYSTEM.fishTypes.saltwater[fishName];
            } else if (FISHING_SYSTEM.specialFishTypes[fishName]) {
                fishData = FISHING_SYSTEM.specialFishTypes[fishName];
            }
            
            if (!fishData) return;
            
            // 가격 기반으로 변동폭 결정
            let volatility;
            if (fishData.basePrice < 5000) volatility = 0.5;        // 일반: 0.5~1.5배
            else if (fishData.basePrice < 10000) volatility = 0.7;  // 고급: 0.4~1.8배
            else if (fishData.basePrice < 20000) volatility = 0.9;  // 레어: 0.3~2.0배
            else if (fishData.basePrice < 50000) volatility = 1.3;  // 에픽: 0.2~2.5배
            else volatility = 1.9;                                   // 레전드리+: 0.1~3.0배
            
            // 새로운 가격 계산
            const change = (Math.random() - 0.5) * volatility;
            let newPrice = currentPrice + change;
            
            // 범위 제한
            if (fishData.basePrice < 50000) {
                newPrice = Math.max(0.1, Math.min(2.0, newPrice));
            } else {
                newPrice = Math.max(0.1, Math.min(3.0, newPrice));
            }
            
            this.marketPrices.set(fishName, newPrice);
        });
        
        // 특별 구매자 갱신
        this.generateSpecialBuyers();
        
        // 시간 업데이트
        this.lastUpdate = Date.now();
        this.nextUpdate = Date.now() + (30 * 60 * 1000);
    }
    
    // 특별 구매자 생성 (1시간 한정)
    generateSpecialBuyers() {
        const buyers = [
            {
                name: '🧙‍♂️ 떠돌이 상인',
                conditions: [
                    { type: 'fish', target: this.getRandomFish(), multiplier: 2.0, description: '2배 가격' },
                    { type: 'adjective', target: '싱싱한', multiplier: 1.5, description: '싱싱한 물고기 +50%' }
                ]
            },
            {
                name: '👨‍🍳 요리사',
                conditions: [
                    { type: 'size', minSize: 30, maxSize: 50, multiplier: 3.0, description: '30-50cm 물고기 3배' },
                    { type: 'prefix', target: '튀김용', multiplier: 5.0, description: '튀김용 물고기 5배' }
                ]
            },
            {
                name: '🏛️ 박물관 큐레이터',
                conditions: [
                    { type: 'rarity', target: ['legendary', 'mythic'], multiplier: 2.0, description: '전설/신화급 2배' },
                    { type: 'size_percentile', min: 95, multiplier: 4.0, description: '상위 5% 크기 4배' }
                ]
            },
            {
                name: '🎪 서커스 단장',
                conditions: [
                    { type: 'adjective_negative', multiplier: 5.0, description: '못생긴/이상한 물고기 5배' },
                    { type: 'size_extreme', multiplier: 3.0, description: '초미니/신화급 크기 3배' }
                ]
            },
            {
                name: '🔬 연구원',
                conditions: [
                    { type: 'category', target: 'special', multiplier: 1.8, description: '특수 물고기 1.8배' },
                    { type: 'first_discovery', multiplier: 10.0, description: '서버 최초 발견 10배' }
                ]
            }
        ];
        
        // 1-3명의 구매자 랜덤 선택
        const buyerCount = 1 + Math.floor(Math.random() * 3);
        this.specialBuyers = [];
        
        for (let i = 0; i < buyerCount; i++) {
            const buyer = buyers[Math.floor(Math.random() * buyers.length)];
            buyer.expiresAt = Date.now() + (60 * 60 * 1000); // 1시간 후 만료
            this.specialBuyers.push(buyer);
        }
    }
    
    // 랜덤 물고기 선택
    getRandomFish() {
        const allFish = Array.from(this.marketPrices.keys());
        return allFish[Math.floor(Math.random() * allFish.length)];
    }
    
    // 물고기 판매 가격 계산
    calculateSellPrice(fish, user) {
        const { FISHING_SYSTEM } = require('../data/fishingSystemNew');
        
        // 기본 가격 처리
        let basePrice = fish.estimatedPrice || 0;
        
        // 기존 물고기인 경우 (estimatedPrice가 없거나 0인 경우) 기본값 설정
        if (!basePrice || basePrice <= 0) {
            // 물고기 종류 확인
            const fishType = fish.baseType || fish.fishId || '알 수 없는 물고기';
            
            // "과거 물고기" 특별 처리
            if (fishType === '과거 물고기' || fishType.includes('과거')) {
                // 과거 물고기는 기본적으로 희귀도에 따라 가격 책정
                const rarityPrices = {
                    common: 5000,
                    uncommon: 10000,
                    rare: 20000,
                    epic: 40000,
                    legendary: 80000,
                    mythic: 150000
                };
                const rarity = fish.quality || fish.rarity || 'common';
                basePrice = rarityPrices[rarity] || 5000;
                
                // 크기가 있으면 추가 보너스
                if (fish.size) {
                    const sizeBonus = Math.floor(fish.size * 10);
                    basePrice += sizeBonus;
                }
            } else {
                // 물고기 데이터에서 기본 가격 찾기
                let fishData = null;
                if (FISHING_SYSTEM.fishTypes.freshwater[fishType]) {
                    fishData = FISHING_SYSTEM.fishTypes.freshwater[fishType];
                } else if (FISHING_SYSTEM.fishTypes.saltwater[fishType]) {
                    fishData = FISHING_SYSTEM.fishTypes.saltwater[fishType];
                } else if (FISHING_SYSTEM.specialFishTypes[fishType]) {
                    fishData = FISHING_SYSTEM.specialFishTypes[fishType];
                }
                
                if (fishData) {
                    // 크기 기반 가격 계산
                    const size = fish.size || 30;
                    let sizeMultiplier = 1.0;
                    if (size < fishData.minSize) sizeMultiplier = 0.5;
                    else if (size > fishData.megaSize) sizeMultiplier = 2.0;
                    else if (size > fishData.maxSize) sizeMultiplier = 1.5;
                    
                    basePrice = Math.floor(fishData.basePrice * sizeMultiplier);
                } else if (fish.quality || fish.rarity) {
                    // 희귀도 기반 기본 가격 (폴백)
                    const rarityPrices = {
                        common: 3000,
                        uncommon: 8000,
                        rare: 15000,
                        epic: 30000,
                        legendary: 50000,
                        mythic: 100000
                    };
                    const rarity = fish.quality || fish.rarity || 'common';
                    basePrice = rarityPrices[rarity] || rarityPrices.common;
                } else {
                    basePrice = 2000; // 최소 가격 (과거 물고기가 아닌 경우)
                }
            }
        }
        
        let totalPrice = basePrice;
        
        // 물고기 종류 확인
        const fishType = fish.baseType || fish.fishId || '알 수 없는 물고기';
        
        // 시장 배율 적용
        const marketMulti = this.marketPrices.get(fishType) || 1.0;
        totalPrice *= marketMulti;
        
        // 특별 구매자 체크
        let specialMulti = 1.0;
        let appliedBuyers = [];
        
        for (const buyer of this.specialBuyers) {
            if (buyer.expiresAt < Date.now()) continue; // 만료된 구매자 스킵
            
            for (const condition of buyer.conditions) {
                let matches = false;
                
                switch (condition.type) {
                    case 'fish':
                        matches = (fish.baseType || fish.fishId) === condition.target;
                        break;
                    case 'adjective':
                        matches = fish.adjective === condition.target;
                        break;
                    case 'size':
                        matches = fish.size && fish.size >= condition.minSize && fish.size <= condition.maxSize;
                        break;
                    case 'prefix':
                        matches = fish.prefix === condition.target;
                        break;
                    case 'rarity':
                        const rarity = fish.rarity || fish.quality || 'common';
                        matches = condition.target.includes(rarity);
                        break;
                    case 'size_percentile':
                        matches = fish.sizePercent && fish.sizePercent >= condition.min;
                        break;
                    case 'adjective_negative':
                        const negativeAdjs = ['못생긴', '이상한', '삐뚤어진', '찌그러진', '볼품없는'];
                        matches = fish.adjective && negativeAdjs.includes(fish.adjective);
                        break;
                    case 'size_extreme':
                        matches = fish.sizeGrade && (fish.sizeGrade.grade === 'tiny' || fish.sizeGrade.grade === 'mythic');
                        break;
                    case 'category':
                        const fishType = fish.baseType || fish.fishId;
                        matches = (condition.target === 'special' && fishType && FISHING_SYSTEM.specialFishTypes[fishType]);
                        break;
                }
                
                if (matches) {
                    specialMulti = Math.max(specialMulti, condition.multiplier);
                    appliedBuyers.push({
                        buyer: buyer.name,
                        condition: condition.description,
                        multiplier: condition.multiplier
                    });
                }
            }
        }
        
        totalPrice *= specialMulti;
        
        // 낚시왕 칭호 효과
        const fishRarity = fish.rarity || fish.quality || 'common';
        if (user.fishing && user.fishing.isFishingKing && ['common', 'uncommon', 'rare', 'epic'].includes(fishRarity)) {
            totalPrice *= 10;
            appliedBuyers.push({
                buyer: '🏆 낚시왕 칭호',
                condition: '에픽 이하 10배',
                multiplier: 10
            });
        }
        
        // 최종 가격이 0원이 되지 않도록 보장
        const finalPrice = Math.floor(totalPrice);
        if (finalPrice <= 0) {
            console.warn(`[수산시장] 물고기 가격이 0원으로 계산됨:`, {
                fishType: fish.baseType || fish.fishId,
                estimatedPrice: fish.estimatedPrice,
                basePrice: basePrice,
                totalPrice: totalPrice
            });
            // 최소 가격 보장
            return {
                basePrice: 1000,
                marketMulti: marketMulti,
                specialMulti: specialMulti,
                finalPrice: 1000,
                appliedBuyers: appliedBuyers
            };
        }
        
        return {
            basePrice: basePrice,
            marketMulti: marketMulti,
            specialMulti: specialMulti,
            finalPrice: finalPrice,
            appliedBuyers: appliedBuyers
        };
    }
    
    // 수산시장 임베드 생성
    createMarketEmbed() {
        const embed = new EmbedBuilder()
            .setTitle('🏪 김헌터 수산시장')
            .setColor('#00bfff')
            .setDescription(`실시간 시세 정보 • 다음 업데이트: <t:${Math.floor(this.nextUpdate / 1000)}:R>`);
        
        // HOT/COLD 물고기 찾기
        let hotFish = [];
        let coldFish = [];
        
        this.marketPrices.forEach((price, fish) => {
            if (price >= 2.0) hotFish.push({ name: fish, price: price });
            else if (price <= 0.5) coldFish.push({ name: fish, price: price });
        });
        
        // 정렬
        hotFish.sort((a, b) => b.price - a.price);
        coldFish.sort((a, b) => a.price - b.price);
        
        // HOT 표시
        if (hotFish.length > 0) {
            let hotText = '';
            for (let i = 0; i < Math.min(5, hotFish.length); i++) {
                hotText += `• ${hotFish[i].name} ↗️ ×${hotFish[i].price.toFixed(1)}\n`;
            }
            embed.addFields({
                name: '📈 HOT! 급등 어종',
                value: hotText || '없음',
                inline: true
            });
        }
        
        // COLD 표시
        if (coldFish.length > 0) {
            let coldText = '';
            for (let i = 0; i < Math.min(5, coldFish.length); i++) {
                coldText += `• ${coldFish[i].name} ↘️ ×${coldFish[i].price.toFixed(1)}\n`;
            }
            embed.addFields({
                name: '📉 COLD! 급락 어종',
                value: coldText || '없음',
                inline: true
            });
        }
        
        // 특별 구매자
        if (this.specialBuyers.length > 0) {
            let buyerText = '';
            for (const buyer of this.specialBuyers) {
                const timeLeft = Math.floor((buyer.expiresAt - Date.now()) / 1000 / 60);
                buyerText += `**${buyer.name}** (${timeLeft}분 남음)\n`;
                for (const condition of buyer.conditions) {
                    buyerText += `└ ${condition.description}\n`;
                }
                buyerText += '\n';
            }
            embed.addFields({
                name: '🎯 특별 구매자',
                value: buyerText.substring(0, 1024),
                inline: false
            });
        }
        
        embed.setFooter({ text: '💡 특별 구매자는 1시간마다 바뀝니다!' });
        embed.setTimestamp();
        
        return embed;
    }
    
    // 상세 시세 임베드
    createDetailedPriceEmbed(category = 'all') {
        const { FISHING_SYSTEM } = require('../data/fishingSystemNew');
        const embed = new EmbedBuilder()
            .setTitle('📊 상세 시세 정보')
            .setColor('#3498db');
        
        let fishList = [];
        
        if (category === 'freshwater' || category === 'all') {
            Object.entries(FISHING_SYSTEM.fishTypes.freshwater).forEach(([name, data]) => {
                fishList.push({ name, basePrice: data.basePrice, category: '민물' });
            });
        }
        
        if (category === 'saltwater' || category === 'all') {
            Object.entries(FISHING_SYSTEM.fishTypes.saltwater).forEach(([name, data]) => {
                fishList.push({ name, basePrice: data.basePrice, category: '바다' });
            });
        }
        
        if (category === 'special' || category === 'all') {
            Object.entries(FISHING_SYSTEM.specialFishTypes).forEach(([name, data]) => {
                fishList.push({ name, basePrice: data.basePrice, category: '특수' });
            });
        }
        
        // 가격순 정렬
        fishList.sort((a, b) => b.basePrice - a.basePrice);
        
        // 표시 (최대 25개)
        const displayList = fishList.slice(0, 25);
        for (const fish of displayList) {
            const marketPrice = this.marketPrices.get(fish.name) || 1.0;
            const currentPrice = Math.floor(fish.basePrice * marketPrice);
            const priceChange = marketPrice >= 1.0 ? '📈' : '📉';
            
            embed.addFields({
                name: `${fish.name} (${fish.category})`,
                value: `기본가: ${fish.basePrice.toLocaleString()}G\n현재가: ${currentPrice.toLocaleString()}G\n시세: ${priceChange} ×${marketPrice.toFixed(2)}`,
                inline: true
            });
        }
        
        if (fishList.length > 25) {
            embed.setFooter({ text: `...외 ${fishList.length - 25}종 더` });
        }
        
        return embed;
    }
}

// 싱글톤 인스턴스
const fishMarket = new FishMarket();

module.exports = { fishMarket };