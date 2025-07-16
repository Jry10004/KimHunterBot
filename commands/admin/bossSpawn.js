const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const worldBossSystem = require('../../systems/worldBossSystem');
const BOSS_SYSTEM = require('../../data/bossSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('보스소환')
        .setDescription('특정 보스를 소환합니다 (관리자 전용)')
        .addStringOption(option =>
            option.setName('보스')
                .setDescription('소환할 보스를 선택하세요')
                .setRequired(true)
                .addChoices(
                    { name: '👺 고블린 족장', value: 'goblin_chief' },
                    { name: '💀 해골 왕', value: 'skeleton_king' },
                    { name: '🗡️ 그림자 암살자', value: 'shadow_assassin' },
                    { name: '👹 데몬 로드', value: 'demon_lord' },
                    { name: '🗿 고대 골렘', value: 'ancient_golem' },
                    { name: '🐉 서리 드래곤', value: 'frost_dragon' },
                    { name: '🔥 화염 엘리멘탈', value: 'fire_elemental' }
                )
        ),
    
    async execute(interaction) {
        // 관리자 권한 확인
        if (!interaction.member.permissions.has('Administrator')) {
            if (interaction.deferred) {
                return interaction.editReply({ 
                    content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.'
                });
            } else {
                return interaction.reply({ 
                    content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', 
                    flags: 64 
                });
            }
        }

        // 활성 보스가 있는지 확인
        if (worldBossSystem.activeWorldBoss) {
            return interaction.editReply({
                content: '❌ 이미 활성화된 보스가 있습니다! 현재 보스를 처치하거나 /보스디버그 리셋을 사용하세요.'
            });
        }

        const selectedBossId = interaction.options.getString('보스');
        const bossData = BOSS_SYSTEM.bosses.find(boss => boss.id === selectedBossId);

        if (!bossData) {
            return interaction.editReply({
                content: '❌ 선택한 보스를 찾을 수 없습니다.'
            });
        }

        // 보스 소환
        try {
            // 채널 찾기
            const raidChannel = interaction.client.channels.cache.find(ch => 
                ch.name.includes('레이드') || ch.name.includes('raid') || ch.name.includes('보스')
            );

            if (!raidChannel) {
                return interaction.editReply({
                    content: '❌ 레이드 채널을 찾을 수 없습니다. 레이드/보스 채널을 먼저 생성해주세요.'
                });
            }

            // 선택한 보스로 강제 설정
            worldBossSystem.lastSpawnTime = 0; // 쿨다운 무시
            worldBossSystem.READY_PARTICIPANTS.clear(); // 준비 상태 초기화
            
            // 기존 시스템과 동일한 임베드 형식 사용
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚔️ 보스 레이드 ⚔️')
                .setDescription(`# ${bossData.emoji} **${bossData.name}**\n\n` +
                    `**거대한 그림자가 나타났습니다!**\n` +
                    `서둘러 파티를 구성하여 토벌하세요!\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
                .addFields(
                    { 
                        name: '📊 보스 정보', 
                        value: `\`\`\`레벨: ${bossData.level}\nHP: ${bossData.hp.toLocaleString()}\n공격력: ${bossData.attack}\n방어력: ${bossData.defense}\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎯 참가 조건',
                        value: `\`\`\`최소 레벨: ${bossData.requiredLevel}\n최소 인원: ${worldBossSystem.MIN_PARTICIPANTS}명\n최대 인원: ${worldBossSystem.MAX_PARTICIPANTS}명\n선착순 모집\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎁 보상',
                        value: `\`\`\`1등: 엠블럼강화조각 3개\n2등: 엠블럼강화조각 2개\n3등: 엠블럼강화조각 1개\n골드 & 경험치\`\`\``,
                        inline: true
                    },
                    {
                        name: '⏱️ 파티 모집중',
                        value: `\`\`\`diff\n- 참가자 대기중 (0/${worldBossSystem.MAX_PARTICIPANTS})\n\`\`\``,
                        inline: false
                    }
                )
                .setThumbnail(null)
                .setTimestamp()
                .setFooter({ text: `⚠️ 모든 참가자가 준비 완료하면 자동으로 시작됩니다!` });

            // 직접 보스 객체 생성
            worldBossSystem.activeWorldBoss = {
                boss: bossData,
                currentHp: bossData.hp,
                maxHp: bossData.hp,
                participants: [],
                startTime: Date.now(),
                messageId: null,
                channelId: raidChannel.id
            };

            // 버튼 생성 (기존 시스템과 동일)
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('world_boss_join')
                        .setLabel('참가')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⚔️'),
                    new ButtonBuilder()
                        .setCustomId('world_boss_leave')
                        .setLabel('나가기')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🚪')
                );

            const message = await raidChannel.send({
                content: '@everyone',
                embeds: [embed],
                components: [row]
            });

            worldBossSystem.activeWorldBoss.messageId = message.id;
            worldBossSystem.lastSpawnTime = Date.now();

            await interaction.editReply({
                content: `✅ **${bossData.name}**이(가) 성공적으로 소환되었습니다!\n📍 채널: ${raidChannel}`
            });

            // 자동 시작 타이머 설정
            if (worldBossSystem.AUTO_START_TIMER) {
                clearTimeout(worldBossSystem.AUTO_START_TIMER);
            }
            worldBossSystem.AUTO_START_TIMER = setTimeout(() => {
                if (worldBossSystem.READY_PARTICIPANTS.size >= worldBossSystem.MIN_PARTICIPANTS) {
                    worldBossSystem.startBossBattle(interaction.client);
                }
            }, worldBossSystem.READY_TIMEOUT);

        } catch (error) {
            console.error('보스 소환 오류:', error);
            await interaction.editReply({
                content: '❌ 보스 소환 중 오류가 발생했습니다.'
            });
        }
    }
};