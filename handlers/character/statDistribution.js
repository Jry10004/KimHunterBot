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
                name: '💪 힘 (STR)', 
                value: `현재: **${currentStats.strength}**\n⚔️ 전사 주스탯\n물리 공격력 증가`, 
                inline: true 
            },
            { 
                name: '🏃 민첩 (AGI)', 
                value: `현재: **${currentStats.agility}**\n🏹 궁수 주스탯\n치명타 및 회피율 증가`, 
                inline: true 
            },
            { 
                name: '🧠 지능 (INT)', 
                value: `현재: **${currentStats.intelligence}**\n🧙 마법사 주스탯\n마법 공격력 증가`, 
                inline: true 
            },
            { 
                name: '❤️ 체력 (VIT)', 
                value: `현재: **${currentStats.vitality}**\n🛡️ 수호자 주스탯\n최대 HP 및 방어력 증가`, 
                inline: true 
            },
            { 
                name: '🍀 행운 (LUK)', 
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

    await user.save();

    await interaction.followUp({
        content: `✅ ${statNames[statName]}이(가) 1 증가했습니다! (현재: ${user.stats[statName]})`,
        flags: 64
    });

    // 스탯 분배 화면 다시 표시
    return await showStatDistribution(interaction);
}

// 커스텀 스탯 분배 모달
async function showCustomStatModal(interaction) {
    console.log('[CustomStatModal] Called - Deferred:', interaction.deferred, 'Replied:', interaction.replied);
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.reply({ 
            content: '먼저 회원가입을 해주세요!',
            flags: 64
        });
    }
    
    if (!user.statPoints || user.statPoints <= 0) {
        return await interaction.reply({ 
            content: '❌ 사용 가능한 스탯 포인트가 없습니다!',
            flags: 64
        });
    }

    const modal = new ModalBuilder()
        .setCustomId('stat_custom_modal')
        .setTitle('🎯 커스텀 스탯 분배');

    const strengthInput = new TextInputBuilder()
        .setCustomId('stat_custom_strength')
        .setLabel('💪 힘에 추가할 포인트')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0')
        .setRequired(false)
        .setValue('0');

    const agilityInput = new TextInputBuilder()
        .setCustomId('stat_custom_agility')
        .setLabel('🏃 민첩에 추가할 포인트')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0')
        .setRequired(false)
        .setValue('0');

    const intelligenceInput = new TextInputBuilder()
        .setCustomId('stat_custom_intelligence')
        .setLabel('🧠 지능에 추가할 포인트')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0')
        .setRequired(false)
        .setValue('0');

    const vitalityInput = new TextInputBuilder()
        .setCustomId('stat_custom_vitality')
        .setLabel('❤️ 체력에 추가할 포인트')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0')
        .setRequired(false)
        .setValue('0');

    const luckInput = new TextInputBuilder()
        .setCustomId('stat_custom_luck')
        .setLabel(`🍀 행운에 추가할 포인트 (보유: ${user.statPoints}점)`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0')
        .setRequired(false)
        .setValue('0');

    modal.addComponents(
        new ActionRowBuilder().addComponents(strengthInput),
        new ActionRowBuilder().addComponents(agilityInput),
        new ActionRowBuilder().addComponents(intelligenceInput),
        new ActionRowBuilder().addComponents(vitalityInput),
        new ActionRowBuilder().addComponents(luckInput)
    );

    try {
        console.log('[CustomStatModal] Attempting to show modal...');
        await interaction.showModal(modal);
        console.log('[CustomStatModal] Modal shown successfully!');
    } catch (error) {
        console.error('[CustomStatModal] Error showing modal:', error);
        console.error('[CustomStatModal] Error code:', error.code);
        console.error('[CustomStatModal] Error message:', error.message);
        
        // 에러 발생 시 팔로우업으로 응답
        try {
            await interaction.reply({ 
                content: '❌ 모달을 표시하는 중 오류가 발생했습니다. 다시 시도해주세요.',
                flags: 64
            });
        } catch (replyError) {
            console.error('[CustomStatModal] Reply error:', replyError);
        }
    }
}

// 커스텀 스탯 분배 처리
async function handleCustomStatDistribution(interaction) {
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

    await user.save();
    
    // 결과 메시지 (이미 defer되어 있으므로 editReply 사용)
    await interaction.editReply({
        content: `✅ 스탯 분배 완료!\n\n💪 힘 +${strength}\n🏃 민첩 +${agility}\n🧠 지능 +${intelligence}\n❤️ 체력 +${vitality}\n🍀 행운 +${luck}\n\n📊 남은 포인트: ${user.statPoints}점`
    });

    // 남은 포인트가 있으면 스탯 분배 화면을 팔로우업으로 표시
    if (user.statPoints > 0) {
        // 스탯 분배 화면 다시 표시
        const statEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(`📊 ${user.nickname || interaction.user.username}님의 스탯 분배`)
            .setDescription(`사용 가능한 스탯 포인트: **${user.statPoints}점**\n\n각 스탯을 클릭하여 포인트를 분배하세요!`)
            .addFields(
                { 
                    name: '💪 힘 (STR)', 
                    value: `현재: **${user.stats.strength}**\n⚔️ 전사 주스탯\n물리 공격력 증가`, 
                    inline: true 
                },
                { 
                    name: '🏃 민첩 (AGI)', 
                    value: `현재: **${user.stats.agility}**\n🏹 궁수 주스탯\n치명타 및 회피율 증가`, 
                    inline: true 
                },
                { 
                    name: '🧠 지능 (INT)', 
                    value: `현재: **${user.stats.intelligence}**\n🧙 마법사 주스탯\n마법 공격력 증가`, 
                    inline: true 
                },
                { 
                    name: '❤️ 체력 (VIT)', 
                    value: `현재: **${user.stats.vitality}**\n🛡️ 수호자 주스탯\n최대 HP 및 방어력 증가`, 
                    inline: true 
                },
                { 
                    name: '🍀 행운 (LUK)', 
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

module.exports = {
    showStatDistribution,
    addStatPoint,
    showCustomStatModal,
    handleCustomStatDistribution,
    showStatResetConfirm,
    executeStatReset
};