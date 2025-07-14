const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('말')
        .setDescription('봇이 메시지를 전송합니다 (관리자 전용)')
        .addStringOption(option =>
            option.setName('메시지')
                .setDescription('봇이 전송할 메시지')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('채널')
                .setDescription('메시지를 전송할 채널 (비워두면 현재 채널)')
                .setRequired(false)
                .addChannelTypes(0, 5)), // 텍스트 채널과 공지 채널만
    
    async execute(interaction) {
        // 관리자 권한 확인
        const adminIds = ['424480594542592009', '295980447849250817', '532128778175619084'];
        if (!adminIds.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!',
                ephemeral: true
            });
        }

        const message = interaction.options.getString('메시지');
        const targetChannel = interaction.options.getChannel('채널') || interaction.channel;

        try {
            // 메시지 전송
            await targetChannel.send(message);

            // 성공 응답
            await interaction.reply({
                content: `✅ 메시지가 ${targetChannel.id === interaction.channel.id ? '현재 채널' : targetChannel.toString()}에 전송되었습니다!`,
                ephemeral: true
            });

            // 로그
            console.log(`[말하기] ${interaction.user.username}이(가) ${targetChannel.name}에 메시지 전송: ${message.substring(0, 50)}...`);

        } catch (error) {
            console.error('메시지 전송 오류:', error);
            
            await interaction.reply({
                content: '❌ 메시지 전송 중 오류가 발생했습니다. 봇이 해당 채널에 메시지를 보낼 권한이 있는지 확인해주세요.',
                ephemeral: true
            });
        }
    }
};