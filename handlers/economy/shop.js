const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');

// 상점 등급 시스템
const SHOP_GRADES = {
    초급: {
        name: '초급헌터상점',
        tier: 'Tier 1',
        emoji: '🏪',
        enhanceRequired: 0,
        description: '초보 헌터를 위한 기본 상점',
        gachaType: 'beginner',
        color: '#95a5a6'
    },
    중급: {
        name: '중급헌터상점', 
        tier: 'Tier 2',
        emoji: '🏬',
        enhanceRequired: 5,
        description: '숙련된 헌터를 위한 상점',
        gachaType: 'intermediate',
        color: '#3498db'
    },
    고급: {
        name: '고급헌터상점',
        tier: 'Tier 3', 
        emoji: '🏛️',
        enhanceRequired: 10,
        description: '상급 헌터를 위한 프리미엄 상점',
        gachaType: 'advanced',
        color: '#9b59b6'
    },
    전설: {
        name: '전설헌터상점',
        tier: 'Tier 4',
        emoji: '⭐',
        enhanceRequired: 15,
        description: '전설의 헌터를 위한 특별 상점',
        gachaType: 'legendary',
        color: '#ff8c00'
    },
    신화: {
        name: '신화헌터상점',
        tier: 'Tier 5',
        emoji: '🌟', 
        enhanceRequired: 20,
        description: '신의 경지에 이른 헌터를 위한 최고급 상점',
        gachaType: 'mythic',
        color: '#ff00ff'
    }
};

// 강화 레벨에 따른 상점 등급 결정
function getShopGrade(maxEnhanceLevel) {
    if (maxEnhanceLevel >= 20) return SHOP_GRADES.신화;
    if (maxEnhanceLevel >= 15) return SHOP_GRADES.전설;
    if (maxEnhanceLevel >= 10) return SHOP_GRADES.고급;
    if (maxEnhanceLevel >= 5) return SHOP_GRADES.중급;
    return SHOP_GRADES.초급;
}

// 랜덤 아이템 부위별 카테고리 정의
const RANDOM_CATEGORIES = {
    weapon: { name: '무기 뽑기', emoji: '⚔️', description: '검, 활, 지팡이 등 무기류', price: 50000 },
    armor: { name: '갑옷 뽑기', emoji: '🛡️', description: '갑옷, 로브 등 상의류', price: 50000 },
    helmet: { name: '투구 뽑기', emoji: '⛑️', description: '투구, 모자 등 머리 장비', price: 40000 },
    gloves: { name: '장갑 뽑기', emoji: '🧤', description: '장갑, 건틀릿 등 손 장비', price: 30000 },
    boots: { name: '신발 뽑기', emoji: '👢', description: '부츠, 그리브 등 발 장비', price: 30000 },
    shield: { name: '방패 뽑기', emoji: '🛡️', description: '방패, 보호구 등 방어 장비', price: 40000 },
    accessory: { name: '장신구 뽑기', emoji: '💎', description: '반지, 목걸이 등 장신구', price: 60000 },
    all: { name: '올랜덤 뽑기', emoji: '🎰', description: '모든 부위 랜덤!', price: 45000 }
};

// 상점 메인 메뉴
async function showShopMenu(interaction) {
    // 먼저 defer 처리
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: 64 });
        }
    } catch (error) {
        console.error('Shop menu defer error:', error);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        try {
            if (interaction.deferred || interaction.replied) {
                return await interaction.editReply({ 
                    content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.'
                });
            } else {
                return await interaction.reply({ 
                    content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
                    flags: 64
                });
            }
        } catch (error) {
            console.error('[Shop] Reply error:', error.message);
            return;
        }
    }
    
    // 새로운 천장 시스템 기반 상점으로 리디렉션
    const { createShopEmbed, createSlotSelectMenu } = require('../../systems/shop');
    const embed = createShopEmbed(user);
    const selectMenu = createSlotSelectMenu(user);
    
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply({
                embeds: [embed],
                components: [selectMenu]
            });
        } else {
            return await interaction.reply({
                embeds: [embed],
                components: [selectMenu],
                flags: 64
            });
        }
    } catch (error) {
        console.error('[Shop] Final reply error:', error.message);
        return;
    }
    
    /* 기존 상점 코드는 주석 처리
    // 유저의 최고 강화 레벨 확인
    let maxEnhanceLevel = 0;
    if (user.inventory && user.inventory.length > 0) {
        user.inventory.forEach(item => {
            if (item.enhanceLevel > maxEnhanceLevel) {
                maxEnhanceLevel = item.enhanceLevel;
            }
        });
    }
    
    // 상점 등급 결정
    const shopGrade = getShopGrade(maxEnhanceLevel);
    const shopColors = {
        '초급헌터상점': '#95a5a6',
        '중급헌터상점': '#3498db',
        '고급헌터상점': '#9b59b6',
        '전설헌터상점': '#ff8c00',
        '신화헌터상점': '#ff00ff'
    };
    
    const shopEmbed = new EmbedBuilder()
        .setColor(shopColors[shopGrade.name])
        .setTitle(`${shopGrade.emoji} ${shopGrade.name}`)
        .setDescription(`**🎲 부위별 랜덤 아이템 뽑기!**\n매번 새로운 이름과 능력치를 가진 유니크한 아이템이 생성됩니다!\n\n📊 최고 강화: +${maxEnhanceLevel} | 상점 등급: ${shopGrade.tier}\n💰 보유 골드: ${formatNumber(user.gold)}G`)
        .setFooter({ text: `${shopGrade.description} | 강화 레벨이 높을수록 좋은 아이템이 나올 확률 UP!` });
    
    // 부위별 카테고리를 보기 좋게 그룹화
    const weaponCategories = ['weapon', 'shield'];
    const armorCategories = ['armor', 'helmet', 'gloves', 'boots'];
    const accessoryCategories = ['accessory'];
    const specialCategories = ['all'];
    
    shopEmbed.addFields({ name: '\u200B', value: '**⚔️ 무기류**', inline: false });
    weaponCategories.forEach(key => {
        const category = RANDOM_CATEGORIES[key];
        shopEmbed.addFields({
            name: `${category.emoji} ${category.name}`,
            value: `${category.description}\n💵 **${formatNumber(category.price)}G**`,
            inline: true
        });
    });
    
    shopEmbed.addFields({ name: '\u200B', value: '**🛡️ 방어구류**', inline: false });
    armorCategories.forEach(key => {
        const category = RANDOM_CATEGORIES[key];
        shopEmbed.addFields({
            name: `${category.emoji} ${category.name}`,
            value: `${category.description}\n💵 **${formatNumber(category.price)}G**`,
            inline: true
        });
    });
    
    shopEmbed.addFields({ name: '\u200B', value: '**💎 장신구 및 특수**', inline: false });
    [...accessoryCategories, ...specialCategories].forEach(key => {
        const category = RANDOM_CATEGORIES[key];
        shopEmbed.addFields({
            name: `${category.emoji} ${category.name}`,
            value: `${category.description}\n💵 **${formatNumber(category.price)}G**`,
            inline: true
        });
    });
    
    // 상점 등급별 확률 정보 추가
    const randomItemData = require('../../data/randomItemData');
    const currentRates = randomItemData.gachaRates[shopGrade.gachaType].rates;
    
    shopEmbed.addFields({ 
        name: '\u200B', 
        value: `**📊 ${shopGrade.name} 확률 정보**`, 
        inline: false 
    });
    shopEmbed.addFields({
        name: '🟠 Legendary',
        value: `${(currentRates.legendary * 100).toFixed(1)}%`,
        inline: true
    }, {
        name: '🟣 Unique', 
        value: `${(currentRates.unique * 100).toFixed(1)}%`,
        inline: true
    }, {
        name: '🔴 Epic',
        value: `${(currentRates.epic * 100).toFixed(1)}%`,
        inline: true
    }, {
        name: '🔵 Rare',
        value: `${(currentRates.rare * 100).toFixed(1)}%`,
        inline: true
    }, {
        name: '⚪ Normal',
        value: `${(currentRates.normal * 100).toFixed(1)}%`,
        inline: true
    }, {
        name: '🟫 Trash',
        value: `${(currentRates.trash * 100).toFixed(1)}%`,
        inline: true
    });
    
    // 카테고리 드롭다운 메뉴
    const categoryOptions = Object.entries(RANDOM_CATEGORIES).map(([value, category]) => ({
        label: `${category.emoji} ${category.name}`,
        description: `${formatNumber(category.price)}G - ${category.description}`,
        value: `random_category_${value}`,
        emoji: category.emoji
    }));
    
    const categorySelectMenu = new StringSelectMenuBuilder()
        .setCustomId('shop_category_select')
        .setPlaceholder('뽑을 부위를 선택하세요')
        .addOptions(categoryOptions);
    
    const selectRow = new ActionRowBuilder()
        .addComponents(categorySelectMenu);
    
    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('enhance')
                .setLabel('🎖️ 아이템 계급 부여')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('inventory')
                .setLabel('🎒 인벤토리')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.reply({
        embeds: [shopEmbed],
        components: [selectRow, buttonRow],
        flags: 64
    });
    */
}

// 부위별 랜덤 아이템 뽑기
async function showRandomCategoryGacha(interaction, category) {
    const user = await getUser(interaction.user.id);
    const categoryInfo = RANDOM_CATEGORIES[category];
    
    if (!categoryInfo) {
        return await interaction.update({ 
            content: '❌ 잘못된 카테고리입니다!', 
            embeds: [],
            components: []
        });
    }
    
    // 골드 확인
    if (user.gold < categoryInfo.price) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('💸 골드 부족!')
            .setDescription(`${categoryInfo.emoji} ${categoryInfo.name}에는 ${formatNumber(categoryInfo.price)}G가 필요합니다.\n\n💰 보유 골드: ${formatNumber(user.gold)}G\n💵 필요 골드: ${formatNumber(categoryInfo.price)}G\n🔻 부족한 골드: ${formatNumber(categoryInfo.price - user.gold)}G`);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('shop')
                    .setLabel('🔙 상점으로')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('daily')
                    .setLabel('💰 일일 활동')
                    .setStyle(ButtonStyle.Primary)
            );
        
        return await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
    }
    
    // 뽑기 확인
    const confirmEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`${categoryInfo.emoji} ${categoryInfo.name}`)
        .setDescription(`${categoryInfo.description}\n\n정말로 뽑으시겠습니까?`)
        .addFields(
            { name: '💵 가격', value: `${formatNumber(categoryInfo.price)}G`, inline: true },
            { name: '💰 보유 골드', value: `${formatNumber(user.gold)}G`, inline: true },
            { name: '💎 뽑기 후 잔액', value: `${formatNumber(user.gold - categoryInfo.price)}G`, inline: true }
        )
        .setFooter({ text: '⚠️ 랜덤 아이템은 환불이 불가능합니다!' });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`random_execute_${category}`)
                .setLabel(`${categoryInfo.emoji} 뽑기!`)
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('shop')
                .setLabel('❌ 취소')
                .setStyle(ButtonStyle.Danger)
        );
    
    return await interaction.update({
        embeds: [confirmEmbed],
        components: [buttons]
    });
}

// 랜덤 아이템 뽑기 실행
async function executeRandomGacha(interaction, category) {
    const user = await getUser(interaction.user.id);
    const categoryInfo = RANDOM_CATEGORIES[category];
    const randomItemGenerator = require('../../systems/randomItemGenerator');
    
    // 골드 차감
    user.gold -= categoryInfo.price;
    
    // 유저의 최고 강화 레벨 확인
    let maxEnhanceLevel = 0;
    if (user.inventory && user.inventory.length > 0) {
        user.inventory.forEach(item => {
            if (item.enhanceLevel > maxEnhanceLevel) {
                maxEnhanceLevel = item.enhanceLevel;
            }
        });
    }
    
    // 상점 등급에 따른 가챠 타입 결정
    const shopGrade = getShopGrade(maxEnhanceLevel);
    const gachaType = shopGrade.gachaType;
    
    // 애니메이션 표시
    const rollingEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎰 뽑기 중...')
        .setDescription(`${categoryInfo.emoji} ${categoryInfo.name} 진행 중...\n\n두근두근... 어떤 아이템이 나올까요?`)
        .setImage('https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif');
    
    // 공개 메시지로 변경
    await interaction.reply({
        embeds: [rollingEmbed],
        components: []
    });
    
    // 3초 대기
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 아이템 생성 (부위별 필터링 + 상점 등급 반영)
    const item = category === 'all' 
        ? randomItemGenerator.generateItem(gachaType) 
        : randomItemGenerator.generateItemBySlot(category, gachaType);
    
    // 결과 표시
    const rarityColors = {
        'common': '#808080',
        'uncommon': '#00FF00', 
        'rare': '#0099FF',
        'epic': '#9400D3',
        'legendary': '#FFD700'
    };
    
    // 점수별 등급 이모지
    const getScoreEmoji = (score) => {
        if (score >= 90) return '🏆';
        if (score >= 80) return '💎';
        if (score >= 70) return '⭐';
        if (score >= 60) return '✨';
        if (score >= 50) return '🔷';
        if (score >= 40) return '🔶';
        if (score >= 30) return '⚪';
        if (score >= 20) return '🟫';
        if (score >= 10) return '⚫';
        return '💩';
    };
    
    const resultEmbed = new EmbedBuilder()
        .setColor(rarityColors[item.rarity] || '#FFFFFF')
        .setTitle(`✨ ${item.rarity.toUpperCase()} 아이템 획득!`)
        .setDescription(`**${item.name}**\n\n${getScoreEmoji(item.score)} 아이템 점수: ${item.score}점\n${shopGrade.emoji} ${shopGrade.name}에서 뽑음`)
        .addFields(
            {
                name: '📊 능력치',
                value: Object.entries(item.stats)
                    .map(([key, value]) => {
                        const statNames = {
                            attack: "⚔️ 공격력",
                            defense: "🛡️ 방어력",
                            strength: "💪 힘",
                            agility: "🏃 민첩",
                            intelligence: "🧠 지능",
                            vitality: "❤️ 체력",
                            luck: "🍀 행운",
                            hp: "💖 추가HP",
                            dodge: "💨 회피력"
                        };
                        return `${statNames[key]}: +${value}`;
                    }).join('\n'),
                inline: true
            },
            {
                name: '📝 정보',
                value: `종류: ${getItemTypeKorean(item.type)}\n희귀도: ${getRarityKorean(item.rarity)}\n판매가: ${formatNumber(Math.floor(item.price * 0.6))}G`,
                inline: true
            }
        )
        .setFooter({ text: '아이템이 인벤토리에 자동으로 추가되었습니다!' });
    
    if (item.specialCombo) {
        resultEmbed.addFields({
            name: '✨ 특수 효과',
            value: `**${item.specialCombo.name}**\n${item.specialCombo.effect}`,
            inline: false
        });
    }
    
    // 인벤토리에 추가
    const inventoryItem = {
        id: `random_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        setName: 'random',  // 랜덤 아이템 세트
        stats: item.stats || {},
        description: item.description || '',
        price: Math.floor(item.price * 0.6),  // 판매가 60%로 상향
        level: 1,  // 기본 착용 레벨
        quantity: 1,
        enhanceLevel: 0,
        equipped: false,
        obtainedDate: new Date()
    };
    
    if (item.specialCombo) {
        inventoryItem.specialEffect = {
            name: item.specialCombo.name,
            effect: item.specialCombo.effect,
            stats: item.specialStats
        };
    }
    
    // 아이템 점수와 이름 등급 정보도 저장
    inventoryItem.score = item.score;
    inventoryItem.nameRarities = item.nameRarities;
    
    user.inventory.push(inventoryItem);
    await user.save();
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`random_category_${category}`)
                .setLabel(`${categoryInfo.emoji} 한 번 더!`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.gold < categoryInfo.price),
            new ButtonBuilder()
                .setCustomId('inventory')
                .setLabel('🎒 인벤토리 확인')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('shop')
                .setLabel('🔙 상점으로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.editReply({
        embeds: [resultEmbed],
        components: [buttons]
    });
    
    // 전체 공지 메시지 생성
    let announcement = '';
    const totalStats = Object.values(item.stats).reduce((sum, val) => sum + val, 0);
    
    // 닉네임 확인 (없으면 Discord username 사용)
    const displayName = user.nickname || interaction.user.username;
    
    // 점수별 메시지
    if (item.score >= 90) {
        const godMessages = [
            `🏆 **신이 나타났다!** ${displayName}님이 ${item.score}점 ${item.name}을(를) 뽑았습니다!`,
            `⚡ **세계가 놀랐다!** ${displayName}님의 **${item.name}** (${item.score}점)! 이게 바로 신의 아이템!`,
            `🌟 **역대급 아이템!** ${displayName}님이 ${item.score}점 ${item.name} 획득! 박물관에 전시해야 할 수준!`
        ];
        announcement = godMessages[Math.floor(Math.random() * godMessages.length)];
    } else if (item.score >= 70) {
        const excellentMessages = [
            `💎 **대박!** ${displayName}님이 ${item.score}점 ${item.name}을(를) 획득!`,
            `⭐ **축하합니다!** ${displayName}님의 ${item.name} (${item.score}점)! 상위 1% 아이템!`,
            `✨ **엄청난 행운!** ${displayName}님이 ${item.score}점 ${item.name} 뽑았습니다!`
        ];
        announcement = excellentMessages[Math.floor(Math.random() * excellentMessages.length)];
    } else if (item.score >= 50) {
        const goodMessages = [
            `🔷 ${displayName}님이 준수한 ${item.score}점 ${item.name} 획득!`,
            `👍 ${displayName}님의 ${item.name} (${item.score}점)! 꽤 좋은 아이템이네요!`
        ];
        announcement = goodMessages[Math.floor(Math.random() * goodMessages.length)];
    } else if (item.score >= 30) {
        const normalMessages = [
            `⚪ ${displayName}님이 평범한 ${item.name} (${item.score}점) 획득...`,
            `🤔 ${displayName}님의 ${item.name}... ${item.score}점... 음... 쓸만해요!`
        ];
        announcement = normalMessages[Math.floor(Math.random() * normalMessages.length)];
    } else if (item.score >= 10) {
        const badMessages = [
            `🟫 ${displayName}님... ${item.name} (${item.score}점)... 다음엔 더 좋은게 나올거예요...`,
            `😅 ${displayName}님이 ${item.score}점짜리 ${item.name}을(를)... 힘내세요!`,
            `💔 ${displayName}님의 ${item.name}... 겨우 ${item.score}점... F...`
        ];
        announcement = badMessages[Math.floor(Math.random() * badMessages.length)];
    } else {
        const trashMessages = [
            `💩 ${displayName}님이 ${item.score}점 ${item.name}을(를) 뽑았습니다... 이게 아이템인가요?`,
            `🗑️ ${displayName}님... ${item.name} (${item.score}점)... 쓰레기통에 버리실래요?`,
            `😭 ${displayName}님의 ${item.name}... ${item.score}점... 역대급 망작입니다...`,
            `🥲 ${displayName}님이 전설의 ${item.score}점 ${item.name}을(를)... 모두 묵념...`
        ];
        announcement = trashMessages[Math.floor(Math.random() * trashMessages.length)];
    }
    
    // 특수 효과가 있는 경우
    if (item.specialCombo && announcement) {
        announcement += `\n🔥 **특수 효과 발동!** ${item.specialCombo.name}: ${item.specialCombo.effect}`;
    }
    
    // 전체 공지 전송
    if (announcement) {
        // 점수별 색상
        let embedColor = '#808080';
        if (item.score >= 90) embedColor = '#FFD700';
        else if (item.score >= 70) embedColor = '#FF1493';
        else if (item.score >= 50) embedColor = '#00CED1';
        else if (item.score >= 30) embedColor = '#32CD32';
        else if (item.score >= 10) embedColor = '#CD853F';
        else embedColor = '#8B4513';
        
        // 주요 스탯 표시 (상위 3개)
        const sortedStats = Object.entries(item.stats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);
        
        const statDisplay = sortedStats.map(([key, value]) => {
            const statEmojis = {
                attack: "⚔️", defense: "🛡️", strength: "💪",
                agility: "🏃", intelligence: "🧠", vitality: "❤️",
                luck: "🍀", hp: "💖", dodge: "💨"
            };
            const statNames = {
                attack: "공격력", defense: "방어력", strength: "힘",
                agility: "민첩", intelligence: "지능", vitality: "체력",
                luck: "행운", hp: "추가HP", dodge: "회피"
            };
            return `${statEmojis[key]} ${statNames[key]} +${value}`;
        }).join(' | ');
        
        // 이름 등급 표시
        const nameRarityEmojis = {
            legendary: '🟠', unique: '🟡', epic: '🟣',
            rare: '🔵', normal: '⚪', trash: '🟫'
        };
        
        const nameDisplay = item.nameRarities ? 
            `${nameRarityEmojis[item.nameRarities.prefix]}+${nameRarityEmojis[item.nameRarities.adjective]}+${nameRarityEmojis[item.nameRarities.itemName]}` : 
            '';
        
        const announcementEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setAuthor({ 
                name: announcement.split('\n')[0], 
                iconURL: interaction.user.displayAvatarURL() 
            })
            .setDescription(`**${item.name}** ${nameDisplay}`)
            .addFields(
                { name: '📊 주요 스탯', value: statDisplay || '없음', inline: true },
                { name: '💯 아이템 점수', value: `${getScoreEmoji(item.score)} **${item.score}점**`, inline: true }
            );
        
        if (item.specialCombo) {
            announcementEmbed.addFields({
                name: '✨ 특수 효과',
                value: `**${item.specialCombo.name}**: ${item.specialCombo.effect}`,
                inline: false
            });
        }
        
        // 점수별 추가 멘트
        if (item.score < 10) {
            announcementEmbed.setFooter({ text: '🎻 슬픈 바이올린 연주가 들려옵니다...' });
        } else if (item.score >= 90) {
            announcementEmbed.setFooter({ text: '🎊 모두 축하해주세요!' });
        }
        
        if (item.score >= 90) {
            // 90점 이상은 메인 채널에 공지
            const mainChannel = interaction.guild.channels.cache.find(ch => 
                ch.name === 'general' || ch.name === '일반' || ch.name === '메인'
            );
            
            if (mainChannel) {
                await mainChannel.send({ embeds: [announcementEmbed] });
            } else {
                // 메인 채널이 없으면 현재 채널에
                await interaction.followUp({
                    embeds: [announcementEmbed],
                    flags: 0 // 전체 공개
                });
            }
        } else {
            // 나머지는 현재 채널에 전체 공개
            await interaction.followUp({
                embeds: [announcementEmbed],
                flags: 0 // 전체 공개
            });
        }
    }
}

// 아이템 타입 한글 변환
function getItemTypeKorean(type) {
    const types = {
        'weapon': '무기',
        'armor': '갑옷', 
        'helmet': '투구',
        'gloves': '장갑',
        'boots': '신발',
        'shield': '방패',
        'accessory': '장신구',
        'ring': '반지',
        'necklace': '목걸이',
        'belt': '벨트'
    };
    return types[type] || type;
}

// 희귀도 한글 변환
function getRarityKorean(rarity) {
    const rarities = {
        'common': '일반',
        'uncommon': '고급',
        'rare': '희귀',
        'epic': '영웅',
        'legendary': '전설'
    };
    return rarities[rarity] || rarity;
}

// 스탯 이모지 헬퍼
function getStatEmoji(stat) {
    const statEmojis = {
        attack: '⚔️',
        defense: '🛡️',
        agility: '🏃',
        strength: '💪',
        intelligence: '🧠',
        luck: '🍀'
    };
    return statEmojis[stat] || '📊';
}

// 스탯 이름 헬퍼
function getStatName(stat) {
    const statNames = {
        attack: '공격력',
        defense: '방어력',
        agility: '민첩성',
        strength: '힘',
        intelligence: '지능',
        luck: '행운'
    };
    return statNames[stat] || stat;
}

module.exports = {
    showShopMenu,
    showRandomCategoryGacha,
    executeRandomGacha,
    RANDOM_CATEGORIES
};