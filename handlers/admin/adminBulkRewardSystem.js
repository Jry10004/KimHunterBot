const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const User = require('../../models/User');
const { formatNumber, isAdmin } = require('../common/utils');
const { createItem, rarityEmojis } = require('../../data/items');

class AdminBulkRewardSystem {
    constructor() {
        this.pendingBulkRewards = new Map(); // 진행 중인 일괄 보상
        this.bulkProcessing = new Map(); // 처리 중인 작업
    }

    // 전체 지급 메인 메뉴
    async showBulkRewardMenu(interaction) {
        if (!isAdmin(interaction.user.id)) {
            return await interaction.reply({ 
                content: '❌ 관리자만 접근할 수 있습니다!', 
                flags: 64 
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#00bfff')
            .setTitle('👥 전체 유저 보상 지급')
            .setDescription('모든 유저 또는 조건에 맞는 유저들에게 보상을 지급합니다.')
            .addFields(
                { name: '🌐 전체 지급', value: '모든 등록된 유저', inline: true },
                { name: '📊 레벨 범위', value: '특정 레벨 유저만', inline: true },
                { name: '🎯 조건부', value: '다양한 조건 설정', inline: true }
            )
            .setFooter({ text: '⚠️ 전체 지급은 신중하게 사용하세요!' });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_bulk_all')
                    .setLabel('🌐 모든 유저')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_bulk_level')
                    .setLabel('📊 레벨 범위')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_bulk_active')
                    .setLabel('🟢 활성 유저')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🆕'),
                new ButtonBuilder()
                    .setCustomId('admin_bulk_custom')
                    .setLabel('🎯 커스텀 조건')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_reward_menu')
                    .setLabel('🔙 보상 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 모든 유저 대상 보상 설정
    async setupAllUsersReward(interaction) {
        const users = await User.countDocuments({ registered: true });

        const rewardTypeSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_bulk_reward_type')
            .setPlaceholder('🎁 지급할 보상 종류를 선택하세요')
            .addOptions([
                { label: '골드', value: 'gold', emoji: '💰' },
                { label: '경험치', value: 'exp', emoji: '✨' },
                { label: '티켓', value: 'ticket', emoji: '🎫' },
                { label: '아이템', value: 'item', emoji: '🎁' },
                { label: '스탯 포인트', value: 'statpoint', emoji: '💎' },
                { label: '복합 보상', value: 'mixed', emoji: '📦' }
            ]);

        const embed = new EmbedBuilder()
            .setColor('#00bfff')
            .setTitle('🌐 전체 유저 보상 지급')
            .setDescription(`**${users}명**의 모든 등록된 유저에게 보상을 지급합니다.`)
            .addFields(
                { name: '대상 인원', value: `${users}명`, inline: true },
                { name: '선택된 보상', value: '없음', inline: true },
                { name: '지급 수량', value: '없음', inline: true }
            );

        const confirmButton = new ButtonBuilder()
            .setCustomId('admin_bulk_confirm')
            .setLabel('✅ 지급 시작')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const cancelButton = new ButtonBuilder()
            .setCustomId('admin_bulk_menu')
            .setLabel('❌ 취소')
            .setStyle(ButtonStyle.Secondary);

        await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(rewardTypeSelect),
                new ActionRowBuilder().addComponents(confirmButton, cancelButton)
            ]
        });

        this.pendingBulkRewards.set(interaction.user.id, {
            type: 'all',
            targetCount: users,
            rewardType: null,
            rewardData: {}
        });
    }

    // 레벨 범위 보상 설정
    async setupLevelRangeReward(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_bulk_level_modal')
            .setTitle('📊 레벨 범위 설정');

        const minLevelInput = new TextInputBuilder()
            .setCustomId('min_level')
            .setLabel('최소 레벨')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 10')
            .setRequired(true)
            .setMaxLength(3);

        const maxLevelInput = new TextInputBuilder()
            .setCustomId('max_level')
            .setLabel('최대 레벨')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 50')
            .setRequired(true)
            .setMaxLength(3);

        modal.addComponents(
            new ActionRowBuilder().addComponents(minLevelInput),
            new ActionRowBuilder().addComponents(maxLevelInput)
        );

        await interaction.showModal(modal);
    }

    // 활성 유저 보상 설정 (최근 7일 이내 활동)
    async setupActiveUsersReward(interaction) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

        // 최근 활동 유저 수 계산 (출석체크 또는 사냥 기록 기준)
        const activeUsers = await User.countDocuments({ 
            registered: true,
            $or: [
                { lastDaily: { $gte: sevenDaysAgoStr } },
                { lastHunt: { $gte: sevenDaysAgo.getTime() } }
            ]
        });

        const rewardTypeSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_bulk_reward_type')
            .setPlaceholder('🎁 지급할 보상 종류를 선택하세요')
            .addOptions([
                { label: '골드', value: 'gold', emoji: '💰' },
                { label: '경험치', value: 'exp', emoji: '✨' },
                { label: '티켓', value: 'ticket', emoji: '🎫' },
                { label: '아이템', value: 'item', emoji: '🎁' },
                { label: '복합 보상', value: 'mixed', emoji: '📦' }
            ]);

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🟢 활성 유저 보상 지급')
            .setDescription(`최근 7일 이내 활동한 **${activeUsers}명**의 유저에게 보상을 지급합니다.`)
            .addFields(
                { name: '대상 인원', value: `${activeUsers}명`, inline: true },
                { name: '선택된 보상', value: '없음', inline: true },
                { name: '지급 수량', value: '없음', inline: true }
            );

        await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(rewardTypeSelect),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('admin_bulk_confirm')
                        .setLabel('✅ 지급 시작')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('admin_bulk_menu')
                        .setLabel('❌ 취소')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });

        this.pendingBulkRewards.set(interaction.user.id, {
            type: 'active',
            targetCount: activeUsers,
            rewardType: null,
            rewardData: {}
        });
    }

    // 보상 타입 선택 후 상세 설정
    async handleRewardTypeSelect(interaction) {
        const rewardType = interaction.values[0];
        const adminId = interaction.user.id;
        const bulk = this.pendingBulkRewards.get(adminId);

        if (!bulk) return;

        bulk.rewardType = rewardType;

        // 보상 타입별 추가 설정
        switch (rewardType) {
            case 'gold':
                await this.showGoldAmountSelect(interaction);
                break;
            case 'exp':
                await this.showExpAmountSelect(interaction);
                break;
            case 'ticket':
                await this.showTicketSelect(interaction);
                break;
            case 'item':
                await this.showItemSelect(interaction);
                break;
            case 'statpoint':
                await this.showStatPointSelect(interaction);
                break;
            case 'mixed':
                await this.showMixedRewardModal(interaction);
                break;
        }
    }

    // 골드 수량 선택
    async showGoldAmountSelect(interaction) {
        const bulk = this.pendingBulkRewards.get(interaction.user.id);
        
        const amountSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_bulk_gold_amount')
            .setPlaceholder('💰 지급할 골드를 선택하세요')
            .addOptions([
                { label: '1,000G', value: '1000' },
                { label: '5,000G', value: '5000' },
                { label: '10,000G', value: '10000' },
                { label: '50,000G', value: '50000' },
                { label: '100,000G', value: '100000' },
                { label: '500,000G', value: '500000' }
            ]);

        const embed = interaction.message.embeds[0];
        embed.data.fields[1].value = '💰 골드';

        await interaction.update({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(amountSelect),
                interaction.message.components[1]
            ]
        });
    }

    // 경험치 수량 선택
    async showExpAmountSelect(interaction) {
        const amountSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_bulk_exp_amount')
            .setPlaceholder('✨ 지급할 경험치를 선택하세요')
            .addOptions([
                { label: '500 EXP', value: '500' },
                { label: '1,000 EXP', value: '1000' },
                { label: '5,000 EXP', value: '5000' },
                { label: '10,000 EXP', value: '10000' },
                { label: '50,000 EXP', value: '50000' },
                { label: '레벨 +1', value: 'level_1' },
                { label: '레벨 +5', value: 'level_5' }
            ]);

        const embed = interaction.message.embeds[0];
        embed.data.fields[1].value = '✨ 경험치';

        await interaction.update({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(amountSelect),
                interaction.message.components[1]
            ]
        });
    }

    // 티켓 선택
    async showTicketSelect(interaction) {
        const ticketSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_bulk_ticket_type')
            .setPlaceholder('🎫 지급할 티켓을 선택하세요')
            .addOptions([
                { label: '사냥 티켓 +5', value: 'hunting_5' },
                { label: '던전 티켓 +3', value: 'dungeon_3' },
                { label: 'PVP 티켓 +5', value: 'pvp_5' },
                { label: '미니게임 티켓 +5', value: 'minigame_5' },
                { label: '모든 티켓 +5', value: 'all_5' },
                { label: '모든 티켓 최대 충전', value: 'all_max' }
            ]);

        const embed = interaction.message.embeds[0];
        embed.data.fields[1].value = '🎫 티켓';

        await interaction.update({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(ticketSelect),
                interaction.message.components[1]
            ]
        });
    }

    // 복합 보상 모달
    async showMixedRewardModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_bulk_mixed_modal')
            .setTitle('📦 복합 보상 설정');

        const goldInput = new TextInputBuilder()
            .setCustomId('gold_amount')
            .setLabel('골드 (선택사항)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 10000')
            .setRequired(false);

        const expInput = new TextInputBuilder()
            .setCustomId('exp_amount')
            .setLabel('경험치 (선택사항)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 5000')
            .setRequired(false);

        const ticketInput = new TextInputBuilder()
            .setCustomId('ticket_amount')
            .setLabel('티켓 수량 (모든 티켓, 선택사항)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('예: 5')
            .setRequired(false);

        const messageInput = new TextInputBuilder()
            .setCustomId('reward_message')
            .setLabel('보상 메시지')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('유저들에게 표시될 메시지')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(goldInput),
            new ActionRowBuilder().addComponents(expInput),
            new ActionRowBuilder().addComponents(ticketInput),
            new ActionRowBuilder().addComponents(messageInput)
        );

        await interaction.showModal(modal);
    }

    // 일괄 보상 처리
    async processBulkReward(interaction) {
        const adminId = interaction.user.id;
        const bulk = this.pendingBulkRewards.get(adminId);

        if (!bulk || this.bulkProcessing.has(adminId)) {
            return await interaction.reply({
                content: '❌ 이미 처리 중이거나 보상 정보가 없습니다.',
                ephemeral: true
            });
        }

        // 처리 시작
        this.bulkProcessing.set(adminId, true);

        // 진행 상태 임베드
        const progressEmbed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('⏳ 보상 지급 진행 중...')
            .setDescription('잠시만 기다려주세요...')
            .addFields(
                { name: '대상 인원', value: `${bulk.targetCount}명`, inline: true },
                { name: '진행 상태', value: '0%', inline: true },
                { name: '처리된 유저', value: '0명', inline: true }
            );

        await interaction.update({
            embeds: [progressEmbed],
            components: []
        });

        try {
            // 대상 유저 조회
            let query = { registered: true };
            
            if (bulk.type === 'level') {
                query.level = { $gte: bulk.minLevel, $lte: bulk.maxLevel };
            } else if (bulk.type === 'active') {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
                query.$or = [
                    { lastDaily: { $gte: sevenDaysAgoStr } },
                    { lastHunt: { $gte: sevenDaysAgo.getTime() } }
                ];
            }

            const users = await User.find(query);
            let processed = 0;
            let success = 0;
            let failed = 0;

            // 배치 처리 (100명씩)
            const batchSize = 100;
            for (let i = 0; i < users.length; i += batchSize) {
                const batch = users.slice(i, i + batchSize);
                
                await Promise.all(batch.map(async (user) => {
                    try {
                        await this.giveRewardToUser(user, bulk.rewardData);
                        success++;
                    } catch (error) {
                        console.error(`보상 지급 실패 (${user.nickname}):`, error);
                        failed++;
                    }
                    processed++;
                }));

                // 진행 상태 업데이트 (10% 단위로)
                const progress = Math.floor((processed / users.length) * 100);
                if (progress % 10 === 0) {
                    progressEmbed.data.fields[1].value = `${progress}%`;
                    progressEmbed.data.fields[2].value = `${processed}명`;
                    
                    await interaction.editReply({
                        embeds: [progressEmbed]
                    });
                }
            }

            // 완료 임베드
            const completeEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ 보상 지급 완료!')
                .setDescription(bulk.rewardData.message || '모든 대상 유저에게 보상이 지급되었습니다.')
                .addFields(
                    { name: '총 대상', value: `${users.length}명`, inline: true },
                    { name: '성공', value: `${success}명`, inline: true },
                    { name: '실패', value: `${failed}명`, inline: true }
                )
                .setFooter({ text: `관리자: ${interaction.user.username}` })
                .setTimestamp();

            // 보상 내역 추가
            if (bulk.rewardData.gold) {
                completeEmbed.addFields({ 
                    name: '💰 골드', 
                    value: `+${formatNumber(bulk.rewardData.gold)}G`, 
                    inline: true 
                });
            }
            if (bulk.rewardData.exp) {
                completeEmbed.addFields({ 
                    name: '✨ 경험치', 
                    value: `+${formatNumber(bulk.rewardData.exp)} EXP`, 
                    inline: true 
                });
            }
            if (bulk.rewardData.tickets) {
                completeEmbed.addFields({ 
                    name: '🎫 티켓', 
                    value: Object.entries(bulk.rewardData.tickets)
                        .map(([type, amount]) => `${type}: +${amount}`)
                        .join('\n'), 
                    inline: true 
                });
            }

            await interaction.editReply({
                embeds: [completeEmbed],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('admin_bulk_menu')
                            .setLabel('🔙 전체 지급 메뉴')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('admin_reward_menu')
                            .setLabel('📋 보상 메뉴')
                            .setStyle(ButtonStyle.Secondary)
                    )
                ]
            });

            // 로그 기록
            console.log(`[전체 보상] ${interaction.user.username} → ${users.length}명: ${JSON.stringify(bulk.rewardData)}`);

        } catch (error) {
            console.error('전체 보상 처리 오류:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ 오류 발생')
                .setDescription('보상 지급 중 오류가 발생했습니다.')
                .addFields({ name: '오류 내용', value: error.message });

            await interaction.editReply({
                embeds: [errorEmbed],
                components: []
            });
        } finally {
            // 정리
            this.bulkProcessing.delete(adminId);
            this.pendingBulkRewards.delete(adminId);
        }
    }

    // 개별 유저에게 보상 지급
    async giveRewardToUser(user, rewardData) {
        // 골드 지급
        if (rewardData.gold) {
            user.gold += rewardData.gold;
        }

        // 경험치 지급
        if (rewardData.exp) {
            user.exp += rewardData.exp;
            
            // 레벨업 체크
            while (user.exp >= user.level * 100) {
                user.exp -= user.level * 100;
                user.level++;
                user.statPoints = (user.statPoints || 0) + 5;
            }
        }

        // 레벨 증가
        if (rewardData.levelUp) {
            user.level += rewardData.levelUp;
            user.statPoints = (user.statPoints || 0) + (rewardData.levelUp * 5);
        }

        // 티켓 지급
        if (rewardData.tickets) {
            if (rewardData.tickets.hunting) {
                user.huntingTickets = Math.min(20, (user.huntingTickets || 0) + rewardData.tickets.hunting);
            }
            if (rewardData.tickets.dungeon) {
                user.dungeonTickets = Math.min(5, (user.dungeonTickets || 0) + rewardData.tickets.dungeon);
            }
            if (rewardData.tickets.pvp) {
                user.pvpTickets = Math.min(20, (user.pvpTickets || 0) + rewardData.tickets.pvp);
            }
            if (rewardData.tickets.minigame) {
                user.minigameTickets = Math.min(20, (user.minigameTickets || 0) + rewardData.tickets.minigame);
            }
        }

        // 아이템 지급
        if (rewardData.item) {
            if (!user.inventory) user.inventory = [];
            user.inventory.push(rewardData.item);
        }

        // 스탯 포인트 지급
        if (rewardData.statPoints) {
            user.statPoints = (user.statPoints || 0) + rewardData.statPoints;
        }

        await user.save();
    }

    // 선택 메뉴 핸들러
    async handleSelectMenu(interaction) {
        const customId = interaction.customId;
        const adminId = interaction.user.id;
        const bulk = this.pendingBulkRewards.get(adminId);

        if (!bulk) return;

        const embed = interaction.message.embeds[0];
        const components = interaction.message.components;

        // 골드 수량 선택
        if (customId === 'admin_bulk_gold_amount') {
            bulk.rewardData.gold = parseInt(interaction.values[0]);
            embed.data.fields[2].value = `${formatNumber(bulk.rewardData.gold)}G`;
            components[1].components[0].data.disabled = false;
            await interaction.update({ embeds: [embed], components: components });
        }

        // 경험치 수량 선택
        else if (customId === 'admin_bulk_exp_amount') {
            const value = interaction.values[0];
            if (value.startsWith('level_')) {
                bulk.rewardData.levelUp = parseInt(value.split('_')[1]);
                embed.data.fields[2].value = `레벨 +${bulk.rewardData.levelUp}`;
            } else {
                bulk.rewardData.exp = parseInt(value);
                embed.data.fields[2].value = `${formatNumber(bulk.rewardData.exp)} EXP`;
            }
            components[1].components[0].data.disabled = false;
            await interaction.update({ embeds: [embed], components: components });
        }

        // 티켓 타입 선택
        else if (customId === 'admin_bulk_ticket_type') {
            const [type, amount] = interaction.values[0].split('_');
            bulk.rewardData.tickets = {};
            
            if (type === 'all') {
                if (amount === 'max') {
                    bulk.rewardData.tickets = {
                        hunting: 20,
                        dungeon: 5,
                        pvp: 20,
                        minigame: 20
                    };
                    embed.data.fields[2].value = '모든 티켓 최대 충전';
                } else {
                    const num = parseInt(amount);
                    bulk.rewardData.tickets = {
                        hunting: num,
                        dungeon: num,
                        pvp: num,
                        minigame: num
                    };
                    embed.data.fields[2].value = `모든 티켓 +${num}`;
                }
            } else {
                bulk.rewardData.tickets[type] = parseInt(amount);
                embed.data.fields[2].value = `${type} 티켓 +${amount}`;
            }
            
            components[1].components[0].data.disabled = false;
            await interaction.update({ embeds: [embed], components: components });
        }
    }
}

module.exports = new AdminBulkRewardSystem();