const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const UserArtifacts = require('../../models/UserArtifacts');
const ArtifactCompany = require('../../models/ArtifactCompany');
const Stock = require('../../models/Stock');
const artifactData = require('../../data/artifactExploration');
const ARTIFACT_SYSTEM = require('../../data/artifactSystem');
const { MINE_SYSTEM, mineManager } = require('../../data/mineSystem');
// Removed addGold import - not implemented
const MissionHelper = require('../../utils/missionHelper');

// 유물 탐사 메인 메뉴
async function showExplorationMenu(interaction, userId) {
    const user = await User.findOne({ discordId: userId });
    
    if (!user || !user.registered) {
        return await interaction.reply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
            flags: 64 
        });
    }
    
    const userArtifacts = await UserArtifacts.findOne({ userId }) || await createNewExplorer(userId, interaction.user.username);

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏺 유물 탐사 시스템')
        .setDescription('고대의 보물을 찾아 탐사를 떠나보세요!')
        .addFields(
            { name: '💰 보유 골드', value: `${user.gold.toLocaleString()} 골드`, inline: true },
            { name: '⛏️ 현재 곡괭이', value: `${artifactData.pickaxes[userArtifacts.currentPickaxe].name} (Lv.${userArtifacts.pickaxes[userArtifacts.currentPickaxe].level})`, inline: true },
            { name: '📊 탐사 통계', value: `총 ${userArtifacts.statistics.totalArtifactsFound}개 발견 | ${userArtifacts.statistics.totalEarnings.toLocaleString()} 골드 수익`, inline: true }
        )
        .setFooter({ text: '원하는 메뉴를 선택하세요' });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`artifact_mines_${userId}`)
                .setLabel('🏔️ 광산 선택')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`artifact_inventory_${userId}`)
                .setLabel('🏺 유물 보관함')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`artifact_shop_${userId}`)
                .setLabel('🏪 유물 상점')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`artifact_pickaxe_${userId}`)
                .setLabel('⛏️ 곡괭이 강화')
                .setStyle(ButtonStyle.Primary)
        );

    // 응답 처리
    try {
        if (interaction.deferred) {
            // 이미 defer된 경우 editReply 사용
            await interaction.editReply({ embeds: [embed], components: [buttons] });
        } else if (interaction.replied) {
            // 이미 응답한 경우 followUp 사용
            await interaction.followUp({ embeds: [embed], components: [buttons], flags: 64 });
        } else if (interaction.isStringSelectMenu() && !interaction.deferred && !interaction.replied) {
            // StringSelectMenu이고 아직 응답하지 않은 경우 update 사용
            await interaction.update({ embeds: [embed], components: [buttons] });
        } else {
            // 그 외의 경우 reply 사용
            await interaction.reply({ embeds: [embed], components: [buttons], flags: 64 });
        }
    } catch (error) {
        console.error('[ArtifactExploration] Response error:', error);
        // 에러 발생 시 followUp 시도
        try {
            await interaction.followUp({ embeds: [embed], components: [buttons], flags: 64 });
        } catch (followUpError) {
            console.error('[ArtifactExploration] FollowUp error:', followUpError);
        }
    }
}

// 새로운 탐사자 생성
async function createNewExplorer(userId, username) {
    const newExplorer = new UserArtifacts({
        userId,
        username,
        currentPickaxe: 'bronze',
        pickaxes: {
            bronze: { level: 0, experience: 0 },
            silver: { level: 0, experience: 0, unlocked: false },
            gold: { level: 0, experience: 0, unlocked: false }
        },
        artifacts: [],
        statistics: {
            totalArtifactsFound: 0,
            totalEarnings: 0,
            legendaryFound: 0,
            mythicFound: 0
        },
        achievements: []
    });
    
    await newExplorer.save();
    return newExplorer;
}

// 탐사 회사 선택
async function showCompanySelection(interaction, userId) {
    const companies = await ArtifactCompany.find({}).sort({ currentPrice: 1 });
    const stocks = await Stock.find({});
    
    const stockMap = {};
    stocks.forEach(stock => {
        stockMap[stock.companyId] = stock.currentPrice;
    });

    const embed = new EmbedBuilder()
        .setColor('#4B0082')
        .setTitle('🏢 탐사 회사 선택')
        .setDescription('함께 탐사할 회사를 선택하세요. 회사마다 특성과 보너스가 다릅니다!');

    const options = companies.map(company => {
        const stockPrice = stockMap[company.companyId] || company.currentPrice;
        const performance = company.getPerformance();
        
        return {
            label: company.name,
            description: `특성: ${getSpecialtyName(company.specialty)} | 성과: ${(performance * 100).toFixed(1)}%`,
            value: `explore_${company.companyId}_${userId}`,
            emoji: getCompanyEmoji(company.specialty)
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`company_select_${userId}`)
        .setPlaceholder('탐사할 회사를 선택하세요')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`artifact_main_${userId}`)
                .setLabel('뒤로가기')
                .setStyle(ButtonStyle.Secondary)
        );

    // 인터랙션 타입에 따라 적절한 응답 방법 선택
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed], components: [row, backButton] });
    } else if (interaction.isButton()) {
        await interaction.update({ embeds: [embed], components: [row, backButton] });
    } else {
        await interaction.reply({ embeds: [embed], components: [row, backButton], flags: 64 });
    }
}

// 실제 탐사 실행
async function executeExploration(interaction, userId, companyId) {
    // 먼저 defer 처리
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('[Artifact] Exploration interaction expired');
            return;
        }
        console.error('[Artifact] Exploration defer error:', error);
        return;
    }
    
    const user = await User.findOne({ discordId: userId });
    const userArtifacts = await UserArtifacts.findOne({ userId });
    const company = await ArtifactCompany.findOne({ companyId });
    const stock = await Stock.findOne({ companyId }) || { currentPrice: company.currentPrice };

    // 쿨다운 체크
    if (userArtifacts.lastExploration) {
        const cooldownTime = Date.now() - new Date(userArtifacts.lastExploration).getTime();
        if (cooldownTime < artifactData.exploration.cooldown) {
            const remainingTime = Math.ceil((artifactData.exploration.cooldown - cooldownTime) / 1000);
            return interaction.editReply({
                content: `⏱️ 탐사 쿨다운 중입니다! ${remainingTime}초 후에 다시 시도하세요.`,
                embeds: [],
                components: []
            });
        }
    }

    // 탐사 비용 계산
    const explorationCost = Math.floor(artifactData.exploration.baseCost * Math.pow(artifactData.exploration.costMultiplier, userArtifacts.statistics.totalExplorations / 10));
    
    if (user.gold < explorationCost) {
        return interaction.editReply({
            content: `💸 탐사 비용이 부족합니다! 필요: ${explorationCost.toLocaleString()} 골드`,
            embeds: [],
            components: []
        });
    }

    // 골드 차감
    user.gold -= explorationCost;
    await user.save();

    // 탐사 실행
    const pickaxeType = userArtifacts.currentPickaxe;
    const pickaxeLevel = userArtifacts.pickaxes[pickaxeType].level;
    const companyBonus = company.multiplier;

    // 발견 확률 계산
    const findChance = artifactData.calculateFindChance(pickaxeType, pickaxeLevel, companyBonus);
    const foundSomething = Math.random() < findChance;

    const embed = new EmbedBuilder()
        .setColor('#8B4513')
        .setTitle(`⛏️ ${company.name}와 함께 탐사 중...`)
        .setThumbnail(interaction.user.displayAvatarURL());

    if (!foundSomething) {
        // 위로 메시지 랜덤 선택
        const comfortMessages = [
            '다음엔 꼭 대박이 날 거예요! 💪',
            '이번엔 운이 없었지만, 포기하지 마세요! 🌟',
            '실패는 성공의 어머니! 다음 탐사를 기대해보세요! ✨',
            '아쉽지만 이런 날도 있는 법이죠... 힘내세요! 💖',
            '탐사는 인내심이 필요해요. 조금만 더 화이팅! 🎯'
        ];
        
        const failEmbed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setAuthor({ 
                name: `${interaction.user.username}의 탐사 결과`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTitle('💔 탐사 실패...')
            .setDescription(`${company.name}에서 열심히 탐사했지만...`)
            .addFields(
                { 
                    name: '📍 탐사 장소', 
                    value: `${company.emoji} ${company.name}`, 
                    inline: true 
                },
                { 
                    name: '⛏️ 사용 곡괭이', 
                    value: `${artifactData.pickaxes[pickaxeType].name} (Lv.${pickaxeLevel})`, 
                    inline: true 
                },
                { 
                    name: '🎲 탐사 확률', 
                    value: `${(findChance * 100).toFixed(1)}%`, 
                    inline: true 
                },
                { 
                    name: '💬 위로의 한마디', 
                    value: comfortMessages[Math.floor(Math.random() * comfortMessages.length)], 
                    inline: false 
                }
            )
            .setFooter({ text: '탐사 비용은 환불되지 않습니다' })
            .setTimestamp();
        
        await userArtifacts.recordExploration(companyId);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`artifact_explore_${userId}`)
                    .setLabel('🔄 다시 탐사')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`artifact_main_${userId}`)
                    .setLabel('📋 메뉴로 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        // 공개 메시지로 전송
        await interaction.editReply({ 
            embeds: [failEmbed], 
            components: [buttons]
        });
        
        return;
    }

    // 특별 이벤트 체크
    let specialEvent = null;
    let rarityBonus = 0;
    let multiFind = 1;

    if (Math.random() < artifactData.exploration.specialEventChance) {
        const events = Object.keys(artifactData.specialEvents);
        const eventKey = events[Math.floor(Math.random() * events.length)];
        specialEvent = artifactData.specialEvents[eventKey];
        
        if (eventKey === 'ancientTomb') rarityBonus = specialEvent.rarityBonus;
        if (eventKey === 'divineBlessing') multiFind = specialEvent.multiFind;
    }

    // 유물 발견
    const artifacts = [];
    const scrollDropped = [];
    
    for (let i = 0; i < multiFind; i++) {
        // 지역특화 유물 체크 (5% 확률)
        if (Math.random() < 0.05 && ARTIFACT_SYSTEM.specialArtifacts[company.specialty]) {
            const specialItems = ARTIFACT_SYSTEM.specialArtifacts[company.specialty];
            const specialItem = specialItems[Math.floor(Math.random() * specialItems.length)];
            
            // 지역특화 유물 가격 계산
            const [minValue, maxValue] = specialItem.value;
            const artifactValue = Math.floor(minValue + Math.random() * (maxValue - minValue));
            
            const artifact = {
                id: `${Date.now()}_${i}_special`,
                name: specialItem.name,
                rarity: specialItem.rarity,
                baseItem: specialItem.name,
                foundWith: {
                    company: companyId,
                    pickaxe: pickaxeType,
                    pickaxeLevel: pickaxeLevel
                },
                value: artifactValue,
                isSpecial: true,
                emoji: specialItem.emoji
            };
            
            artifacts.push(artifact);
            await userArtifacts.addArtifact(artifact);
        } else {
            // 일반 유물
            const rarity = calculateRarityWithBonus(pickaxeType, pickaxeLevel, company.specialty, rarityBonus);
            const items = artifactData.items[rarity];
            const item = items[Math.floor(Math.random() * items.length)];
            const artifactName = artifactData.generateArtifactName(rarity, item);
            const artifactValue = artifactData.calculateArtifactPrice(rarity, company.multiplier, stock.currentPrice);

            const artifact = {
                id: `${Date.now()}_${i}`,
                name: artifactName,
                rarity: rarity,
                baseItem: item,
                foundWith: {
                    company: companyId,
                    pickaxe: pickaxeType,
                    pickaxeLevel: pickaxeLevel
                },
                value: artifactValue
            };

            artifacts.push(artifact);
            await userArtifacts.addArtifact(artifact);
        }
    }
    
    // 주문서는 광산에서만 드롭되므로 여기서는 제거

    // 회사 통계 업데이트
    const totalValue = artifacts.reduce((sum, a) => sum + a.value, 0);
    await company.recordExploration(userId, interaction.user.username, totalValue);

    // 업적 체크
    await checkAchievements(userArtifacts, artifacts);

    // 축하 메시지 랜덤 선택
    const congratsMessages = [
        '대박! 정말 운이 좋으시네요! 🎉',
        '와! 엄청난 발견입니다! 🌟',
        '축하드립니다! 보물을 찾으셨어요! 💎',
        '탐사의 신이 함께하셨나봐요! ✨',
        '이야~ 대단한 솜씨입니다! 👏'
    ];
    
    // 희귀도별 이모지
    const rarityEmojis = {
        'common': '⚪',
        'uncommon': '🟢',
        'rare': '🔵',
        'epic': '🟣',
        'legendary': '🟡',
        'mythic': '🔴'
    };
    
    // 가장 높은 등급 찾기
    let highestRarity = 'common';
    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    artifacts.forEach(artifact => {
        if (rarityOrder.indexOf(artifact.rarity) > rarityOrder.indexOf(highestRarity)) {
            highestRarity = artifact.rarity;
        }
    });
    
    // 결과 임베드
    const successEmbed = new EmbedBuilder()
        .setColor(highestRarity === 'mythic' ? '#FF0000' : 
                   highestRarity === 'legendary' ? '#FFD700' :
                   highestRarity === 'epic' ? '#9B59B6' :
                   highestRarity === 'rare' ? '#3498DB' : '#2ECC71')
        .setAuthor({ 
            name: `${interaction.user.username}의 탐사 결과`,
            iconURL: interaction.user.displayAvatarURL()
        })
        .setTitle('🎉 탐사 대성공!')
        .setDescription(`${company.name}에서 놀라운 발견을 했습니다!`)
        .setThumbnail('https://media.giphy.com/media/3oz8xAFtqoOUUrsh7W/giphy.gif');
    
    if (specialEvent) {
        successEmbed.addFields({
            name: `✨ ${specialEvent.name}`,
            value: specialEvent.description,
            inline: false
        });
    }
    
    // 발견한 유물들
    let artifactList = '';
    artifacts.forEach((artifact, index) => {
        if (artifact.isSpecial) {
            // 지역특화 유물은 특별 표시
            artifactList += `${artifact.emoji} **${artifact.name}** ⭐\n`;
            artifactList += `　└ ${artifact.rarity === 'legendary' ? '전설급' : '에픽급'} 특화 유물 | ${artifact.value.toLocaleString()} 골드\n`;
        } else {
            const rarityInfo = artifactData.rarities[artifact.rarity];
            const emoji = rarityEmojis[artifact.rarity] || '⚪';
            artifactList += `${emoji} **${artifact.name}**\n`;
            artifactList += `　└ ${rarityInfo.name} | ${artifact.value.toLocaleString()} 골드\n`;
        }
    });
    
    successEmbed.addFields(
        { 
            name: '🏺 발견한 유물', 
            value: artifactList || '없음', 
            inline: false 
        }
    );
    
    
    successEmbed.addFields(
        { 
            name: '📍 탐사 장소', 
            value: `${company.emoji} ${company.name}`, 
            inline: true 
        },
        { 
            name: '⛏️ 사용 곡괭이', 
            value: `${artifactData.pickaxes[pickaxeType].name} (Lv.${pickaxeLevel})`, 
            inline: true 
        },
        { 
            name: '💰 총 가치', 
            value: `${totalValue.toLocaleString()} 골드`, 
            inline: true 
        },
        { 
            name: '📈 획득 경험치', 
            value: `+${multiFind * 10} EXP`, 
            inline: true 
        },
        {
            name: '💬 축하 메시지',
            value: congratsMessages[Math.floor(Math.random() * congratsMessages.length)],
            inline: false
        }
    );
    
    successEmbed.setFooter({ text: '유물은 유물 상점에서 판매할 수 있습니다' });
    successEmbed.setTimestamp();

    // 곡괭이 경험치 추가
    userArtifacts.pickaxes[pickaxeType].experience += multiFind * 10;
    await userArtifacts.save();
    
    // 미션 진행도 업데이트
    await MissionHelper.updateArtifactExplore(userId);

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`artifact_explore_${userId}`)
                .setLabel('🗺️ 다시 탐사')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`artifact_inventory_${userId}`)
                .setLabel('🏺 유물 보관함')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`artifact_main_${userId}`)
                .setLabel('📋 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    // 공개 메시지로 전송
    await interaction.editReply({ 
        embeds: [successEmbed], 
        components: [buttons]
    });
}

// 인벤토리 표시
async function showInventory(interaction, userId, page = 0) {
    const userArtifacts = await UserArtifacts.findOne({ userId });
    const unsoldArtifacts = userArtifacts.artifacts.filter(a => !a.sold);
    
    const itemsPerPage = 10;
    const totalPages = Math.ceil(unsoldArtifacts.length / itemsPerPage);
    const currentPage = Math.min(page, totalPages - 1);
    
    const startIdx = currentPage * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageArtifacts = unsoldArtifacts.slice(startIdx, endIdx);

    const embed = new EmbedBuilder()
        .setColor('#4169E1')
        .setTitle('🏺 유물 보관함')
        .setDescription(`발굴한 유물: ${unsoldArtifacts.length}개`)
        .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages} | 💡 장비 인벤토리와는 별개의 유물 전용 보관함입니다` });

    if (pageArtifacts.length === 0) {
        embed.addFields({ name: '📭 보관함이 비어있습니다', value: '탐사를 통해 유물을 찾아보세요!' });
    } else {
        pageArtifacts.forEach((artifact, index) => {
            const rarityInfo = artifactData.rarities[artifact.rarity];
            const num = startIdx + index + 1;
            embed.addFields({
                name: `${num}. ${artifact.name}`,
                value: `등급: ${rarityInfo.name} | 가치: ${artifact.value.toLocaleString()} 골드\n발견일: ${new Date(artifact.foundDate).toLocaleDateString()}`,
                inline: true
            });
        });
    }

    const components = [];
    
    // 페이지네이션 버튼
    if (totalPages > 1) {
        const pageButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`artifact_inv_prev_${userId}_${currentPage - 1}`)
                    .setLabel('◀️ 이전')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`artifact_inv_next_${userId}_${currentPage + 1}`)
                    .setLabel('다음 ▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === totalPages - 1)
            );
        components.push(pageButtons);
    }

    // 메인 버튼
    const mainButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`artifact_shop_${userId}`)
                .setLabel('🏪 유물 상점')
                .setStyle(ButtonStyle.Success)
                .setDisabled(unsoldArtifacts.length === 0),
            new ButtonBuilder()
                .setCustomId(`artifact_main_${userId}`)
                .setLabel('메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    components.push(mainButtons);

    // 상호작용 상태에 따라 적절한 응답 방식 선택
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [embed], components });
        } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
            await interaction.update({ embeds: [embed], components });
        } else {
            await interaction.reply({ embeds: [embed], components });
        }
    } catch (error) {
        console.error('Inventory response error:', error);
        // 이미 응답한 경우 followUp 사용
        if (error.code === 'InteractionAlreadyReplied') {
            await interaction.followUp({ embeds: [embed], components, flags: 64 });
        }
    }
}

// 유물 상점
async function showArtifactShop(interaction, userId) {
    const userArtifacts = await UserArtifacts.findOne({ userId });
    const companies = await ArtifactCompany.find({});
    const stocks = await Stock.find({});
    
    const stockMap = {};
    stocks.forEach(stock => {
        stockMap[stock.companyId] = stock.currentPrice;
    });

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏪 유물 상점')
        .setDescription('보유한 유물을 현재 시세로 판매할 수 있습니다.')
        .addFields({ name: '📊 현재 시세', value: '회사별 주가에 따라 유물 가격이 변동됩니다.' });

    // 회사별 현재 시세 표시
    let priceInfo = '';
    companies.slice(0, 5).forEach(company => {
        const stockPrice = stockMap[company.companyId] || company.currentPrice;
        const priceChange = ((stockPrice / company.basePrice - 1) * 100).toFixed(1);
        const emoji = priceChange >= 0 ? '📈' : '📉';
        priceInfo += `${company.name}: ${emoji} ${priceChange}%\n`;
    });
    
    embed.addFields({ name: '주요 회사 시세', value: priceInfo || '시세 정보 없음', inline: true });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`artifact_sell_menu_${userId}`)
                .setLabel('💰 유물 판매')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`artifact_price_check_${userId}`)
                .setLabel('📊 가격 확인')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`artifact_main_${userId}`)
                .setLabel('뒤로가기')
                .setStyle(ButtonStyle.Secondary)
        );

    // 인터랙션 상태에 따라 적절한 응답 방법 선택
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [embed], components: [buttons] });
        } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
            await interaction.update({ embeds: [embed], components: [buttons] });
        } else {
            await interaction.reply({ embeds: [embed], components: [buttons], flags: 64 });
        }
    } catch (error) {
        console.error('Artifact shop response error:', error);
        // 이미 응답한 경우 followUp 사용
        if (error.code === 'InteractionAlreadyReplied') {
            await interaction.followUp({ embeds: [embed], components: [buttons], flags: 64 });
        }
    }
}

// 곡괭이 강화 메뉴
async function showPickaxeMenu(interaction, userId) {
    const user = await User.findOne({ discordId: userId });
    const userArtifacts = await UserArtifacts.findOne({ userId });

    const embed = new EmbedBuilder()
        .setColor('#CD853F')
        .setTitle('⛏️ 곡괭이 강화소')
        .setDescription('곡괭이를 강화하여 더 좋은 유물을 찾아보세요!');

    const pickaxeTypes = ['bronze', 'silver', 'gold'];
    
    pickaxeTypes.forEach(type => {
        const pickaxe = artifactData.pickaxes[type];
        const userPickaxe = userArtifacts.pickaxes[type];
        const isUnlocked = type === 'bronze' || userPickaxe.unlocked;
        const upgradeCost = pickaxe.upgradeCost(userPickaxe.level);
        
        let fieldValue = '';
        if (!isUnlocked) {
            const unlockCost = type === 'silver' ? 5000000000 : 10000000000;  // 은: 50억, 금: 100억
            fieldValue = `🔒 잠김 (해금 비용: ${unlockCost.toLocaleString()} 골드)`;
        } else {
            fieldValue = `레벨: ${userPickaxe.level}/100\n`;
            fieldValue += `발견 확률: ${(pickaxe.findChance(userPickaxe.level) * 100).toFixed(1)}%\n`;
            fieldValue += `품질 보너스: ${pickaxe.qualityBonus(userPickaxe.level).toFixed(2)}x\n`;
            if (userPickaxe.level < 100) {
                fieldValue += `강화 비용: ${upgradeCost.toLocaleString()} 골드`;
            } else {
                fieldValue += `✨ 최고 레벨 달성!`;
            }
        }
        
        embed.addFields({
            name: `${pickaxe.name} ${userArtifacts.currentPickaxe === type ? '(사용 중)' : ''}`,
            value: fieldValue,
            inline: true
        });
    });

    embed.addFields({ name: '💰 보유 골드', value: `${user.gold.toLocaleString()} 골드`, inline: false });

    const buttons = [];
    
    // 곡괭이 선택/강화 버튼
    const pickaxeButtons = new ActionRowBuilder();
    pickaxeTypes.forEach(type => {
        const userPickaxe = userArtifacts.pickaxes[type];
        const isUnlocked = type === 'bronze' || userPickaxe.unlocked;
        
        if (isUnlocked && userPickaxe.level < 100) {
            pickaxeButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`pickaxe_upgrade_${type}_${userId}`)
                    .setLabel(`${artifactData.pickaxes[type].name} 강화`)
                    .setStyle(ButtonStyle.Primary)
            );
        } else if (!isUnlocked) {
            pickaxeButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`pickaxe_unlock_${type}_${userId}`)
                    .setLabel(`${artifactData.pickaxes[type].name} 해금`)
                    .setStyle(ButtonStyle.Success)
            );
        }
    });
    
    if (pickaxeButtons.components.length > 0) {
        buttons.push(pickaxeButtons);
    }

    // 곡괭이 변경 버튼
    const changeButtons = new ActionRowBuilder();
    pickaxeTypes.forEach(type => {
        const userPickaxe = userArtifacts.pickaxes[type];
        const isUnlocked = type === 'bronze' || userPickaxe.unlocked;
        
        if (isUnlocked && userArtifacts.currentPickaxe !== type) {
            changeButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`pickaxe_change_${type}_${userId}`)
                    .setLabel(`${artifactData.pickaxes[type].name} 사용`)
                    .setStyle(ButtonStyle.Secondary)
            );
        }
    });
    
    if (changeButtons.components.length > 0) {
        buttons.push(changeButtons);
    }

    // 뒤로가기 버튼
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`artifact_main_${userId}`)
                .setLabel('뒤로가기')
                .setStyle(ButtonStyle.Secondary)
        );
    buttons.push(backButton);

    // 이미 defer된 상태에서는 editReply 사용
    if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components: buttons });
    } else if (interaction.replied) {
        await interaction.followUp({ embeds: [embed], components: buttons, flags: 64 });
    } else {
        await interaction.update({ embeds: [embed], components: buttons });
    }
}

// 랭킹 표시
async function showRankings(interaction, userId) {
    try {
        const rankingTypes = ['earnings', 'found', 'mythic', 'legendary'];
        const currentType = 'earnings'; // 기본값
        
        const rankings = await UserArtifacts.getExplorationRankings(currentType);
        const companies = await ArtifactCompany.getCompanyRankings();

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 유물 탐사 랭킹')
            .setDescription('최고의 탐사가들을 확인해보세요!');

        // 탐사가 랭킹
        let explorerRanking = '';
        if (rankings && rankings.length > 0) {
            // 유저 정보 가져오기
            const userIds = rankings.map(r => r.userId);
            const users = await User.find({ discordId: { $in: userIds } });
            const userMap = {};
            users.forEach(user => {
                userMap[user.discordId] = user;
            });

            rankings.forEach((explorer, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                const user = userMap[explorer.userId];
                const displayName = user?.nickname || user?.username || explorer.username || 'Unknown';
                explorerRanking += `${medal} ${displayName}\n`;
                explorerRanking += `   💰 ${(explorer.statistics?.totalEarnings || 0).toLocaleString()} 골드 | 🏺 ${explorer.statistics?.totalArtifactsFound || 0}개\n`;
            });
        }
        
        embed.addFields({ 
            name: '👥 탐사가 랭킹 (수익 기준)', 
            value: explorerRanking || '아직 랭킹이 없습니다.',
            inline: false 
        });

        // 회사 랭킹
        let companyRanking = '';
        if (companies && companies.length > 0) {
            companies.slice(0, 5).forEach((company, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                companyRanking += `${medal} ${company.name || 'Unknown'}\n`;
                companyRanking += `   💰 ${(company.totalRevenue || 0).toLocaleString()} 골드 | 🏺 ${company.totalArtifactsFound || 0}개\n`;
            });
        }
        
        embed.addFields({ 
            name: '🏢 회사 랭킹 (총 수익 기준)', 
            value: companyRanking || '아직 랭킹이 없습니다.',
            inline: false 
        });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`ranking_earnings_${userId}`)
                    .setLabel('💰 수익')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`ranking_found_${userId}`)
                    .setLabel('🏺 발견')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`ranking_mythic_${userId}`)
                    .setLabel('🌟 신화')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`artifact_main_${userId}`)
                    .setLabel('뒤로가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Artifact ranking error:', error);
        await interaction.editReply({
            content: '❌ 랭킹을 불러오는 중 오류가 발생했습니다.',
            embeds: [],
            components: []
        });
    }
}

// 유물 판매 메뉴
async function showArtifactSellMenu(interaction, userId) {
    const userArtifacts = await UserArtifacts.findOne({ userId });
    if (!userArtifacts || userArtifacts.artifacts.length === 0) {
        return interaction.editReply({
            content: '🏺 판매할 유물이 없습니다.',
            embeds: [],
            components: []
        });
    }
    
    const sellableArtifacts = userArtifacts.artifacts.filter(a => !a.sold);
    if (sellableArtifacts.length === 0) {
        return interaction.editReply({
            content: '🏺 판매 가능한 유물이 없습니다.',
            embeds: [],
            components: []
        });
    }
    
    // 희귀도별 이모지 정의
    const rarityEmojis = {
        'common': '⚪',
        'uncommon': '🟢',
        'rare': '🔵',
        'epic': '🟣',
        'legendary': '🟡',
        'mythic': '🔴'
    };
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏺 유물 판매')
        .setDescription('판매할 유물을 선택하세요. (한 번에 최대 10개)')
        .setFooter({ text: '유물을 선택하면 즉시 판매됩니다!' });
    
    // 최근 10개 유물만 표시
    const recentArtifacts = sellableArtifacts.slice(-10);
    let artifactList = '';
    recentArtifacts.forEach((artifact, index) => {
        const emoji = rarityEmojis[artifact.rarity] || '🏺';
        artifactList += `${index + 1}. ${emoji} **${artifact.name}**\n`;
        artifactList += `   가격: ${artifact.value.toLocaleString()} 골드\n`;
    });
    
    embed.addFields({ name: '보유 유물', value: artifactList || '없음' });
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`artifact_sell_select_${userId}`)
        .setPlaceholder('판매할 유물을 선택하세요')
        .setMinValues(1)
        .setMaxValues(Math.min(recentArtifacts.length, 10));
    
    recentArtifacts.forEach((artifact, index) => {
        const emoji = rarityEmojis[artifact.rarity] || '🏺';
        selectMenu.addOptions({
            label: artifact.name,
            description: `${artifact.rarity} - ${artifact.value.toLocaleString()} 골드`,
            value: artifact.id,
            emoji: emoji
        });
    });
    
    const components = [
        new ActionRowBuilder().addComponents(selectMenu),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`artifact_main_${userId}`)
                .setLabel('뒤로가기')
                .setStyle(ButtonStyle.Secondary)
        )
    ];
    
    await interaction.editReply({ embeds: [embed], components });
}

// 유물 판매 실행
async function executeArtifactSell(interaction, userId, selectedArtifactIds = null) {
    // StringSelectMenu에서 직접 전달받지 않은 경우 interaction.values에서 가져옴
    if (!selectedArtifactIds && interaction.isStringSelectMenu()) {
        selectedArtifactIds = interaction.values;
    }
    const user = await User.findOne({ discordId: userId });
    const userArtifacts = await UserArtifacts.findOne({ userId });
    
    if (!user || !userArtifacts) {
        return interaction.editReply({
            content: '❌ 사용자 정보를 찾을 수 없습니다.',
            embeds: [],
            components: []
        });
    }
    
    let totalGold = 0;
    let soldCount = 0;
    
    for (const artifactId of selectedArtifactIds) {
        const artifact = userArtifacts.artifacts.find(a => a.id === artifactId && !a.sold);
        if (artifact) {
            await userArtifacts.sellArtifact(artifactId, artifact.value);
            totalGold += artifact.value;
            soldCount++;
        }
    }
    
    if (soldCount === 0) {
        return interaction.editReply({
            content: '❌ 판매할 수 있는 유물이 없습니다.',
            embeds: [],
            components: []
        });
    }
    
    // 버그 사냥꾼 칭호 효과 적용
    const { applyGoldBonus } = require('../common/specialEffects');
    const originalGold = totalGold;
    totalGold = applyGoldBonus(totalGold, user);
    
    let bonusApplied = false;
    let bonusAmount = 0;
    if (totalGold > originalGold) {
        bonusApplied = true;
        bonusAmount = totalGold - originalGold;
        console.log(`[ArtifactExploration] ${user.nickname || user.discordId} - 특수 효과 적용: ${originalGold} → ${totalGold} (+${bonusAmount})`);
    }
    
    user.gold += totalGold;
    await user.save();
    
    // 골드 획득 미션 업데이트
    await MissionHelper.updateGoldEarned(userId, totalGold);
    
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('💰 유물 판매 완료!')
        .setDescription(`${soldCount}개의 유물을 판매했습니다.` + 
            (bonusApplied ? `\n\n🏷️ **버그 사냥꾼 칭호 효과** +${bonusAmount.toLocaleString()}G` : ''))
        .addFields(
            { name: '💵 획득 골드', value: `${totalGold.toLocaleString()} 골드`, inline: true },
            { name: '💰 현재 보유 골드', value: `${user.gold.toLocaleString()} 골드`, inline: true }
        );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`artifact_sell_menu_${userId}`)
                .setLabel('추가 판매')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`artifact_main_${userId}`)
                .setLabel('메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.editReply({ embeds: [embed], components: [buttons] });
}

// 유물 가격 확인
async function showArtifactPriceCheck(interaction, userId) {
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💰 유물 시세표')
        .setDescription('현재 유물 등급별 평균 시세입니다.')
        .setTimestamp();
    
    let priceInfo = '';
    for (const [rarity, data] of Object.entries(ARTIFACT_SYSTEM.rarities)) {
        const avgPrice = Math.floor(data.basePrice * 1.5);
        priceInfo += `${data.emoji} **${data.name}**: ${avgPrice.toLocaleString()} ~ ${(avgPrice * 2).toLocaleString()} 골드\n`;
    }
    
    embed.addFields(
        { name: '등급별 시세', value: priceInfo },
        { name: '💡 팁', value: '희귀도가 높을수록 가격 변동폭이 큽니다!' }
    );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`artifact_shop_${userId}`)
                .setLabel('상점으로')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`artifact_main_${userId}`)
                .setLabel('뒤로가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.editReply({ embeds: [embed], components: [buttons] });
}

// 광산 선택 메뉴
async function showMineSelection(interaction, userId) {
    const user = await User.findOne({ discordId: userId });
    const userArtifacts = await UserArtifacts.findOne({ userId }) || await createNewExplorer(userId, interaction.user.username);
    
    const embed = new EmbedBuilder()
        .setColor('#8B4513')
        .setTitle('🏔️ 광산 선택')
        .setDescription('탐사할 광산을 선택하세요. 각 광산마다 개방 시간과 보상이 다릅니다!')
        .setFooter({ text: '💡 일부 광산은 특정 시간이나 이벤트 때만 열립니다' });
    
    const mineButtons = [];
    let rowCount = 0;
    let currentRow = new ActionRowBuilder();
    
    for (const [mineId, mine] of Object.entries(MINE_SYSTEM.mines)) {
        const isOpen = mineManager.isOpen(mineId);
        const canEnterResult = await mineManager.canEnter(userId, mineId);
        const nextOpenTime = mineManager.getNextOpenTime(mineId);
        
        // 필드 추가
        let fieldValue = `${mine.description}\n`;
        fieldValue += `입장료: ${mine.entryFee.toLocaleString()} 골드\n`;
        fieldValue += `필요 레벨: ${mine.requiredLevel}\n`;
        fieldValue += `개방: ${mine.openSchedule.message}\n`;
        
        if (isOpen) {
            const mineState = mineManager.openMines.get(mineId);
            let timeLeft = 0;
            let minutes = 0;
            
            // 광산 타입에 따라 남은 시간 계산
            if (mine.openSchedule.type === 'always') {
                fieldValue += `✅ **항상 개방**`;
            } else if (mineState && mineState.closesAt) {
                timeLeft = Math.max(0, mineState.closesAt - Date.now());
                minutes = Math.floor(timeLeft / 60000);
                fieldValue += `✅ **현재 개방 중!** (${minutes}분 남음)`;
            } else if (mine.openSchedule.type === 'scheduled') {
                // 정기 개방 광산의 경우 남은 시간 계산
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                for (const openHour of mine.openSchedule.times) {
                    const openMinutes = openHour * 60;
                    const closeMinutes = openMinutes + mine.openSchedule.duration;
                    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
                        minutes = closeMinutes - currentMinutes;
                        fieldValue += `✅ **현재 개방 중!** (${minutes}분 남음)`;
                        break;
                    }
                }
            } else {
                fieldValue += `✅ **현재 개방 중!**`;
            }
            
            // 초보자 광산 남은 입장 횟수 표시
            if (mineId === 'beginner') {
                const todayCount = mineManager.getTodayBeginnerEntries(userId);
                fieldValue += `\n🎫 오늘 남은 입장: ${20 - todayCount}/20회`;
            }
            
            if (mineState && mineState.event && MINE_SYSTEM.events[mineState.event]) {
                fieldValue += `\n🌟 이벤트: ${MINE_SYSTEM.events[mineState.event].name}`;
            }
        } else if (nextOpenTime.nextOpen) {
            const timeUntil = nextOpenTime.nextOpen - Date.now();
            const hours = Math.floor(timeUntil / 3600000);
            const minutes = Math.floor((timeUntil % 3600000) / 60000);
            if (hours > 0) {
                fieldValue += `⏰ 다음 개방: ${hours}시간 ${minutes}분 후`;
            } else {
                fieldValue += `⏰ 다음 개방: ${minutes}분 후`;
            }
        } else {
            fieldValue += `🔒 ${nextOpenTime.message || '개방 시간 미정'}`;
        }
        
        embed.addFields({
            name: `${mine.emoji} ${mine.name}`,
            value: fieldValue,
            inline: true
        });
        
        // 버튼 생성 (레벨 조건 충족 시)
        if (user.level >= mine.requiredLevel) {
            const button = new ButtonBuilder()
                .setCustomId(`mine_enter_${mineId}_${userId}`)
                .setLabel(mine.name)
                .setEmoji(mine.emoji)
                .setStyle(isOpen ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(!isOpen || user.gold < mine.entryFee);
            
            currentRow.addComponents(button);
            rowCount++;
            
            if (rowCount === 5) {
                mineButtons.push(currentRow);
                currentRow = new ActionRowBuilder();
                rowCount = 0;
            }
        }
    }
    
    if (rowCount > 0) {
        mineButtons.push(currentRow);
    }
    
    // 뒤로가기 버튼
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`artifact_main_${userId}`)
                .setLabel('뒤로가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    mineButtons.push(backButton);
    
    // 인터랙션 응답
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed], components: mineButtons });
    } else if (interaction.isButton()) {
        await interaction.update({ embeds: [embed], components: mineButtons });
    } else {
        await interaction.reply({ embeds: [embed], components: mineButtons, flags: 64 });
    }
}

// 광산 입장
async function enterMine(interaction, mineId, userId) {
    const user = await User.findOne({ discordId: userId });
    const mine = MINE_SYSTEM.mines[mineId];
    const canEnterResult = await mineManager.canEnter(userId, mineId);
    
    if (!canEnterResult.canEnter) {
        // 뒤로가기 버튼 추가
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`artifact_mines_${userId}`)
                    .setLabel('🏔️ 광산 목록으로')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        return interaction.editReply({
            content: `❌ ${canEnterResult.reason}`,
            embeds: [],
            components: [backButton]
        });
    }
    
    if (user.gold < mine.entryFee) {
        // 뒤로가기 버튼 추가
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`artifact_mines_${userId}`)
                    .setLabel('🏔️ 광산 목록으로')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        return interaction.editReply({
            content: `💸 입장료가 부족합니다! 필요: ${mine.entryFee.toLocaleString()} 골드`,
            embeds: [],
            components: [backButton]
        });
    }
    
    // 입장료 차감
    user.gold -= mine.entryFee;
    await user.save();
    
    // 입장 기록
    await mineManager.recordEntry(userId, mineId);
    
    // 광산 탐사 시작
    await performMineExploration(interaction, userId, mineId);
}

// 광산 탐사 실행
async function performMineExploration(interaction, userId, mineId) {
    const mine = MINE_SYSTEM.mines[mineId];
    const mineState = mineManager.openMines.get(mineId);
    const userArtifacts = await UserArtifacts.findOne({ userId });
    
    // 탐사 중 애니메이션
    const embed = new EmbedBuilder()
        .setColor('#8B4513')
        .setTitle(`${mine.emoji} ${mine.name} 탐사 중...`)
        .setDescription('곡괭이로 열심히 캐고 있습니다...')
        .setImage('https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExaHJvbXZqMHBzYXVwaXgxanh6ZXl5MHl2YnRlczR6MXZqcDc4c2t5OCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/M1rYHhCGRuUNy/giphy.gif');
    
    // 이미 deferUpdate가 호출된 상태이므로 editReply만 사용
    await interaction.editReply({ embeds: [embed] });
    
    // 2초 대기 (탐사 애니메이션)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 보상 계산
    const pickaxeType = userArtifacts.currentPickaxe;
    const pickaxeLevel = userArtifacts.pickaxes[pickaxeType].level;
    const baseReward = mine.rewardMultiplier;
    const eventBonus = (mineState.event && MINE_SYSTEM.events[mineState.event]) ? MINE_SYSTEM.events[mineState.event].rewardBonus : 1;
    
    // 발견 개수 (1~3개, 이벤트 시 추가)
    const findCount = Math.floor(1 + Math.random() * 3 * eventBonus);
    const artifacts = [];
    
    for (let i = 0; i < findCount; i++) {
        // 희귀도 계산 (광산 난이도와 곡괭이 레벨 반영)
        const rarityBonus = mine.difficulty + Math.floor(pickaxeLevel / 20);
        const rarity = calculateRarityWithBonus(pickaxeType, pickaxeLevel, 'mine', rarityBonus);
        
        // 특수 아이템 확률
        if (mine.specialDrops.length > 0 && Math.random() < 0.1 * eventBonus) {
            const specialItem = mine.specialDrops[Math.floor(Math.random() * mine.specialDrops.length)];
            const special = MINE_SYSTEM.specialRewards[specialItem];
            artifacts.push({
                id: `${Date.now()}_${i}_special`,
                name: special.name,
                rarity: special.rarity,
                baseItem: special.name,  // 특별 아이템도 baseItem 필요
                value: Math.floor(1000 * mine.rewardMultiplier * eventBonus),
                special: true,
                emoji: special.emoji
            });
        } else {
            // 일반 유물
            const items = artifactData.items[rarity];
            const item = items[Math.floor(Math.random() * items.length)];
            const artifactName = artifactData.generateArtifactName(rarity, item);
            // 광산별 기본 가격 설정
            const mineBasePrices = {
                beginner: 100,     // 100-500G
                crystal: 500,      // 500-2500G
                ancient: 2000,     // 2000-10000G
                volcanic: 5000,    // 5000-25000G
                deepDark: 10000,   // 10000-50000G
                legendary: 50000   // 50000-250000G
            };
            const basePrice = mineBasePrices[mineId] || 1000;
            const rarityMultiplier = artifactData.rarities[rarity].priceMultiplier || 1;
            const value = Math.floor(basePrice * rarityMultiplier * baseReward * eventBonus * (0.8 + Math.random() * 0.4));
            
            artifacts.push({
                id: `${Date.now()}_${i}`,
                name: artifactName,
                rarity: rarity,
                baseItem: item,
                value: value,
                foundAt: mineId
            });
        }
    }
    
    // 유물 저장
    for (const artifact of artifacts) {
        await userArtifacts.addArtifact(artifact);
    }
    
    // 주문서 드롭 체크 (0.3% 확률)
    const scrollDropped = [];
    if (Math.random() < 0.003) {
        const scrollTypes = [
            { id: 'enhancement_protection', name: '강화 보호 주문서', description: '강화 실패 시 레벨 유지' },
            { id: 'enhancement_blessing', name: '강화 축복 주문서', description: '강화 성공률 2배 증가' },
            { id: 'emblem_protection', name: '엠블렘 보호 주문서', description: '엠블렘 강화 실패 시 레벨 유지' },
            { id: 'emblem_blessing', name: '엠블렘 축복 주문서', description: '엠블렘 강화 성공률 2배 증가' }
        ];
        
        const scroll = scrollTypes[Math.floor(Math.random() * scrollTypes.length)];
        const user = await User.findOne({ discordId: userId });
        
        if (user) {
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
            await user.save();
            scrollDropped.push(scroll);
        }
    }
    
    // 결과 표시 (재미있게!)
    const exclamations = ['대박!', '와우!', '짱이에요!', '굉장해요!', '놀라워요!', '멋져요!', '최고에요!'];
    const randomExclamation = exclamations[Math.floor(Math.random() * exclamations.length)];
    
    // 희귀도별 이모지와 색상
    const rarityEmojis = {
        'common': '⚪',
        'uncommon': '🟢',
        'rare': '🔵',
        'epic': '🟣',
        'legendary': '🟡',
        'mythic': '🔴'
    };
    
    const rarityColors = {
        'common': '#808080',
        'uncommon': '#00FF00',
        'rare': '#0080FF',
        'epic': '#800080',
        'legendary': '#FFA500',
        'mythic': '#FF0000'
    };
    
    // 가장 높은 등급 찾기
    let highestRarity = 'common';
    const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    artifacts.forEach(artifact => {
        if (rarityOrder.indexOf(artifact.rarity) > rarityOrder.indexOf(highestRarity)) {
            highestRarity = artifact.rarity;
        }
    });
    
    const resultEmbed = new EmbedBuilder()
        .setColor(rarityColors[highestRarity] || '#FFD700')
        .setAuthor({ 
            name: `${interaction.user.username}의 광산 탐사`,
            iconURL: interaction.user.displayAvatarURL()
        })
        .setTitle(`${mine.emoji} ${randomExclamation} ${mine.name} 탐사 대성공!`)
        .setDescription(`⛏️ 곡괭이질 ${findCount * 10}번 만에 놀라운 발견을 했습니다!`)
        .setThumbnail('https://media.giphy.com/media/XFpqBOjz8nejW7Wcxe/giphy.gif');
    
    if (mineState.event && MINE_SYSTEM.events[mineState.event]) {
        const event = MINE_SYSTEM.events[mineState.event];
        resultEmbed.addFields({
            name: `${event.emoji} ✨특별 이벤트 발동!✨`,
            value: `**${event.name}** - ${event.description}`,
            inline: false
        });
    }
    
    // 발견 유물 목록 (더 화려하게)
    resultEmbed.addFields({
        name: '🏺 발견한 보물들',
        value: '━━━━━━━━━━━━━━━━━━━━',
        inline: false
    });
    
    let totalValue = 0;
    artifacts.forEach((artifact, index) => {
        totalValue += artifact.value;
        const rarityInfo = artifactData.rarities[artifact.rarity];
        const emoji = artifact.special ? artifact.emoji : rarityEmojis[artifact.rarity];
        
        let fieldName = `${emoji} **${artifact.name}**`;
        if (artifact.rarity === 'mythic') {
            fieldName = `🌟💎 **${artifact.name}** 💎🌟`;
        } else if (artifact.rarity === 'legendary') {
            fieldName = `✨ **${artifact.name}** ✨`;
        }
        
        resultEmbed.addFields({
            name: fieldName,
            value: `└ ${artifact.special ? '특별 ' : ''}${rarityInfo ? rarityInfo.name : artifact.rarity} | 💰 ${artifact.value.toLocaleString()} 골드`,
            inline: false
        });
    });
    
    resultEmbed.addFields(
        { name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━', inline: false },
        { 
            name: '📊 탐사 결과', 
            value: `발견 유물: **${artifacts.length}개**\n획득 경험치: **+${findCount * 15} EXP**\n입장료: **-${mine.entryFee.toLocaleString()} 골드**`, 
            inline: true 
        },
        { 
            name: '💰 총 수익', 
            value: `유물 가치: **${totalValue.toLocaleString()} 골드**\n순수익: **${(totalValue - mine.entryFee).toLocaleString()} 골드**`, 
            inline: true 
        }
    );
    
    // 주문서 드롭 표시
    if (scrollDropped.length > 0) {
        let scrollList = '';
        scrollDropped.forEach(scroll => {
            scrollList += `📜 **${scroll.name}**\n`;
        });
        resultEmbed.addFields({
            name: '✨ 특별 보상!',
            value: scrollList,
            inline: false
        });
    }
    
    const profitRate = ((totalValue - mine.entryFee) / mine.entryFee * 100).toFixed(1);
    if (profitRate > 0) {
        resultEmbed.setFooter({ text: `🎉 수익률 ${profitRate}%! 대박이네요!` });
    } else {
        resultEmbed.setFooter({ text: `💔 이번엔 아쉬웠지만 다음엔 대박날 거예요!` });
    }
    
    // 경험치 추가
    userArtifacts.pickaxes[pickaxeType].experience += findCount * 15;
    await userArtifacts.save();
    
    // 엠블럼 행운의 주문서 드롭 체크 (0.1% 확률)
    let luckyScrollDropped = false;
    if (Math.random() < 0.001) { // 0.1%
        const user = await User.findOne({ discordId: userId });
        if (!user.items) user.items = {};
        if (!user.items.emblemLuckyScroll) user.items.emblemLuckyScroll = 0;
        user.items.emblemLuckyScroll += 1;
        await user.save();
        luckyScrollDropped = true;
        
        // 특별 알림 추가
        resultEmbed.addFields({
            name: '🍀 ✨특별한 발견!✨',
            value: '**엠블럼 행운의 주문서**를 발견했습니다! (0.1% 확률)',
            inline: false
        });
    }
    
    // 미션 진행도 업데이트
    await MissionHelper.updateArtifactExplore(userId);
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`artifact_mines_${userId}`)
                .setLabel('🏔️ 다른 광산')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`artifact_inventory_${userId}`)
                .setLabel('🏺 유물 보관함')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`artifact_main_${userId}`)
                .setLabel('메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.editReply({ embeds: [resultEmbed], components: [buttons] });
}

// 헬퍼 함수들
function createNewExplorer(userId, username) {
    return UserArtifacts.create({
        userId,
        username,
        pickaxes: {
            bronze: { level: 1, experience: 0 },
            silver: { level: 0, experience: 0, unlocked: false },
            gold: { level: 0, experience: 0, unlocked: false }
        },
        currentPickaxe: 'bronze'
    });
}

function getSpecialtyName(specialty) {
    const specialtyNames = {
        'ancient': '고대 유물',
        'treasure': '보물',
        'rare': '희귀품',
        'deep': '심층 탐사',
        'relic': '성물',
        'artifact': '아티팩트',
        'gold': '황금',
        'antique': '골동품',
        'crystal': '수정',
        'mystic': '신비',
        'legendary': '전설',
        'fortune': '행운',
        'scholar': '학술',
        'valuable': '귀중품',
        'historical': '역사'
    };
    return specialtyNames[specialty] || specialty;
}

function getCompanyEmoji(specialty) {
    const emojis = {
        'ancient': '🏛️',
        'treasure': '💎',
        'rare': '🔮',
        'deep': '⚒️',
        'relic': '📿',
        'artifact': '🏺',
        'gold': '🏆',
        'antique': '🕰️',
        'crystal': '💠',
        'mystic': '🔯',
        'legendary': '⚔️',
        'fortune': '🍀',
        'scholar': '📚',
        'valuable': '👑',
        'historical': '📜'
    };
    return emojis[specialty] || '🏢';
}

function calculateRarityWithBonus(pickaxeType, pickaxeLevel, companySpecialty, rarityBonus) {
    let rarity = artifactData.calculateRarity(pickaxeType, pickaxeLevel, companySpecialty);
    
    // 등급 보너스 적용
    if (rarityBonus > 0) {
        const rarities = Object.keys(artifactData.rarities);
        const currentIndex = rarities.indexOf(rarity);
        const newIndex = Math.min(currentIndex + rarityBonus, rarities.length - 1);
        rarity = rarities[newIndex];
    }
    
    return rarity;
}

async function checkAchievements(userArtifacts, newArtifacts) {
    const achievements = artifactData.achievements;
    const user = await User.findOne({ discordId: userArtifacts.userId });
    
    // 첫 발견
    if (userArtifacts.statistics.totalArtifactsFound === 1 && !userArtifacts.achievements.some(a => a.id === 'firstFind')) {
        await userArtifacts.unlockAchievement('firstFind', achievements.firstFind);
        if (user) {
            // 버그 사냥꾼 칭호 효과 적용
            const { applyGoldBonus } = require('../common/specialEffects');
            let reward = applyGoldBonus(achievements.firstFind.reward, user);
            
            user.gold += reward;
            await user.save();
            await MissionHelper.updateGoldEarned(userId, reward);
        }
    }
    
    // 수집가 업적들
    if (userArtifacts.statistics.totalArtifactsFound >= 10 && !userArtifacts.achievements.some(a => a.id === 'collector10')) {
        await userArtifacts.unlockAchievement('collector10', achievements.collector10);
        if (user) {
            // 버그 사냥꾼 칭호 효과 적용
            const { applyGoldBonus } = require('../common/specialEffects');
            let reward = applyGoldBonus(achievements.collector10.reward, user);
            
            user.gold += reward;
            await user.save();
            await MissionHelper.updateGoldEarned(userId, reward);
        }
    }
    
    if (userArtifacts.statistics.totalArtifactsFound >= 100 && !userArtifacts.achievements.some(a => a.id === 'collector100')) {
        await userArtifacts.unlockAchievement('collector100', achievements.collector100);
        if (user) {
            // 버그 사냥꾼 칭호 효과 적용
            const { applyGoldBonus } = require('../common/specialEffects');
            let reward = applyGoldBonus(achievements.collector100.reward, user);
            
            user.gold += reward;
            await user.save();
            await MissionHelper.updateGoldEarned(userId, reward);
        }
    }
    
    // 등급별 업적
    for (const artifact of newArtifacts) {
        if (artifact.rarity === 'rare' && !userArtifacts.achievements.some(a => a.id === 'rareFinder')) {
            await userArtifacts.unlockAchievement('rareFinder', achievements.rareFinder);
            if (user) {
                // 버그 사냥꾼 칭호 효과 적용
                const { applyGoldBonus } = require('../common/specialEffects');
                let reward = applyGoldBonus(achievements.rareFinder.reward, user);
                
                user.gold += reward;
                await user.save();
                await MissionHelper.updateGoldEarned(userId, reward);
            }
        }
        if (artifact.rarity === 'epic' && !userArtifacts.achievements.some(a => a.id === 'epicFinder')) {
            await userArtifacts.unlockAchievement('epicFinder', achievements.epicFinder);
            if (user) {
                // 버그 사냥꾼 칭호 효과 적용
                const { applyGoldBonus } = require('../common/specialEffects');
                let reward = applyGoldBonus(achievements.epicFinder.reward, user);
                
                user.gold += reward;
                await user.save();
                await MissionHelper.updateGoldEarned(userId, reward);
            }
        }
        if (artifact.rarity === 'legendary' && !userArtifacts.achievements.some(a => a.id === 'legendaryFinder')) {
            await userArtifacts.unlockAchievement('legendaryFinder', achievements.legendaryFinder);
            if (user) {
                // 버그 사냥꾼 칭호 효과 적용
                const { applyGoldBonus } = require('../common/specialEffects');
                let reward = applyGoldBonus(achievements.legendaryFinder.reward, user);
                
                user.gold += reward;
                await user.save();
                await MissionHelper.updateGoldEarned(userId, reward);
            }
        }
        if (artifact.rarity === 'mythic' && !userArtifacts.achievements.some(a => a.id === 'mythicFinder')) {
            await userArtifacts.unlockAchievement('mythicFinder', achievements.mythicFinder);
            if (user) {
                // 버그 사냥꾼 칭호 효과 적용
                const { applyGoldBonus } = require('../common/specialEffects');
                let reward = applyGoldBonus(achievements.mythicFinder.reward, user);
                
                user.gold += reward;
                await user.save();
                await MissionHelper.updateGoldEarned(userId, reward);
            }
        }
    }
}

// 상호작용 핸들러
async function handleArtifactInteraction(interaction) {
    const [action, ...params] = interaction.customId.split('_');
    const userId = params[params.length - 1];

    // 권한 체크
    if (interaction.user.id !== userId) {
        if (!interaction.deferred && !interaction.replied) {
            return interaction.reply({ content: '❌ 다른 유저의 메뉴는 사용할 수 없습니다!', flags: 64 });
        } else {
            return interaction.followUp({ content: '❌ 다른 유저의 메뉴는 사용할 수 없습니다!', flags: 64 });
        }
    }

    // 버튼 인터랙션인 경우 먼저 defer (이미 defer되지 않은 경우에만)
    if (!interaction.deferred && !interaction.replied) {
        if (interaction.isButton()) {
            if (action === 'mine' && params[0] === 'enter') {
                await interaction.deferReply();  // 전체 공개
            } else {
                try {
                    await interaction.deferUpdate();  // 기존 메시지 업데이트
                } catch (error) {
                    // 이미 defer되었거나 응답된 경우 무시
                    console.log('Defer update error (already deferred/replied):', error.message);
                }
            }
        } else if (interaction.isStringSelectMenu()) {
            try {
                await interaction.deferUpdate();
            } catch (error) {
                // 이미 defer되었거나 응답된 경우 무시
                console.log('Defer update error (already deferred/replied):', error.message);
            }
        }
    }

    try {
        switch (action) {
            case 'artifact':
                if (params[0] === 'main') {
                    await showExplorationMenu(interaction, userId);
                } else if (params[0] === 'explore') {
                    await showCompanySelection(interaction, userId);
                } else if (params[0] === 'inventory') {
                    await showInventory(interaction, userId);
                } else if (params[0] === 'shop') {
                    await showArtifactShop(interaction, userId);
                } else if (params[0] === 'pickaxe') {
                    await showPickaxeMenu(interaction, userId);
                } else if (params[0] === 'ranking') {
                    await showRankings(interaction, userId);
                } else if (params[0] === 'inv') {
                    if (params[1] === 'prev' || params[1] === 'next') {
                        const page = parseInt(params[3]);
                        await showInventory(interaction, userId, page);
                    }
                } else if (params[0] === 'mines') {
                    await showMineSelection(interaction, userId);
                } else if (params[0] === 'sell' && params[1] === 'menu') {
                    await showArtifactSellMenu(interaction, userId);
                } else if (params[0] === 'sell' && params[1] === 'select') {
                    // StringSelectMenu로 선택한 유물 판매
                    if (interaction.isStringSelectMenu()) {
                        const selectedArtifactIds = interaction.values;
                        await executeArtifactSell(interaction, userId, selectedArtifactIds);
                    } else {
                        await executeArtifactSell(interaction, userId);
                    }
                } else if (params[0] === 'price' && params[1] === 'check') {
                    await showArtifactPriceCheck(interaction, userId);
                }
                break;
                
            case 'explore':
                const companyId = params[0];
                await executeExploration(interaction, userId, companyId);
                break;
                
            case 'company':
                if (params[0] === 'select') {
                    const selectedValue = interaction.values[0];
                    const [_, companyId, uid] = selectedValue.split('_');
                    await executeExploration(interaction, uid, companyId);
                }
                break;
                
            case 'pickaxe':
                if (params[0] === 'upgrade') {
                    await upgradePickaxe(interaction, params[1], userId);
                } else if (params[0] === 'unlock') {
                    await unlockPickaxe(interaction, params[1], userId);
                } else if (params[0] === 'change') {
                    await changePickaxe(interaction, params[1], userId);
                }
                break;
                
            case 'ranking':
                await showRankings(interaction, userId, params[0]);
                break;
                
            case 'mine':
                if (params[0] === 'enter') {
                    const mineId = params[1];
                    await enterMine(interaction, mineId, userId);
                }
                break;
            
        }
    } catch (error) {
        console.error('Artifact exploration error:', error);
        // 이미 응답된 경우를 처리
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: '❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 
                    flags: 64 
                });
            } else {
                await interaction.followUp({ 
                    content: '❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 
                    flags: 64 
                });
            }
        } catch (replyError) {
            console.error('Error sending error message:', replyError);
        }
    }
}

// 곡괭이 강화
async function upgradePickaxe(interaction, pickaxeType, userId) {
    try {
        const user = await User.findOne({ discordId: userId });
        const userArtifacts = await UserArtifacts.findOne({ userId });
        
        if (!user || !userArtifacts) {
            throw new Error('사용자 정보를 찾을 수 없습니다.');
        }
        
        if (!artifactData.pickaxes[pickaxeType]) {
            throw new Error('잘못된 곡괭이 유형입니다.');
        }
        
        const pickaxe = artifactData.pickaxes[pickaxeType];
        const userPickaxe = userArtifacts.pickaxes[pickaxeType];
        
        if (!userPickaxe) {
            throw new Error('해당 곡괭이를 보유하고 있지 않습니다.');
        }
        
        const upgradeCost = pickaxe.upgradeCost(userPickaxe.level);
        
        if (user.gold < upgradeCost) {
            return interaction.editReply({
                content: `💸 강화 비용이 부족합니다! 필요: ${upgradeCost.toLocaleString()} 골드`,
                embeds: [],
                components: []
            });
        }
        
        user.gold -= upgradeCost;
        await user.save();
        await userArtifacts.upgradePickaxe(pickaxeType);
        
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✨ 강화 성공!')
            .setDescription(`${pickaxe.name}이(가) 레벨 ${userPickaxe.level + 1}로 강화되었습니다!`)
            .addFields(
                { name: '발견 확률', value: `${(pickaxe.findChance(userPickaxe.level + 1) * 100).toFixed(1)}%`, inline: true },
                { name: '품질 보너스', value: `${pickaxe.qualityBonus(userPickaxe.level + 1).toFixed(2)}x`, inline: true }
            );
        
        // 강화 성공 메시지와 함께 곡괭이 메뉴로 돌아가기 버튼 추가
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`artifact_pickaxe_${userId}`)
                    .setLabel('곡괭이 메뉴로 돌아가기')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.editReply({ embeds: [embed], components: [backButton] });
    } catch (error) {
        console.error('Pickaxe upgrade error:', error);
        const errorMessage = `❌ 곡괭이 강화 중 오류가 발생했습니다: ${error.message}`;
        
        if (interaction.deferred || interaction.replied) {
            return interaction.editReply({ content: errorMessage });
        } else {
            return interaction.reply({ content: errorMessage, flags: 64 });
        }
    }
}

// 곡괭이 잠금 해제
async function unlockPickaxe(interaction, pickaxeType, userId) {
    const user = await User.findOne({ discordId: userId });
    const userArtifacts = await UserArtifacts.findOne({ userId });
    
    const unlockCost = pickaxeType === 'silver' ? 5000000000 : 10000000000;  // 은: 50억, 금: 100억
    
    if (user.gold < unlockCost) {
        return interaction.reply({
            content: `💸 해금 비용이 부족합니다! 필요: ${unlockCost.toLocaleString()} 골드`,
            flags: 64
        });
    }
    
    user.gold -= unlockCost;
    await user.save();
    await userArtifacts.unlockPickaxe(pickaxeType);
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🔓 잠금 해제!')
        .setDescription(`${artifactData.pickaxes[pickaxeType].name}을(를) 사용할 수 있게 되었습니다!`);
    
    await interaction.reply({ embeds: [embed], flags: 64 });
    await showPickaxeMenu(interaction, userId);
}

// 곡괭이 변경
async function changePickaxe(interaction, pickaxeType, userId) {
    const userArtifacts = await UserArtifacts.findOne({ userId });
    
    userArtifacts.currentPickaxe = pickaxeType;
    await userArtifacts.save();
    
    const embed = new EmbedBuilder()
        .setColor('#4169E1')
        .setTitle('⛏️ 곡괭이 변경')
        .setDescription(`${artifactData.pickaxes[pickaxeType].name}을(를) 사용하도록 변경했습니다!`);
    
    await interaction.reply({ embeds: [embed], flags: 64 });
    await showPickaxeMenu(interaction, userId);
}

module.exports = {
    showExplorationMenu,
    handleArtifactInteraction,
    showArtifactExplorationMenu: showExplorationMenu,
    showDirectExplorationMenu: showCompanySelection,
    showExplorationModal: executeExploration,
    executeExploration,
    showArtifactInventory: showInventory
};