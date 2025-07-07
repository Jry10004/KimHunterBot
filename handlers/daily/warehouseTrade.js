const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { LOOT_MARKET, getItemPrice, recordMarketEvent } = require('../../data/lootMarket');
const { APPRAISAL_STOCK } = require('../../data/appraisalStock');
const lifeSystem = require('../../systems/lifeSystemIntegration');

// 창고에서 판매 실행
async function sellFromWarehouse(interaction, selectedIndices) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const indicesToSell = interaction.customId === 'warehouse_sell_selected' ? 
        interaction.values.map(v => parseInt(v)) : selectedIndices;
    
    if (!indicesToSell || indicesToSell.length === 0) {
        return await interaction.editReply({
            content: '❌ 판매할 아이템을 선택하세요!',
            embeds: [],
            components: []
        });
    }
    
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let soldItems = [];
    
    // 인덱스를 역순으로 정렬 (삭제 시 인덱스 변경 방지)
    indicesToSell.sort((a, b) => b - a);
    
    for (const index of indicesToSell) {
        const item = user.appraisalWarehouse.items[index];
        if (!item) continue;
        
        const currentPrice = getItemPrice(item.id) || item.appraisedPrice;
        const revenue = currentPrice * item.quantity;
        const profit = (currentPrice - item.appraisedPrice) * item.quantity;
        
        totalRevenue += revenue;
        if (profit > 0) {
            totalProfit += profit;
        } else {
            totalLoss += Math.abs(profit);
        }
        
        soldItems.push({
            name: item.name,
            emoji: item.emoji,
            quantity: item.quantity,
            buyPrice: item.appraisedPrice,
            sellPrice: currentPrice,
            profit,
            profitRate: ((currentPrice - item.appraisedPrice) / item.appraisedPrice * 100).toFixed(1)
        });
        
        // 아이템 제거
        user.appraisalWarehouse.items.splice(index, 1);
    }
    
    // 골드 지급 및 통계 업데이트
    user.gold += totalRevenue;
    user.appraisalWarehouse.totalProfit += totalProfit;
    user.appraisalWarehouse.totalLoss += totalLoss;
    
    await user.save();
    
    // 시장 이벤트 기록
    recordMarketEvent('appraisalActivity', soldItems.length);
    
    // 라이프 시스템 뉴스 연동 - 대규모 거래
    if (totalRevenue >= 10000000) {
        lifeSystem.reportTransaction(user, totalRevenue);
    }
    
    // 결과 표시
    const embed = new EmbedBuilder()
        .setColor(totalProfit > totalLoss ? '#00ff00' : '#ff0000')
        .setTitle('💰 창고 아이템 판매 완료!')
        .setDescription(`${LOOT_MARKET.appraiser.name}: "${totalProfit > totalLoss ? '훌륭한 거래였습니다!' : '다음엔 더 좋은 시세를 노려보세요.'}"`)
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723801/warehouse_sell.gif');
    
    // 판매 내역 (최대 10개)
    let sellDetails = '';
    soldItems.slice(0, 10).forEach(item => {
        const profitEmoji = item.profit > 0 ? '📈' : '📉';
        sellDetails += `${item.emoji} **${item.name}** x${item.quantity}\n`;
        sellDetails += `　매입: ${formatNumber(item.buyPrice)}G → 판매: ${formatNumber(item.sellPrice)}G\n`;
        sellDetails += `　${profitEmoji} ${item.profit > 0 ? '+' : ''}${formatNumber(item.profit)}G (${item.profit > 0 ? '+' : ''}${item.profitRate}%)\n\n`;
    });
    
    if (soldItems.length > 10) {
        sellDetails += `... 그리고 ${soldItems.length - 10}개 더\n`;
    }
    
    embed.addFields(
        { name: '📋 판매 내역', value: sellDetails || '없음' },
        { 
            name: '💹 거래 요약', 
            value: `총 매출: **${formatNumber(totalRevenue)}G**\n` +
                   `순이익: ${totalProfit > 0 ? `+${formatNumber(totalProfit)}G` : '0G'}\n` +
                   `손실: ${totalLoss > 0 ? `-${formatNumber(totalLoss)}G` : '0G'}`,
            inline: true
        },
        {
            name: '💰 현재 상태',
            value: `보유 골드: ${formatNumber(user.gold)}G\n` +
                   `창고: ${user.appraisalWarehouse.items.length}/${user.appraisalWarehouse.slots}`,
            inline: true
        }
    );
    
    // 대박/쪽박 메시지
    if (totalProfit > 100000) {
        embed.addFields({
            name: '🎊 대박 거래!',
            value: '시세를 완벽하게 읽으셨네요! 축하합니다!'
        });
    } else if (totalLoss > 50000) {
        embed.addFields({
            name: '😢 아쉬운 거래',
            value: '손실이 컸지만, 경험은 쌓였습니다. 다음엔 더 좋은 기회가 올 거예요!'
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('warehouse_withdraw')
                .setLabel('📤 더 판매하기')
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.appraisalWarehouse.items.length === 0),
            new ButtonBuilder()
                .setCustomId('warehouse_main')
                .setLabel('🏦 창고로')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('appraiser_greet')
                .setLabel('🧙 감정사로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 인벤토리로 인출
async function withdrawToInventory(interaction, selectedIndices) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const indicesToWithdraw = interaction.customId === 'warehouse_withdraw_selected' ? 
        interaction.values.map(v => parseInt(v)) : selectedIndices;
    
    if (!indicesToWithdraw || indicesToWithdraw.length === 0) {
        return await interaction.editReply({
            content: '❌ 인출할 아이템을 선택하세요!',
            embeds: [],
            components: []
        });
    }
    
    let withdrawnItems = [];
    
    // 인덱스를 역순으로 정렬
    indicesToWithdraw.sort((a, b) => b - a);
    
    for (const index of indicesToWithdraw) {
        const item = user.appraisalWarehouse.items[index];
        if (!item) continue;
        
        // 인벤토리에 추가
        const newSlot = user.inventory.length > 0 ? 
            Math.max(...user.inventory.map(i => i.inventorySlot || 0)) + 1 : 0;
        
        user.inventory.push({
            id: item.id,
            name: item.name,
            type: 'material',
            emoji: item.emoji,
            quantity: item.quantity,
            price: item.appraisedPrice,
            rarity: '일반', // 기본값
            setName: '재료',
            level: 1,
            enhanceLevel: 0,
            stats: { attack: 0, defense: 0, dodge: 0, luck: 0 },
            description: '감정 창고에서 인출한 아이템',
            equipped: false,
            inventorySlot: newSlot
        });
        
        withdrawnItems.push({
            name: item.name,
            emoji: item.emoji,
            quantity: item.quantity
        });
        
        // 창고에서 제거
        user.appraisalWarehouse.items.splice(index, 1);
    }
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📤 인벤토리로 인출 완료!')
        .setDescription('창고에서 아이템을 인벤토리로 옮겼습니다.')
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723802/withdraw.gif');
    
    let withdrawText = '';
    withdrawnItems.forEach(item => {
        withdrawText += `${item.emoji} ${item.name} x${item.quantity}\n`;
    });
    
    embed.addFields(
        { name: '📦 인출 내역', value: withdrawText },
        { 
            name: '💼 현재 상태', 
            value: `인벤토리: ${user.inventory.length}개\n창고: ${user.appraisalWarehouse.items.length}/${user.appraisalWarehouse.slots}`,
            inline: true
        }
    );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('warehouse_main')
                .setLabel('🏦 창고로')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('appraiser_sell')
                .setLabel('💰 즉시 판매')
                .setStyle(ButtonStyle.Success)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 감정 증서 발행 실행
async function createCertificate(interaction, certificateName) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    
    // 증서 정보 찾기
    let certificate = null;
    let categoryName = null;
    
    for (const [category, certs] of Object.entries(APPRAISAL_STOCK.certificates)) {
        if (certs[certificateName]) {
            certificate = certs[certificateName];
            categoryName = category;
            break;
        }
    }
    
    if (!certificate) {
        return await interaction.editReply({
            content: '❌ 잘못된 증서입니다!',
            embeds: [],
            components: []
        });
    }
    
    // 재료 확인 및 소비
    const itemsToRemove = [];
    
    for (const [itemId, required] of Object.entries(certificate.recipe)) {
        let found = 0;
        
        for (let i = 0; i < user.appraisalWarehouse.items.length; i++) {
            const item = user.appraisalWarehouse.items[i];
            if (item.id === itemId || item.name === itemId) {
                found += item.quantity;
                itemsToRemove.push({ index: i, quantity: Math.min(item.quantity, required - (found - item.quantity)) });
                if (found >= required) break;
            }
        }
        
        if (found < required) {
            return await interaction.editReply({
                content: `❌ 재료가 부족합니다! ${itemId} ${found}/${required}`,
                embeds: [],
                components: []
            });
        }
    }
    
    // 재료 소비
    itemsToRemove.sort((a, b) => b.index - a.index);
    for (const removal of itemsToRemove) {
        const item = user.appraisalWarehouse.items[removal.index];
        if (item.quantity > removal.quantity) {
            item.quantity -= removal.quantity;
        } else {
            user.appraisalWarehouse.items.splice(removal.index, 1);
        }
    }
    
    // 증서 발행
    user.appraisalWarehouse.certificates.push({
        id: `cert_${Date.now()}`,
        name: certificateName,
        value: certificate.value,
        createdAt: new Date()
    });
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#ffdd44')
        .setTitle('📜 감정 증서 발행 완료!')
        .setDescription('고정 가격 증서가 발행되었습니다.')
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723803/certificate.gif')
        .addFields(
            { name: '📜 증서명', value: certificateName, inline: true },
            { name: '💰 고정 가치', value: `${formatNumber(certificate.value)}G`, inline: true },
            { name: '📋 설명', value: certificate.description }
        );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('warehouse_sell_certificate')
                .setLabel('💵 증서 현금화')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('warehouse_certificate')
                .setLabel('📜 더 발행하기')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('warehouse_main')
                .setLabel('🏦 창고로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 보관료 납부
async function payWarehouseFee(interaction) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const feeDebt = user.appraisalWarehouse.feeDebt;
    
    if (feeDebt <= 0) {
        return await interaction.editReply({
            content: '❌ 납부할 보관료가 없습니다!',
            embeds: [],
            components: []
        });
    }
    
    if (user.gold < feeDebt) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('💸 골드 부족')
            .setDescription('보관료를 납부할 골드가 부족합니다.')
            .addFields(
                { name: '💰 필요 골드', value: `${formatNumber(feeDebt)}G`, inline: true },
                { name: '💵 보유 골드', value: `${formatNumber(user.gold)}G`, inline: true }
            )
            .setFooter({ text: '⚠️ 보관료 미납이 계속되면 아이템이 압류될 수 있습니다!' });
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('warehouse_withdraw')
                    .setLabel('💰 아이템 판매')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('warehouse_main')
                    .setLabel('🔙 창고로')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        return await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    }
    
    // 보관료 납부
    user.gold -= feeDebt;
    user.appraisalWarehouse.feeDebt = 0;
    user.appraisalWarehouse.lastFeePayment = new Date();
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ 보관료 납부 완료')
        .setDescription('창고 보관료를 모두 납부했습니다.')
        .addFields(
            { name: '💵 납부 금액', value: `${formatNumber(feeDebt)}G`, inline: true },
            { name: '💰 남은 골드', value: `${formatNumber(user.gold)}G`, inline: true }
        )
        .setFooter({ text: '보관료는 매일 자동으로 부과됩니다.' });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('warehouse_main')
                .setLabel('🏦 창고로')
                .setStyle(ButtonStyle.Primary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

module.exports = {
    sellFromWarehouse,
    withdrawToInventory,
    createCertificate,
    payWarehouseFee
};