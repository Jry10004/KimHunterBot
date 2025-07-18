const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { applyEnhanceBonus, applyGoldBonus } = require('../common/specialEffects');
const MissionHelper = require('../../utils/missionHelper');
const GAME_GIFS = require('../../data/gameGifs');

// 김헌터 계급 강화 시스템 설정
const ENHANCE_SYSTEM = {
    maxLevel: 30,
    rankNames: {
        0: '무계급',
        1: '신입 헌터',
        2: '견습 헌터',
        3: '초급 헌터',
        4: '중급 헌터',
        5: '상급 헌터',
        6: '숙련 헌터',
        7: '전문 헌터',
        8: '엘리트 헌터',
        9: '베테랑 헌터',
        10: '마스터 헌터',
        11: '그랜드마스터',
        12: '챔피언 헌터',
        13: '히어로 헌터',
        14: '레전드 헌터',
        15: '신화 헌터',
        16: '초월 헌터',
        17: '불멸 헌터',
        18: '천상 헌터',
        19: '신성 헌터',
        20: '우주 헌터',
        21: '차원 헌터',
        22: '시공 헌터',
        23: '무한 헌터',
        24: '창조 헌터',
        25: '파멸 헌터',
        26: '심판 헌터',
        27: '운명 헌터',
        28: '영원 헌터',
        29: '절대 헌터',
        30: '김헌터 신'
    },
    costs: {
        1: 1000,
        2: 2000,
        3: 5000,
        4: 8000,
        5: 10000,
        6: 15000,
        7: 20000,
        8: 30000,
        9: 50000,
        10: 80000,
        11: 120000,
        12: 180000,
        13: 250000,
        14: 350000,
        15: 500000,
        16: 700000,
        17: 1000000,
        18: 1500000,
        19: 2000000,
        20: 3000000,
        21: 4500000,
        22: 6000000,
        23: 8000000,
        24: 10000000,
        25: 15000000,
        26: 20000000,
        27: 30000000,
        28: 50000000,
        29: 80000000,
        30: 100000000
    },
    rates: {
        1: { success: 100, fail: 0, destroy: 0 },   // 95 → 100
        2: { success: 95, fail: 5, destroy: 0 },    // 90 → 95
        3: { success: 90, fail: 10, destroy: 0 },   // 85 → 90
        4: { success: 90, fail: 10, destroy: 0 },   // 85 → 90
        5: { success: 85, fail: 15, destroy: 0 },   // 80 → 85
        6: { success: 80, fail: 20, destroy: 0 },   // 75 → 80
        7: { success: 75, fail: 25, destroy: 0 },   // 70 → 75
        8: { success: 70, fail: 30, destroy: 0 },   // 65 → 70
        9: { success: 65, fail: 35, destroy: 0 },   // 60 → 65
        10: { success: 60, fail: 40, destroy: 0 },  // 55 → 60
        11: { success: 53, fail: 47, destroy: 0 },  // 50 → 53
        12: { success: 48, fail: 52, destroy: 0 },  // 45 → 48
        13: { success: 43, fail: 57, destroy: 0 },  // 40 → 43
        14: { success: 38, fail: 62, destroy: 0 },  // 35 → 38
        15: { success: 33, fail: 64.9, destroy: 2.1 },  // 30 → 33
        16: { success: 33, fail: 64.9, destroy: 2.1 },  // 30 → 33
        17: { success: 33, fail: 64.9, destroy: 2.1 },  // 30 → 33
        18: { success: 18, fail: 75.2, destroy: 6.8 },  // 15 → 18
        19: { success: 18, fail: 75.2, destroy: 6.8 },  // 15 → 18
        20: { success: 18, fail: 73.5, destroy: 8.5 },  // 15 → 18
        21: { success: 32, fail: 57.5, destroy: 10.5 }, // 30 → 32
        22: { success: 17, fail: 70.25, destroy: 12.75 }, // 15 → 17
        23: { success: 17, fail: 66, destroy: 17 },    // 15 → 17
        24: { success: 12, fail: 70, destroy: 18 },    // 10 → 12
        25: { success: 12, fail: 70, destroy: 18 },    // 10 → 12
        26: { success: 12, fail: 70, destroy: 18 },    // 10 → 12
        27: { success: 9, fail: 72.4, destroy: 18.6 }, // 7 → 9
        28: { success: 7, fail: 74, destroy: 19 },     // 5 → 7
        29: { success: 5, fail: 75.6, destroy: 19.4 }, // 3 → 5
        30: { success: 3, fail: 77.2, destroy: 19.8 }  // 1 → 3
    },
    // 계급별 스탯 증가율 (주 스탯 기준)
    statIncrease: {
        // 1~10계급: 주스탯 +5%, 부스탯 +2%
        tier1: { main: 0.05, sub: 0.02 },
        // 11~20계급: 주스탯 +8%, 부스탯 +3%
        tier2: { main: 0.08, sub: 0.03 },
        // 21~30계급: 주스탯 +12%, 부스탯 +5%
        tier3: { main: 0.12, sub: 0.05 }
    },
    // 아이템 타입별 주 스탯 정의 (클래스별 밸런스 고려)
    mainStatByType: {
        // 무기류 - 공격 중심
        weapon: ['attack', 'strength'],
        sword: ['attack', 'strength'],        // 전사용
        bow: ['attack', 'agility'],           // 궁수용
        staff: ['attack', 'intelligence'],    // 마법사용
        dagger: ['attack', 'agility'],        // 도적용
        
        // 방어구류 - 방어 중심 (특정 클래스 편중 방지)
        armor: ['defense'],                   // 단일 주스탯
        shield: ['defense'],                  // 단일 주스탯
        helmet: ['defense'],                  // 단일 주스탯
        
        // 특수 장비 - 유틸리티
        gloves: ['agility', 'strength'],      // 공격 속도/힘
        boots: ['agility', 'dodge'],          // 회피
        belt: ['hp', 'defense'],              // 생존력
        cloak: ['dodge', 'agility'],          // 회피 중심
        
        // 장신구류 - 보조 스탯
        accessory: ['luck'],                  // 단일 주스탯
        ring: ['intelligence', 'luck'],       // 지능/행운
        necklace: ['hp', 'strength'],         // 체력/힘
        earring: ['agility', 'intelligence']  // 민첩/지능
    },
    // 15성 이상 성공 멘트
    successMessages: {
        15: '🌟 전설의 경지! 15계급 달성!',
        16: '⚡ 초월의 시작! 16계급 돌파!',
        17: '🔥 불멸의 전사! 17계급 등극!',
        18: '💫 천상의 경지! 18계급 도달!',
        19: '✨ 신의 영역! 19계급 진입!',
        20: '🌌 우주의 힘! 20계급 달성!',
        21: '🌠 차원을 넘어! 21계급 돌파!',
        22: '⭐ 시공의 지배자! 22계급 등극!',
        23: '🌟 무한의 경지! 23계급 도달!',
        24: '💥 창조의 힘! 24계급 진입!',
        25: '🔆 파멸의 전설! 25계급 달성!',
        26: '⚔️ 심판자의 위엄! 26계급 돌파!',
        27: '🏆 운명의 개척자! 27계급 등극!',
        28: '👑 영원의 수호자! 28계급 도달!',
        29: '🎯 절대자의 경지! 29계급 진입!',
        30: '🌈 김헌터 신이 되다! 30계급 완성!'
    },
    // 15성 이상 하락 멘트
    failMessages: {
        30: '😢 신의 자리에서 추락... 29계급으로',
        29: '💔 절대의 힘을 잃다... 28계급으로',
        28: '😭 영원이 무너지다... 27계급으로',
        27: '😰 운명이 흔들리다... 26계급으로',
        26: '😥 심판의 자격 상실... 25계급으로',
        25: '😓 파멸의 끝자락... 24계급으로',
        24: '😞 창조력 감퇴... 23계급으로',
        23: '😔 무한이 유한으로... 22계급으로',
        22: '😟 시공간 균열... 21계급으로',
        21: '😫 차원 붕괴... 20계급으로',
        20: '😖 우주의 거부... 19계급으로',
        19: '😣 신성 상실... 18계급으로',
        18: '😩 천상에서 추방... 17계급으로',
        17: '😵 불멸이 흔들리다... 16계급으로',
        16: '😨 초월 실패... 15계급으로',
        15: '😱 전설이 무너지다... 14계급으로'
    },
    protectionItems: {
        'protection_stone': {
            name: '보호석',
            description: '파괴 시 계급이 0으로 초기화되지 않습니다',
            cost: 50000
        },
        'blessing_stone': {
            name: '축복석',
            description: '성공률이 10% 증가합니다',
            cost: 100000
        }
    }
};

// 강화 세션 관리
const enhanceSessions = new Map();

class EnhanceSystem {
    constructor() {
        this.sessions = enhanceSessions;
    }

    // 강화 메인 메뉴
    async showEnhanceMenu(interaction) {
        // interaction이 StringSelectMenu에서 온 경우 deferUpdate() 처리
        if (interaction.isStringSelectMenu() && !interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            const replyMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
            return await interaction[replyMethod]({ 
                content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
                flags: 64 
            });
        }

        // 강화 가능한 아이템 목록 (장착한 장비만)
        const enhanceableItems = this.getEnhanceableItems(user);

        if (enhanceableItems.length === 0) {
            const noItemEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚔️ 장착한 장비가 없습니다!')
                .setDescription('계급을 부여하려면 먼저 장비를 장착해야 합니다.\n\n📌 **장착한 장비만 계급 승급이 가능합니다**\n\n캐릭터 메뉴에서 장비를 장착한 후 다시 시도해주세요!')
                .setFooter({ text: '장비 장착: 메인메뉴 → 캐릭터 → 장비' });
            
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('shop')
                        .setLabel('🛒 상점으로 가기')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('main_menu')
                        .setLabel('🏠 메인 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            const response = interaction.deferred || interaction.replied 
                ? await interaction.editReply({ embeds: [noItemEmbed], components: [buttons], content: null })
                : await interaction.reply({ embeds: [noItemEmbed], components: [buttons], flags: 64 });
            
            return response;
        }

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎖️ 김헌터 계급 승급')
            .setDescription('📌 **장착한 장비만 계급 승급이 가능합니다**\n\n아이템에 김헌터 계급을 부여하여 더 강력하게 만드세요!')
            .addFields(
                { name: '💰 보유 골드', value: `${formatNumber(user.gold)}G`, inline: true },
                { name: '⚔️ 장착 장비', value: `${enhanceableItems.length}개`, inline: true }
            )
            .setFooter({ text: '승급할 장비를 선택하세요! (장착 중인 장비만 표시됩니다)' });

        // 슬롯 이름 한글 변환
        const slotNames = {
            weapon: '🗡️ 무기',
            armor: '🛡️ 갑옷',
            shield: '🛡️ 방패',
            helmet: '⛑️ 투구',
            gloves: '🧤 장갑',
            boots: '👢 신발',
            belt: '🎗️ 벨트',
            cloak: '🧥 망토',
            ring: '💍 반지',
            necklace: '📿 목걸이',
            earring: '💎 귀걸이',
            accessory: '🎀 장신구'
        };

        // 아이템 선택 메뉴
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('enhance_select_item')
            .setPlaceholder('강화할 장비를 선택하세요')
            .addOptions(
                enhanceableItems.slice(0, 25).map(item => {
                    const slotName = slotNames[item.equipmentSlot] || slotNames[item.type] || '장비';
                    const enhancement = item.enhanceLevel ? ` [${ENHANCE_SYSTEM.rankNames[item.enhanceLevel]}]` : ' [무계급]';
                    return {
                        label: `${slotName} - ${item.name}${enhancement}`,
                        description: `${item.rarity || '일반'} 등급`,
                        value: item._id ? item._id.toString() : `${item.inventoryIndex}_${Date.now()}`
                    };
                })
            );

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('enhance_shop')
                    .setLabel('🛒 강화 재료 상점')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('enhance_history')
                    .setLabel('📜 강화 기록')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        // 이미 응답된 인터랙션인 경우 update 사용
        if (interaction.replied || interaction.deferred) {
            return await interaction.editReply({
                embeds: [embed],
                components: [selectRow, buttonRow]
            });
        }
        
        return await interaction.reply({
            embeds: [embed],
            components: [selectRow, buttonRow]
        });
    }

    // 아이템 강화 상세
    async showEnhanceDetail(interaction, itemId) {
        const user = await getUser(interaction.user.id);
        let item = null;
        let itemInventoryIndex = -1;
        
        // itemId가 인덱스_타임스탬프 형식인 경우
        if (itemId.includes('_')) {
            const indexStr = itemId.split('_')[0];
            const index = parseInt(indexStr);
            if (!isNaN(index) && user.inventory[index]) {
                item = user.inventory[index];
                itemInventoryIndex = index;
            }
        }
        
        // MongoDB ID로 찾기
        if (!item) {
            const foundIndex = user.inventory.findIndex(i => 
                i._id && i._id.toString() === itemId
            );
            if (foundIndex !== -1) {
                item = user.inventory[foundIndex];
                itemInventoryIndex = foundIndex;
            }
        }

        if (!item) {
            return await interaction.reply({
                content: '❌ 아이템을 찾을 수 없습니다!',
                flags: 64
            });
        }
        
        // 장착 확인 (일반 장비와 악세사리 모두 확인)
        let isEquipped = false;
        let isAccessory = false;
        
        // 일반 장비 확인
        if (user.equipment) {
            isEquipped = Object.values(user.equipment).includes(itemInventoryIndex) ||
                        (item.inventorySlot !== undefined && 
                         Object.values(user.equipment).includes(item.inventorySlot));
        }
        
        // 악세사리 확인
        if (!isEquipped && user.equippedAccessories) {
            isEquipped = Object.values(user.equippedAccessories).some(acc => 
                acc && (acc.inventorySlot === itemInventoryIndex || 
                       (item.inventorySlot !== undefined && acc.inventorySlot === item.inventorySlot))
            );
            if (isEquipped) {
                isAccessory = true;
            }
        }
        
        if (!isEquipped) {
            return await interaction.reply({
                content: '❌ 장착하지 않은 장비는 강화할 수 없습니다!\n\n📌 캐릭터 메뉴에서 장비를 장착한 후 다시 시도해주세요.',
                flags: 64
            });
        }

        const currentLevel = item.enhanceLevel || 0;
        const nextLevel = currentLevel + 1;

        if (nextLevel > ENHANCE_SYSTEM.maxLevel) {
            return await interaction.reply({
                content: '❌ 이미 최대 강화 레벨입니다!',
                flags: 64
            });
        }

        const cost = ENHANCE_SYSTEM.costs[nextLevel] || 100000000; // 기본값 1억 골드
        const rateData = ENHANCE_SYSTEM.rates[nextLevel] || { success: 10, fail: 70, destroy: 20 }; // 기본 확률
        let baseRate = rateData.success;
        
        // 특수 효과 적용
        const enhancedRate = applyEnhanceBonus(baseRate, user);
        const failRate = rateData.fail;
        const destroyRate = rateData.destroy;

        // 구간 정보
        let zoneInfo = '';
        let zoneColor = '#00FF00';
        if (currentLevel < 5) {
            zoneInfo = '🟢 매우 안전한 구간';
        } else if (currentLevel < 10) {
            zoneInfo = '🔵 안전한 구간';
            zoneColor = '#0099FF';
        } else if (currentLevel < 14) {
            zoneInfo = '🟡 파괴 없는 마지막 구간';
            zoneColor = '#FFD700';
        } else if (currentLevel < 20) {
            zoneInfo = '🟠 파괴 위험 구간';
            zoneColor = '#FF8C00';
        } else if (currentLevel < 25) {
            zoneInfo = '🔴 고위험 구간';
            zoneColor = '#FF0000';
        } else {
            zoneInfo = '💀 극한 도전 구간';
            zoneColor = '#8B0000';
        }

        const embed = new EmbedBuilder()
            .setColor(zoneColor)
            .setTitle(`🎖️ ${item.name} 계급 승급`)
            .setDescription(`현재 계급: **${ENHANCE_SYSTEM.rankNames[currentLevel]}** → **${ENHANCE_SYSTEM.rankNames[nextLevel]}**\n${zoneInfo}`)
            .addFields(
                { name: '💰 승급 비용', value: `${formatNumber(cost)}G`, inline: true },
                { name: '✅ 성공 확률', value: `${enhancedRate}%`, inline: true },
                { name: '❌ 실패 확률', value: `${failRate}%`, inline: true }
            );

        if (destroyRate > 0) {
            embed.addFields({ name: '💥 파괴 확률', value: `${destroyRate}%`, inline: true });
        }

        embed.addFields({ name: '💎 보유 골드', value: `${formatNumber(user.gold)}G`, inline: true });
        
        // 확률표 표시
        let rateTable = '```\n계급 | 성공 | 실패 | 파괴\n';
        rateTable += '─────┼──────┼──────┼──────\n';
        
        // 현재 레벨 주변의 확률 표시 (위아래 5개씩)
        const startLevel = Math.max(1, nextLevel - 5);
        const endLevel = Math.min(30, nextLevel + 5);
        
        for (let i = startLevel; i <= endLevel; i++) {
            const rate = ENHANCE_SYSTEM.rates[i];
            if (rate) {
                const current = i === nextLevel ? '▶ ' : '  ';
                const levelStr = i.toString().padStart(2);
                const successStr = rate.success.toString().padStart(4);
                const failStr = rate.fail.toString().padStart(4);
                const destroyStr = rate.destroy.toString().padStart(4);
                rateTable += `${current}${levelStr}계급│${successStr}% │${failStr}% │${destroyStr}%\n`;
            }
        }
        rateTable += '```';
        
        embed.addFields({
            name: '📈 계급 승급 확률표',
            value: rateTable,
            inline: false
        });

        // 현재 스탯 및 예상 증가량 표시
        if (item.stats || item.baseStats) {
            const currentStats = [];
            const expectedStats = [];
            const itemType = item.type || item.category || 'weapon';
            const mainStats = ENHANCE_SYSTEM.mainStatByType[itemType] || ['attack'];
            
            // 현재 계급의 증가율 결정
            let increaseRate;
            if (nextLevel <= 10) {
                increaseRate = ENHANCE_SYSTEM.statIncrease.tier1;
            } else if (nextLevel <= 20) {
                increaseRate = ENHANCE_SYSTEM.statIncrease.tier2;
            } else {
                increaseRate = ENHANCE_SYSTEM.statIncrease.tier3;
            }
            
            // baseStats가 있으면 우선 사용, 없으면 stats 사용
            const statsToShow = item.baseStats || item.stats || {};
            
            // 모든 스탯 수집 (stats와 baseStats 모두 확인)
            const allStatKeys = new Set();
            if (item.stats) Object.keys(item.stats).forEach(key => allStatKeys.add(key));
            if (item.baseStats) Object.keys(item.baseStats).forEach(key => allStatKeys.add(key));
            
            // 스탯이 없는 경우 로그
            if (allStatKeys.size === 0) {
                console.log(`[강화] 아이템에 스탯이 없음:`, item.name, 'stats:', item.stats, 'baseStats:', item.baseStats);
                
                // 아이템의 모든 속성 확인
                console.log(`[강화] 아이템 전체 데이터:`, JSON.stringify(item, null, 2));
            }
            
            allStatKeys.forEach(stat => {
                const currentValue = item.stats?.[stat] || item.baseStats?.[stat] || 0;
                const baseValue = item.baseStats?.[stat] || currentValue;
                
                if (currentValue > 0 || baseValue > 0) {
                    const isMainStat = mainStats.includes(stat);
                    const rate = isMainStat ? increaseRate.main : increaseRate.sub;
                    const increase = Math.ceil(currentValue * rate);
                    const nextValue = currentValue + increase;
                    
                    const statName = this.getStatKorean(stat, user);
                    const percentage = (rate * 100).toFixed(0);
                    
                    // 현재 스탯 표시
                    currentStats.push(`${isMainStat ? '⭐' : '☆'} ${statName}: ${currentValue}`);
                    
                    // 예상 증가량 표시
                    expectedStats.push(`${isMainStat ? '⭐' : '☆'} ${statName}: ${currentValue} → **${nextValue}** (+${increase}, +${percentage}%)`);
                }
            });
            
            if (currentStats.length > 0) {
                embed.addFields({
                    name: '📊 현재 스탯',
                    value: currentStats.join('\n'),
                    inline: true
                });
            }
            
            if (expectedStats.length > 0) {
                embed.addFields({
                    name: '📈 계급 승급 시 예상 스탯',
                    value: expectedStats.join('\n') + '\n\n⭐ 주 스탯 | ☆ 부 스탯',
                    inline: true
                });
            }
        }

        // 비용 검증
        if (!cost || cost <= 0) {
            console.error('[강화 오류] 계산된 강화 비용이 0원 또는 정의되지 않음:', cost, 'nextLevel:', nextLevel);
            return await interaction.reply({
                content: '❌ 강화 비용 계산 오류가 발생했습니다. 관리자에게 문의해주세요.',
                flags: 64
            });
        }

        // 세션 저장
        const sessionId = `${user.discordId}-${Date.now()}`;
        this.sessions.set(sessionId, {
            userId: user.discordId,
            itemId: itemId,
            itemInventoryIndex: itemInventoryIndex,
            item: { ...item, isAccessory: isAccessory },
            cost: cost,
            successRate: enhancedRate,
            useProtection: false,
            useBlessing: false
        });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`enhance_confirm_${sessionId}`)
                    .setLabel('🎖️ 계급 승급')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.gold < cost),
                new ButtonBuilder()
                    .setCustomId(`enhance_protection_${sessionId}`)
                    .setLabel('🛡️ 보호석 사용')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!this.hasProtectionStone(user)),
                new ButtonBuilder()
                    .setCustomId(`enhance_blessing_${sessionId}`)
                    .setLabel('✨ 강화석 사용')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!this.hasBlessingStone(user)),
                new ButtonBuilder()
                    .setCustomId('enhance_menu')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        // defer가 이미 되어있는지 확인
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });
        } else {
            return await interaction.reply({
                embeds: [embed],
                components: [buttons],
                flags: 64
            });
        }
    }

    // 강화 실행
    async performEnhance(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.userId !== interaction.user.id) {
            return await interaction.followUp({
                content: '❌ 유효하지 않은 강화 세션입니다!',
                flags: 64
            });
        }

        // 쿨타임 체크 (3초)
        const cooldownKey = `enhance_cooldown_${interaction.user.id}`;
        const lastEnhance = this.sessions.get(cooldownKey);
        const now = Date.now();
        
        if (lastEnhance && (now - lastEnhance) < 3000) {
            const remainingTime = Math.ceil((3000 - (now - lastEnhance)) / 1000);
            return await interaction.followUp({
                content: `⏱️ 강화 쿨타임 중입니다! ${remainingTime}초 후에 다시 시도해주세요.`,
                flags: 64
            });
        }

        // 쿨타임 설정
        this.sessions.set(cooldownKey, now);

        // 세션 데이터 복사 (삭제 전에)
        const sessionData = { ...session };

        // 중복 실행 방지를 위한 세션 즉시 삭제
        this.sessions.delete(sessionId);

        const user = await getUser(interaction.user.id);
        let item = null;
        
        // 세션에 저장된 인벤토리 인덱스 사용
        if (sessionData.itemInventoryIndex !== undefined && sessionData.itemInventoryIndex !== -1) {
            item = user.inventory[sessionData.itemInventoryIndex];
        }
        
        // 인덱스로 못 찾으면 다른 방법 시도
        if (!item) {
            item = user.inventory.find(i => 
                (i._id && i._id.toString() === sessionData.itemId) || 
                (i.name === sessionData.item.name)
            );
        }

        if (!item) {
            return await interaction.followUp({
                content: '❌ 아이템을 찾을 수 없습니다!',
                flags: 64
            });
        }
        
        // 장착 확인 (일반 장비와 악세사리 모두 확인)
        const itemIndex = user.inventory.indexOf(item);
        let isEquipped = false;
        let isAccessory = sessionData.item.isAccessory || false;
        
        // 일반 장비 확인
        if (!isAccessory && user.equipment) {
            isEquipped = Object.values(user.equipment).includes(itemIndex) ||
                        (item.inventorySlot !== undefined && 
                         Object.values(user.equipment).includes(item.inventorySlot));
        }
        
        // 악세사리 확인
        if (!isEquipped && user.equippedAccessories) {
            isEquipped = Object.values(user.equippedAccessories).some(acc => 
                acc && (acc.inventorySlot === itemIndex || 
                       (item.inventorySlot !== undefined && acc.inventorySlot === item.inventorySlot))
            );
        }
        
        if (!isEquipped) {
            return await interaction.followUp({
                content: '❌ 장착하지 않은 장비는 강화할 수 없습니다!',
                flags: 64
            });
        }

        // 비용 검증
        if (!sessionData.cost || sessionData.cost <= 0) {
            console.error('[강화 오류] 강화 비용이 0원 또는 정의되지 않음:', sessionData.cost);
            return await interaction.followUp({
                content: '❌ 강화 비용 오류가 발생했습니다. 다시 시도해주세요.',
                flags: 64
            });
        }

        if (user.gold < sessionData.cost) {
            return await interaction.followUp({
                content: '❌ 골드가 부족합니다!',
                flags: 64
            });
        }

        // 골드 차감
        user.gold -= sessionData.cost;

        // 강화 재료 사용
        if (sessionData.useProtection) {
            this.consumeProtectionStone(user);
        }
        if (sessionData.useBlessing) {
            // 사용할 축복석 찾기
            const blessingStone = user.inventory.find(item => 
                (item.id === 'blessing_stone' || item.id === 'enhancement_stone' || 
                 item.id === 'basic_enhancement_stone' || item.id === 'advanced_enhancement_stone' || 
                 item.id === 'perfect_enhancement_stone') && item.quantity > 0
            );
            
            // 강화석 종류에 따른 성공률 증가
            let successBonus = 10; // 기본값
            if (blessingStone) {
                switch(blessingStone.id) {
                    case 'basic_enhancement_stone':
                        successBonus = 5;
                        break;
                    case 'advanced_enhancement_stone':
                        successBonus = 10;
                        break;
                    case 'perfect_enhancement_stone':
                        successBonus = 20;
                        break;
                    default:
                        successBonus = 10;
                }
            }
            
            this.consumeBlessingStone(user);
            sessionData.successRate = Math.min(100, sessionData.successRate + successBonus);
        }

        // 강화 시도
        const currentLevel = item.enhanceLevel || 0;
        const rateData = ENHANCE_SYSTEM.rates[currentLevel + 1];
        const roll = Math.random() * 100;

        let resultEmbed;
        let result = 'fail'; // success, fail, destroy
        
        if (roll < sessionData.successRate) {
            result = 'success';
        } else if (roll < (sessionData.successRate + rateData.fail)) {
            result = 'fail';
        } else {
            result = 'destroy';
        }

        if (result === 'success') {
            // 계급 승급 성공
            // 중복 강화 방지를 위한 재확인
            const actualCurrentLevel = item.enhanceLevel || 0;
            if (actualCurrentLevel !== currentLevel) {
                console.error('[강화 버그] 강화 도중 레벨 불일치 감지:', {
                    expected: currentLevel,
                    actual: actualCurrentLevel,
                    item: item.name
                });
                return await interaction.followUp({
                    content: '❌ 강화 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
                    flags: 64
                });
            }
            item.enhanceLevel = currentLevel + 1;
            
            // 악세사리인 경우 equippedAccessories도 업데이트
            if (sessionData.item.isAccessory && user.equippedAccessories) {
                const accessorySlot = Object.entries(user.equippedAccessories).find(
                    ([slot, acc]) => acc && acc.inventorySlot === sessionData.itemInventoryIndex
                );
                if (accessorySlot) {
                    user.equippedAccessories[accessorySlot[0]].enhanceLevel = item.enhanceLevel;
                }
            }
            
            // 스탯 증가
            if (!item.stats) item.stats = {};
            
            const itemType = item.type || item.category || 'weapon';
            const mainStats = ENHANCE_SYSTEM.mainStatByType[itemType] || ['attack'];
            
            // 현재 계급의 증가율 결정
            let increaseRate;
            if (item.enhanceLevel <= 10) {
                increaseRate = ENHANCE_SYSTEM.statIncrease.tier1;
            } else if (item.enhanceLevel <= 20) {
                increaseRate = ENHANCE_SYSTEM.statIncrease.tier2;
            } else {
                increaseRate = ENHANCE_SYSTEM.statIncrease.tier3;
            }
            
            // 기본 스탯 저장 (baseStats가 없는 경우)
            if (!item.baseStats) {
                if (item.stats) {
                    // 강화가 안된 아이템은 현재 스탯이 원본
                    if (currentLevel === 0) {
                        item.baseStats = { ...item.stats };
                    } else {
                        // 이미 강화된 아이템이면 역산해서 원본 구하기
                        item.baseStats = {};
                        Object.keys(item.stats).forEach(stat => {
                            if (item.stats[stat] > 0) {
                                const isMainStat = mainStats.includes(stat);
                                
                                // 현재 레벨까지의 누적 증가율 계산 (복리 방식)
                                let totalMultiplier = 1;
                                for (let level = 1; level <= currentLevel; level++) {
                                    let levelRate;
                                    if (level <= 10) {
                                        levelRate = ENHANCE_SYSTEM.statIncrease.tier1;
                                    } else if (level <= 20) {
                                        levelRate = ENHANCE_SYSTEM.statIncrease.tier2;
                                    } else {
                                        levelRate = ENHANCE_SYSTEM.statIncrease.tier3;
                                    }
                                    const rate = isMainStat ? levelRate.main : levelRate.sub;
                                    totalMultiplier *= (1 + rate);
                                }
                                
                                // 역산하여 원본 스탯 구하기
                                item.baseStats[stat] = Math.round(item.stats[stat] / totalMultiplier);
                            }
                        });
                    }
                } else {
                    // stats가 없으면 빈 객체로 초기화
                    item.baseStats = {};
                    item.stats = {};
                }
            }
            
            // 강화 전 스탯 저장 (비교용)
            const previousStats = {};
            if (item.stats) {
                Object.keys(item.stats).forEach(stat => {
                    previousStats[stat] = item.stats[stat];
                });
            }
            
            // stats 객체가 없으면 생성
            if (!item.stats) {
                item.stats = {};
            }
            
            // 각 스탯은 baseStats 기준으로 재계산
            if (item.baseStats) {
                // 모든 스탯 키 수집 (baseStats와 현재 stats 모두에서)
                const allStatKeys = new Set([
                    ...Object.keys(item.baseStats),
                    ...Object.keys(item.stats)
                ]);
                
                allStatKeys.forEach(stat => {
                    const baseValue = item.baseStats[stat] || 0;
                    if (baseValue > 0) {
                        const isMainStat = mainStats.includes(stat);
                        
                        // 1~현재 레벨까지의 누적 증가율 계산 (복리 방식)
                        let totalMultiplier = 1;
                        for (let level = 1; level <= item.enhanceLevel; level++) {
                            let levelRate;
                            if (level <= 10) {
                                levelRate = ENHANCE_SYSTEM.statIncrease.tier1;
                            } else if (level <= 20) {
                                levelRate = ENHANCE_SYSTEM.statIncrease.tier2;
                            } else {
                                levelRate = ENHANCE_SYSTEM.statIncrease.tier3;
                            }
                            const rate = isMainStat ? levelRate.main : levelRate.sub;
                            totalMultiplier *= (1 + rate);
                        }
                        
                        // 기본 스탯 * 누적 배율로 현재 스탯 계산
                        item.stats[stat] = Math.ceil(baseValue * totalMultiplier);
                    }
                });
            }

            // 강화 기록 저장
            if (!user.enhanceHistory) user.enhanceHistory = [];
            user.enhanceHistory.push({
                itemName: item.name,
                level: item.enhanceLevel,
                success: true,
                date: new Date()
            });
            
            // 미션 진행도 업데이트 (성공)
            await MissionHelper.updateEnhanceTry(interaction.user.id, true);

            // 라이프 시스템 뉴스 연동
            const lifeSystem = require('../../systems/lifeSystemIntegration');
            lifeSystem.reportEnhancement(user, item, item.enhanceLevel, true);

            // 증가한 스탯 표시
            let statChanges = [];
            if (item.stats) {
                const itemType = item.type || item.category || 'weapon';
                const mainStats = ENHANCE_SYSTEM.mainStatByType[itemType] || ['attack'];
                
                // 마법사 엠블럼 확인
                const isMage = user && user.emblem && (
                    user.emblem === '견습 마법사' || 
                    user.emblem === '원소 술사' ||
                    user.emblem === '신비한 현자' ||
                    user.emblem === '대마법사' ||
                    user.emblem === '전설의 아크메이지' ||
                    user.emblem.includes('마법사') ||
                    user.emblem.includes('아크메이지')
                );
                
                // 모든 스탯 수집 (stats와 baseStats에서)
                const allStatKeys = new Set([
                    ...Object.keys(item.stats),
                    ...(item.baseStats ? Object.keys(item.baseStats) : [])
                ]);
                
                allStatKeys.forEach(stat => {
                    const currValue = item.stats[stat] || 0;
                    if (currValue > 0) {
                        const isMainStat = mainStats.includes(stat);
                        const statName = this.getStatKorean(stat, user);
                        
                        // 강화 전후 비교 표시
                        const prevValue = previousStats[stat] || 0;
                        const increase = currValue - prevValue;
                        
                        if (increase > 0) {
                            statChanges.push(`${statName}: ${prevValue} → **${currValue}** (+${increase}) ${isMainStat ? '✨' : ''}`);
                        } else if (currValue > 0) {
                            statChanges.push(`${statName}: ${currValue} ${isMainStat ? '✨' : ''}`);
                        }
                    }
                });
            }
            
            // 15성 이상 특별 멘트
            const specialMessage = ENHANCE_SYSTEM.successMessages[item.enhanceLevel] || '';
            
            resultEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎊 계급 승급 성공!')
                .setDescription(`${item.name}이(가) **${ENHANCE_SYSTEM.rankNames[item.enhanceLevel]}** 계급으로 승급했습니다!\n${specialMessage}`)
                .setImage(GAME_GIFS.enhancement.success)
                .addFields(
                    { name: '🎖️ 계급 변화', value: `${ENHANCE_SYSTEM.rankNames[currentLevel]} → ${ENHANCE_SYSTEM.rankNames[item.enhanceLevel]}`, inline: true },
                    { name: '💰 사용 골드', value: `${formatNumber(sessionData.cost)}G`, inline: true },
                    { name: '💳 남은 골드', value: `${formatNumber(user.gold)}G`, inline: true }
                );
                
            if (statChanges.length > 0) {
                resultEmbed.addFields({
                    name: '📊 스탯 현황',
                    value: statChanges.join('\n'),
                    inline: false
                });
            }
            
            // 15성 이상 시 다음 강화 확률 표시
            if (item.enhanceLevel >= 14 && item.enhanceLevel < 30) {
                const nextLevel = item.enhanceLevel + 1;
                const nextRate = ENHANCE_SYSTEM.rates[nextLevel];
                resultEmbed.addFields({
                    name: `📈 다음 강화 확률 (${nextLevel}계급)`,
                    value: `성공: ${nextRate.success}% | 실패: ${nextRate.fail}% | 파괴: ${nextRate.destroy}%`,
                    inline: false
                });
            }
            

        } else if (result === 'fail') {
            // 계급 승급 실패
            if (currentLevel > 0 && currentLevel < 15) {
                // 15계급 미만에서는 계급 하락 가능
                item.enhanceLevel = Math.max(0, currentLevel - 1);
                
                // 악세사리인 경우 equippedAccessories도 업데이트
                if (sessionData.item.isAccessory && user.equippedAccessories) {
                    const accessorySlot = Object.entries(user.equippedAccessories).find(
                        ([slot, acc]) => acc && acc.inventorySlot === sessionData.itemInventoryIndex
                    );
                    if (accessorySlot) {
                        user.equippedAccessories[accessorySlot[0]].enhanceLevel = item.enhanceLevel;
                    }
                }
                
                // 스탯 감소 (baseStats 기준으로 재계산)
                if (item.baseStats && item.stats) {
                    const itemType = item.type || item.category || 'weapon';
                    const mainStats = ENHANCE_SYSTEM.mainStatByType[itemType] || ['attack'];
                    
                    // 하락한 레벨(item.enhanceLevel)로 스탯 재계산
                    Object.keys(item.baseStats).forEach(stat => {
                        const baseValue = item.baseStats[stat] || 0;
                        if (baseValue > 0) {
                            const isMainStat = mainStats.includes(stat);
                            
                            // 1~하락한 레벨까지의 누적 증가율 계산 (복리 방식)
                            let totalMultiplier = 1;
                            for (let level = 1; level <= item.enhanceLevel; level++) {
                                let levelRate;
                                if (level <= 10) {
                                    levelRate = ENHANCE_SYSTEM.statIncrease.tier1;
                                } else if (level <= 20) {
                                    levelRate = ENHANCE_SYSTEM.statIncrease.tier2;
                                } else {
                                    levelRate = ENHANCE_SYSTEM.statIncrease.tier3;
                                }
                                const rate = isMainStat ? levelRate.main : levelRate.sub;
                                totalMultiplier *= (1 + rate);
                            }
                            
                            // 기본 스탯 * 누적 배율로 현재 스탯 계산
                            item.stats[stat] = Math.ceil(baseValue * totalMultiplier);
                        }
                    });
                }
                
                // 15성 이상 하락 멘트
                const failMessage = ENHANCE_SYSTEM.failMessages[currentLevel] || '';
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ 계급 승급 실패')
                    .setDescription(`계급 승급에 실패하여 계급이 하락했습니다.\n${failMessage}`)
                    .setImage(GAME_GIFS.enhancement.failure)
                    .addFields(
                        { name: '📉 계급 변화', value: `${ENHANCE_SYSTEM.rankNames[currentLevel]} → ${ENHANCE_SYSTEM.rankNames[item.enhanceLevel]}`, inline: true },
                        { name: '💰 사용 골드', value: `${formatNumber(sessionData.cost)}G`, inline: true },
                        { name: '💳 남은 골드', value: `${formatNumber(user.gold)}G`, inline: true }
                    );
                    
                // 15성 이상 시 다음 강화 확률 표시
                if (item.enhanceLevel >= 14 && item.enhanceLevel < 30) {
                    const nextLevel = item.enhanceLevel + 1;
                    const nextRate = ENHANCE_SYSTEM.rates[nextLevel];
                    resultEmbed.addFields({
                        name: `📈 다음 강화 확률 (${nextLevel}계급)`,
                        value: `성공: ${nextRate.success}% | 실패: ${nextRate.fail}% | 파괴: ${nextRate.destroy}%`,
                        inline: false
                    });
                }
            } else {
                // 15계급 이상은 계급 유지
                resultEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('❌ 계급 승급 실패')
                    .setDescription('계급 승급에 실패했지만 계급은 유지됩니다.')
                    .setImage(GAME_GIFS.enhancement.failure)
                    .addFields(
                        { name: '🎖️ 현재 계급', value: ENHANCE_SYSTEM.rankNames[currentLevel], inline: true },
                        { name: '💰 사용 골드', value: `${formatNumber(sessionData.cost)}G`, inline: true },
                        { name: '💳 남은 골드', value: `${formatNumber(user.gold)}G`, inline: true }
                    );
            }
        } else {
            // 파괴
            if (sessionData.useProtection) {
                // 보호석 사용 - 아이템 보호
                resultEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('💔 아이템 보호됨!')
                    .setDescription('아이템이 파괴될 뻔했지만 보호석으로 보호되었습니다.')
                    .addFields(
                        { name: '🛡️ 아이템 상태', value: '보호됨', inline: true },
                        { name: '🎖️ 현재 계급', value: ENHANCE_SYSTEM.rankNames[currentLevel], inline: true },
                        { name: '💰 사용 골드', value: `${formatNumber(sessionData.cost)}G`, inline: true },
                        { name: '💳 남은 골드', value: `${formatNumber(user.gold)}G`, inline: true }
                    );
            } else {
                // 아이템 파괴 - 0강으로 초기화
                item.enhanceLevel = 0;
                
                // 스탯을 원본으로 복원
                if (item.baseStats) {
                    item.stats = { ...item.baseStats };
                }
                
                // 악세사리인 경우 equippedAccessories도 업데이트
                if (sessionData.item.isAccessory && user.equippedAccessories) {
                    const accessorySlot = Object.entries(user.equippedAccessories).find(
                        ([slot, acc]) => acc && acc.inventorySlot === sessionData.itemInventoryIndex
                    );
                    if (accessorySlot) {
                        user.equippedAccessories[accessorySlot[0]].enhanceLevel = 0;
                        if (item.baseStats) {
                            user.equippedAccessories[accessorySlot[0]].stats = { ...item.baseStats };
                        }
                    }
                }
                
                // 라이프 시스템 뉴스 연동 - 파괴
                const lifeSystem = require('../../systems/lifeSystemIntegration');
                lifeSystem.reportEnhancement(user, sessionData.item, currentLevel + 1, false);

                resultEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('💥 계급 초기화!')
                    .setDescription(`${sessionData.item.name}의 계급이 완전히 초기화되었습니다...`)
                    .setImage(GAME_GIFS.enhancement.destroy)
                    .addFields(
                        { name: '💔 결과', value: `${ENHANCE_SYSTEM.rankNames[currentLevel]} → ${ENHANCE_SYSTEM.rankNames[0]}`, inline: true },
                        { name: '🎖️ 현재 계급', value: ENHANCE_SYSTEM.rankNames[0], inline: true },
                        { name: '💰 사용 골드', value: `${formatNumber(sessionData.cost)}G`, inline: true },
                        { name: '💳 남은 골드', value: `${formatNumber(user.gold)}G`, inline: true }
                    )
                    .setFooter({ text: '파괴 시 계급이 무계급으로 돌아갑니다!' });
            }
        }

        // 실패/파괴인 경우에만 실패 기록 추가
        if (result !== 'success') {
            if (!user.enhanceHistory) user.enhanceHistory = [];
            user.enhanceHistory.push({
                itemName: item.name,
                level: currentLevel,
                success: false,
                date: new Date()
            });
            
            // 미션 진행도 업데이트 (실패)
            await MissionHelper.updateEnhanceTry(interaction.user.id, false);
        }

        // 전투력 재계산
        const { calculateCombatPower } = require('../common/combatPower');
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
        
        let buttons;
        if (result === 'success' && item.enhanceLevel < ENHANCE_SYSTEM.maxLevel) {
            // 강화 성공 시 새로운 세션 생성 (계속 강화를 위해)
            const newSessionId = `${user.discordId}-${Date.now()}`;
            this.sessions.set(newSessionId, {
                userId: user.discordId,
                itemId: sessionData.itemId,
                itemInventoryIndex: sessionData.itemInventoryIndex,
                item: { ...item, isAccessory: sessionData.item.isAccessory },  // 업데이트된 아이템 정보
                cost: ENHANCE_SYSTEM.costs[item.enhanceLevel + 1] || 100000000,  // 다음 강화 비용
                successRate: ENHANCE_SYSTEM.rates[item.enhanceLevel + 1]?.success || 10,  // 다음 강화 확률
                useProtection: false,
                useBlessing: false
            });
            
            // 강화 성공 시 계속 강화 옵션 제공
            buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_${newSessionId}`)
                        .setLabel('🔥 계속 승급')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_protection_${newSessionId}`)
                        .setLabel('🛡️ 보호석 사용하여 승급')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!this.hasProtectionStone(user)),
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_blessing_${newSessionId}`)
                        .setLabel('✨ 강화석 사용하여 승급')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!this.hasBlessingStone(user))
                );
            
            const menuButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('enhance_menu')
                        .setLabel('🔄 다른 아이템')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('main_menu')
                        .setLabel('🏠 메인 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            if (interaction.deferred) {
                return await interaction.editReply({
                    embeds: [resultEmbed],
                    components: [buttons, menuButtons]
                });
            } else {
                return await interaction.update({
                    embeds: [resultEmbed],
                    components: [buttons, menuButtons]
                });
            }
        } else if ((result === 'fail' || result === 'destroy') && item && item.enhanceLevel < ENHANCE_SYSTEM.maxLevel) {
            // 실패했거나 파괴된 경우 (아이템이 남아있고 만렙이 아닌 경우)
            const newSessionId = `${user.discordId}-${Date.now()}`;
            this.sessions.set(newSessionId, {
                userId: user.discordId,
                itemId: sessionData.itemId,
                itemInventoryIndex: sessionData.itemInventoryIndex,
                item: { ...item, isAccessory: sessionData.item.isAccessory },  // 업데이트된 아이템 정보
                cost: ENHANCE_SYSTEM.costs[item.enhanceLevel + 1] || 100000000,  // 다음 강화 비용
                successRate: ENHANCE_SYSTEM.rates[item.enhanceLevel + 1]?.success || 10,  // 다음 강화 확률
                useProtection: false,
                useBlessing: false
            });
            
            buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_${newSessionId}`)
                        .setLabel('🔥 계속 승급')
                        .setStyle(ButtonStyle.Danger),  // 실패 후에는 빨간색
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_protection_${newSessionId}`)
                        .setLabel('🛡️ 보호석 사용하여 승급')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!this.hasProtectionStone(user)),
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_blessing_${newSessionId}`)
                        .setLabel('✨ 강화석 사용하여 승급')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!this.hasBlessingStone(user))
                );
            
            const menuButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('enhance_menu')
                        .setLabel('🔄 다른 아이템')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('main_menu')
                        .setLabel('🏠 메인 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            if (interaction.deferred) {
                return await interaction.editReply({
                    embeds: [resultEmbed],
                    components: [buttons, menuButtons]
                });
            } else {
                return await interaction.update({
                    embeds: [resultEmbed],
                    components: [buttons, menuButtons]
                });
            }
        } else {
            // 파괴되었거나 만렙인 경우
            this.sessions.delete(sessionId);
            
            buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('enhance_menu')
                        .setLabel('🔄 다른 아이템 계급 부여')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('main_menu')
                        .setLabel('🏠 메인 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            return await interaction.update({
                embeds: [resultEmbed],
                components: [buttons]
            });
        }
    }

    // 강화 가능한 아이템 목록 조회 (장착한 장비만)
    getEnhanceableItems(user) {
        if (!user.inventory) return [];
        
        const equippedItems = [];
        
        // 일반 장비 슬롯 확인 (equipment 객체)
        if (user.equipment) {
            Object.entries(user.equipment).forEach(([slot, itemIndex]) => {
                // 유효한 아이템 인덱스인지 확인
                if (itemIndex !== null && itemIndex !== undefined && itemIndex !== -1) {
                    const item = user.inventory[itemIndex];
                    if (item) {
                        // 장비 아이템이고 최대 레벨이 아닌 경우
                        const isEquipment = ['weapon', 'armor', 'accessory'].includes(item.type) ||
                                           ['sword', 'shield', 'helmet', 'ring', 'bow', 'staff', 'dagger',
                                            'gloves', 'boots', 'belt', 'cloak', 'necklace', 'earring'].includes(item.category) ||
                                           ['weapon', 'armor', 'shield', 'helmet', 'gloves', 'boots', 
                                            'belt', 'cloak', 'ring', 'necklace', 'earring'].includes(item.type);
                        const notMaxLevel = (item.enhanceLevel || 0) < ENHANCE_SYSTEM.maxLevel;
                        
                        if (isEquipment && notMaxLevel) {
                            // 슬롯 정보 추가
                            item.equipmentSlot = slot;
                            item.inventoryIndex = itemIndex;
                            equippedItems.push(item);
                        }
                    }
                }
            });
        }
        
        // 악세사리 슬롯 확인 (equippedAccessories 객체)
        if (user.equippedAccessories) {
            Object.entries(user.equippedAccessories).forEach(([slot, accessoryItem]) => {
                if (accessoryItem) {
                    // 인벤토리에서 원본 아이템 찾기
                    let originalItem = null;
                    let itemIndex = -1;
                    
                    if (accessoryItem.inventorySlot !== undefined) {
                        // inventorySlot으로 찾기
                        originalItem = user.inventory.find(item => item && item.inventorySlot === accessoryItem.inventorySlot);
                        itemIndex = accessoryItem.inventorySlot;
                    }
                    
                    if (!originalItem) {
                        // 인벤토리에서 동일한 아이템 찾기
                        const foundIndex = user.inventory.findIndex(item => 
                            item && item.name === accessoryItem.name && item.type === 'accessory'
                        );
                        if (foundIndex !== -1) {
                            originalItem = user.inventory[foundIndex];
                            itemIndex = foundIndex;
                        }
                    }
                    
                    if (originalItem) {
                        const notMaxLevel = (originalItem.enhanceLevel || 0) < ENHANCE_SYSTEM.maxLevel;
                        
                        if (notMaxLevel) {
                            // 슬롯 정보 추가
                            originalItem.equipmentSlot = slot;
                            originalItem.inventoryIndex = itemIndex;
                            originalItem.isAccessory = true;
                            equippedItems.push(originalItem);
                        }
                    }
                }
            });
        }
        
        // equipment 객체에서 찾지 못한 경우 inventorySlot으로도 확인
        // equipment의 값이 inventorySlot인 경우를 체크
        user.inventory.forEach((item, index) => {
            if (item && item.inventorySlot !== undefined) {
                // 이미 추가되지 않은 아이템인지 확인
                const alreadyAdded = equippedItems.some(equipped => 
                    equipped.inventoryIndex === index
                );
                
                if (!alreadyAdded) {
                    // equipment의 값이 현재 아이템의 inventorySlot과 일치하는지 확인
                    const equipmentSlot = Object.entries(user.equipment || {}).find(([slot, value]) => 
                        value === item.inventorySlot
                    );
                    
                    if (equipmentSlot) {
                        const isEquipment = ['weapon', 'armor', 'accessory'].includes(item.type) ||
                                           ['sword', 'shield', 'helmet', 'ring', 'bow', 'staff', 'dagger',
                                            'gloves', 'boots', 'belt', 'cloak', 'necklace', 'earring'].includes(item.category) ||
                                           ['weapon', 'armor', 'shield', 'helmet', 'gloves', 'boots', 
                                            'belt', 'cloak', 'ring', 'necklace', 'earring'].includes(item.type);
                        const notMaxLevel = (item.enhanceLevel || 0) < ENHANCE_SYSTEM.maxLevel;
                        
                        if (isEquipment && notMaxLevel) {
                            item.equipmentSlot = equipmentSlot[0]; // 실제 장착된 슬롯 저장
                            item.inventoryIndex = index;
                            equippedItems.push(item);
                        }
                    }
                }
            }
        });
        
        return equippedItems;
    }

    // 보호석 확인
    hasProtectionStone(user) {
        return user.inventory && user.inventory.some(item => 
            (item.id === 'protection_stone' || item.id === 'protection_scroll') && item.quantity > 0
        );
    }

    // 축복석 확인
    hasBlessingStone(user) {
        return user.inventory && user.inventory.some(item => 
            (item.id === 'blessing_stone' || item.id === 'enhancement_stone' || 
             item.id === 'basic_enhancement_stone' || item.id === 'advanced_enhancement_stone' || 
             item.id === 'perfect_enhancement_stone') && item.quantity > 0
        );
    }

    // 보호석 사용
    consumeProtectionStone(user) {
        const stone = user.inventory.find(item => 
            (item.id === 'protection_stone' || item.id === 'protection_scroll') && item.quantity > 0
        );
        if (stone) {
            stone.quantity--;
            if (stone.quantity <= 0) {
                const index = user.inventory.indexOf(stone);
                user.inventory.splice(index, 1);
            }
        }
    }

    // 축복석 사용
    consumeBlessingStone(user) {
        const stone = user.inventory.find(item => 
            (item.id === 'blessing_stone' || item.id === 'enhancement_stone' || 
             item.id === 'basic_enhancement_stone' || item.id === 'advanced_enhancement_stone' || 
             item.id === 'perfect_enhancement_stone') && item.quantity > 0
        );
        if (stone) {
            stone.quantity--;
            if (stone.quantity <= 0) {
                const index = user.inventory.indexOf(stone);
                user.inventory.splice(index, 1);
            }
        }
    }

    // 강화 기록 표시
    async showEnhanceHistory(interaction) {
        await interaction.deferUpdate().catch(() => {});
        
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            return await interaction.editReply({ 
                content: '먼저 회원가입을 해주세요!',
                embeds: [],
                components: []
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('📜 김헌터 계급 승급 기록')
            .setDescription('최근 10개의 승급 시도 기록입니다.');

        if (!user.enhanceHistory || user.enhanceHistory.length === 0) {
            embed.addFields({
                name: '⚠️ 기록 없음',
                value: '아직 계급 승급을 시도한 기록이 없습니다.'
            });
        } else {
            const recentHistory = user.enhanceHistory.slice(-10).reverse();
            
            recentHistory.forEach((record, index) => {
                const date = new Date(record.date);
                const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                const resultIcon = record.success ? '✅' : '❌';
                const rankName = ENHANCE_SYSTEM.rankNames[record.level] || '알 수 없음';
                
                embed.addFields({
                    name: `${resultIcon} ${dateStr}`,
                    value: `${record.itemName} (${rankName})`,
                    inline: true
                });
            });
        }

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('enhance_menu')
                    .setLabel('🎖️ 계급 승급')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 강화 상점 표시
    async showEnhanceShop(interaction) {
        await interaction.deferUpdate().catch(() => {});
        
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            return await interaction.editReply({ 
                content: '먼저 회원가입을 해주세요!',
                embeds: [],
                components: []
            });
        }

        const shopEmbed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('🛒 강화 재료 상점')
            .setDescription('계급 승급에 필요한 재료를 구매할 수 있습니다.')
            .addFields(
                {
                    name: '🛡️ 보호석',
                    value: '가격: 50,000G\n효과: 파괴 시 계급이 0으로 초기화되지 않음',
                    inline: true
                },
                {
                    name: '✨ 축복석',
                    value: '가격: 100,000G\n효과: 성공률 +10%',
                    inline: true
                },
                {
                    name: '💰 보유 골드',
                    value: `${formatNumber(user.gold)}G`,
                    inline: false
                }
            );

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('buy_protection_stone')
                    .setLabel('🛡️ 보호석 구매')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.gold < 50000),
                new ButtonBuilder()
                    .setCustomId('buy_blessing_stone')
                    .setLabel('✨ 축복석 구매')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.gold < 100000),
                new ButtonBuilder()
                    .setCustomId('enhance_menu')
                    .setLabel('🎖️ 계급 승급')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.editReply({
            embeds: [shopEmbed],
            components: [buttons]
        });
    }

    // 아이템 타입 한글 변환
    getItemTypeKorean(type) {
        const types = {
            'weapon': '무기',
            'armor': '방어구',
            'accessory': '장신구',
            'sword': '검',
            'shield': '방패',
            'helmet': '투구',
            'ring': '반지'
        };
        return types[type] || type;
    }

    // 스탯 한글 변환
    getStatKorean(stat, user = null) {
        // 마법사 엠블럼 확인
        const isMage = user && user.emblem && (
            user.emblem === '견습 마법사' || 
            user.emblem === '원소 술사' ||
            user.emblem === '신비한 현자' ||
            user.emblem === '대마법사' ||
            user.emblem === '전설의 아크메이지' ||
            user.emblem.includes('마법사') ||
            user.emblem.includes('아크메이지')
        );
        
        const stats = {
            'attack': isMage ? '마력' : '공격력',
            'defense': '방어력',
            'hp': '체력',
            'health': '체력',
            'luck': '행운',
            'strength': '힘',
            'agility': '민첩',
            'intelligence': '지능',
            'vitality': '활력',
            'dodge': '회피',
            'critical': '치명타',
            'criticalChance': '치명타 확률',
            'criticalDamage': '치명타 피해',
            'speed': '속도',
            'mana': '마나',
            'stamina': '스태미나',
            'resistance': '저항력',
            'accuracy': '명중률',
            'evasion': '회피율',
            'blockChance': '방어 확률',
            'penetration': '관통력',
            'lifesteal': '생명력 흡수',
            'attackSpeed': '공격 속도',
            'moveSpeed': '이동 속도',
            'cooldownReduction': '재사용 대기시간 감소',
            'expBonus': '경험치 보너스',
            'goldBonus': '골드 보너스',
            'itemFind': '아이템 발견률',
            'magicFind': '마법 아이템 발견률'
        };
        return stats[stat] || stat;
    }
}

// 싱글톤 인스턴스
const enhanceSystem = new EnhanceSystem();

// 인터랙션 핸들러
async function handleEnhanceInteraction(interaction) {
    const customId = interaction.customId;
    
    // 세션이 필요한 인터랙션인 경우 사용자 확인
    const sessionRequiredPrefixes = ['enhance_confirm_', 'enhance_protection_', 'enhance_blessing_'];
    const needsSessionCheck = sessionRequiredPrefixes.some(prefix => customId.startsWith(prefix));
    
    if (needsSessionCheck) {
        // 세션 ID에서 사용자 ID 추출 (enhance_confirm_유저ID-타임스탬프 형식)
        const sessionParts = customId.split('_');
        if (sessionParts.length >= 3) {
            const sessionId = sessionParts.slice(2).join('_'); // enhance_confirm_ 이후 전체
            const sessionUserId = sessionId.split('-')[0]; // 첫 번째 - 이전까지가 유저 ID
            
            if (sessionUserId && sessionUserId !== interaction.user.id) {
                if (interaction.deferred) {
                    return await interaction.editReply({
                        content: '❌ 다른 사용자의 강화 세션입니다!'
                    });
                } else {
                    return await interaction.reply({
                        content: '❌ 다른 사용자의 강화 세션입니다!',
                        flags: 64
                    });
                }
            }
        }
    }

    if (customId === 'enhance') {
        return await enhanceSystem.showEnhanceMenu(interaction);
    }
    else if (customId === 'enhance_menu') {
        // 메뉴 버튼 클릭 시 update 사용
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        return await enhanceSystem.showEnhanceMenu(interaction);
    }
    else if (customId === 'enhance_select_item') {
        const itemId = interaction.values[0];
        return await enhanceSystem.showEnhanceDetail(interaction, itemId);
    }
    else if (customId.startsWith('enhance_confirm_')) {
        const sessionId = customId.replace('enhance_confirm_', '');
        return await enhanceSystem.performEnhance(interaction, sessionId);
    }
    else if (customId.startsWith('enhance_protection_')) {
        const sessionId = customId.replace('enhance_protection_', '');
        const session = enhanceSystem.sessions.get(sessionId);
        if (session) {
            session.useProtection = !session.useProtection;
            return await interaction.reply({
                content: session.useProtection ? '🛡️ 보호석을 사용합니다.' : '보호석 사용을 취소했습니다.',
                flags: 64
            });
        }
    }
    else if (customId.startsWith('enhance_blessing_')) {
        const sessionId = customId.replace('enhance_blessing_', '');
        const session = enhanceSystem.sessions.get(sessionId);
        if (session) {
            session.useBlessing = !session.useBlessing;
            
            // 사용할 강화석 확인
            const user = await getUser(interaction.user.id);
            const stone = user.inventory?.find(item => 
                (item.id === 'blessing_stone' || item.id === 'enhancement_stone' || 
                 item.id === 'basic_enhancement_stone' || item.id === 'advanced_enhancement_stone' || 
                 item.id === 'perfect_enhancement_stone') && item.quantity > 0
            );
            
            let message = '강화석 사용을 취소했습니다.';
            if (session.useBlessing && stone) {
                let bonus = 10;
                switch(stone.id) {
                    case 'basic_enhancement_stone':
                        bonus = 5;
                        message = `✨ 기본 강화석을 사용합니다. (성공률 +${bonus}%)`;
                        break;
                    case 'advanced_enhancement_stone':
                        bonus = 10;
                        message = `✨ 고급 강화석을 사용합니다. (성공률 +${bonus}%)`;
                        break;
                    case 'perfect_enhancement_stone':
                        bonus = 20;
                        message = `✨ 완벽한 강화석을 사용합니다. (성공률 +${bonus}%)`;
                        break;
                    default:
                        message = `✨ 강화석을 사용합니다. (성공률 +${bonus}%)`;
                }
            }
            
            return await interaction.reply({
                content: message,
                flags: 64
            });
        }
    }
    else if (customId === 'enhance_history') {
        return await enhanceSystem.showEnhanceHistory(interaction);
    }
    else if (customId === 'enhance_shop') {
        return await enhanceSystem.showEnhanceShop(interaction);
    }
    else if (customId === 'buy_protection_stone') {
        await interaction.deferUpdate();
        const user = await getUser(interaction.user.id);
        
        if (user.gold < 50000) {
            await interaction.followUp({
                content: '❌ 골드가 부족합니다!',
                flags: 64
            });
            return;
        }
        
        user.gold -= 50000;
        if (!user.inventory) user.inventory = [];
        
        const existingStone = user.inventory.find(item => item.id === 'protection_stone');
        if (existingStone) {
            existingStone.quantity = (existingStone.quantity || 0) + 1;
        } else {
            user.inventory.push({
                id: 'protection_stone',
                name: '보호석',
                type: 'consumable',
                quantity: 1,
                description: '파괴 시 계급이 0으로 초기화되지 않습니다.'
            });
        }
        
        // 전투력 재계산
        const { calculateCombatPower } = require('../common/combatPower');
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
        await interaction.followUp({
            content: '✅ 보호석을 구매했습니다!',
            flags: 64
        });
        return await enhanceSystem.showEnhanceShop(interaction);
    }
    else if (customId === 'buy_blessing_stone') {
        await interaction.deferUpdate();
        const user = await getUser(interaction.user.id);
        
        if (user.gold < 100000) {
            await interaction.followUp({
                content: '❌ 골드가 부족합니다!',
                flags: 64
            });
            return;
        }
        
        user.gold -= 100000;
        if (!user.inventory) user.inventory = [];
        
        const existingStone = user.inventory.find(item => item.id === 'blessing_stone');
        if (existingStone) {
            existingStone.quantity = (existingStone.quantity || 0) + 1;
        } else {
            user.inventory.push({
                id: 'blessing_stone',
                name: '축복석',
                type: 'consumable',
                quantity: 1,
                description: '강화 성공률을 10% 증가시킵니다.'
            });
        }
        
        // 전투력 재계산
        const { calculateCombatPower } = require('../common/combatPower');
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
        await interaction.followUp({
            content: '✅ 축복석을 구매했습니다!',
            flags: 64
        });
        return await enhanceSystem.showEnhanceShop(interaction);
    }
    else if (customId.startsWith('enhance_continue_')) {
        const parts = customId.split('_');
        const sessionId = parts[parts.length - 1];
        
        if (parts[2] === 'protection') {
            // 보호석 사용하여 계속 강화
            const session = enhanceSystem.sessions.get(sessionId);
            if (session) {
                session.useProtection = true;
                session.useBlessing = false;
            }
        } else if (parts[2] === 'blessing') {
            // 축복석 사용하여 계속 강화
            const session = enhanceSystem.sessions.get(sessionId);
            if (session) {
                session.useProtection = false;
                session.useBlessing = true;
            }
        } else {
            // 일반 계속 강화
            const session = enhanceSystem.sessions.get(sessionId);
            if (session) {
                session.useProtection = false;
                session.useBlessing = false;
            }
        }
        
        return await enhanceSystem.performEnhance(interaction, sessionId);
    }
}

module.exports = {
    handleEnhanceInteraction,
    enhanceSystem,
    EnhanceSystem,
    ENHANCE_SYSTEM
};