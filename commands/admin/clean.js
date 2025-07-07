const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

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
                        .setMaxValue(168)) // 최대 7일 (168시간)
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
                        .setMaxValue(7)) // Discord API는 14일 이상 된 메시지는 bulk delete 불가
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
                        .setMaxValue(100)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),

    async execute(interaction) {
        // 권한 확인
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: '❌ 이 명령어를 사용하려면 메시지 관리 권한이 필요합니다!',
                ephemeral: true
            });
        }

        // 봇의 권한 확인
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: '❌ 봇에게 메시지 관리 권한이 없습니다!',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const channel = interaction.channel;
        let messages;
        let deletedCount = 0;

        try {
            if (subcommand === '시간') {
                const hours = interaction.options.getInteger('시간');
                const limit = interaction.options.getInteger('개수') || 100;
                const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

                // 메시지 가져오기
                messages = await channel.messages.fetch({ limit: 100 });
                const messagesToDelete = [];

                for (const message of messages.values()) {
                    if (message.createdTimestamp > cutoffTime && messagesToDelete.length < limit) {
                        messagesToDelete.push(message);
                    }
                }

                // 메시지 삭제
                if (messagesToDelete.length > 0) {
                    const deleted = await channel.bulkDelete(messagesToDelete, true);
                    deletedCount = deleted.size;
                }

                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('🧹 채널 청소 완료')
                    .setDescription(`${hours}시간 이내의 메시지 ${deletedCount}개를 삭제했습니다.`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === '일') {
                const days = interaction.options.getInteger('일');
                const limit = interaction.options.getInteger('개수') || 100;
                const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

                // 메시지 가져오기
                messages = await channel.messages.fetch({ limit: 100 });
                const messagesToDelete = [];

                for (const message of messages.values()) {
                    if (message.createdTimestamp > cutoffTime && messagesToDelete.length < limit) {
                        messagesToDelete.push(message);
                    }
                }

                // 메시지 삭제
                if (messagesToDelete.length > 0) {
                    const deleted = await channel.bulkDelete(messagesToDelete, true);
                    deletedCount = deleted.size;
                }

                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('🧹 채널 청소 완료')
                    .setDescription(`${days}일 이내의 메시지 ${deletedCount}개를 삭제했습니다.`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });

            } else if (subcommand === '개수') {
                const count = interaction.options.getInteger('개수');

                // 메시지 가져오기 및 삭제
                messages = await channel.messages.fetch({ limit: count + 1 }); // +1은 명령어 메시지 포함
                
                // 명령어 메시지 제외
                const messagesToDelete = Array.from(messages.values()).filter(msg => msg.id !== interaction.id);
                
                if (messagesToDelete.length > 0) {
                    const deleted = await channel.bulkDelete(messagesToDelete.slice(0, count), true);
                    deletedCount = deleted.size;
                }

                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('🧹 채널 청소 완료')
                    .setDescription(`최근 메시지 ${deletedCount}개를 삭제했습니다.`)
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('[Clean Command] Error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ 청소 실패')
                .setDescription('메시지를 삭제하는 중 오류가 발생했습니다.')
                .addFields(
                    { 
                        name: '가능한 원인', 
                        value: '• 14일 이상 된 메시지는 삭제할 수 없습니다\n• 봇에게 권한이 없습니다\n• 네트워크 오류' 
                    }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};