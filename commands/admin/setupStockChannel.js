const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../../handlers/common/utils');
const Stock = require('../../models/Stock');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('주식채널설정')
        .setDescription('[관리자] 주식 거래소 채널을 설정합니다')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        // 관리자 권한 확인
        if (!isAdmin(interaction.user.id)) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.channel;
            
            // 채널 이름 변경
            await channel.edit({
                name: '📈│주식거래소',
                topic: '실시간 주식 거래 | 📊 시세 갱신: 5분마다'
            });

            // 현재 주식 시세 가져오기
            const stocks = await Stock.find({});
            const stockFields = stocks.map(stock => {
                const trend = stock.history && stock.history.length > 1 
                    ? stock.currentPrice > stock.history[stock.history.length - 2].price ? '📈' : '📉'
                    : '➖';
                
                return {
                    name: `${stock.symbol} - ${stock.name}`,
                    value: `${trend} ${stock.currentPrice.toLocaleString()}G`,
                    inline: true
                };
            });

            // 주식 거래소 메인 임베드
            const stockEmbed = new EmbedBuilder()
                .setTitle('📈 김헌터 주식 거래소')
                .setDescription(
                    '**실시간 주식 거래가 가능한 거래소입니다!**\n\n' +
                    '주식을 매수/매도하여 수익을 창출하세요.\n' +
                    '시세는 5분마다 자동으로 갱신됩니다.'
                )
                .addFields(
                    {
                        name: '📊 거래 안내',
                        value: '• 거래 수수료: 0.3%\n' +
                               '• 시세 변동: ±20% (일일 최대)\n' +
                               '• 거래 시간: 24시간 연중무휴',
                        inline: false
                    },
                    {
                        name: '💰 현재 시세',
                        value: '아래 버튼을 클릭하여 상세 정보를 확인하세요.',
                        inline: false
                    }
                )
                .setColor('#4CAF50')
                .setFooter({ text: '마지막 업데이트' })
                .setTimestamp();

            // 주식 관련 버튼들
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stock_market')
                        .setLabel('📊 주식 시세')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('stock_portfolio')
                        .setLabel('💼 내 포트폴리오')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('stock_ranking')
                        .setLabel('🏆 주식 랭킹')
                        .setStyle(ButtonStyle.Secondary)
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stock_news')
                        .setLabel('📰 주식 뉴스')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('stock_help')
                        .setLabel('❓ 도움말')
                        .setStyle(ButtonStyle.Secondary)
                );

            // 메시지 전송
            const message = await channel.send({
                embeds: [stockEmbed],
                components: [row1, row2]
            });

            // 주기적인 시세 업데이트 설정을 위한 메시지 ID 저장
            await interaction.editReply({
                content: `✅ 주식 거래소 채널 설정이 완료되었습니다!\n` +
                        `채널: ${channel}\n` +
                        `메시지 ID: ${message.id}\n\n` +
                        `💡 시세는 5분마다 자동으로 업데이트됩니다.`
            });

            // 5분마다 시세 업데이트하는 함수를 별도로 구현해야 함
            // 이는 index.js의 client.on('ready') 이벤트에서 setInterval로 처리

        } catch (error) {
            console.error('주식 채널 설정 오류:', error);
            await interaction.editReply({
                content: '❌ 채널 설정 중 오류가 발생했습니다.'
            });
        }
    }
};