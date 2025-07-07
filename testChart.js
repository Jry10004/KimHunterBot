const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getProfessionalChartUrl, generateChartData } = require('./data/chartService');
const marketPriceService = require('./services/MarketPriceService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('차트테스트')
        .setDescription('시장 차트 생성을 테스트합니다')
        .addStringOption(option =>
            option.setName('타입')
                .setDescription('차트 타입')
                .setRequired(true)
                .addChoices(
                    { name: '주식', value: 'stock' },
                    { name: '물고기', value: 'fish' },
                    { name: '전리품', value: 'loot' }
                ))
        .addStringOption(option =>
            option.setName('아이템')
                .setDescription('아이템 ID (예: tuna, slime_jelly)')
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const type = interaction.options.getString('타입');
        const itemId = interaction.options.getString('아이템');
        
        try {
            let chartUrl;
            let title;
            
            if (type === 'stock') {
                // 주식 차트 테스트
                const testStock = {
                    id: 'test_stock',
                    name: '테스트 주식회사',
                    symbol: 'TEST',
                    price: 100000
                };
                
                const history = await marketPriceService.getStockPriceHistory('kimhunter_guild', 24);
                const chartData = generateChartData(
                    testStock.id,
                    testStock.name,
                    testStock.symbol,
                    testStock.price,
                    history,
                    20
                );
                
                chartUrl = getProfessionalChartUrl({
                    name: testStock.name,
                    symbol: testStock.symbol,
                    prices: chartData.prices,
                    labels: chartData.labels,
                    currentPrice: testStock.price,
                    changePercent: chartData.trendPercent,
                    volume: 50000
                });
                
                title = '📈 주식 차트 테스트';
                
            } else if (type === 'fish') {
                // 물고기 차트 테스트
                const fishId = itemId || 'tuna';
                const history = await marketPriceService.getItemPriceHistory(fishId, 24);
                
                const testFish = {
                    id: fishId,
                    name: '참치',
                    symbol: 'TUNA',
                    price: 25000
                };
                
                const chartData = generateChartData(
                    testFish.id,
                    testFish.name,
                    testFish.symbol,
                    testFish.price,
                    history,
                    24
                );
                
                chartUrl = getProfessionalChartUrl({
                    name: testFish.name,
                    symbol: testFish.symbol,
                    prices: chartData.prices,
                    labels: chartData.labels,
                    currentPrice: testFish.price,
                    changePercent: chartData.trendPercent,
                    volume: 100
                });
                
                title = '🐟 물고기 차트 테스트';
                
            } else if (type === 'loot') {
                // 전리품 차트 테스트
                const lootId = itemId || 'slime_jelly';
                const history = await marketPriceService.getItemPriceHistory(lootId, 48);
                
                const testLoot = {
                    id: lootId,
                    name: '슬라임 젤리',
                    symbol: 'SLIME',
                    price: 1000
                };
                
                const chartData = generateChartData(
                    testLoot.id,
                    testLoot.name,
                    testLoot.symbol,
                    testLoot.price,
                    history,
                    20
                );
                
                chartUrl = getProfessionalChartUrl({
                    name: testLoot.name,
                    symbol: testLoot.symbol,
                    prices: chartData.prices,
                    labels: chartData.labels,
                    currentPrice: testLoot.price,
                    changePercent: chartData.trendPercent,
                    volume: 5000
                });
                
                title = '🎯 전리품 차트 테스트';
            }
            
            const embed = new EmbedBuilder()
                .setColor('#1E88E5')
                .setTitle(title)
                .setDescription('차트가 정상적으로 생성되었습니다.')
                .setImage(chartUrl)
                .addFields(
                    { name: '차트 URL 길이', value: `${chartUrl.length}자`, inline: true },
                    { name: '차트 타입', value: type, inline: true }
                )
                .setTimestamp();
            
            await interaction.editReply({
                embeds: [embed]
            });
            
        } catch (error) {
            console.error('차트 테스트 오류:', error);
            await interaction.editReply({
                content: `차트 생성 중 오류가 발생했습니다: ${error.message}`
            });
        }
    }
};