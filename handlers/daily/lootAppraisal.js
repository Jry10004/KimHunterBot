const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { LOOT_APPRAISAL, appraiseLoot } = require('../../data/lootAppraisal');

// 전리품 감정소 메인 메뉴
async function showAppraisalMenu(interaction) {
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({ 
                content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.'
            });
        } else {
            return await interaction.reply({ 
                content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
                flags: 64 
            });
        }
    }
    
    if (!user.lootAppraisal) {
        user.lootAppraisal = {
            unidentifiedItems: [],
            totalAppraised: 0,
            jackpotCount: 0,
            trashCount: 0,
            goldSpentOnAppraisal: 0
        };
        await user.save();
    }
    
    const unidentifiedCount = user.lootAppraisal.unidentifiedItems.length;
    
    const embed = new EmbedBuilder()
        .setColor('#9966ff')
        .setTitle('🔍 전리품 감정소')
        .setDescription('미확인 아이템을 감정하여 진짜 가치를 확인하세요!')
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723792/appraisal_shop.png')
        .addFields(
            { name: '💰 보유 골드', value: `${formatNumber(user.gold)}G`, inline: true },
            { name: '📦 미확인 아이템', value: `${unidentifiedCount}개`, inline: true },
            { name: '📊 통계', value: `감정: ${user.lootAppraisal.totalAppraised}회\n대박: ${user.lootAppraisal.jackpotCount}회`, inline: true }
        );
    
    if (unidentifiedCount === 0) {
        embed.addFields({ 
            name: '❌ 미확인 아이템 없음', 
            value: '사냥을 통해 미확인 아이템을 획득하세요!' 
        });
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('hunting')
                    .setLabel('🎯 사냥하러 가기')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        // 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            return await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });
        } else {
            return await interaction.reply({
                embeds: [embed],
                components: [buttons],
                flags: 64
            });
        }
    }
    
    // 미확인 아이템 목록 표시
    let itemList = '';
    const itemsToShow = Math.min(5, unidentifiedCount);
    
    for (let i = 0; i < itemsToShow; i++) {
        const item = user.lootAppraisal.unidentifiedItems[i];
        const gradeData = LOOT_APPRAISAL.grades[item.grade || 'common'];
        itemList += `${i + 1}. ${gradeData.emoji} **${gradeData.name}** - 감정비용: ${formatNumber(gradeData.baseCost)}G\n`;
        itemList += `   _${item.fromMonster || '알 수 없는 몬스터'}에게서 획득 (${item.foundAt ? new Date(item.foundAt).toLocaleDateString() : '알 수 없음'})_\n`;
    }
    
    if (unidentifiedCount > 5) {
        itemList += `\n... 그리고 ${unidentifiedCount - 5}개 더`;
    }
    
    embed.addFields({ name: '📋 미확인 아이템 목록', value: itemList });
    
    // 최고 발견품 표시
    if (user.lootAppraisal.bestFind?.name) {
        embed.addFields({
            name: '🌟 최고 발견품',
            value: `**${user.lootAppraisal.bestFind.name}** (${formatNumber(user.lootAppraisal.bestFind.value)}G)`,
            inline: false
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('appraise_single')
                .setLabel('🔍 1개 감정')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('appraise_bulk')
                .setLabel('🎰 10개 일괄 감정')
                .setStyle(ButtonStyle.Success)
                .setDisabled(unidentifiedCount < 10),
            new ButtonBuilder()
                .setCustomId('appraise_all')
                .setLabel('💎 모두 감정')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(unidentifiedCount > 50), // 너무 많으면 비활성화
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    // 이미 defer된 경우 editReply 사용
    if (interaction.deferred) {
        return await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } else {
        return await interaction.reply({
            embeds: [embed],
            components: [buttons],
            flags: 64
        });
    }
}

// 감정 실행
async function executeAppraisal(interaction, count = 1) {
    try {
        // 이미 defer된 상태가 아니면 deferUpdate
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        
        const user = await getUser(interaction.user.id);
    if (!user.lootAppraisal || user.lootAppraisal.unidentifiedItems.length === 0) {
        return await interaction.editReply({
            content: '❌ 감정할 아이템이 없습니다!',
            embeds: [],
            components: []
        });
    }
    
    const actualCount = Math.min(count, user.lootAppraisal.unidentifiedItems.length);
    let totalCost = 0;
    let results = [];
    
    // 감정 비용 계산
    for (let i = 0; i < actualCount; i++) {
        const item = user.lootAppraisal.unidentifiedItems[i];
        const gradeData = LOOT_APPRAISAL.grades[item.grade || 'common'];
        totalCost += gradeData?.baseCost || 100;
    }
    
    if (user.gold < totalCost) {
        return await interaction.editReply({
            content: `❌ 골드가 부족합니다! (필요: ${formatNumber(totalCost)}G, 보유: ${formatNumber(user.gold)}G)`,
            embeds: [],
            components: []
        });
    }
    
    // 감정 애니메이션
    const loadingEmbed = new EmbedBuilder()
        .setColor('#ffdd44')
        .setTitle('🔍 감정 중...')
        .setDescription(`${actualCount}개의 아이템을 감정하고 있습니다...`)
        .setImage(LOOT_APPRAISAL.appraisalGifs[Math.floor(Math.random() * LOOT_APPRAISAL.appraisalGifs.length)]);
    
    await interaction.editReply({
        embeds: [loadingEmbed],
        components: []
    });
    
    // 2초 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 감정 실행
    user.gold -= totalCost;
    user.lootAppraisal.goldSpentOnAppraisal += totalCost;
    user.lootAppraisal.totalAppraised += actualCount;
    
    let totalValue = 0;
    let hasJackpot = false;
    
    for (let i = 0; i < actualCount; i++) {
        const unidentified = user.lootAppraisal.unidentifiedItems.shift();
        const result = appraiseLoot(unidentified.grade || 'common');
        
        if (!result || !result.item) {
            console.error('감정 결과 오류:', unidentified);
            // 기본값 사용
            const defaultResult = {
                outcome: 'common',
                item: { 
                    name: '신비한 가루', 
                    emoji: '✨', 
                    value: 100, 
                    description: '정체불명의 가루' 
                },
                message: '평범한 아이템입니다.',
                color: '#aaaaaa'
            };
            results.push({
                ...defaultResult,
                grade: unidentified.grade || 'common',
                fromMonster: unidentified.fromMonster || '알 수 없음'
            });
            totalValue += defaultResult.item.value;
            continue;
        }
        
        results.push({
            ...result,
            grade: unidentified.grade || 'common',
            fromMonster: unidentified.fromMonster || '알 수 없음'
        });
        
        totalValue += result.item.value;
        
        // 통계 업데이트
        if (result.outcome === 'trash') {
            user.lootAppraisal.trashCount++;
        } else if (result.outcome === 'legendary') {
            user.lootAppraisal.jackpotCount++;
            hasJackpot = true;
            
            // 최고 발견품 업데이트
            if (!user.lootAppraisal.bestFind || result.item.value > user.lootAppraisal.bestFind.value) {
                user.lootAppraisal.bestFind = {
                    name: result.item.name,
                    value: result.item.value,
                    date: new Date()
                };
            }
        }
        
        // 인벤토리에 아이템 추가 (골드 지급 대신)
        const newSlot = user.inventory.length > 0 ? 
            Math.max(...user.inventory.map(i => i.inventorySlot || 0)) + 1 : 0;
        
        user.inventory.push({
            id: `appraisal_${Date.now()}_${i}`,
            name: result.item.name,
            type: 'material',
            emoji: result.item.emoji,
            quantity: 1,
            price: result.item.value,
            rarity: result.outcome,
            setName: '감정 결과물',
            level: 1,
            enhanceLevel: 0,
            stats: { attack: 0, defense: 0, dodge: 0, luck: 0 },
            description: result.item.description,
            equipped: false,
            inventorySlot: newSlot,
            fromMonster: unidentified.fromMonster || '알 수 없음',
            appraisedAt: new Date()
        });
    }
    
    await user.save();
    
    // 결과 표시
    const resultEmbed = new EmbedBuilder()
        .setColor(hasJackpot ? '#ffdd44' : '#44ff44')
        .setTitle(hasJackpot ? '🎊 대박! 전설 아이템 발견!' : '🔍 감정 완료')
        .setDescription(`${actualCount}개 아이템 감정 완료!`);
    
    if (hasJackpot) {
        resultEmbed.setImage(LOOT_APPRAISAL.jackpotGifs[Math.floor(Math.random() * LOOT_APPRAISAL.jackpotGifs.length)]);
    }
    
    // 결과 목록 (최대 10개만 표시)
    let resultText = '';
    const displayCount = Math.min(10, results.length);
    
    for (let i = 0; i < displayCount; i++) {
        const result = results[i];
        const gradeData = LOOT_APPRAISAL.grades[result.grade];
        resultText += `${gradeData.emoji} ➜ ${result.item.emoji} **${result.item.name}** (+${formatNumber(result.item.value)}G)\n`;
        resultText += `   ${result.message}\n\n`;
    }
    
    if (results.length > 10) {
        resultText += `... 그리고 ${results.length - 10}개 더\n`;
    }
    
    resultEmbed.addFields(
        { name: '📋 감정 결과', value: resultText.trim() },
        { 
            name: '💰 감정 정보', 
            value: `감정 비용: -${formatNumber(totalCost)}G\n총 가치: ${formatNumber(totalValue)}G\n**${actualCount}개 아이템이 인벤토리에 추가되었습니다!**`,
            inline: true
        },
        {
            name: '📊 현재 상태',
            value: `보유 골드: ${formatNumber(user.gold)}G\n남은 미확인: ${user.lootAppraisal.unidentifiedItems.length}개`,
            inline: true
        }
    )
    .setFooter({ text: '💡 감정된 아이템은 감정사에게서 즉시 판매하거나 창고에 보관할 수 있습니다!' });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('appraiser_greet')
                .setLabel('🧙 감정사 메뉴')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('appraiser_sell')
                .setLabel('💰 즉시 판매')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('appraiser_warehouse')
                .setLabel('🏦 창고 보관')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('appraisal_menu')
                .setLabel('🔍 더 감정하기')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(user.lootAppraisal.unidentifiedItems.length === 0),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [resultEmbed],
        components: [buttons]
    });
    } catch (error) {
        console.error('[Appraisal] Error during appraisal:', error);
        
        // 이미 응답한 경우 아무것도 하지 않음
        if (error.code === 'InteractionAlreadyReplied') {
            console.log('[Appraisal] Interaction already replied, skipping error response');
            return;
        }
        
        // 응답 가능한 경우에만 에러 메시지 전송
        try {
            if (interaction.deferred) {
                return await interaction.editReply({
                    content: '❌ 감정 중 오류가 발생했습니다. 다시 시도해주세요.',
                    embeds: [],
                    components: []
                });
            } else if (!interaction.replied) {
                return await interaction.reply({
                    content: '❌ 감정 중 오류가 발생했습니다. 다시 시도해주세요.',
                    embeds: [],
                    components: [],
                    flags: 64
                });
            }
        } catch (replyError) {
            console.error('[Appraisal] Failed to send error message:', replyError);
        }
    }
}

module.exports = {
    showAppraisalMenu,
    executeAppraisal
};