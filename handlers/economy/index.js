const { showStockMarket, showRegionalStocks, showChainStocks, showExplorationStocks, showPlayerStocks, handleStockInteraction } = require('./stockMarket');
const { buyStock, sellStock } = require('./stockTrading');
const { showArtifactExplorationMenu, showDirectExplorationMenu, showExplorationModal, executeExploration, showArtifactInventory } = require('./artifactExploration');
const { showFragmentMenu, executeFragmentMining, executeAutoFusion, showFragmentExchange, showFragmentRanking } = require('./fragments');
const { showShopMenu, showRandomCategoryGacha, executeRandomGacha } = require('./shop');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

// 경제 시스템 인터랙션 핸들러
async function handleEconomyInteraction(interaction) {
    const customId = interaction.customId;
    
    // 주식 시장 관련
    if (customId === 'stocks' || customId === 'stock_menu') {
        try {
            console.log('[Economy] Stock menu button clicked');
            const { showStockMenu } = require('./stockMarket');
            return await showStockMenu(interaction);
        } catch (error) {
            console.error('[Economy] Stock menu error:', error);
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({ 
                    content: '❌ 주식 메뉴를 표시하는 중 오류가 발생했습니다.', 
                    flags: 64 
                });
            }
        }
    } else if (customId === 'stock_market') {
        return await showStockMarket(interaction);
    } else if (customId === 'stock_regions') {
        return await showRegionalStocks(interaction);
    } else if (customId === 'stock_chains') {
        return await showChainStocks(interaction);
    } else if (customId === 'stock_exploration') {
        return await showExplorationStocks(interaction);
    } else if (customId === 'stock_portfolio') {
        return await showPlayerStocks(interaction);
    } 
    // 새로운 주식 거래 핸들러 - 모든 stock_ 관련 처리
    else if (customId.startsWith('stock_')) {
        return await handleStockInteraction(interaction);
    }
    
    // 유물 탐사 관련
    else if (customId === 'artifact_exploration') {
        return await showArtifactExplorationMenu(interaction);
    } else if (customId === 'artifact_direct_explore') {
        return await showDirectExplorationMenu(interaction);
    } else if (customId.startsWith('explore_')) {
        const companyId = customId.replace('explore_', '');
        return await showExplorationModal(interaction, companyId);
    } else if (customId === 'artifact_inventory') {
        return await showArtifactInventory(interaction);
    } else if (customId.startsWith('artifact_') || customId.startsWith('mine_')) {
        // 유물 탐사 시스템의 일반 핸들러 호출
        const { handleArtifactInteraction } = require('./artifactExploration');
        return await handleArtifactInteraction(interaction);
    }
    
    // 에너지 조각 관련
    else if (customId === 'fragment_menu' || customId === 'fragments') {
        return await showFragmentMenu(interaction);
    } else if (customId === 'fragment_mine') {
        return await executeFragmentMining(interaction);
    } else if (customId === 'fragment_fusion') {
        return await executeAutoFusion(interaction);
    } else if (customId === 'fragment_exchange') {
        return await showFragmentExchange(interaction);
    } else if (customId === 'fragment_ranking') {
        return await showFragmentRanking(interaction);
    }
    
    // 상점 관련
    else if (customId === 'shop') {
        return await showShopMenu(interaction);
    } else if (customId.startsWith('random_category_')) {
        const category = customId.replace('random_category_', '');
        return await showRandomCategoryGacha(interaction, category);
    } else if (customId.startsWith('random_execute_')) {
        const category = customId.replace('random_execute_', '');
        console.log('[Shop Debug] Executing gacha for category:', category);
        return await executeRandomGacha(interaction, category);
    }
    
    // 드롭다운 메뉴 처리
    else if (interaction.isStringSelectMenu()) {
        if (customId === 'shop_category_select') {
            const selectedValue = interaction.values[0];
            console.log('[Shop Debug] Selected value:', selectedValue);
            
            // 랜덤 상점 선택 시
            if (selectedValue === 'random_shop') {
                const { showRandomShop } = require('./randomShop');
                return await showRandomShop(interaction);
            }
            
            // 랜덤 카테고리
            const category = selectedValue.replace('random_category_', '');
            console.log('[Shop Debug] Category:', category);
            return await showRandomCategoryGacha(interaction, category);
        } else if (customId === 'shop_item_select') {
            const itemId = interaction.values[0].replace('shop_buy_', '');
            return await showPurchaseConfirmation(interaction, itemId);
        } else if (customId === 'sector_select') {
            // 섹터 선택 처리
            const sector = interaction.values[0];
            const { showStockList } = require('./stockTrading');
            return await showStockList(interaction, sector);
        }
    }
}

// 경제 시스템 모달 핸들러
async function handleEconomyModal(interaction) {
    const customId = interaction.customId;
    
    // 주식 매수/매도 모달
    if (customId === 'stock_buy_select') {
        try {
            const companyId = interaction.fields.getTextInputValue('company_id');
            const shares = parseInt(interaction.fields.getTextInputValue('shares'));
            
            if (isNaN(shares) || shares <= 0) {
                return await interaction.reply({ 
                    content: '❌ 올바른 수량을 입력해주세요!', 
                    flags: 64 
                });
            }
            
            // deferUpdate 사용 (모달은 이미 응답된 상태이므로)
            await interaction.deferUpdate();
            
            const result = await buyStock(interaction, companyId, shares);
            
            if (result.success) {
                // 성공 메시지와 함께 포트폴리오 표시
                await interaction.followUp({ 
                    content: result.message,
                    flags: 64 
                });
                
                // 포트폴리오 업데이트
                const { showPlayerStocks } = require('./stockMarket');
                return await showPlayerStocks(interaction);
            } else {
                return await interaction.followUp({ 
                    content: result.message,
                    flags: 64
                });
            }
        } catch (error) {
            console.error('[Economy Modal] Buy error:', error);
            return await interaction.followUp({ 
                content: '❌ 처리 중 오류가 발생했습니다.', 
                flags: 64 
            });
        }
    } else if (customId === 'stock_sell_select') {
        try {
            const companyId = interaction.fields.getTextInputValue('company_id');
            const shares = parseInt(interaction.fields.getTextInputValue('shares'));
            
            if (isNaN(shares) || shares <= 0) {
                return await interaction.reply({ 
                    content: '❌ 올바른 수량을 입력해주세요!', 
                    flags: 64 
                });
            }
            
            // deferUpdate 사용 (모달은 이미 응답된 상태이므로)
            await interaction.deferUpdate();
            
            const result = await sellStock(interaction, companyId, shares);
            
            if (result.success) {
                // 성공 메시지와 함께 포트폴리오 표시
                await interaction.followUp({ 
                    content: result.message,
                    flags: 64 
                });
                
                // 포트폴리오 업데이트
                const { showPlayerStocks } = require('./stockMarket');
                return await showPlayerStocks(interaction);
            } else {
                return await interaction.followUp({ 
                    content: result.message,
                    flags: 64
                });
            }
        } catch (error) {
            console.error('[Economy Modal] Sell error:', error);
            return await interaction.followUp({ 
                content: '❌ 처리 중 오류가 발생했습니다.', 
                flags: 64 
            });
        }
    }
    
    // 유물 탐사 모달
    else if (customId.startsWith('exploration_modal_')) {
        const companyId = customId.replace('exploration_modal_', '');
        const investmentAmount = parseInt(interaction.fields.getTextInputValue('investment_amount'));
        
        if (isNaN(investmentAmount) || investmentAmount <= 0) {
            return await interaction.reply({ 
                content: '❌ 올바른 투자 금액을 입력해주세요!', 
                flags: 64 
            });
        }
        
        return await executeExploration(interaction, companyId, investmentAmount);
    }
}

// 주식 매수 모달 표시
async function showStockBuyModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('stock_buy_select')
        .setTitle('주식 매수');
    
    const companyInput = new TextInputBuilder()
        .setCustomId('company_id')
        .setLabel('기업 ID')
        .setPlaceholder('예: mystic_herb')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const sharesInput = new TextInputBuilder()
        .setCustomId('shares')
        .setLabel('매수 수량')
        .setPlaceholder('구매할 주식 수량')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(companyInput),
        new ActionRowBuilder().addComponents(sharesInput)
    );
    
    await interaction.showModal(modal);
}

// 주식 매도 모달 표시
async function showStockSellModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('stock_sell_select')
        .setTitle('주식 매도');
    
    const companyInput = new TextInputBuilder()
        .setCustomId('company_id')
        .setLabel('기업 ID')
        .setPlaceholder('예: mystic_herb')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    const sharesInput = new TextInputBuilder()
        .setCustomId('shares')
        .setLabel('매도 수량')
        .setPlaceholder('판매할 주식 수량')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(companyInput),
        new ActionRowBuilder().addComponents(sharesInput)
    );
    
    await interaction.showModal(modal);
}

module.exports = {
    handleEconomyInteraction,
    handleEconomyModal
};