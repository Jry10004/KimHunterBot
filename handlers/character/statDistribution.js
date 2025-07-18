const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUser, formatNumber } = require('../common/utils');
const User = require('../../models/User');

// 스탯 분배 메인 화면
async function showStatDistribution(interaction) {
    // Safe defer handling
    try {
        if (!interaction.deferred && !interaction.replied) {
            if (interaction.isButton() || interaction.isStringSelectMenu()) {
                await interaction.deferUpdate();
            } else {
                await interaction.deferReply({ flags: 64 });
            }
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('[StatDistribution] Interaction expired');
            return;
        }
        console.error('[StatDistribution] Defer error:', error);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
            embeds: [],
            components: []
        });
    }

    // statPoints가 숫자가 아닌 경우 0으로 초기화
    if (typeof user.statPoints !== 'number' || isNaN(user.statPoints)) {
        user.statPoints = 0;
        await user.save();
    }
    
    // 현재 스탯 정보 가져오기
    const currentStats = user.stats || {
        strength: 10,
        agility: 10,
        intelligence: 10,
        vitality: 10,
        luck: 10
    };
    
    // 분배된 스탯 포인트 계산
    const distributedPoints = 
        (currentStats.strength - 10) +
        (currentStats.agility - 10) +
        (currentStats.intelligence - 10) +
        (currentStats.vitality - 10) +
        (currentStats.luck - 10);
    
    // 사용자의 직업(엠블럼) 확인하여 주스텟 결정
    const { EMBLEMS } = require('../../systems/emblemShop');
    const userEmblem = user.emblem?.replace(/\s*\+\d+$/, ''); // 강화 레벨 제거
    let userMainStat = null;
    let emblemType = null;
    
    // 엠블럼 타입 찾기
    if (userEmblem) {
        // 직접 직업 키워드로 확인
        if (userEmblem.includes('전사') || userEmblem.includes('기사') || userEmblem.includes('검사')) {
            emblemType = 'warrior';
        } else if (userEmblem.includes('궁수') || userEmblem.includes('사냥꾼') || userEmblem.includes('사수') || userEmblem.includes('사격수') || userEmblem.includes('명궁')) {
            emblemType = 'archer';
        } else if (userEmblem.includes('마법사') || userEmblem.includes('술사') || userEmblem.includes('현자') || userEmblem.includes('아크메이지')) {
            emblemType = 'wizard';
        } else if (userEmblem.includes('도적') || userEmblem.includes('도둑') || userEmblem.includes('닌자') || userEmblem.includes('행운아')) {
            emblemType = 'rogue';
        } else if (userEmblem.includes('수호자') || userEmblem.includes('방패병') || userEmblem.includes('파수꾼') || userEmblem.includes('철벽')) {
            emblemType = 'defender';
        } else {
            // EMBLEMS에서 찾기
            for (const [type, data] of Object.entries(EMBLEMS)) {
                if (data.emblems.some(e => e.name === userEmblem)) {
                    emblemType = type;
                    break;
                }
            }
        }
    }
    
    // 직업별 주스텟 매핑
    const mainStatByType = {
        'warrior': 'strength',    // 전사 - 힘
        'archer': 'agility',      // 궁수 - 민첩  
        'wizard': 'intelligence', // 마법사 - 지능
        'mage': 'intelligence',   // 마법사 - 지능
        'rogue': 'luck',         // 도적 - 행운
        'defender': 'vitality'    // 수호자 - 체력
    };
    
    userMainStat = mainStatByType[emblemType] || null;
    
    // 스탯 포인트가 없고 분배된 포인트도 없으면 메뉴 표시 안 함
    if ((!user.statPoints || user.statPoints === 0) && distributedPoints === 0) {
        return await interaction.editReply({
            content: '📊 사용 가능한 스탯 포인트가 없습니다!\n레벨업 시 스탯 포인트를 획득할 수 있습니다.',
            embeds: [],
            components: []
        });
    }

    const statEmbed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`📊 ${user.nickname || interaction.user.username}님의 스탯 분배`)
        .setDescription(user.statPoints > 0 
            ? `사용 가능한 스탯 포인트: **${user.statPoints}점**\n\n각 스탯을 클릭하여 포인트를 분배하세요!`
            : `사용 가능한 스탯 포인트: **0점**\n\n스탯 초기화를 통해 분배된 포인트를 회수할 수 있습니다.`)
        .addFields(
            { 
                name: `💪 힘 (STR)${userMainStat === 'strength' ? ' ⭐' : ''}`, 
                value: `현재: **${currentStats.strength}**\n⚔️ 전사 주스탯\n물리 공격력 증가`, 
                inline: true 
            },
            { 
                name: `🏃 민첩 (AGI)${userMainStat === 'agility' ? ' ⭐' : ''}`, 
                value: `현재: **${currentStats.agility}**\n🏹 궁수 주스탯\n치명타 및 회피율 증가`, 
                inline: true 
            },
            { 
                name: `🧠 지능 (INT)${userMainStat === 'intelligence' ? ' ⭐' : ''}`, 
                value: `현재: **${currentStats.intelligence}**\n🧙 마법사 주스탯\n마법 공격력 증가`, 
                inline: true 
            },
            { 
                name: `❤️ 체력 (VIT)${userMainStat === 'vitality' ? ' ⭐' : ''}`, 
                value: `현재: **${currentStats.vitality}**\n🛡️ 수호자 주스탯\n최대 HP 및 방어력 증가`, 
                inline: true 
            },
            { 
                name: `🍀 행운 (LUK)${userMainStat === 'luck' ? ' ⭐' : ''}`, 
                value: `현재: **${currentStats.luck}**\n🗡️ 도적 주스탯\n크리티컬 및 강화 성공률 증가`, 
                inline: true 
            }
        )
        .setFooter({ text: '팁: 직업별 주스탯과 부스탯을 적절히 분배하면 더 강해집니다!' });

    // 스탯 버튼들
    const hasStatPoints = user.statPoints > 0;
    const statButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stat_add_strength')
                .setLabel('💪 힘 +1')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!hasStatPoints),
            new ButtonBuilder()
                .setCustomId('stat_add_agility')
                .setLabel('🏃 민첩 +1')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!hasStatPoints),
            new ButtonBuilder()
                .setCustomId('stat_add_intelligence')
                .setLabel('🧠 지능 +1')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!hasStatPoints),
            new ButtonBuilder()
                .setCustomId('stat_add_vitality')
                .setLabel('❤️ 체력 +1')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!hasStatPoints),
            new ButtonBuilder()
                .setCustomId('stat_add_luck')
                .setLabel('🍀 행운 +1')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!hasStatPoints)
        );

    // 추가 옵션 버튼들
    const optionButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stat_add_custom')
                .setLabel('🎯 커스텀 분배')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!hasStatPoints),
            new ButtonBuilder()
                .setCustomId('stat_reset')
                .setLabel('🔄 스탯 초기화')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(distributedPoints === 0), // 분배된 포인트가 없으면 비활성화
            new ButtonBuilder()
                .setCustomId('profile')
                .setLabel('👤 프로필로 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [statEmbed],
        components: [statButtons, optionButtons]
    });
}

// 스탯 포인트 추가
async function addStatPoint(interaction, statName) {
    // Safe defer handling
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('[StatDistribution] Interaction expired');
            return;
        }
        console.error('[StatDistribution] Defer error:', error);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!',
            embeds: [],
            components: []
        });
    }

    // statPoints가 숫자가 아닌 경우 0으로 초기화
    if (typeof user.statPoints !== 'number' || isNaN(user.statPoints)) {
        user.statPoints = 0;
    }
    
    if (!user.statPoints || user.statPoints === 0) {
        return await interaction.followUp({
            content: '❌ 사용 가능한 스탯 포인트가 없습니다!',
            flags: 64
        });
    }

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

    // 스탯 이름 매핑
    const statNames = {
        strength: '💪 힘',
        agility: '🏃 민첩',
        intelligence: '🧠 지능',
        vitality: '❤️ 체력',
        luck: '🍀 행운'
    };
    
    // statName 유효성 검사
    if (!statName || !statNames[statName]) {
        return await interaction.followUp({
            content: '❌ 올바르지 않은 스탯입니다!',
            flags: 64
        });
    }

    // 스탯 포인트 분배
    user.stats[statName]++;
    user.statPoints--;
    
    // distributedStats 업데이트
    if (!user.distributedStats) {
        user.distributedStats = { strength: 0, agility: 0, intelligence: 0, vitality: 0, luck: 0 };
    }
    user.distributedStats[statName] = (user.distributedStats[statName] || 0) + 1;

    // 전투력 재계산
    const { calculateCombatPower } = require('../common/combatPower');
    user.combatPower = calculateCombatPower(user);

    await user.save();

    await interaction.followUp({
        content: `✅ ${statNames[statName]}이(가) 1 증가했습니다! (현재: ${user.stats[statName]})`,
        flags: 64
    });

    // 스탯 분배 화면 다시 표시
    return await showStatDistribution(interaction);
}

// 커스텀 스탯 분배 - 버튼 방식으로 변경
async function showCustomStatModal(interaction) {
    console.log('[CustomStatModal] Called - Using button interface instead of modal');
    
    // Safe defer handling
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('[CustomStatModal] Interaction expired');
            return;
        }
        console.error('[CustomStatModal] Defer error:', error);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.followUp({ 
            content: '먼저 회원가입을 해주세요!',
            flags: 64
        });
    }
    
    if (!user.statPoints || user.statPoints <= 0) {
        return await interaction.followUp({ 
            content: '❌ 사용 가능한 스탯 포인트가 없습니다!',
            flags: 64
        });
    }
    
    // 사용자의 직업(엠블럼) 확인하여 주스텟 결정
    const { EMBLEMS } = require('../../systems/emblemShop');
    const userEmblem = user.emblem?.replace(/\s*\+\d+$/, ''); // 강화 레벨 제거
    let userMainStat = null;
    let emblemType = null;
    
    // 엠블럼 타입 찾기
    if (userEmblem) {
        // 직접 직업 키워드로 확인
        if (userEmblem.includes('전사') || userEmblem.includes('기사') || userEmblem.includes('검사')) {
            emblemType = 'warrior';
        } else if (userEmblem.includes('궁수') || userEmblem.includes('사냥꾼') || userEmblem.includes('사수') || userEmblem.includes('사격수') || userEmblem.includes('명궁')) {
            emblemType = 'archer';
        } else if (userEmblem.includes('마법사') || userEmblem.includes('술사') || userEmblem.includes('현자') || userEmblem.includes('아크메이지')) {
            emblemType = 'wizard';
        } else if (userEmblem.includes('도적') || userEmblem.includes('도둑') || userEmblem.includes('닌자') || userEmblem.includes('행운아')) {
            emblemType = 'rogue';
        } else if (userEmblem.includes('수호자') || userEmblem.includes('방패병') || userEmblem.includes('파수꾼') || userEmblem.includes('철벽')) {
            emblemType = 'defender';
        } else {
            // EMBLEMS에서 찾기
            for (const [type, data] of Object.entries(EMBLEMS)) {
                if (data.emblems.some(e => e.name === userEmblem)) {
                    emblemType = type;
                    break;
                }
            }
        }
    }
    
    // 직업별 주스텟 매핑
    const mainStatByType = {
        'warrior': 'strength',    // 전사 - 힘
        'archer': 'agility',      // 궁수 - 민첩  
        'wizard': 'intelligence', // 마법사 - 지능
        'mage': 'intelligence',   // 마법사 - 지능
        'rogue': 'luck',         // 도적 - 행운
        'defender': 'vitality'    // 수호자 - 체력
    };
    
    userMainStat = mainStatByType[emblemType] || null;

    // 커스텀 분배 UI를 버튼으로 구성
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🎯 커스텀 스탯 분배')
        .setDescription(`보유 포인트: **${user.statPoints}점**\n\n각 스탯에 원하는 만큼 포인트를 분배하세요.`)
        .addFields([
            { name: `💪 힘${userMainStat === 'strength' ? ' ⭐' : ''}`, value: `현재: ${user.stats?.strength || 10}`, inline: true },
            { name: `🏃 민첩${userMainStat === 'agility' ? ' ⭐' : ''}`, value: `현재: ${user.stats?.agility || 10}`, inline: true },
            { name: `🧠 지능${userMainStat === 'intelligence' ? ' ⭐' : ''}`, value: `현재: ${user.stats?.intelligence || 10}`, inline: true },
            { name: `❤️ 체력${userMainStat === 'vitality' ? ' ⭐' : ''}`, value: `현재: ${user.stats?.vitality || 10}`, inline: true },
            { name: `🍀 행운${userMainStat === 'luck' ? ' ⭐' : ''}`, value: `현재: ${user.stats?.luck || 10}`, inline: true }
        ])
        .setFooter({ text: '원하는 스탯에 5포인트 또는 10포인트씩 추가할 수 있습니다.' });

    // 5포인트 추가 버튼들
    const fivePointButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stat_custom_strength_5')
                .setLabel('💪 +5')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.statPoints < 5),
            new ButtonBuilder()
                .setCustomId('stat_custom_agility_5')
                .setLabel('🏃 +5')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.statPoints < 5),
            new ButtonBuilder()
                .setCustomId('stat_custom_intelligence_5')
                .setLabel('🧠 +5')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.statPoints < 5),
            new ButtonBuilder()
                .setCustomId('stat_custom_vitality_5')
                .setLabel('❤️ +5')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.statPoints < 5),
            new ButtonBuilder()
                .setCustomId('stat_custom_luck_5')
                .setLabel('🍀 +5')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.statPoints < 5)
        );

    // 10포인트 추가 버튼들
    const tenPointButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stat_custom_strength_10')
                .setLabel('💪 +10')
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.statPoints < 10),
            new ButtonBuilder()
                .setCustomId('stat_custom_agility_10')
                .setLabel('🏃 +10')
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.statPoints < 10),
            new ButtonBuilder()
                .setCustomId('stat_custom_intelligence_10')
                .setLabel('🧠 +10')
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.statPoints < 10),
            new ButtonBuilder()
                .setCustomId('stat_custom_vitality_10')
                .setLabel('❤️ +10')
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.statPoints < 10),
            new ButtonBuilder()
                .setCustomId('stat_custom_luck_10')
                .setLabel('🍀 +10')
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.statPoints < 10)
        );

    // 모든 포인트 분배 버튼
    const allPointButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stat_custom_all_strength')
                .setLabel(`💪 ALL (${user.statPoints})`)
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('stat_custom_all_agility')
                .setLabel(`🏃 ALL (${user.statPoints})`)
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('stat_custom_all_intelligence')
                .setLabel(`🧠 ALL (${user.statPoints})`)
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('stat_custom_all_vitality')
                .setLabel(`❤️ ALL (${user.statPoints})`)
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('stat_custom_all_luck')
                .setLabel(`🍀 ALL (${user.statPoints})`)
                .setStyle(ButtonStyle.Danger)
        );

    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stat_distribution')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [embed],
        components: [fivePointButtons, tenPointButtons, allPointButtons, backButton]
    });
}

// 커스텀 스탯 분배 처리
async function handleCustomStatDistribution(interaction) {
    console.log('[CustomStat] handleCustomStatDistribution 호출됨');
    
    // 먼저 defer 처리
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: 64 });
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('[CustomStat] Interaction expired');
            return;
        }
        console.error('[CustomStat] Defer error:', error);
        return;
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!'
        });
    }

    // 입력값 파싱
    const strength = parseInt(interaction.fields.getTextInputValue('stat_custom_strength')) || 0;
    const agility = parseInt(interaction.fields.getTextInputValue('stat_custom_agility')) || 0;
    const intelligence = parseInt(interaction.fields.getTextInputValue('stat_custom_intelligence')) || 0;
    const vitality = parseInt(interaction.fields.getTextInputValue('stat_custom_vitality')) || 0;
    const luck = parseInt(interaction.fields.getTextInputValue('stat_custom_luck')) || 0;

    const totalPoints = strength + agility + intelligence + vitality + luck;

    // 유효성 검사
    if (totalPoints > user.statPoints) {
        return await interaction.editReply({
            content: `❌ 사용하려는 포인트(${totalPoints})가 보유 포인트(${user.statPoints})보다 많습니다!`
        });
    }

    if (strength < 0 || agility < 0 || intelligence < 0 || vitality < 0 || luck < 0) {
        return await interaction.editReply({
            content: '❌ 음수는 입력할 수 없습니다!'
        });
    }

    if (totalPoints === 0) {
        return await interaction.editReply({
            content: '❌ 최소 1포인트 이상 분배해야 합니다!'
        });
    }

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

    // 스탯 적용
    user.stats.strength += strength;
    user.stats.agility += agility;
    user.stats.intelligence += intelligence;
    user.stats.vitality += vitality;
    user.stats.luck += luck;
    user.statPoints -= totalPoints;
    
    // distributedStats 업데이트
    if (!user.distributedStats) {
        user.distributedStats = { strength: 0, agility: 0, intelligence: 0, vitality: 0, luck: 0 };
    }
    user.distributedStats.strength = (user.distributedStats.strength || 0) + strength;
    user.distributedStats.agility = (user.distributedStats.agility || 0) + agility;
    user.distributedStats.intelligence = (user.distributedStats.intelligence || 0) + intelligence;
    user.distributedStats.vitality = (user.distributedStats.vitality || 0) + vitality;
    user.distributedStats.luck = (user.distributedStats.luck || 0) + luck;

    // 전투력 재계산
    const { calculateCombatPower } = require('../common/combatPower');
    user.combatPower = calculateCombatPower(user);

    await user.save();
    
    // 결과 메시지 (이미 defer되어 있으므로 editReply 사용)
    await interaction.editReply({
        content: `✅ 스탯 분배 완료!\n\n💪 힘 +${strength}\n🏃 민첩 +${agility}\n🧠 지능 +${intelligence}\n❤️ 체력 +${vitality}\n🍀 행운 +${luck}\n\n📊 남은 포인트: ${user.statPoints}점`
    });

    // 남은 포인트가 있으면 스탯 분배 화면을 팔로우업으로 표시
    if (user.statPoints > 0) {
        // 사용자의 직업(엠블럼) 확인하여 주스텟 결정
        const { EMBLEMS } = require('../../systems/emblemShop');
        const userEmblem = user.emblem?.replace(/\s*\+\d+$/, ''); // 강화 레벨 제거
        let userMainStat = null;
        let emblemType = null;
        
        // 엠블럼 타입 찾기
        for (const [type, data] of Object.entries(EMBLEMS)) {
            if (data.emblems.some(e => e.name === userEmblem)) {
                emblemType = type;
                break;
            }
        }
        
        // 직업별 주스텟 매핑
        const mainStatByType = {
            'warrior': 'strength',    // 전사 - 힘
            'archer': 'agility',      // 궁수 - 민첩  
            'wizard': 'intelligence', // 마법사 - 지능
            'mage': 'intelligence',   // 마법사 - 지능
            'rogue': 'luck',         // 도적 - 행운
            'defender': 'vitality'    // 수호자 - 체력
        };
        
        userMainStat = mainStatByType[emblemType] || null;
        
        // 스탯 분배 화면 다시 표시
        const statEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(`📊 ${user.nickname || interaction.user.username}님의 스탯 분배`)
            .setDescription(`사용 가능한 스탯 포인트: **${user.statPoints}점**\n\n각 스탯을 클릭하여 포인트를 분배하세요!`)
            .addFields(
                { 
                    name: `💪 힘 (STR)${userMainStat === 'strength' ? ' ⭐' : ''}`, 
                    value: `현재: **${user.stats.strength}**\n⚔️ 전사 주스탯\n물리 공격력 증가`, 
                    inline: true 
                },
                { 
                    name: `🏃 민첩 (AGI)${userMainStat === 'agility' ? ' ⭐' : ''}`, 
                    value: `현재: **${user.stats.agility}**\n🏹 궁수 주스탯\n치명타 및 회피율 증가`, 
                    inline: true 
                },
                { 
                    name: `🧠 지능 (INT)${userMainStat === 'intelligence' ? ' ⭐' : ''}`, 
                    value: `현재: **${user.stats.intelligence}**\n🧙 마법사 주스탯\n마법 공격력 증가`, 
                    inline: true 
                },
                { 
                    name: `❤️ 체력 (VIT)${userMainStat === 'vitality' ? ' ⭐' : ''}`, 
                    value: `현재: **${user.stats.vitality}**\n🛡️ 수호자 주스탯\n최대 HP 및 방어력 증가`, 
                    inline: true 
                },
                { 
                    name: `🍀 행운 (LUK)${userMainStat === 'luck' ? ' ⭐' : ''}`, 
                    value: `현재: **${user.stats.luck}**\n🗡️ 도적 주스탯\n크리티컬 및 강화 성공률 증가`, 
                    inline: true 
                }
            )
            .setFooter({ text: '팁: 직업별 주스탯과 부스탯을 적절히 분배하면 더 강해집니다!' });

        // 스탯 버튼들
        const statButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('stat_add_strength')
                    .setLabel('💪 힘 +1')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('stat_add_agility')
                    .setLabel('🏃 민첩 +1')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('stat_add_intelligence')
                    .setLabel('🧠 지능 +1')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('stat_add_vitality')
                    .setLabel('❤️ 체력 +1')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('stat_add_luck')
                    .setLabel('🍀 행운 +1')
                    .setStyle(ButtonStyle.Primary)
            );

        // 추가 옵션 버튼들
        const optionButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('stat_add_custom')
                    .setLabel('🎯 커스텀 분배')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('stat_reset')
                    .setLabel('🔄 스탯 초기화')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('profile')
                    .setLabel('👤 프로필로 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.followUp({
            embeds: [statEmbed],
            components: [statButtons, optionButtons]
        });
    }
}

// 스탯 초기화 확인
async function showStatResetConfirm(interaction) {
    // Safe defer handling
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('[StatDistribution] Interaction expired');
            return;
        }
        console.error('[StatDistribution] Defer error:', error);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!',
            embeds: [],
            components: []
        });
    }
    
    const resetCost = 10000000; // 1000만 골드
    
    // 현재 스탯 총합 계산
    const currentStats = user.stats || {
        strength: 10,
        agility: 10,
        intelligence: 10,
        vitality: 10,
        luck: 10
    };
    
    const totalStatPoints = 
        (currentStats.strength - 10) +
        (currentStats.agility - 10) +
        (currentStats.intelligence - 10) +
        (currentStats.vitality - 10) +
        (currentStats.luck - 10);
    
    const confirmEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🔄 스탯 초기화 확인')
        .setDescription('정말로 스탯을 초기화하시겠습니까?')
        .addFields(
            { 
                name: '💰 비용', 
                value: `${formatNumber(resetCost)}G`, 
                inline: true 
            },
            { 
                name: '💳 보유 골드', 
                value: `${formatNumber(user.gold)}G`, 
                inline: true 
            },
            { 
                name: '📊 회수 포인트', 
                value: `${totalStatPoints}포인트`, 
                inline: true 
            }
        )
        .setFooter({ text: '주의: 엠블럼 강화로 얻은 스탯은 유지됩니다!' });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stat_reset_confirm')
                .setLabel('✅ 초기화하기')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(user.gold < resetCost),
            new ButtonBuilder()
                .setCustomId('stat_reset_cancel')
                .setLabel('❌ 취소')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [confirmEmbed],
        components: [buttons]
    });
}

// 스탯 초기화 실행
async function executeStatReset(interaction) {
    // Safe defer handling
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('[StatDistribution] Interaction expired');
            return;
        }
        console.error('[StatDistribution] Defer error:', error);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.followUp({ 
            content: '❌ 오류가 발생했습니다.',
            flags: 64
        });
    }
    
    const resetCost = 10000000; // 1000만 골드
    if (user.gold < resetCost) {
        return await interaction.followUp({
            content: '❌ 골드가 부족합니다!',
            flags: 64
        });
    }
    
    // 현재 스탯 총합 계산
    const currentStats = user.stats || {
        strength: 10,
        agility: 10,
        intelligence: 10,
        vitality: 10,
        luck: 10
    };
    
    const totalStatPoints = 
        (currentStats.strength - 10) +
        (currentStats.agility - 10) +
        (currentStats.intelligence - 10) +
        (currentStats.vitality - 10) +
        (currentStats.luck - 10);
    
    // 골드 차감
    user.gold -= resetCost;
    
    // 스탯 초기화 (기본 10으로)
    user.stats = {
        strength: 10,
        agility: 10,
        intelligence: 10,
        vitality: 10,
        luck: 10
    };
    
    // distributedStats 초기화
    user.distributedStats = {
        strength: 0,
        agility: 0,
        intelligence: 0,
        vitality: 0,
        luck: 0
    };
    
    // 엠블럼 강화 스탯 재적용
    if (user.emblem && user.emblemEnhancement) {
        const { EMBLEMS } = require('../../systems/emblemShop');
        // 강화 레벨 제거한 기본 엠블럼 이름으로 검색
        const baseEmblemName = user.emblem.replace(/\s*\+\d+$/, '');
        const emblemType = Object.keys(EMBLEMS).find(type => 
            EMBLEMS[type].emblems.some(e => e.name === baseEmblemName)
        );
        
        if (emblemType) {
            const { applyEmblemStats } = require('./emblem');
            await applyEmblemStats(user, emblemType);
        }
    }
    
    // 스탯 포인트 회수
    user.statPoints = (user.statPoints || 0) + totalStatPoints;
    
    // 전투력 재계산
    const { calculateCombatPower } = require('../common/combatPower');
    user.combatPower = calculateCombatPower(user);
    
    await user.save();
    
    const resultEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ 스탯 초기화 완료!')
        .setDescription(`스탯이 초기화되었습니다.`)
        .addFields(
            { name: '💰 사용 골드', value: `${formatNumber(resetCost)}G`, inline: true },
            { name: '📊 회수 포인트', value: `${totalStatPoints}포인트`, inline: true },
            { name: '📊 총 포인트', value: `${user.statPoints}포인트`, inline: true }
        );
    
    await interaction.followUp({
        embeds: [resultEmbed],
        flags: 64
    });
    
    // 스탯 분배 화면으로 돌아가기
    return await showStatDistribution(interaction);
}

// 커스텀 스탯 버튼 처리
async function handleCustomStatButton(interaction, customId) {
    // Safe defer handling
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('[CustomStatButton] Interaction expired');
            return;
        }
        console.error('[CustomStatButton] Defer error:', error);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.followUp({ 
            content: '먼저 회원가입을 해주세요!',
            flags: 64
        });
    }
    
    // customId 파싱: stat_custom_[amount]_[stat] 또는 stat_custom_all_[stat]
    const parts = customId.split('_');
    let stat, amount;
    
    if (parts[2] === 'all') {
        // stat_custom_all_[stat] 형식
        amount = 'all';
        stat = parts[3];
    } else {
        // stat_custom_[stat]_[amount] 형식
        stat = parts[2];
        amount = parts[3];
    }
    
    const statMap = {
        'strength': 'strength',
        'agility': 'agility',
        'intelligence': 'intelligence',
        'vitality': 'vitality',
        'luck': 'luck'
    };
    
    const statNames = {
        strength: '💪 힘',
        agility: '🏃 민첩',
        intelligence: '🧠 지능',
        vitality: '❤️ 체력',
        luck: '🍀 행운'
    };
    
    if (!statMap[stat]) {
        return await interaction.followUp({
            content: '❌ 올바르지 않은 스탯입니다!',
            flags: 64
        });
    }
    
    let pointsToAdd = 0;
    if (amount === '5') {
        pointsToAdd = 5;
    } else if (amount === '10') {
        pointsToAdd = 10;
    } else if (amount === 'all') {
        pointsToAdd = user.statPoints;
    }
    
    if (pointsToAdd === 0 || pointsToAdd > user.statPoints) {
        return await interaction.followUp({
            content: '❌ 포인트가 부족합니다!',
            flags: 64
        });
    }
    
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
    
    // 스탯 적용
    user.stats[statMap[stat]] += pointsToAdd;
    user.statPoints -= pointsToAdd;
    
    // distributedStats 업데이트
    if (!user.distributedStats) {
        user.distributedStats = { strength: 0, agility: 0, intelligence: 0, vitality: 0, luck: 0 };
    }
    user.distributedStats[statMap[stat]] = (user.distributedStats[statMap[stat]] || 0) + pointsToAdd;
    
    // 전투력 재계산
    const { calculateCombatPower } = require('../common/combatPower');
    user.combatPower = calculateCombatPower(user);
    
    await user.save();
    
    await interaction.followUp({
        content: `✅ ${statNames[statMap[stat]]}에 ${pointsToAdd}포인트를 추가했습니다! (현재: ${user.stats[statMap[stat]]})`,
        flags: 64
    });
    
    // 포인트가 남아있으면 커스텀 분배 화면 유지, 없으면 메인 스탯 화면으로
    if (user.statPoints > 0) {
        return await showCustomStatModal(interaction);
    } else {
        return await showStatDistribution(interaction);
    }
}

module.exports = {
    showStatDistribution,
    addStatPoint,
    showCustomStatModal,
    handleCustomStatDistribution,
    handleCustomStatButton,
    showStatResetConfirm,
    executeStatReset
};