const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { formatNumber } = require('../common/utils');

// 티어 이모지 헬퍼
function getTierEmoji(tier) {
    const emojis = {
        'Bronze': '🥉',
        'Silver': '🥈',
        'Gold': '🥇',
        'Platinum': '💎',
        'Diamond': '💠',
        'Master': '🏆',
        'Grandmaster': '👑',
        'Challenger': '🌟'
    };
    return emojis[tier] || '🥉';
}

// 랭킹 카테고리 정의
const RANKING_CATEGORIES = {
    level: {
        name: '📈 레벨 랭킹',
        description: '레벨과 경험치 달성도',
        emoji: '📈'
    },
    combatPower: {
        name: '⚔️ 전투력/마력 랭킹',
        description: '전투력 또는 마력 순위',
        emoji: '⚔️'
    },
    gold: {
        name: '💰 골드 랭킹',
        description: '보유 골드 순위',
        emoji: '💰'
    },
    popularity: {
        name: '❤️ 인기도 랭킹',
        description: '인기도 순위',
        emoji: '❤️'
    },
    enhance: {
        name: '🔨 강화 랭킹',
        description: '최고 강화 아이템 순위',
        emoji: '🔨'
    },
    pvp: {
        name: '🥊 PVP 랭킹',
        description: 'PVP 레이팅 순위',
        emoji: '🥊'
    },
    artifact: {
        name: '🏺 유물 랭킹',
        description: '유물 가격 및 발굴 횟수',
        emoji: '🏺'
    },
    fishing: {
        name: '🎣 낚시 랭킹',
        description: '낚시 횟수 및 희귀도',
        emoji: '🎣'
    },
    dungeon: {
        name: '🏰 던전 랭킹',
        description: '최고 층수 도달 순위',
        emoji: '🏰'
    },
    boss: {
        name: '👹 보스 토벌 랭킹',
        description: '보스 토벌 횟수 및 최대 딜량',
        emoji: '👹'
    },
    attendance: {
        name: '📅 출석 랭킹',
        description: '연속 출석 일수 순위',
        emoji: '📅'
    },
    exercise: {
        name: '💪 운동 랭킹',
        description: '운동 레벨 및 누적 운동량',
        emoji: '💪'
    }
};

// 랭킹 메인 메뉴 표시
async function showRankingMainMenu(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 김헌터 종합 랭킹 시스템')
            .setDescription('확인하고 싶은 랭킹 카테고리를 선택해주세요!')
            .setTimestamp();
        
        // 카테고리 설명 추가
        const fields = [];
        for (const [key, category] of Object.entries(RANKING_CATEGORIES)) {
            fields.push({
                name: category.name,
                value: category.description,
                inline: true
            });
        }
        embed.addFields(fields);
        
        // 선택 메뉴 생성
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ranking_category_select')
            .setPlaceholder('🏅 랭킹 카테고리를 선택하세요')
            .addOptions(
                Object.entries(RANKING_CATEGORIES).map(([key, category]) => ({
                    label: category.name,
                    description: category.description,
                    value: key,
                    emoji: category.emoji
                }))
            );
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        // 뒤로가기 버튼
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [row, buttonRow]
        });
    } catch (error) {
        console.error('랭킹 메인 메뉴 오류:', error);
        await interaction.followUp({
            content: '❌ 랭킹 메뉴를 불러오는 중 오류가 발생했습니다.',
            flags: 64
        });
    }
}

// 표준화된 랭킹 임베드 생성
function createRankingEmbed(title, description, rankings, userRank = null) {
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(title)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: '🏆 김헌터 공식 랭킹' });
    
    // 랭킹 데이터가 없을 때
    if (!rankings || rankings.length === 0) {
        embed.addFields({
            name: '📊 랭킹 정보',
            value: '아직 랭킹 데이터가 없습니다.',
            inline: false
        });
        return embed;
    }
    
    // TOP 10 랭킹 표시
    const rankingText = rankings.map((data, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
        return `${medal} ${data.text}`;
    }).join('\n');
    
    embed.addFields({
        name: '🏅 TOP 10',
        value: rankingText,
        inline: false
    });
    
    // 현재 유저 순위 표시
    if (userRank) {
        embed.addFields({
            name: '🎯 내 순위',
            value: userRank,
            inline: false
        });
    }
    
    return embed;
}

// 레벨 랭킹
async function showLevelRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        // 레벨 순위
        const levelRankings = await User.find({ registered: true })
            .sort({ level: -1, exp: -1 })
            .limit(10)
            .select('nickname level exp');
        
        const levelData = levelRankings.map(user => ({
            text: `**${user.nickname || '알 수 없음'}** - Lv.${user.level} (${formatNumber(user.exp)} EXP)`
        }));
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser) {
            const rank = await User.countDocuments({
                registered: true,
                $or: [
                    { level: { $gt: currentUser.level } },
                    { level: currentUser.level, exp: { $gt: currentUser.exp } }
                ]
            }) + 1;
            userRank = `**${rank}위** - Lv.${currentUser.level} (${formatNumber(currentUser.exp)} EXP)`;
        }
        
        const embed = createRankingEmbed(
            '📈 레벨 랭킹',
            '서버 내 최고 레벨 유저들입니다!',
            levelData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('레벨 랭킹 오류:', error);
    }
}

// 전투력/마력 랭킹
async function showCombatPowerRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        const { calculateCombatPower } = require('../common/combatPower');
        
        // 모든 유저 가져오기
        const allUsers = await User.find({ registered: true });
        
        // 전투력 계산 및 정렬
        const userPowers = allUsers.map(user => {
            const power = calculateCombatPower(user);
            const isMage = user.emblem && (
                user.emblem.includes('마법사') || 
                user.emblem.includes('원소 술사') ||
                user.emblem.includes('신비한 현자') ||
                user.emblem.includes('대마법사') ||
                user.emblem.includes('아크메이지')
            );
            
            return {
                user,
                power,
                isMage
            };
        }).sort((a, b) => b.power - a.power);
        
        const top10 = userPowers.slice(0, 10);
        const powerData = top10.map(({ user, power, isMage }) => ({
            text: `**${user.nickname || '알 수 없음'}** - ${isMage ? '🔮 마력' : '⚔️ 전투력'}: ${formatNumber(power)}`
        }));
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser) {
            const userIndex = userPowers.findIndex(u => u.user.discordId === currentUser.discordId);
            if (userIndex !== -1) {
                const { power, isMage } = userPowers[userIndex];
                userRank = `**${userIndex + 1}위** - ${isMage ? '🔮 마력' : '⚔️ 전투력'}: ${formatNumber(power)}`;
            }
        }
        
        const embed = createRankingEmbed(
            '⚔️ 전투력/마력 랭킹',
            '서버 내 최강의 전사들과 마법사들입니다!',
            powerData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('전투력 랭킹 오류:', error);
    }
}

// 골드 랭킹
async function showGoldRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        const goldRankings = await User.find({ registered: true })
            .sort({ gold: -1 })
            .limit(10)
            .select('nickname gold');
        
        const goldData = goldRankings.map(user => ({
            text: `**${user.nickname || '알 수 없음'}** - ${formatNumber(user.gold)}G`
        }));
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser) {
            const rank = await User.countDocuments({
                registered: true,
                gold: { $gt: currentUser.gold }
            }) + 1;
            userRank = `**${rank}위** - ${formatNumber(currentUser.gold)}G`;
        }
        
        const embed = createRankingEmbed(
            '💰 골드 랭킹',
            '서버 내 최고 부자들입니다!',
            goldData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('골드 랭킹 오류:', error);
    }
}

// 카테고리별 랭킹 핸들러
async function handleRankingCategory(interaction, category) {
    switch (category) {
        case 'level':
            return await showLevelRanking(interaction);
        case 'combatPower':
            return await showCombatPowerRanking(interaction);
        case 'gold':
            return await showGoldRanking(interaction);
        case 'popularity':
            return await showPopularityRanking(interaction);
        case 'enhance':
            return await showEnhanceRanking(interaction);
        case 'pvp':
            return await showPVPRanking(interaction);
        case 'artifact':
            return await showArtifactRanking(interaction);
        case 'fishing':
            return await showFishingRanking(interaction);
        case 'dungeon':
            return await showDungeonRanking(interaction);
        case 'boss':
            return await showBossRanking(interaction);
        case 'attendance':
            return await showAttendanceRanking(interaction);
        case 'exercise':
            return await showExerciseRanking(interaction);
        default:
            return await showRankingMainMenu(interaction);
    }
}

// 인기도 랭킹
async function showPopularityRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        const popularityRankings = await User.find({ registered: true })
            .sort({ popularity: -1 })
            .limit(10)
            .select('nickname popularity');
        
        const popularityData = popularityRankings.map(user => ({
            text: `**${user.nickname || '알 수 없음'}** - ❤️ ${formatNumber(user.popularity)}`
        }));
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser) {
            const rank = await User.countDocuments({
                registered: true,
                popularity: { $gt: currentUser.popularity }
            }) + 1;
            userRank = `**${rank}위** - ❤️ ${formatNumber(currentUser.popularity)}`;
        }
        
        const embed = createRankingEmbed(
            '❤️ 인기도 랭킹',
            '서버에서 가장 인기 있는 유저들입니다!',
            popularityData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('인기도 랭킹 오류:', error);
    }
}

// 강화 랭킹
async function showEnhanceRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        // 최고 강화 아이템을 가진 유저들
        const users = await User.find({ 
            registered: true,
            inventory: { $exists: true, $ne: [] }
        }).select('nickname discordId inventory equipment accessories');
        
        console.log(`[강화 랭킹] 검색된 유저 수: ${users.length}`);
        
        const enhanceData = [];
        for (const user of users) {
            let maxEnhance = 0;
            let maxItem = null;
            
            // 인벤토리에서 최고 강화 아이템 찾기 (태그가 있는 아이템 제외)
            for (const item of user.inventory || []) {
                if (item && !item.isEvent && !item.itemTag && item.enhanceLevel > maxEnhance) {
                    maxEnhance = item.enhanceLevel;
                    maxItem = item;
                }
            }
            
            // 장비에서도 확인
            if (user.equipment) {
                const slots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'shield'];
                for (const slot of slots) {
                    const equipped = user.equipment[slot];
                    if (equipped !== undefined && equipped !== null && equipped >= 0) {
                        const item = user.inventory?.[equipped];
                        if (item && !item.isEvent && !item.itemTag && item.enhanceLevel > maxEnhance) {
                            maxEnhance = item.enhanceLevel;
                            maxItem = item;
                        }
                    }
                }
            }
            
            // 악세사리에서도 확인
            if (user.accessories) {
                const accessorySlots = ['ring1', 'ring2', 'necklace', 'bracelet1', 'bracelet2', 'earring1', 'earring2'];
                for (const slot of accessorySlots) {
                    const equipped = user.accessories[slot];
                    if (equipped !== undefined && equipped !== null && equipped >= 0) {
                        const item = user.inventory?.[equipped];
                        if (item && !item.isEvent && !item.itemTag && item.enhanceLevel > maxEnhance) {
                            maxEnhance = item.enhanceLevel;
                            maxItem = item;
                        }
                    }
                }
            }
            
            if (maxItem && maxEnhance > 0) {
                enhanceData.push({
                    user,
                    item: maxItem,
                    enhancement: maxEnhance
                });
            }
        }
        
        console.log(`[강화 랭킹] 강화된 아이템을 가진 유저 수: ${enhanceData.length}`);
        
        // 강화 수치로 정렬
        enhanceData.sort((a, b) => b.enhancement - a.enhancement);
        const top10 = enhanceData.slice(0, 10);
        
        const { ENHANCE_SYSTEM } = require('../enhance/enhanceSystem');
        const rankingData = top10.map(data => {
            const rankName = ENHANCE_SYSTEM.rankNames[data.enhancement] || '알 수 없는 랭크';
            return {
                text: `**${data.user.nickname || '알 수 없음'}** - ${data.item.name} [${rankName}]`
            };
        });
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser) {
            const userIndex = enhanceData.findIndex(d => d.user.discordId === currentUser.discordId);
            if (userIndex !== -1) {
                const userData = enhanceData[userIndex];
                const { ENHANCE_SYSTEM } = require('../enhance/enhanceSystem');
                const rankName = ENHANCE_SYSTEM.rankNames[userData.enhancement] || '알 수 없는 랭크';
                userRank = `**${userIndex + 1}위** - ${userData.item.name} [${rankName}]`;
            }
        }
        
        const embed = createRankingEmbed(
            '🔨 강화 랭킹',
            '최고 강화 아이템을 보유한 유저들입니다!',
            rankingData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('강화 랭킹 오류:', error);
    }
}

// PVP 랭킹
async function showPVPRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        const pvpRankings = await User.find({ 
            registered: true,
            $or: [
                { pvpRating: { $exists: true, $gt: 1000 } },
                { pvpWins: { $gt: 0 } }
            ]
        })
        .sort({ pvpRating: -1 })
        .limit(10)
        .select('nickname pvpRating pvpWins pvpLosses pvpTier pvp');
        
        const pvpData = pvpRankings.map(user => {
            // 최상위 필드 우선, 없으면 pvp 객체에서 가져오기
            const rating = user.pvpRating || user.pvp?.rating || 1000;
            const wins = user.pvpWins || user.pvp?.wins || 0;
            const losses = user.pvpLosses || user.pvp?.losses || 0;
            const tier = user.pvpTier || user.pvp?.tier || 'Bronze';
            const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';
            
            return {
                text: `**${user.nickname || '알 수 없음'}** - ${getTierEmoji(tier)} ${rating} | ${wins}승 ${losses}패 (승률 ${winRate}%)`
            };
        });
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser) {
            const userRating = currentUser.pvpRating || currentUser.pvp?.rating || 1000;
            const userWins = currentUser.pvpWins || currentUser.pvp?.wins || 0;
            const userLosses = currentUser.pvpLosses || currentUser.pvp?.losses || 0;
            const userTier = currentUser.pvpTier || currentUser.pvp?.tier || 'Bronze';
            const userWinRate = (userWins + userLosses) > 0 ? ((userWins / (userWins + userLosses)) * 100).toFixed(1) : '0.0';
            
            const rank = await User.countDocuments({
                registered: true,
                pvpRating: { $gt: userRating }
            }) + 1;
            userRank = `**${rank}위** - ${getTierEmoji(userTier)} ${userRating} | ${userWins}승 ${userLosses}패 (승률 ${userWinRate}%)`;
        }
        
        const embed = createRankingEmbed(
            '🥊 PVP 랭킹',
            '최강의 PVP 전사들입니다!',
            pvpData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('PVP 랭킹 오류:', error);
    }
}

// 유물 랭킹
async function showArtifactRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        const artifactRankings = await User.find({ 
            registered: true,
            'rankingStats.artifact.totalEarnings': { $gt: 0 }
        })
        .sort({ 'rankingStats.artifact.totalEarnings': -1 })
        .limit(10)
        .select('nickname rankingStats.artifact');
        
        const valueData = artifactRankings.map(user => ({
            text: `**${user.nickname || '알 수 없음'}** - 💰 ${formatNumber(user.rankingStats?.artifact?.totalEarnings || 0)}G | 발굴: ${user.rankingStats?.artifact?.totalFound || 0}개`
        }));
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser && currentUser.rankingStats?.artifact?.totalEarnings > 0) {
            const rank = await User.countDocuments({
                registered: true,
                'rankingStats.artifact.totalEarnings': { $gt: currentUser.rankingStats.artifact.totalEarnings }
            }) + 1;
            userRank = `**${rank}위** - 💰 ${formatNumber(currentUser.rankingStats.artifact.totalEarnings)}G | 발굴: ${currentUser.rankingStats.artifact.totalFound}개`;
        }
        
        const embed = createRankingEmbed(
            '🏺 유물 탐사 랭킹',
            '최고의 유물 탐사가들입니다!',
            valueData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('유물 랭킹 오류:', error);
    }
}

// 낚시 랭킹
async function showFishingRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        const fishingRankings = await User.find({ 
            registered: true,
            'rankingStats.fishing.totalCaught': { $gt: 0 }
        })
        .sort({ 'rankingStats.fishing.totalCaught': -1 })
        .limit(10)
        .select('nickname rankingStats.fishing');
        
        const fishingData = fishingRankings.map(user => {
            const bestFish = user.rankingStats?.fishing?.bestCatch?.name ? 
                `${user.rankingStats.fishing.bestCatch.name} (${user.rankingStats.fishing.bestCatch.size}cm)` : '없음';
            return {
                text: `**${user.nickname || '알 수 없음'}** - 🎣 ${user.rankingStats?.fishing?.totalCaught || 0}마리 | 최고: ${bestFish}`
            };
        });
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser && currentUser.rankingStats?.fishing?.totalCaught > 0) {
            const rank = await User.countDocuments({
                registered: true,
                'rankingStats.fishing.totalCaught': { $gt: currentUser.rankingStats.fishing.totalCaught }
            }) + 1;
            const bestFish = currentUser.rankingStats.fishing.bestCatch?.name ? 
                `${currentUser.rankingStats.fishing.bestCatch.name} (${currentUser.rankingStats.fishing.bestCatch.size}cm)` : '없음';
            userRank = `**${rank}위** - 🎣 ${currentUser.rankingStats.fishing.totalCaught}마리 | 최고: ${bestFish}`;
        }
        
        const embed = createRankingEmbed(
            '🎣 낚시 랭킹',
            '최고의 낚시꾼들입니다!',
            fishingData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('낚시 랭킹 오류:', error);
    }
}

// 던전 랭킹
async function showDungeonRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        const dungeonRankings = await User.find({ 
            registered: true,
            'rankingStats.dungeon.maxFloor': { $gt: 0 }
        })
        .sort({ 'rankingStats.dungeon.maxFloor': -1 })
        .limit(10)
        .select('nickname rankingStats.dungeon');
        
        const dungeonData = dungeonRankings.map(user => ({
            text: `**${user.nickname || '알 수 없음'}** - 🏰 ${user.rankingStats?.dungeon?.maxFloor || 0}층 | 클리어: ${user.rankingStats?.dungeon?.totalClears || 0}회`
        }));
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser && currentUser.rankingStats?.dungeon?.maxFloor > 0) {
            const rank = await User.countDocuments({
                registered: true,
                'rankingStats.dungeon.maxFloor': { $gt: currentUser.rankingStats.dungeon.maxFloor }
            }) + 1;
            userRank = `**${rank}위** - 🏰 ${currentUser.rankingStats.dungeon.maxFloor}층 | 클리어: ${currentUser.rankingStats.dungeon.totalClears || 0}회`;
        }
        
        const embed = createRankingEmbed(
            '🏰 던전 탐험 랭킹',
            '던전 최고층에 도달한 모험가들입니다!',
            dungeonData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('던전 랭킹 오류:', error);
    }
}

// 보스 토벌 랭킹
async function showBossRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        const bossRankings = await User.find({ 
            registered: true,
            'rankingStats.boss.totalDamage': { $gt: 0 }
        })
        .sort({ 'rankingStats.boss.totalDamage': -1 })
        .limit(10)
        .select('nickname rankingStats.boss');
        
        const bossData = bossRankings.map(user => ({
            text: `**${user.nickname || '알 수 없음'}** - 👹 ${user.rankingStats?.boss?.totalKills || 0}토벌 | 총 데미지: ${formatNumber(user.rankingStats?.boss?.totalDamage || 0)}`
        }));
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser && currentUser.rankingStats?.boss?.totalDamage > 0) {
            const rank = await User.countDocuments({
                registered: true,
                'rankingStats.boss.totalDamage': { $gt: currentUser.rankingStats.boss.totalDamage }
            }) + 1;
            userRank = `**${rank}위** - 👹 ${currentUser.rankingStats.boss.totalKills || 0}토벌 | 총 데미지: ${formatNumber(currentUser.rankingStats.boss.totalDamage)}`;
        }
        
        const embed = createRankingEmbed(
            '👹 보스 토벌 랭킹',
            '최강의 보스 헌터들입니다!',
            bossData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('보스 랭킹 오류:', error);
    }
}

// 출석 랭킹
async function showAttendanceRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        const attendanceRankings = await User.find({ 
            registered: true,
            attendanceStreak: { $gt: 0 }
        })
        .sort({ attendanceStreak: -1, totalAttendance: -1 })
        .limit(10)
        .select('nickname attendanceStreak totalAttendance');
        
        const attendanceData = attendanceRankings.map(user => ({
            text: `**${user.nickname || '알 수 없음'}** - 🔥 ${user.attendanceStreak}일 연속 | 총 ${user.totalAttendance || 0}일`
        }));
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser && currentUser.attendanceStreak > 0) {
            const rank = await User.countDocuments({
                registered: true,
                $or: [
                    { attendanceStreak: { $gt: currentUser.attendanceStreak } },
                    { 
                        attendanceStreak: currentUser.attendanceStreak,
                        totalAttendance: { $gt: currentUser.totalAttendance || 0 }
                    }
                ]
            }) + 1;
            userRank = `**${rank}위** - 🔥 ${currentUser.attendanceStreak}일 연속 | 총 ${currentUser.totalAttendance || 0}일`;
        }
        
        const embed = createRankingEmbed(
            '📅 출석 랭킹',
            '성실한 김헌터 유저들입니다!',
            attendanceData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('출석 랭킹 오류:', error);
    }
}

// 운동 랭킹
async function showExerciseRanking(interaction) {
    try {
        await interaction.deferUpdate().catch(() => {});
        
        const exerciseRankings = await User.find({ 
            registered: true,
            'fitness.level': { $gt: 0 }
        })
        .sort({ 'fitness.level': -1, 'fitness.totalExercise': -1 })
        .limit(10)
        .select('nickname fitness');
        
        const exerciseData = exerciseRankings.map(user => ({
            text: `**${user.nickname || '알 수 없음'}** - 💪 Lv.${user.fitness?.level || 0} | 총 ${formatNumber(user.fitness?.totalExercise || 0)}회`
        }));
        
        // 현재 유저 순위
        const currentUser = await User.findOne({ discordId: interaction.user.id });
        let userRank = null;
        if (currentUser && currentUser.fitness?.level > 0) {
            const rank = await User.countDocuments({
                registered: true,
                $or: [
                    { 'fitness.level': { $gt: currentUser.fitness.level } },
                    { 
                        'fitness.level': currentUser.fitness.level,
                        'fitness.totalExercise': { $gt: currentUser.fitness.totalExercise || 0 }
                    }
                ]
            }) + 1;
            userRank = `**${rank}위** - 💪 Lv.${currentUser.fitness.level} | 총 ${formatNumber(currentUser.fitness.totalExercise || 0)}회`;
        }
        
        const embed = createRankingEmbed(
            '💪 운동 랭킹',
            '가장 열심히 운동하는 유저들입니다!',
            exerciseData,
            userRank
        );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_menu')
                    .setLabel('📋 랭킹 목록')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } catch (error) {
        console.error('운동 랭킹 오류:', error);
    }
}

// 메인 랭킹 핸들러
async function handleRankingInteraction(interaction) {
    const customId = interaction.customId;
    
    if (customId === 'ranking' || customId === 'ranking_menu') {
        return await showRankingMainMenu(interaction);
    }
    
    if (customId === 'ranking_category_select' && interaction.isStringSelectMenu()) {
        const category = interaction.values[0];
        return await handleRankingCategory(interaction, category);
    }
}

module.exports = {
    handleRankingInteraction,
    showRankingMainMenu,
    createRankingEmbed
};