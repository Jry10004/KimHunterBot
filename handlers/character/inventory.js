const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getUser, formatNumber } = require('../common/utils');

// 아이템 타입별 이모지
const ITEM_TYPE_EMOJIS = {
    weapon: '🗡️',
    armor: '🛡️',
    helmet: '⛑️',
    gloves: '🧤',
    boots: '👢',
    accessory: '💍',
    consumable: '🧪',
    material: '🔧',
    quest: '📜',
    misc: '📦'
};

// 희귀도별 색상 및 이모지
const RARITY_COLORS = {
    일반: '#95a5a6',
    고급: '#3498db',
    레어: '#9b59b6',
    에픽: '#e74c3c',
    레전드리: '#f39c12',
    신화: '#ff00ff',
    // 영문 희귀도 지원
    common: '#95a5a6',
    uncommon: '#3498db',
    rare: '#9b59b6',
    epic: '#e74c3c',
    legendary: '#f39c12'
};

const RARITY_EMOJIS = {
    일반: '⬜',
    고급: '🔵',
    레어: '🟣',
    에픽: '🔴',
    레전드리: '🟠',
    신화: '✨',
    // 영문 희귀도 지원
    common: '⬜',
    uncommon: '🔵',
    rare: '🟣',
    epic: '🔴',
    legendary: '🟠'
};

// 희귀도 한글 변환 함수
function getRarityKorean(rarity) {
    const rarityMap = {
        common: '일반',
        uncommon: '고급',
        rare: '레어',
        epic: '에픽',
        legendary: '레전드리'
    };
    return rarityMap[rarity] || rarity || '일반';
}

async function showInventory(interaction, page = 1, sortMode = null) {
    // Defer 처리
    try {
        if (!interaction.deferred && !interaction.replied) {
            if (interaction.isStringSelectMenu() || interaction.isButton()) {
                await interaction.deferUpdate();
            } else {
                await interaction.deferReply({ flags: 64 });
            }
        }
    } catch (error) {
        // Unknown interaction 에러 처리
        if (error.code === 10062) {
            console.log('[Inventory] Interaction expired');
            return;
        }
        console.error('[Inventory] Defer error:', error);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
            embeds: [],
            components: []
        });
    }

    // 인벤토리 정렬
    let sortedInventory = [...(user.inventory || [])];
    if (sortMode === 'sorted') {
        // 레어도 순서 정의
        const rarityOrder = {
            '신화': 1,
            '전설': 2,
            '영웅': 3,
            '희귀': 4,
            '고급': 5,
            '일반': 6
        };
        
        sortedInventory.sort((a, b) => {
            // 먼저 레어도로 정렬
            const rarityA = rarityOrder[a.rarity] || 999;
            const rarityB = rarityOrder[b.rarity] || 999;
            if (rarityA !== rarityB) return rarityA - rarityB;
            
            // 같은 레어도면 전투력으로 정렬
            const powerA = a.attack + a.defense + a.magic + a.health;
            const powerB = b.attack + b.defense + b.magic + b.health;
            return powerB - powerA;
        });
        
        // 정렬된 인벤토리를 저장
        user.inventory = sortedInventory;
        await user.save();
    }

    const itemsPerPage = 10;
    const totalItems = sortedInventory.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    
    // 페이지 범위 체크
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = sortedInventory.slice(startIndex, endIndex);

    // 인벤토리 임베드
    const inventoryEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`🎒 ${user.nickname || interaction.user.username}님의 인벤토리`)
        .setDescription(`**골드**: ${formatNumber(user.gold)}G\n**슬롯**: ${totalItems}/${user.inventorySize || 50}`)
        .setFooter({ text: `페이지 ${page}/${totalPages}` });

    // 아이템 목록 표시
    if (pageItems.length === 0) {
        inventoryEmbed.addFields({
            name: '📦 보유 아이템',
            value: '인벤토리가 비어있습니다.',
            inline: false
        });
    } else {
        const itemList = pageItems.map((item, index) => {
            const emoji = ITEM_TYPE_EMOJIS[item.type] || '📦';
            const rarityKorean = getRarityKorean(item.rarity);
            const rarityEmoji = RARITY_EMOJIS[rarityKorean] || RARITY_EMOJIS[item.rarity] || RARITY_EMOJIS['일반'];
            const enhancement = item.enhancement ? ` (+${item.enhancement})` : '';
            const quantity = item.quantity > 1 ? ` x${item.quantity}` : '';
            
            // 착용 중인 아이템 표시
            const isEquipped = user.equipment && Object.values(user.equipment).some(slotIdx => 
                slotIdx === startIndex + index
            );
            const equippedMark = isEquipped ? ' 📦**[E]**' : '';
            
            // 스탯 표시
            let statPreview = '';
            if (item.stats && ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)) {
                const mainStat = item.stats.attack ? `⚔️${item.stats.attack + (item.enhancement || 0) * 10}` :
                               item.stats.defense ? `🛡️${item.stats.defense + (item.enhancement || 0) * 10}` : '';
                statPreview = mainStat ? ` [${mainStat}]` : '';
            }
            
            return `${startIndex + index + 1}. ${emoji} ${rarityEmoji} **${item.name}**${enhancement}${statPreview}${quantity}${equippedMark}`;
        }).join('\n');

        inventoryEmbed.addFields({
            name: '📦 보유 아이템',
            value: itemList,
            inline: false
        });
    }

    // 카테고리별 아이템 수 표시
    const categoryCounts = {};
    (user.inventory || []).forEach(item => {
        categoryCounts[item.type] = (categoryCounts[item.type] || 0) + 1;
    });

    if (Object.keys(categoryCounts).length > 0) {
        const categoryInfo = Object.entries(categoryCounts)
            .map(([type, count]) => `${ITEM_TYPE_EMOJIS[type] || '📦'} ${type}: ${count}개`)
            .join('\n');

        inventoryEmbed.addFields({
            name: '📊 카테고리별 현황',
            value: categoryInfo,
            inline: true
        });
    }

    // 버튼을 두 줄로 나눔 (Discord는 한 줄에 최대 5개까지만 허용)
    const navigationButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`inventory_page_${page - 1}`)
                .setLabel('◀️ 이전')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page <= 1),
            new ButtonBuilder()
                .setCustomId(`inventory_page_${page + 1}`)
                .setLabel('다음 ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages),
            new ButtonBuilder()
                .setCustomId('inventory_sort')
                .setLabel('📑 정렬')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('equipment')
                .setLabel('⚔️ 장비 관리')
                .setStyle(ButtonStyle.Primary)
        );
    
    const actionButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('market_prices')
                .setLabel('📊 시세 확인')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    // 아이템 선택 메뉴 (아이템이 있을 때만)
    const components = [navigationButtons, actionButtons];
    
    if (pageItems.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('inventory_item_select')
            .setPlaceholder('아이템을 선택하세요')
            .addOptions(
                pageItems.map((item, index) => {
                    const rarityKorean = getRarityKorean(item.rarity);
                    const rarityEmoji = RARITY_EMOJIS[rarityKorean] || RARITY_EMOJIS[item.rarity] || RARITY_EMOJIS['일반'];
                    const enhancement = item.enhancement ? ` (+${item.enhancement})` : '';
                    let statPreview = '';
                    
                    if (item.stats) {
                        if (item.stats.attack) statPreview = ` | ⚔️${item.stats.attack + (item.enhancement || 0) * 10}`;
                        else if (item.stats.defense) statPreview = ` | 🛡️${item.stats.defense + (item.enhancement || 0) * 10}`;
                    }
                    
                    return {
                        label: `${item.name}${enhancement}`,
                        description: `${rarityEmoji} ${rarityKorean}${statPreview}`,
                        value: `${startIndex + index}`,
                        emoji: ITEM_TYPE_EMOJIS[item.type] || '📦'
                    };
                })
            );

        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply({
                embeds: [inventoryEmbed],
                components: components,
            });
        } else {
            return await interaction.reply({
                embeds: [inventoryEmbed],
                components: components,
                flags: 64
            });
        }
    } catch (error) {
        console.error('[Inventory] Reply error:', error);
        if (error.code !== 10062) { // Unknown interaction 에러가 아닌 경우만 로그
            console.error('Inventory response error details:', error);
        }
    }
}

// 아이템 상세 정보 표시
async function showItemDetail(interaction, itemIndex) {
    // deferUpdate 제거 - 이미 다른 곳에서 처리됨
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!',
            embeds: [],
            components: []
        });
    }

    const item = user.inventory[itemIndex];
    if (!item) {
        return await interaction.editReply({ 
            content: '아이템을 찾을 수 없습니다.', 
            flags: 64 
        });
    }

    const rarityKorean = getRarityKorean(item.rarity);
    const rarityEmoji = RARITY_EMOJIS[rarityKorean] || RARITY_EMOJIS[item.rarity] || RARITY_EMOJIS['일반'];
    const itemEmbed = new EmbedBuilder()
        .setColor(RARITY_COLORS[rarityKorean] || RARITY_COLORS[item.rarity] || '#95a5a6')
        .setTitle(`${ITEM_TYPE_EMOJIS[item.type] || '📦'} ${rarityEmoji} ${item.name}`)
        .setDescription(item.description || '설명이 없습니다.')
        .addFields(
            { name: '종류', value: item.type, inline: true },
            { name: '희귀도', value: `${rarityEmoji} ${rarityKorean}`, inline: true },
            { name: '수량', value: `${item.quantity || 1}개`, inline: true }
        );

    // 장비 아이템인 경우 스탯 표시 및 비교
    if (item.stats && ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)) {
        const statInfo = [];
        const enhancement = item.enhancement || 0;
        
        if (item.stats.attack) {
            const totalAttack = item.stats.attack + enhancement * 10;
            statInfo.push(`⚔️ 공격력: +${totalAttack} (기본 ${item.stats.attack} + 강화 ${enhancement * 10})`);
        }
        if (item.stats.defense) {
            const totalDefense = item.stats.defense + enhancement * 10;
            statInfo.push(`🛡️ 방어력: +${totalDefense} (기본 ${item.stats.defense} + 강화 ${enhancement * 10})`);
        }
        if (item.stats.strength) statInfo.push(`💪 힘: +${item.stats.strength}`);
        if (item.stats.agility) statInfo.push(`🏃 민첩: +${item.stats.agility}`);
        if (item.stats.intelligence) statInfo.push(`🧠 지능: +${item.stats.intelligence}`);
        if (item.stats.vitality) statInfo.push(`❤️ 체력: +${item.stats.vitality}`);
        if (item.stats.luck) statInfo.push(`🍀 행운: +${item.stats.luck}`);
        if (item.stats.hp) {
            const totalHp = item.stats.hp + enhancement * 20;
            statInfo.push(`💖 추가 HP: +${totalHp} (기본 ${item.stats.hp} + 강화 ${enhancement * 20})`);
        }
        if (item.stats.dodge) statInfo.push(`💨 회피: +${item.stats.dodge}`);

        if (statInfo.length > 0) {
            itemEmbed.addFields({
                name: '📊 아이템 능력치',
                value: statInfo.join('\n'),
                inline: false
            });
        }
        
        // 현재 착용 장비와 비교
        const equippedSlot = user.equipment?.[item.type];
        const equippedItem = (equippedSlot >= 0 && user.inventory?.[equippedSlot]) ? user.inventory[equippedSlot] : null;
        if (equippedItem && equippedItem.name !== item.name) {
            const compareInfo = [];
            compareInfo.push(`**[현재 착용: ${equippedItem.name} (+${equippedItem.enhancement || 0})]**`);
            
            // 공격력 비교
            if (item.stats.attack || equippedItem.stats?.attack) {
                const newAttack = (item.stats.attack || 0) + enhancement * 10;
                const currentAttack = (equippedItem.stats?.attack || 0) + (equippedItem.enhancement || 0) * 10;
                const diff = newAttack - currentAttack;
                const diffText = diff > 0 ? `+${diff}` : `${diff}`;
                const diffColor = diff > 0 ? '🔺' : diff < 0 ? '🔻' : '➡️';
                compareInfo.push(`⚔️ 공격력: ${currentAttack} → ${newAttack} (${diffColor} ${diffText})`);
            }
            
            // 방어력 비교
            if (item.stats.defense || equippedItem.stats?.defense) {
                const newDefense = (item.stats.defense || 0) + enhancement * 10;
                const currentDefense = (equippedItem.stats?.defense || 0) + (equippedItem.enhancement || 0) * 10;
                const diff = newDefense - currentDefense;
                const diffText = diff > 0 ? `+${diff}` : `${diff}`;
                const diffColor = diff > 0 ? '🔺' : diff < 0 ? '🔻' : '➡️';
                compareInfo.push(`🛡️ 방어력: ${currentDefense} → ${newDefense} (${diffColor} ${diffText})`);
            }
            
            // HP 비교
            if (item.stats.hp || equippedItem.stats?.hp) {
                const newHp = (item.stats.hp || 0) + enhancement * 20;
                const currentHp = (equippedItem.stats?.hp || 0) + (equippedItem.enhancement || 0) * 20;
                const diff = newHp - currentHp;
                const diffText = diff > 0 ? `+${diff}` : `${diff}`;
                const diffColor = diff > 0 ? '🔺' : diff < 0 ? '🔻' : '➡️';
                compareInfo.push(`❤️ 체력: ${currentHp} → ${newHp} (${diffColor} ${diffText})`);
            }
            
            itemEmbed.addFields({
                name: '🔄 장비 비교',
                value: compareInfo.join('\n'),
                inline: false
            });
        }
    }

    // 강화 정보
    if (item.enhancement) {
        itemEmbed.addFields({
            name: '✨ 강화',
            value: `+${item.enhancement}`,
            inline: true
        });
    }

    // 가격 정보
    const sellPrice = Math.floor((item.price || 0) * 0.3);
    itemEmbed.addFields({
        name: '💰 판매 가격',
        value: `${formatNumber(sellPrice)}G`,
        inline: true
    });

    // 버튼 생성
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`item_equip_${itemIndex}`)
                .setLabel('🎽 장착')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!['weapon', 'armor', 'helmet', 'gloves', 'boots', 'shield', 'accessory'].includes(item.type)),
            new ButtonBuilder()
                .setCustomId(`item_use_${itemIndex}`)
                .setLabel('💊 사용')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(item.type !== 'consumable'),
            new ButtonBuilder()
                .setCustomId(`item_sell_${itemIndex}`)
                .setLabel('💸 판매')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('inventory')
                .setLabel('🎒 인벤토리로')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [itemEmbed],
        components: [buttons]
    });
}

// 인벤토리에서 아이템 장착
async function equipItemFromInventory(interaction, itemIndex) {
    await interaction.deferUpdate().catch(() => {});
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.followUp({ 
            content: '먼저 회원가입을 해주세요!',
            flags: 64
        });
    }
    
    const item = user.inventory[itemIndex];
    if (!item) {
        return await interaction.followUp({ 
            content: '아이템을 찾을 수 없습니다.', 
            flags: 64 
        });
    }
    
    
    // 장비 타입이 아닌 경우
    const equipableTypes = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'shield', 'accessory'];
    if (!equipableTypes.includes(item.type)) {
        return await interaction.followUp({ 
            content: `이 아이템은 장착할 수 없습니다. (타입: ${item.type})`, 
            flags: 64 
        });
    }
    
    // 아이템 타입 그대로 사용
    const slotType = item.type;
    
    // 현재 장착 중인 아이템 확인
    const currentSlot = user.equipment?.[slotType];
    
    // 장비 설정 - inventorySlot을 사용
    if (!user.equipment) user.equipment = {};
    
    // inventorySlot이 있으면 그것을 사용, 없으면 인덱스 사용
    const slotToUse = item.inventorySlot !== undefined ? item.inventorySlot : itemIndex;
    user.equipment[slotType] = slotToUse;
    
    // 인벤토리 아이템의 equipped 상태 업데이트
    user.inventory[itemIndex].equipped = true;
    
    // 이전에 장착된 아이템이 있으면 해제
    if (currentSlot >= 0 && currentSlot !== slotToUse) {
        // inventorySlot으로 아이템 찾기
        const prevItem = user.inventory.find(item => item.inventorySlot === currentSlot);
        if (prevItem) {
            prevItem.equipped = false;
        }
    }
    
    await user.save();
    
    const rarityKorean = getRarityKorean(item.rarity);
    const rarityEmoji = RARITY_EMOJIS[rarityKorean] || RARITY_EMOJIS[item.rarity] || RARITY_EMOJIS['일반'];
    const enhancement = item.enhancement ? ` (+${item.enhancement})` : '';
    const EQUIPMENT_SLOTS = {
        weapon: '🗿️ 무기',
        armor: '🛡️ 갑옷',
        helmet: '⛑️ 투구',
        gloves: '🧤 장갑',
        boots: '👢 신발',
        shield: '🛡️ 방패',
        accessory: '💍 악세서리'
    };
    
    // 장착 슬롯 표시
    const displaySlot = EQUIPMENT_SLOTS[item.type];
    
    await interaction.followUp({
        content: `✅ ${rarityEmoji} **${item.name}**${enhancement}을(를) ${displaySlot}에 장착했습니다.`,
        flags: 64
    });
    
    // 인벤토리 화면 다시 표시
    const currentPage = Math.floor(itemIndex / 10) + 1;
    return await showInventory(interaction, currentPage);
}

module.exports = {
    showInventory,
    showItemDetail,
    equipItemFromInventory
};