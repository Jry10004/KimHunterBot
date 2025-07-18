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
            // 이미 defer된 상태이므로 editReply 사용
            return await interaction.editReply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!'
            });
        }

        const message = interaction.options.getString('메시지');
        const targetChannels = [
            '1393529431271673997',
            '1394997869257162764',
            '1395073005696323665',
            '1391112529828384870',
            '1387550842554421378',
            '1393529432479633541'
        ];

        let successCount = 0;
        let failedChannels = [];

        try {
            // 각 채널에 메시지 전송
            for (const channelId of targetChannels) {
                try {
                    const channel = await interaction.client.channels.fetch(channelId);
                    if (channel && channel.isTextBased()) {
                        await channel.send(message);
                        successCount++;
                    } else {
                        failedChannels.push(channelId);
                    }
                } catch (error) {
                    console.error(`채널 ${channelId}에 메시지 전송 실패:`, error);
                    failedChannels.push(channelId);
                }
            }

            // 결과 응답
            let responseMessage = `✅ ${successCount}개 채널에 메시지를 전송했습니다!`;
            if (failedChannels.length > 0) {
                responseMessage += `\n⚠️ ${failedChannels.length}개 채널 전송 실패: ${failedChannels.join(', ')}`;
            }

            await interaction.editReply({
                content: responseMessage
            });

            // 로그
            console.log(`[말하기] ${interaction.user.username}이(가) ${successCount}개 채널에 메시지 전송: ${message.substring(0, 50)}...`);

        } catch (error) {
            console.error('메시지 전송 오류:', error);
            
            await interaction.editReply({
                content: '❌ 메시지 전송 중 오류가 발생했습니다.'
            });
        }
    }
};