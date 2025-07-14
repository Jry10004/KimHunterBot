const { Client, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', async () => {
    console.log('봇이 준비되었습니다.');
    
    try {
        const channel = await client.channels.fetch('1388182808895291422');
        if (!channel) {
            console.log('채널을 찾을 수 없습니다.');
            client.destroy();
            return;
        }
        
        // 기존 메시지 모두 삭제
        const messages = await channel.messages.fetch({ limit: 100 });
        for (const message of messages.values()) {
            try {
                await message.delete();
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
            } catch (err) {
                console.log('메시지 삭제 실패:', err.message);
            }
        }
        
        console.log('기존 메시지 삭제 완료');
        
        // 새 엠블럼 메시지 생성
        const emblemEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 엠블럼 시스템')
            .setDescription(
                '**엠블럼을 선택하여 특별한 능력을 얻으세요!**\n\n' +
                '엠블럼은 캐릭터의 성장 방향을 결정하는 중요한 시스템입니다.\n' +
                '각 엠블럼은 고유한 보너스와 특수 능력을 제공합니다.\n\n' +
                '⚠️ **주의사항**\n' +
                '• 엠블럼은 한 번 선택하면 변경할 수 없습니다\n' +
                '• 신중하게 선택해주세요!'
            )
            .addFields(
                {
                    name: '⚔️ 전사의 길',
                    value: '물리 공격력과 체력에 특화\n근접 전투의 달인',
                    inline: true
                },
                {
                    name: '🏹 궁수의 길',
                    value: '치명타와 회피율에 특화\n원거리 공격의 달인',
                    inline: true
                },
                {
                    name: '🛡️ 수호자의 길',
                    value: '방어력과 체력에 특화\n팀의 든든한 방패',
                    inline: true
                },
                {
                    name: '✨ 마법사의 길',
                    value: '마법 공격력과 마나에 특화\n강력한 스킬 사용',
                    inline: true
                },
                {
                    name: '🗡️ 도적의 길',
                    value: '크리티컬과 회피에 특화\n빠른 연속 공격',
                    inline: true
                }
            )
            .setFooter({ text: '엠블럼을 선택하려면 아래 버튼을 클릭하세요' })
            .setTimestamp();

        const emblemButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('emblem_warrior')
                    .setLabel('⚔️ 전사')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('emblem_archer')
                    .setLabel('🏹 궁수')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('emblem_guardian')
                    .setLabel('🛡️ 수호자')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('emblem_mage')
                    .setLabel('✨ 마법사')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('emblem_rogue')
                    .setLabel('🗡️ 도적')
                    .setStyle(ButtonStyle.Primary)
            );

        await channel.send({
            embeds: [emblemEmbed],
            components: [emblemButtons]
        });
        
        console.log('엠블럼 메시지 전송 완료');
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        setTimeout(() => {
            client.destroy();
            console.log('봇 종료');
        }, 3000);
    }
});

client.login(process.env.BOT_TOKEN);