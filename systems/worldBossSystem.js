const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const BOSS_SYSTEM = require('../data/bossSystem');
const BOSS_FRAGMENTS = require('../data/bossFragments');
const buffSystem = require('../handlers/common/buffSystem');
const { calculateBossRaidDamage } = require('../handlers/common/damageCalculator');

class WorldBossSystem {
    constructor() {
        this.activeWorldBoss = null;
        this.lastSpawnTime = 0;
        this.SPAWN_CHANNEL_ID = '1391112529828384870';
        this.SPAWN_COOLDOWN = 3 * 60 * 60 * 1000; // 3시간
        this.MAX_PARTICIPANTS = 1; // 테스트용 1명
    }

    // 캐릭터의 실제 총 공격력 계산
    calculateTotalAttack(user) {
        let totalAttack = user.attack || 10; // 기본 공격력
        
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
    canSpawnBoss() {
        const now = Date.now();
        return !this.activeWorldBoss && (now - this.lastSpawnTime) >= this.SPAWN_COOLDOWN;
    }

    // 랜덤 보스 소환
    async spawnRandomBoss(client) {
        if (!this.canSpawnBoss()) {
            return false;
        }

        try {
            const channel = await client.channels.fetch(this.SPAWN_CHANNEL_ID);
            if (!channel) {
                console.error('[Boss] 채널을 찾을 수 없습니다:', this.SPAWN_CHANNEL_ID);
                return false;
            }

            // 랜덤 보스 선택
            const randomBoss = BOSS_SYSTEM.bosses[Math.floor(Math.random() * BOSS_SYSTEM.bosses.length)];
            
            // 보스 데이터 생성
            this.activeWorldBoss = {
                boss: randomBoss,
                participants: [],
                startTime: Date.now(),
                totalDamage: 0,
                currentHp: randomBoss.hp,
                maxHp: randomBoss.hp,
                messageId: null,
                channelId: this.SPAWN_CHANNEL_ID
            };

            // 보스 소환 임베드
            const spawnEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⚔️ 보스 레이드 ⚔️')
                .setDescription(`# ${randomBoss.emoji} **${randomBoss.name}**\n\n` +
                    `**거대한 그림자가 나타났습니다!**\n` +
                    `서둘러 파티를 구성하여 토벌하세요!\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
                .addFields(
                    { 
                        name: '📊 보스 정보', 
                        value: `\`\`\`레벨: ${randomBoss.level}\nHP: ${randomBoss.hp.toLocaleString()}\n공격력: ${randomBoss.attack}\n방어력: ${randomBoss.defense}\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎯 참가 조건',
                        value: `\`\`\`최소 레벨: ${randomBoss.requiredLevel}\n최대 인원: ${this.MAX_PARTICIPANTS}명\n선착순 모집\`\`\``,
                        inline: true
                    },
                    {
                        name: '🎁 보상',
                        value: `\`\`\`1등: 조각 3개\n2등: 조각 2개\n3등: 조각 1개\n골드 & 경험치\`\`\``,
                        inline: true
                    },
                    {
                        name: '⏱️ 파티 모집중',
                        value: '```diff\n- 참가자 대기중 (0/1)\n```',
                        inline: false
                    }
                )
                .setThumbnail(null)
                .setTimestamp()
                .setFooter({ text: '⚠️ 1명이 모이면 자동으로 레이드가 시작됩니다!' });

            const joinButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('world_boss_join')
                        .setLabel('⚔️ 보스 레이드 참가')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗡️'),
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

            console.log(`[Boss] ${randomBoss.name} 소환됨!`);
            
            // 30분 후 자동으로 보스 떠남 (참가자가 없을 경우)
            this.activeWorldBoss.timeoutId = setTimeout(async () => {
                if (this.activeWorldBoss && this.activeWorldBoss.participants.length === 0) {
                    await this.despawnBoss(client, '시간이 초과되어 보스가 떠났습니다.');
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
        if (!this.activeWorldBoss) {
            return interaction.reply({
                content: '❌ 현재 진행중인 보스가 없습니다!',
                ephemeral: true
            });
        }

        const userId = interaction.user.id;
        
        // 참가자 목록에서 제거
        const participantIndex = this.activeWorldBoss.participants.findIndex(p => p.userId === userId);
        if (participantIndex === -1) {
            return interaction.reply({
                content: '❌ 레이드에 참가하지 않았습니다!',
                ephemeral: true
            });
        }

        // 참가자 제거
        this.activeWorldBoss.participants.splice(participantIndex, 1);

        // 임베드 업데이트
        await this.updateBossEmbed(interaction);

        await interaction.reply({
            content: `✅ **${interaction.user.username}**님이 보스 레이드 대기열에서 나갔습니다. (${this.activeWorldBoss.participants.length}/${this.MAX_PARTICIPANTS})`,
            ephemeral: false
        });
    }

    // 보스 레이드 참가
    async joinBossRaid(interaction) {
        if (!this.activeWorldBoss) {
            return interaction.reply({
                content: '❌ 현재 진행중인 보스가 없습니다!',
                ephemeral: true
            });
        }

        const userId = interaction.user.id;
        
        // 이미 참가했는지 확인
        if (this.activeWorldBoss.participants.some(p => p.userId === userId)) {
            return interaction.reply({
                content: '❌ 이미 레이드에 참가하셨습니다!',
                ephemeral: true
            });
        }

        // 최대 인원 확인
        if (this.activeWorldBoss.participants.length >= this.MAX_PARTICIPANTS) {
            return interaction.reply({
                content: `❌ 레이드 참가 인원이 가득 찼습니다! (${this.MAX_PARTICIPANTS}/${this.MAX_PARTICIPANTS})`,
                ephemeral: true
            });
        }

        // 유저 정보 확인
        const user = await User.findOne({ discordId: userId });
        if (!user) {
            return interaction.reply({
                content: '❌ 먼저 회원가입을 해주세요!',
                ephemeral: true
            });
        }

        // 레벨 확인
        if (user.level < this.activeWorldBoss.boss.requiredLevel) {
            return interaction.reply({
                content: `❌ 레벨 ${this.activeWorldBoss.boss.requiredLevel} 이상이 되어야 참가할 수 있습니다!`,
                ephemeral: true
            });
        }

        // 참가자 추가 (실제 캐릭터 체력 사용)
        // health는 기본 체력값, 실제 최대 HP 계산
        const baseHealth = user.health || 100;
        const vitalityBonus = (user.stats?.vitality || 10) * 10; // 체력 스탯당 10 HP
        const levelBonus = user.level * 20; // 레벨당 20 HP
        const userMaxHp = baseHealth + vitalityBonus + levelBonus;
        
        this.activeWorldBoss.participants.push({
            userId: userId,
            username: interaction.user.username,
            damage: 0,
            currentHp: userMaxHp,
            maxHp: userMaxHp,
            isDead: false,
            deathTurn: null,
            user: user
        });

        // 임베드 업데이트
        await this.updateBossEmbed(interaction);

        await interaction.reply({
            content: `✅ **${interaction.user.username}**님이 보스 레이드에 참가했습니다! (${this.activeWorldBoss.participants.length}/${this.MAX_PARTICIPANTS})`,
            ephemeral: false
        });

        // 1명이 모이면 자동으로 레이드 시작
        if (this.activeWorldBoss.participants.length === this.MAX_PARTICIPANTS) {
            setTimeout(() => this.startBossRaid(interaction.client), 3000);
        }
    }

    // 보스 임베드 업데이트
    async updateBossEmbed(interaction) {
        const boss = this.activeWorldBoss.boss;
        const participantsList = this.activeWorldBoss.participants.length > 0
            ? this.activeWorldBoss.participants.map((p, i) => `${i + 1}. ${p.username}`).join('\n')
            : '대기중...';

        const statusColor = this.activeWorldBoss.participants.length === this.MAX_PARTICIPANTS ? '#00FF00' : '#FF0000';
        const statusText = this.activeWorldBoss.participants.length === this.MAX_PARTICIPANTS 
            ? `+ 파티 구성 완료! (${this.MAX_PARTICIPANTS}/${this.MAX_PARTICIPANTS})\n` 
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
                    value: `\`\`\`최소 레벨: ${boss.requiredLevel}\n최대 인원: ${this.MAX_PARTICIPANTS}명\n선착순 모집\`\`\``,
                    inline: true
                },
                {
                    name: '🎁 보상',
                    value: `\`\`\`1등: 조각 3개\n2등: 조각 2개\n3등: 조각 1개\n골드 & 경험치\`\`\``,
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
            .setFooter({ text: this.activeWorldBoss.participants.length < this.MAX_PARTICIPANTS 
                ? '⚠️ 버튼을 클릭하여 레이드에 참가하세요!' 
                : '⚔️ 3초 후 레이드가 시작됩니다!' });

        const joinButton = new ActionRowBuilder()
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
            );

        await interaction.message.edit({
            embeds: [updatedEmbed],
            components: [joinButton]
        });
    }

    // 보스 레이드 시작
    async startBossRaid(client) {
        if (!this.activeWorldBoss || this.activeWorldBoss.participants.length === 0) {
            console.error('[Boss] No active boss or participants');
            return;
        }

        // 타임아웃 취소 (레이드가 시작되었으므로)
        if (this.activeWorldBoss.timeoutId) {
            clearTimeout(this.activeWorldBoss.timeoutId);
            this.activeWorldBoss.timeoutId = null;
        }

        const channel = await client.channels.fetch(this.activeWorldBoss.channelId);
        if (!channel) {
            console.error('[Boss] Channel not found:', this.activeWorldBoss.channelId);
            return;
        }

        await channel.send('⚔️ **보스 레이드가 시작됩니다!**');

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

        while (this.activeWorldBoss.currentHp > 0 && turn < 50 && !allDead) { // 최대 50턴
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
                const damage = damageResult.damage;
                
                participant.damage += damage;
                this.activeWorldBoss.currentHp = Math.max(0, this.activeWorldBoss.currentHp - damage);
                this.activeWorldBoss.totalDamage += damage;
                
                // 스킬 사용 시 버프 확률
                if (turn % 5 === 0 && Math.random() < 0.3) {
                    const skillBuff = buffSystem.applyBuff({ activeBuffs: participant.buffs }, 'CRITICAL_UP', 10, 3);
                    participant.buffs.push(skillBuff);
                    battleLog.push(`✨ **${participant.username}**의 크리티컬 확률 증가!`);
                }

                const attackMessage = damageResult.isCritical 
                    ? `⚔️ **${participant.username}**의 치명타! 💥 **${damage.toLocaleString()}** 데미지!`
                    : `⚔️ **${participant.username}**의 공격! 💥 ${damage.toLocaleString()} 데미지!`;
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
                        const rawDamage = Math.floor(boss.attack * (0.8 + Math.random() * 0.4));
                        
                        // 방어력 계산 (장비 포함 총 방어력)
                        const totalDefense = this.calculateTotalDefense(target.user);
                        const damageReduction = totalDefense / (totalDefense + 100); // 최대 50% 감소
                        const bossDamage = Math.floor(rawDamage * (1 - damageReduction * 0.5));
                        
                        target.currentHp -= bossDamage;
                        
                        if (target.currentHp <= 0) {
                            target.currentHp = 0;
                            target.isDead = true;
                            target.deathTurn = turn;
                            battleLog.push(`💀 ${boss.name}의 공격! **${target.username}**에게 ${bossDamage} 데미지! **사망!**`);
                        } else {
                            battleLog.push(`👹 ${boss.name}의 공격! **${target.username}**에게 ${bossDamage} 데미지! (HP: ${target.currentHp}/${target.maxHp})`);
                        }
                    } else if (attackType < 0.85) { // 25% - 강력한 단일 공격
                        const target = aliveParticipants[Math.floor(Math.random() * aliveParticipants.length)];
                        const rawDamage = Math.floor(boss.attack * (1.5 + Math.random() * 0.5));
                        
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
                const hpPercentage = Math.floor((this.activeWorldBoss.currentHp / boss.hp) * 100);
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
                            value: `HP: ${this.activeWorldBoss.currentHp.toLocaleString()} / ${boss.hp.toLocaleString()} (${hpPercentage}%)`,
                            inline: true
                        },
                        {
                            name: '💥 총 데미지',
                            value: this.activeWorldBoss.totalDamage.toLocaleString(),
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
            
            // 보상 분배 (완전 랜덤)
            const rewards = [];
            
            // 모든 참가자에게 보상 (사망자도 포함, 단 보상 감소)
            for (const participant of this.activeWorldBoss.participants) {
            // 사망한 플레이어는 보상 감소
            const rewardMultiplier = participant.isDead ? 0.5 : 1.0;
            
            // 토큰 보상 계산
            const BOSS_REWARDS = require('../data/bossRewards');
            const tokenDrop = BOSS_REWARDS.calculateTokenDrop(boss.id, this.activeWorldBoss.participants.length);
            
            const user = participant.user;
            
            if (tokenDrop) {
                // 토큰 지급
                const currentTokenAmount = user.bossTokens.get(tokenDrop.token.id) || 0;
                const adjustedTokenAmount = Math.floor(tokenDrop.amount * rewardMultiplier);
                user.bossTokens.set(tokenDrop.token.id, currentTokenAmount + adjustedTokenAmount);
                
                // 골드와 경험치 지급 (사망자는 50% 패널티)
                const goldReward = Math.floor(boss.rewards.gold * 0.5 * rewardMultiplier);
                const expReward = Math.floor(boss.rewards.exp * 0.5 * rewardMultiplier);
                
                user.gold += goldReward;
                user.exp += expReward;
                
                // 레벨업 체크
                const requiredExp = user.level * 100;
                if (user.exp >= requiredExp) {
                    user.level++;
                    user.exp -= requiredExp;
                }
                
                await user.save();
                
                rewards.push({
                    username: participant.username + (participant.isDead ? ' 💀' : ''),
                    tokens: `${tokenDrop.token.emoji} ${tokenDrop.token.name} x${adjustedTokenAmount}`,
                    gold: goldReward,
                    exp: expReward,
                    damage: participant.damage,
                    isDead: participant.isDead
                });
            } else {
                // 토큰 정보가 없는 보스의 경우 기본 보상만
                const goldReward = Math.floor(boss.rewards.gold * 0.5 * rewardMultiplier);
                const expReward = Math.floor(boss.rewards.exp * 0.5 * rewardMultiplier);
                
                user.gold += goldReward;
                user.exp += expReward;
                
                await user.save();
                
                rewards.push({
                    username: participant.username + (participant.isDead ? ' 💀' : ''),
                    tokens: '토큰 획득 실패',
                    gold: goldReward,
                    exp: expReward,
                    damage: participant.damage,
                    isDead: participant.isDead
                });
            }
        }

        // 결과 임베드
        const resultEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 보스 토벌 성공!')
            .setDescription(`**${boss.emoji} ${boss.name}**을(를) 물리쳤습니다!`)
            .addFields(
                {
                    name: '📊 전투 통계',
                    value: `총 데미지: ${this.activeWorldBoss.totalDamage.toLocaleString()}\n소요 시간: ${Math.floor((Date.now() - this.activeWorldBoss.startTime) / 1000)}초`,
                    inline: false
                }
            );

        // 사망자가 있는 경우 표시
        const casualties = this.activeWorldBoss.participants.filter(p => p.isDead);
        if (casualties.length > 0) {
            resultEmbed.addFields({
                name: '💀 전사자',
                value: casualties.map(p => `${p.username} (${p.deathTurn}턴째 사망)`).join('\n'),
                inline: false
            });
        }

        resultEmbed.setTimestamp();

        // 보상 정보 추가
        rewards.forEach((reward, index) => {
            resultEmbed.addFields({
                name: `🎁 ${reward.username}의 보상`,
                value: `${reward.tokens}\n💰 ${reward.gold.toLocaleString()}G | ⭐ ${reward.exp} EXP\n💥 데미지: ${reward.damage.toLocaleString()}`,
                inline: true
            });
        });

        await channel.send({ embeds: [resultEmbed] });

        // 보스 초기화 및 메시지 정리
        await this.cleanupBossMessage(channel);
        this.activeWorldBoss = null;
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
        }
    }

    // 전멸 패배 처리
    async handleTotalDefeat(channel, turn) {
        const boss = this.activeWorldBoss.boss;
        const remainingHpPercent = Math.floor((this.activeWorldBoss.currentHp / boss.hp) * 100);
        
        const defeatEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('💀 전멸! 보스 토벌 실패...')
            .setDescription(`모든 플레이어가 사망했습니다!\n${boss.emoji} **${boss.name}**의 승리!`)
            .addFields(
                {
                    name: '📊 전투 결과',
                    value: `전투 턴수: ${turn}턴\n보스 잔여 HP: ${this.activeWorldBoss.currentHp.toLocaleString()} (${remainingHpPercent}%)\n총 가한 데미지: ${this.activeWorldBoss.totalDamage.toLocaleString()}`,
                    inline: false
                },
                {
                    name: '💀 사망자 명단',
                    value: this.activeWorldBoss.participants
                        .filter(p => p.isDead)
                        .map(p => `${p.username} (${p.deathTurn}턴째 사망)`)
                        .join('\n') || '없음',
                    inline: false
                }
            )
            .setFooter({ text: '더 강해져서 다시 도전하세요!' })
            .setTimestamp();

        await channel.send({ embeds: [defeatEmbed] });

        // 보스 초기화 및 메시지 정리
        await this.cleanupBossMessage(channel);
        this.activeWorldBoss = null;
    }

    // 시간 초과 패배 처리
    async handleTimeout(channel, turn) {
        const boss = this.activeWorldBoss.boss;
        const remainingHpPercent = Math.floor((this.activeWorldBoss.currentHp / boss.hp) * 100);
        
        const timeoutEmbed = new EmbedBuilder()
            .setColor('#FF6600')
            .setTitle('⏱️ 시간 초과! 보스 토벌 실패...')
            .setDescription(`50턴 내에 보스를 처치하지 못했습니다!`)
            .addFields(
                {
                    name: '📊 전투 결과',
                    value: `보스 잔여 HP: ${this.activeWorldBoss.currentHp.toLocaleString()} (${remainingHpPercent}%)\n총 가한 데미지: ${this.activeWorldBoss.totalDamage.toLocaleString()}`,
                    inline: false
                },
                {
                    name: '⚔️ 생존자',
                    value: this.activeWorldBoss.participants
                        .filter(p => !p.isDead)
                        .map(p => `${p.username} (HP: ${p.currentHp}/${p.maxHp})`)
                        .join('\n') || '없음',
                    inline: true
                },
                {
                    name: '💀 사망자',
                    value: this.activeWorldBoss.participants
                        .filter(p => p.isDead)
                        .map(p => `${p.username} (${p.deathTurn}턴째)`)
                        .join('\n') || '없음',
                    inline: true
                }
            )
            .setFooter({ text: '더 빠르게 처치해야 합니다!' })
            .setTimestamp();

        await channel.send({ embeds: [timeoutEmbed] });

        // 보스 초기화 및 메시지 정리
        await this.cleanupBossMessage(channel);
        this.activeWorldBoss = null;
    }

    // 보스 메시지 정리
    async cleanupBossMessage(channel) {
        try {
            if (this.activeWorldBoss && this.activeWorldBoss.messageId) {
                const message = await channel.messages.fetch(this.activeWorldBoss.messageId);
                if (message) {
                    await message.delete();
                    console.log('[Boss] 보스 메시지 삭제됨');
                }
            }
        } catch (error) {
            console.error('[Boss] 메시지 삭제 실패:', error);
        }
    }

    // 보스 떠남 처리
    async despawnBoss(client, reason = '보스가 떠났습니다.') {
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
            console.log('[Boss] 보스가 떠남:', reason);
        } catch (error) {
            console.error('[Boss] 보스 떠남 처리 오류:', error);
        }
    }

    // 자동 소환 스케줄러
    startAutoSpawn(client) {
        // 1분마다 체크
        setInterval(async () => {
            if (this.canSpawnBoss()) {
                await this.spawnRandomBoss(client);
            }
        }, 60000);

        console.log('[Boss] 자동 소환 스케줄러 시작됨');
    }
}

module.exports = new WorldBossSystem();