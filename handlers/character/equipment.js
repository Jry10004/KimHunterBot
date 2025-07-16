const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getUser, formatNumber } = require('../common/utils');
const { calculateCombatPower } = require('../common/combatPower');
const User = require('../../models/User');

// 장비 슬롯 정보
const EQUIPMENT_SLOTS = {
    weapon: { name: '무기', emoji: '🗡️' },
    armor: { name: '갑옷', emoji: '🛡️' },
    helmet: { name: '투구', emoji: '⛑️' },
    gloves: { name: '장갑', emoji: '🧤' },
    boots: { name: '신발', emoji: '👢' },
    shield: { name: '방패', emoji: '🛡️' },
    accessory: { name: '악세서리', emoji: '💍' }
};

// 희귀도별 색상 및 이모지
const RARITY_COLORS = {
    일반: '#95a5a6',
    고급: '#3498db',
    레어: '#9b59b6',
    에픽: '#e74c3c',
    레전드리: '#f39c12',
    신화: '#ff00ff'
};

const RARITY_EMOJIS = {
    일반: '⬜',
    고급: '🔵',
    레어: '🟣',
    에픽: '🔴',
    레전드리: '🟠',
    신화: '✨'
};

// 아이템 점수 계산 (최적화 장착용)
function calculateItemScore(item, userEmblemType = null) {
    if (!item) return 0;
    
    // 직업별 주스탯 정의
    const mainStatByEmblem = {
        '전사': 'strength',
        'warrior': 'strength',
        '궁수': 'agility',
        'archer': 'agility',
        '마법사': 'intelligence',
        'mage': 'intelligence',
        '도적': 'agility',
        'rogue': 'agility',
        '수호자': 'vitality',
        'guardian': 'vitality'
    };
    
    // 유저의 주스탯 확인
    let userMainStat = null;
    if (userEmblemType) {
        const emblemBase = userEmblemType.replace(/\s*\+\d+$/, ''); // 강화 레벨 제거
        for (const [key, value] of Object.entries(mainStatByEmblem)) {
            if (emblemBase.toLowerCase().includes(key)) {
                userMainStat = value;
                break;
            }
        }
    }
    
    // 새로운 아이템 시스템의 score 필드가 있으면 사용
    if (item.score !== undefined) {
        // 강화 레벨 보너스 추가 (강화당 100점)
        let totalScore = item.score + (item.enhancement || 0) * 100;
        
        // 주스탯 보너스 추가 (주스탯 1당 10점 추가)
        if (userMainStat && item.stats && item.stats[userMainStat]) {
            totalScore += item.stats[userMainStat] * 10;
        }
        
        return totalScore;
    }
    
    // 구 시스템 아이템 처리
    let score = 0;
    
    // 강화 레벨 (가장 중요)
    score += (item.enhancement || 0) * 1000;
    
    // 희귀도 점수 (영어와 한글 모두 지원)
    const rarityScores = {
        // 영어
        'legendary': 800,
        'unique': 400,
        'epic': 200,
        'rare': 100,
        'normal': 50,
        'trash': 10,
        // 한글
        '전설': 800,
        '유니크': 400,
        '에픽': 200,
        '레어': 100,
        '일반': 50,
        '쓰레기': 10
    };
    score += rarityScores[item.rarity] || 10;
    
    // 기본 스탯
    if (item.stats) {
        // 주스탯 가중치 적용 (주스탯은 5배 가중치)
        if (userMainStat && item.stats[userMainStat]) {
            score += item.stats[userMainStat] * 10;
        }
        
        // 전투력 관련 스탯
        score += (item.stats.attack || 0) * 2;
        score += (item.stats.defense || 0) * 2;
        score += (item.stats.hp || 0) * 0.5;
        score += (item.stats.dodge || 0) * 1;
        
        // 나머지 스탯들 (주스탯이 아닌 경우)
        if (userMainStat !== 'strength') score += (item.stats.strength || 0) * 2;
        if (userMainStat !== 'agility') score += (item.stats.agility || 0) * 2;
        if (userMainStat !== 'intelligence') score += (item.stats.intelligence || 0) * 2;
        if (userMainStat !== 'vitality') score += (item.stats.vitality || 0) * 2;
        score += (item.stats.luck || 0) * 2;
    }
    
    return score;
}

async function showEquipment(interaction) {
    await interaction.deferUpdate().catch(() => {});
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
            embeds: [],
            components: []
        });
    }

    // 장비 임베드
    const equipmentEmbed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle(`⚔️ ${user.nickname || interaction.user.username}님의 장비관리`)
        .setDescription('현재 장착 중인 장비 목록입니다.\n🎆 **최적화 장착**을 사용하면 가장 좋은 장비를 자동으로 장착합니다!');

    // 전체 스탯 계산
    let totalStats = {
        attack: 0,
        defense: 0,
        hp: 0,
        dodge: 0,
        luck: 0
    };

    // 각 슬롯별 장비 표시
    for (const [slot, info] of Object.entries(EQUIPMENT_SLOTS)) {
        const equippedSlot = user.equipment?.[slot];
        let equippedItem = null;
        
        // 장착된 아이템 찾기 - inventorySlot 또는 인덱스로 찾기
        if (equippedSlot >= 0 && user.inventory) {
            // inventorySlot으로 먼저 찾기
            equippedItem = user.inventory.find(item => item.inventorySlot === equippedSlot);
            
            // 못 찾았으면 배열 인덱스로 찾기
            if (!equippedItem) {
                equippedItem = user.inventory[equippedSlot];
            }
        }
        
        if (equippedItem) {
            const enhancement = equippedItem.enhancement ? ` (+${equippedItem.enhancement})` : '';
            
            // 희귀도 이모지 처리 - 영문/한글 모두 지원
            let rarityEmoji = '';
            if (equippedItem.rarity) {
                // 영문 희귀도를 한글로 변환
                const rarityMap = {
                    'common': '일반',
                    'uncommon': '고급',
                    'rare': '레어',
                    'epic': '에픽',
                    'legendary': '레전드리',
                    'mythic': '신화'
                };
                const rarity = rarityMap[equippedItem.rarity] || equippedItem.rarity;
                rarityEmoji = RARITY_EMOJIS[rarity] || '';
            }
            
            const statText = [];
            
            if (equippedItem.stats) {
                if (equippedItem.stats.attack) {
                    const attackBonus = equippedItem.stats.attack + (equippedItem.enhancement || 0) * 10;
                    statText.push(`⚔️ +${attackBonus}`);
                    totalStats.attack += attackBonus;
                }
                if (equippedItem.stats.defense) {
                    const defenseBonus = equippedItem.stats.defense + (equippedItem.enhancement || 0) * 10;
                    statText.push(`🛡️ +${defenseBonus}`);
                    totalStats.defense += defenseBonus;
                }
                if (equippedItem.stats.strength) {
                    statText.push(`💪 +${equippedItem.stats.strength}`);
                }
                if (equippedItem.stats.agility) {
                    statText.push(`🏃 +${equippedItem.stats.agility}`);
                }
                if (equippedItem.stats.intelligence) {
                    statText.push(`🧠 +${equippedItem.stats.intelligence}`);
                }
                if (equippedItem.stats.vitality) {
                    statText.push(`❤️ +${equippedItem.stats.vitality}`);
                }
                if (equippedItem.stats.luck) {
                    statText.push(`🍀 +${equippedItem.stats.luck}`);
                    totalStats.luck += equippedItem.stats.luck;
                }
                if (equippedItem.stats.hp) {
                    const hpBonus = equippedItem.stats.hp + (equippedItem.enhancement || 0) * 20;
                    statText.push(`💖 +${hpBonus}`);
                    totalStats.hp += hpBonus;
                }
                if (equippedItem.stats.dodge) {
                    statText.push(`💨 +${equippedItem.stats.dodge}`);
                    totalStats.dodge += equippedItem.stats.dodge;
                }
            }
            
            const itemScore = calculateItemScore(equippedItem);
            
            equipmentEmbed.addFields({
                name: `${info.emoji} ${info.name}`,
                value: `${rarityEmoji} **${equippedItem.name}**${enhancement}\n${statText.join(' ')}\n💯 점수: ${itemScore.toLocaleString()}`,
                inline: true
            });
        } else {
            equipmentEmbed.addFields({
                name: `${info.emoji} ${info.name}`,
                value: '🕳️ `비어있음`',
                inline: true
            });
        }
    }

    // 전체 스탯 합계
    const totalStatText = [];
    if (totalStats.attack > 0) totalStatText.push(`⚔️ 공격력: +${totalStats.attack}`);
    if (totalStats.defense > 0) totalStatText.push(`🛡️ 방어력: +${totalStats.defense}`);
    if (totalStats.hp > 0) totalStatText.push(`❤️ 체력: +${totalStats.hp}`);
    if (totalStats.dodge > 0) totalStatText.push(`💨 회피: +${totalStats.dodge}`);
    if (totalStats.luck > 0) totalStatText.push(`🍀 행운: +${totalStats.luck}`);

    if (totalStatText.length > 0) {
        equipmentEmbed.addFields({
            name: '📊 총 장비 스탯',
            value: totalStatText.join('\n'),
            inline: false
        });
    }

    // 전투력 계산 - 통합 함수 사용
    const combatPower = calculateCombatPower(user);
    equipmentEmbed.addFields({
        name: '⚔️ 전투력',
        value: `${formatNumber(combatPower)}`,
        inline: false
    });

    // 버튼 생성
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('optimize_equipment')
                .setLabel('🎆 최적화 장착')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('equip_category')
                .setLabel('🎽 수동 장착')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('unequip_all')
                .setLabel('🚫 전체 해제')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('inventory')
                .setLabel('🎒 인벤토리')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    try {
        return await interaction.editReply({
            embeds: [equipmentEmbed],
            components: [buttons],
        });
    } catch (error) {
        console.error('[showEquipment] editReply 오류:', error);
        throw error;
    }
}

// 장비 카테고리 선택
async function showEquipCategory(interaction) {
    console.log('[showEquipCategory] 함수 시작');
    console.log('[showEquipCategory] interaction 상태:', {
        deferred: interaction.deferred,
        replied: interaction.replied,
        customId: interaction.customId
    });
    
    const categoryEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🎽 장비 카테고리 선택')
        .setDescription('장착할 장비의 카테고리를 선택하세요.');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('equip_slot_select')
        .setPlaceholder('장비 슬롯을 선택하세요')
        .addOptions(
            Object.entries(EQUIPMENT_SLOTS).map(([slot, info]) => ({
                label: info.name,
                value: slot,
                emoji: info.emoji,
                description: `${info.name} 슬롯의 장비를 장착합니다`
            }))
        );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('equipment')
                .setLabel('⚔️ 장비로 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );

    // interaction 응답 처리
    try {
        if (interaction.deferred || interaction.replied) {
            console.log('[showEquipCategory] editReply 사용');
            return await interaction.editReply({
                embeds: [categoryEmbed],
                components: [
                    new ActionRowBuilder().addComponents(selectMenu),
                    buttons
                ]
            });
        } else {
            console.log('[showEquipCategory] update 사용');
            return await interaction.update({
                embeds: [categoryEmbed],
                components: [
                    new ActionRowBuilder().addComponents(selectMenu),
                    buttons
                ]
            });
        }
    } catch (error) {
        console.error('[showEquipCategory] 응답 오류:', error.message);
        if (error.code === 10062) {
            console.log('[showEquipCategory] Unknown interaction - 타임아웃');
            return;
        }
        throw error;
    }
}

// 장착 가능한 아이템 목록 표시
async function showEquippableItems(interaction, slot, page = 1) {
    console.log('[showEquippableItems] 함수 시작 - 슬롯:', slot, '페이지:', page);
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!', 
            flags: 64 
        });
    }

    // 해당 슬롯에 장착 가능한 아이템 필터링
    const equippableItems = user.inventory?.filter(item => {
        return item.type === slot;
    }) || [];
    
    if (equippableItems.length === 0) {
        const slotInfo = slot === 'accessory' ? '💍 악세사리/방패' : `${EQUIPMENT_SLOTS[slot].emoji} ${EQUIPMENT_SLOTS[slot].name}`;
        const additionalInfo = slot === 'accessory' ? '\n\nℹ️ 악세사리 또는 방패 타입의 아이템을 장착할 수 있습니다.' : '';
        
        try {
            const responseData = {
                content: `${slotInfo} 슬롯에 장착 가능한 아이템이 없습니다.${additionalInfo}`,
                embeds: [],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('equip_category')
                            .setLabel('🎽 다른 슬롯 선택')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('⚔️ 장비로 돌아가기')
                            .setStyle(ButtonStyle.Secondary)
                    )
                ]
            };
            
            if (interaction.deferred || interaction.replied) {
                console.log('[showEquippableItems] 아이템 없음 - editReply 사용');
                return await interaction.editReply(responseData);
            } else {
                console.log('[showEquippableItems] 아이템 없음 - update 사용');
                return await interaction.update(responseData);
            }
        } catch (error) {
            console.error('[showEquippableItems] 응답 오류:', error);
            if (error.code === 10062) {
                return;
            }
            throw error;
        }
    }

    // 페이지네이션 설정
    const itemsPerPage = 20;
    const totalPages = Math.ceil(equippableItems.length / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = equippableItems.slice(startIndex, endIndex);

    const itemListEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`${EQUIPMENT_SLOTS[slot].emoji} ${EQUIPMENT_SLOTS[slot].name} 장착`)
        .setDescription(`장착할 아이템을 선택하세요.\n총 ${equippableItems.length}개의 아이템`)
        .setFooter({ text: `페이지 ${currentPage}/${totalPages}` });

    // 아이템 선택 메뉴 (최대 25개)
    const selectOptions = pageItems.slice(0, 25).map((item) => {
        const enhancement = item.enhancement ? ` (+${item.enhancement})` : '';
        const stats = [];
        if (item.stats?.attack) {
            const totalAttack = item.stats.attack + (item.enhancement || 0) * 10;
            stats.push(`⚔️ +${totalAttack}`);
        }
        if (item.stats?.defense) {
            const totalDefense = item.stats.defense + (item.enhancement || 0) * 10;
            stats.push(`🛡️ +${totalDefense}`);
        }
        if (item.stats?.hp) stats.push(`❤️ +${item.stats.hp}`);
        
        // 실제 인벤토리에서의 인덱스 찾기
        const inventoryIndex = user.inventory.findIndex(invItem => invItem === item);
        
        const rarityEmoji = RARITY_EMOJIS[item.rarity] || '';
        
        
        return {
            label: `${item.name}${enhancement}`,
            value: String(inventoryIndex),
            description: stats.join(' ') || '스탯 없음',
            emoji: rarityEmoji || EQUIPMENT_SLOTS[slot].emoji
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`equip_item_${slot}`)
        .setPlaceholder('아이템을 선택하세요')
        .addOptions(selectOptions);

    // 페이지네이션 버튼
    const navigationButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`equip_page_${slot}_${currentPage - 1}`)
                .setLabel('◀️ 이전')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage <= 1),
            new ButtonBuilder()
                .setCustomId(`equip_page_${slot}_${currentPage + 1}`)
                .setLabel('다음 ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= totalPages),
            new ButtonBuilder()
                .setCustomId('equip_category')
                .setLabel('🎽 다른 슬롯')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('equipment')
                .setLabel('⚔️ 장비관리')
                .setStyle(ButtonStyle.Secondary)
        );

    const components = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지가 여러 개인 경우에만 네비게이션 버튼 추가
    if (totalPages > 1 || true) {  // 항상 버튼을 표시
        components.push(navigationButtons);
    }

    try {
        const responseData = {
            embeds: [itemListEmbed],
            components: components
        };
        
        if (interaction.deferred || interaction.replied) {
            console.log('[showEquippableItems] 아이템 목록 표시 - editReply 사용');
            return await interaction.editReply(responseData);
        } else {
            console.log('[showEquippableItems] 아이템 목록 표시 - update 사용');
            return await interaction.update(responseData);
        }
    } catch (error) {
        console.error('[showEquippableItems] 아이템 목록 응답 오류:', error);
        if (error.code === 10062) {
            console.log('[showEquippableItems] Unknown interaction - 타임아웃');
            return;
        }
        throw error;
    }
}


// 최적화 장착 기능
async function optimizeEquipment(interaction) {
    console.log('[optimizeEquipment] 함수 시작');
    console.log('[optimizeEquipment] interaction 상태:', {
        deferred: interaction.deferred,
        replied: interaction.replied,
        customId: interaction.customId
    });
    
    // defer 처리
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
            console.log('[optimizeEquipment] deferUpdate 성공');
        } else {
            console.log('[optimizeEquipment] 이미 deferred 또는 replied 상태');
        }
    } catch (error) {
        console.error('[optimizeEquipment] defer 오류:', error.message);
        if (error.code === 10062) {
            console.log('[optimizeEquipment] Unknown interaction - 타임아웃');
            return;
        }
    }
    
    let user;
    try {
        user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            return await interaction.followUp({ 
                content: '먼저 회원가입을 해주세요!',
                flags: 64
            });
        }
        console.log('[optimizeEquipment] 유저 정보 로드 완료:', user.nickname || user.discordId);
    } catch (error) {
        console.error('[optimizeEquipment] 유저 데이터 로드 오류:', error);
        return await interaction.followUp({ 
            content: '❌ 유저 데이터 로드 중 오류가 발생했습니다.',
            flags: 64
        });
    }
    
    console.log(`[optimizeEquipment] 유저 ${user.nickname || interaction.user.username}의 일괄착용 시작`);
    console.log(`[optimizeEquipment] 인벤토리 아이템 개수: ${user.inventory?.length || 0}`);
    
    let changedSlots = [];
    let totalScoreImprovement = 0;
    
    // 각 슬롯별로 최적 아이템 찾기
    for (const [slot, info] of Object.entries(EQUIPMENT_SLOTS)) {
        const currentSlot = user.equipment?.[slot];
        let currentItem = null;
        
        // inventorySlot으로 찾기
        if (currentSlot >= 0) {
            currentItem = user.inventory?.find(item => item.inventorySlot === currentSlot);
            if (!currentItem) {
                // 배열 인덱스로 찾기 (fallback)
                currentItem = user.inventory?.[currentSlot];
            }
        }
        
        const currentScore = calculateItemScore(currentItem, user.emblem);
        
        if (currentItem) {
            console.log(`[optimizeEquipment] ${slot} 현재 장착: "${currentItem.name}" (인덱스: ${currentSlot}, 점수: ${currentScore}, 희귀도: ${currentItem.rarity}, 강화: +${currentItem.enhancement || 0})`);
        } else {
            console.log(`[optimizeEquipment] ${slot} 현재 장착: 없음`);
        }
        
        // 해당 슬롯에 장착 가능한 모든 아이템 찾기 (인덱스와 함께)
        const availableItems = [];
        user.inventory?.forEach((item, index) => {
            // 아이템 타입 확인
            if (!item.type) {
                console.log(`[optimizeEquipment] 경고: 아이템 "${item.name}"의 타입이 없음`);
                return;
            }
            
            // 해당 슬롯에 맞는 아이템만
            if (item.type === slot) {
                availableItems.push({ item, index });
            }
        });
        
        console.log(`[optimizeEquipment] ${slot} 슬롯: 장착 가능한 아이템 ${availableItems.length}개`);
        
        // 최고 점수 아이템 찾기
        let bestItem = null;
        let bestItemIndex = -1;
        let bestScore = 0;
        
        for (const { item, index } of availableItems) {
            const score = calculateItemScore(item, user.emblem);
            const stats = item.stats ? Object.entries(item.stats).map(([k, v]) => `${k}:${v}`).join(', ') : 'none';
            console.log(`[optimizeEquipment] ${slot} 아이템 평가: "${item.name}" (인덱스: ${index}, 점수: ${score}, 희귀도: ${item.rarity}, 강화: +${item.enhancement || 0}, 스탯: ${stats})`);
            if (score > bestScore) {
                bestScore = score;
                bestItem = item;
                bestItemIndex = index;
            }
        }
        
        if (bestItem) {
            console.log(`[optimizeEquipment] ${slot} 최고 점수 아이템: ${bestItem.name} (점수: ${bestScore}, 인덱스: ${bestItemIndex})`);
        }
        
        // 더 좋은 아이템이 있으면 교체
        if (bestItem && bestScore > currentScore && bestItemIndex !== -1) {
            console.log(`[optimizeEquipment] ${slot} 슬롯 교체: 현재 점수 ${currentScore} → 새 점수 ${bestScore}`);
            console.log(`[optimizeEquipment] 교체 상세: 기존 인덱스 ${currentSlot} → 새 인덱스 ${bestItemIndex}`);
            
            // 현재 장착 슬롯 해제 (이미 인벤토리에 있으므로 추가 작업 불필요)
            if (currentSlot >= 0) {
                // 현재 장착된 아이템은 이미 인벤토리에 있음
            }
            
            // 새 아이템 장착 (inventorySlot 사용)
            user.equipment = user.equipment || {};
            const slotToUse = bestItem.inventorySlot !== undefined ? bestItem.inventorySlot : bestItemIndex;
            user.equipment[slot] = slotToUse;
            console.log(`[optimizeEquipment] ${slot} 슬롯 설정 완료: user.equipment[${slot}] = ${slotToUse} (inventorySlot: ${bestItem.inventorySlot}, index: ${bestItemIndex})`);
            
            // 장착된 아이템은 인벤토리에서 제거하지 않음 (슬롯 번호로 참조)
            
            changedSlots.push({
                slot: info.name,
                emoji: info.emoji,
                oldItem: currentItem,
                newItem: bestItem,
                scoreImprovement: bestScore - currentScore
            });
            
            totalScoreImprovement += bestScore - currentScore;
        }
    }
    
    try {
        // 전투력 재계산
        user.combatPower = calculateCombatPower(user);
        
        // 전투력 재계산
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
        console.log(`[optimizeEquipment] 저장 완료. 변경된 슬롯 수: ${changedSlots.length}`);
        
        // 저장 후 확인
        const savedUser = await getUser(interaction.user.id);
        console.log(`[optimizeEquipment] 저장된 장비 상태:`, savedUser.equipment);
    } catch (saveError) {
        console.error('[optimizeEquipment] 저장 오류:', saveError);
        return await interaction.followUp({
            content: '❌ 장비 저장 중 오류가 발생했습니다.',
            flags: 64
        });
    }
    
    // 결과 메시지 생성
    if (changedSlots.length > 0) {
        const resultEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎆 최적화 장착 완료!')
            .setDescription(`${changedSlots.length}개의 장비가 교체되었습니다.\n총 점수 상승: +${totalScoreImprovement}`)
            .setFooter({ text: '💡 팁: 강화 레벨이 높은 장비가 우선시됩니다!' });
        
        for (const change of changedSlots) {
            const oldName = change.oldItem ? `${change.oldItem.name} (+${change.oldItem.enhancement || 0})` : '비어있음';
            const newName = change.newItem ? `${change.newItem.name} (+${change.newItem.enhancement || 0})` : '알 수 없는 아이템';
            
            // 희귀도 이모지 처리 - 영문/한글 모두 지원
            let rarityEmoji = '';
            if (change.newItem && change.newItem.rarity) {
                // 영문 희귀도를 한글로 변환
                const rarityMap = {
                    'common': '일반',
                    'uncommon': '고급',
                    'rare': '레어',
                    'epic': '에픽',
                    'legendary': '레전드리',
                    'mythic': '신화'
                };
                const rarity = rarityMap[change.newItem.rarity] || change.newItem.rarity;
                rarityEmoji = RARITY_EMOJIS[rarity] || '';
            }
            
            resultEmbed.addFields({
                name: `${change.emoji} ${change.slot}`,
                value: `${oldName} → ${rarityEmoji} **${newName}**\n💯 점수: +${change.scoreImprovement}`,
                inline: true
            });
        }
        
        await interaction.followUp({
            embeds: [resultEmbed],
            flags: 64
        });
    } else {
        await interaction.followUp({
            content: '✅ 이미 최적의 장비를 착용 중입니다!',
            flags: 64
        });
    }
    
    // 장비 화면 다시 표시
    return await showEquipment(interaction);
}

// 아이템 장착 처리
async function equipItem(interaction, slot, itemIndex) {
    console.log('[equipItem] 함수 시작 - 슬롯:', slot, '아이템 인덱스:', itemIndex);
    
    // defer 처리
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
            console.log('[equipItem] deferUpdate 성공');
        }
    } catch (error) {
        console.error('[equipItem] defer 오류:', error.message);
        if (error.code === 10062) {
            return;
        }
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.followUp({ 
            content: '먼저 회원가입을 해주세요!',
            flags: 64
        });
    }
    
    
    // 현재 장착된 아이템 확인
    const currentSlot = user.equipment?.[slot];
    
    // 장비 해제
    if (itemIndex === -1) {
        if (currentSlot >= 0) {
            user.equipment[slot] = -1;
            // 전투력 재계산
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
            
            await interaction.followUp({
                content: `✅ ${EQUIPMENT_SLOTS[slot].name}을(를) 해제했습니다.`,
                flags: 64
            });
        }
    } else {
        // 새 아이템 확인
        console.log(`[equipItem] 장착 시도 - 슬롯: ${slot}, 인덱스: ${itemIndex}`);
        console.log(`[equipItem] 인벤토리 크기: ${user.inventory?.length || 0}`);
        
        // inventorySlot으로 아이템 찾기 (우선), 못 찾으면 인덱스로 찾기
        let newItem = user.inventory?.find(item => item.inventorySlot === itemIndex);
        if (!newItem) {
            newItem = user.inventory?.[itemIndex];
        }
        
        if (!newItem) {
            console.log(`[equipItem] 아이템을 찾을 수 없음 - 인덱스/슬롯: ${itemIndex}`);
            return await interaction.followUp({
                content: `❌ 아이템을 찾을 수 없습니다. (인덱스: ${itemIndex})`,
                flags: 64
            });
        }
        
        console.log(`[equipItem] 찾은 아이템: ${newItem.name}, 타입: ${newItem.type}, inventorySlot: ${newItem.inventorySlot}`);
        
        // 각 슬롯에 맞는 타입만 장착 가능
        const isValidType = newItem.type === slot;
        
        if (!isValidType) {
            return await interaction.followUp({
                content: '❌ 이 슬롯에 장착할 수 없는 아이템입니다.',
                flags: 64
            });
        }
        
        // inventorySlot을 사용하여 장착
        const slotToUse = newItem.inventorySlot !== undefined ? newItem.inventorySlot : itemIndex;
        
        // 이미 다른 슬롯에 장착 중인지 확인
        const alreadyEquipped = Object.entries(user.equipment || {}).find(
            ([s, idx]) => s !== slot && idx === slotToUse
        );
        
        if (alreadyEquipped) {
            return await interaction.followUp({
                content: `❌ 이 아이템은 이미 ${EQUIPMENT_SLOTS[alreadyEquipped[0]].name}에 장착 중입니다.`,
                flags: 64
            });
        }
        
        // 장비 설정
        if (!user.equipment) user.equipment = {};
        user.equipment[slot] = slotToUse;
        
        // inventorySlot 필드도 설정
        if (newItem.inventorySlot === undefined) {
            newItem.inventorySlot = itemIndex;
            user.markModified('inventory');
        }
        
        // 전투력 재계산
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
        
        // 희귀도 이모지 처리 - 영문/한글 모두 지원
        let rarityEmoji = '';
        if (newItem.rarity) {
            // 영문 희귀도를 한글로 변환
            const rarityMap = {
                'common': '일반',
                'uncommon': '고급',
                'rare': '레어',
                'epic': '에픽',
                'legendary': '레전드리',
                'mythic': '신화'
            };
            const rarity = rarityMap[newItem.rarity] || newItem.rarity;
            rarityEmoji = RARITY_EMOJIS[rarity] || '';
        }
        
        const enhancement = newItem.enhancement ? ` (+${newItem.enhancement})` : '';
        
        await interaction.followUp({
            content: `✅ ${rarityEmoji} **${newItem.name}**${enhancement}을(를) ${EQUIPMENT_SLOTS[slot].name}에 장착했습니다.`,
            flags: 64
        });
    }
    
    // 장비 화면 다시 표시
    return await showEquipment(interaction);
}

// 전체 장비 해제
async function unequipAll(interaction) {
    // Safe defer handling
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('[Equipment] Interaction expired');
            return;
        }
        console.error('[Equipment] Defer error:', error);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!',
            embeds: [],
            components: []
        });
    }
    
    // 모든 장비 슬롯 초기화
    let unequippedCount = 0;
    if (user.equipment) {
        for (const slot of Object.keys(EQUIPMENT_SLOTS)) {
            if (user.equipment[slot] >= 0) {
                user.equipment[slot] = -1;
                unequippedCount++;
            }
        }
    }
    
    if (unequippedCount === 0) {
        await interaction.followUp({
            content: 'ℹ️ 장착 중인 장비가 없습니다.',
            flags: 64
        });
    } else {
        // 전투력 재계산
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
        await interaction.followUp({
            content: `✅ ${unequippedCount}개의 장비를 모두 해제했습니다.`,
            flags: 64
        });
    }
    
    // 장비 화면 다시 표시
    return await showEquipment(interaction);
}

// 아이템 장착 핸들러
async function handleEquipItem(interaction) {
    console.log('[handleEquipItem] 함수 시작');
    console.log('[handleEquipItem] customId:', interaction.customId);
    
    // equip_item_slot 형식
    const parts = interaction.customId.split('_');
    const slot = parts[2];
    const selectedValues = interaction.values;
    
    console.log('[handleEquipItem] 슬롯:', slot, '선택된 값:', selectedValues);
    
    if (!selectedValues || selectedValues.length === 0) {
        return await interaction.reply({
            content: '❌ 아이템을 선택해주세요.',
            flags: 64
        });
    }
    
    const itemIndex = parseInt(selectedValues[0]);
    console.log('[handleEquipItem] 아이템 인덱스:', itemIndex);
    
    return await equipItem(interaction, slot, itemIndex);
}

// 장비 해제 핸들러
async function handleUnequip(interaction) {
    // unequip_slot 형식
    const parts = interaction.customId.split('_');
    const slot = parts[1];
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.reply({
            content: '먼저 회원가입을 해주세요!',
            flags: 64
        });
    }
    
    // 해당 슬롯의 장비 해제
    if (user.equipment && user.equipment[slot] >= 0) {
        user.equipment[slot] = -1;
        // 전투력 재계산
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
        
        await interaction.reply({
            content: `✅ ${EQUIPMENT_SLOTS[slot].name} 장비를 해제했습니다.`,
            flags: 64
        });
    } else {
        await interaction.reply({
            content: `❌ ${EQUIPMENT_SLOTS[slot].name} 슬롯에 장착된 장비가 없습니다.`,
            flags: 64
        });
    }
    
    // 장비 화면 다시 표시
    return await showEquipment(interaction);
}

// 장비 슬롯 선택 핸들러
async function handleEquipmentSlotSelect(interaction) {
    // equipment_slot_slot 형식
    const parts = interaction.customId.split('_');
    const slot = parts[2];
    
    // 해당 슬롯의 장착 가능한 아이템 표시
    return await showEquippableItems(interaction, slot);
}

module.exports = {
    showEquipment,
    showEquipCategory,
    showEquippableItems,
    optimizeEquipment,
    equipItem,
    unequipAll,
    handleEquipItem,
    handleUnequip,
    handleEquipmentSlotSelect
};