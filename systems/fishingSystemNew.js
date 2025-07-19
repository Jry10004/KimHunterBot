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
        // 낚시권 재생성 체크
        this.regenerateTickets(user);
        
        // 시간대별 인사말
        const hour = new Date().getHours();
        let greeting, bgColor;
        if (hour < 6) {
            greeting = '🌙 새벽 낚시는 대물의 시간!';
            bgColor = '#191970';
        } else if (hour < 12) {
            greeting = '🌅 아침 햇살과 함께하는 낚시!';
            bgColor = '#FFD700';
        } else if (hour < 18) {
            greeting = '☀️ 오후의 여유로운 낚시 시간!';
            bgColor = '#87CEEB';
        } else {
            greeting = '🌆 노을과 함께하는 황금 낚시 시간!';
            bgColor = '#FF6347';
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🎣 김헌터 낚시터에 오신 것을 환영합니다!')
            .setColor(bgColor)
            .setDescription(`${greeting}\n\n오늘은 어떤 물고기를 만나실까요? 🐟`);
            
        // 낚시 데이터 초기화
        if (!user.fishing) {
            user.fishing = {
                level: 1,
                exp: 0,
                rod: 'wooden',
                bait: 10,
                baits: {
                    worm: 10,
                    shrimp: 0,
                    bread: 0,
                    lure: 0,
                    glowing: 0,
                    golden: 0,
                    legendary: 0
                },
                unlockedSpots: ['pond'],
                stats: {
                    totalCaught: 0,
                    totalEarned: 0,
                    biggestCatch: { fishId: null, size: 0, date: null },
                    rarestCatch: { fishId: null, rarity: null, date: null }
                },
                inventory: [],
                collection: [],
                tickets: 20,
                lastTicketRegen: new Date()
            };
        }
        
        // level과 exp가 없는 경우 추가
        if (user.fishing && user.fishing.level === undefined) {
            user.fishing.level = 1;
            user.fishing.exp = 0;
        }
        
        // 다음 레벨까지 경험치 퍼센트
        const expPercent = Math.round((user.fishing.exp / (user.fishing.level * 100)) * 100);
        const expBar = this.createProgressBar(expPercent);
        
        // 티켓 재생성 시간
        const nextTicketTime = new Date(user.fishing.lastTicketRegen).getTime() + (30 * 60 * 1000);
        const timeUntilNextTicket = Math.max(0, Math.floor((nextTicketTime - Date.now()) / 1000 / 60));
        
        embed.addFields(
            {
                name: '🎫 낚시권',
                value: `${user.fishing.tickets || 0}/20 장\n다음 티켓: ${timeUntilNextTicket}분 후`,
                inline: true
            },
            {
                name: '📊 낚시 정보',
                value: `**레벨:** Lv.${user.fishing.level}\n${expBar} ${expPercent}%`,
                inline: true
            },
            {
                name: '🎣 장비',
                value: `**낚싯대:** ${FISHING_SYSTEM.fishingRods[user.fishing.rod].name}\n**인벤토리:** ${user.fishing.inventory.length}/100`,
                inline: true
            }
        );
        
        // 최고 기록
        if (user.fishing.stats.biggestCatch && user.fishing.stats.biggestCatch.size > 0) {
            embed.addFields({
                name: '🏆 최고 기록',
                value: `**최대 크기:** ${user.fishing.stats.biggestCatch.size}cm\n**총 수익:** ${user.fishing.stats.totalEarned.toLocaleString()}G\n**잡은 물고기:** ${user.fishing.stats.totalCaught}마리`,
                inline: false
            });
        }
        
        // 오늘의 운세
        const fortunes = [
            "🍀 오늘은 대물을 낚을 수 있는 행운의 날!",
            "✨ 희귀한 물고기와의 만남이 기다립니다!",
            "🌟 전설의 물고기가 당신을 기다립니다!",
            "💰 오늘은 황금 물고기의 날!",
            "🎯 백발백중! 모든 캐스팅이 성공할 예감!",
            "🌈 무지개 물고기를 만날 수 있을지도?"
        ];
        const todayFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
        
        embed.setFooter({ text: todayFortune });
        
        return embed;
    }
    
    // 진행도 바 생성
    createProgressBar(percent) {
        const filled = Math.floor(percent / 10);
        const empty = 10 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
    
    createMainComponents(user) {
        const components = [];
        
        // 낚시 데이터 초기화 확인
        if (!user.fishing) {
            user.fishing = {
                level: 1,
                exp: 0,
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
                }
            };
        }
        
        // 첫 번째 줄 - 낚시터 선택
        const spotRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_spot_pond')
                    .setLabel('🏞️ 마을 연못')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled((user.fishing?.level || 1) < 1),
                new ButtonBuilder()
                    .setCustomId('fishing_spot_river')
                    .setLabel('🌊 맑은 강')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled((user.fishing?.level || 1) < 10),
                new ButtonBuilder()
                    .setCustomId('fishing_spot_lake')
                    .setLabel('🏔️ 호수')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled((user.fishing?.level || 1) < 20),
                new ButtonBuilder()
                    .setCustomId('fishing_spot_coast')
                    .setLabel('🏖️ 해안가')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled((user.fishing?.level || 1) < 30)
            );
            
        // 두 번째 줄 - 특수 낚시터
        const specialSpotRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_spot_deepsea')
                    .setLabel('🌑 심해')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled((user.fishing?.level || 1) < 50),
                new ButtonBuilder()
                    .setCustomId('fishing_spot_abyss')
                    .setLabel('🌌 심연')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled((user.fishing?.level || 1) < 70),
                new ButtonBuilder()
                    .setCustomId('fishing_spot_void')
                    .setLabel('🕳️ 공허의 바다')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled((user.fishing?.level || 1) < 100)
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
                    .setCustomId('fishing_market')
                    .setLabel('🏪 수산시장')
                    .setStyle(ButtonStyle.Success),
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
        // 낚시터별 특별한 색상
        const spotColors = {
            pond: '#87CEEB',      // 하늘색
            river: '#4169E1',     // 로얄블루
            lake: '#191970',      // 미드나잇블루
            coast: '#FFD700',     // 골드
            deepsea: '#000080',   // 네이비
            abyss: '#4B0082',     // 인디고
            void: '#8B008B',      // 다크마젠타
            dragon_ocean: '#FF4500', // 오렌지레드
            celestial_lake: '#FFB6C1', // 라이트핑크
            eternal_depths: '#9400D3'  // 바이올렛
        };
        
        const embed = new EmbedBuilder()
            .setTitle(`${spot.name}`)
            .setColor(spotColors[spot.id] || '#1e90ff')
            .setDescription(`${spot.description}\n\n*"${this.getSpotQuote(spot.id)}"*`);
            
        // 미끼 정보를 더 시각적으로
        let baitInfo = '';
        let totalBaits = 0;
        
        if (!user.fishing.baits) {
            user.fishing.baits = {
                worm: user.fishing.bait || 10,
                shrimp: 0,
                bread: 0,
                lure: 0,
                glowing: 0,
                golden: 0,
                legendary: 0
            };
        }
        
        for (const [baitId, count] of Object.entries(user.fishing.baits)) {
            const bait = FISHING_SYSTEM.baits[baitId];
            if (bait && count > 0) {
                baitInfo += `${bait.name} ×${count}\n`;
                totalBaits += count;
            }
        }
        
        // 추천 정보 추가
        const recommendations = this.getSpotRecommendations(spot);
        
        embed.addFields(
            {
                name: '📍 낚시터 정보',
                value: `**레벨 제한:** Lv.${spot.requiredLevel}+\n**주요 어종:** ${spot.fishTypes === 'special' ? '✨ 특수' : spot.fishTypes === 'freshwater' ? '💧 민물' : '🌊 바닷물'}\n**크기 보정:** ×${spot.sizeModifier}`,
                inline: true
            },
            {
                name: '🎒 미끼 보유현황',
                value: totalBaits > 0 ? baitInfo : '⚠️ 미끼가 없습니다!\n상점에서 구매하세요!',
                inline: true
            },
            {
                name: '💡 낚시 팁',
                value: recommendations,
                inline: false
            }
        );
        
        // 특수 물고기 정보
        if (spot.specialFish && spot.specialFish.length > 0) {
            embed.addFields({
                name: '🌟 출현 가능한 특수 어종',
                value: spot.specialFish.join(', '),
                inline: false
            });
        }
        
        return embed;
    }
    
    // 낚시터별 명언
    getSpotQuote(spotId) {
        const quotes = {
            pond: "평화로운 연못에는 항상 놀라움이 숨어있다.",
            river: "흐르는 물살 속에 진정한 도전이 있다.",
            lake: "깊은 호수는 큰 꿈을 품고 있다.",
            coast: "파도와 함께 춤추는 물고기들의 향연.",
            deepsea: "어둠 속에서 빛나는 것들을 찾아서.",
            abyss: "심연을 들여다보면, 심연도 당신을 본다.",
            void: "차원의 경계에서 만나는 기적.",
            dragon_ocean: "용의 숨결이 닿는 곳, 전설이 시작된다.",
            celestial_lake: "별빛이 내리는 곳에 천상의 물고기가.",
            eternal_depths: "시간이 멈춘 곳에서 영원을 낚는다."
        };
        return quotes[spotId] || "낚시는 인내의 예술이다.";
    }
    
    // 낚시터별 추천 정보
    getSpotRecommendations(spot) {
        const tips = {
            pond: "🎣 초보자 추천!\n🪱 지렁이로 충분해요\n🐟 작지만 귀여운 물고기들",
            river: "💨 물살이 세서 큰 물고기 출현!\n🦐 새우 미끼 추천\n📏 평균 크기 UP",
            lake: "🏆 대물 낚시의 성지\n✨ 발광 미끼 효과 좋음\n🎯 인내심이 필요해요",
            coast: "🌊 다양한 어종 서식\n🍞 빵조각도 의외로 잘 먹힘\n⏰ 조수 시간 확인!",
            deepsea: "⚡ 희귀 어종 다수!\n💎 고급 미끼 필수\n🦈 대형 어종 주의",
            abyss: "🌌 미지의 세계\n✨ 전설 미끼 강력 추천\n😱 상상초월 크기",
            void: "🕳️ 차원어 전용 낚시터\n🌟 모든 미끼 효과 증폭\n🎰 도박과도 같은 곳"
        };
        return tips[spot.id] || "🎣 행운을 빕니다!";
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
                if (bait) {  // bait가 존재하는지 확인
                    baitRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`fishing_execute_${spot.id}_${baitId}`)
                            .setLabel(`${bait.name} (${count})`)
                            .setStyle(ButtonStyle.Primary)
                    );
                    buttonCount++;
                }
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
    
    // 물고기 명언 생성
    getFishQuote(rarity) {
        const quotes = {
            common: [
                "오늘도 평화로운 낚시네요.",
                "작지만 소중한 한 마리!",
                "낚시의 기본은 인내심이죠."
            ],
            uncommon: [
                "오, 뭔가 특별한 녀석이네요!",
                "이런 걸 낚다니, 운이 좋군요!",
                "반짝반짝 빛나는 비늘이 예쁘네요."
            ],
            rare: [
                "와! 이건 정말 희귀한 물고기예요!",
                "낚시 실력이 대단하시네요!",
                "이런 건 쉽게 못 봅니다!"
            ],
            epic: [
                "믿을 수 없어! 정말 대단한 낚시예요!",
                "전설적인 순간입니다!",
                "이건 자랑할 만한 성과네요!"
            ],
            legendary: [
                "전설은 당신과 함께합니다!",
                "역사에 남을 낚시입니다!",
                "신화가 현실이 되는 순간!"
            ],
            mythic: [
                "신들도 놀랄 만한 낚시입니다!",
                "우주의 신비가 당신의 낚싯대에!",
                "이건... 정말 기적입니다!"
            ]
        };
        
        const rarityQuotes = quotes[rarity] || quotes.common;
        return rarityQuotes[Math.floor(Math.random() * rarityQuotes.length)];
    }
    
    // 물고기 이미지 URL 생성 (이모지 기반)
    getFishImage(rarity) {
        const images = {
            common: 'https://cdn.discordapp.com/attachments/1234567890/fish_common.png',
            uncommon: 'https://cdn.discordapp.com/attachments/1234567890/fish_uncommon.png',
            rare: 'https://cdn.discordapp.com/attachments/1234567890/fish_rare.png',
            epic: 'https://cdn.discordapp.com/attachments/1234567890/fish_epic.png',
            legendary: 'https://cdn.discordapp.com/attachments/1234567890/fish_legendary.png',
            mythic: 'https://cdn.discordapp.com/attachments/1234567890/fish_mythic.png'
        };
        
        // 실제 이미지가 없으므로 null 반환 (나중에 추가 가능)
        return null;
    }
    
    // 수집 보상 체크
    checkCollectionRewards(user) {
        const collectionCount = Array.isArray(user.fishing.collection) ? user.fishing.collection.length : 0;
        
        // 이미 받은 보상 체크
        if (!user.fishing.collectionRewardsClaimed) {
            user.fishing.collectionRewardsClaimed = [];
            user.markModified('fishing.collectionRewardsClaimed');
        }
        
        const rewards = [];
        let hasNewRewards = false;
        
        // 10종 - 강철 낚싯대 해금
        if (collectionCount >= 10 && !user.fishing.collectionRewardsClaimed.includes(10)) {
            if (!user.fishing.unlockedRods) user.fishing.unlockedRods = ['wooden'];
            if (!user.fishing.unlockedRods.includes('steel')) {
                user.fishing.unlockedRods.push('steel');
                rewards.push('🎣 강철 낚싯대가 해금되었습니다!');
                user.markModified('fishing.unlockedRods');
            }
            user.fishing.collectionRewardsClaimed.push(10);
            hasNewRewards = true;
        }
        
        // 20종 - 10,000,000G 보너스
        if (collectionCount >= 20 && !user.fishing.collectionRewardsClaimed.includes(20)) {
            user.gold = (user.gold || 0) + 10000000;
            rewards.push('💰 10,000,000G를 획득했습니다!');
            user.markModified('gold');
            user.fishing.collectionRewardsClaimed.push(20);
            hasNewRewards = true;
        }
        
        // 30종 - 티타늄 낚싯대 해금
        if (collectionCount >= 30 && !user.fishing.collectionRewardsClaimed.includes(30)) {
            if (!user.fishing.unlockedRods) user.fishing.unlockedRods = ['wooden'];
            if (!user.fishing.unlockedRods.includes('titanium')) {
                user.fishing.unlockedRods.push('titanium');
                rewards.push('🎣 티타늄 낚싯대가 해금되었습니다!');
                user.markModified('fishing.unlockedRods');
            }
            user.fishing.collectionRewardsClaimed.push(30);
            hasNewRewards = true;
        }
        
        // 40종 - 전설 미끼 10개
        if (collectionCount >= 40 && !user.fishing.collectionRewardsClaimed.includes(40)) {
            if (!user.fishing.baits) user.fishing.baits = {};
            user.fishing.baits.legendary = (user.fishing.baits.legendary || 0) + 10;
            rewards.push('💎 전설 미끼 10개를 획득했습니다!');
            user.markModified('fishing.baits');
            user.fishing.collectionRewardsClaimed.push(40);
            hasNewRewards = true;
        }
        
        // 50종 - 낚시왕 칭호
        if (collectionCount >= 50 && !user.fishing.collectionRewardsClaimed.includes(50)) {
            user.fishing.isFishingKing = true;
            rewards.push('🏆 낚시왕 칭호를 획득했습니다! (에픽 이하 물고기 판매가 10배)');
            user.markModified('fishing.isFishingKing');
            user.fishing.collectionRewardsClaimed.push(50);
            hasNewRewards = true;
        }
        
        // 보상을 받았다면 collectionRewardsClaimed 배열 변경 사항을 마크
        if (hasNewRewards) {
            user.markModified('fishing.collectionRewardsClaimed');
        }
        
        return rewards;
    }
    
    // 낚시권 재생성
    regenerateTickets(user) {
        if (!user.fishing.tickets) user.fishing.tickets = 0;
        if (!user.fishing.lastTicketRegen) user.fishing.lastTicketRegen = new Date();
        
        const now = new Date();
        const lastRegen = new Date(user.fishing.lastTicketRegen);
        const timeDiff = now - lastRegen;
        const thirtyMinutes = 30 * 60 * 1000; // 30분
        
        const ticketsToRegen = Math.floor(timeDiff / thirtyMinutes);
        
        if (ticketsToRegen > 0) {
            user.fishing.tickets = Math.min(20, user.fishing.tickets + ticketsToRegen);
            user.fishing.lastTicketRegen = new Date(lastRegen.getTime() + (ticketsToRegen * thirtyMinutes));
        }
    }
    
    // 낚시 실행
    async executeFishing(user, spotId, baitId) {
        const spot = FISHING_SYSTEM.fishingSpots[spotId];
        const bait = FISHING_SYSTEM.baits[baitId];
        
        if (!spot || !bait) {
            return { success: false, message: '잘못된 낚시터 또는 미끼입니다.' };
        }
        
        // collection 초기화 확인
        if (!Array.isArray(user.fishing.collection)) {
            user.fishing.collection = [];
        }
        
        // collectionRewardsClaimed 초기화 확인
        if (!user.fishing.collectionRewardsClaimed) {
            user.fishing.collectionRewardsClaimed = [];
            user.markModified('fishing.collectionRewardsClaimed');
        }
        
        // 낚시권 체크 및 재생성
        this.regenerateTickets(user);
        
        if (!user.fishing.tickets || user.fishing.tickets <= 0) {
            return { success: false, message: '낚시권이 부족합니다! (30분마다 1장씩 회복)' };
        }
        
        // 미끼 확인 및 초기화
        if (!user.fishing.baits) {
            user.fishing.baits = {
                worm: user.fishing.bait !== undefined ? user.fishing.bait : 10,
                shrimp: 0,
                bread: 0,
                lure: 0,
                glowing: user.fishing.specialBaits?.shiny || 0,
                golden: user.fishing.specialBaits?.giant || 0,
                legendary: user.fishing.specialBaits?.legendary || 0
            };
        }
        
        // 구 버전 필드가 있으면 삭제
        if (user.fishing.bait !== undefined) {
            delete user.fishing.bait;
        }
        if (user.fishing.specialBaits !== undefined) {
            delete user.fishing.specialBaits;
        }
        
        if (!user.fishing.baits[baitId] || user.fishing.baits[baitId] <= 0) {
            return { success: false, message: '미끼가 부족합니다!' };
        }
        
        // 인벤토리 확인
        if (!user.fishing.inventory || !Array.isArray(user.fishing.inventory)) {
            user.fishing.inventory = [];
        }
        
        // 기존 잘못된 데이터 정리
        user.fishing.inventory = user.fishing.inventory.filter(item => 
            item && item.fishId && item.caughtSpot
        );
        
        if (user.fishing.inventory.length >= FISHING_SYSTEM.settings.maxInventory) {
            return { success: false, message: '인벤토리가 가득 찼습니다!' };
        }
        
        // 미끼 소모
        user.fishing.baits[baitId]--;
        user.markModified('fishing.baits');
        
        // 낚시권 소모
        user.fishing.tickets--;
        user.markModified('fishing.tickets');
        
        // 물고기 결정
        const fishResult = this.determineFish(spot, user.fishing.rod, bait);
        
        // 인벤토리에 추가 (필수 필드 포함)
        user.fishing.inventory.push({
            fishId: fishResult.baseType,
            size: fishResult.size,
            quality: fishResult.rarity,
            caughtAt: new Date(),
            caughtSpot: spotId,
            estimatedPrice: fishResult.estimatedPrice
        });
        user.markModified('fishing.inventory');
        
        // 통계 업데이트
        user.fishing.stats.totalCaught++;
        user.fishing.exp += fishResult.expReward;
        user.markModified('fishing.stats');
        user.markModified('fishing.exp');
        
        // 레벨업 체크
        while (user.fishing.exp >= user.fishing.level * 100) {
            user.fishing.exp -= user.fishing.level * 100;
            user.fishing.level++;
            user.markModified('fishing.exp');
            user.markModified('fishing.level');
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
            user.markModified('fishing.stats.biggestCatch');
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
            user.markModified('fishing.stats.rarestCatch');
        }
        
        // 도감 등록 - 강제로 배열로 변환
        if (!Array.isArray(user.fishing.collection)) {
            // 기존 데이터가 있다면 백업
            const oldCollection = user.fishing.collection;
            user.fishing.collection = [];
            
            // 기존 데이터가 객체였다면 처리
            if (oldCollection && typeof oldCollection === 'object') {
                if (oldCollection.uniqueVariants && Array.isArray(oldCollection.uniqueVariants)) {
                    // 기존 uniqueVariants를 새로운 형식으로 변환
                    oldCollection.uniqueVariants.forEach(fishType => {
                        user.fishing.collection.push({
                            type: fishType,
                            firstCatch: {
                                name: fishType,
                                size: 0,
                                date: new Date()
                            },
                            bestCatch: {
                                name: fishType,
                                size: 0,
                                date: new Date()
                            }
                        });
                    });
                }
            }
        }
        
        // 물고기 종류만으로 도감 체크
        const existingFish = Array.isArray(user.fishing.collection) ? 
            user.fishing.collection.find(f => 
                (typeof f === 'string' && f === fishResult.baseType) || 
                (typeof f === 'object' && f.type === fishResult.baseType)
            ) : null;
        
        if (!existingFish) {
            // 새로운 물고기 종류 발견 - 첫 기록 저장
            // collection이 배열인지 다시 한번 확인
            if (!Array.isArray(user.fishing.collection)) {
                user.fishing.collection = [];
            }
            user.fishing.collection.push({
                type: fishResult.baseType,
                firstCatch: {
                    name: fishResult.name,
                    size: fishResult.size,
                    date: new Date()
                },
                bestCatch: {
                    name: fishResult.name,
                    size: fishResult.size,
                    date: new Date()
                }
            });
            user.markModified('fishing.collection');
        } else if (typeof existingFish === 'object' && existingFish.bestCatch && fishResult.size > existingFish.bestCatch.size) {
            // 기존 물고기의 최대 크기 갱신
            existingFish.bestCatch = {
                name: fishResult.name,
                size: fishResult.size,
                date: new Date()
            };
            user.markModified('fishing.collection');
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
        
        // 수집 보상 체크
        const collectionRewards = this.checkCollectionRewards(user);
        
        // 낚시 결과 임베드
        const catchMessages = {
            common: ['평범한 ', '흔한 ', '일반적인 '],
            uncommon: ['특별한 ', '반짝이는 ', '예쁜 '],
            rare: ['희귀한 ', '놀라운 ', '진귀한 '],
            epic: ['엄청난 ', '전설적인 ', '눈부신 '],
            legendary: ['신화의 ', '전설의 ', '불멸의 '],
            mythic: ['신들의 ', '천상의 ', '우주의 ']
        };
        
        const sizeMessages = {
            tiny: '🐟 아주 작은',
            small: '🐟 작은',
            normal: '🐟 보통 크기의',
            large: '🐠 큰',
            huge: '🐠 거대한',
            gigantic: '🐋 초거대'
        };
        
        const randomMessage = catchMessages[fishResult.rarity][Math.floor(Math.random() * catchMessages[fishResult.rarity].length)];
        
        const embed = new EmbedBuilder()
            .setTitle(`🎣 ${fishResult.rarity === 'mythic' ? '🌟 신화급 낚시 성공! 🌟' : fishResult.rarity === 'legendary' ? '⭐ 전설급 낚시 성공! ⭐' : '낚시 성공!'}`)
            .setColor(FISHING_SYSTEM.rarities[fishResult.rarity].color)
            .setDescription(`${user.nickname || '낚시꾼'}님이 ${randomMessage}**${fishResult.name}**을(를) 낚았습니다!\n\n*"${this.getFishQuote(fishResult.rarity)}"*`)
            .setThumbnail(this.getFishImage(fishResult.rarity))
            .addFields(
                {
                    name: `${FISHING_SYSTEM.rarities[fishResult.rarity].emoji} 희귀도`,
                    value: `${FISHING_SYSTEM.rarities[fishResult.rarity].name}`,
                    inline: true
                },
                {
                    name: '📏 크기',
                    value: `${fishResult.size}cm${fishResult.sizeGrade ? `\n${sizeMessages[fishResult.sizeGrade.grade] || ''} ${fishResult.sizeGrade.name || ''}` : ''}`,
                    inline: true
                },
                {
                    name: '💰 예상 가격',
                    value: `${fishResult.estimatedPrice.toLocaleString()}G`,
                    inline: true
                },
                {
                    name: '✨ 획득 보상',
                    value: `경험치 +${fishResult.expReward}\n${fishResult.rarity === 'legendary' || fishResult.rarity === 'mythic' ? '🎁 특별 보상 있음!' : ''}`,
                    inline: false
                }
            )
            .setFooter({ text: `🎫 낚시권: ${user.fishing.tickets}/20 | 📖 도감: ${Array.isArray(user.fishing.collection) ? user.fishing.collection.length : 0}/50 | 🎒 인벤토리: ${user.fishing.inventory.length}/${FISHING_SYSTEM.settings.maxInventory}` })
            .setTimestamp();
            
        
        // 모든 낚시 결과 공개 알림 (희귀도 무관)
        await this.sendPublicNotification(user, fishResult, spot);
        
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
        
        // 수집 보상 표시
        if (collectionRewards.length > 0) {
            embed.addFields({
                name: '🎊 수집 보상 획득!',
                value: collectionRewards.join('\n'),
                inline: false
            });
        }
        
        const components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`fishing_execute_${spotId}_${baitId}`)
                    .setLabel('🎣 다시 낚시하기')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.fishing.tickets <= 0 || user.fishing.baits[baitId] <= 0)
                    .setEmoji('🎣'),
                new ButtonBuilder()
                    .setCustomId('fishing_sell')
                    .setLabel('💰 물고기 판매')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(user.fishing.inventory.length === 0),
                new ButtonBuilder()
                    .setCustomId('fishing_inventory')
                    .setLabel('🎒 인벤토리')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('fishing_back')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            )
        ];
        
        // 유저 데이터 저장
        await user.save();
        
        return { success: true, embed, components };
    }
    
    // 물고기 결정
    determineFish(spot, rodId, bait) {
        // 희귀도 결정
        const rarity = this.determineRarity(spot, rodId, bait);
        
        // 물고기 종류 결정
        let fishData;
        let fishName;
        
        if (spot.fishTypes === 'special') {
            const fishNames = Object.keys(FISHING_SYSTEM.specialFishTypes);
            fishName = fishNames[Math.floor(Math.random() * fishNames.length)];
            fishData = FISHING_SYSTEM.specialFishTypes[fishName];
        } else if (spot.fishTypes === 'freshwater') {
            const fishNames = Object.keys(FISHING_SYSTEM.fishTypes.freshwater);
            fishName = fishNames[Math.floor(Math.random() * fishNames.length)];
            fishData = FISHING_SYSTEM.fishTypes.freshwater[fishName];
        } else {
            const fishNames = Object.keys(FISHING_SYSTEM.fishTypes.saltwater);
            fishName = fishNames[Math.floor(Math.random() * fishNames.length)];
            fishData = FISHING_SYSTEM.fishTypes.saltwater[fishName];
        }
        
        // 형용사 선택
        const adjectiveList = FISHING_SYSTEM.adjectives[rarity];
        const usePositive = Math.random() > 0.3;  // 70% 긍정적
        const adjectives = usePositive ? Object.keys(adjectiveList.positive) : Object.keys(adjectiveList.negative);
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const adjectiveData = usePositive ? adjectiveList.positive[adjective] : adjectiveList.negative[adjective];
        
        // 특수 접두사 확률 체크
        let prefix = '';
        let prefixMulti = 1;
        for (const [tier, data] of Object.entries(FISHING_SYSTEM.specialPrefixes)) {
            if (Math.random() < data.chance) {
                prefix = data.prefixes[Math.floor(Math.random() * data.prefixes.length)] + ' ';
                // 특수 접두사 보너스
                if (prefix.includes('왕의')) prefixMulti = 1.5;
                else if (prefix.includes('신이내린')) prefixMulti = 2.0;
                else if (prefix.includes('용왕의')) prefixMulti = 1.8;
                else if (prefix.includes('튀김용')) prefixMulti = 1.2;
                break;
            }
        }
        
        // 크기 결정 (형용사의 크기 영향 적용)
        const sizeMulti = adjectiveData.sizeMulti * (bait.bonus?.size || 1) * spot.sizeModifier;
        const baseSizePercent = Math.random() * sizeMulti;
        
        // 실제 크기 계산
        let actualSize;
        if (baseSizePercent <= 1.0) {
            // 일반 범위
            actualSize = fishData.minSize + (fishData.maxSize - fishData.minSize) * baseSizePercent;
        } else {
            // 대물 범위
            const megaPercent = Math.min((baseSizePercent - 1.0) / 2.0, 1.0);
            actualSize = fishData.maxSize + (fishData.megaSize - fishData.maxSize) * megaPercent;
        }
        
        actualSize = Math.floor(actualSize);
        
        // 크기 등급 결정
        const sizePercent = ((actualSize - fishData.minSize) / (fishData.megaSize - fishData.minSize)) * 100;
        let sizeGrade;
        for (const [grade, data] of Object.entries(FISHING_SYSTEM.sizeGrades)) {
            if (sizePercent >= data.percentRange[0] && sizePercent < data.percentRange[1]) {
                sizeGrade = { grade, ...data };
                break;
            }
        }
        
        if (!sizeGrade) {
            sizeGrade = { grade: 'medium', ...FISHING_SYSTEM.sizeGrades.medium };
        }
        
        // 최종 이름 생성
        const fullName = `${prefix}${adjective} ${fishName}`;
        
        // 가격 계산 (물고기 기본가 + 형용사 보너스) × 크기 배율 × 접두사 배율
        const finalPrice = Math.floor(
            (fishData.basePrice + adjectiveData.priceBonus) * sizeGrade.priceMultiplier * prefixMulti
        );
        
        // 경험치 계산
        const rarityExp = { 
            common: 100,
            uncommon: 250,
            rare: 500,
            epic: 1000,
            legendary: 2500,
            mythic: 5000
        };
        const expReward = rarityExp[rarity] + Math.floor(actualSize / 10);
        
        return {
            name: fullName,
            baseType: fishName,
            adjective: adjective,
            prefix: prefix.trim(),
            rarity: rarity,
            size: actualSize,
            sizeGrade: sizeGrade,
            sizePercent: Math.round(sizePercent),
            estimatedPrice: finalPrice,
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
        
        // 이모지 선택
        let titleEmoji = '🎣';
        if (fish.rarity === 'mythic') titleEmoji = '🌟';
        else if (fish.rarity === 'legendary') titleEmoji = '⭐';
        else if (fish.rarity === 'epic') titleEmoji = '💎';
        else if (fish.rarity === 'rare') titleEmoji = '✨';
        
        const embed = new EmbedBuilder()
            .setColor(rarityData.color)
            .setTitle(`${titleEmoji} ${user.nickname || user.username}님의 낚시!`)
            .setDescription(`${spot.name}에서 낚시 성공!`)
            .addFields(
                {
                    name: '🐟 잡은 물고기',
                    value: `**${fish.name}**`,
                    inline: false
                },
                {
                    name: '📊 상세 정보',
                    value: `${rarityData.emoji} ${rarityData.name} 등급\n📏 ${fish.size}cm (${fish.sizeGrade.emoji} ${fish.sizeGrade.name} - 상위 ${100 - fish.sizePercent}%)\n💰 ${fish.estimatedPrice.toLocaleString()}G`,
                    inline: true
                },
                {
                    name: '📈 크기 등급',
                    value: `${fish.sizeGrade.description}\n크기 배율: ×${fish.sizeGrade.priceMultiplier}`,
                    inline: true
                }
            )
            .setFooter({ text: `${spot.name} • ${new Date().toLocaleTimeString('ko-KR')}` })
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
        
        // 특정 채널로 전송
        try {
            const channel = this.client.channels.cache.get('1395135664164438106');
            if (channel && channel.isTextBased()) {
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('[낚시] 자랑 메시지 전송 실패:', error);
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
                const aRarity = a.quality || a.rarity || 'common';
                const bRarity = b.quality || b.rarity || 'common';
                return rarityOrder.indexOf(aRarity) - rarityOrder.indexOf(bRarity);
            });
            
            // 최대 25개만 표시
            const display = sorted.slice(0, 25);
            const { fishMarket } = require('./fishMarket');
            
            for (const [index, fish] of display.entries()) {
                const rarity = fish.quality || fish.rarity || 'common';
                const rarityData = FISHING_SYSTEM.rarities[rarity];
                
                // 가격 계산 - estimatedPrice가 없으면 시장 가격 계산
                let price = Number(fish.estimatedPrice) || 0;
                if (!price || price <= 0) {
                    const priceInfo = fishMarket.calculateSellPrice(fish, user);
                    price = priceInfo.finalPrice;
                }
                
                embed.addFields({
                    name: `${index + 1}. ${fish.fishId || fish.baseType || '알 수 없는 물고기'}`,
                    value: `${rarityData.emoji} ${fish.size || 30}cm | ${price.toLocaleString()}G`,
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
                value: `${(user.gold || 0).toLocaleString()}G`,
                inline: false
            });
            
        return embed;
    }
    
    // 낚싯대 상점
    createRodShopEmbed(user) {
        const embed = new EmbedBuilder()
            .setTitle('🎣 낚싯대 상점')
            .setColor('#f39c12')
            .addFields({
                name: '💰 보유 골드',
                value: `${(user.gold || 0).toLocaleString()}G`,
                inline: false
            });
            
        const collectionCount = Array.isArray(user.fishing.collection) ? user.fishing.collection.length : 0;
        
        for (const [rodId, rod] of Object.entries(FISHING_SYSTEM.fishingRods)) {
            const owned = user.fishing.rod === rodId;
            
            // 해금 조건 체크
            let unlocked = true;
            let unlockCondition = '';
            
            if (rodId === 'steel') {
                unlocked = collectionCount >= 10;
                unlockCondition = '도감 10종 수집';
            } else if (rodId === 'titanium') {
                unlocked = collectionCount >= 30;
                unlockCondition = '도감 30종 수집';
            } else if (rodId === 'carbon' || rodId === 'mithril' || rodId === 'dragon' || rodId === 'divine') {
                unlocked = false;
                unlockCondition = '향후 업데이트 예정';
            }
            
            const canBuy = user.gold >= rod.price && !owned && unlocked;
            
            let status = '';
            if (owned) status = '✅';
            else if (!unlocked) status = '🔒';
            
            embed.addFields({
                name: `${status} ${rod.name}`,
                value: `${rod.description}\n크기 보너스: ${rod.sizeBonus}x | 희귀도 보너스: ${rod.rarityBonus}x\n가격: ${rod.price.toLocaleString()}G${!unlocked ? `\n**해금 조건: ${unlockCondition}**` : ''}`,
                inline: false
            });
        }
        
        return embed;
    }
    
    // 미끼 상점
    createBaitShopEmbed(user) {
        const embed = new EmbedBuilder()
            .setTitle('🪱 미끼 상점')
            .setColor('#f39c12')
            .addFields({
                name: '💰 보유 골드',
                value: `${(user.gold || 0).toLocaleString()}G`,
                inline: false
            });
            
        if (!user.fishing.baits) {
            user.fishing.baits = {
                worm: 0,
                shrimp: 0,
                bread: 0,
                lure: 0,
                glowing: 0,
                golden: 0,
                legendary: 0
            };
        }
            
        for (const [baitId, bait] of Object.entries(FISHING_SYSTEM.baits)) {
            const owned = user.fishing.baits[baitId] || 0;
            
            embed.addFields({
                name: `${bait.name} (보유: ${owned}개)`,
                value: `${bait.description}\n효과: ${bait.effect}\n가격: ${bait.price}G/개 | 10개: ${bait.price * 10}G`,
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
        
        // 해금 조건 체크
        const collectionCount = Array.isArray(user.fishing.collection) ? user.fishing.collection.length : 0;
        
        if (rodId === 'steel' && collectionCount < 10) {
            return { success: false, message: '강철 낚싯대는 도감 10종 수집 시 해금됩니다.' };
        } else if (rodId === 'titanium' && collectionCount < 30) {
            return { success: false, message: '티타늄 낚싯대는 도감 30종 수집 시 해금됩니다.' };
        } else if (rodId === 'carbon' || rodId === 'mithril' || rodId === 'dragon' || rodId === 'divine') {
            return { success: false, message: '이 낚싯대는 아직 구매할 수 없습니다.' };
        }
        
        if (user.gold < rod.price) {
            return { success: false, message: '골드가 부족합니다.' };
        }
        
        user.gold -= rod.price;
        user.fishing.rod = rodId;
        
        // 유저 데이터 저장
        await user.save();
        
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
        
        // 유저 데이터 저장
        await user.save();
        
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
            const { fishMarket } = require('./fishMarket');
            
            for (const fish of user.fishing.inventory) {
                // 시장 가격 계산 사용
                const priceInfo = fishMarket.calculateSellPrice(fish, user);
                const price = priceInfo.finalPrice || 0;
                totalValue += price;
                const rarity = fish.quality || fish.rarity || 'common';
                rarityCount[rarity] = (rarityCount[rarity] || 0) + 1;
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
                    value: `${Math.floor(totalValue).toLocaleString()}G`,
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
                    .setDisabled(!user.fishing.inventory.some(f => (f.quality || f.rarity) === 'common')),
                new ButtonBuilder()
                    .setCustomId('fishing_sell_rare')
                    .setLabel('💎 희귀 이상만 판매')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!user.fishing.inventory.some(f => ['rare', 'epic', 'legendary', 'mythic'].includes(f.quality || f.rarity))),
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
        
        const { fishMarket } = require('./fishMarket');
        let itemsToSell = [];
        let totalGold = 0;
        let detailText = '';
        
        switch (action) {
            case 'all':
                itemsToSell = [...inventory];
                break;
            case 'common':
                itemsToSell = inventory.filter(f => (f.quality || f.rarity) === 'common');
                break;
            case 'rare':
                itemsToSell = inventory.filter(f => ['rare', 'epic', 'legendary', 'mythic'].includes(f.quality || f.rarity));
                break;
        }
        
        if (itemsToSell.length === 0) {
            return { success: false, message: '판매할 물고기가 없습니다!' };
        }
        
        // 각 물고기별 가격 계산
        const sellDetails = [];
        for (const fish of itemsToSell) {
            const priceInfo = fishMarket.calculateSellPrice(fish, user);
            totalGold += priceInfo.finalPrice;
            
            sellDetails.push({
                fish: fish,
                priceInfo: priceInfo
            });
        }
        
        // 판매 상세 정보 (최대 10개만 표시)
        const displayCount = Math.min(10, sellDetails.length);
        for (let i = 0; i < displayCount; i++) {
            const detail = sellDetails[i];
            const fishName = detail.fish.fishId || detail.fish.baseType || '알 수 없는 물고기';
            const basePrice = detail.priceInfo.basePrice || 0;
            
            detailText += `${fishName}: ${basePrice.toLocaleString()}G`;
            
            if (detail.priceInfo.marketMulti && detail.priceInfo.marketMulti !== 1.0) {
                detailText += ` × ${detail.priceInfo.marketMulti.toFixed(1)}`;
            }
            
            if (detail.priceInfo.appliedBuyers && detail.priceInfo.appliedBuyers.length > 0) {
                const buyer = detail.priceInfo.appliedBuyers[0];
                detailText += ` (${buyer.buyer})`;
            }
            
            detailText += ` = ${detail.priceInfo.finalPrice.toLocaleString()}G\n`;
        }
        
        if (sellDetails.length > displayCount) {
            detailText += `...외 ${sellDetails.length - displayCount}마리\n`;
        }
        
        // 판매 처리
        user.gold = (user.gold || 0) + totalGold;
        user.fishing.stats.totalEarned = (user.fishing.stats.totalEarned || 0) + totalGold;
        
        // 인벤토리에서 제거
        user.fishing.inventory = inventory.filter(f => !itemsToSell.includes(f));
        
        // 결과 임베드
        const embed = new EmbedBuilder()
            .setTitle('💰 판매 완료!')
            .setColor('#2ecc71')
            .setDescription(`${itemsToSell.length}마리의 물고기를 판매했습니다!`)
            .addFields(
                {
                    name: '📋 판매 내역',
                    value: detailText || '없음',
                    inline: false
                },
                {
                    name: '💵 총 판매 금액',
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
                    .setCustomId('fishing_market')
                    .setLabel('🏪 수산시장')
                    .setStyle(ButtonStyle.Primary),
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
        const collectionCount = Array.isArray(user.fishing.collection) ? user.fishing.collection.length : 0;
        
        for (const [rodId, rod] of Object.entries(FISHING_SYSTEM.fishingRods)) {
            const owned = user.fishing.rod === rodId;
            
            // 해금 조건 체크
            let unlocked = true;
            if (rodId === 'steel') {
                unlocked = collectionCount >= 10;
            } else if (rodId === 'titanium') {
                unlocked = collectionCount >= 30;
            } else if (rodId === 'carbon' || rodId === 'mithril' || rodId === 'dragon' || rodId === 'divine') {
                unlocked = false;
            }
            
            const canBuy = user.gold >= rod.price && !owned && unlocked;
            
            rodButtons.push(
                new ButtonBuilder()
                    .setCustomId(`fishing_buy_rod_${rodId}`)
                    .setLabel(owned ? `✅ ${rod.name}` : unlocked ? rod.name : `🔒 ${rod.name}`)
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
        // collection 배열 확인
        if (!Array.isArray(user.fishing.collection)) {
            user.fishing.collection = [];
        }
        
        const collectionCount = user.fishing.collection.length;
        
        const embed = new EmbedBuilder()
            .setTitle('📖 물고기 도감')
            .setColor('#3498db')
            .setDescription(`수집한 물고기 종류: ${collectionCount}/50`);
            
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
        
        for (const [category, fishData] of Object.entries(categories)) {
            let collected = 0;
            let text = '';
            
            // fishData가 객체인지 배열인지 확인
            const fishList = Array.isArray(fishData) ? fishData : Object.keys(fishData);
            
            for (const fishType of fishList) {
                let catchRecord = null;
                
                // collection이 배열인지 확인
                if (Array.isArray(user.fishing.collection)) {
                    catchRecord = user.fishing.collection.find(f => 
                        (typeof f === 'string' && f === fishType) || 
                        (typeof f === 'object' && f.type === fishType)
                    );
                }
                
                if (catchRecord) {
                    collected++;
                    if (typeof catchRecord === 'object' && catchRecord.bestCatch) {
                        text += `✅ ${fishType} - ${catchRecord.bestCatch.name} (${catchRecord.bestCatch.size}cm)\n`;
                    } else {
                        text += `✅ ${fishType}\n`;
                    }
                } else {
                    text += `❌ ???\n`;
                }
            }
            
            embed.addFields({
                name: `${category} (${collected}/${fishList.length})`,
                value: text.substring(0, 1024) || '없음',  // Discord 필드 제한
                inline: true
            });
        }
        
        // 수집 보상 정보
        const collectionRewards = [
            { count: 10, reward: '🎣 강철 낚싯대 해금' },
            { count: 20, reward: '💰 10,000,000G 보너스' },
            { count: 30, reward: '🎣 티타늄 낚싯대 해금' },
            { count: 40, reward: '💎 전설 미끼 10개' },
            { count: 50, reward: '🏆 낚시왕 칭호 (에픽 이하 판매가 10배)' }
        ];
        
        // 이미 받은 보상 확인
        const claimedRewards = user.fishing.collectionRewardsClaimed || [];
        
        let rewardText = '';
        for (const milestone of collectionRewards) {
            const achieved = collectionCount >= milestone.count;
            const claimed = claimedRewards.includes(milestone.count);
            
            // 도달했지만 아직 받지 않은 경우는 ⭐로 표시
            let icon = '⬜';
            if (claimed) icon = '✅';
            else if (achieved) icon = '⭐';
            
            rewardText += `${icon} ${milestone.count}종: ${milestone.reward}`;
            if (achieved && !claimed) {
                rewardText += ' (받을 수 있음!)';
            }
            rewardText += '\n';
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