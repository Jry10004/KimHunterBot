// 🎣 낚시 시스템 구현
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../models/User');
const { FISHING_SYSTEM, fishingState } = require('../data/fishingSystemNew');

class FishingManager {
    constructor() {
        // 상인 스케줄러 시작
        this.initMerchantScheduler();
        this.initPriceUpdater();
    }
    
    // 상인 스케줄러 초기화
    initMerchantScheduler() {
        // 다음 상인 시간 설정
        if (!fishingState.nextMerchantTime) {
            this.scheduleNextMerchant();
        }
        
        // 1분마다 상인 체크
        setInterval(() => {
            this.checkMerchantSchedule();
        }, 60000);
    }
    
    // 가격 업데이터 초기화
    initPriceUpdater() {
        // 1분마다 가격 변동
        setInterval(() => {
            if (fishingState.currentMerchant) {
                this.updateMerchantPrices();
            }
        }, FISHING_SYSTEM.settings.priceUpdateInterval);
    }
    
    // 다음 상인 스케줄
    scheduleNextMerchant() {
        const minInterval = FISHING_SYSTEM.settings.merchantMinInterval;
        const randomDelay = Math.random() * minInterval * 2; // 2~4시간 랜덤
        fishingState.nextMerchantTime = Date.now() + randomDelay;
    }
    
    // 상인 스케줄 체크
    checkMerchantSchedule() {
        const now = Date.now();
        
        // 상인 도착 시간 체크
        if (!fishingState.currentMerchant && fishingState.nextMerchantTime && now >= fishingState.nextMerchantTime) {
            this.spawnMerchant();
        }
        
        // 상인 떠나는 시간 체크
        if (fishingState.currentMerchant && fishingState.merchantLeaveTime && now >= fishingState.merchantLeaveTime) {
            this.removeMerchant();
        }
    }
    
    // 상인 생성
    spawnMerchant() {
        const merchants = Object.keys(FISHING_SYSTEM.merchants);
        const merchantType = merchants[Math.floor(Math.random() * merchants.length)];
        const merchant = { ...FISHING_SYSTEM.merchants[merchantType], type: merchantType };
        
        // 요리사의 경우 타겟 물고기 설정
        if (merchantType === 'chef') {
            const fishes = Object.keys(FISHING_SYSTEM.fishes);
            merchant.targetFish = fishes[Math.floor(Math.random() * fishes.length)];
        }
        
        fishingState.currentMerchant = merchant;
        fishingState.merchantArrivalTime = Date.now();
        fishingState.merchantLeaveTime = Date.now() + FISHING_SYSTEM.settings.merchantStayTime;
        
        // 초기 가격 설정
        this.updateMerchantPrices();
        
        // 다음 상인 스케줄
        this.scheduleNextMerchant();
        
        console.log(`🔔 [낚시] ${merchant.name} 상인이 도착했습니다!`);
    }
    
    // 상인 제거
    removeMerchant() {
        console.log(`👋 [낚시] ${fishingState.currentMerchant.name} 상인이 떠났습니다.`);
        fishingState.currentMerchant = null;
        fishingState.merchantArrivalTime = null;
        fishingState.merchantLeaveTime = null;
        fishingState.currentPrices.clear();
    }
    
    // 가격 업데이트
    updateMerchantPrices() {
        if (!fishingState.currentMerchant) return;
        
        const merchant = fishingState.currentMerchant;
        
        // 각 물고기별 가격 계산
        for (const [fishId, fish] of Object.entries(FISHING_SYSTEM.fishes)) {
            let basePrice = (fish.basePrice.min + fish.basePrice.max) / 2;
            
            // 시세 변동 (50% ~ 200%)
            const fluctuation = FISHING_SYSTEM.settings.priceFluctuation;
            const randomMultiplier = fluctuation.min + Math.random() * (fluctuation.max - fluctuation.min);
            basePrice *= randomMultiplier;
            
            // 상인 특성 적용
            if (merchant.type === 'noble' && merchant.preferences[fish.rarity]) {
                basePrice *= merchant.preferences[fish.rarity];
            } else if (merchant.type === 'chef' && merchant.targetFish === fishId) {
                basePrice *= merchant.targetBonus;
            } else if (merchant.type === 'smuggler') {
                basePrice *= merchant.globalDiscount;
            }
            
            // 특별 이벤트 (1% 확률)
            if (Math.random() < 0.01) {
                basePrice *= Math.random() < 0.5 ? 3 : 0.3; // 폭등 또는 폭락
            }
            
            fishingState.currentPrices.set(fishId, Math.floor(basePrice));
        }
    }
    
    // 낚시하기
    async fish(user, spot, baitType = 'normal') {
        const now = Date.now();
        
        // 쿨다운 체크
        if (user.fishing.lastFish && now - user.fishing.lastFish < FISHING_SYSTEM.settings.fishingCooldown) {
            const remaining = Math.ceil((FISHING_SYSTEM.settings.fishingCooldown - (now - user.fishing.lastFish)) / 1000);
            return { success: false, error: `낚시 쿨다운 중입니다. ${remaining}초 후에 다시 시도하세요.` };
        }
        
        // 인벤토리 체크
        if (user.fishing.inventory.length >= FISHING_SYSTEM.settings.maxInventory) {
            return { success: false, error: '물고기 보관함이 가득 찼습니다! 판매 후 다시 시도하세요.' };
        }
        
        // 미끼 체크
        const bait = FISHING_SYSTEM.baits[baitType];
        if (baitType !== 'normal') {
            if (!user.fishing.specialBaits[baitType] || user.fishing.specialBaits[baitType] < 1) {
                return { success: false, error: '특수 미끼가 부족합니다!' };
            }
        } else if (user.fishing.bait < 1) {
            return { success: false, error: '미끼가 부족합니다!' };
        }
        
        // 낚시터 정보
        const spotData = FISHING_SYSTEM.fishingSpots[spot];
        
        // 물고기 결정
        const caughtFish = this.determineFish(spotData, user.fishing.rod, bait);
        
        // 크기 결정
        const size = this.determineSize(caughtFish, spotData, user.fishing.rod, bait);
        
        // 품질 결정 (유니크/전설 변이)
        const quality = this.determineQuality();
        
        // 미끼 소모
        if (baitType === 'normal') {
            user.fishing.bait--;
        } else {
            user.fishing.specialBaits[baitType]--;
        }
        
        // 인벤토리에 추가
        const fishData = {
            fishId: caughtFish.id,
            size: size,
            quality: quality.type,
            caughtAt: new Date(),
            caughtSpot: spot
        };
        user.fishing.inventory.push(fishData);
        
        // 통계 업데이트
        user.fishing.stats.totalCaught++;
        user.fishing.lastFish = new Date();
        
        // 도감 업데이트
        const collectionKey = caughtFish.id;
        if (!user.fishing.collection.discovered.has(collectionKey)) {
            user.fishing.collection.discovered.set(collectionKey, {
                count: 1,
                biggestSize: size,
                firstCaught: new Date()
            });
        } else {
            const collection = user.fishing.collection.discovered.get(collectionKey);
            collection.count++;
            if (size > collection.biggestSize) {
                collection.biggestSize = size;
            }
            user.fishing.collection.discovered.set(collectionKey, collection);
        }
        
        // 유니크/전설 변이 도감
        if (quality.type === 'unique' && !user.fishing.collection.uniqueVariants.includes(caughtFish.id)) {
            user.fishing.collection.uniqueVariants.push(caughtFish.id);
        } else if (quality.type === 'legendary' && !user.fishing.collection.legendaryVariants.includes(caughtFish.id)) {
            user.fishing.collection.legendaryVariants.push(caughtFish.id);
        }
        
        // 최고 기록 체크
        if (size > user.fishing.stats.biggestCatch.size) {
            user.fishing.stats.biggestCatch = {
                fishId: caughtFish.id,
                size: size,
                date: new Date()
            };
        }
        
        // 희귀도 기록
        const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
        if (!user.fishing.stats.rarestCatch.rarity || 
            rarityOrder.indexOf(caughtFish.rarity) > rarityOrder.indexOf(user.fishing.stats.rarestCatch.rarity)) {
            user.fishing.stats.rarestCatch = {
                fishId: caughtFish.id,
                rarity: caughtFish.rarity,
                date: new Date()
            };
        }
        
        // 랭킹 통계 업데이트
        if (!user.rankingStats) {
            user.rankingStats = {};
        }
        if (!user.rankingStats.fishing) {
            user.rankingStats.fishing = {
                totalCaught: 0,
                bestCatch: {
                    name: null,
                    size: 0
                },
                lastUpdated: null
            };
        }
        
        // 총 낚은 수 업데이트
        user.rankingStats.fishing.totalCaught = user.fishing.stats.totalCaught;
        
        // 최고 기록 업데이트
        if (size > (user.rankingStats.fishing.bestCatch.size || 0)) {
            user.rankingStats.fishing.bestCatch = {
                name: caughtFish.name,
                size: size
            };
        }
        
        // 마지막 업데이트 시간
        user.rankingStats.fishing.lastUpdated = new Date();
        
        await user.save();
        
        return {
            success: true,
            fish: caughtFish,
            size: size,
            quality: quality,
            sizeGrade: this.getSizeGrade(caughtFish, size)
        };
    }
    
    // 물고기 결정
    determineFish(spotData, rodType, bait) {
        let rarityPool = { ...FISHING_SYSTEM.rarityChances };
        
        // 낚시터 보너스 적용
        if (spotData.rarityBonus) {
            for (const [rarity, bonus] of Object.entries(spotData.rarityBonus)) {
                if (rarityPool[rarity]) {
                    rarityPool[rarity] *= bonus;
                }
            }
        }
        
        // 낚싯대 보너스 적용
        const rod = FISHING_SYSTEM.fishingRods[rodType];
        if (rod.rarityBonus > 1) {
            for (const rarity of ['rare', 'epic', 'legendary']) {
                if (rarityPool[rarity]) {
                    rarityPool[rarity] *= rod.rarityBonus;
                }
            }
        }
        
        // 미끼 보너스 적용
        if (bait.bonus.rare) {
            rarityPool.rare *= bait.bonus.rare;
        }
        if (bait.bonus.all) {
            for (const rarity in rarityPool) {
                rarityPool[rarity] *= bait.bonus.all;
            }
        }
        
        // 정규화
        const total = Object.values(rarityPool).reduce((sum, val) => sum + val, 0);
        for (const rarity in rarityPool) {
            rarityPool[rarity] /= total;
        }
        
        // 희귀도 결정
        const roll = Math.random();
        let cumulative = 0;
        let selectedRarity = 'common';
        
        for (const [rarity, chance] of Object.entries(rarityPool)) {
            cumulative += chance;
            if (roll <= cumulative) {
                selectedRarity = rarity;
                break;
            }
        }
        
        // 해당 희귀도의 물고기 선택
        const fishesOfRarity = Object.values(FISHING_SYSTEM.fishes).filter(f => f.rarity === selectedRarity);
        return fishesOfRarity[Math.floor(Math.random() * fishesOfRarity.length)];
    }
    
    // 크기 결정
    determineSize(fish, spotData, rodType, bait) {
        const minSize = fish.minSize;
        const maxSize = fish.maxSize;
        
        // 기본 크기 (정규분포)
        let normalizedSize = Math.random();
        normalizedSize = (normalizedSize + Math.random()) / 2; // 중앙값에 가깝게
        
        // 낚시터 보너스
        if (spotData.sizeBonus) {
            normalizedSize *= spotData.sizeBonus;
        }
        
        // 낚싯대 보너스
        const rod = FISHING_SYSTEM.fishingRods[rodType];
        normalizedSize *= rod.sizeBonus;
        
        // 미끼 보너스
        if (bait.bonus.size) {
            normalizedSize *= bait.bonus.size;
        }
        
        // 최종 크기 계산
        normalizedSize = Math.min(Math.max(normalizedSize, 0), 1);
        const size = Math.floor(minSize + (maxSize - minSize) * normalizedSize);
        
        return size;
    }
    
    // 품질 결정
    determineQuality() {
        const roll = Math.random();
        
        for (const [type, variant] of Object.entries(FISHING_SYSTEM.uniqueVariants)) {
            if (roll <= variant.chance) {
                return {
                    type: type,
                    prefix: variant.prefix,
                    priceMultiplier: variant.priceMultiplier
                };
            }
        }
        
        return {
            type: 'normal',
            prefix: '',
            priceMultiplier: 1
        };
    }
    
    // 크기 등급 가져오기
    getSizeGrade(fish, size) {
        const sizePercent = (size - fish.minSize) / (fish.maxSize - fish.minSize);
        
        for (const [grade, data] of Object.entries(FISHING_SYSTEM.sizeGrades)) {
            if (sizePercent >= data.sizeRange[0] && sizePercent <= data.sizeRange[1]) {
                return {
                    grade: grade,
                    ...data
                };
            }
        }
        
        return FISHING_SYSTEM.sizeGrades.medium;
    }
    
    // 물고기 판매
    async sellFish(user, fishIndices, merchantType = null) {
        if (!merchantType && !fishingState.currentMerchant) {
            return { success: false, error: '현재 상인이 없습니다!' };
        }
        
        const merchant = merchantType ? FISHING_SYSTEM.merchants[merchantType] : fishingState.currentMerchant;
        let totalGold = 0;
        const soldFish = [];
        
        // 인덱스 정렬 (뒤에서부터 제거하기 위해)
        fishIndices.sort((a, b) => b - a);
        
        for (const index of fishIndices) {
            if (index < 0 || index >= user.fishing.inventory.length) continue;
            
            const fishData = user.fishing.inventory[index];
            const fish = FISHING_SYSTEM.fishes[fishData.fishId];
            if (!fish) continue;
            
            // 가격 계산
            let price = fishingState.currentPrices.get(fishData.fishId) || fish.basePrice.min;
            
            // 크기 보정
            const sizeGrade = this.getSizeGrade(fish, fishData.size);
            price *= sizeGrade.priceMultiplier;
            
            // 품질 보정
            const quality = FISHING_SYSTEM.uniqueVariants[fishData.quality];
            if (quality) {
                price *= quality.priceMultiplier;
            }
            
            // 상인 특성 적용
            if (merchant.type === 'wizard' && merchant.uniqueOnly) {
                if (fishData.quality === 'normal') continue; // 일반 품질은 구매 안 함
                price *= merchant.uniqueBonus;
            } else if (merchant.type === 'collector' && merchant.sizeRequirement) {
                const requiredGrade = merchant.sizeRequirement;
                const gradeOrder = ['tiny', 'small', 'medium', 'large', 'huge', 'giant', 'mythic'];
                if (gradeOrder.indexOf(sizeGrade.grade) < gradeOrder.indexOf(requiredGrade)) continue;
                price *= merchant.sizeBonus;
            }
            
            totalGold += Math.floor(price);
            soldFish.push({
                fish: fish,
                size: fishData.size,
                quality: fishData.quality,
                price: Math.floor(price)
            });
            
            // 인벤토리에서 제거
            user.fishing.inventory.splice(index, 1);
        }
        
        if (soldFish.length === 0) {
            return { success: false, error: '판매 가능한 물고기가 없습니다!' };
        }
        
        // 골드 지급 및 통계 업데이트
        user.gold += totalGold;
        user.fishing.stats.totalEarned += totalGold;
        
        await user.save();
        
        return {
            success: true,
            soldFish: soldFish,
            totalGold: totalGold
        };
    }
    
    // 낚시 UI 생성
    createFishingEmbed(user) {
        const embed = new EmbedBuilder()
            .setTitle('🎣 낚시터')
            .setColor('#1e90ff')
            .setDescription('평화로운 낚시터에서 물고기를 낚아보세요!')
            .addFields(
                {
                    name: '🎒 보관함',
                    value: `${user.fishing.inventory.length}/${FISHING_SYSTEM.settings.maxInventory}`,
                    inline: true
                },
                {
                    name: '🪱 미끼',
                    value: `일반: ${user.fishing.bait}개\n✨ 반짝: ${user.fishing.specialBaits?.shiny || 0}개\n🦴 거대: ${user.fishing.specialBaits?.giant || 0}개`,
                    inline: true
                },
                {
                    name: '🎣 낚싯대',
                    value: FISHING_SYSTEM.fishingRods[user.fishing.rod].name,
                    inline: true
                }
            );
        
        // 현재 상인 정보
        if (fishingState.currentMerchant) {
            const remainingTime = Math.ceil((fishingState.merchantLeaveTime - Date.now()) / 60000);
            embed.addFields({
                name: '💰 현재 상인',
                value: `${fishingState.currentMerchant.name}\n${fishingState.currentMerchant.description}\n⏱️ 남은 시간: ${remainingTime}분`,
                inline: false
            });
        }
        
        return embed;
    }
    
    // 낚시 버튼 생성
    createFishingButtons() {
        const rows = [];
        
        // 낚시 액션 버튼
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('fishing_cast')
                .setLabel('낚시하기')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎣'),
            new ButtonBuilder()
                .setCustomId('fishing_inventory')
                .setLabel('보관함')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎒'),
            new ButtonBuilder()
                .setCustomId('fishing_shop')
                .setLabel('낚시 상점')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🛒'),
            new ButtonBuilder()
                .setCustomId('fishing_collection')
                .setLabel('도감')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📖')
        );
        
        rows.push(actionRow);
        
        // 상인이 있을 때만 판매 버튼
        if (fishingState.currentMerchant) {
            const merchantRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_sell')
                    .setLabel('물고기 판매')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💰'),
                new ButtonBuilder()
                    .setCustomId('fishing_prices')
                    .setLabel('시세 확인')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📊')
            );
            rows.push(merchantRow);
        }
        
        return rows;
    }
}

// 싱글톤 인스턴스
const fishingManager = new FishingManager();

module.exports = fishingManager;