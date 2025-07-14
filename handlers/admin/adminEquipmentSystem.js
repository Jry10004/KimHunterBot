const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { formatNumber, isAdmin } = require('../common/utils');
const { randomItemData } = require('../../data/randomItemData');

class AdminEquipmentSystem {
    constructor() {
        this.pendingEquipment = new Map(); // 진행 중인 장비 생성
    }

    // 장비 생성 메인 메뉴
    async showEquipmentMenu(interaction) {
        if (!isAdmin(interaction.user.id)) {
            return await interaction.reply({ 
                content: '❌ 관리자만 접근할 수 있습니다!', 
                flags: 64 
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🛡️ 관리자 장비 생성 시스템')
            .setDescription('3단어 조합으로 커스텀 장비를 생성합니다.')
            .addFields(
                { name: '🎲 3단어 조합', value: '접두사 + 형용사 + 아이템명', inline: true },
                { name: '⚔️ 타입별 생성', value: '무기/방어구 등 선택', inline: true },
                { name: '✨ 희귀도 설정', value: '일반~레전드리', inline: true }
            )
            .setFooter({ text: '생성된 장비는 즉시 대상 유저에게 지급됩니다.' });

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_equip_create')
                    .setLabel('🎨 커스텀 장비 생성')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_equip_preset')
                    .setLabel('📋 프리셋 장비')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_equip_bulk')
                    .setLabel('📦 세트 지급')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_equip_manage')
                    .setLabel('🔧 장비 관리')
                    .setStyle(ButtonStyle.Secondary),
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

    // 커스텀 장비 생성 - 1단계: 기본 설정
    async showCreateStep1(interaction) {
        // 대상 유저 선택
        const users = await User.find({ registered: true })
            .sort({ level: -1 })
            .limit(25);

        const userOptions = users.map(user => ({
            label: `${user.nickname} (Lv.${user.level})`,
            description: `장비 ${user.inventory?.filter(i => i.equipped).length || 0}개 착용 중`,
            value: user.discordId
        }));

        const userSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_equip_user_select')
            .setPlaceholder('👤 대상 유저를 선택하세요')
            .addOptions(userOptions);

        // 희귀도 선택
        const raritySelect = new StringSelectMenuBuilder()
            .setCustomId('admin_equip_rarity_select')
            .setPlaceholder('⭐ 희귀도를 선택하세요')
            .addOptions([
                { label: '일반', value: 'common', emoji: '⬜' },
                { label: '고급', value: 'uncommon', emoji: '🟢' },
                { label: '레어', value: 'rare', emoji: '🔵' },
                { label: '에픽', value: 'epic', emoji: '🟣' },
                { label: '유니크', value: 'unique', emoji: '🟠' },
                { label: '레전드리', value: 'legendary', emoji: '✨' }
            ]);

        // 장비 타입 선택
        const typeSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_equip_type_select')
            .setPlaceholder('🛡️ 장비 타입을 선택하세요')
            .addOptions([
                { label: '무기', value: 'weapon', emoji: '⚔️' },
                { label: '갑옷', value: 'armor', emoji: '🛡️' },
                { label: '투구', value: 'helmet', emoji: '🎩' },
                { label: '장갑', value: 'gloves', emoji: '🧤' },
                { label: '신발', value: 'boots', emoji: '👢' },
                { label: '액세서리', value: 'accessory', emoji: '💍' }
            ]);

        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🛡️ 장비 생성 - 기본 설정')
            .setDescription('대상 유저, 희귀도, 장비 타입을 선택해주세요.')
            .addFields(
                { name: '선택된 유저', value: '없음', inline: true },
                { name: '선택된 희귀도', value: '없음', inline: true },
                { name: '선택된 타입', value: '없음', inline: true }
            );

        const nextButton = new ButtonBuilder()
            .setCustomId('admin_equip_next_step')
            .setLabel('다음 단계 ➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true);

        const cancelButton = new ButtonBuilder()
            .setCustomId('admin_equip_menu')
            .setLabel('❌ 취소')
            .setStyle(ButtonStyle.Secondary);

        await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(userSelect),
                new ActionRowBuilder().addComponents(raritySelect),
                new ActionRowBuilder().addComponents(typeSelect),
                new ActionRowBuilder().addComponents(nextButton, cancelButton)
            ]
        });

        // 상태 초기화
        this.pendingEquipment.set(interaction.user.id, {
            targetUser: null,
            targetUserName: null,
            rarity: null,
            type: null,
            prefix: null,
            adjective: null,
            itemName: null,
            stats: {},
            enhancement: 0
        });
    }

    // 커스텀 장비 생성 - 2단계: 3단어 선택
    async showCreateStep2(interaction) {
        const adminId = interaction.user.id;
        const equipment = this.pendingEquipment.get(adminId);

        if (!equipment || !equipment.rarity || !equipment.type) {
            return await interaction.reply({
                content: '❌ 먼저 기본 설정을 완료해주세요!',
                flags: 64
            });
        }

        // 희귀도에 따른 단어 목록 가져오기
        const rarityMap = {
            'common': 'epic',
            'uncommon': 'epic',
            'rare': 'epic',
            'epic': 'epic',
            'unique': 'unique',
            'legendary': 'legendary'
        };

        const wordRarity = rarityMap[equipment.rarity];
        const words = randomItemData.words[wordRarity];

        // 접두사 선택
        const prefixOptions = words.prefix.slice(0, 25).map(prefix => ({
            label: prefix,
            value: prefix
        }));

        const prefixSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_equip_prefix_select')
            .setPlaceholder('1️⃣ 접두사를 선택하세요')
            .addOptions(prefixOptions);

        // 형용사 선택
        const adjectiveOptions = words.adjective.slice(0, 25).map(adj => ({
            label: adj,
            value: adj
        }));

        const adjectiveSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_equip_adjective_select')
            .setPlaceholder('2️⃣ 형용사를 선택하세요')
            .addOptions(adjectiveOptions);

        // 아이템명 선택 (타입에 따라 필터링)
        const itemOptions = this.getItemsByType(words.items, equipment.type).slice(0, 25).map(item => ({
            label: item,
            value: item
        }));

        const itemSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_equip_item_select')
            .setPlaceholder('3️⃣ 아이템명을 선택하세요')
            .addOptions(itemOptions);

        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🎨 장비 생성 - 3단어 조합')
            .setDescription('각 단어를 선택하여 장비 이름을 만드세요.')
            .addFields(
                { name: '⭐ 희귀도', value: equipment.rarity, inline: true },
                { name: '🛡️ 타입', value: equipment.type, inline: true },
                { name: '👤 대상', value: equipment.targetUserName || '없음', inline: true },
                { name: '📝 미리보기', value: '단어를 선택하세요...', inline: false }
            );

        const nextButton = new ButtonBuilder()
            .setCustomId('admin_equip_stats_step')
            .setLabel('다음: 스탯 설정 ➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true);

        const backButton = new ButtonBuilder()
            .setCustomId('admin_equip_create')
            .setLabel('⬅️ 이전')
            .setStyle(ButtonStyle.Secondary);

        await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(prefixSelect),
                new ActionRowBuilder().addComponents(adjectiveSelect),
                new ActionRowBuilder().addComponents(itemSelect),
                new ActionRowBuilder().addComponents(backButton, nextButton)
            ]
        });
    }

    // 커스텀 장비 생성 - 3단계: 스탯 설정
    async showCreateStep3(interaction) {
        const adminId = interaction.user.id;
        const equipment = this.pendingEquipment.get(adminId);

        if (!equipment || !equipment.itemName) {
            return await interaction.reply({
                content: '❌ 먼저 3단어를 선택해주세요!',
                flags: 64
            });
        }

        // 타입별 기본 스탯 옵션
        const statOptions = this.getStatOptionsByType(equipment.type, equipment.rarity);

        const mainStatSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_equip_main_stat_select')
            .setPlaceholder('📊 주 스탯을 선택하세요')
            .addOptions(statOptions.main);

        const subStatSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_equip_sub_stat_select')
            .setPlaceholder('📊 부가 스탯을 선택하세요 (선택사항)')
            .addOptions([
                { label: '없음', value: 'none' },
                ...statOptions.sub
            ]);

        // 강화 레벨 선택
        const enhanceSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_equip_enhance_select')
            .setPlaceholder('🔧 강화 레벨을 선택하세요')
            .addOptions([
                { label: '+0 (강화 없음)', value: '0' },
                { label: '+5', value: '5' },
                { label: '+10', value: '10' },
                { label: '+15', value: '15' },
                { label: '+20', value: '20' },
                { label: '+25', value: '25' },
                { label: '+30 (최대)', value: '30' }
            ]);

        const fullName = `${equipment.prefix} ${equipment.adjective} ${equipment.itemName}`;
        
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('📊 장비 생성 - 스탯 설정')
            .setDescription('장비의 능력치를 설정하세요.')
            .addFields(
                { name: '🎨 장비명', value: fullName, inline: false },
                { name: '⭐ 희귀도', value: equipment.rarity, inline: true },
                { name: '🛡️ 타입', value: equipment.type, inline: true },
                { name: '👤 대상', value: equipment.targetUserName, inline: true },
                { name: '📊 설정된 스탯', value: '아직 없음', inline: false }
            );

        const createButton = new ButtonBuilder()
            .setCustomId('admin_equip_confirm')
            .setLabel('✅ 생성 및 지급')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);

        const backButton = new ButtonBuilder()
            .setCustomId('admin_equip_word_step')
            .setLabel('⬅️ 이전')
            .setStyle(ButtonStyle.Secondary);

        await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(mainStatSelect),
                new ActionRowBuilder().addComponents(subStatSelect),
                new ActionRowBuilder().addComponents(enhanceSelect),
                new ActionRowBuilder().addComponents(backButton, createButton)
            ]
        });
    }

    // 타입별 아이템 필터링
    getItemsByType(items, type) {
        const typeKeywords = {
            'weapon': ['검', '도', '창', '활', '도끼', '메이스', '레이피어', '카타나', '스태프', '완드', '대거', '숏소드', '롱소드', '배틀액스', '엑스칼리버', '미요르니르', '궁니르', '듀란달'],
            'armor': ['갑옷', '갑주', '로브', '튜닉', '브륀힐드', '드래곤하트'],
            'helmet': ['투구', '모자', '두건', '카부토', '복면', '화관', '왕관', '가면', '면류관'],
            'gloves': ['장갑', '건틀릿', '주먹', '벙어리장갑'],
            'boots': ['부츠', '신발', '그리브', '각반', '전투화', '추적화', '짚신', '철제화', '경보행화', '보행화'],
            'accessory': ['반지', '목걸이', '부적', '오브', '룬', '토템', '크리스탈', '거울', '상자']
        };

        const keywords = typeKeywords[type] || [];
        return items.filter(item => 
            keywords.some(keyword => item.includes(keyword))
        );
    }

    // 타입과 희귀도별 스탯 옵션
    getStatOptionsByType(type, rarity) {
        const rarityMultiplier = {
            'common': 1,
            'uncommon': 2,
            'rare': 3,
            'epic': 5,
            'unique': 8,
            'legendary': 10
        };

        const mult = rarityMultiplier[rarity];

        const statOptions = {
            'weapon': {
                main: [
                    { label: `공격력 +${50 * mult}`, value: `attack:${50 * mult}` },
                    { label: `공격력 +${100 * mult}`, value: `attack:${100 * mult}` },
                    { label: `공격력 +${200 * mult}`, value: `attack:${200 * mult}` }
                ],
                sub: [
                    { label: `크리티컬 +${5 * mult}%`, value: `critical:${5 * mult}` },
                    { label: `명중률 +${10 * mult}%`, value: `accuracy:${10 * mult}` },
                    { label: `흡혈 +${3 * mult}%`, value: `lifesteal:${3 * mult}` }
                ]
            },
            'armor': {
                main: [
                    { label: `방어력 +${50 * mult}`, value: `defense:${50 * mult}` },
                    { label: `방어력 +${100 * mult}`, value: `defense:${100 * mult}` },
                    { label: `HP +${500 * mult}`, value: `hp:${500 * mult}` }
                ],
                sub: [
                    { label: `회피율 +${5 * mult}%`, value: `evasion:${5 * mult}` },
                    { label: `체력 재생 +${10 * mult}`, value: `regen:${10 * mult}` }
                ]
            },
            'helmet': {
                main: [
                    { label: `방어력 +${30 * mult}`, value: `defense:${30 * mult}` },
                    { label: `HP +${300 * mult}`, value: `hp:${300 * mult}` },
                    { label: `지능 +${20 * mult}`, value: `intelligence:${20 * mult}` }
                ],
                sub: [
                    { label: `마나 +${100 * mult}`, value: `mana:${100 * mult}` },
                    { label: `스킬 쿨다운 -${5 * mult}%`, value: `cooldown:${5 * mult}` }
                ]
            },
            'gloves': {
                main: [
                    { label: `공격력 +${30 * mult}`, value: `attack:${30 * mult}` },
                    { label: `크리티컬 +${10 * mult}%`, value: `critical:${10 * mult}` },
                    { label: `공격속도 +${15 * mult}%`, value: `attackSpeed:${15 * mult}` }
                ],
                sub: [
                    { label: `명중률 +${10 * mult}%`, value: `accuracy:${10 * mult}` },
                    { label: `힘 +${15 * mult}`, value: `strength:${15 * mult}` }
                ]
            },
            'boots': {
                main: [
                    { label: `이동속도 +${20 * mult}%`, value: `moveSpeed:${20 * mult}` },
                    { label: `회피율 +${10 * mult}%`, value: `evasion:${10 * mult}` },
                    { label: `민첩 +${20 * mult}`, value: `agility:${20 * mult}` }
                ],
                sub: [
                    { label: `점프력 +${15 * mult}%`, value: `jump:${15 * mult}` },
                    { label: `방어력 +${20 * mult}`, value: `defense:${20 * mult}` }
                ]
            },
            'accessory': {
                main: [
                    { label: `모든 스탯 +${10 * mult}`, value: `allStats:${10 * mult}` },
                    { label: `경험치 +${20 * mult}%`, value: `expBonus:${20 * mult}` },
                    { label: `골드 +${20 * mult}%`, value: `goldBonus:${20 * mult}` }
                ],
                sub: [
                    { label: `행운 +${15 * mult}`, value: `luck:${15 * mult}` },
                    { label: `아이템 드롭률 +${10 * mult}%`, value: `dropRate:${10 * mult}` }
                ]
            }
        };

        return statOptions[type] || statOptions['weapon'];
    }

    // 선택 메뉴 핸들러
    async handleSelectMenu(interaction) {
        const customId = interaction.customId;
        const adminId = interaction.user.id;
        const equipment = this.pendingEquipment.get(adminId);

        if (!equipment) return;

        // 유저 선택
        if (customId === 'admin_equip_user_select') {
            const userId = interaction.values[0];
            const user = await User.findOne({ discordId: userId });
            
            equipment.targetUser = userId;
            equipment.targetUserName = user.nickname;
            
            const embed = interaction.message.embeds[0];
            embed.data.fields[0].value = user.nickname;
            
            await this.updateStepButtons(interaction, embed);
        }

        // 희귀도 선택
        else if (customId === 'admin_equip_rarity_select') {
            equipment.rarity = interaction.values[0];
            
            const embed = interaction.message.embeds[0];
            embed.data.fields[1].value = equipment.rarity;
            
            await this.updateStepButtons(interaction, embed);
        }

        // 타입 선택
        else if (customId === 'admin_equip_type_select') {
            equipment.type = interaction.values[0];
            
            const embed = interaction.message.embeds[0];
            embed.data.fields[2].value = equipment.type;
            
            await this.updateStepButtons(interaction, embed);
        }

        // 접두사 선택
        else if (customId === 'admin_equip_prefix_select') {
            equipment.prefix = interaction.values[0];
            await this.updateWordPreview(interaction);
        }

        // 형용사 선택
        else if (customId === 'admin_equip_adjective_select') {
            equipment.adjective = interaction.values[0];
            await this.updateWordPreview(interaction);
        }

        // 아이템명 선택
        else if (customId === 'admin_equip_item_select') {
            equipment.itemName = interaction.values[0];
            await this.updateWordPreview(interaction);
        }

        // 주 스탯 선택
        else if (customId === 'admin_equip_main_stat_select') {
            const [stat, value] = interaction.values[0].split(':');
            equipment.stats[stat] = parseInt(value);
            await this.updateStatPreview(interaction);
        }

        // 부가 스탯 선택
        else if (customId === 'admin_equip_sub_stat_select') {
            if (interaction.values[0] !== 'none') {
                const [stat, value] = interaction.values[0].split(':');
                equipment.stats[stat] = parseInt(value);
            }
            await this.updateStatPreview(interaction);
        }

        // 강화 레벨 선택
        else if (customId === 'admin_equip_enhance_select') {
            equipment.enhancement = parseInt(interaction.values[0]);
            await this.updateStatPreview(interaction);
        }
    }

    // 버튼 활성화 업데이트
    async updateStepButtons(interaction, embed) {
        const equipment = this.pendingEquipment.get(interaction.user.id);
        const components = interaction.message.components;
        
        // 다음 단계 버튼 활성화 체크
        const nextButton = components[3].components[0];
        nextButton.data.disabled = !(equipment.targetUser && equipment.rarity && equipment.type);
        
        await interaction.update({ embeds: [embed], components: components });
    }

    // 단어 미리보기 업데이트
    async updateWordPreview(interaction) {
        const equipment = this.pendingEquipment.get(interaction.user.id);
        const embed = interaction.message.embeds[0];
        
        let preview = '';
        if (equipment.prefix) preview += equipment.prefix + ' ';
        if (equipment.adjective) preview += equipment.adjective + ' ';
        if (equipment.itemName) preview += equipment.itemName;
        
        embed.data.fields[3].value = preview || '단어를 선택하세요...';
        
        // 다음 버튼 활성화
        const components = interaction.message.components;
        const nextButton = components[3].components[1];
        nextButton.data.disabled = !(equipment.prefix && equipment.adjective && equipment.itemName);
        
        await interaction.update({ embeds: [embed], components: components });
    }

    // 스탯 미리보기 업데이트
    async updateStatPreview(interaction) {
        const equipment = this.pendingEquipment.get(interaction.user.id);
        const embed = interaction.message.embeds[0];
        
        let statText = '';
        for (const [stat, value] of Object.entries(equipment.stats)) {
            statText += `${stat}: +${value}\n`;
        }
        
        if (equipment.enhancement > 0) {
            statText += `\n강화: +${equipment.enhancement}`;
            statText += `\n추가 공격력: +${equipment.enhancement * 10}`;
            statText += `\n추가 방어력: +${equipment.enhancement * 10}`;
        }
        
        embed.data.fields[4].value = statText || '아직 없음';
        
        // 생성 버튼 활성화
        const components = interaction.message.components;
        const createButton = components[3].components[1];
        createButton.data.disabled = Object.keys(equipment.stats).length === 0;
        
        await interaction.update({ embeds: [embed], components: components });
    }

    // 장비 생성 및 지급
    async createAndGiveEquipment(interaction) {
        const adminId = interaction.user.id;
        const equipment = this.pendingEquipment.get(adminId);
        
        if (!equipment) return;

        try {
            const targetUser = await User.findOne({ discordId: equipment.targetUser });
            if (!targetUser) {
                return await interaction.reply({
                    content: '❌ 유저를 찾을 수 없습니다.',
                    flags: 64
                });
            }

            // 장비 객체 생성
            const newEquipment = {
                id: `admin_${Date.now()}`,
                name: `${equipment.prefix} ${equipment.adjective} ${equipment.itemName}`,
                type: equipment.type,
                rarity: equipment.rarity,
                level: 1, // 착용 가능 레벨
                quantity: 1,
                enhanceLevel: equipment.enhancement,
                stats: { ...equipment.stats },
                description: `관리자가 생성한 ${equipment.rarity} 등급 ${equipment.type}`,
                equipped: false,
                inventorySlot: targetUser.inventory?.length || 0,
                randomOptions: [],
                adminItem: true,
                createdBy: interaction.user.username,
                createdAt: new Date()
            };

            // 강화 보너스 적용
            if (equipment.enhancement > 0) {
                newEquipment.stats.attack = (newEquipment.stats.attack || 0) + (equipment.enhancement * 10);
                newEquipment.stats.defense = (newEquipment.stats.defense || 0) + (equipment.enhancement * 10);
            }

            // 인벤토리에 추가
            if (!targetUser.inventory) targetUser.inventory = [];
            targetUser.inventory.push(newEquipment);
            await targetUser.save();

            // 희귀도별 색상
            const rarityColors = {
                'common': '#95a5a6',
                'uncommon': '#2ecc71',
                'rare': '#3498db',
                'epic': '#9b59b6',
                'unique': '#e67e22',
                'legendary': '#e74c3c'
            };

            const embed = new EmbedBuilder()
                .setColor(rarityColors[equipment.rarity])
                .setTitle('✅ 장비 생성 완료!')
                .setDescription(`**${newEquipment.name}**이(가) 생성되어 지급되었습니다.`)
                .addFields(
                    { name: '👤 수령자', value: targetUser.nickname, inline: true },
                    { name: '⭐ 희귀도', value: equipment.rarity, inline: true },
                    { name: '🛡️ 타입', value: equipment.type, inline: true },
                    { name: '📊 스탯', value: Object.entries(newEquipment.stats)
                        .map(([stat, value]) => `${stat}: +${value}`)
                        .join('\n'), inline: false }
                )
                .setFooter({ text: `관리자: ${interaction.user.username}` })
                .setTimestamp();

            await interaction.update({
                embeds: [embed],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('admin_equip_create')
                            .setLabel('🎨 추가 생성')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('admin_equip_menu')
                            .setLabel('🔙 장비 메뉴')
                            .setStyle(ButtonStyle.Secondary)
                    )
                ]
            });

            // 상태 초기화
            this.pendingEquipment.delete(adminId);

            // 로그
            console.log(`[관리자 장비] ${interaction.user.username} → ${targetUser.nickname}: ${newEquipment.name}`);

        } catch (error) {
            console.error('장비 생성 오류:', error);
            await interaction.reply({
                content: '❌ 장비 생성 중 오류가 발생했습니다.',
                flags: 64
            });
        }
    }
}

module.exports = new AdminEquipmentSystem();