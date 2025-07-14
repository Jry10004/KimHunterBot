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
        1: { success: 95, fail: 5, destroy: 0 },
        2: { success: 90, fail: 10, destroy: 0 },
        3: { success: 85, fail: 15, destroy: 0 },
        4: { success: 85, fail: 15, destroy: 0 },
        5: { success: 80, fail: 20, destroy: 0 },
        6: { success: 75, fail: 25, destroy: 0 },
        7: { success: 70, fail: 30, destroy: 0 },
        8: { success: 65, fail: 35, destroy: 0 },
        9: { success: 60, fail: 40, destroy: 0 },
        10: { success: 55, fail: 45, destroy: 0 },
        11: { success: 50, fail: 50, destroy: 0 },
        12: { success: 45, fail: 55, destroy: 0 },
        13: { success: 40, fail: 60, destroy: 0 },
        14: { success: 35, fail: 65, destroy: 0 },
        15: { success: 30, fail: 67.9, destroy: 2.1 },
        16: { success: 30, fail: 67.9, destroy: 2.1 },
        17: { success: 30, fail: 67.9, destroy: 2.1 },
        18: { success: 15, fail: 78.2, destroy: 6.8 },
        19: { success: 15, fail: 78.2, destroy: 6.8 },
        20: { success: 15, fail: 76.5, destroy: 8.5 },
        21: { success: 30, fail: 59.5, destroy: 10.5 },
        22: { success: 15, fail: 72.25, destroy: 12.75 },
        23: { success: 15, fail: 68, destroy: 17 },
        24: { success: 10, fail: 72, destroy: 18 },
        25: { success: 10, fail: 72, destroy: 18 },
        26: { success: 10, fail: 72, destroy: 18 },
        27: { success: 7, fail: 74.4, destroy: 18.6 },
        28: { success: 5, fail: 76, destroy: 19 },
        29: { success: 3, fail: 77.6, destroy: 19.4 },
        30: { success: 1, fail: 79.2, destroy: 19.8 }
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
            description: '실패 시 아이템이 파괴되지 않습니다',
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
        
        // 장착 확인
        const isEquipped = Object.values(user.equipment || {}).includes(itemInventoryIndex) ||
                          (item.inventorySlot !== undefined && 
                           Object.values(user.equipment || {}).includes(item.inventorySlot));
        
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

        const cost = ENHANCE_SYSTEM.costs[nextLevel];
        const rateData = ENHANCE_SYSTEM.rates[nextLevel];
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
        
        // 15성 이상 확률표 표시
        if (currentLevel >= 14) {
            let rateTable = '```\n계급 | 성공 | 실패 | 파괴\n';
            rateTable += '─────┼──────┼──────┼──────\n';
            
            for (let i = 15; i <= Math.min(currentLevel + 5, 30); i++) {
                const rate = ENHANCE_SYSTEM.rates[i];
                if (rate) {
                    const current = i === nextLevel ? '▶ ' : '  ';
                    rateTable += `${current}${i}계급│${rate.success.toString().padStart(4)}% │${rate.fail.toString().padStart(4)}% │${rate.destroy.toString().padStart(4)}%\n`;
                }
            }
            rateTable += '```';
            
            embed.addFields({
                name: '📈 고계급 확률표',
                value: rateTable,
                inline: false
            });
        }

        // 계급 승급 시 증가할 스탯 표시
        if (item.stats) {
            const statIncrease = [];
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
            
            Object.keys(item.stats).forEach(stat => {
                if (item.stats[stat] > 0) {
                    const isMainStat = mainStats.includes(stat);
                    const rate = isMainStat ? increaseRate.main : increaseRate.sub;
                    const increase = Math.ceil(item.stats[stat] * rate);
                    
                    const statName = this.getStatKorean(stat);
                    const percentage = (rate * 100).toFixed(0);
                    statIncrease.push(`${isMainStat ? '⭐' : '☆'} ${statName} +${increase} (+${percentage}%)`);
                }
            });
            
            if (statIncrease.length > 0) {
                embed.addFields({
                    name: '📈 계급 승급 시 스탯 증가',
                    value: statIncrease.join('\n') + '\n\n⭐ 주 스탯 | ☆ 부 스탯',
                    inline: false
                });
            }
        }

        // 세션 저장
        const sessionId = `${user.discordId}-${Date.now()}`;
        this.sessions.set(sessionId, {
            userId: user.discordId,
            itemId: itemId,
            itemInventoryIndex: itemInventoryIndex,
            item: item,
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
                    .setLabel('✨ 축복석 사용')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!this.hasBlessingStone(user)),
                new ButtonBuilder()
                    .setCustomId('enhance_menu')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.reply({
            embeds: [embed],
            components: [buttons],
            flags: 64
        });
    }

    // 강화 실행
    async performEnhance(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.userId !== interaction.user.id) {
            return await interaction.reply({
                content: '❌ 유효하지 않은 강화 세션입니다!',
                flags: 64
            });
        }

        const user = await getUser(interaction.user.id);
        let item = null;
        
        // 세션에 저장된 인벤토리 인덱스 사용
        if (session.itemInventoryIndex !== undefined && session.itemInventoryIndex !== -1) {
            item = user.inventory[session.itemInventoryIndex];
        }
        
        // 인덱스로 못 찾으면 다른 방법 시도
        if (!item) {
            item = user.inventory.find(i => 
                (i._id && i._id.toString() === session.itemId) || 
                (i.name === session.item.name)
            );
        }

        if (!item) {
            return await interaction.reply({
                content: '❌ 아이템을 찾을 수 없습니다!',
                flags: 64
            });
        }
        
        // 장착 확인
        const itemIndex = user.inventory.indexOf(item);
        const isEquipped = Object.values(user.equipment || {}).includes(itemIndex) ||
                          (item.inventorySlot !== undefined && 
                           Object.values(user.equipment || {}).includes(item.inventorySlot));
        
        if (!isEquipped) {
            return await interaction.reply({
                content: '❌ 장착하지 않은 장비는 강화할 수 없습니다!',
                flags: 64
            });
        }

        if (user.gold < session.cost) {
            return await interaction.reply({
                content: '❌ 골드가 부족합니다!',
                flags: 64
            });
        }

        // 골드 차감
        user.gold -= session.cost;

        // 강화 재료 사용
        if (session.useProtection) {
            this.consumeProtectionStone(user);
        }
        if (session.useBlessing) {
            this.consumeBlessingStone(user);
            session.successRate = Math.min(100, session.successRate + 10);
        }

        // 강화 시도
        const currentLevel = item.enhanceLevel || 0;
        const rateData = ENHANCE_SYSTEM.rates[currentLevel + 1];
        const roll = Math.random() * 100;

        let resultEmbed;
        let result = 'fail'; // success, fail, destroy
        
        if (roll < session.successRate) {
            result = 'success';
        } else if (roll < (session.successRate + rateData.fail)) {
            result = 'fail';
        } else {
            result = 'destroy';
        }

        if (result === 'success') {
            // 계급 승급 성공
            item.enhanceLevel = currentLevel + 1;
            
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
            
            // 각 스탯 증가 적용
            Object.keys(item.stats).forEach(stat => {
                if (item.stats[stat] > 0) {
                    const isMainStat = mainStats.includes(stat);
                    const rate = isMainStat ? increaseRate.main : increaseRate.sub;
                    const increase = Math.ceil(item.stats[stat] * rate);
                    item.stats[stat] += increase;
                }
            });

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
                
                Object.keys(item.stats).forEach(stat => {
                    if (item.stats[stat] > 0) {
                        const isMainStat = mainStats.includes(stat);
                        const statEmoji = {
                            attack: '⚔️ 공격력',
                            defense: '🛡️ 방어력',
                            hp: '❤️ 체력',
                            strength: '💪 힘',
                            agility: '🏃 민첩',
                            intelligence: '🧠 지능',
                            vitality: '💗 활력',
                            luck: '🍀 행운',
                            dodge: '💨 회피'
                        }[stat] || stat;
                        
                        statChanges.push(`${statEmoji}: +${item.stats[stat]} ${isMainStat ? '(주 스탯)' : ''}`);
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
                    { name: '💰 사용 골드', value: `${formatNumber(session.cost)}G`, inline: true }
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
                
                // 스탯 감소 (이전 계급의 증가분만큼 감소)
                if (item.stats) {
                    const itemType = item.type || item.category || 'weapon';
                    const mainStats = ENHANCE_SYSTEM.mainStatByType[itemType] || ['attack'];
                    
                    // 이전 계급의 증가율
                    let previousRate;
                    if (currentLevel <= 10) {
                        previousRate = ENHANCE_SYSTEM.statIncrease.tier1;
                    } else if (currentLevel <= 20) {
                        previousRate = ENHANCE_SYSTEM.statIncrease.tier2;
                    } else {
                        previousRate = ENHANCE_SYSTEM.statIncrease.tier3;
                    }
                    
                    Object.keys(item.stats).forEach(stat => {
                        if (item.stats[stat] > 0) {
                            const isMainStat = mainStats.includes(stat);
                            const rate = isMainStat ? previousRate.main : previousRate.sub;
                            // 역계산: 현재값 / (1 + rate) = 이전값
                            const previousValue = Math.floor(item.stats[stat] / (1 + rate));
                            item.stats[stat] = Math.max(1, previousValue);
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
                        { name: '💰 사용 골드', value: `${formatNumber(session.cost)}G`, inline: true }
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
                        { name: '💰 사용 골드', value: `${formatNumber(session.cost)}G`, inline: true }
                    );
            }
        } else {
            // 파괴
            if (session.useProtection) {
                // 보호석 사용 - 아이템 보호
                resultEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('💔 아이템 보호됨!')
                    .setDescription('아이템이 파괴될 뻔했지만 보호석으로 보호되었습니다.')
                    .addFields(
                        { name: '🛡️ 아이템 상태', value: '보호됨', inline: true },
                        { name: '🎖️ 현재 계급', value: ENHANCE_SYSTEM.rankNames[currentLevel], inline: true },
                        { name: '💰 사용 골드', value: `${formatNumber(session.cost)}G`, inline: true }
                    );
            } else {
                // 아이템 파괴
                const index = session.itemInventoryIndex !== undefined && session.itemInventoryIndex !== -1 
                    ? session.itemInventoryIndex 
                    : user.inventory.findIndex(i => 
                        (i._id && i._id.toString() === session.itemId) || 
                        (i.name === session.item.name)
                    );
                    
                if (index > -1) {
                    user.inventory.splice(index, 1);
                }
                
                // 파괴 시 아이템을 null로 설정
                item = null;

                // 라이프 시스템 뉴스 연동 - 파괴
                const lifeSystem = require('../../systems/lifeSystemIntegration');
                lifeSystem.reportEnhancement(user, session.item, currentLevel + 1, false);

                resultEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('💥 아이템 파괴!')
                    .setDescription(`${session.item.name}이(가) 완전히 파괴되었습니다...`)
                    .setImage(GAME_GIFS.enhancement.destroy)
                    .addFields(
                        { name: '💔 결과', value: '아이템 소멸', inline: true },
                        { name: '🎖️ 시도 계급', value: `${ENHANCE_SYSTEM.rankNames[currentLevel]} → ${ENHANCE_SYSTEM.rankNames[currentLevel + 1]}`, inline: true },
                        { name: '💰 사용 골드', value: `${formatNumber(session.cost)}G`, inline: true }
                    )
                    .setFooter({ text: '높은 계급일수록 파괴 확률이 증가합니다!' });
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

        await user.save();
        
        let buttons;
        if (result === 'success' && item.enhanceLevel < ENHANCE_SYSTEM.maxLevel) {
            // 강화 성공 시 세션 업데이트 (계속 강화를 위해)
            session.item = item;  // 업데이트된 아이템 정보
            session.cost = ENHANCE_SYSTEM.costs[item.enhanceLevel + 1] || 100000000;  // 다음 강화 비용
            const nextRateData = ENHANCE_SYSTEM.rates[item.enhanceLevel + 1];
            session.successRate = nextRateData ? nextRateData.success : 10;  // 다음 강화 확률
            
            // 강화 성공 시 계속 강화 옵션 제공
            buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_${sessionId}`)
                        .setLabel('🔥 계속 승급')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_protection_${sessionId}`)
                        .setLabel('🛡️ 보호석 사용하여 승급')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!this.hasProtectionStone(user)),
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_blessing_${sessionId}`)
                        .setLabel('✨ 축복석 사용하여 승급')
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
            
            return await interaction.update({
                embeds: [resultEmbed],
                components: [buttons, menuButtons]
            });
        } else if ((result === 'fail' || (result === 'destroy' && session.useProtection)) && item && item.enhanceLevel < ENHANCE_SYSTEM.maxLevel) {
            // 실패했거나 보호석으로 보호된 경우 (아이템이 남아있고 만렙이 아닌 경우)
            session.item = item;  // 업데이트된 아이템 정보
            session.cost = ENHANCE_SYSTEM.costs[item.enhanceLevel + 1] || 100000000;  // 다음 강화 비용
            const nextRateData = ENHANCE_SYSTEM.rates[item.enhanceLevel + 1];
            session.successRate = nextRateData ? nextRateData.success : 10;  // 다음 강화 확률
            
            buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_${sessionId}`)
                        .setLabel('🔥 계속 승급')
                        .setStyle(ButtonStyle.Danger),  // 실패 후에는 빨간색
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_protection_${sessionId}`)
                        .setLabel('🛡️ 보호석 사용하여 승급')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!this.hasProtectionStone(user)),
                    new ButtonBuilder()
                        .setCustomId(`enhance_continue_blessing_${sessionId}`)
                        .setLabel('✨ 축복석 사용하여 승급')
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
            
            return await interaction.update({
                embeds: [resultEmbed],
                components: [buttons, menuButtons]
            });
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
        if (!user.inventory || !user.equipment) return [];
        
        const equippedItems = [];
        
        // equipment 객체의 각 슬롯을 확인
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
        
        // inventorySlot을 사용하는 경우도 체크
        user.inventory.forEach((item, index) => {
            if (item && item.inventorySlot !== undefined) {
                // 이미 추가되지 않은 아이템인지 확인
                const alreadyAdded = equippedItems.some(equipped => 
                    equipped.inventoryIndex === index
                );
                
                if (!alreadyAdded) {
                    // equipment에 해당 inventorySlot이 있는지 확인
                    const isEquipped = Object.values(user.equipment || {}).some(slotValue => 
                        slotValue === item.inventorySlot
                    );
                    
                    if (isEquipped) {
                        const isEquipment = ['weapon', 'armor', 'accessory'].includes(item.type) ||
                                           ['sword', 'shield', 'helmet', 'ring', 'bow', 'staff', 'dagger',
                                            'gloves', 'boots', 'belt', 'cloak', 'necklace', 'earring'].includes(item.category) ||
                                           ['weapon', 'armor', 'shield', 'helmet', 'gloves', 'boots', 
                                            'belt', 'cloak', 'ring', 'necklace', 'earring'].includes(item.type);
                        const notMaxLevel = (item.enhanceLevel || 0) < ENHANCE_SYSTEM.maxLevel;
                        
                        if (isEquipment && notMaxLevel) {
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
            item.id === 'protection_stone' && item.quantity > 0
        );
    }

    // 축복석 확인
    hasBlessingStone(user) {
        return user.inventory && user.inventory.some(item => 
            item.id === 'blessing_stone' && item.quantity > 0
        );
    }

    // 보호석 사용
    consumeProtectionStone(user) {
        const stone = user.inventory.find(item => 
            item.id === 'protection_stone' && item.quantity > 0
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
            item.id === 'blessing_stone' && item.quantity > 0
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
                    value: '가격: 50,000G\n효과: 실패 시 아이템이 파괴되지 않음',
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
    getStatKorean(stat) {
        const stats = {
            'attack': '공격력',
            'defense': '방어력',
            'hp': '체력',
            'luck': '행운',
            'strength': '힘',
            'agility': '민첩',
            'intelligence': '지능'
        };
        return stats[stat] || stat;
    }
}

// 싱글톤 인스턴스
const enhanceSystem = new EnhanceSystem();

// 인터랙션 핸들러
async function handleEnhanceInteraction(interaction) {
    const customId = interaction.customId;
    
    // 버튼 인터랙션인 경우 사용자 확인
    if (interaction.isButton() && !customId.startsWith('enhance_')) {
        // enhance로 시작하지 않는 버튼은 체크하지 않음
    } else if (interaction.isButton() && customId.startsWith('enhance_')) {
        // 세션 ID에서 사용자 ID 추출
        const sessionParts = customId.split('_');
        const sessionUserId = sessionParts[sessionParts.length - 1].split('-')[0];
        
        if (sessionUserId && sessionUserId !== interaction.user.id) {
            return await interaction.reply({
                content: '❌ 다른 사용자의 강화 세션입니다!',
                flags: 64
            });
        }
    }

    if (customId === 'enhance') {
        return await enhanceSystem.showEnhanceMenu(interaction);
    }
    else if (customId === 'enhance_menu') {
        // 메뉴 버튼 클릭 시 update 사용
        await interaction.deferUpdate();
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
            return await interaction.reply({
                content: session.useBlessing ? '✨ 축복석을 사용합니다. (성공률 +10%)' : '축복석 사용을 취소했습니다.',
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
                description: '강화 실패 시 아이템이 파괴되지 않습니다.'
            });
        }
        
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
    EnhanceSystem
};