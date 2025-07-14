const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../../handlers/common/utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('상점채널설정')
        .setDescription('[관리자] 상점 채널을 설정합니다')
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
                name: '🛒│상점',
                topic: '아이템 & 엠블럼 구매 | 💎 24시간 영업'
            });

            // 상점 메인 임베드
            const shopEmbed = new EmbedBuilder()
                .setTitle('🛒 김헌터 상점')
                .setDescription(
                    '**강화와 모험에 필요한 모든 것을 구매하세요!**\n\n' +
                    '아래 버튼을 클릭하여 원하는 상점을 방문하세요.'
                )
                .addFields(
                    {
                        name: '🛍️ 상점 카테고리',
                        value: '**🗡️ 장비 상점**: 무기, 방어구, 액세서리\n' +
                               '**🏺 유물 상점**: 특별한 능력을 가진 유물\n' +
                               '**💎 엠블럼 상점**: 직업별 특수 엠블럼\n' +
                               '**🧪 소모품 상점**: 물약, 버프 아이템\n' +
                               '**🎣 낚시 상점**: 낚싯대, 미끼',
                        inline: false
                    },
                    {
                        name: '💰 결제 수단',
                        value: '• 골드 (G)\n' +
                               '• 에너지 조각\n' +
                               '• 특별 화폐',
                        inline: true
                    },
                    {
                        name: '🎁 특별 혜택',
                        value: '• 일일 무료 아이템\n' +
                               '• VIP 할인\n' +
                               '• 한정 판매 상품',
                        inline: true
                    }
                )
                .setColor('#FF9800')
                .setImage('https://i.imgur.com/AfFp7pu.png') // 예시 이미지
                .setFooter({ text: '김헌터 상점 | 구매 전 아이템 정보를 확인하세요!' });

            // 상점 버튼들
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('shop')
                        .setLabel('🗡️ 장비 상점')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('artifact_shop')
                        .setLabel('🏺 유물 상점')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('emblem_shop')
                        .setLabel('💎 엠블럼 상점')
                        .setStyle(ButtonStyle.Primary)
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('consumable_shop')
                        .setLabel('🧪 소모품 상점')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('fishing_shop')
                        .setLabel('🎣 낚시 상점')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('shop_help')
                        .setLabel('❓ 상점 가이드')
                        .setStyle(ButtonStyle.Secondary)
                );

            // 메시지 전송
            const message = await channel.send({
                embeds: [shopEmbed],
                components: [row1, row2]
            });

            await interaction.editReply({
                content: `✅ 상점 채널 설정이 완료되었습니다!\n` +
                        `채널: ${channel}\n` +
                        `메시지 ID: ${message.id}`
            });

        } catch (error) {
            console.error('상점 채널 설정 오류:', error);
            await interaction.editReply({
                content: '❌ 채널 설정 중 오류가 발생했습니다.'
            });
        }
    }
};