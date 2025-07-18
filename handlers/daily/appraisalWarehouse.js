const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { LOOT_MARKET, getItemPrice, updateMarketPrices } = require('../../data/lootMarket');
const { APPRAISAL_STOCK, canCreateCertificate, generatePrediction, checkAutoTrade } = require('../../data/appraisalStock');

// 감정 창고 메인
async function showWarehouse(interaction) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    if (!user.appraisalWarehouse) {
        user.appraisalWarehouse = {
            grade: 'basic',
            slots: 50,
            items: [],
            certificates: [],
            totalProfit: 0,
            totalLoss: 0,
            lastFeePayment: new Date(),
            feeDebt: 0
        };
        await user.save();
    }
    
    // 보관료 계산
    const now = new Date();
    const daysSincePayment = Math.floor((now - user.appraisalWarehouse.lastFeePayment) / (1000 * 60 * 60 * 24));
    const warehouseGrade = APPRAISAL_STOCK.warehouseGrades[user.appraisalWarehouse.grade];
    const dailyFee = warehouseGrade.fee * user.appraisalWarehouse.items.length;
    const totalFee = dailyFee * daysSincePayment;
    
    if (totalFee > 0) {
        user.appraisalWarehouse.feeDebt += totalFee;
        user.appraisalWarehouse.lastFeePayment = now;
        await user.save();
    }
    
    const embed = new EmbedBuilder()
        .setColor('#9966ff')
        .setTitle(`🏦 ${warehouseGrade.name}`)
        .setDescription('시세를 보며 최적의 판매 시점을 노리세요!')
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723797/warehouse.png')
        .addFields(
            { 
                name: '📦 보관 현황', 
                value: `사용: ${user.appraisalWarehouse.items.length}/${user.appraisalWarehouse.slots}슬롯\n미납 보관료: ${formatNumber(user.appraisalWarehouse.feeDebt)}G`,
                inline: true
            },
            {
                name: '💹 수익 현황',
                value: `총 수익: +${formatNumber(user.appraisalWarehouse.totalProfit)}G\n총 손실: -${formatNumber(user.appraisalWarehouse.totalLoss)}G`,
                inline: true
            },
            {
                name: '📜 감정 증서',
                value: `보유: ${user.appraisalWarehouse.certificates.length}개`,
                inline: true
            }
        );
    
    // 창고 기능 표시
    if (warehouseGrade.features.length > 0) {
        embed.addFields({
            name: '✨ 창고 기능',
            value: warehouseGrade.features.map(f => `• ${f}`).join('\n'),
            inline: false
        });
    }
    
    // 보관 중인 아이템 목록 (최대 5개)
    if (user.appraisalWarehouse.items.length > 0) {
        updateMarketPrices(); // 시세 업데이트
        
        let itemList = '';
        const itemsToShow = Math.min(5, user.appraisalWarehouse.items.length);
        
        for (let i = 0; i < itemsToShow; i++) {
            const item = user.appraisalWarehouse.items[i];
            const currentPrice = getItemPrice(item.id) || item.appraisedPrice;
            const profitRate = ((currentPrice - item.appraisedPrice) / item.appraisedPrice * 100).toFixed(1);
            const profitEmoji = profitRate > 0 ? '📈' : profitRate < 0 ? '📉' : '➖';
            
            itemList += `${item.emoji} **${item.name}** x${item.quantity}\n`;
            itemList += `　매입가: ${formatNumber(item.appraisedPrice)}G → 현재가: ${formatNumber(currentPrice)}G (${profitEmoji} ${profitRate}%)\n`;
            
            if (item.strategy) {
                itemList += `　전략: ${item.strategy}`;
                if (item.locked) itemList += ' 🔒';
            }
            itemList += '\n';
        }
        
        if (user.appraisalWarehouse.items.length > 5) {
            itemList += `... 그리고 ${user.appraisalWarehouse.items.length - 5}개 더`;
        }
        
        embed.addFields({ name: '📊 보관 아이템', value: itemList });
    }
    
    const buttons1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('warehouse_deposit')
                .setLabel('📥 아이템 보관')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('warehouse_withdraw')
                .setLabel('📤 판매/인출')
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.appraisalWarehouse.items.length === 0),
            new ButtonBuilder()
                .setCustomId('warehouse_strategy')
                .setLabel('🎯 전략 설정')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(user.appraisalWarehouse.items.length === 0),
            new ButtonBuilder()
                .setCustomId('warehouse_certificate')
                .setLabel('📜 증서 발행')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('warehouse_upgrade')
                .setLabel('⬆️ 창고 업그레이드')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(user.appraisalWarehouse.grade === 'vip')
        );
    
    const buttons2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('warehouse_pay_fee')
                .setLabel(`💰 보관료 납부 (${formatNumber(user.appraisalWarehouse.feeDebt)}G)`)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(user.appraisalWarehouse.feeDebt === 0),
            new ButtonBuilder()
                .setCustomId('appraiser_greet')
                .setLabel('🔙 감정사로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons1, buttons2]
    });
}

// 아이템 보관
async function depositToWarehouse(interaction) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const materials = user.inventory.filter(item => item.type === 'material');
    
    if (materials.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('📥 보관할 아이템 없음')
            .setDescription('인벤토리에 재료 아이템이 없습니다.')
            .setFooter({ text: '사냥을 통해 재료를 획득하세요!' });
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('hunting')
                    .setLabel('🎯 사냥하러 가기')
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
    
    // 보관 가능한 슬롯 확인
    const availableSlots = user.appraisalWarehouse.slots - user.appraisalWarehouse.items.length;
    if (availableSlots <= 0) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('📦 창고 가득참')
            .setDescription('창고에 빈 슬롯이 없습니다!')
            .addFields(
                { name: '해결 방법', value: '• 아이템을 판매하여 공간 확보\n• 창고 업그레이드로 슬롯 확장' }
            );
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('warehouse_withdraw')
                    .setLabel('📤 아이템 판매')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('warehouse_upgrade')
                    .setLabel('⬆️ 창고 업그레이드')
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
    
    // 보관할 아이템 선택
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('warehouse_deposit_select')
        .setPlaceholder(`📥 보관할 아이템 선택 (최대 ${Math.min(availableSlots, 25)}개)`)
        .setMaxValues(Math.min(availableSlots, materials.length, 25));
    
    materials.slice(0, 25).forEach((item, index) => {
        const currentPrice = getItemPrice(item.id) || item.price || 100;
        const quantity = item.quantity || 1;
        
        selectMenu.addOptions({
            label: `${item.name} x${quantity}`,
            description: `현재 시세: ${formatNumber(currentPrice)}G`,
            value: `${index}`,
            emoji: item.emoji || '📦'
        });
    });
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📥 감정 창고 보관')
        .setDescription('시세가 오를 때까지 안전하게 보관하세요!')
        .addFields(
            { name: '📦 보관 가능', value: `${availableSlots}슬롯`, inline: true },
            { name: '💰 일일 보관료', value: `슬롯당 ${APPRAISAL_STOCK.warehouseGrades[user.appraisalWarehouse.grade].fee}G`, inline: true }
        )
        .setFooter({ text: '보관한 아이템은 언제든 꺼낼 수 있습니다.' });
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('warehouse_main')
                .setLabel('🔙 창고로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [row, buttonRow]
    });
}

// 보관 실행
async function executeDeposit(interaction, selectedIndices) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const materials = user.inventory.filter(item => item.type === 'material');
    
    let depositedItems = [];
    
    for (const index of selectedIndices) {
        const item = materials[parseInt(index)];
        if (!item) continue;
        
        const currentPrice = getItemPrice(item.id) || item.price || 100;
        
        // 창고에 추가
        user.appraisalWarehouse.items.push({
            id: item.id,
            name: item.name,
            emoji: item.emoji || '📦',
            quantity: item.quantity || 1,
            appraisedPrice: currentPrice,
            appraisedAt: new Date(),
            strategy: null,
            locked: false
        });
        
        depositedItems.push({
            name: item.name,
            emoji: item.emoji || '📦',
            quantity: item.quantity || 1,
            price: currentPrice
        });
        
        // 인벤토리에서 제거
        const itemIndex = user.inventory.findIndex(i => i === item);
        if (itemIndex !== -1) {
            user.inventory.splice(itemIndex, 1);
        }
    }
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📥 보관 완료!')
        .setDescription('아이템이 감정 창고에 안전하게 보관되었습니다.')
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723798/deposit.gif');
    
    let depositText = '';
    depositedItems.forEach(item => {
        depositText += `${item.emoji} ${item.name} x${item.quantity} (시세: ${formatNumber(item.price)}G)\n`;
    });
    
    embed.addFields(
        { name: '📦 보관 내역', value: depositText },
        { name: '💼 창고 현황', value: `${user.appraisalWarehouse.items.length}/${user.appraisalWarehouse.slots} 슬롯 사용중`, inline: true }
    );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('warehouse_deposit')
                .setLabel('📥 더 보관하기')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.inventory.filter(i => i.type === 'material').length === 0 || 
                           user.appraisalWarehouse.items.length >= user.appraisalWarehouse.slots),
            new ButtonBuilder()
                .setCustomId('warehouse_strategy')
                .setLabel('🎯 전략 설정')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('warehouse_main')
                .setLabel('🏦 창고 메인')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 판매/인출
async function withdrawFromWarehouse(interaction) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    updateMarketPrices(); // 시세 업데이트
    
    if (user.appraisalWarehouse.items.length === 0) {
        return await showWarehouse(interaction);
    }
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('warehouse_withdraw_select')
        .setPlaceholder('📤 판매/인출할 아이템 선택')
        .setMaxValues(Math.min(user.appraisalWarehouse.items.length, 25));
    
    let totalCurrentValue = 0;
    let totalPurchaseValue = 0;
    
    user.appraisalWarehouse.items.slice(0, 25).forEach((item, index) => {
        const currentPrice = getItemPrice(item.id) || item.appraisedPrice;
        const profitRate = ((currentPrice - item.appraisedPrice) / item.appraisedPrice * 100).toFixed(1);
        const profitEmoji = profitRate > 0 ? '📈' : profitRate < 0 ? '📉' : '➖';
        
        totalCurrentValue += currentPrice * item.quantity;
        totalPurchaseValue += item.appraisedPrice * item.quantity;
        
        selectMenu.addOptions({
            label: `${item.name} x${item.quantity} (${profitEmoji} ${profitRate}%)`,
            description: `매입가: ${formatNumber(item.appraisedPrice)}G → 현재가: ${formatNumber(currentPrice)}G`,
            value: `${index}`,
            emoji: item.emoji
        });
    });
    
    const totalProfitRate = ((totalCurrentValue - totalPurchaseValue) / totalPurchaseValue * 100).toFixed(1);
    
    const embed = new EmbedBuilder()
        .setColor('#ffcc00')
        .setTitle('📤 창고 아이템 관리')
        .setDescription('판매하거나 인벤토리로 인출할 수 있습니다.')
        .addFields(
            { name: '💰 총 매입가', value: `${formatNumber(totalPurchaseValue)}G`, inline: true },
            { name: '💹 총 현재가', value: `${formatNumber(totalCurrentValue)}G`, inline: true },
            { name: '📊 수익률', value: `${totalProfitRate > 0 ? '+' : ''}${totalProfitRate}%`, inline: true }
        );
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('warehouse_sell_selected')
                .setLabel('💰 선택 판매')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('warehouse_withdraw_selected')
                .setLabel('📤 인벤토리로')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('warehouse_main')
                .setLabel('🔙 창고로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [row, buttonRow]
    });
}

// 증서 발행
async function showCertificates(interaction) {
    // interactionHandler에서 이미 defer 처리됨
    
    const user = await getUser(interaction.user.id);
    const warehouseItems = user.appraisalWarehouse.items;
    
    const embed = new EmbedBuilder()
        .setColor('#ffdd44')
        .setTitle('📜 감정 증서 발행소')
        .setDescription('특정 조합의 아이템으로 고정가 증서를 발행할 수 있습니다.')
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723799/certificate.png');
    
    // 발행 가능한 증서 확인
    let availableCertificates = [];
    
    for (const [categoryName, category] of Object.entries(APPRAISAL_STOCK.certificates)) {
        for (const [certName, cert] of Object.entries(category)) {
            if (canCreateCertificate(warehouseItems, certName)) {
                availableCertificates.push({
                    name: certName,
                    ...cert,
                    category: categoryName
                });
            }
        }
    }
    
    if (availableCertificates.length === 0) {
        embed.addFields({
            name: '❌ 발행 가능한 증서 없음',
            value: '필요한 아이템 조합이 창고에 없습니다.'
        });
        
        // 증서 레시피 일부 표시
        let recipeText = '';
        const basicCerts = Object.entries(APPRAISAL_STOCK.certificates.basic).slice(0, 3);
        
        basicCerts.forEach(([name, cert]) => {
            recipeText += `**${name}** (${formatNumber(cert.value)}G)\n`;
            for (const [itemId, count] of Object.entries(cert.recipe)) {
                recipeText += `　• ${itemId} x${count}\n`;
            }
            recipeText += '\n';
        });
        
        embed.addFields({
            name: '📋 기본 증서 레시피',
            value: recipeText
        });
    } else {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('certificate_create_select')
            .setPlaceholder('📜 발행할 증서 선택');
        
        availableCertificates.slice(0, 25).forEach(cert => {
            selectMenu.addOptions({
                label: cert.name,
                description: `고정가: ${formatNumber(cert.value)}G | ${cert.description}`,
                value: cert.name,
                emoji: '📜'
            });
        });
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        embed.addFields({
            name: '✅ 발행 가능한 증서',
            value: `${availableCertificates.length}개의 증서를 발행할 수 있습니다.`
        });
        
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('warehouse_main')
                    .setLabel('🔙 창고로')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        return await interaction.editReply({
            embeds: [embed],
            components: [row, buttonRow]
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
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

module.exports = {
    showWarehouse,
    depositToWarehouse,
    executeDeposit,
    withdrawFromWarehouse,
    showCertificates
};