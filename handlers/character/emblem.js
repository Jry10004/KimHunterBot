const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getUser } = require('../common/utils');
const { handleEmblemShopInteraction, EMBLEMS } = require('../../systems/emblemShop');
const User = require('../../models/User');

// 엠블럼 메인 화면
async function showEmblem(interaction) {
    await interaction.deferUpdate().catch(() => {});
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
            embeds: [],
            components: []
        });
    }

    // 엠블럼이 없는 경우 엠블럼 상점으로 이동
    if (!user.emblem) {
        return await handleEmblemShopInteraction(interaction);
    }

    // 엠블럼 강화 정보 가져오기
    const { EMBLEM_ENHANCE_STATS } = require('../../systems/emblemEnhancement');
    const emblemType = Object.keys(EMBLEMS).find(type => 
        EMBLEMS[type].emblems.some(e => e.name === user.emblem)
    );
    const emblemData = emblemType ? EMBLEM_ENHANCE_STATS[emblemType] : null;
    const enhanceLevel = user.emblemEnhancement?.level || 0;
    
    // 현재 엠블럼 정보 표시
    const emblemEmbed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle(`🏆 ${user.nickname || interaction.user.username}님의 엠블럼`)
        .setDescription(`\n**현재 엠블럼**: ${user.emblem}\n**강화 레벨**: +${enhanceLevel}\n**레벨**: ${user.level}`);
    
    // 엠블럼 강화 스탯 표시
    if (emblemData && enhanceLevel > 0) {
        const statText = [];
        for (const [stat, multiplier] of Object.entries(emblemData.stats)) {
            const statValue = Math.floor(multiplier * enhanceLevel);
            if (statValue > 0) {
                const statNames = {
                    strength: '💪 힘',
                    agility: '🏃 민첩',
                    intelligence: '🧠 지능',
                    vitality: '❤️ 체력',
                    luck: '🍀 행운'
                };
                statText.push(`${statNames[stat]}: +${statValue}`);
            }
        }
        
        emblemEmbed.addFields(
            { name: '✨ 강화 능력치', value: statText.join('\n') || '없음', inline: true },
            { name: '📋 엠블럼 효과', value: '엠블럼을 보유하면 특별한 칭호 역할을 받습니다.', inline: true }
        );
    } else {
        emblemEmbed.addFields(
            { name: '📋 엠블럼 효과', value: '엠블럼을 보유하면 특별한 칭호 역할을 받습니다.', inline: false },
            { name: '🔄 진화 가능 여부', value: '레벨과 골드 요구사항을 확인하려면 엠블럼 상점을 방문하세요.', inline: false }
        );
    }
    
    emblemEmbed.setFooter({ text: '엠블럼은 한 번 선택하면 계열을 변경할 수 없습니다!' });

    // 버튼 생성
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('emblem_shop')
                .setLabel('🛒 엠블럼 상점')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('emblem_enhance')
                .setLabel('🔨 엠블럼 강화')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [emblemEmbed],
        components: [buttons]
    });
}

// 엠블럼 상점 버튼 처리
async function showEmblemShop(interaction) {
    await interaction.deferUpdate().catch(() => {});
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!',
            embeds: [],
            components: []
        });
    }
    
    // 항상 카테고리 선택 화면 표시
    const shopEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 엠블럼 상점')
        .setDescription('엠블럼을 구매하여 특별한 칭호를 획듍하세요!');
        
    if (user.emblem) {
        const currentType = Object.keys(EMBLEMS).find(type => 
            EMBLEMS[type].emblems.some(e => e.name === user.emblem)
        );
        shopEmbed.addFields({
            name: 'ℹ️ 현재 엠블럼',
            value: `${user.emblem} (${EMBLEMS[currentType]?.name || '알 수 없음'} 계열)`,
            inline: false
        });
    }
        
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('emblem_shop_category')
        .setPlaceholder('엠블럼 카테고리를 선택하세요')
        .addOptions([
            { label: '전사 계열', value: 'warrior', emoji: '⚔️', description: '힘 주스탯' },
            { label: '궁수 계열', value: 'archer', emoji: '🏹', description: '민첩 주스탯' },
            { label: '마법사 계열', value: 'mage', emoji: '🧿', description: '지능 주스탯' },
            { label: '수호자 계열', value: 'defender', emoji: '🛡️', description: '체력 주스탯' },
            { label: '도적 계열', value: 'thief', emoji: '🗡️', description: '행운 주스탯' }
        ]);
        
    const actionRow = new ActionRowBuilder().addComponents(selectMenu);
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('emblem')
                .setLabel('◀️ 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
        
    return await interaction.editReply({
        embeds: [shopEmbed],
        components: [actionRow, backButton]
    });
}

// 엠블럼 강화 화면
async function showEmblemEnhance(interaction) {
    await interaction.deferUpdate().catch(() => {});
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!',
            embeds: [],
            components: []
        });
    }
    
    if (!user.emblem) {
        return await interaction.editReply({
            content: '❌ 먼저 엠블럼을 구매해주세요!',
            embeds: [],
            components: []
        });
    }
    
    // 엠블럼 타입 찾기
    const emblemType = Object.keys(EMBLEMS).find(type => 
        EMBLEMS[type].emblems.some(e => e.name === user.emblem)
    );
    
    const { createEmblemEnhanceEmbed, createEmblemEnhanceButtons } = require('../../systems/emblemEnhancement');
    
    const embed = createEmblemEnhanceEmbed(user, emblemType);
    const hasStones = user.items?.emblemEnhanceStone > 0;
    const buttons = createEmblemEnhanceButtons(hasStones);
    
    // 뒤로가기 버튼 추가
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('emblem')
                .setLabel('◀️ 엠블럼으로 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons, backButton]
    });
}

// 엠블럼 강화 시도
async function enhanceEmblem(interaction) {
    await interaction.deferUpdate().catch(() => {});
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered || !user.emblem) {
        return await interaction.followUp({ 
            content: '❌ 오류가 발생했습니다.',
            flags: 64
        });
    }
    
    // 엠블럼 타입 찾기
    const emblemType = Object.keys(EMBLEMS).find(type => 
        EMBLEMS[type].emblems.some(e => e.name === user.emblem)
    );
    
    const { processEmblemEnhancement } = require('../../systems/emblemEnhancement');
    const result = await processEmblemEnhancement(user, emblemType);
    
    if (!result.success) {
        return await interaction.followUp({
            content: `❌ ${result.message}`,
            flags: 64
        });
    }
    
    // 강화 결과 메시지
    const resultEmbed = new EmbedBuilder()
        .setColor(result.result === 'success' ? '#00ff00' : 
                  result.result === 'reset' ? '#ff0000' : '#ffaa00')
        .setTitle('🔨 엠블럼 강화 결과')
        .setDescription(result.message)
        .addFields(
            { name: '🎲 결과', value: result.result === 'success' ? '성공' : '실패', inline: true },
            { name: '💠 남은 강화석', value: `${user.items?.emblemEnhanceStone || 0}개`, inline: true }
        );
    
    await interaction.followUp({
        embeds: [resultEmbed],
        flags: 64
    });
    
    // 엠블럼 스탯 재적용
    await applyEmblemStats(user, emblemType);
    await user.save();
    
    // 강화 화면 업데이트
    return await showEmblemEnhance(interaction);
}

// 엠블럼 구매 처리
async function handleEmblemPurchase(interaction) {
    await interaction.deferUpdate().catch(() => {});
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.followUp({ 
            content: '먼저 회원가입을 해주세요!',
            flags: 64
        });
    }

    // customId 파싱: buy_emblem_warrior_0
    const parts = interaction.customId.split('_');
    const categoryKey = parts[2];
    const emblemIndex = parseInt(parts[3]);
    
    const category = EMBLEMS[categoryKey];
    if (!category) {
        return await interaction.followUp({
            content: '❌ 잘못된 엠블럼 카테고리입니다.',
            flags: 64
        });
    }
    
    const emblem = category.emblems[emblemIndex];
    if (!emblem) {
        return await interaction.followUp({
            content: '❌ 잘못된 엠블럼입니다.',
            flags: 64
        });
    }
    
    // 구매 가능 여부 확인
    if (user.level < emblem.level) {
        return await interaction.followUp({
            content: `❌ 레벨이 부족합니다! (필요 레벨: ${emblem.level}, 현재 레벨: ${user.level})`,
            flags: 64
        });
    }
    
    if (user.gold < emblem.price) {
        return await interaction.followUp({
            content: `❌ 골드가 부족합니다! (필요 골드: ${emblem.price.toLocaleString()}, 보유 골드: ${user.gold.toLocaleString()})`,
            flags: 64
        });
    }
    
    // 기존 엠블럼 확인
    let oldEmblemName = null;
    if (user.emblem) {
        const currentType = Object.keys(EMBLEMS).find(type => 
            EMBLEMS[type].emblems.some(e => e.name === user.emblem)
        );
        
        if (currentType !== categoryKey) {
            return await interaction.followUp({
                content: `❌ 다른 계열의 엠블럼을 이미 보유중입니다!\n현재: ${EMBLEMS[currentType].name} 계열`,
                flags: 64
            });
        }
        
        // 순차 진화 확인
        const currentIndex = category.emblems.findIndex(e => e.name === user.emblem);
        if (emblemIndex !== currentIndex + 1) {
            return await interaction.followUp({
                content: '❌ 엠뺔럼은 순서대로 진화해야 합니다!',
                flags: 64
            });
        }
        
        // 기존 엠뺔럼 이름 저장 (역할 제거용)
        oldEmblemName = user.emblem;
    } else if (emblemIndex !== 0) {
        return await interaction.followUp({
            content: '❌ 첫 엠블럼부터 구매해야 합니다!',
            flags: 64
        });
    }
    
    // 골드 차감 및 엠블럼 적용
    user.gold -= emblem.price;
    user.emblem = emblem.name;
    
    // 엠블럼 강화 데이터 초기화 (첫 구매시만, 업그레이드시는 유지)
    if (!user.emblemEnhancement) {
        user.emblemEnhancement = {
            level: 0,
            stats: {},
            totalAttempts: 0,
            totalStonesUsed: 0,
            maxLevel: 0
        };
    }
    // 강화 수치는 전승됨
    
    // 유저 스탯에 엠블럼 강화 스탯 적용
    await applyEmblemStats(user, categoryKey);
    
    await user.save();
    
    // 역할 처리
    if (interaction.guild) {
        // 기존 엠블럼 역할 제거
        if (oldEmblemName) {
            const oldRole = interaction.guild.roles.cache.find(r => r.name === oldEmblemName);
            if (oldRole) {
                try {
                    await interaction.member.roles.remove(oldRole);
                    console.log(`[엠블럼] ${interaction.user.tag}의 기존 역할 제거: ${oldEmblemName}`);
                } catch (error) {
                    console.error('기존 역할 제거 실패:', error);
                }
            } else {
                console.log(`[엠블럼] 기존 역할을 찾을 수 없음: ${oldEmblemName}`);
            }
        }
        
        // 새 엠블럼 역할 부여
        if (emblem.roleName) {
            let newRole = interaction.guild.roles.cache.find(r => r.name === emblem.roleName);
            
            // 역할이 없으면 생성
            if (!newRole) {
                try {
                    newRole = await interaction.guild.roles.create({
                        name: emblem.roleName,
                        color: category.color || '#99AAB5',
                        reason: '엠블럼 시스템 자동 생성'
                    });
                    console.log(`[엠블럼] 새 역할 생성: ${emblem.roleName}`);
                } catch (error) {
                    console.error('역할 생성 실패:', error);
                }
            }
            
            if (newRole) {
                try {
                    await interaction.member.roles.add(newRole);
                    console.log(`[엠블럼] ${interaction.user.tag}에게 역할 부여: ${emblem.roleName}`);
                } catch (error) {
                    console.error('새 역할 부여 실패:', error);
                }
            }
        }
    }
    
    // 엠블럼 구매 기록 저장
    await saveEmblemData(user.discordId, {
        emblemName: emblem.name,
        category: categoryKey,
        purchaseDate: new Date(),
        price: emblem.price,
        level: emblem.level,
        enhanceLevel: user.emblemEnhancement?.level || 0
    });
    
    const resultEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ 엠블럼 획득!')
        .setDescription(`**${emblem.name}**을(를) 획득했습니다!${oldEmblemName ? `\n(기존: ${oldEmblemName})` : ''}`)
        .addFields(
            { name: '💰 사용 골드', value: `${emblem.price.toLocaleString()}G`, inline: true },
            { name: '💳 남은 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
        )
        .setFooter({ text: user.emblemEnhancement?.level > 0 ? `강화 수치 +${user.emblemEnhancement.level}이 전승되었습니다!` : '엠블럼 강화를 통해 추가 능력치를 얻을 수 있습니다!' });
    
    await interaction.followUp({
        embeds: [resultEmbed],
        flags: 64
    });
    
    // 메인 화면으로 돌아가기
    return await showEmblem(interaction);
}

// 엠블럼 스탯을 유저 스탯에 적용
async function applyEmblemStats(user, emblemType) {
    const { EMBLEM_ENHANCE_STATS } = require('../../systems/emblemEnhancement');
    const emblemData = EMBLEM_ENHANCE_STATS[emblemType];
    
    if (!emblemData) return;
    
    // 스탯 초기화
    if (!user.stats) {
        user.stats = {
            strength: 10,
            agility: 10,
            intelligence: 10,
            vitality: 10,
            luck: 10
        };
    }
    
    // 엠블럼 강화 레벨에 따른 스탯 계산
    const enhanceLevel = user.emblemEnhancement?.level || 0;
    
    // 기존 엠블럼 스탯 제거 (있다면)
    if (user.emblemEnhancement?.appliedStats) {
        for (const [stat, value] of Object.entries(user.emblemEnhancement.appliedStats)) {
            user.stats[stat] -= value;
        }
    }
    
    // 새로운 스탯 적용
    const appliedStats = {};
    for (const [stat, multiplier] of Object.entries(emblemData.stats)) {
        const statValue = Math.floor(multiplier * enhanceLevel);
        user.stats[stat] += statValue;
        appliedStats[stat] = statValue;
    }
    
    // 적용된 스탯 저장
    if (!user.emblemEnhancement) {
        user.emblemEnhancement = {};
    }
    user.emblemEnhancement.appliedStats = appliedStats;
}

// 엠블럼 데이터 저장
async function saveEmblemData(userId, data) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const dataDir = path.join(__dirname, '../../data/emblems');
    const filePath = path.join(dataDir, `${userId}.json`);
    
    try {
        // 디렉토리 생성
        await fs.mkdir(dataDir, { recursive: true });
        
        // 기존 데이터 읽기
        let emblemHistory = [];
        try {
            const existingData = await fs.readFile(filePath, 'utf8');
            emblemHistory = JSON.parse(existingData);
        } catch (error) {
            // 파일이 없으면 새로 생성
        }
        
        // 새 데이터 추가
        emblemHistory.push(data);
        
        // 파일 저장
        await fs.writeFile(filePath, JSON.stringify(emblemHistory, null, 2));
        console.log(`[엠블럼] 데이터 저장 완료: ${userId}`);
    } catch (error) {
        console.error('엠블럼 데이터 저장 실패:', error);
    }
}

module.exports = {
    showEmblem,
    showEmblemShop,
    showEmblemEnhance,
    enhanceEmblem,
    handleEmblemPurchase,
    applyEmblemStats
};