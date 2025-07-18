const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('댕댕테스트')
        .setDescription('댕댕봇 목걸이 이벤트 테스트')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const eventChannelId = '1386447256408035399';
        const channel = interaction.client.channels.cache.get(eventChannelId);
        
        if (!channel) {
            // interaction이 이미 defer된 경우 editReply 사용
            if (interaction.deferred) {
                return await interaction.editReply({
                    content: '❌ 이벤트 채널을 찾을 수 없습니다.'
                });
            } else {
                return await interaction.reply({
                    content: '❌ 이벤트 채널을 찾을 수 없습니다.',
                    ephemeral: true
                });
            }
        }
        
        // 1. 이벤트 시작 안내 임베드
        const startEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🚨 [긴급 이벤트] 댕댕봇의 목걸이 도둑을 잡아라! 🚨')
            .setDescription(
                `댕댕봇이 아끼던 목걸이가 도난당했습니다!\n` +
                `범인들이 김헌터 왕국 곳곳에 숨어있다는 제보가 들어왔습니다.\n\n` +
                `모든 헌터들이여, 도둑들을 찾아 처치하고\n` +
                `댕댕봇의 목걸이를 되찾아주세요!\n\n` +
                `⚔️ 도둑들은 1시간마다 나타납니다\n` +
                `🎁 목걸이를 찾으면 특별한 보상이!`
            )
            .addFields(
                { 
                    name: '🎁 참여 횟수 랭킹 보상 - 댕댕이의 우정 반지', 
                    value: 
                        `1등: **[신화 헌터]** (+15강)\n` +
                        `2등: **[히어로 헌터]** (+13강)\n` +
                        `3등: **[마스터 헌터]** (+10강)\n` +
                        `4등: **[엘리트 헌터]** (+8강)\n` +
                        `5등 이하: **[무계급]** (+0강)\n` +
                        `*옵션: 모든 스탯 +100*`,
                    inline: false 
                },
                {
                    name: '💰 누적 딜량 랭킹 보상',
                    value:
                        `1등: **20,000,000** 골드\n` +
                        `2등: **10,000,000** 골드\n` +
                        `3등: **5,000,000** 골드\n` +
                        `참가자 전원: **1,000,000** 골드`,
                    inline: false
                }
            )
            .setFooter({ text: '첫 도둑이 곧 나타납니다!' })
            .setTimestamp();
        
        await channel.send({ embeds: [startEmbed] });
        
        // 2. 잠시 후 보스 출현
        setTimeout(async () => {
            // 실제 유저 닉네임 가져오기
            const User = require('../../models/User');
            const users = await User.find({ registered: true }).select('nickname').lean();
            const randomUser = users.length > 0 
                ? users[Math.floor(Math.random() * users.length)]
                : { nickname: '알 수 없는 유저' };
            
            // HP 바 생성 (100%)
            const hpBar = '🟢 [████████████████████] 100%';
            const testBossHp = 150000; // 중급 보스 HP
            
            const bossEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚔️ 목걸이 도둑 출현! ⚔️')
                .setDescription(`# 🦝 **귀여운 도둑 ${randomUser.nickname}**\n\n` +
                    `**댕댕봇의 목걸이를 훔친 도둑이 나타났습니다!**\n` +
                    `**서둘러 도둑을 처치하고 목걸이를 되찾으세요!**\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
                .addFields(
                    { 
                        name: '📊 도둑 정보', 
                        value: `\`\`\`레벨: 중급\nHP: ${testBossHp.toLocaleString()}/${testBossHp.toLocaleString()}\n공격력: 200\n방어력: 100\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎯 참가 조건',
                        value: `\`\`\`즉시 공격 가능\n30분 후 도망감\n댕댕봇구출자 보너스\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎁 보상',
                        value: `\`\`\`참여 랭킹: 댕댕이의 우정 반지\n딜량 랭킹: 골드\n\n다음 도둑이 목걸이를\n가지고 있을 수도...?\`\`\``,
                        inline: true
                    },
                    {
                        name: '💔 체력 상태',
                        value: `\`\`\`diff\n${hpBar}\nHP: 35,000/35,000\n\`\`\``,
                        inline: false
                    }
                )
                .setFooter({ text: `⏰ 30분 후 자동으로 도망갑니다!` })
                .setTimestamp();
            
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('necklace_event_attack')
                        .setLabel('⚔️ 공격하기')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('necklace_event_ranking')
                        .setLabel('🏆 랭킹 확인')
                        .setStyle(ButtonStyle.Primary)
                );
            
            await channel.send({ embeds: [bossEmbed], components: [buttons] });
            
            // 3. 30분 후 현황 업데이트 예시
            setTimeout(async () => {
                // HP 바 생성 (약 43%)
                const hpBar = '🟡 [████████░░░░░░░░░░░░] 43%';
                const remainingHp = Math.floor(testBossHp * 0.43);
                
                const statusEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('📊 목걸이 도둑 잡기 이벤트 현황')
                    .setDescription(
                        `📊 **현재 이벤트 현황**\n\n` +
                        `🏃 현재 도둑: **귀여운 도둑 ${randomUser.nickname}**\n` +
                        `💔 HP 상태:\n\`\`\`diff\n${hpBar}\nHP: ${remainingHp.toLocaleString()}/${testBossHp.toLocaleString()}\n\`\`\`\n` +
                        `⏰ 남은 시간: 15분`
                    )
                    .setTimestamp();
                
                const statusButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('necklace_event_ranking')
                            .setLabel('🏆 랭킹 확인')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                await channel.send({ embeds: [statusEmbed], components: [statusButtons] });
            }, 5000); // 5초 후 현황 업데이트 (실제는 30분)
            
        }, 3000); // 3초 후 보스 출현
        
        // interaction이 이미 defer된 경우 editReply 사용
        if (interaction.deferred) {
            await interaction.editReply({
                content: '✅ 테스트 메시지를 이벤트 채널에 전송했습니다.'
            });
        } else {
            await interaction.reply({
                content: '✅ 테스트 메시지를 이벤트 채널에 전송했습니다.',
                ephemeral: true
            });
        }
    }
};