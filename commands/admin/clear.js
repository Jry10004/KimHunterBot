const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('청소')
        .setDescription('채널의 메시지를 삭제합니다')
        .addSubcommand(subcommand =>
            subcommand
                .setName('시간')
                .setDescription('특정 시간 이내의 메시지를 삭제합니다')
                .addIntegerOption(option =>
                    option.setName('시간')
                        .setDescription('삭제할 메시지의 시간 범위 (시간 단위)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(168))
                .addIntegerOption(option =>
                    option.setName('개수')
                        .setDescription('삭제할 메시지 개수 (기본값: 100)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(100)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('일')
                .setDescription('특정 일 이내의 메시지를 삭제합니다')
                .addIntegerOption(option =>
                    option.setName('일')
                        .setDescription('삭제할 메시지의 일 범위')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(7))
                .addIntegerOption(option =>
                    option.setName('개수')
                        .setDescription('삭제할 메시지 개수 (기본값: 100)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(100)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('개수')
                .setDescription('특정 개수의 메시지를 삭제합니다')
                .addIntegerOption(option =>
                    option.setName('개수')
                        .setDescription('삭제할 메시지 개수')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(100))),
    
    async execute(interaction) {
        // 관리자 권한 확인
        const adminIds = ['424480594542592009', '295980447849250817', '532128778175619084'];
        if (!adminIds.includes(interaction.user.id) && !interaction.member.permissions.has('ManageMessages')) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자나 메시지 관리 권한이 필요합니다!',
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

        const subcommand = interaction.options.getSubcommand();
        let messages;
        let count = 0;

        try {
            if (subcommand === '시간') {
                const hours = interaction.options.getInteger('시간');
                const limit = interaction.options.getInteger('개수') || 100;
                const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
                
                messages = await interaction.channel.messages.fetch({ limit: 100 });
                const toDelete = messages.filter(msg => msg.createdTimestamp > cutoffTime).first(limit);
                
                if (toDelete.length > 0) {
                    await interaction.channel.bulkDelete(toDelete, true);
                    count = toDelete.length;
                }
            }
            else if (subcommand === '일') {
                const days = interaction.options.getInteger('일');
                const limit = interaction.options.getInteger('개수') || 100;
                const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
                
                messages = await interaction.channel.messages.fetch({ limit: 100 });
                const toDelete = messages.filter(msg => msg.createdTimestamp > cutoffTime).first(limit);
                
                if (toDelete.length > 0) {
                    await interaction.channel.bulkDelete(toDelete, true);
                    count = toDelete.length;
                }
            }
            else if (subcommand === '개수') {
                const amount = interaction.options.getInteger('개수');
                messages = await interaction.channel.messages.fetch({ limit: amount });
                
                await interaction.channel.bulkDelete(messages, true);
                count = messages.size;
            }

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🧹 청소 완료!')
                .setDescription(`**${count}**개의 메시지가 삭제되었습니다.`)
                .setTimestamp()
                .setFooter({ text: `실행자: ${interaction.user.username}` });

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error('메시지 삭제 오류:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ 오류 발생')
                .setDescription('메시지 삭제 중 오류가 발생했습니다.')
                .addFields({
                    name: '가능한 원인',
                    value: '• 14일이 지난 메시지는 삭제할 수 없습니다\n• 봇에게 메시지 관리 권한이 없습니다'
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [errorEmbed]
            });
        }
    }
};