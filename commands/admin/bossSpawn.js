const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const worldBossSystem = require('../../systems/worldBossSystem');
const BOSS_SYSTEM_SEASON2 = require('../../data/bossSystemSeason2');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('보스소환')
        .setDescription('특정 보스를 소환합니다 (관리자 전용)')
        .addStringOption(option =>
            option.setName('보스')
                .setDescription('소환할 보스를 선택하세요')
                .setRequired(true)
                .addChoices(
                    // 초급 보스 (일부)
                    { name: '🟢 슬라임 킹 (Lv.10)', value: 'slime_king' },
                    { name: '🐺 광포한 늑대 (Lv.15)', value: 'mad_wolf' },
                    { name: '👺 고블린 족장 (Lv.20)', value: 'goblin_chief' },
                    { name: '💀 해골 왕 (Lv.30)', value: 'skeleton_king' },
                    { name: '🌳 타락한 나무정령 (Lv.40)', value: 'corrupted_treant' },
                    { name: '❄️ 얼음 거인 (Lv.50)', value: 'ice_giant' },
                    { name: '🗡️ 그림자 암살자 (Lv.60)', value: 'shadow_assassin' },
                    { name: '⚡ 폭풍의 정령 (Lv.80)', value: 'storm_elemental' },
                    { name: '🔥 화염 드레이크 (Lv.85)', value: 'flame_drake' },
                    { name: '👹 데몬 로드 (Lv.100)', value: 'demon_lord' },
                    { name: '🐲 용의 수호자 (Lv.100)', value: 'dragon_guardian' },
                    // 중급 보스 (일부)
                    { name: '🐉 서리 드래곤 (Lv.110)', value: 'frost_dragon' },
                    { name: '🔥 화염 엘리멘탈 (Lv.120)', value: 'fire_elemental_lord' },
                    { name: '⚡ 번개 타이탄 (Lv.130)', value: 'lightning_titan' },
                    { name: '⚔️ 암흑 기사단장 (Lv.150)', value: 'dark_knight_commander' },
                    // 상급 보스 (일부)
                    { name: '🐉 고대 용왕 (Lv.210)', value: 'ancient_dragon_king' },
                    { name: '⚖️ 천계의 심판관 (Lv.220)', value: 'celestial_judge' },
                    { name: '💫 원소의 대정령 (Lv.240)', value: 'elemental_overlord' },
                    { name: '🌀 혼돈의 화신 (Lv.250)', value: 'chaos_incarnate' },
                    // 최상급 보스 (일부)
                    { name: '😇 타락한 천사장 (Lv.260)', value: 'fallen_archangel' },
                    { name: '🗿 고대 신의 화신 (Lv.270)', value: 'ancient_god_avatar' },
                    { name: '🌌 차원의 파괴자 (Lv.280)', value: 'dimension_destroyer' },
                    { name: '☄️ 종말의 예언자 (Lv.290)', value: 'apocalypse_prophet' },
                    { name: '⚡ 창조와 파괴의 신 (Lv.300)', value: 'creation_destruction_god' }
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

        // 월드 보스가 있는지 확인 (이벤트 보스는 별개로 허용)
        if (worldBossSystem.activeWorldBoss) {
            return interaction.editReply({
                content: '❌ 이미 월드 보스가 활성화되어 있습니다! 현재 보스를 처치하거나 /보스디버그 리셋을 사용하세요.'
            });
        }

        const selectedBossId = interaction.options.getString('보스');
        const bossData = BOSS_SYSTEM_SEASON2.bosses.find(boss => boss.id === selectedBossId);

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
                // 기본 채널 ID 사용
                const defaultChannelId = BOSS_SYSTEM_SEASON2.settings.channelId;
                const defaultChannel = interaction.client.channels.cache.get(defaultChannelId);
                
                if (!defaultChannel) {
                    return interaction.editReply({
                        content: '❌ 레이드 채널을 찾을 수 없습니다. 레이드/보스 채널을 먼저 생성해주세요.'
                    });
                }
                
                raidChannel = defaultChannel;
            }

            // 선택한 보스로 강제 설정
            worldBossSystem.lastSpawnTime = 0; // 쿨다운 무시
            worldBossSystem.READY_PARTICIPANTS.clear(); // 준비 상태 초기화
            
            // 기존 시스템과 동일한 임베드 형식 사용
            const spawnMessage = bossData.spawnMessage || '거대한 그림자가 나타났습니다!\n서둘러 파티를 구성하여 토벌하세요!';
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚔️ 보스 레이드 ⚔️')
                .setDescription(`# ${bossData.emoji} **${bossData.name}**\n\n` +
                    `**${spawnMessage}**\n\n` +
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
                        value: `\`\`\`1등: 엠블럼강화조각 3개\n2등: 엠블럼강화조각 2개\n3등: 엠블럼강화조각 1개\n4등 이하: 엠블럼강화조각 0.5개\n전원: 골드 ${bossData.rewards.gold.toLocaleString()}\n경험치 ${bossData.rewards.exp.toLocaleString()}\`\`\``,
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
                embeds: [embed],
                components: [row]
            });

            worldBossSystem.activeWorldBoss.messageId = message.id;
            worldBossSystem.lastSpawnTime = Date.now();
            
            // 보스 상태 저장
            await worldBossSystem.saveLastSpawnTime();

            await interaction.editReply({
                content: `✅ **${bossData.name}**이(가) 성공적으로 소환되었습니다!\n📍 채널: ${raidChannel}`
            });

            // 30분 후 자동으로 보스 떠남 (참가자가 없을 경우)
            // 최소 5분은 대기하도록 수정
            worldBossSystem.activeWorldBoss.timeoutId = setTimeout(async () => {
                console.log('[BossSpawn] 30분 타임아웃 체크 - 참가자 수:', worldBossSystem.activeWorldBoss?.participants?.length || 0);
                if (worldBossSystem.activeWorldBoss && worldBossSystem.activeWorldBoss.participants.length === 0) {
                    const timeSinceSpawn = Date.now() - worldBossSystem.activeWorldBoss.startTime;
                    console.log('[BossSpawn] 소환 후 경과 시간:', Math.floor(timeSinceSpawn / 60000), '분');
                    // 최소 5분(300000ms) 이상 지났을 때만 despawn
                    if (timeSinceSpawn >= 300000) {
                        console.log('[BossSpawn] 5분 이상 경과, 보스 제거');
                        await worldBossSystem.despawnBoss(interaction.client, '시간이 초과되어 보스가 떠났습니다.');
                    } else {
                        console.log('[BossSpawn] 아직 5분 미만, 보스 유지');
                    }
                }
            }, 30 * 60 * 1000); // 30분

        } catch (error) {
            console.error('보스 소환 오류:', error);
            await interaction.editReply({
                content: '❌ 보스 소환 중 오류가 발생했습니다.'
            });
        }
    }
};