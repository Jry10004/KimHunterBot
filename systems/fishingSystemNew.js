// 🎣 새로운 낚시 시스템 (50종)
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const { FISHING_SYSTEM } = require('../data/fishingSystemNew');

class FishingManager {
    constructor() {
        this.client = null;
    }
    
    // 클라이언트 설정
    setClient(client) {
        this.client = client;
    }
    
    // 메인 낚시 UI
    createMainEmbed(user) {
        const embed = new EmbedBuilder()
            .setTitle('🎣 낚시터')
            .setColor('#1e90ff')
            .setDescription('평화로운 낚시터에서 물고기를 낚아보세요!');
            
        // 낚시 데이터 초기화
        if (!user.fishing) {
            user.fishing = {
                level: 1,  // 낚시 레벨 추가
                exp: 0,    // 낚시 경험치 추가
                rod: 'wooden',
                bait: 10,
                specialBaits: {
                    shiny: 0,
                    giant: 0,
                    legendary: 0
                },
                unlockedSpots: ['pond'],
                stats: {
                    totalCaught: 0,
                    totalEarned: 0,
                    biggestCatch: {
                        fishId: null,
                        size: 0,
                        date: null
                    },
                    rarestCatch: {
                        fishId: null,
                        rarity: null,
                        date: null
                    },
                    perfectSales: 0,
                    missedOpportunities: 0
                },
                inventory: [],
                collection: {
                    discovered: new Map(),
                    uniqueVariants: [],
                    legendaryVariants: []
                },
                lastFish: null,
                dailyLimit: 0,
                lastDailyReset: null
            };
        }
        
        // level과 exp가 없는 경우 추가
        if (user.fishing && user.fishing.level === undefined) {
            user.fishing.level = 1;
            user.fishing.exp = 0;
        }
        
        embed.addFields(
            {
                name: '🎣 낚시 레벨',
                value: `Lv.${user.fishing.level} (${user.fishing.exp}/${user.fishing.level * 100} EXP)`,
                inline: true
            },
            {
                name: '🎣 낚싯대',
                value: FISHING_SYSTEM.fishingRods[user.fishing.rod].name,
                inline: true
            },
            {
                name: '🎒 인벤토리',
                value: `${user.fishing.inventory.length}/${FISHING_SYSTEM.settings.maxInventory}`,
                inline: true
            },
            {
                name: '📊 통계',
                value: `총 ${user.fishing.stats.totalCaught}마리 낚음\n총 ${user.fishing.stats.totalEarned.toLocaleString()}G 수익`,
                inline: false
            }
        );
        
        return embed;
    }
    
    createMainComponents(user) {
        const components = [];
        
        // 첫 번째 줄 - 낚시터 선택
        const spotRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_spot_pond')
                    .setLabel('🏞️ 마을 연못')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.fishing.level < 1),
                new ButtonBuilder()
                    .setCustomId('fishing_spot_river')
                    .setLabel('🌊 맑은 강')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.fishing.level < 10),
                new ButtonBuilder()
                    .setCustomId('fishing_spot_lake')
                    .setLabel('🏔️ 호수')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.fishing.level < 20),
                new ButtonBuilder()
                    .setCustomId('fishing_spot_coast')
                    .setLabel('🏖️ 해안가')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.fishing.level < 30)
            );
            
        // 두 번째 줄 - 특수 낚시터
        const specialSpotRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_spot_deepsea')
                    .setLabel('🌑 심해')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.fishing.level < 50),
                new ButtonBuilder()
                    .setCustomId('fishing_spot_abyss')
                    .setLabel('🌌 심연')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(user.fishing.level < 70),
                new ButtonBuilder()
                    .setCustomId('fishing_spot_void')
                    .setLabel('🕳️ 공허의 바다')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(user.fishing.level < 100)
            );
            
        // 세 번째 줄 - 기능 버튼
        const functionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_inventory')
                    .setLabel('🎒 인벤토리')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('fishing_shop')
                    .setLabel('🛒 상점')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('fishing_collection')
                    .setLabel('📖 도감')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        components.push(spotRow, specialSpotRow, functionRow);
        return components;
    }
    
    // 낚시터 상세 정보
    createSpotDetailEmbed(spot, user) {
        const embed = new EmbedBuilder()
            .setTitle(`${spot.name}`)
            .setColor('#1e90ff')
            .setDescription(spot.description);
            
        // 미끼 정보
        let baitInfo = '';
        for (const [baitId, count] of Object.entries(user.fishing.baits)) {
            const bait = FISHING_SYSTEM.baits[baitId];
            if (bait && count > 0) {
                baitInfo += `${bait.name}: ${count}개\n`;
            }
        }
        
        embed.addFields(
            {
                name: '📍 낚시터 정보',
                value: `레벨 제한: ${spot.requiredLevel}\n물고기 종류: ${spot.fishTypes === 'special' ? '특수' : spot.fishTypes === 'freshwater' ? '민물' : '바닷물'}`,
                inline: true
            },
            {
                name: '🪱 보유 미끼',
                value: baitInfo || '미끼가 없습니다!',
                inline: true
            }
        );
        
        return embed;
    }
    
    // 미끼 선택 컴포넌트
    createBaitSelectionComponents(spot, user) {
        const components = [];
        const baitRow = new ActionRowBuilder();
        
        // baits 초기화
        if (!user.fishing.baits) {
            user.fishing.baits = {
                worm: user.fishing.bait || 10,
                shrimp: 0,
                bread: 0,
                lure: 0,
                glowing: user.fishing.specialBaits?.shiny || 0,
                golden: user.fishing.specialBaits?.giant || 0,
                legendary: user.fishing.specialBaits?.legendary || 0
            };
        }
        
        let buttonCount = 0;
        for (const [baitId, count] of Object.entries(user.fishing.baits)) {
            if (count > 0 && buttonCount < 5) {
                const bait = FISHING_SYSTEM.baits[baitId];
                baitRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`fishing_execute_${spot.id}_${baitId}`)
                        .setLabel(`${bait.name} (${count})`)
                        .setStyle(ButtonStyle.Primary)
                );
                buttonCount++;
            }
        }
        
        if (buttonCount === 0) {
            baitRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_no_bait')
                    .setLabel('미끼가 없습니다!')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true)
            );
        }
        
        baitRow.addComponents(
            new ButtonBuilder()
                .setCustomId('fishing_back')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
        
        components.push(baitRow);
        return components;
    }
    
    // 낚시 실행
    async executeFishing(user, spotId, baitId) {
        const spot = FISHING_SYSTEM.fishingSpots[spotId];
        const bait = FISHING_SYSTEM.baits[baitId];
        
        if (!spot || !bait) {
            return { success: false, message: '잘못된 낚시터 또는 미끼입니다.' };
        }
        
        // 미끼 확인
        if (!user.fishing.baits) {
            user.fishing.baits = {
                worm: user.fishing.bait || 10,
                shrimp: 0,
                bread: 0,
                lure: 0,
                glowing: user.fishing.specialBaits?.shiny || 0,
                golden: user.fishing.specialBaits?.giant || 0,
                legendary: user.fishing.specialBaits?.legendary || 0
            };
        }
        
        if (!user.fishing.baits[baitId] || user.fishing.baits[baitId] <= 0) {
            return { success: false, message: '미끼가 부족합니다!' };
        }
        
        // 인벤토리 확인
        if (user.fishing.inventory.length >= FISHING_SYSTEM.settings.maxInventory) {
            return { success: false, message: '인벤토리가 가득 찼습니다!' };
        }
        
        // 미끼 소모
        user.fishing.baits[baitId]--;
        
        // 물고기 결정
        const fishResult = this.determineFish(spot, user.fishing.rod, bait);
        
        // 인벤토리에 추가
        user.fishing.inventory.push(fishResult);
        
        // 통계 업데이트
        user.fishing.stats.totalCaught++;
        user.fishing.exp += fishResult.expReward;
        
        // 레벨업 체크
        while (user.fishing.exp >= user.fishing.level * 100) {
            user.fishing.exp -= user.fishing.level * 100;
            user.fishing.level++;
        }
        
        // 최고 기록 체크
        if (!user.fishing.stats.biggestCatch) {
            user.fishing.stats.biggestCatch = {
                fishId: null,
                size: 0,
                date: null
            };
        }
        
        if (fishResult.size > user.fishing.stats.biggestCatch.size) {
            user.fishing.stats.biggestCatch = {
                fishId: fishResult.id,
                size: fishResult.size,
                date: new Date()
            };
        }
        
        // 희귀도 기록
        if (!user.fishing.stats.rarestCatch) {
            user.fishing.stats.rarestCatch = {
                fishId: null,
                rarity: null,
                date: null
            };
        }
        
        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
        if (rarityOrder.indexOf(fishResult.rarity) > rarityOrder.indexOf(user.fishing.stats.rarestCatch.rarity || 'common')) {
            user.fishing.stats.rarestCatch = {
                fishId: fishResult.id,
                rarity: fishResult.rarity,
                date: new Date()
            };
        }
        
        // 도감 등록
        if (!user.fishing.collection.includes(fishResult.baseType)) {
            user.fishing.collection.push(fishResult.baseType);
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
        if (fishResult.size > (user.rankingStats.fishing.bestCatch.size || 0)) {
            user.rankingStats.fishing.bestCatch = {
                name: fishResult.name,
                size: fishResult.size
            };
        }
        
        // 마지막 업데이트 시간
        user.rankingStats.fishing.lastUpdated = new Date();
        
        // 낚시 결과 임베드
        const embed = new EmbedBuilder()
            .setTitle('🎣 낚시 성공!')
            .setColor(FISHING_SYSTEM.rarities[fishResult.rarity].color)
            .setDescription(`**${fishResult.name}**을(를) 낚았습니다!`)
            .addFields(
                {
                    name: '📊 정보',
                    value: `등급: ${FISHING_SYSTEM.rarities[fishResult.rarity].emoji} ${FISHING_SYSTEM.rarities[fishResult.rarity].name}\n크기: ${fishResult.size}cm (${fishResult.sizeGrade.name})\n예상 가격: ${fishResult.estimatedPrice.toLocaleString()}G`,
                    inline: false
                }
            )
            .setFooter({ text: `경험치 +${fishResult.expReward} | 도감 ${user.fishing.collection.length}/50` });
            
        // 레어 이상 공개 알림
        if (rarityOrder.indexOf(fishResult.rarity) >= rarityOrder.indexOf('rare')) {
            await this.sendPublicNotification(user, fishResult, spot);
        }
        
        // 주문서 드롭 체크 (0.3% 확률)
        if (Math.random() < 0.003) {
            const scrollTypes = [
                { id: 'enhancement_protection', name: '강화 보호 주문서', description: '강화 실패 시 레벨 유지' },
                { id: 'enhancement_blessing', name: '강화 축복 주문서', description: '강화 성공률 2배 증가' },
                { id: 'emblem_protection', name: '엠블렘 보호 주문서', description: '엠블렘 강화 실패 시 레벨 유지' },
                { id: 'emblem_blessing', name: '엠블렘 축복 주문서', description: '엠블렘 강화 성공률 2배 증가' }
            ];
            
            const scroll = scrollTypes[Math.floor(Math.random() * scrollTypes.length)];
            
            // 인벤토리에 추가
            if (!user.inventory) user.inventory = [];
            const existingItem = user.inventory.find(item => item.id === scroll.id);
            if (existingItem) {
                existingItem.quantity = (existingItem.quantity || 1) + 1;
            } else {
                user.inventory.push({
                    id: scroll.id,
                    name: scroll.name,
                    type: 'consumable',
                    description: scroll.description,
                    quantity: 1,
                    stackable: true
                });
            }
            
            embed.addFields({
                name: '🎁 특별 보상!',
                value: `**${scroll.name}** x1 획듍!`,
                inline: false
            });
        }
        
        const components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`fishing_execute_${spotId}_${baitId}`)
                    .setLabel('다시 낚시하기')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.fishing.baits[baitId] <= 0),
                new ButtonBuilder()
                    .setCustomId('fishing_back')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            )
        ];
        
        return { success: true, embed, components };
    }
    
    // 물고기 결정
    determineFish(spot, rodId, bait) {
        // 희귀도 결정
        const rarity = this.determineRarity(spot, rodId, bait);
        
        // 물고기 종류 결정
        let fishTypes;
        if (spot.fishTypes === 'special') {
            fishTypes = FISHING_SYSTEM.specialFishTypes;
        } else if (spot.fishTypes === 'freshwater') {
            fishTypes = FISHING_SYSTEM.fishTypes.freshwater;
        } else {
            fishTypes = FISHING_SYSTEM.fishTypes.saltwater;
        }
        
        // 특수 물고기 체크
        if (spot.specialFish && Math.random() < 0.1) {
            const specialFish = spot.specialFish[Math.floor(Math.random() * spot.specialFish.length)];
            if (fishTypes.includes(specialFish)) {
                fishTypes = [specialFish];
            }
        }
        
        const baseType = fishTypes[Math.floor(Math.random() * fishTypes.length)];
        
        // 크기 결정
        const sizeResult = this.determineSize(spot, rodId, bait);
        
        // 이름 생성
        const name = FISHING_SYSTEM.generateFishName(rarity, baseType, sizeResult.grade);
        
        // 가격 계산
        const basePrice = FISHING_SYSTEM.rarities[rarity].basePrice;
        const price = Math.floor(
            (basePrice.min + Math.random() * (basePrice.max - basePrice.min)) *
            sizeResult.sizeGrade.priceMultiplier
        );
        
        // 경험치 계산
        const rarityExp = { common: 10, uncommon: 25, rare: 50, epic: 100, legendary: 250, mythic: 500 };
        const expReward = rarityExp[rarity] + Math.floor(sizeResult.size / 10);
        
        return {
            name: name,
            baseType: baseType,
            rarity: rarity,
            size: sizeResult.size,
            sizeGrade: sizeResult.sizeGrade,
            estimatedPrice: price,
            expReward: expReward,
            timestamp: Date.now()
        };
    }
    
    // 희귀도 결정
    determineRarity(spot, rodId, bait) {
        let weights = { ...FISHING_SYSTEM.rarities };
        const rod = FISHING_SYSTEM.fishingRods[rodId];
        
        // 낚시터 보너스
        if (spot.rarityBonus) {
            for (const [rarity, bonus] of Object.entries(spot.rarityBonus)) {
                if (weights[rarity]) {
                    weights[rarity].weight *= bonus;
                }
            }
        }
        
        // 낚싯대 보너스
        if (rod.rarityBonus > 1) {
            for (const rarity of ['rare', 'epic', 'legendary', 'mythic']) {
                if (weights[rarity]) {
                    weights[rarity].weight *= rod.rarityBonus;
                }
            }
        }
        
        // 미끼 보너스
        if (bait.bonus) {
            if (bait.bonus.rarity) {
                for (const rarity in weights) {
                    weights[rarity].weight *= bait.bonus.rarity;
                }
            }
            if (bait.bonus.legendary) {
                weights.legendary.weight *= bait.bonus.legendary;
                weights.mythic.weight *= bait.bonus.mythic;
            }
            if (bait.bonus.all) {
                for (const rarity in weights) {
                    weights[rarity].weight *= bait.bonus.all;
                }
            }
        }
        
        // 가중치 기반 선택
        const totalWeight = Object.values(weights).reduce((sum, r) => sum + r.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const [rarity, data] of Object.entries(weights)) {
            random -= data.weight;
            if (random <= 0) {
                return rarity;
            }
        }
        
        return 'common';
    }
    
    // 크기 결정
    determineSize(spot, rodId, bait) {
        const rod = FISHING_SYSTEM.fishingRods[rodId];
        
        // 기본 크기 (0~1)
        let sizeRoll = Math.random();
        
        // 낚시터 크기 보정
        sizeRoll *= spot.sizeModifier || 1;
        
        // 낚싯대 크기 보정
        sizeRoll *= rod.sizeBonus;
        
        // 미끼 크기 보정
        if (bait.bonus && bait.bonus.size) {
            sizeRoll *= bait.bonus.size;
        }
        
        // 크기 등급 결정
        let sizeGrade;
        for (const [grade, data] of Object.entries(FISHING_SYSTEM.sizeGrades)) {
            if (sizeRoll >= data.sizeRange[0] && sizeRoll < data.sizeRange[1]) {
                sizeGrade = { grade, ...data };
                break;
            }
        }
        
        if (!sizeGrade) {
            sizeGrade = { grade: 'medium', ...FISHING_SYSTEM.sizeGrades.medium };
        }
        
        // 실제 크기 계산
        const fishType = spot.fishTypes === 'special' ? 'special' : spot.fishTypes;
        const sizeRange = sizeGrade.sizeByType[fishType];
        const size = Math.floor(sizeRange.min + Math.random() * (sizeRange.max - sizeRange.min));
        
        return { size, sizeGrade, grade: sizeGrade.grade };
    }
    
    // 공개 알림
    async sendPublicNotification(user, fish, spot) {
        if (!this.client) return;
        
        const rarityData = FISHING_SYSTEM.rarities[fish.rarity];
        const embed = new EmbedBuilder()
            .setColor(rarityData.color)
            .setTitle('🎣 희귀한 물고기 발견!')
            .setDescription(`**${user.nickname || user.username}**님이 ${spot.name}에서\n**${fish.name}**을(를) 낚았습니다!`)
            .addFields(
                {
                    name: '📊 정보',
                    value: `${rarityData.emoji} ${rarityData.name} 등급\n크기: ${fish.size}cm (${fish.sizeGrade.name})`,
                    inline: true
                },
                {
                    name: '💰 예상 가격',
                    value: `${fish.estimatedPrice.toLocaleString()}G`,
                    inline: true
                }
            )
            .setTimestamp();
            
        // 신화 등급은 특별한 디자인
        if (fish.rarity === 'mythic') {
            embed.setImage('https://media.giphy.com/media/3o7TKSjRrfIPjeiVy/giphy.gif')
                .setFooter({ text: '🌟 전설적인 낚시!' });
            
            // 엠블럼 축복의 주문서 보상
            if (!user.items) user.items = {};
            if (!user.items.emblemBlessingScroll) user.items.emblemBlessingScroll = 0;
            user.items.emblemBlessingScroll += 1;
            await user.save();
            
            embed.addFields({
                name: '✨ 추가 보상!',
                value: '**엠블럼 축복의 주문서** x1 획득!',
                inline: false
            });
        }
        
        // 모든 서버의 공지 채널로 전송
        for (const guild of this.client.guilds.cache.values()) {
            const noticeChannel = guild.channels.cache.find(ch => 
                ch.name.includes('공지') || ch.name.includes('notice') || ch.name.includes('알림')
            );
            
            if (noticeChannel && noticeChannel.isTextBased()) {
                try {
                    await noticeChannel.send({ embeds: [embed] });
                } catch (error) {
                    console.error(`[낚시] ${guild.name} 공지 전송 실패:`, error);
                }
            }
        }
    }
    
    // 인벤토리 임베드
    createInventoryEmbed(user) {
        const embed = new EmbedBuilder()
            .setTitle('🎒 낚시 인벤토리')
            .setColor('#1e90ff')
            .setDescription(`보관 중인 물고기: ${user.fishing.inventory.length}/${FISHING_SYSTEM.settings.maxInventory}`);
            
        if (user.fishing.inventory.length === 0) {
            embed.addFields({
                name: '📦 비어있음',
                value: '아직 잡은 물고기가 없습니다!',
                inline: false
            });
        } else {
            // 희귀도별로 정렬
            const sorted = [...user.fishing.inventory].sort((a, b) => {
                const rarityOrder = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
                return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
            });
            
            // 최대 25개만 표시
            const display = sorted.slice(0, 25);
            for (const [index, fish] of display.entries()) {
                const rarityData = FISHING_SYSTEM.rarities[fish.rarity];
                embed.addFields({
                    name: `${index + 1}. ${fish.name}`,
                    value: `${rarityData.emoji} ${fish.size}cm | ${fish.estimatedPrice.toLocaleString()}G`,
                    inline: true
                });
            }
            
            if (sorted.length > 25) {
                embed.setFooter({ text: `...외 ${sorted.length - 25}마리 더` });
            }
        }
        
        return embed;
    }
    
    // 인벤토리 컴포넌트
    createInventoryComponents(user) {
        const components = [];
        
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_sell')
                    .setLabel('💰 물고기 판매')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(user.fishing.inventory.length === 0),
                new ButtonBuilder()
                    .setCustomId('fishing_prices')
                    .setLabel('📊 시세 확인')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('fishing_back')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        components.push(buttonRow);
        return components;
    }
    
    // 상점 임베드
    createShopEmbed(user) {
        const embed = new EmbedBuilder()
            .setTitle('🛒 낚시 상점')
            .setColor('#f39c12')
            .setDescription('낚싯대와 미끼를 구매할 수 있습니다.')
            .addFields({
                name: '💰 보유 골드',
                value: `${user.gold.toLocaleString()}G`,
                inline: false
            });
            
        return embed;
    }
    
    // 낚싯대 상점
    createRodShopEmbed(user) {
        const embed = new EmbedBuilder()
            .setTitle('🎣 낚싯대 상점')
            .setColor('#f39c12');
            
        for (const [rodId, rod] of Object.entries(FISHING_SYSTEM.fishingRods)) {
            const owned = user.fishing.rod === rodId;
            const canBuy = user.gold >= rod.price && !owned;
            
            embed.addFields({
                name: `${owned ? '✅' : ''} ${rod.name}`,
                value: `${rod.description}\n크기 보너스: ${rod.sizeBonus}x | 희귀도 보너스: ${rod.rarityBonus}x\n가격: ${rod.price.toLocaleString()}G`,
                inline: false
            });
        }
        
        return embed;
    }
    
    // 미끼 상점
    createBaitShopEmbed(user) {
        const embed = new EmbedBuilder()
            .setTitle('🪱 미끼 상점')
            .setColor('#f39c12');
            
        for (const [baitId, bait] of Object.entries(FISHING_SYSTEM.baits)) {
            const owned = user.fishing.baits[baitId] || 0;
            
            embed.addFields({
                name: `${bait.name} (보유: ${owned}개)`,
                value: `${bait.description}\n효과: ${bait.effect}\n가격: ${bait.price}G/개`,
                inline: true
            });
        }
        
        return embed;
    }
    
    // 낚싯대 구매
    async buyRod(user, rodId) {
        const rod = FISHING_SYSTEM.fishingRods[rodId];
        if (!rod) {
            return { success: false, message: '존재하지 않는 낚싯대입니다.' };
        }
        
        if (user.fishing.rod === rodId) {
            return { success: false, message: '이미 보유 중인 낚싯대입니다.' };
        }
        
        if (user.gold < rod.price) {
            return { success: false, message: '골드가 부족합니다.' };
        }
        
        user.gold -= rod.price;
        user.fishing.rod = rodId;
        
        return { success: true, message: `${rod.name}을(를) 구매했습니다!` };
    }
    
    // 미끼 구매
    async buyBait(user, baitId, amount) {
        const bait = FISHING_SYSTEM.baits[baitId];
        if (!bait) {
            return { success: false, message: '존재하지 않는 미끼입니다.' };
        }
        
        const totalPrice = bait.price * amount;
        if (user.gold < totalPrice) {
            return { success: false, message: '골드가 부족합니다.' };
        }
        
        user.gold -= totalPrice;
        user.fishing.baits[baitId] = (user.fishing.baits[baitId] || 0) + amount;
        
        return { success: true, message: `${bait.name} ${amount}개를 구매했습니다!` };
    }
    
    // 시세 임베드 생성
    createPriceEmbed() {
        const embed = new EmbedBuilder()
            .setTitle('🐟 실시간 수산물 거래소')
            .setColor('#00bfff')
            .setDescription('수산물 시세 정보 • 24시간 실시간 업데이트');
            
        // 시세 차트 모의
        const chartData = this.generatePriceChart();
        embed.addFields({
            name: '🐟 가격 차트',
            value: chartData,
            inline: false
        });
        
        // 주요 어종 시세
        const mainFish = {
            '참치': { current: 15000, change: 5.2, high: 18000, low: 12000 },
            '연어': { current: 12000, change: -2.1, high: 14000, low: 10000 },
            '광어': { current: 8000, change: 1.8, high: 9000, low: 7000 }
        };
        
        for (const [name, data] of Object.entries(mainFish)) {
            const changeEmoji = data.change >= 0 ? '📈' : '📉';
            const changeColor = data.change >= 0 ? '+' : '';
            
            embed.addFields({
                name: `🐟 ${name} (${name.toUpperCase().substring(0, 4)})`,
                value: `현재가: ${data.current.toLocaleString()}G\n변동률: ${changeEmoji} ${changeColor}${data.change}%\n24시간 최고: ${data.high.toLocaleString()}G\n24시간 최저: ${data.low.toLocaleString()}G`,
                inline: true
            });
        }
        
        // 시장 분석
        const marketIndex = Math.floor(Math.random() * 100);
        const freshnessBonus = Math.floor(Math.random() * 50);
        
        embed.addFields({
            name: '📊 시장 분석',
            value: `• 어획량 지수: ${marketIndex}% ${marketIndex > 50 ? '(증가 추세)' : '(감소 추세)'}\n• 신선도 프리미엄: +${freshnessBonus}%\n• 크기 보너스: 대형 +30%, 특대형 +50%`,
            inline: false
        });
        
        // 어종별 가격대
        const fishPrices = {
            '🐟 일반 어종': {
                '붕어': '500~1,000G',
                '잉어': '800~1,500G',
                '메기': '1,200~2,000G'
            },
            '🐠 희귀 어종': {
                '무지개송어': '3,000~5,000G',
                '금붕어': '5,000~8,000G',
                '열대어': '4,000~7,000G'
            },
            '🦈 특수 어종': {
                '상어': '15,000~25,000G',
                '가오리': '12,000~20,000G',
                '전기뱀장어': '18,000~30,000G'
            },
            '🐙 심해 어종': {
                '대왕오징어': '50,000~80,000G',
                '심해아귀': '35,000~60,000G',
                '투명물고기': '40,000~70,000G'
            },
            '🦞 갑각류': {
                '새우': '2,000~3,500G',
                '게': '4,000~6,000G',
                '랍스터': '8,000~15,000G'
            },
            '🐚 조개류': {
                '조개': '1,000~2,000G',
                '전복': '6,000~10,000G',
                '진주조개': '10,000~20,000G'
            }
        };
        
        for (const [category, fishes] of Object.entries(fishPrices)) {
            let value = '';
            for (const [fish, price] of Object.entries(fishes)) {
                value += `${fish}: ${price}\n`;
            }
            embed.addFields({
                name: category,
                value: value.trim(),
                inline: true
            });
        }
        
        // 날씨 정보
        const weather = ['☀️ 맑음', '☁️ 흐림', '🌧️ 비', '⛈️ 폭풍'][Math.floor(Math.random() * 4)];
        const wave = ['🌊 잔잔함', '🌊🌊 보통', '🌊🌊🌊 거침'][Math.floor(Math.random() * 3)];
        const tide = ['💨 약함', '💨💨 보통', '💨💨💨 강함'][Math.floor(Math.random() * 3)];
        const moonPhase = ['🌙 사리', '🌓 조금'][Math.floor(Math.random() * 2)];
        
        embed.addFields({
            name: '🌊 오늘의 조황',
            value: `날씨: ${weather}\n파도: ${wave}\n조류: ${tide}\n물때: ${moonPhase}`,
            inline: true
        });
        
        // 낚시 정보
        const goldenHours = ['오전 6시', '오후 6시'];
        const recommendedBait = ['지렁이', '새우', '떡밥', '루어'][Math.floor(Math.random() * 4)];
        const bonusMultiplier = Math.random() > 0.7 ? 2 : 1;
        
        embed.addFields({
            name: '🌊 오늘의 낚시 정보',
            value: `황금 물때: ${goldenHours.join(', ')}\n추천 미끼: ${recommendedBait} (+20% 확률)\n특별 이벤트: ${bonusMultiplier === 2 ? '대물 출현율 2배' : '일반 조황'}`,
            inline: true
        });
        
        embed.setFooter({ text: '낚시왕 협회 제공 • 실시간 어황 정보' })
            .setTimestamp();
            
        return embed;
    }
    
    // 가격 차트 생성
    generatePriceChart() {
        const hours = 24;
        const maxValue = 20000;
        const chartHeight = 8;
        
        // 랜덤 가격 데이터 생성
        const prices = [];
        let currentPrice = 15000;
        for (let i = 0; i < hours; i++) {
            currentPrice += (Math.random() - 0.5) * 2000;
            currentPrice = Math.max(10000, Math.min(20000, currentPrice));
            prices.push(currentPrice);
        }
        
        // 차트 그리기
        let chart = '';
        for (let row = chartHeight; row >= 0; row--) {
            const threshold = (row / chartHeight) * maxValue;
            let line = row === 0 ? '     0 │' : `${String(Math.floor(threshold)).padStart(6)} │`;
            
            for (let col = 0; col < hours; col += 3) {
                if (prices[col] >= threshold) {
                    line += '██';
                } else {
                    line += '  ';
                }
            }
            
            chart += line + '\n';
        }
        
        // X축
        chart += '       └' + '─'.repeat(hours * 2 / 3) + '\n';
        chart += '        ';
        const now = new Date();
        for (let i = 0; i < hours; i += 6) {
            const hour = new Date(now.getTime() - (hours - i) * 60 * 60 * 1000);
            chart += hour.getHours().toString().padStart(2, '0') + ':' + hour.getMinutes().toString().padStart(2, '0') + '   ';
        }
        
        return '```' + chart + '```';
    }
    
    // 판매 임베드 생성
    createSellEmbed(user) {
        const embed = new EmbedBuilder()
            .setTitle('💰 물고기 판매')
            .setColor('#2ecc71')
            .setDescription('인벤토리의 물고기를 판매합니다.');
            
        if (user.fishing.inventory.length === 0) {
            embed.addFields({
                name: '📦 비어있음',
                value: '판매할 물고기가 없습니다!',
                inline: false
            });
        } else {
            // 총 가치 계산
            let totalValue = 0;
            const rarityCount = {};
            
            for (const fish of user.fishing.inventory) {
                totalValue += fish.estimatedPrice;
                rarityCount[fish.rarity] = (rarityCount[fish.rarity] || 0) + 1;
            }
            
            // 희귀도별 개수
            let countText = '';
            const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
            for (const rarity of rarityOrder) {
                if (rarityCount[rarity]) {
                    const rarityData = FISHING_SYSTEM.rarities[rarity];
                    countText += `${rarityData.emoji} ${rarityData.name}: ${rarityCount[rarity]}마리\n`;
                }
            }
            
            embed.addFields(
                {
                    name: '📊 보유 현황',
                    value: countText || '없음',
                    inline: true
                },
                {
                    name: '💰 총 예상 가치',
                    value: `${totalValue.toLocaleString()}G`,
                    inline: true
                }
            );
        }
        
        return embed;
    }
    
    // 판매 컴포넌트 생성
    createSellComponents(user) {
        const components = [];
        
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_sell_all')
                    .setLabel('💰 전체 판매')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(user.fishing.inventory.length === 0),
                new ButtonBuilder()
                    .setCustomId('fishing_sell_common')
                    .setLabel('⚪ 일반만 판매')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!user.fishing.inventory.some(f => f.rarity === 'common')),
                new ButtonBuilder()
                    .setCustomId('fishing_sell_rare')
                    .setLabel('💎 희귀 이상만 판매')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!user.fishing.inventory.some(f => ['rare', 'epic', 'legendary', 'mythic'].includes(f.rarity))),
                new ButtonBuilder()
                    .setCustomId('fishing_back')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        components.push(buttonRow);
        return components;
    }
    
    // 물고기 판매 실행
    async sellFish(user, action) {
        const inventory = user.fishing.inventory;
        if (inventory.length === 0) {
            return { success: false, message: '판매할 물고기가 없습니다!' };
        }
        
        let itemsToSell = [];
        let totalGold = 0;
        
        switch (action) {
            case 'all':
                itemsToSell = [...inventory];
                break;
            case 'common':
                itemsToSell = inventory.filter(f => f.rarity === 'common');
                break;
            case 'rare':
                itemsToSell = inventory.filter(f => ['rare', 'epic', 'legendary', 'mythic'].includes(f.rarity));
                break;
        }
        
        if (itemsToSell.length === 0) {
            return { success: false, message: '판매할 물고기가 없습니다!' };
        }
        
        // 가격 계산
        for (const fish of itemsToSell) {
            totalGold += fish.estimatedPrice;
        }
        
        // 판매 처리
        user.gold += totalGold;
        user.fishing.stats.totalEarned += totalGold;
        
        // 인벤토리에서 제거
        user.fishing.inventory = inventory.filter(f => !itemsToSell.includes(f));
        
        // 결과 임베드
        const embed = new EmbedBuilder()
            .setTitle('💰 판매 완료!')
            .setColor('#2ecc71')
            .setDescription(`${itemsToSell.length}마리의 물고기를 판매했습니다!`)
            .addFields(
                {
                    name: '💵 획득 골드',
                    value: `+${totalGold.toLocaleString()}G`,
                    inline: true
                },
                {
                    name: '💰 현재 골드',
                    value: `${user.gold.toLocaleString()}G`,
                    inline: true
                }
            )
            .setTimestamp();
            
        const components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_sell')
                    .setLabel('💰 더 판매하기')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(user.fishing.inventory.length === 0),
                new ButtonBuilder()
                    .setCustomId('fishing_back')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            )
        ];
        
        return { success: true, embed, components };
    }
    
    // 낚싯대 구매 컴포넌트
    createRodShopComponents(user) {
        const components = [];
        const rodButtons = [];
        
        for (const [rodId, rod] of Object.entries(FISHING_SYSTEM.fishingRods)) {
            const owned = user.fishing.rod === rodId;
            const canBuy = user.gold >= rod.price && !owned;
            
            rodButtons.push(
                new ButtonBuilder()
                    .setCustomId(`fishing_buy_rod_${rodId}`)
                    .setLabel(owned ? `✅ ${rod.name}` : rod.name)
                    .setStyle(owned ? ButtonStyle.Success : ButtonStyle.Primary)
                    .setDisabled(!canBuy)
            );
        }
        
        // 버튼을 여러 줄로 나누기
        const rows = [];
        for (let i = 0; i < rodButtons.length; i += 5) {
            const row = new ActionRowBuilder();
            const buttons = rodButtons.slice(i, i + 5);
            row.addComponents(...buttons);
            rows.push(row);
        }
        
        // 뒤로가기 버튼
        rows.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_shop')
                    .setLabel('🔙 상점으로')
                    .setStyle(ButtonStyle.Secondary)
            )
        );
        
        return rows;
    }
    
    // 미끼 구매 컴포넌트
    createBaitShopComponents(user) {
        const components = [];
        const baitButtons = [];
        
        for (const [baitId, bait] of Object.entries(FISHING_SYSTEM.baits)) {
            baitButtons.push(
                new ButtonBuilder()
                    .setCustomId(`fishing_buy_bait_${baitId}_10`)
                    .setLabel(`${bait.name} x10`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.gold < bait.price * 10)
            );
        }
        
        // 버튼을 여러 줄로 나누기
        const rows = [];
        for (let i = 0; i < baitButtons.length; i += 5) {
            const row = new ActionRowBuilder();
            const buttons = baitButtons.slice(i, i + 5);
            row.addComponents(...buttons);
            rows.push(row);
        }
        
        // 뒤로가기 버튼
        rows.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_shop')
                    .setLabel('🔙 상점으로')
                    .setStyle(ButtonStyle.Secondary)
            )
        );
        
        return rows;
    }
    
    // 도감 임베드
    createCollectionEmbed(user) {
        const embed = new EmbedBuilder()
            .setTitle('📖 물고기 도감')
            .setColor('#3498db')
            .setDescription(`수집한 물고기 종류: ${user.fishing.collection.length}/50`);
            
        const allFishTypes = [
            ...FISHING_SYSTEM.fishTypes.freshwater,
            ...FISHING_SYSTEM.fishTypes.saltwater,
            ...FISHING_SYSTEM.specialFishTypes
        ];
        
        // 카테고리별로 정리
        const categories = {
            '🏞️ 민물고기': FISHING_SYSTEM.fishTypes.freshwater,
            '🌊 바닷물고기': FISHING_SYSTEM.fishTypes.saltwater,
            '✨ 특수 물고기': FISHING_SYSTEM.specialFishTypes
        };
        
        for (const [category, fishList] of Object.entries(categories)) {
            let collected = 0;
            let text = '';
            
            for (const fish of fishList) {
                if (user.fishing.collection.includes(fish)) {
                    text += `✅ ${fish}\n`;
                    collected++;
                } else {
                    text += `❌ ???\n`;
                }
            }
            
            embed.addFields({
                name: `${category} (${collected}/${fishList.length})`,
                value: text || '없음',
                inline: true
            });
        }
        
        // 수집 보상 정보
        const collectionRewards = [
            { count: 10, reward: '🎣 강철 낚싯대 해금' },
            { count: 20, reward: '💰 10,000G 보너스' },
            { count: 30, reward: '🎣 티타늄 낚싯대 해금' },
            { count: 40, reward: '💎 전설 미끼 10개' },
            { count: 50, reward: '🏆 낚시왕 칭호' }
        ];
        
        let rewardText = '';
        for (const milestone of collectionRewards) {
            const achieved = user.fishing.collection.length >= milestone.count;
            rewardText += `${achieved ? '✅' : '⬜'} ${milestone.count}종: ${milestone.reward}\n`;
        }
        
        embed.addFields({
            name: '🎁 수집 보상',
            value: rewardText,
            inline: false
        });
        
        return embed;
    }
    
    // 랭킹 임베드
    async createRankingEmbed() {
        const embed = new EmbedBuilder()
            .setTitle('🏆 낚시왕 랭킹')
            .setColor('#ffd700')
            .setDescription('가장 많은 물고기를 낚은 낚시꾼들');
            
        // 모든 유저의 낚시 데이터 조회
        const users = await User.find({ 'fishingData.stats.totalCaught': { $gt: 0 } })
            .sort({ 'fishingData.stats.totalCaught': -1 })
            .limit(10);
            
        if (users.length === 0) {
            embed.addFields({
                name: '📊 랭킹',
                value: '아직 낚시를 시작한 유저가 없습니다!',
                inline: false
            });
        } else {
            let rankingText = '';
            const medals = ['🥇', '🥈', '🥉'];
            
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const medal = medals[i] || `${i + 1}.`;
                rankingText += `${medal} **${user.nickname || '익명'}** - ${user.fishing.stats.totalCaught}마리 (Lv.${user.fishing.level})\n`;
            }
            
            embed.addFields({
                name: '🎣 낚시 마스터',
                value: rankingText,
                inline: false
            });
            
            // 통계
            let totalFish = 0;
            let totalEarned = 0;
            for (const user of users) {
                totalFish += user.fishing.stats.totalCaught;
                totalEarned += user.fishing.stats.totalEarned;
            }
            
            embed.addFields({
                name: '📊 서버 통계',
                value: `총 낚은 물고기: ${totalFish.toLocaleString()}마리\n총 수익: ${totalEarned.toLocaleString()}G`,
                inline: false
            });
        }
        
        embed.setFooter({ text: '매일 자정에 업데이트됩니다' })
            .setTimestamp();
            
        return embed;
    }
}

// 싱글톤 인스턴스
const fishingManager = new FishingManager();

module.exports = { fishingManager };