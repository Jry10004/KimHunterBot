const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
// 개선된 보스 시스템 사용
const BOSS_SYSTEM = require('../data/bossSystemSeason2');
const BOSS_FRAGMENTS = require('../data/bossFragments');
const buffSystem = require('../handlers/common/buffSystem');
const { 
    calculateBossRaidDamage,
    applyWarriorDamageReduction,
    calculateDefenderShield,
    calculateDefenderDamageReduction,
    calculateDefenderCounterAttack,
    calculateThiefDodgeCounter
} = require('../handlers/common/damageCalculator');
const gameConfig = require('../config/gameConfig');
const { MAX_LEVEL, canGainExperience, addExperienceSafely } = require('../utils/levelCapHelper');
const path = require('path');

class WorldBossSystem {
    constructor() {
        this.activeWorldBoss = null;
        this.lastSpawnTime = this.loadLastSpawnTime(); // 마지막 소환 시간 불러오기
        this.SPAWN_CHANNEL_ID = BOSS_SYSTEM.settings?.channelId || '1391112529828384870';
        this.SPAWN_COOLDOWN = BOSS_SYSTEM.settings?.spawnInterval || gameConfig.bossRaid.spawnInterval || 60 * 60 * 1000; // 1시간
        this.MAX_PARTICIPANTS = BOSS_SYSTEM.settings?.maxParticipants || gameConfig.bossRaid.maxParticipants || 20;
        this.MIN_PARTICIPANTS = BOSS_SYSTEM.settings?.minParticipants || gameConfig.bossRaid.minParticipants || 2;
        this.AUTO_START_TIMER = null;
        this.READY_PARTICIPANTS = new Set();
        this.READY_TIMEOUT = 30000; // 30초
        this.STATE_FILE = path.join(__dirname, '..', 'data', 'bossState.json');
        this.spawnCheckInterval = null; // 자동 소환 체크 인터벌
        
        // 저장된 활성 보스 상태 복원
        this.loadBossState();
        
        console.log('[Boss] 보스 시스템 초기화');
        console.log('[Boss] 보스 수:', BOSS_SYSTEM.bosses.length);
        console.log('[Boss] 채널 ID:', this.SPAWN_CHANNEL_ID);
        console.log('[Boss] 소환 간격:', Math.floor(this.SPAWN_COOLDOWN / 60000), '분');
        console.log('[Boss] 활성 보스:', this.activeWorldBoss ? this.activeWorldBoss.boss.name : '없음');
    }

    // 캐릭터의 실제 총 공격력 계산
    calculateTotalAttack(user) {
        let totalAttack = user.attack || 10; // 기본 공격력
        
        // 스탯 기반 공격력 추가
        if (user.stats && user.stats.strength) {
            totalAttack += user.stats.strength * 2; // 힘 스탯당 공격력 2 증가
        }
        
        // 장비 공격력 추가
        if (user.inventory && user.equipment) {
            Object.entries(user.equipment).forEach(([slot, index]) => {
                if (index >= 0 && user.inventory[index]) {
                    const item = user.inventory[index];
                    if (item.stats?.attack) {
                        totalAttack += item.stats.attack;
                        // 강화 보너스
                        if (item.enhancement) {
                            totalAttack += item.enhancement * 10;
                        }
                    }
                }
            });
        }
        
        // 장신구 공격력 추가
        if (user.equippedAccessories) {
            Object.values(user.equippedAccessories).forEach(accessory => {
                if (accessory && accessory.stats) {
                    const stats = accessory.stats instanceof Map ? Object.fromEntries(accessory.stats) : accessory.stats;
                    totalAttack += stats.attack || 0;
                }
            });
        }
        
        return totalAttack;
    }

    // 캐릭터의 실제 총 방어력 계산
    calculateTotalDefense(user) {
        let totalDefense = user.defense || 10; // 기본 방어력
        
        // 스탯 기반 방어력 추가
        if (user.stats && user.stats.vitality) {
            totalDefense += user.stats.vitality * 2; // 체력 스탯당 방어력 2 증가
        }
        
        // 장비 방어력 추가
        if (user.inventory && user.equipment) {
            Object.entries(user.equipment).forEach(([slot, index]) => {
                if (index >= 0 && user.inventory[index]) {
                    const item = user.inventory[index];
                    if (item.stats?.defense) {
                        totalDefense += item.stats.defense;
                        // 강화 보너스
                        if (item.enhancement) {
                            totalDefense += item.enhancement * 10;
                        }
                    }
                }
            });
        }
        
        // 장신구 방어력 추가
        if (user.equippedAccessories) {
            Object.values(user.equippedAccessories).forEach(accessory => {
                if (accessory && accessory.stats) {
                    const stats = accessory.stats instanceof Map ? Object.fromEntries(accessory.stats) : accessory.stats;
                    totalDefense += stats.defense || 0;
                }
            });
        }
        
        return totalDefense;
    }

    // 보스 소환 가능 여부 체크
    // 보스 레벨에 따른 보상 배율 계산
    getLevelMultiplier(bossLevel) {
        // rewardMultipliers가 없으므로 레벨 기반으로 계산
        if (bossLevel >= 200) return 3.0;
        if (bossLevel >= 150) return 2.5;
        if (bossLevel >= 100) return 2.0;
        if (bossLevel >= 50) return 1.5;
        return 1.0;
    }

    async canSpawnBoss() {
        const now = Date.now();
        const timeSinceLastSpawn = now - this.lastSpawnTime;
        
        // 이미 활성 보스가 있으면 소환 불가
        if (this.activeWorldBoss) {
            console.log('[Boss] 현재 활성 보스가 있어 소환할 수 없습니다.');
            return false;
        }
        
        // 쿨다운 확인
        if (timeSinceLastSpawn < this.SPAWN_COOLDOWN) {
            console.log('[Boss] 아직 소환 쿨다운 중입니다.');
            return false;
        }
        
        // 이벤트 보스와 일반 보스는 동시에 존재 가능
        // 단, 같은 타입의 보스 2마리는 불가 (이미 위에서 activeWorldBoss 체크로 처리됨)
        
        console.log('[Boss Debug] canSpawnBoss check:', {
            hasActiveBoss: !!this.activeWorldBoss,
            lastSpawnTime: new Date(this.lastSpawnTime).toISOString(),
            timeSinceLastSpawn: Math.floor(timeSinceLastSpawn / 1000 / 60) + ' minutes',
            spawnCooldown: Math.floor(this.SPAWN_COOLDOWN / 1000 / 60) + ' minutes',
            canSpawn: true
        });
        
        return true;
    }


    // 랜덤 보스 소환
    async spawnRandomBoss(client) {
        console.log('[Boss Debug] spawnRandomBoss - attempting to spawn boss');
        console.log('[Boss Debug] spawnRandomBoss - activeWorldBoss before:', this.activeWorldBoss ? 'exists' : 'null');
        
        // 중복 소환 방지를 위한 추가 체크
        if (this.activeWorldBoss) {
            console.log('[Boss] 이미 활성 보스가 존재하여 소환을 취소합니다.');
            return false;
        }
        
        if (!(await this.canSpawnBoss())) {
            console.log('[Boss Debug] spawnRandomBoss - canSpawnBoss returned false');
            return false;
        }

        try {
            const channel = await client.channels.fetch(this.SPAWN_CHANNEL_ID);
            if (!channel) {
                console.error('[Boss] 채널을 찾을 수 없습니다:', this.SPAWN_CHANNEL_ID);
                return false;
            }

            // 서버 평균 레벨 계산
            const users = await User.find({ registered: true }).select('level');
            const avgLevel = users.length > 0 
                ? Math.floor(users.reduce((sum, user) => sum + (user.level || 1), 0) / users.length)
                : 50;
            
            console.log('[Boss Debug] 서버 평균 레벨:', avgLevel);
            console.log('[Boss Debug] 전체 보스 수:', BOSS_SYSTEM.bosses.length);
            
            // 평균 레벨에 맞는 보스 필터링 (±30 레벨 범위)
            const suitableBosses = BOSS_SYSTEM.bosses.filter(boss => 
                boss.requiredLevel <= avgLevel + 20 && 
                boss.requiredLevel >= Math.max(1, avgLevel - 30)
            );
            
            console.log('[Boss Debug] 적합한 보스 수:', suitableBosses.length);
            if (suitableBosses.length > 0) {
                console.log('[Boss Debug] 적합한 보스들:', suitableBosses.map(b => `${b.name}(Lv.${b.level})`).join(', '));
            }
            
            // 적절한 보스가 없으면 전체에서 선택
            const bossPool = suitableBosses.length > 0 ? suitableBosses : BOSS_SYSTEM.bosses;
            
            // 랜덤 보스 선택
            const randomBoss = bossPool[Math.floor(Math.random() * bossPool.length)];
            
            console.log('[Boss Debug] 선택된 보스:', randomBoss.name, 'Lv.', randomBoss.level);
            
            // 보스 데이터 생성
            this.activeWorldBoss = {
                boss: {
                    ...randomBoss,
                    hp: randomBoss.hp || 10000,
                    attack: randomBoss.attack || 100,
                    defense: randomBoss.defense || 50,
                    level: randomBoss.level || 50,
                    requiredLevel: randomBoss.requiredLevel || 20,
                    emoji: randomBoss.emoji || '👹',
                    name: randomBoss.name || '미지의 보스',
                    rewards: randomBoss.rewards || { gold: 5000, exp: 1000 }
                },
                participants: [],
                startTime: Date.now(),
                totalDamage: 0,
                currentHp: randomBoss.hp || 10000,
                maxHp: randomBoss.hp || 10000,
                messageId: null,
                channelId: this.SPAWN_CHANNEL_ID
            };

            // 보스 소환 임베드
            const spawnMessage = randomBoss.spawnMessage || '거대한 그림자가 나타났습니다!\n서둘러 파티를 구성하여 토벌하세요!';
            const spawnEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚔️ 보스 레이드 ⚔️')
                .setDescription(`# ${randomBoss.emoji} **${randomBoss.name}**\n\n` +
                    `**${spawnMessage}**\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
                .addFields(
                    { 
                        name: '📊 보스 정보', 
                        value: `\`\`\`레벨: ${randomBoss.level}\nHP: ${randomBoss.hp.toLocaleString()}\n공격력: ${randomBoss.attack}\n방어력: ${randomBoss.defense}\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎯 참가 조건',
                        value: `\`\`\`최소 레벨: ${randomBoss.requiredLevel}\n최소 인원: ${this.MIN_PARTICIPANTS}명\n최대 인원: ${this.MAX_PARTICIPANTS}명\n선착순 모집\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎁 보상',
                        value: `\`\`\`보스 레벨: ${randomBoss.level}\n레벨 보너스: x${this.getLevelMultiplier(randomBoss.level)}\n\n1등: 엠블럼강화조각 ${5 * this.getLevelMultiplier(randomBoss.level)}개\n2등: 엠블럼강화조각 ${3 * this.getLevelMultiplier(randomBoss.level)}개\n3등: 엠블럼강화조각 ${2 * this.getLevelMultiplier(randomBoss.level)}개\n전원: 골드 & 경험치\`\`\``,
                        inline: true
                    },
                    {
                        name: '⏱️ 파티 모집중',
                        value: `\`\`\`diff\n- 참가자 대기중 (${this.activeWorldBoss.participants.length}/${this.MAX_PARTICIPANTS})\n\`\`\``,
                        inline: false
                    }
                )
                .setThumbnail(null)
                .setTimestamp()
                .setFooter({ text: `⚠️ 모든 참가자가 준비 완료하면 자동으로 시작됩니다!` });

            const joinButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('world_boss_join')
                        .setLabel('⚔️ 보스 레이드 참가')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗡️'),
                    new ButtonBuilder()
                        .setCustomId('world_boss_ready')
                        .setLabel('✅ 준비 완료')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId('world_boss_leave')
                        .setLabel('🚪 대기열 나가기')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌')
                );

            const message = await channel.send({
                embeds: [spawnEmbed],
                components: [joinButton]
            });

            this.activeWorldBoss.messageId = message.id;
            this.lastSpawnTime = Date.now();
        this.saveLastSpawnTime(); // 소환 시간 저장

            console.log(`[Boss] ${randomBoss.name} 소환됨!`);
            
            // 30분 후 자동으로 보스 떠남 (참가자가 없을 경우)
            // 최소 5분은 대기하도록 수정
            this.activeWorldBoss.timeoutId = setTimeout(async () => {
                console.log('[Boss] 30분 타임아웃 체크 - 참가자 수:', this.activeWorldBoss?.participants?.length || 0);
                if (this.activeWorldBoss && this.activeWorldBoss.participants.length === 0) {
                    const timeSinceSpawn = Date.now() - this.activeWorldBoss.startTime;
                    console.log('[Boss] 소환 후 경과 시간:', Math.floor(timeSinceSpawn / 60000), '분');
                    // 최소 5분(300000ms) 이상 지났을 때만 despawn
                    if (timeSinceSpawn >= 300000) {
                        console.log('[Boss] 5분 이상 경과, 보스 제거');
                        await this.despawnBoss(client, '시간이 초과되어 보스가 떠났습니다.');
                    } else {
                        console.log('[Boss] 아직 5분 미만, 보스 유지');
                    }
                }
            }, 30 * 60 * 1000); // 30분
            
            return true;

        } catch (error) {
            console.error('[Boss] 보스 소환 중 오류:', error);
            return false;
        }
    }

    // HP 바 생성
    createHPBar(percentage) {
        const barLength = 20;
        const filledLength = Math.floor((percentage / 100) * barLength);
        const emptyLength = barLength - filledLength;
        
        const filledBar = '█'.repeat(filledLength);
        const emptyBar = '░'.repeat(emptyLength);
        
        let color;
        if (percentage > 60) color = '🟢';
        else if (percentage > 30) color = '🟡';
        else color = '🔴';
        
        return `${color} [${filledBar}${emptyBar}] ${percentage}%`;
    }

    // 대기열 나가기
    async leaveBossRaid(interaction) {
        // interactionHandler에서 이미 deferUpdate를 했으므로 defer 스킵
        
        if (!this.activeWorldBoss) {
            return interaction.editReply({
                content: '❌ 현재 진행중인 보스가 없습니다!'
            });
        }

        const userId = interaction.user.id;
        
        // 참가자 목록에서 제거
        const participantIndex = this.activeWorldBoss.participants.findIndex(p => p.userId === userId);
        if (participantIndex === -1) {
            return interaction.editReply({
                content: '❌ 레이드에 참가하지 않았습니다!'
            });
        }

        // 참가자 제거
        this.activeWorldBoss.participants.splice(participantIndex, 1);
        
        // 준비 상태에서도 제거
        this.READY_PARTICIPANTS.delete(userId);
        
        // 자동 시작 타이머가 있다면 취소
        if (this.AUTO_START_TIMER) {
            clearTimeout(this.AUTO_START_TIMER);
            this.AUTO_START_TIMER = null;
        }

        // 임베드 업데이트
        await this.updateBossEmbed(interaction);

        await interaction.editReply({
            content: `✅ **${interaction.user.username}**님이 보스 레이드 대기열에서 나갔습니다. (${this.activeWorldBoss.participants.length}/${this.MAX_PARTICIPANTS})`
        });
    }

    // 보스 레이드 참가
    async joinBossRaid(interaction) {
        console.log('[Boss Debug] joinBossRaid - activeWorldBoss:', this.activeWorldBoss ? 'exists' : 'null');
        console.log('[Boss Debug] joinBossRaid - this instance:', this.constructor.name);
        
        // interactionHandler에서 이미 deferUpdate를 했으므로 defer 스킵
        
        if (!this.activeWorldBoss) {
            return interaction.editReply({
                content: '❌ 현재 진행중인 보스가 없습니다!'
            });
        }

        const userId = interaction.user.id;
        
        // 이미 참가했는지 확인
        if (this.activeWorldBoss.participants.some(p => p.userId === userId)) {
            return interaction.editReply({
                content: '❌ 이미 레이드에 참가하셨습니다!'
            });
        }

        // 최대 인원 확인
        if (this.activeWorldBoss.participants.length >= this.MAX_PARTICIPANTS) {
            return interaction.editReply({
                content: `❌ 레이드 참가 인원이 가득 찼습니다! (${this.MAX_PARTICIPANTS}/${this.MAX_PARTICIPANTS})`
            });
        }

        // 유저 정보 확인
        const user = await User.findOne({ discordId: userId });
        if (!user) {
            return interaction.editReply({
                content: '❌ 먼저 회원가입을 해주세요!'
            });
        }

        // 레벨 확인
        if (user.level < this.activeWorldBoss.boss.requiredLevel) {
            return interaction.editReply({
                content: `❌ 레벨 ${this.activeWorldBoss.boss.requiredLevel} 이상이 되어야 참가할 수 있습니다!`
            });
        }

        // 참가자 추가 (실제 캐릭터 체력 사용)
        // health는 기본 체력값, 실제 최대 HP 계산
        const baseHealth = user.health || 100;
        const vitalityBonus = (user.stats?.vitality || 10) * 10; // 체력 스탯당 10 HP
        const levelBonus = user.level * 20; // 레벨당 20 HP
        const userMaxHp = baseHealth + vitalityBonus + levelBonus;
        
        // 유저 객체 복사본 생성 (MongoDB 문서 문제 방지)
        const userCopy = {
            discordId: user.discordId,
            nickname: user.nickname,
            level: user.level,
            stats: user.stats ? { ...user.stats } : { strength: 10, agility: 10, intelligence: 10, vitality: 10, luck: 10 },
            attack: user.attack || 10,
            defense: user.defense || 10,
            inventory: user.inventory || [],
            equipment: user.equipment || {},
            equippedAccessories: user.equippedAccessories || {},
            emblem: user.emblem,
            emblemEnhancement: user.emblemEnhancement
        };
        
        this.activeWorldBoss.participants.push({
            userId: userId,
            username: interaction.user.username,
            damage: 0,
            currentHp: userMaxHp,
            maxHp: userMaxHp,
            isDead: false,
            deathTurn: null,
            user: userCopy
        });

        // 임베드 업데이트
        await this.updateBossEmbed(interaction);

        await interaction.editReply({
            content: `✅ **${interaction.user.username}**님이 보스 레이드에 참가했습니다! (${this.activeWorldBoss.participants.length}/${this.MAX_PARTICIPANTS})`
        });

        // 30초 동안 새 참가자가 없으면 1분 카운트다운 시작
        this.resetAutoStartTimer(interaction.client);
    }

    // 자동 시작 타이머 리셋
    resetAutoStartTimer(client) {
        // 기존 타이머 취소
        if (this.AUTO_START_TIMER) {
            clearTimeout(this.AUTO_START_TIMER);
            this.AUTO_START_TIMER = null;
        }

        // 최소 인원이 모이지 않았으면 타이머 설정하지 않음
        if (!this.activeWorldBoss || this.activeWorldBoss.participants.length < this.MIN_PARTICIPANTS) {
            return;
        }

        // 30초 타이머 설정
        this.AUTO_START_TIMER = setTimeout(() => {
            this.startCountdown(client);
        }, 30000); // 30초
    }

    // 카운트다운 시작
    async startCountdown(client) {
        if (!this.activeWorldBoss || this.activeWorldBoss.participants.length < this.MIN_PARTICIPANTS) {
            return;
        }

        try {
            const channel = await client.channels.fetch(this.activeWorldBoss.channelId);
            if (!channel) return;

            // 카운트다운 메시지
            const countdownEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⏳ 보스 레이드 시작 카운트다운!')
                .setDescription(`30초 동안 새로운 참가자가 없어 1분 후 자동으로 시작됩니다!\n현재 참가자: ${this.activeWorldBoss.participants.length}명`)
                .setFooter({ text: '준비 버튼을 눌러 즉시 시작할 수 있습니다!' })
                .setTimestamp();

            await channel.send({ embeds: [countdownEmbed] });

            // 1분 후 자동 시작
            setTimeout(() => {
                if (this.activeWorldBoss && this.activeWorldBoss.participants.length >= this.MIN_PARTICIPANTS) {
                    this.startBossRaid(client);
                }
            }, 60000); // 1분
        } catch (error) {
            console.error('[Boss] 카운트다운 오류:', error);
        }
    }

    // 준비 완료 처리
    async setPlayerReady(interaction) {
        try {
            // interactionHandler에서 이미 deferUpdate를 했으므로 defer 스킵
            
            if (!this.activeWorldBoss) {
                return interaction.editReply({
                    content: '❌ 현재 진행중인 보스가 없습니다!'
                });
            }

            const userId = interaction.user.id;
            
            // 참가자인지 확인
            const participant = this.activeWorldBoss.participants.find(p => p.userId === userId);
            if (!participant) {
                return interaction.editReply({
                    content: '❌ 레이드에 참가하지 않았습니다!'
                });
            }

            // 이미 준비 완료 상태인지 확인
            if (this.READY_PARTICIPANTS.has(userId)) {
                return interaction.editReply({
                    content: '❌ 이미 준비 완료 상태입니다!'
                });
            }

            // 준비 상태로 설정
            this.READY_PARTICIPANTS.add(userId);

            await interaction.editReply({
                content: `✅ **${interaction.user.username}**님이 준비 완료했습니다! (${this.READY_PARTICIPANTS.size}/${this.activeWorldBoss.participants.length})`
            });

            // 모든 참가자가 준비 완료했는지 확인
            if (this.READY_PARTICIPANTS.size === this.activeWorldBoss.participants.length && 
                this.activeWorldBoss.participants.length >= this.MIN_PARTICIPANTS) {
                
                // 타이머 취소
                if (this.AUTO_START_TIMER) {
                    clearTimeout(this.AUTO_START_TIMER);
                    this.AUTO_START_TIMER = null;
                }

                await interaction.followUp({
                    content: '🎮 **모든 참가자가 준비 완료했습니다! 3초 후 레이드가 시작됩니다!**'
                });

                setTimeout(() => this.startBossRaid(interaction.client), 3000);
            }

            // 임베드 업데이트
            await this.updateReadyStatus(interaction);
        } catch (error) {
            console.error('[Boss] setPlayerReady 오류:', error);
            // 에러가 발생해도 무시하고 계속 진행
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ 
                        content: '❌ 준비 처리 중 오류가 발생했습니다.', 
                        flags: 64 
                    });
                } catch (replyError) {
                    console.error('[Boss] 에러 응답 실패:', replyError);
                }
            }
        }
    }

    // 준비 상태 업데이트
    async updateReadyStatus(interaction) {
        const boss = this.activeWorldBoss.boss;
        const participantsList = this.activeWorldBoss.participants.map((p, i) => {
            const isReady = this.READY_PARTICIPANTS.has(p.userId);
            return `${i + 1}. ${p.username} ${isReady ? '✅' : '⏳'}`;
        }).join('\n');

        const allReady = this.READY_PARTICIPANTS.size === this.activeWorldBoss.participants.length;
        const statusColor = allReady ? '#00FF00' : '#FFA500';
        const statusText = allReady 
            ? `+ 모두 준비 완료! (${this.READY_PARTICIPANTS.size}/${this.activeWorldBoss.participants.length})\n` 
            : `- 준비 대기중 (${this.READY_PARTICIPANTS.size}/${this.activeWorldBoss.participants.length})\n`;

        const updatedEmbed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle('⚔️ 보스 레이드 ⚔️')
            .setDescription(`# ${boss.emoji} **${boss.name}**\n\n` +
                `**파티가 구성되었습니다!**\n` +
                `모든 참가자가 준비를 완료하면 시작됩니다.\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
            .addFields(
                { 
                    name: '📊 보스 정보', 
                    value: `\`\`\`레벨: ${boss.level}\nHP: ${this.activeWorldBoss.currentHp.toLocaleString()} / ${boss.hp.toLocaleString()}\n공격력: ${boss.attack}\n방어력: ${boss.defense}\`\`\``,
                    inline: true
                },
                {
                    name: '🎯 참가 조건',
                    value: `\`\`\`최소 레벨: ${boss.requiredLevel}\n최소 인원: ${this.MIN_PARTICIPANTS}명\n최대 인원: ${this.MAX_PARTICIPANTS}명\n선착순 모집\`\`\``,
                    inline: true
                },
                {
                    name: '🎁 보상',
                    value: `\`\`\`1등: 엠블럼강화조각 3개\n2등: 엠블럼강화조각 2개\n3등: 엠블럼강화조각 1개\n4등 이하: 엠블럼강화조각 0.5개\n전원: 골드 & 경험치\`\`\``,
                    inline: true
                },
                {
                    name: '⏱️ 준비 상태',
                    value: '```diff\n' + statusText + '```' + 
                           '```\n' + participantsList + '```',
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({ text: allReady ? '🚨 곧 레이드가 시작됩니다!' : '⚠️ 모든 참가자가 준비 버튼을 눌러주세요!' });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('world_boss_join')
                    .setLabel('⚔️ 보스 레이드 참가')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗡️')
                    .setDisabled(this.activeWorldBoss.participants.length >= this.MAX_PARTICIPANTS),
                new ButtonBuilder()
                    .setCustomId('world_boss_ready')
                    .setLabel('✅ 준비 완료')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
                    .setDisabled(allReady),
                new ButtonBuilder()
                    .setCustomId('world_boss_leave')
                    .setLabel('🚪 대기열 나가기')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );

        await interaction.message.edit({
            embeds: [updatedEmbed],
            components: [buttons]
        });
    }

    // 시작 버튼 표시 (최소 인원 이상일 때)
    async showStartButton(interaction) {
        if (!this.activeWorldBoss || this.activeWorldBoss.participants.length < this.MIN_PARTICIPANTS) {
            return;
        }

        const boss = this.activeWorldBoss.boss;
        const participantsList = this.activeWorldBoss.participants.map((p, i) => `${i + 1}. ${p.username}`).join('\n');

        const readyEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚔️ 보스 레이드 ⚔️')
            .setDescription(`# ${boss.emoji} **${boss.name}**\n\n` +
                `**최소 인원이 모였습니다!**\n` +
                `리더가 시작 버튼을 눌러주세요.\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
            .addFields(
                { 
                    name: '📊 보스 정보', 
                    value: `\`\`\`레벨: ${boss.level}\nHP: ${this.activeWorldBoss.currentHp.toLocaleString()} / ${boss.hp.toLocaleString()}\n공격력: ${boss.attack}\n방어력: ${boss.defense}\`\`\``,
                    inline: true
                },
                {
                    name: '🎯 참가 조건',
                    value: `\`\`\`최소 레벨: ${boss.requiredLevel}\n최소 인원: ${this.MIN_PARTICIPANTS}명\n최대 인원: ${this.MAX_PARTICIPANTS}명\n선착순 모집\`\`\``,
                    inline: true
                },
                {
                    name: '🎁 보상',
                    value: `\`\`\`1등: 엠블럼강화조각 3개\n2등: 엠블럼강화조각 2개\n3등: 엠블럼강화조각 1개\n4등 이하: 엠블럼강화조각 0.5개\n전원: 골드 & 경험치\`\`\``,
                    inline: true
                },
                {
                    name: '⏱️ 파티 상태',
                    value: '```diff\n+ 시작 준비 완료! (' + this.activeWorldBoss.participants.length + '/' + this.MAX_PARTICIPANTS + ')\n```' + 
                           '```\n' + participantsList + '```',
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({ text: '🚨 리더가 시작 버튼을 눌러주세요!' });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('world_boss_join')
                    .setLabel('⚔️ 보스 레이드 참가')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⚔️')
                    .setDisabled(this.activeWorldBoss.participants.length >= this.MAX_PARTICIPANTS),
                new ButtonBuilder()
                    .setCustomId('world_boss_leave')
                    .setLabel('🚪 대기열 나가기')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌'),
                new ButtonBuilder()
                    .setCustomId('world_boss_start')
                    .setLabel('🎮 레이드 시작!')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('▶️')
            );

        await interaction.message.edit({
            embeds: [readyEmbed],
            components: [buttons]
        });
    }

    // 보스 임베드 업데이트
    async updateBossEmbed(interaction) {
        const boss = this.activeWorldBoss.boss;
        
        // 최소 인원이 모였는지 확인
        const hasMinParticipants = this.activeWorldBoss.participants.length >= this.MIN_PARTICIPANTS;
        
        // 참가자 목록 생성
        const participantsList = this.activeWorldBoss.participants.length > 0
            ? this.activeWorldBoss.participants.map((p, i) => {
                if (hasMinParticipants) {
                    const isReady = this.READY_PARTICIPANTS.has(p.userId);
                    return `${i + 1}. ${p.username} ${isReady ? '✅' : '⏳'}`;
                }
                return `${i + 1}. ${p.username}`;
            }).join('\n')
            : '대기중...';

        const statusColor = this.activeWorldBoss.participants.length === this.MAX_PARTICIPANTS ? '#00FF00' : 
                           hasMinParticipants ? '#FFA500' : '#FF0000';
        
        const statusText = this.activeWorldBoss.participants.length === this.MAX_PARTICIPANTS 
            ? `+ 파티 구성 완료! (${this.MAX_PARTICIPANTS}/${this.MAX_PARTICIPANTS})\n` 
            : hasMinParticipants
            ? `- 준비 대기중 (${this.READY_PARTICIPANTS.size}/${this.activeWorldBoss.participants.length} 준비)\n`
            : `- 참가자 모집중 (${this.activeWorldBoss.participants.length}/${this.MAX_PARTICIPANTS})\n`;

        const updatedEmbed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle('⚔️ 보스 레이드 ⚔️')
            .setDescription(`# ${boss.emoji} **${boss.name}**\n\n` +
                `**거대한 그림자가 나타났습니다!**\n` +
                `서둘러 파티를 구성하여 토벌하세요!\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
            .addFields(
                { 
                    name: '📊 보스 정보', 
                    value: `\`\`\`레벨: ${boss.level}\nHP: ${this.activeWorldBoss.currentHp.toLocaleString()} / ${boss.hp.toLocaleString()}\n공격력: ${boss.attack}\n방어력: ${boss.defense}\`\`\``,
                    inline: true
                },
                {
                    name: '🎯 참가 조건',
                    value: `\`\`\`최소 레벨: ${boss.requiredLevel}\n최소 인원: ${this.MIN_PARTICIPANTS}명\n최대 인원: ${this.MAX_PARTICIPANTS}명\n선착순 모집\`\`\``,
                    inline: true
                },
                {
                    name: '🎁 보상',
                    value: `\`\`\`1등: 엠블럼강화조각 3개\n2등: 엠블럼강화조각 2개\n3등: 엠블럼강화조각 1개\n4등 이하: 엠블럼강화조각 0.5개\n전원: 골드 & 경험치\`\`\``,
                    inline: true
                },
                {
                    name: '⏱️ 파티 상태',
                    value: '```diff\n' + statusText + '```' + 
                           '```\n' + participantsList + '```',
                    inline: false
                }
            )
            .setThumbnail(null)
            .setTimestamp()
            .setFooter({ text: this.activeWorldBoss.participants.length < this.MIN_PARTICIPANTS
                ? `⚠️ 최소 ${this.MIN_PARTICIPANTS}명이 모여야 시작할 수 있습니다!`
                : this.activeWorldBoss.participants.length < this.MAX_PARTICIPANTS 
                ? `⚠️ 버튼을 클릭하여 레이드에 참가하세요! (최대 ${this.MAX_PARTICIPANTS}명)` 
                : '⚔️ 3초 후 레이드가 시작됩니다!' });

        const buttons = [];
        
        // 최소 인원이 모이지 않았을 때의 버튼
        if (!hasMinParticipants) {
            buttons.push(new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('world_boss_join')
                        .setLabel('⚔️ 보스 레이드 참가')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗡️')
                        .setDisabled(this.activeWorldBoss.participants.length >= this.MAX_PARTICIPANTS),
                    new ButtonBuilder()
                        .setCustomId('world_boss_leave')
                        .setLabel('🚪 대기열 나가기')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌')
                        .setDisabled(this.activeWorldBoss.participants.length === 0)
                ));
        } else {
            // 최소 인원이 모였을 때의 버튼
            buttons.push(new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('world_boss_join')
                        .setLabel('⚔️ 보스 레이드 참가')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗡️')
                        .setDisabled(this.activeWorldBoss.participants.length >= this.MAX_PARTICIPANTS),
                    new ButtonBuilder()
                        .setCustomId('world_boss_ready')
                        .setLabel('✅ 준비 완료')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId('world_boss_leave')
                        .setLabel('🚪 대기열 나가기')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌')
                ));
        }

        // 메시지 업데이트
        try {
            if (interaction.message) {
                // 버튼 인터랙션에서 호출된 경우
                await interaction.message.edit({
                    embeds: [updatedEmbed],
                    components: buttons
                });
            } else if (this.activeWorldBoss.messageId && this.activeWorldBoss.channelId) {
                // 보스소환 명령어에서 호출된 경우
                const channel = await interaction.client.channels.fetch(this.activeWorldBoss.channelId);
                const message = await channel.messages.fetch(this.activeWorldBoss.messageId);
                await message.edit({
                    embeds: [updatedEmbed],
                    components: buttons
                });
            }
        } catch (error) {
            console.error('[Boss] 임베드 업데이트 오류:', error);
        }
    }

    // 보스 레이드 시작
    async startBossRaid(client) {
        if (!this.activeWorldBoss || !this.activeWorldBoss.participants || this.activeWorldBoss.participants.length === 0) {
            console.error('[Boss] No active boss or participants');
            return;
        }
        
        // 보스 데이터 확인 및 초기화
        if (!this.activeWorldBoss.currentHp || isNaN(this.activeWorldBoss.currentHp)) {
            this.activeWorldBoss.currentHp = this.activeWorldBoss.boss.hp || 10000;
            console.log('[Boss] 보스 HP 재초기화:', this.activeWorldBoss.currentHp);
        }
        
        if (!this.activeWorldBoss.totalDamage) {
            this.activeWorldBoss.totalDamage = 0;
        }

        // 타임아웃 취소 (레이드가 시작되었으므로)
        if (this.activeWorldBoss.timeoutId) {
            clearTimeout(this.activeWorldBoss.timeoutId);
            this.activeWorldBoss.timeoutId = null;
        }
        
        // 기존 보스 소환 메시지 삭제
        try {
            const channel = await client.channels.fetch(this.activeWorldBoss.channelId);
            if (channel) {
                await this.cleanupBossMessage(channel);
            }
        } catch (error) {
            console.error('[Boss] 채널 또는 메시지 삭제 실패:', error);
        }

        // 자동 시작 타이머 취소
        if (this.AUTO_START_TIMER) {
            clearTimeout(this.AUTO_START_TIMER);
            this.AUTO_START_TIMER = null;
        }

        // 준비 상태 초기화
        this.READY_PARTICIPANTS.clear();

        const channel = await client.channels.fetch(this.activeWorldBoss.channelId);
        if (!channel) {
            console.error('[Boss] Channel not found:', this.activeWorldBoss.channelId);
            return;
        }

        // 메시지 중복 방지 - 아래 임베드에서 한번만 표시

        // activeWorldBoss가 중간에 null이 되는 경우 체크
        if (!this.activeWorldBoss || !this.activeWorldBoss.boss) {
            console.error('[Boss] ActiveWorldBoss became null during raid start');
            return;
        }
        
        // 전투 상황 임베드 초기 생성
        const boss = this.activeWorldBoss.boss;
        const battleEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`⚔️ ${boss.emoji} ${boss.name} 레이드 진행중`)
            .setDescription('전투가 시작되었습니다!')
            .addFields(
                { 
                    name: '👹 보스 체력', 
                    value: `HP: ${this.activeWorldBoss.currentHp.toLocaleString()} / ${boss.hp.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '⚔️ 참가자',
                    value: this.activeWorldBoss.participants.map(p => p.username).join(', '),
                    inline: true
                }
            )
            .setTimestamp();

        const battleMessage = await channel.send({ embeds: [battleEmbed] });

        // 전투 시뮬레이션
        let turn = 0;
        const battleLog = [];
        const maxLogDisplay = 7; // 표시할 최대 로그 수
        let allDead = false;
        
        // 보스 HP 초기화 확인
        if (!this.activeWorldBoss.currentHp || isNaN(this.activeWorldBoss.currentHp)) {
            this.activeWorldBoss.currentHp = boss.hp;
            console.log('[Boss] 보스 HP 초기화:', this.activeWorldBoss.currentHp);
        }
        
        // 각 참가자의 버프 초기화
        this.activeWorldBoss.participants.forEach(p => {
            p.buffs = [];
            // 장신구 세트 효과 체크로 시작 버프 부여
            if (p.user.equippedAccessories) {
                const accessories = Object.values(p.user.equippedAccessories).filter(a => a);
                const setCount = accessories.filter(a => a.setName === '마왕의 지배').length;
                if (setCount >= 2) {
                    const buff = buffSystem.applyBuff({ activeBuffs: p.buffs }, 'ATTACK_UP', 30, 999);
                    p.buffs.push(buff);
                    battleLog.push(`👑 **${p.username}**이(가) 마왕 세트 효과로 공격력 증가!`);
                }
            }
        });

        while (this.activeWorldBoss && this.activeWorldBoss.currentHp > 0 && turn < 50 && !allDead) { // 최대 50턴
            turn++;
            
            // 각 참가자의 공격
            for (const participant of this.activeWorldBoss.participants) {
                if (this.activeWorldBoss.currentHp <= 0) break;
                
                // 사망한 플레이어는 공격 불가
                if (participant.isDead) continue;

                // 버프 적용된 사용자 스탯 계산
                const buffedUser = {
                    ...participant.user,
                    attack: this.calculateTotalAttack(participant.user)
                };
                
                // 버프 효과 적용
                participant.buffs.forEach(buff => {
                    if (buff.type === 'ATTACK_UP') {
                        buffedUser.attack += buff.value;
                    }
                });
                
                // 보스 스탯
                const bossStats = {
                    defense: boss.defense || 50,
                    stats: {
                        agility: 20,
                        luck: 15
                    }
                };
                
                // 통합 데미지 계산
                const damageResult = calculateBossRaidDamage(buffedUser, bossStats, turn % 5 === 0); // 5턴마다 스킬
                const damage = damageResult.damage || 0;
                
                // NaN 체크
                if (isNaN(damage)) {
                    console.error('[Boss] 데미지 계산 오류 - NaN 감지:', { participant: participant.username, damage });
                    continue;
                }
                
                participant.damage = (participant.damage || 0) + damage;
                this.activeWorldBoss.currentHp = Math.max(0, (this.activeWorldBoss.currentHp || boss.hp) - damage);
                this.activeWorldBoss.totalDamage = (this.activeWorldBoss.totalDamage || 0) + damage;
                
                // 스킬 사용 시 버프 확률
                if (turn % 5 === 0 && Math.random() < 0.3) {
                    const skillBuff = buffSystem.applyBuff({ activeBuffs: participant.buffs }, 'CRITICAL_UP', 10, 3);
                    participant.buffs.push(skillBuff);
                    battleLog.push(`✨ **${participant.username}**의 크리티컬 확률 증가!`);
                }

                // 직업별 특수 효과 처리
                let attackMessage = damageResult.isCritical 
                    ? `⚔️ **${participant.username}**의 치명타! 💥 **${damage.toLocaleString()}** 데미지!`
                    : `⚔️ **${participant.username}**의 공격! 💥 ${damage.toLocaleString()} 데미지!`;
                
                // 궁수 2연타
                if (damageResult.hasDoubleHit) {
                    attackMessage += ` 🏹 2연타!`;
                }
                
                // 도적 추가 공격
                if (damageResult.hasExtraAttack) {
                    attackMessage += ` 🗡️ 그림자 공격!`;
                }
                
                // 마법사 원소 데미지
                if (damageResult.elementalDamage > 0) {
                    attackMessage += ` 🔥 원소 폭발 +${damageResult.elementalDamage}!`;
                }
                
                battleLog.push(attackMessage);

                if (this.activeWorldBoss.currentHp <= 0) {
                    battleLog.push(`🎉 **${participant.username}**이(가) 마지막 일격을 날렸습니다!`);
                    break;
                }
            }

            // 보스의 반격
            if (this.activeWorldBoss.currentHp > 0) {
                // 살아있는 플레이어 목록
                const aliveParticipants = this.activeWorldBoss.participants.filter(p => !p.isDead);
                
                if (aliveParticipants.length > 0) {
                    // 보스 공격 패턴
                    const attackType = Math.random();
                    
                    if (attackType < 0.6) { // 60% - 단일 대상 공격
                        const target = aliveParticipants[Math.floor(Math.random() * aliveParticipants.length)];
                        let rawDamage = Math.floor(boss.attack * (0.8 + Math.random() * 0.4));
                        
                        // 궁수 보스전 회피 체크
                        const { calculateDodgeChance, calculateArcherBossDodge } = require('../handlers/common/damageCalculator');
                        const baseDodge = calculateDodgeChance(target.user.stats?.agility || 10);
                        const archerBossDodge = calculateArcherBossDodge(target.user, boss);
                        const totalDodgeChance = Math.min(0.5, baseDodge + archerBossDodge); // 최대 50% 회피
                        
                        if (Math.random() < totalDodgeChance) {
                            battleLog.push(`💨 **${target.username}**이(가) ${boss.name}의 공격을 회피했습니다!`);
                            continue; // 다음 턴으로
                        }
                        
                        // 방어력 계산 (장비 포함 총 방어력)
                        const totalDefense = this.calculateTotalDefense(target.user);
                        const damageReduction = totalDefense / (totalDefense + 100); // 최대 50% 감소
                        let bossDamage = Math.floor(rawDamage * (1 - damageReduction * 0.5));
                        
                        // 수호자 보호막 적용
                        const shieldReduction = calculateDefenderShield(target.user);
                        const baseReduction = calculateDefenderDamageReduction(target.user);
                        const totalReduction = shieldReduction + baseReduction;
                        
                        if (totalReduction > 0) {
                            const absorbed = Math.floor(bossDamage * totalReduction);
                            bossDamage -= absorbed;
                            battleLog.push(`🛡️ **${target.username}**의 보호막이 ${absorbed} 피해를 흡수!`);
                        }
                        
                        // 전사 불굴의 의지 체크
                        const warriorReduction = applyWarriorDamageReduction(bossDamage, target.user);
                        if (warriorReduction.reduced) {
                            bossDamage = warriorReduction.damage;
                            battleLog.push(`⚔️ **${target.username}**의 불굴의 의지! 데미지 -${warriorReduction.reductionAmount}`);
                        }
                        
                        target.currentHp -= bossDamage;
                        
                        if (target.currentHp <= 0) {
                            target.currentHp = 0;
                            target.isDead = true;
                            target.deathTurn = turn;
                            battleLog.push(`💀 ${boss.name}의 공격! **${target.username}**에게 ${bossDamage} 데미지! **사망!**`);
                        } else {
                            battleLog.push(`👹 ${boss.name}의 공격! **${target.username}**에게 ${bossDamage} 데미지! (HP: ${target.currentHp}/${target.maxHp})`);
                            
                            // 수호자 반격 체크
                            const counterAttack = calculateDefenderCounterAttack(bossDamage, target.user);
                            if (counterAttack.hasCounter && target.currentHp > 0) {
                                this.activeWorldBoss.currentHp = Math.max(0, this.activeWorldBoss.currentHp - counterAttack.counterDamage);
                                battleLog.push(`🛡️ **${target.username}**의 반격! ${counterAttack.counterDamage} 데미지!`);
                            }
                        }
                    } else if (attackType < 0.85) { // 25% - 강력한 단일 공격
                        const target = aliveParticipants[Math.floor(Math.random() * aliveParticipants.length)];
                        const rawDamage = Math.floor(boss.attack * (1.5 + Math.random() * 0.5));
                        
                        // 궁수는 필살기도 낮은 확률로 회피 가능
                        const { calculateDodgeChance, calculateArcherBossDodge } = require('../handlers/common/damageCalculator');
                        const baseDodge = calculateDodgeChance(target.user.stats?.agility || 10);
                        const archerBossDodge = calculateArcherBossDodge(target.user, boss);
                        const totalDodgeChance = Math.min(0.25, (baseDodge + archerBossDodge) * 0.5); // 필살기는 회피율 절반, 최대 25%
                        
                        if (Math.random() < totalDodgeChance) {
                            battleLog.push(`💨 **${target.username}**이(가) ${boss.name}의 필살기를 간발의 차로 회피했습니다!`);
                            continue;
                        }
                        
                        // 필살기는 방어력 효과 감소
                        const totalDefense = this.calculateTotalDefense(target.user);
                        const damageReduction = totalDefense / (totalDefense + 200); // 최대 33% 감소
                        const bossDamage = Math.floor(rawDamage * (1 - damageReduction * 0.33));
                        
                        target.currentHp -= bossDamage;
                        
                        if (target.currentHp <= 0) {
                            target.currentHp = 0;
                            target.isDead = true;
                            target.deathTurn = turn;
                            battleLog.push(`💥 ${boss.name}의 필살기! **${target.username}**에게 ${bossDamage} 데미지! **즉사!**`);
                        } else {
                            battleLog.push(`💥 ${boss.name}의 필살기! **${target.username}**에게 ${bossDamage} 데미지! (HP: ${target.currentHp}/${target.maxHp})`);
                            
                            // 보스 특수 공격 - 방어력 감소 디버프
                            if (Math.random() < 0.3) {
                                const debuff = buffSystem.applyDebuff(
                                    { activeBuffs: target.buffs, stats: target.user.stats },
                                    'DEFENSE_DOWN',
                                    30,
                                    3
                                );
                                if (!debuff.resisted) {
                                    target.buffs.push(debuff);
                                    battleLog.push(`🔻 **${target.username}**의 방어력이 감소했습니다!`);
                                }
                            }
                        }
                    } else { // 15% - 전체 공격
                        const rawAoeDamage = Math.floor(boss.attack * 0.5);
                        battleLog.push(`🌪️ ${boss.name}의 광역 공격!`);
                        
                        for (const target of aliveParticipants) {
                            // 궁수는 광역 공격도 일부 회피 가능
                            const { calculateDodgeChance, calculateArcherBossDodge } = require('../handlers/common/damageCalculator');
                            const baseDodge = calculateDodgeChance(target.user.stats?.agility || 10);
                            const archerBossDodge = calculateArcherBossDodge(target.user, boss);
                            const totalDodgeChance = Math.min(0.15, (baseDodge + archerBossDodge) * 0.3); // 광역은 회피율 30%, 최대 15%
                            
                            if (Math.random() < totalDodgeChance) {
                                battleLog.push(`   💨 **${target.username}**이(가) 광역 공격을 회피!`);
                                continue;
                            }
                            
                            // 광역기는 개별 방어력 적용
                            const totalDefense = this.calculateTotalDefense(target.user);
                            const damageReduction = totalDefense / (totalDefense + 150); // 최대 40% 감소
                            const aoeDamage = Math.floor(rawAoeDamage * (1 - damageReduction * 0.4));
                            
                            target.currentHp -= aoeDamage;
                            if (target.currentHp <= 0) {
                                target.currentHp = 0;
                                target.isDead = true;
                                target.deathTurn = turn;
                                battleLog.push(`   💀 **${target.username}** ${aoeDamage} 데미지로 사망!`);
                            } else {
                                battleLog.push(`   **${target.username}** ${aoeDamage} 데미지! (HP: ${target.currentHp}/${target.maxHp})`);
                            }
                        }
                    }
                    
                    // 모든 플레이어가 사망했는지 확인
                    allDead = aliveParticipants.every(p => p.currentHp <= 0);
                }
                
                // 턴 종료 시 버프 처리
                for (const participant of this.activeWorldBoss.participants) {
                    if (participant.isDead) continue;
                    
                    const buffResult = buffSystem.processBuffsEndTurn({ activeBuffs: participant.buffs });
                    participant.buffs = buffResult.activeBuffs || participant.buffs;
                    
                    buffResult.ongoingEffects?.forEach(effect => {
                        if (effect.type === 'damage') {
                            participant.currentHp = Math.max(0, participant.currentHp - effect.value);
                            if (participant.currentHp <= 0) {
                                participant.currentHp = 0;
                                participant.isDead = true;
                                participant.deathTurn = turn;
                                battleLog.push(`☠️ **${participant.username}**이(가) 지속 피해로 사망!`);
                            } else {
                                battleLog.push(`🔥 **${participant.username}** 지속 피해 -${effect.value}`);
                            }
                        }
                    });
                }
            }

            // 3턴마다 전투 상황 업데이트
            if (turn % 3 === 0 || this.activeWorldBoss.currentHp <= 0 || allDead) {
                // NaN 체크
                const currentHp = isNaN(this.activeWorldBoss.currentHp) ? 0 : this.activeWorldBoss.currentHp;
                const maxHp = boss.hp || 1000;
                const hpPercentage = Math.floor((currentHp / maxHp) * 100);
                const hpBar = this.createHPBar(hpPercentage);
                
                // 플레이어 상태 표시
                const playerStatus = this.activeWorldBoss.participants.map(p => {
                    if (p.isDead) {
                        return `💀 ~~${p.username}~~ (사망)`;
                    }
                    const hpPercent = Math.floor((p.currentHp / p.maxHp) * 100);
                    const hpEmoji = hpPercent > 50 ? '💚' : hpPercent > 20 ? '💛' : '❤️';
                    let status = `${hpEmoji} ${p.username} (${p.currentHp}/${p.maxHp})`;
                    
                    // 활성 버프 표시
                    if (p.buffs && p.buffs.length > 0) {
                        const buffIcons = p.buffs.map(buff => {
                            const buffInfo = buffSystem.buffTypes[buff.type];
                            return buffInfo ? buffInfo.icon : '❓';
                        }).join('');
                        status += ` ${buffIcons}`;
                    }
                    
                    return status;
                }).join('\n');
                
                battleEmbed.setDescription(`**전투 ${turn}턴째 진행중...**\n${hpBar}`)
                    .spliceFields(0, 3,
                        { 
                            name: '👹 보스 체력', 
                            value: `HP: ${currentHp.toLocaleString()} / ${maxHp.toLocaleString()} (${hpPercentage}%)`,
                            inline: true
                        },
                        {
                            name: '💥 총 데미지',
                            value: (this.activeWorldBoss.totalDamage || 0).toLocaleString(),
                            inline: true
                        },
                        {
                            name: '⚔️ 플레이어 상태',
                            value: playerStatus || '없음',
                            inline: false
                        }
                    )
                    .spliceFields(3, 1,
                        {
                            name: '📜 전투 로그',
                            value: battleLog.slice(-maxLogDisplay).join('\n') || '전투 시작!',
                            inline: false
                        }
                    );

                await battleMessage.edit({ embeds: [battleEmbed] });
                await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5초 대기
            }
        }

        // 전투 결과
        if (this.activeWorldBoss.currentHp <= 0) {
            await this.handleVictory(channel);
        } else if (allDead) {
            await this.handleTotalDefeat(channel, turn);
        } else {
            await this.handleTimeout(channel, turn);
        }
    }

    // 승리 처리
    async handleVictory(channel) {
        try {
            const boss = this.activeWorldBoss.boss;
            const { formatNumber } = require('../handlers/common/utils');
            const { applyGoldBonus, applyExpBonus } = require('../handlers/common/specialEffects');
            
            // 보상 분배 (완전 랜덤)
            const rewards = [];
            const participantDetails = [];
            
            // 데미지 순위 정렬
            const sortedParticipants = [...this.activeWorldBoss.participants].sort((a, b) => b.damage - a.damage);
            
            // 모든 참가자에게 보상 (사망자도 동일한 보상)
            for (let i = 0; i < sortedParticipants.length; i++) {
                const participant = sortedParticipants[i];
                const rank = i + 1;
                
                // 모든 플레이어에게 동일한 보상 (사망 패널티 제거)
                const rewardMultiplier = 1.0;
                
                // DB에서 실제 유저 객체 다시 조회
                const user = await User.findOne({ discordId: participant.userId });
                if (!user) {
                    console.error('[Boss] 유저를 찾을 수 없음:', participant.userId);
                    continue;
                }
                
                // 보스 레벨에 따른 보상 배율 계산
                let levelMultiplier = this.getLevelMultiplier(boss.level);
                
                // 순위별 보상 (레벨 배율 적용)
                let tokenAmount = 0;
                const rankingRewards = BOSS_SYSTEM.rankingRewards[rank] || BOSS_SYSTEM.rankingRewards[5];
                tokenAmount = rankingRewards.emblemFragments * levelMultiplier;
                
                // 사망한 플레이어도 동일한 보상 (성장의 재미를 위해)
                // 사망 패널티 제거
                
                // 엠블럼강화조각 지급
                if (tokenAmount > 0) {
                    if (!user.items) user.items = {};
                    user.items.emblemEnhanceStone = (user.items.emblemEnhanceStone || 0) + tokenAmount;
                }
                
                // 골드와 경험치 지급 (모든 참가자 동일)
                const rankMultiplier = rank === 1 ? 1.5 : rank === 2 ? 1.2 : 1.0;
                let goldReward = Math.floor(boss.rewards.gold * 0.5 * rankMultiplier);
                let expReward = Math.floor(boss.rewards.exp * 0.5 * rankMultiplier);
                
                // 특수 효과 적용
                console.log(`[WorldBoss] ${user.nickname || user.discordId} - 특수 효과 적용 전 골드: ${goldReward}, 경험치: ${expReward}`);
                goldReward = applyGoldBonus(goldReward, user);
                expReward = applyExpBonus(expReward, user);
                console.log(`[WorldBoss] ${user.nickname || user.discordId} - 특수 효과 적용 후 골드: ${goldReward}, 경험치: ${expReward}`);
                
                // 만렙 체크 - 보상 배열에 추가하기 전에 체크
                let actualExpGained = 0;
                if (user.level < MAX_LEVEL) {
                    actualExpGained = expReward;
                } else {
                    actualExpGained = 0; // 만렙인 경우 경험치 0
                    expReward = 0; // 표시용으로도 0 설정
                }
                
                user.gold += goldReward;
                if (actualExpGained > 0) {
                    user.exp += actualExpGained;
                }
                
                // 레벨업 체크
                const { checkAndProcessLevelUp } = require('../handlers/common/levelUp');
                const levelUpResult = await checkAndProcessLevelUp(user);
                
                // 통합 랭킹 데이터 업데이트
                if (!user.rankingStats) user.rankingStats = {};
                if (!user.rankingStats.boss) {
                    user.rankingStats.boss = {
                        totalDamage: 0,
                        totalKills: 0,
                        maxDamage: 0,
                        lastUpdated: null
                    };
                }
                
                // 보스 토벌 통계 업데이트
                user.rankingStats.boss.totalDamage = (user.rankingStats.boss.totalDamage || 0) + (participant.damage || 0);
                user.rankingStats.boss.totalKills = (user.rankingStats.boss.totalKills || 0) + 1;
                user.rankingStats.boss.maxDamage = Math.max(
                    user.rankingStats.boss.maxDamage || 0,
                    participant.damage || 0
                );
                user.rankingStats.boss.lastUpdated = new Date();
                
                // 프로필용 보스 킬 카운트도 증가
                user.bossKills = (user.bossKills || 0) + 1;
                
                await user.save();
                
                // 골드/경험치 보너스 계산을 위한 정보 수집
                const goldBonusPercent = Math.floor(((goldReward / (boss.rewards.gold * 0.5 * rewardMultiplier * rankMultiplier)) - 1) * 100);
                const expBonusPercent = Math.floor(((expReward / (boss.rewards.exp * 0.5 * rewardMultiplier * rankMultiplier)) - 1) * 100);
                
                rewards.push({
                    rank: rank,
                    username: participant.username,
                    userId: participant.userId,
                    tokens: `💎 엠블럼강화조각 x${tokenAmount}`,
                    tokenAmount: tokenAmount, // 실제 수치 저장
                    gold: goldReward,
                    exp: expReward,
                    damage: participant.damage,
                    isDead: participant.isDead,
                    levelUp: levelUpResult.leveledUp,
                    newLevel: user.level,
                    goldBonus: goldBonusPercent,
                    expBonus: expBonusPercent,
                    title: user.equippedTitle
                });
                
                // 전투 상세 정보 수집
                participantDetails.push({
                    rank: rank,
                    username: participant.username,
                    damage: participant.damage,
                    damagePercent: Math.floor((participant.damage / this.activeWorldBoss.totalDamage) * 100),
                    isDead: participant.isDead,
                    deathTurn: participant.deathTurn,
                    finalHp: participant.currentHp,
                    maxHp: participant.maxHp
                });
            }

            // 결과 임베드
            const victoryMessages = [
                '영웅들의 전설이 시작됩니다!',
                '역사에 남을 전투였습니다!',
                '보스를 무릎 꿇렸습니다!',
                '완벽한 팀워크의 승리!'
            ];
            
            const resultEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 보스 토벌 성공!')
                .setDescription(`**${boss.emoji} ${boss.name}**을(를) 물리쳤습니다!\n\n_${victoryMessages[Math.floor(Math.random() * victoryMessages.length)]}_`)
                .setThumbnail('https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif')
                .addFields(
                    {
                        name: '⚔️ 전투 개요',
                        value: `\`\`\`yaml\n보스: ${boss.name} (Lv.${boss.level})\n총 데미지: ${formatNumber(this.activeWorldBoss.totalDamage)}\n소요 시간: ${Math.floor((Date.now() - this.activeWorldBoss.startTime) / 1000)}초\n참가 인원: ${this.activeWorldBoss.participants.length}명\n\`\`\``,
                        inline: false
                    }
                );

            // MVP 정보
            const mvp = participantDetails[0];
            resultEmbed.addFields({
                name: '🌟 MVP',
                value: `**${mvp.username}**\n💥 데미지: ${formatNumber(mvp.damage)} (${mvp.damagePercent}%)${mvp.isDead ? '\n💀 영웅적 희생' : ''}`,
                inline: false
            });

            // 데미지 순위표
            let rankingText = '```diff\n';
            participantDetails.forEach(detail => {
                const rankEmoji = detail.rank === 1 ? '🥇' : detail.rank === 2 ? '🥈' : '🥉';
                const statusIcon = detail.isDead ? '💀' : '⚔️';
                rankingText += `${detail.rank}. ${detail.username} ${statusIcon}\n`;
                rankingText += `   데미지: ${formatNumber(detail.damage)} (${detail.damagePercent}%)\n`;
                if (detail.isDead) {
                    rankingText += `   - ${detail.deathTurn}턴째 전사\n`;
                } else {
                    rankingText += `   + HP: ${detail.finalHp}/${detail.maxHp}\n`;
                }
            });
            rankingText += '```';
            
            resultEmbed.addFields({
                name: '📊 데미지 순위',
                value: rankingText,
                inline: false
            });

            // 보상 요약 추가
            const totalTokens = rewards.reduce((sum, r) => {
                return sum + (r.tokenAmount || 0);
            }, 0);
            const totalGold = rewards.reduce((sum, r) => sum + r.gold, 0);
            const totalExp = rewards.reduce((sum, r) => sum + r.exp, 0);
            
            resultEmbed.addFields({
                name: '🎁 전체 보상 요약',
                value: `💎 **엠블럼강화조각**: 총 ${totalTokens}개 지급\n💰 **골드**: 총 ${formatNumber(totalGold)}G 지급\n⭐ **경험치**: 총 ${formatNumber(totalExp)} EXP 지급`,
                inline: false
            });

            // 사망자가 있는 경우 별도 표시
            const casualties = this.activeWorldBoss.participants.filter(p => p.isDead);
            if (casualties.length > 0) {
                resultEmbed.addFields({
                    name: '🪦 영웅의 희생',
                    value: casualties.map(p => `**${p.username}** - ${p.deathTurn}턴째 산화`).join('\n'),
                    inline: false
                });
            }

            await channel.send({ embeds: [resultEmbed] });

            // 개인별 보상 임베드
            for (const reward of rewards) {
                const rewardEmbed = new EmbedBuilder()
                    .setColor(reward.rank <= 3 ? '#FFD700' : '#CD7F32')
                    .setTitle(`${reward.rank === 1 ? '🥇' : reward.rank === 2 ? '🥈' : reward.rank === 3 ? '🥉' : '🎖️'} ${reward.username}의 보상`)
                    .setDescription('_🎊 축하합니다! 보스 토벌에 성공했습니다!_');

                // 보상 상세
                let rewardDetailText = '';
                rewardDetailText += `💎 **엠블럼강화조각**: ${reward.tokens}\n`;
                rewardDetailText += `💰 **골드**: +${formatNumber(reward.gold)}G`;
                if (reward.goldBonus > 0) {
                    rewardDetailText += ` (기본 ${formatNumber(Math.floor(reward.gold / (1 + reward.goldBonus/100)))}G + ${reward.goldBonus}% 보너스)`;
                }
                rewardDetailText += `\n`;
                rewardDetailText += `⭐ **경험치**: +${formatNumber(reward.exp)} EXP`;
                if (reward.expBonus > 0) {
                    rewardDetailText += ` (기본 ${Math.floor(reward.exp / (1 + reward.expBonus/100))} + ${reward.expBonus}% 보너스)`;
                }
                
                if (reward.title) {
                    rewardDetailText += `\n🏅 **칭호 효과**: ${reward.title}`;
                }
                
                if (reward.levelUp) {
                    rewardDetailText += `\n\n🎉 **레벨 업!** → Lv.${reward.newLevel}`;
                }

                rewardEmbed.addFields({
                    name: '🎁 획득 보상',
                    value: rewardDetailText,
                    inline: true
                });

                rewardEmbed.addFields({
                    name: '💥 전투 기여도',
                    value: `데미지: ${formatNumber(reward.damage)}\n순위: ${reward.rank}위`,
                    inline: true
                });

                // 개인에게만 보이도록 전송
                try {
                    const user = await channel.guild.members.fetch(reward.userId);
                    await user.send({ embeds: [rewardEmbed] });
                } catch (err) {
                    // DM 실패 시 채널에 표시
                    await channel.send({ embeds: [rewardEmbed] });
                }
            }

            // 서버 전체 공지
            const announcementEmbed = new EmbedBuilder()
                .setColor('#FF00FF')
                .setTitle('📢 보스 레이드 완료!')
                .setDescription(`🎊 **${boss.emoji} ${boss.name}**이(가) 토벌되었습니다!\n\n참가자: ${this.activeWorldBoss.participants.map(p => p.username).join(', ')}`)
                .setFooter({ text: '다음 보스는 3시간 후에 출현합니다!' })
                .setTimestamp();

            await channel.send({ embeds: [announcementEmbed] });

            // 보스 초기화 및 메시지 정리
            await this.cleanupBossMessage(channel);
            this.activeWorldBoss = null;
            this.lastSpawnTime = Date.now(); // 다음 소환을 위한 시간 기록
            this.saveLastSpawnTime();
        } catch (error) {
            console.error('[Boss] Error in handleVictory:', error);
            
            // 에러 메시지 전송
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ 보스 처리 중 오류')
                .setDescription('보상 처리 중 오류가 발생했습니다.')
                .setTimestamp();
                
            await channel.send({ embeds: [errorEmbed] });
            
            // 보스 초기화 및 메시지 정리
            await this.cleanupBossMessage(channel);
            this.activeWorldBoss = null;
            this.lastSpawnTime = Date.now(); // 다음 소환을 위한 시간 기록
            this.saveLastSpawnTime();
        }
    }

    // 전멸 패배 처리
    async handleTotalDefeat(channel, turn) {
        const boss = this.activeWorldBoss.boss;
        const { formatNumber } = require('../handlers/common/utils');
        const remainingHpPercent = Math.floor((this.activeWorldBoss.currentHp / boss.hp) * 100);
        
        // 데미지 순위 정렬
        const sortedParticipants = [...this.activeWorldBoss.participants].sort((a, b) => b.damage - a.damage);
        
        const defeatMessages = [
            '보스의 압도적인 힘 앞에 무릎을 꿇었습니다...',
            '영웅들의 희생이 헛되지 않을 것입니다...',
            '패배했지만, 전설은 계속됩니다...',
            '이것은 끝이 아닌 시작입니다...'
        ];
        
        const defeatEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('💀 전멸! 보스 토벌 실패...')
            .setDescription(`${boss.emoji} **${boss.name}**의 승리!\n\n_${defeatMessages[Math.floor(Math.random() * defeatMessages.length)]}_`)
            .setThumbnail('https://media.giphy.com/media/l0HlQ7LRalQqdWfao/giphy.gif')
            .addFields(
                {
                    name: '⚔️ 전투 개요',
                    value: `\`\`\`yaml\n보스: ${boss.name} (Lv.${boss.level})\n전투 턴수: ${turn}턴\n보스 잔여 HP: ${formatNumber(this.activeWorldBoss.currentHp)} (${remainingHpPercent}%)\n총 가한 데미지: ${formatNumber(this.activeWorldBoss.totalDamage)}\n\`\`\``,
                    inline: false
                }
            );

        // 전투 기록
        let battleRecordText = '```diff\n';
        sortedParticipants.forEach((p, index) => {
            const damagePercent = Math.floor((p.damage / this.activeWorldBoss.totalDamage) * 100);
            battleRecordText += `${index + 1}. ${p.username} 💀\n`;
            battleRecordText += `   데미지: ${formatNumber(p.damage)} (${damagePercent}%)\n`;
            battleRecordText += `   - ${p.deathTurn}턴째 전사\n`;
        });
        battleRecordText += '```';
        
        defeatEmbed.addFields({
            name: '🪦 영웅들의 최후',
            value: battleRecordText,
            inline: false
        });

        // 보스 상태
        defeatEmbed.addFields({
            name: '👹 보스 상태',
            value: `\`\`\`diff\n+ HP: ${formatNumber(this.activeWorldBoss.currentHp)} / ${formatNumber(boss.hp)}\n+ 방어력: ${boss.defense}\n+ 공격력: ${boss.attack}\n\n- ${100 - remainingHpPercent}%의 피해를 입혔습니다\n\`\`\``,
            inline: false
        });

        defeatEmbed.setFooter({ text: '💪 더 강해져서 다시 도전하세요!' })
            .setTimestamp();

        await channel.send({ embeds: [defeatEmbed] });

        // 보스 초기화 및 메시지 정리
        await this.cleanupBossMessage(channel);
        this.activeWorldBoss = null;
        this.lastSpawnTime = Date.now(); // 다음 소환을 위한 시간 기록
        this.saveLastSpawnTime();
    }

    // 시간 초과 패배 처리
    async handleTimeout(channel, turn) {
        const boss = this.activeWorldBoss.boss;
        const { formatNumber } = require('../handlers/common/utils');
        const remainingHpPercent = Math.floor((this.activeWorldBoss.currentHp / boss.hp) * 100);
        
        // 데미지 순위 정렬
        const sortedParticipants = [...this.activeWorldBoss.participants].sort((a, b) => b.damage - a.damage);
        
        const timeoutMessages = [
            '시간이 부족했습니다! 보스가 도망갔습니다...',
            '보스가 지쳤지만, 영웅들도 한계에 도달했습니다...',
            '전투가 너무 길어져 보스가 물러났습니다...',
            '다음엔 더 빠른 공략이 필요합니다!'
        ];
        
        const timeoutEmbed = new EmbedBuilder()
            .setColor('#FF6600')
            .setTitle('⏱️ 시간 초과! 보스 토벌 실패...')
            .setDescription(`**50턴**을 초과했습니다!\n\n_${timeoutMessages[Math.floor(Math.random() * timeoutMessages.length)]}_`)
            .setThumbnail('https://media.giphy.com/media/l1J9u3TZfpmeDLkD6/giphy.gif')
            .addFields(
                {
                    name: '⚔️ 전투 개요',
                    value: `\`\`\`yaml\n보스: ${boss.name} (Lv.${boss.level})\n전투 턴수: ${turn}턴 (제한시간 초과)\n보스 잔여 HP: ${formatNumber(this.activeWorldBoss.currentHp)} (${remainingHpPercent}%)\n총 가한 데미지: ${formatNumber(this.activeWorldBoss.totalDamage)}\n\`\`\``,
                    inline: false
                }
            );

        // 전투 기록
        let battleRecordText = '```diff\n';
        sortedParticipants.forEach((p, index) => {
            const damagePercent = Math.floor((p.damage / this.activeWorldBoss.totalDamage) * 100);
            const statusIcon = p.isDead ? '💀' : '⚔️';
            battleRecordText += `${index + 1}. ${p.username} ${statusIcon}\n`;
            battleRecordText += `   데미지: ${formatNumber(p.damage)} (${damagePercent}%)\n`;
            if (p.isDead) {
                battleRecordText += `   - ${p.deathTurn}턴째 전사\n`;
            } else {
                battleRecordText += `   + HP: ${p.currentHp}/${p.maxHp}\n`;
            }
        });
        battleRecordText += '```';
        
        timeoutEmbed.addFields({
            name: '📊 전투 기록',
            value: battleRecordText,
            inline: false
        });

        // 생존자와 사망자 요약
        const survivors = this.activeWorldBoss.participants.filter(p => !p.isDead);
        const casualties = this.activeWorldBoss.participants.filter(p => p.isDead);
        
        if (survivors.length > 0) {
            timeoutEmbed.addFields({
                name: '🛡️ 생존자',
                value: survivors.map(p => {
                    const hpPercent = Math.floor((p.currentHp / p.maxHp) * 100);
                    const hpEmoji = hpPercent > 50 ? '💚' : hpPercent > 20 ? '💛' : '❤️';
                    return `${hpEmoji} **${p.username}** (${p.currentHp}/${p.maxHp} HP)`;
                }).join('\n'),
                inline: true
            });
        }
        
        if (casualties.length > 0) {
            timeoutEmbed.addFields({
                name: '💀 전사자',
                value: casualties.map(p => `**${p.username}** (${p.deathTurn}턴째)`).join('\n'),
                inline: true
            });
        }

        // 보스 상태 분석
        let analysisText = '';
        if (remainingHpPercent <= 10) {
            analysisText = '⚠️ **거의 다 잡았습니다!** 조금만 더 빨랐다면...';
        } else if (remainingHpPercent <= 30) {
            analysisText = '📊 **상당한 피해를 입혔습니다!** 전력을 보강하면 가능합니다.';
        } else if (remainingHpPercent <= 50) {
            analysisText = '💪 **절반의 성공!** 더 강한 화력이 필요합니다.';
        } else {
            analysisText = '🔥 **화력 부족!** 장비와 레벨을 올려서 도전하세요.';
        }
        
        timeoutEmbed.addFields({
            name: '💡 전투 분석',
            value: analysisText,
            inline: false
        });

        timeoutEmbed.setFooter({ text: '⚡ 더 빠른 공략으로 다시 도전하세요!' })
            .setTimestamp();

        await channel.send({ embeds: [timeoutEmbed] });

        // 보스 초기화 및 메시지 정리
        await this.cleanupBossMessage(channel);
        this.activeWorldBoss = null;
        this.lastSpawnTime = Date.now(); // 다음 소환을 위한 시간 기록
        this.saveLastSpawnTime();
    }

    // 보스 메시지 정리
    async cleanupBossMessage(channel) {
        try {
            if (this.activeWorldBoss && this.activeWorldBoss.messageId) {
                const message = await channel.messages.fetch(this.activeWorldBoss.messageId).catch(err => {
                    console.log('[Boss] 메시지를 찾을 수 없음:', err.code);
                    return null;
                });
                
                if (message) {
                    // 메시지 내용을 "보스가 사라졌습니다"로 업데이트
                    const cleanupEmbed = new EmbedBuilder()
                        .setColor('#808080')
                        .setTitle('💨 보스가 사라졌습니다')
                        .setDescription('보스 레이드가 종료되었습니다.\n다음 보스를 기다려주세요!')
                        .setTimestamp();
                    
                    await message.edit({ 
                        embeds: [cleanupEmbed], 
                        components: [] 
                    }).catch(err => {
                        console.error('[Boss] 메시지 업데이트 실패:', err.message);
                    });
                    
                    // 5초 후 메시지 삭제
                    setTimeout(async () => {
                        if (message.deletable) {
                            await message.delete().catch(err => {
                                console.error('[Boss] 메시지 삭제 실패:', err.message);
                            });
                        }
                    }, 5000);
                    
                    console.log('[Boss] 보스 메시지 업데이트 및 삭제 예약됨');
                }
            }
        } catch (error) {
            if (error.code === 10008) {
                console.log('[Boss] 메시지가 이미 삭제됨');
            } else if (error.code === 50001) {
                console.log('[Boss] 메시지 수정 권한 없음');
            } else {
                console.error('[Boss] 메시지 정리 중 오류:', error);
            }
        } finally {
            // 메시지 ID 초기화
            if (this.activeWorldBoss) {
                this.activeWorldBoss.messageId = null;
            }
        }
    }

    // 보스 떠남 처리
    async despawnBoss(client, reason = '보스가 떠났습니다.') {
        console.log('[Boss] despawnBoss 호출됨 - 이유:', reason);
        console.log('[Boss] 현재 스택 트레이스:', new Error().stack.slice(0, 500));
        
        if (!this.activeWorldBoss) return;

        try {
            const channel = await client.channels.fetch(this.activeWorldBoss.channelId);
            if (!channel) return;

            // 타임아웃 취소
            if (this.activeWorldBoss.timeoutId) {
                clearTimeout(this.activeWorldBoss.timeoutId);
            }

            // 떠남 메시지
            const despawnEmbed = new EmbedBuilder()
                .setColor('#808080')
                .setTitle('💨 보스가 떠났습니다')
                .setDescription(`${this.activeWorldBoss.boss.emoji} **${this.activeWorldBoss.boss.name}**\n\n${reason}`)
                .setFooter({ text: '다음 보스를 기다려주세요!' })
                .setTimestamp();

            await channel.send({ embeds: [despawnEmbed] });
            
            // 메시지 정리
            await this.cleanupBossMessage(channel);
            
            // 보스 초기화
            this.activeWorldBoss = null;
            this.READY_PARTICIPANTS.clear();
            this.lastSpawnTime = Date.now(); // 다음 소환을 위한 시간 기록
            this.saveLastSpawnTime();
            console.log('[Boss] 보스가 떠남:', reason);
        } catch (error) {
            console.error('[Boss] 보스 떠남 처리 오류:', error);
        }
    }

    // 마지막 소환 시간 불러오기
    loadLastSpawnTime() {
        try {
            const fs = require('fs');
            const path = require('path');
            const stateFile = path.join(__dirname, '..', 'data', 'bossState.json');
            
            if (fs.existsSync(stateFile)) {
                const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
                console.log('[Boss] 마지막 소환 시간 불러옴:', new Date(state.lastSpawnTime));
                
                // 활성 보스가 있었는지 확인
                if (state.activeWorldBoss) {
                    const elapsed = Date.now() - state.activeWorldBoss.startTime;
                    // 30분 이내라면 보스가 아직 활성 상태
                    if (elapsed < 30 * 60 * 1000) {
                        console.log('[Boss] 활성 보스 감지:', state.activeWorldBoss.boss?.name || state.activeWorldBoss.bossName);
                        console.log('[Boss] 남은 시간:', Math.floor((30 * 60 * 1000 - elapsed) / 60000), '분');
                        // 여기서는 단순히 활성 보스가 있음을 표시만 함
                        // 실제 복원은 서버 시작 시 별도로 처리
                    }
                }
                
                return state.lastSpawnTime || 0;
            }
        } catch (error) {
            console.error('[Boss] 상태 파일 로드 오류:', error);
        }
        return 0;
    }
    
    // 마지막 소환 시간 저장 (비동기)
    async saveLastSpawnTime() {
        try {
            const fs = require('fs').promises;
            const state = { 
                lastSpawnTime: this.lastSpawnTime,
                activeWorldBoss: this.activeWorldBoss ? {
                    boss: this.activeWorldBoss.boss,
                    bossName: this.activeWorldBoss.boss.name,
                    startTime: this.activeWorldBoss.startTime,
                    currentHp: this.activeWorldBoss.currentHp,
                    maxHp: this.activeWorldBoss.maxHp,
                    participants: this.activeWorldBoss.participants.length,
                    messageId: this.activeWorldBoss.messageId,
                    channelId: this.activeWorldBoss.channelId
                } : null
            };
            await fs.writeFile(this.STATE_FILE, JSON.stringify(state, null, 2));
            console.log('[Boss] 상태 저장 완료:', new Date(this.lastSpawnTime));
        } catch (error) {
            console.error('[Boss] 상태 파일 저장 오류:', error);
            // 파일 저장 실패해도 봇은 계속 실행
        }
    }
    
    // 보스 상태 불러오기
    loadBossState() {
        try {
            const fs = require('fs');
            const path = require('path');
            const stateFile = path.join(__dirname, '..', 'data', 'bossState.json');
            
            if (fs.existsSync(stateFile)) {
                const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
                
                // 활성 보스가 있었는지 확인
                if (state.activeWorldBoss) {
                    const elapsed = Date.now() - state.activeWorldBoss.startTime;
                    // 30분 이내라면 보스가 아직 활성 상태
                    if (elapsed < 30 * 60 * 1000) {
                        console.log('[Boss] 활성 보스 복원:', state.activeWorldBoss.boss?.name || state.activeWorldBoss.bossName);
                        console.log('[Boss] 남은 시간:', Math.floor((30 * 60 * 1000 - elapsed) / 60000), '분');
                        
                        // 보스 복원
                        this.activeWorldBoss = {
                            boss: state.activeWorldBoss.boss || {
                                name: state.activeWorldBoss.bossName,
                                hp: state.activeWorldBoss.maxHp,
                                attack: 100,
                                defense: 50,
                                level: 50,
                                requiredLevel: 20,
                                emoji: '👹',
                                rewards: { gold: 5000, exp: 1000 }
                            },
                            currentHp: state.activeWorldBoss.currentHp,
                            maxHp: state.activeWorldBoss.maxHp,
                            participants: [],
                            startTime: state.activeWorldBoss.startTime,
                            totalDamage: state.activeWorldBoss.maxHp - state.activeWorldBoss.currentHp,
                            messageId: state.activeWorldBoss.messageId,
                            channelId: state.activeWorldBoss.channelId
                        };
                    } else {
                        console.log('[Boss] 저장된 보스가 시간 초과됨');
                    }
                }
            }
        } catch (error) {
            console.error('[Boss] 보스 상태 로드 오류:', error);
        }
    }
    
    // 자동 소환 스케줄러
    startAutoSpawn(client) {
        // 이미 인터벌이 실행 중이면 중복 실행 방지
        if (this.spawnCheckInterval) {
            console.log('[Boss] 자동 소환 스케줄러가 이미 실행 중입니다.');
            return;
        }
        
        // 시작 시 채널 정리
        this.cleanupOldBossMessages(client);
        
        // 다음 소환 시간 계산
        const now = Date.now();
        const timeSinceLastSpawn = now - this.lastSpawnTime;
        const timeUntilNextSpawn = Math.max(0, this.SPAWN_COOLDOWN - timeSinceLastSpawn);
        
        console.log(`[Boss] 다음 보스 소환까지: ${Math.round(timeUntilNextSpawn / 60000)}분`);
        
        // 1분마다 체크
        this.spawnCheckInterval = setInterval(async () => {
            try {
                const now = Date.now();
                const timeSinceLastSpawn = now - this.lastSpawnTime;
                const timeUntilNextSpawn = Math.max(0, this.SPAWN_COOLDOWN - timeSinceLastSpawn);
                
                console.log(`[Boss Auto Spawn] 체크 - 마지막 소환: ${Math.round(timeSinceLastSpawn / 60000)}분 전, 다음 소환까지: ${Math.round(timeUntilNextSpawn / 60000)}분`);
                
                if (await this.canSpawnBoss()) {
                    console.log('[Boss Auto Spawn] 보스 소환 조건 충족! 소환 시작...');
                    await this.spawnRandomBoss(client);
                }
            } catch (error) {
                console.error('[Boss] 자동 소환 체크 중 오류:', error);
            }
        }, 60000);

        console.log('[Boss] 자동 소환 스케줄러 시작됨');
    }
    
    // 오래된 보스 메시지 정리
    async cleanupOldBossMessages(client) {
        try {
            const channel = await client.channels.fetch(this.SPAWN_CHANNEL_ID);
            if (!channel) return;
            
            console.log('[Boss] 채널에서 오래된 보스 메시지 정리 중...');
            
            // 최근 100개 메시지 가져오기
            const messages = await channel.messages.fetch({ limit: 100 });
            
            for (const message of messages.values()) {
                // 봇이 보낸 메시지이고 보스 관련 메시지인 경우
                if (message.author.id === client.user.id && 
                    message.embeds.length > 0 &&
                    (message.embeds[0].title?.includes('보스') || 
                     message.embeds[0].title?.includes('Boss') ||
                     message.embeds[0].title?.includes('레이드'))) {
                    
                    // 현재 활성 보스 메시지가 아닌 경우 삭제
                    if (!this.activeWorldBoss || message.id !== this.activeWorldBoss.messageId) {
                        try {
                            await message.delete();
                            console.log(`[Boss] 오래된 보스 메시지 삭제됨: ${message.id}`);
                        } catch (err) {
                            console.error(`[Boss] 메시지 삭제 실패: ${err.message}`);
                        }
                    }
                }
            }
            
            console.log('[Boss] 채널 정리 완료');
        } catch (error) {
            console.error('[Boss] 채널 정리 중 오류:', error);
        }
    }
}

// 월드보스 시작 처리
async function handleWorldBossStart(interaction) {
    console.log('[Boss Debug] handleWorldBossStart - activeWorldBoss:', worldBossSystemInstance.activeWorldBoss ? 'exists' : 'null');
    console.log('[Boss Debug] handleWorldBossStart - worldBossSystem instance:', worldBossSystemInstance.constructor.name);
    
    if (!worldBossSystemInstance.activeWorldBoss) {
        return interaction.reply({
            content: '❌ 현재 진행중인 보스가 없습니다!',
            flags: 64
        });
    }
    
    // 참가자 확인
    const participant = worldBossSystemInstance.activeWorldBoss.participants.find(p => p.userId === interaction.user.id);
    if (!participant) {
        return interaction.reply({
            content: '❌ 레이드에 참가하지 않았습니다!',
            flags: 64
        });
    }
    
    // 최소 인원 확인
    if (worldBossSystemInstance.activeWorldBoss.participants.length < worldBossSystemInstance.MIN_PARTICIPANTS) {
        return interaction.reply({
            content: `❌ 최소 ${worldBossSystemInstance.MIN_PARTICIPANTS}명이 모여야 시작할 수 있습니다!`,
            flags: 64
        });
    }
    
    // 레이드 시작
    await interaction.deferUpdate();
    await worldBossSystemInstance.startBossRaid(interaction.client);
}

// 싱글톤 인스턴스 생성
const worldBossSystemInstance = new WorldBossSystem();

// 디버깅용 로그
console.log('[Boss] WorldBossSystem 싱글톤 인스턴스 생성됨');

module.exports = worldBossSystemInstance;
module.exports.handleWorldBossStart = handleWorldBossStart;