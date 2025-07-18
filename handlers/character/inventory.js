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
        .setDescription(`**골드**: ${formatNumber(user.gold)}G\n**슬롯**: ${totalItems}/${user.maxInventorySlots || 50}`)
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
            const currentItemIndex = startIndex + index;
            const isEquipped = user.equipment && Object.values(user.equipment).some(slotIdx => {
                // inventorySlot이 있는 경우 inventorySlot으로 비교
                if (item.inventorySlot !== undefined) {
                    return slotIdx === item.inventorySlot;
                }
                // 없으면 인덱스로 비교
                return slotIdx === currentItemIndex;
            });
            const equippedMark = isEquipped ? ' 📦**[E]**' : '';
            
            // 스탯 표시
            let statPreview = '';
            if (['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)) {
                // 구버전 호환성을 위한 stats 객체 생성
                const itemStats = item.stats || {};
                
                // 디버그: 아이템 스탯 상세 확인
                console.log(`[Inventory] ${item.name}:`, {
                    hasStats: !!item.stats,
                    itemStats: itemStats,
                    statKeys: Object.keys(itemStats),
                    rawItem: {
                        attack: item.attack,
                        defense: item.defense,
                        intelligence: item.intelligence,
                        vitality: item.vitality,
                        stats: item.stats
                    }
                });
                if (!item.stats) {
                    // 구버전 아이템의 개별 속성들을 stats 객체로 복사
                    if (item.attack !== undefined) itemStats.attack = item.attack;
                    if (item.defense !== undefined) itemStats.defense = item.defense;
                    if (item.magic !== undefined) itemStats.magic = item.magic;
                    if (item.strength !== undefined) itemStats.strength = item.strength;
                    if (item.agility !== undefined) itemStats.agility = item.agility;
                    if (item.intelligence !== undefined) itemStats.intelligence = item.intelligence;
                    if (item.vitality !== undefined) itemStats.vitality = item.vitality;
                    if (item.luck !== undefined) itemStats.luck = item.luck;
                    if (item.hp !== undefined) itemStats.hp = item.hp;
                    if (item.dodge !== undefined) itemStats.dodge = item.dodge;
                    if (item.evasion !== undefined) itemStats.dodge = item.evasion;
                }
                
                // stats 객체가 있더라도 값이 0인 스탯은 표시하지 않도록 필터링
                const filteredStats = {};
                for (const [key, value] of Object.entries(itemStats)) {
                    if (value > 0) {
                        filteredStats[key] = value;
                    }
                }
                
                // 강화 배율 계산
                let totalMultiplier = 1;
                const enhanceLevel = item.enhanceLevel || item.enhancement || 0;
                if (enhanceLevel > 0) {
                    for (let i = 1; i <= enhanceLevel; i++) {
                        if (i <= 5) totalMultiplier += 0.02;
                        else if (i <= 10) totalMultiplier += 0.03;
                        else if (i <= 15) totalMultiplier += 0.04;
                        else if (i <= 20) totalMultiplier += 0.05;
                        else if (i <= 25) totalMultiplier += 0.06;
                        else totalMultiplier += 0.07;
                    }
                }
                
                // 모든 스탯 수집
                const statParts = [];
                
                // 직업별 공격력 표시
                const emblemName = user.emblem ? user.emblem.replace(/\s*\+\d+$/, '') : '';
                const equippedEmblemName = user.equippedEmblem ? user.equippedEmblem.replace(/\s*\+\d+$/, '') : '';
                const checkEmblem = equippedEmblemName || emblemName;
                
                const isMage = checkEmblem && (
                    checkEmblem.includes('마법사') || checkEmblem.includes('원소 술사') || 
                    checkEmblem.includes('신비한 현자') || checkEmblem.includes('대마법사') || 
                    checkEmblem.includes('아크메이지')
                );
                
                // 필터링된 스탯 사용 (0이 아닌 값만)
                // 공격력/마력
                if (filteredStats.attack) {
                    const totalAttack = filteredStats.attack;
                    const attackEmoji = isMage ? '🔮' : '⚔️';
                    statParts.push(`${attackEmoji}${totalAttack}`);
                }
                
                // 방어력
                if (filteredStats.defense) {
                    const totalDefense = filteredStats.defense;
                    statParts.push(`🛡️${totalDefense}`);
                }
                
                // 기본 스탯들
                if (filteredStats.strength) {
                    statParts.push(`💪${filteredStats.strength}`);
                }
                if (filteredStats.agility) {
                    statParts.push(`🏃${filteredStats.agility}`);
                }
                if (filteredStats.intelligence) {
                    statParts.push(`🧠${filteredStats.intelligence}`);
                }
                if (filteredStats.vitality) {
                    statParts.push(`❤️${filteredStats.vitality}`);
                }
                if (filteredStats.luck) {
                    statParts.push(`🍀${filteredStats.luck}`);
                }
                if (filteredStats.hp) {
                    statParts.push(`💖${filteredStats.hp}`);
                }
                
                // 특수 스탯들
                if (filteredStats.magic) {
                    statParts.push(`🔮${filteredStats.magic}`);
                }
                if (filteredStats.dodge) {
                    statParts.push(`💨${filteredStats.dodge}`);
                }
                
                // TODO: 아래 스탯들은 아이템에 구현될 때 표시됩니다
                // 새로운 특수 옵션 아이템 추가 시 이 코드를 참고하세요
                if (filteredStats.criticalChance) {
                    statParts.push(`⚡${filteredStats.criticalChance}%`);
                }
                if (filteredStats.criticalDamage) {
                    statParts.push(`💥${filteredStats.criticalDamage}%`);
                }
                if (filteredStats.goldBonus) {
                    statParts.push(`💰${filteredStats.goldBonus}%`);
                }
                if (filteredStats.expBonus) {
                    statParts.push(`✨${filteredStats.expBonus}%`);
                }
                
                // 기타 스탯들 (위에 정의되지 않은 스탯들)
                for (const [stat, value] of Object.entries(filteredStats)) {
                    if (value > 0 && !['attack', 'defense', 'strength', 'agility', 'intelligence', 
                        'vitality', 'luck', 'hp', 'magic', 'dodge', 'criticalChance', 
                        'criticalDamage', 'goldBonus', 'expBonus'].includes(stat)) {
                        statParts.push(`📊${stat}:${value}`);
                    }
                }
                
                statPreview = statParts.length > 0 ? ` [${statParts.join(' ')}]` : '';
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
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    // 아이템 선택 메뉴 (아이템이 있을 때만)
    const components = [navigationButtons, actionButtons];
    
    if (pageItems.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('inventory_item_select')
            .setPlaceholder('아이템을 선택하여 상세보기')
            .addOptions(
                pageItems.map((item, index) => {
                    const rarityKorean = getRarityKorean(item.rarity);
                    const rarityEmoji = RARITY_EMOJIS[rarityKorean] || RARITY_EMOJIS[item.rarity] || RARITY_EMOJIS['일반'];
                    const enhancement = item.enhancement ? ` (+${item.enhancement})` : '';
                    let statPreview = '';
                    
                    // 구버전 호환성을 위한 stats 객체 생성
                    const itemStats = {};
                    if (item.stats) {
                        Object.assign(itemStats, item.stats);
                    } else {
                        // 구버전 아이템 처리
                        if (item.attack !== undefined) itemStats.attack = item.attack;
                        if (item.defense !== undefined) itemStats.defense = item.defense;
                        if (item.strength !== undefined) itemStats.strength = item.strength;
                        if (item.agility !== undefined) itemStats.agility = item.agility;
                        if (item.intelligence !== undefined) itemStats.intelligence = item.intelligence;
                        if (item.vitality !== undefined) itemStats.vitality = item.vitality;
                        if (item.luck !== undefined) itemStats.luck = item.luck;
                        if (item.hp !== undefined) itemStats.hp = item.hp;
                        if (item.dodge !== undefined) itemStats.dodge = item.dodge;
                    }
                    
                    if (Object.keys(itemStats).length > 0) {
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
                        
                        // TOP 3 스탯 표시
                        const allStats = [];
                        const attackEmoji = isMage ? '🔮' : '⚔️';
                        
                        if (itemStats.attack) allStats.push({ value: itemStats.attack, display: `${attackEmoji}${itemStats.attack}`, priority: 1 });
                        if (itemStats.defense) allStats.push({ value: itemStats.defense, display: `🛡️${itemStats.defense}`, priority: 2 });
                        if (itemStats.strength) allStats.push({ value: itemStats.strength, display: `💪${itemStats.strength}`, priority: 3 });
                        if (itemStats.agility) allStats.push({ value: itemStats.agility, display: `🏃${itemStats.agility}`, priority: 3 });
                        if (itemStats.intelligence) allStats.push({ value: itemStats.intelligence, display: `🧠${itemStats.intelligence}`, priority: 3 });
                        if (itemStats.vitality) allStats.push({ value: itemStats.vitality, display: `❤️${itemStats.vitality}`, priority: 3 });
                        if (itemStats.luck) allStats.push({ value: itemStats.luck, display: `🍀${itemStats.luck}`, priority: 3 });
                        if (itemStats.hp) allStats.push({ value: itemStats.hp, display: `💖${itemStats.hp}`, priority: 2 });
                        
                        // 우선순위와 값으로 정렬
                        allStats.sort((a, b) => {
                            if (a.priority !== b.priority) return a.priority - b.priority;
                            return b.value - a.value;
                        });
                        
                        // 상위 3개만 표시
                        const topStats = allStats.slice(0, 3);
                        if (topStats.length > 0) {
                            statPreview = ` | ${topStats.map(s => s.display).join(' ')}`;
                        }
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
    const enhancement = item.enhancement || item.enhanceLevel || 0;
    
    // 아이템 타입 한글화
    const typeKorean = {
        weapon: '무기',
        armor: '갑옷',
        helmet: '투구',
        gloves: '장갑',
        boots: '신발',
        shield: '방패',
        accessory: '악세서리',
        consumable: '소비',
        material: '재료',
        quest: '퀘스트',
        misc: '기타'
    }[item.type] || item.type;
    
    const itemEmbed = new EmbedBuilder()
        .setColor(RARITY_COLORS[rarityKorean] || RARITY_COLORS[item.rarity] || '#95a5a6')
        .setTitle(`${ITEM_TYPE_EMOJIS[item.type] || '📦'} ${rarityEmoji} ${item.name}`)
        .setDescription(item.description || '설명이 없습니다.')
        .addFields(
            { name: '종류', value: typeKorean, inline: true },
            { name: '희귀도', value: `${rarityEmoji} ${rarityKorean}`, inline: true },
            { name: '수량', value: `${item.quantity || 1}개`, inline: true }
        );

    // 장비 아이템인 경우 스탯 표시 및 비교
    if (['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)) {
        // 항상 item.stats를 우선적으로 사용 (이미 강화 보너스가 적용된 값)
        const itemStats = {};
        
        // item.stats가 있으면 그대로 사용
        if (item.stats) {
            Object.assign(itemStats, item.stats);
        } else {
            // 구버전 호환성: stats가 없는 경우 개별 속성들을 사용
            if (item.attack !== undefined) itemStats.attack = item.attack;
            if (item.defense !== undefined) itemStats.defense = item.defense;
            if (item.strength !== undefined) itemStats.strength = item.strength;
            if (item.agility !== undefined) itemStats.agility = item.agility;
            if (item.intelligence !== undefined) itemStats.intelligence = item.intelligence;
            if (item.vitality !== undefined) itemStats.vitality = item.vitality;
            if (item.luck !== undefined) itemStats.luck = item.luck;
            if (item.hp !== undefined) itemStats.hp = item.hp;
            if (item.dodge !== undefined) itemStats.dodge = item.dodge;
            if (item.evasion !== undefined) itemStats.dodge = item.evasion;
        }
        // 강화 레벨 확인 (강화 배율은 이미 stats에 적용되어 있음)
        const enhanceLevel = item.enhanceLevel || 0;
        
        // 마법사 엠블럼 확인 (강화 수치 제거)
        const emblemName = user.emblem ? user.emblem.replace(/\s*\+\d+$/, '') : '';
        const equippedEmblemName = user.equippedEmblem ? user.equippedEmblem.replace(/\s*\+\d+$/, '') : '';
        const checkEmblem = equippedEmblemName || emblemName;
        
        const isMage = checkEmblem && (
            checkEmblem === '견습 마법사' || 
            checkEmblem === '원소 술사' ||
            checkEmblem === '신비한 현자' ||
            checkEmblem === '대마법사' ||
            checkEmblem === '전설의 아크메이지' ||
            checkEmblem.includes('마법사') ||
            checkEmblem.includes('아크메이지')
        );
        
        // 모든 스탯을 수집하여 배열에 저장
        const allStats = [];
        
        if (itemStats.attack) {
            // stats에 이미 강화 보너스가 포함되어 있음
            const totalAttack = itemStats.attack;
            const baseAttack = item.baseStats?.attack || totalAttack;
            const enhanceBonus = item.enhanceLevel > 0 ? totalAttack - baseAttack : 0;
            const attackLabel = isMage ? '🔮 마력' : '⚔️ 공격력';
            allStats.push({
                value: totalAttack,
                display: `${attackLabel}: +${totalAttack}${enhanceBonus > 0 ? ` (${baseAttack}+${enhanceBonus})` : ''}`,
                priority: 1 // 공격력/마력은 높은 우선순위
            });
        }
        if (itemStats.defense) {
            // stats에 이미 강화 보너스가 포함되어 있음
            const totalDefense = itemStats.defense;
            const baseDefense = item.baseStats?.defense || totalDefense;
            const enhanceBonus = item.enhanceLevel > 0 ? totalDefense - baseDefense : 0;
            allStats.push({
                value: totalDefense,
                display: `🛡️ 방어력: +${totalDefense}${enhanceBonus > 0 ? ` (${baseDefense}+${enhanceBonus})` : ''}`,
                priority: 2
            });
        }
        if (itemStats.strength) {
            const totalStrength = itemStats.strength;
            const baseStrength = item.baseStats?.strength || totalStrength;
            const enhanceBonus = item.enhanceLevel > 0 ? totalStrength - baseStrength : 0;
            allStats.push({
                value: totalStrength,
                display: `💪 힘: +${totalStrength}${enhanceBonus > 0 ? ` (${baseStrength}+${enhanceBonus})` : ''}`,
                priority: 3
            });
        }
        if (itemStats.agility) {
            const totalAgility = itemStats.agility;
            const baseAgility = item.baseStats?.agility || totalAgility;
            const enhanceBonus = item.enhanceLevel > 0 ? totalAgility - baseAgility : 0;
            allStats.push({
                value: totalAgility,
                display: `🏃 민첩: +${totalAgility}${enhanceBonus > 0 ? ` (${baseAgility}+${enhanceBonus})` : ''}`,
                priority: 3
            });
        }
        if (itemStats.intelligence) {
            const totalIntelligence = itemStats.intelligence;
            const baseIntelligence = item.baseStats?.intelligence || totalIntelligence;
            const enhanceBonus = item.enhanceLevel > 0 ? totalIntelligence - baseIntelligence : 0;
            allStats.push({
                value: totalIntelligence,
                display: `🧠 지능: +${totalIntelligence}${enhanceBonus > 0 ? ` (${baseIntelligence}+${enhanceBonus})` : ''}`,
                priority: 3
            });
        }
        if (itemStats.vitality) {
            const totalVitality = itemStats.vitality;
            const baseVitality = item.baseStats?.vitality || totalVitality;
            const enhanceBonus = item.enhanceLevel > 0 ? totalVitality - baseVitality : 0;
            allStats.push({
                value: totalVitality,
                display: `❤️ 체력: +${totalVitality}${enhanceBonus > 0 ? ` (${baseVitality}+${enhanceBonus})` : ''}`,
                priority: 3
            });
        }
        if (itemStats.luck) {
            const totalLuck = itemStats.luck;
            const baseLuck = item.baseStats?.luck || totalLuck;
            const enhanceBonus = item.enhanceLevel > 0 ? totalLuck - baseLuck : 0;
            allStats.push({
                value: totalLuck,
                display: `🍀 행운: +${totalLuck}${enhanceBonus > 0 ? ` (${baseLuck}+${enhanceBonus})` : ''}`,
                priority: 3
            });
        }
        if (itemStats.hp) {
            const totalHp = itemStats.hp;
            const baseHp = item.baseStats?.hp || totalHp;
            const enhanceBonus = item.enhanceLevel > 0 ? totalHp - baseHp : 0;
            allStats.push({
                value: totalHp,
                display: `💖 추가 HP: +${totalHp}${enhanceBonus > 0 ? ` (${baseHp}+${enhanceBonus})` : ''}`,
                priority: 2
            });
        }
        if (itemStats.dodge) {
            const totalDodge = itemStats.dodge;
            const baseDodge = item.baseStats?.dodge || totalDodge;
            const enhanceBonus = item.enhanceLevel > 0 ? totalDodge - baseDodge : 0;
            allStats.push({
                value: totalDodge,
                display: `💨 회피: +${totalDodge}${enhanceBonus > 0 ? ` (${baseDodge}+${enhanceBonus})` : ''}`,
                priority: 3
            });
        }
        
        // 특수 스탯 (경험치, 골드 보너스 등) - 퍼센트 스탯은 우선순위 높게
        if (itemStats.expBonus) {
            allStats.push({
                value: item.stats.expBonus * 10, // 퍼센트 스탯에 가중치
                display: `✨ 경험치 보너스: +${item.stats.expBonus}%`,
                priority: 1
            });
        }
        if (itemStats.goldBonus) {
            allStats.push({
                value: item.stats.goldBonus * 10, // 퍼센트 스탯에 가중치
                display: `💰 골드 보너스: +${item.stats.goldBonus}%`,
                priority: 1
            });
        }
        if (itemStats.dropRate) {
            allStats.push({
                value: item.stats.dropRate * 10, // 퍼센트 스탯에 가중치
                display: `🎁 드롭률 보너스: +${item.stats.dropRate}%`,
                priority: 1
            });
        }
        
        // 스탯을 우선순위와 값으로 정렬하여 상위 3개만 선택
        allStats.sort((a, b) => {
            // 먼저 우선순위로 정렬
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            // 같은 우선순위면 값으로 정렬
            return b.value - a.value;
        });
        
        // 상위 3개 스탯만 표시
        const topStats = allStats.slice(0, 3);
        const statInfo = topStats.map(stat => stat.display);
        
        // 나머지 스탯이 있으면 개수 표시
        if (allStats.length > 3) {
            statInfo.push(`... 외 ${allStats.length - 3}개 능력치`);
        }

        if (statInfo.length > 0) {
            // 모든 능력치 표시 (allStats 배열의 구조에 맞게 수정)
            const allStatsText = allStats.map(stat => stat.display).join('\n');
            
            itemEmbed.addFields({
                name: '📊 아이템 능력치',
                value: allStatsText,
                inline: false
            });
        }
        
        // 현재 착용 장비와 비교
        const equippedSlot = user.equipment?.[item.type];
        let equippedItem = null;
        
        if (equippedSlot >= 0 && user.inventory) {
            // inventorySlot으로 먼저 찾기
            equippedItem = user.inventory.find(item => item && item.inventorySlot === equippedSlot);
            
            // 못 찾았으면 배열 인덱스로 찾기
            if (!equippedItem && user.inventory[equippedSlot]) {
                equippedItem = user.inventory[equippedSlot];
            }
        }
        if (equippedItem && equippedItem.name !== item.name) {
            const compareInfo = [];
            compareInfo.push(`**[현재 착용: ${equippedItem.name} (+${equippedItem.enhancement || 0})]**`);
            
            // 장착된 아이템의 구버전 호환성 처리
            const equippedStats = equippedItem.stats || {};
            if (!equippedItem.stats) {
                if (equippedItem.attack !== undefined) equippedStats.attack = equippedItem.attack;
                if (equippedItem.defense !== undefined) equippedStats.defense = equippedItem.defense;
                if (equippedItem.hp !== undefined) equippedStats.hp = equippedItem.hp;
            }
            
            // 공격력/마력 비교
            if (itemStats.attack || equippedStats.attack) {
                // stats에 이미 강화 보너스가 포함되어 있음
                const newAttack = itemStats.attack || 0;
                const currentAttack = equippedStats.attack || 0;
                const diff = newAttack - currentAttack;
                const diffText = diff > 0 ? `+${diff}` : `${diff}`;
                const diffColor = diff > 0 ? '🔺' : diff < 0 ? '🔻' : '➡️';
                
                // 직업별 스탯 표시 확인 (강화 수치 제거)
                const emblemName = user.emblem ? user.emblem.replace(/\s*\+\d+$/, '') : '';
                const equippedEmblemName = user.equippedEmblem ? user.equippedEmblem.replace(/\s*\+\d+$/, '') : '';
                const checkEmblem = equippedEmblemName || emblemName;
                
                let classType = 'physical';
                if (checkEmblem && (
                    checkEmblem.includes('마법사') || checkEmblem.includes('원소 술사') || 
                    checkEmblem.includes('신비한 현자') || checkEmblem.includes('대마법사') || 
                    checkEmblem.includes('아크메이지')
                )) {
                    classType = 'magic';
                }
                const isMage = classType === 'magic';
                
                const attackLabel = isMage ? '🔮 마력' : '⚔️ 공격력';
                compareInfo.push(`${attackLabel}: ${currentAttack} → ${newAttack} (${diffColor} ${diffText})`);
            }
            
            // 방어력 비교
            if (itemStats.defense || equippedStats.defense) {
                // stats에 이미 강화 보너스가 포함되어 있음
                const newDefense = itemStats.defense || 0;
                const currentDefense = equippedStats.defense || 0;
                const diff = newDefense - currentDefense;
                const diffText = diff > 0 ? `+${diff}` : `${diff}`;
                const diffColor = diff > 0 ? '🔺' : diff < 0 ? '🔻' : '➡️';
                compareInfo.push(`🛡️ 방어력: ${currentDefense} → ${newDefense} (${diffColor} ${diffText})`);
            }
            
            // HP 비교
            if (itemStats.hp || equippedStats.hp) {
                // stats에 이미 강화 보너스가 포함되어 있음
                const newHp = itemStats.hp || 0;
                const currentHp = equippedStats.hp || 0;
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

    // 강화 정보 (개선된 표시)
    if (item.enhanceLevel && item.enhanceLevel > 0) {
        const { ENHANCE_SYSTEM } = require('../enhance/enhanceSystem');
        const rankName = ENHANCE_SYSTEM.rankNames[item.enhanceLevel] || '';
        
        // 강화 배율 계산 (표시용)
        let displayMultiplier = 1;
        for (let i = 1; i <= item.enhanceLevel; i++) {
            if (i <= 5) {
                displayMultiplier += 0.02; // 1-5강: 2%씩
            } else if (i <= 10) {
                displayMultiplier += 0.03; // 6-10강: 3%씩
            } else if (i <= 15) {
                displayMultiplier += 0.04; // 11-15강: 4%씩
            } else if (i <= 20) {
                displayMultiplier += 0.05; // 16-20강: 5%씩
            } else if (i <= 25) {
                displayMultiplier += 0.06; // 21-25강: 6%씩
            } else {
                displayMultiplier += 0.07; // 26강+: 7%씩
            }
        }
        
        const enhancePercent = Math.round((displayMultiplier - 1) * 100);
        const enhanceInfo = [];
        enhanceInfo.push(`**[${rankName}]**`);
        enhanceInfo.push(`📈 스탯 증가율: +${enhancePercent}%`);
        
        // 다음 강화 정보
        if (item.enhanceLevel < 30) {
            const nextLevel = item.enhanceLevel + 1;
            const nextRank = ENHANCE_SYSTEM.rankNames[nextLevel] || '';
            if (nextRank !== rankName) {
                enhanceInfo.push(`🎯 다음 단계: [${nextRank}]`);
            }
        }
        
        itemEmbed.addFields({
            name: '✨ 강화 상태',
            value: enhanceInfo.join('\n'),
            inline: false
        });
    } else if (item.enhancement) {
        // 구버전 호환성
        itemEmbed.addFields({
            name: '✨ 강화',
            value: `+${item.enhancement}`,
            inline: true
        });
    }
    
    // 이벤트 태그 표시
    if (item.itemTag) {
        itemEmbed.addFields({
            name: '🏷️ 태그',
            value: item.itemTag,
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

// 아이템 판매 - sellSystem의 빠른 판매 사용
async function sellItem(interaction, itemIndex) {
    // sellSystem의 빠른 판매 기능 호출
    const sellSystem = require('../../systems/sellSystem');
    await sellSystem.executeQuickSell(interaction, interaction.user.id, itemIndex);
}

module.exports = {
    showInventory,
    showItemDetail,
    equipItemFromInventory,
    sellItem
};