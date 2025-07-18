const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { formatNumber, isAdmin } = require('../common/utils');
const randomItemData = require('../../data/randomItemData');

class AdminEquipmentSystem {
    constructor() {
        this.pendingEquipment = new Map(); // 진행 중인 장비 생성
        
        // 프리셋 장비 목록
        this.presetItems = {
            event: [
                {
                    name: '댕댕이의 우정 반지',
                    type: 'accessory',
                    rarity: 'legendary',
                    stats: {
                        strength: 100,
                        agility: 100,
                        intelligence: 100,
                        vitality: 100,
                        luck: 100
                    },
                    description: '댕댕봇의 우정이 담긴 특별한 반지',
                    itemTag: '이벤트 한정',
                    price: 1000000
                }
            ],
            legendary: [
                {
                    name: '천상의 빛나는 성검',
                    type: 'weapon',
                    rarity: 'legendary',
                    stats: {
                        attack: 500,
                        strength: 50,
                        vitality: 30
                    },
                    description: '하늘의 빛을 담은 전설의 검',
                    itemTag: '관리자 지급',
                    price: 5000000
                }
            ]
        };
    }

    // 장비 생성 메인 메뉴
    async showEquipmentMenu(interaction) {
        if (!isAdmin(interaction.user.id)) {
            return await interaction.reply({ 
                content: '❌ 관리자만 접근할 수 있습니다!', 
                flags: 64 
            });
        }
        
        const adminId = interaction.user.id;
        
        // 새로 시작할 때는 기존 상태 삭제
        if (this.pendingEquipment.has(adminId)) {
            this.pendingEquipment.delete(adminId);
            console.log(`[AdminEquipment] Cleared existing state for admin ${adminId}`);
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
        const adminId = interaction.user.id;
        
        // 기존 상태가 있으면 유지, 없으면 새로 생성
        if (!this.pendingEquipment.has(adminId)) {
            this.pendingEquipment.set(adminId, {
                targetUser: null,
                targetUserName: null,
                rarity: null,
                type: null,
                itemTag: null, // null, 'event', 'reward', 'admin'
                prefix: null,
                adjective: null,
                itemName: null,
                stats: {},
                enhancement: 0
            });
        }
        
        const equipment = this.pendingEquipment.get(adminId);
        
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
                { name: '선택된 유저', value: equipment.targetUserName ? `${equipment.targetUserName}` : '없음', inline: true },
                { name: '선택된 희귀도', value: equipment.rarity || '없음', inline: true },
                { name: '선택된 타입', value: equipment.type || '없음', inline: true }
            );

        const nextButton = new ButtonBuilder()
            .setCustomId('admin_equip_next_step')
            .setLabel('다음 단계 ➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!(equipment.targetUser && equipment.rarity && equipment.type));

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
    }

    // 커스텀 장비 생성 - 2단계: 3단어 선택
    async showCreateStep2(interaction) {
        const adminId = interaction.user.id;
        const equipment = this.pendingEquipment.get(adminId);

        if (!equipment || !equipment.rarity || !equipment.type) {
            if (interaction.replied || interaction.deferred) {
                return await interaction.editReply({
                    content: '❌ 먼저 기본 설정을 완료해주세요!'
                });
            } else {
                return await interaction.reply({
                    content: '❌ 먼저 기본 설정을 완료해주세요!',
                    flags: 64
                });
            }
        }

        // 희귀도에 따른 단어 목록 가져오기
        // 레전드리 선택 시 하위 희귀도 단어도 포함
        let wordList = {
            prefix: [],
            adjective: [],
            items: []
        };

        if (equipment.rarity === 'legendary') {
            // 레전드리는 모든 희귀도 단어 사용 가능
            ['rare', 'epic', 'unique', 'legendary'].forEach(rarity => {
                if (randomItemData.words[rarity]) {
                    wordList.prefix = [...wordList.prefix, ...randomItemData.words[rarity].prefix];
                    wordList.adjective = [...wordList.adjective, ...randomItemData.words[rarity].adjective];
                    wordList.items = [...wordList.items, ...randomItemData.words[rarity].items];
                }
            });
        } else if (equipment.rarity === 'unique') {
            // 유니크는 레어, 에픽, 유니크 단어 사용
            ['rare', 'epic', 'unique'].forEach(rarity => {
                if (randomItemData.words[rarity]) {
                    wordList.prefix = [...wordList.prefix, ...randomItemData.words[rarity].prefix];
                    wordList.adjective = [...wordList.adjective, ...randomItemData.words[rarity].adjective];
                    wordList.items = [...wordList.items, ...randomItemData.words[rarity].items];
                }
            });
        } else if (equipment.rarity === 'epic') {
            // 에픽은 레어, 에픽 단어 사용
            ['rare', 'epic'].forEach(rarity => {
                if (randomItemData.words[rarity]) {
                    wordList.prefix = [...wordList.prefix, ...randomItemData.words[rarity].prefix];
                    wordList.adjective = [...wordList.adjective, ...randomItemData.words[rarity].adjective];
                    wordList.items = [...wordList.items, ...randomItemData.words[rarity].items];
                }
            });
        } else {
            // 그 외는 rare 단어 사용 (common, uncommon, rare)
            if (randomItemData.words.rare) {
                wordList = randomItemData.words.rare;
            }
        }

        const words = wordList;

        // 아이템 태그 선택
        const tagSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_equip_tag_select')
            .setPlaceholder('🏷️ 아이템 태그를 선택하세요 (선택사항)')
            .addOptions([
                { label: '태그 없음', value: 'none', description: '일반 아이템' },
                { label: '[이벤트]', value: 'event', description: '이벤트 전용 아이템', emoji: '🎊' },
                { label: '[보상]', value: 'reward', description: '보상으로 지급된 아이템', emoji: '🎁' },
                { label: '[운영자아이템]', value: 'admin', description: '운영자 전용 아이템', emoji: '👑' }
            ]);

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

        const tagLabels = {
            'event': '[이벤트]',
            'reward': '[보상]',
            'admin': '[운영자아이템]'
        };

        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🎨 장비 생성 - 3단어 조합')
            .setDescription('각 단어를 선택하여 장비 이름을 만드세요.')
            .addFields(
                { name: '⭐ 희귀도', value: equipment.rarity, inline: true },
                { name: '🛡️ 타입', value: equipment.type, inline: true },
                { name: '👤 대상', value: equipment.targetUserName || '없음', inline: true },
                { name: '🏷️ 태그', value: tagLabels[equipment.itemTag] || '없음', inline: true },
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
                new ActionRowBuilder().addComponents(tagSelect),
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
            if (interaction.replied || interaction.deferred) {
                return await interaction.editReply({
                    content: '❌ 먼저 3단어를 선택해주세요!'
                });
            } else {
                return await interaction.reply({
                    content: '❌ 먼저 3단어를 선택해주세요!',
                    flags: 64
                });
            }
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

        // 강화 레벨 선택 (계급 시스템)
        const enhanceRanks = {
            0: '무계급',
            5: '상급 헌터',
            10: '마스터 헌터',
            15: '신화 헌터',
            20: '우주 헌터',
            25: '파멸 헌터',
            30: '김헌터 신'
        };
        
        const enhanceOptions = Object.entries(enhanceRanks).map(([level, rank]) => ({
            label: `[${rank}]`,
            value: level,
            description: `강화 ${level}단계`
        }));
        
        const enhanceSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_equip_enhance_select')
            .setPlaceholder('🔧 강화 레벨을 선택하세요')
            .addOptions(enhanceOptions);

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
                    { label: `공격력 +${200 * mult}`, value: `attack:${200 * mult}` },
                    { label: `공격력 +${300 * mult}`, value: `attack:${300 * mult}` },
                    { label: `공격력 +${500 * mult}`, value: `attack:${500 * mult}` },
                    { label: `마력 +${50 * mult}`, value: `magicPower:${50 * mult}` },
                    { label: `마력 +${100 * mult}`, value: `magicPower:${100 * mult}` },
                    { label: `마력 +${200 * mult}`, value: `magicPower:${200 * mult}` }
                ],
                sub: [
                    { label: `크리티컬 +${5 * mult}%`, value: `critical:${5 * mult}` },
                    { label: `크리티컬 +${10 * mult}%`, value: `critical:${10 * mult}` },
                    { label: `명중률 +${10 * mult}%`, value: `accuracy:${10 * mult}` },
                    { label: `흡혈 +${3 * mult}%`, value: `lifesteal:${3 * mult}` },
                    { label: `흡혈 +${5 * mult}%`, value: `lifesteal:${5 * mult}` },
                    { label: `관통력 +${10 * mult}%`, value: `penetration:${10 * mult}` },
                    { label: `공격속도 +${10 * mult}%`, value: `attackSpeed:${10 * mult}` }
                ]
            },
            'armor': {
                main: [
                    { label: `방어력 +${50 * mult}`, value: `defense:${50 * mult}` },
                    { label: `방어력 +${100 * mult}`, value: `defense:${100 * mult}` },
                    { label: `방어력 +${200 * mult}`, value: `defense:${200 * mult}` },
                    { label: `HP +${500 * mult}`, value: `hp:${500 * mult}` },
                    { label: `HP +${1000 * mult}`, value: `hp:${1000 * mult}` },
                    { label: `HP +${2000 * mult}`, value: `hp:${2000 * mult}` },
                    { label: `마법 저항력 +${20 * mult}`, value: `magicResist:${20 * mult}` }
                ],
                sub: [
                    { label: `회피율 +${5 * mult}%`, value: `evasion:${5 * mult}` },
                    { label: `회피율 +${10 * mult}%`, value: `evasion:${10 * mult}` },
                    { label: `체력 재생 +${10 * mult}`, value: `regen:${10 * mult}` },
                    { label: `체력 재생 +${20 * mult}`, value: `regen:${20 * mult}` },
                    { label: `피해 감소 +${5 * mult}%`, value: `damageReduction:${5 * mult}` },
                    { label: `받는 치유량 +${10 * mult}%`, value: `healingReceived:${10 * mult}` }
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
                    { label: `모든 스탯 +${20 * mult}`, value: `allStats:${20 * mult}` },
                    { label: `경험치 +${20 * mult}%`, value: `expBonus:${20 * mult}` },
                    { label: `경험치 +${50 * mult}%`, value: `expBonus:${50 * mult}` },
                    { label: `경험치 +${100 * mult}%`, value: `expBonus:${100 * mult}` },
                    { label: `골드 +${20 * mult}%`, value: `goldBonus:${20 * mult}` },
                    { label: `골드 +${50 * mult}%`, value: `goldBonus:${50 * mult}` },
                    { label: `골드 +${100 * mult}%`, value: `goldBonus:${100 * mult}` }
                ],
                sub: [
                    { label: `행운 +${15 * mult}`, value: `luck:${15 * mult}` },
                    { label: `행운 +${30 * mult}`, value: `luck:${30 * mult}` },
                    { label: `아이템 드롭률 +${10 * mult}%`, value: `dropRate:${10 * mult}` },
                    { label: `아이템 드롭률 +${20 * mult}%`, value: `dropRate:${20 * mult}` },
                    { label: `희귀 아이템 발견률 +${5 * mult}%`, value: `rareItemFind:${5 * mult}` },
                    { label: `제작 성공률 +${10 * mult}%`, value: `craftSuccess:${10 * mult}` },
                    { label: `강화 성공률 +${5 * mult}%`, value: `enhanceSuccess:${5 * mult}` }
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

        console.log(`[AdminEquipment] handleSelectMenu - customId: ${customId}, adminId: ${adminId}`);
        console.log(`[AdminEquipment] Current equipment state:`, equipment);

        if (!equipment) {
            console.log('[AdminEquipment] No equipment state found!');
            return;
        }

        // 유저 선택
        if (customId === 'admin_equip_user_select') {
            const userId = interaction.values[0];
            const user = await User.findOne({ discordId: userId });
            
            equipment.targetUser = userId;
            equipment.targetUserName = user.nickname;
            
            console.log(`[AdminEquipment] User selected: ${user.nickname} (${userId})`);
            console.log(`[AdminEquipment] Equipment state after user selection:`, equipment);
            
            const oldEmbed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed)
                .spliceFields(0, 1, { 
                    name: '선택된 유저', 
                    value: `${user.nickname} (Lv.${user.level})`, 
                    inline: true 
                });
            
            // 상태를 다시 저장
            this.pendingEquipment.set(adminId, equipment);
            console.log(`[AdminEquipment] Saved state after user selection`);
            
            await this.updateStepButtons(interaction, newEmbed);
        }

        // 희귀도 선택
        else if (customId === 'admin_equip_rarity_select') {
            equipment.rarity = interaction.values[0];
            
            console.log(`[AdminEquipment] Rarity selected: ${equipment.rarity}`);
            
            // 희귀도 한글 매핑
            const rarityLabels = {
                'common': '⬜ 일반',
                'uncommon': '🟢 고급',
                'rare': '🔵 레어',
                'epic': '🟣 에픽',
                'unique': '🟠 유니크',
                'legendary': '✨ 레전드리'
            };
            
            const oldEmbed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed)
                .spliceFields(1, 1, { 
                    name: '선택된 희귀도', 
                    value: rarityLabels[equipment.rarity] || equipment.rarity, 
                    inline: true 
                });
            
            // 상태를 다시 저장
            this.pendingEquipment.set(adminId, equipment);
            console.log(`[AdminEquipment] Saved state after rarity selection`);
            
            await this.updateStepButtons(interaction, newEmbed);
        }

        // 타입 선택
        else if (customId === 'admin_equip_type_select') {
            equipment.type = interaction.values[0];
            
            console.log(`[AdminEquipment] Type selected: ${equipment.type}`);
            
            // 타입 한글 매핑
            const typeLabels = {
                'weapon': '⚔️ 무기',
                'armor': '🛡️ 갑옷',
                'helmet': '🎩 투구',
                'gloves': '🧤 장갑',
                'boots': '👢 신발',
                'accessory': '💍 액세서리'
            };
            
            const oldEmbed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed)
                .spliceFields(2, 1, { 
                    name: '선택된 타입', 
                    value: typeLabels[equipment.type] || equipment.type, 
                    inline: true 
                });
            
            // 상태를 다시 저장
            this.pendingEquipment.set(adminId, equipment);
            console.log(`[AdminEquipment] Saved state after type selection`);
            console.log(`[AdminEquipment] Current state:`, equipment);
            
            await this.updateStepButtons(interaction, newEmbed);
        }

        // 태그 선택
        else if (customId === 'admin_equip_tag_select') {
            equipment.itemTag = interaction.values[0] === 'none' ? null : interaction.values[0];
            
            console.log(`[AdminEquipment] Tag selected: ${equipment.itemTag}`);
            
            // 미리보기 업데이트를 직접 호출하여 전체 업데이트
            await this.updateWordPreview(interaction);
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
        const oldComponents = interaction.message.components;
        const newComponents = [];
        
        // 기존 컴포넌트를 복사하되 마지막 버튼 row는 재생성
        for (let i = 0; i < oldComponents.length - 1; i++) {
            newComponents.push(oldComponents[i]);
        }
        
        // 마지막 버튼 row 재생성
        if (oldComponents.length > 3) {
            const allSelected = !!(equipment.targetUser && equipment.rarity && equipment.type);
            
            const nextButton = new ButtonBuilder()
                .setCustomId('admin_equip_next_step')
                .setLabel('다음 단계 ➡️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!allSelected);
                
            const cancelButton = new ButtonBuilder()
                .setCustomId('admin_equip_menu')
                .setLabel('❌ 취소')
                .setStyle(ButtonStyle.Secondary);
                
            newComponents.push(new ActionRowBuilder().addComponents(nextButton, cancelButton));
        }
        
        await interaction.editReply({ embeds: [embed], components: newComponents });
    }

    // 단어 미리보기 업데이트
    async updateWordPreview(interaction) {
        const equipment = this.pendingEquipment.get(interaction.user.id);
        const oldEmbed = interaction.message.embeds[0];
        
        const tagLabels = {
            'event': '[이벤트]',
            'reward': '[보상]',
            'admin': '[운영자아이템]'
        };
        
        let preview = '';
        if (equipment.itemTag) preview += tagLabels[equipment.itemTag];
        if (equipment.prefix) preview += equipment.prefix + ' ';
        if (equipment.adjective) preview += equipment.adjective + ' ';
        if (equipment.itemName) preview += equipment.itemName;
        
        // embed 필드 수동 업데이트
        const fields = [...oldEmbed.fields];
        
        // 태그 필드 업데이트 (3번 인덱스)
        if (fields[3]) {
            fields[3] = { 
                name: '🏷️ 태그', 
                value: tagLabels[equipment.itemTag] || '없음', 
                inline: true 
            };
        }
        
        // 미리보기 필드 업데이트 (4번 인덱스)
        if (fields[4]) {
            fields[4] = { 
                name: '📝 미리보기', 
                value: preview || '단어를 선택하세요...', 
                inline: false 
            };
        }
        
        // 새 embed 생성
        const newEmbed = new EmbedBuilder()
            .setColor(oldEmbed.color)
            .setTitle(oldEmbed.title)
            .setDescription(oldEmbed.description)
            .setFields(fields);
        
        // 컴포넌트 재생성
        const oldComponents = interaction.message.components;
        const newComponents = [];
        
        // 마지막 버튼 row를 제외한 모든 컴포넌트 복사 (태그, 접두사, 형용사, 아이템명)
        for (let i = 0; i < oldComponents.length - 1; i++) {
            newComponents.push(oldComponents[i]);
        }
        
        // 마지막 버튼 row 재생성
        const allSelected = !!(equipment.prefix && equipment.adjective && equipment.itemName);
        
        const backButton = new ButtonBuilder()
            .setCustomId('admin_equip_create')
            .setLabel('⬅️ 이전')
            .setStyle(ButtonStyle.Secondary);
            
        const nextButton = new ButtonBuilder()
            .setCustomId('admin_equip_stats_step')
            .setLabel('다음: 스탯 설정 ➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!allSelected);
            
        newComponents.push(new ActionRowBuilder().addComponents(backButton, nextButton));
        
        await interaction.editReply({ embeds: [newEmbed], components: newComponents });
    }


    // 스탯 미리보기 업데이트
    async updateStatPreview(interaction) {
        const equipment = this.pendingEquipment.get(interaction.user.id);
        const oldEmbed = interaction.message.embeds[0];
        
        let statText = '';
        for (const [stat, value] of Object.entries(equipment.stats)) {
            statText += `${stat}: +${value}\n`;
        }
        
        if (equipment.enhancement > 0) {
            statText += `\n강화: +${equipment.enhancement}`;
            statText += `\n추가 공격력: +${equipment.enhancement * 10}`;
            statText += `\n추가 방어력: +${equipment.enhancement * 10}`;
        }
        
        // 새 embed 생성
        const newEmbed = EmbedBuilder.from(oldEmbed)
            .spliceFields(4, 1, { 
                name: '📊 설정된 스탯', 
                value: statText || '아직 없음', 
                inline: false 
            });
        
        // 컴포넌트 재생성
        const oldComponents = interaction.message.components;
        const newComponents = [];
        
        // 처음 3개 컴포넌트는 그대로 복사
        for (let i = 0; i < 3; i++) {
            newComponents.push(oldComponents[i]);
        }
        
        // 마지막 버튼 row 재생성
        const hasStats = Object.keys(equipment.stats).length > 0;
        
        const backButton = new ButtonBuilder()
            .setCustomId('admin_equip_word_step')
            .setLabel('⬅️ 이전')
            .setStyle(ButtonStyle.Secondary);
            
        const createButton = new ButtonBuilder()
            .setCustomId('admin_equip_confirm')
            .setLabel('✅ 생성 및 지급')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!hasStats);
            
        newComponents.push(new ActionRowBuilder().addComponents(backButton, createButton));
        
        await interaction.editReply({ embeds: [newEmbed], components: newComponents });
    }

    // 장비 생성 및 지급
    async createAndGiveEquipment(interaction) {
        const adminId = interaction.user.id;
        const equipment = this.pendingEquipment.get(adminId);
        
        if (!equipment) return;

        try {
            const targetUser = await User.findOne({ discordId: equipment.targetUser });
            if (!targetUser) {
                if (interaction.replied || interaction.deferred) {
                    return await interaction.editReply({
                        content: '❌ 유저를 찾을 수 없습니다.'
                    });
                } else {
                    return await interaction.reply({
                        content: '❌ 유저를 찾을 수 없습니다.',
                        flags: 64
                    });
                }
            }

            // 장비 객체 생성
            const tagLabels = {
                'event': '[이벤트]',
                'reward': '[보상]',
                'admin': '[운영자아이템]'
            };
            
            let itemName = '';
            if (equipment.itemTag) {
                itemName = tagLabels[equipment.itemTag];
            }
            itemName += `${equipment.prefix} ${equipment.adjective} ${equipment.itemName}`;
                
            const newEquipment = {
                id: `admin_${Date.now()}`,
                name: itemName,
                type: equipment.type,
                rarity: equipment.rarity,
                setName: `관리자_${equipment.type}_${Date.now()}`, // setName 추가
                level: 1, // 착용 가능 레벨
                quantity: 1,
                enhancement: equipment.enhancement, // enhancement로 통일
                enhanceLevel: equipment.enhancement, // 호환성을 위해 둘 다 설정
                stats: { ...equipment.stats },
                description: `관리자가 생성한 ${equipment.rarity} 등급 ${equipment.type}`,
                equipped: false,
                inventorySlot: targetUser.inventory?.length || 0,
                randomOptions: [],
                adminItem: true,
                itemTag: equipment.itemTag, // 태그 정보 추가
                createdBy: interaction.user.username,
                createdAt: new Date()
            };

            // 강화 보너스 적용 (게임의 실제 강화 공식 사용)
            if (equipment.enhancement > 0) {
                // baseStats 저장
                newEquipment.baseStats = { ...equipment.stats };
                
                // 강화 배율 계산 (실제 게임 공식)
                let totalMultiplier = 1;
                for (let i = 1; i <= equipment.enhancement; i++) {
                    if (i <= 5) {
                        totalMultiplier += 0.02; // 1-5강: 2%씩
                    } else if (i <= 10) {
                        totalMultiplier += 0.03; // 6-10강: 3%씩
                    } else if (i <= 15) {
                        totalMultiplier += 0.04; // 11-15강: 4%씩
                    } else if (i <= 20) {
                        totalMultiplier += 0.05; // 16-20강: 5%씩
                    } else if (i <= 25) {
                        totalMultiplier += 0.06; // 21-25강: 6%씩
                    } else {
                        totalMultiplier += 0.07; // 26강+: 7%씩
                    }
                }
                
                // 모든 스탯에 강화 배율 적용
                for (const stat in newEquipment.stats) {
                    if (typeof newEquipment.stats[stat] === 'number') {
                        newEquipment.stats[stat] = Math.round(newEquipment.baseStats[stat] * totalMultiplier);
                    }
                }
                
                // 추가 공격력/방어력 보너스 (강화당 +10)
                if (!newEquipment.stats.attack && !newEquipment.stats.defense) {
                    // 공격력/방어력이 없는 장비에만 추가
                    newEquipment.stats.attack = equipment.enhancement * 10;
                    newEquipment.stats.defense = equipment.enhancement * 10;
                } else {
                    // 이미 있는 경우 추가
                    if (newEquipment.stats.attack) {
                        newEquipment.stats.attack += equipment.enhancement * 10;
                    }
                    if (newEquipment.stats.defense) {
                        newEquipment.stats.defense += equipment.enhancement * 10;
                    }
                }
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

            await interaction.editReply({
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
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({
                    content: '❌ 장비 생성 중 오류가 발생했습니다.'
                });
            } else {
                await interaction.reply({
                    content: '❌ 장비 생성 중 오류가 발생했습니다.',
                    flags: 64
                });
            }
        }
    }
    
    // 프리셋 장비 목록 표시
    async showPresetEquipment(interaction) {
        if (!isAdmin(interaction.user.id)) {
            return await interaction.reply({ 
                content: '❌ 관리자만 접근할 수 있습니다!', 
                flags: 64 
            });
        }
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('📋 프리셋 장비 목록')
            .setDescription('미리 정의된 특수 장비를 선택하여 지급할 수 있습니다.')
            .setFooter({ text: '장비를 선택하면 강화 수준을 설정할 수 있습니다.' });
        
        // 이벤트 장비
        let eventItems = '**[이벤트 한정]**\n';
        this.presetItems.event.forEach((item, index) => {
            eventItems += `${index + 1}. ${item.name} (${item.type})\n`;
        });
        
        // 전설 장비
        let legendaryItems = '**[전설 장비]**\n';
        this.presetItems.legendary.forEach((item, index) => {
            legendaryItems += `${index + 1}. ${item.name} (${item.type})\n`;
        });
        
        embed.addFields(
            { name: '🎁 이벤트 장비', value: eventItems, inline: false },
            { name: '⚔️ 전설 장비', value: legendaryItems, inline: false }
        );
        
        // 선택 메뉴 생성
        const options = [];
        
        // 이벤트 아이템 추가
        this.presetItems.event.forEach((item, index) => {
            options.push({
                label: item.name,
                description: `${item.rarity} ${item.type} - ${item.itemTag}`,
                value: `preset_event_${index}`,
                emoji: '🎁'
            });
        });
        
        // 전설 아이템 추가
        this.presetItems.legendary.forEach((item, index) => {
            options.push({
                label: item.name,
                description: `${item.rarity} ${item.type}`,
                value: `preset_legendary_${index}`,
                emoji: '⚔️'
            });
        });
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_preset_select')
            .setPlaceholder('지급할 프리셋 장비를 선택하세요')
            .addOptions(options);
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_equip_menu')
                    .setLabel('🔙 장비 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(selectMenu),
                buttons
            ]
        });
    }
    
    // 프리셋 장비 선택 처리
    async handlePresetSelect(interaction) {
        const [, category, indexStr] = interaction.values[0].split('_');
        const index = parseInt(indexStr);
        const item = this.presetItems[category][index];
        
        if (!item) {
            return await interaction.reply({
                content: '❌ 잘못된 아이템 선택입니다.',
                flags: 64
            });
        }
        
        // 대상 유저 선택 메뉴
        const users = await User.find({ registered: true })
            .sort({ level: -1 })
            .limit(25);
        
        const userOptions = users.map(user => ({
            label: `${user.nickname} (Lv.${user.level})`,
            description: `전투력: ${formatNumber(user.combatPower || 0)}`,
            value: user.discordId
        }));
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎁 프리셋 장비 지급')
            .setDescription(`**${item.name}**을(를) 지급할 대상을 선택하세요.`)
            .addFields(
                { name: '📦 아이템', value: item.name, inline: true },
                { name: '⭐ 희귀도', value: item.rarity, inline: true },
                { name: '🛡️ 타입', value: item.type, inline: true },
                { name: '📊 기본 스탯', value: Object.entries(item.stats)
                    .map(([stat, value]) => `${stat}: +${value}`)
                    .join('\n'), inline: false }
            );
        
        const userSelect = new StringSelectMenuBuilder()
            .setCustomId(`admin_preset_user_${category}_${index}`)
            .setPlaceholder('장비를 받을 유저를 선택하세요')
            .addOptions(userOptions);
        
        await interaction.update({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(userSelect)]
        });
    }
    
    // 프리셋 장비 지급
    async givePresetItem(interaction, category, itemIndex, userId) {
        const item = this.presetItems[category][itemIndex];
        const user = await User.findOne({ discordId: userId });
        
        if (!user || !item) {
            return await interaction.reply({
                content: '❌ 유저 또는 아이템을 찾을 수 없습니다.',
                flags: 64
            });
        }
        
        // 아이템 복사 (원본 보호)
        const newItem = JSON.parse(JSON.stringify(item));
        
        // 강화 수준 선택 메뉴
        const enhanceOptions = [
            { label: '무계급 (+0)', value: '0' },
            { label: '상급 헌터 (+5)', value: '5' },
            { label: '엘리트 헌터 (+8)', value: '8' },
            { label: '마스터 헌터 (+10)', value: '10' },
            { label: '히어로 헌터 (+13)', value: '13' },
            { label: '신화 헌터 (+15)', value: '15' }
        ];
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('⚔️ 강화 수준 선택')
            .setDescription(`**${item.name}**의 강화 수준을 선택하세요.`)
            .addFields(
                { name: '👤 대상', value: user.nickname, inline: true },
                { name: '📦 아이템', value: item.name, inline: true }
            );
        
        const enhanceSelect = new StringSelectMenuBuilder()
            .setCustomId(`admin_preset_enhance_${category}_${itemIndex}_${userId}`)
            .setPlaceholder('강화 수준을 선택하세요')
            .addOptions(enhanceOptions.map(opt => ({
                label: opt.label,
                value: opt.value
            })));
        
        await interaction.update({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(enhanceSelect)]
        });
    }
    
    // 프리셋 장비 최종 지급
    async finalizePresetGive(interaction, category, itemIndex, userId, enhancement) {
        const item = this.presetItems[category][itemIndex];
        const user = await User.findOne({ discordId: userId });
        
        if (!user || !item) {
            return await interaction.reply({
                content: '❌ 유저 또는 아이템을 찾을 수 없습니다.',
                flags: 64
            });
        }
        
        // 아이템 복사 및 강화 적용
        const newItem = JSON.parse(JSON.stringify(item));
        newItem.enhanceLevel = parseInt(enhancement);
        newItem.obtainedAt = new Date();
        
        // 인벤토리에 추가
        user.inventory.push(newItem);
        await user.save();
        
        const { ENHANCE_SYSTEM } = require('../enhance/enhanceSystem');
        const rankName = ENHANCE_SYSTEM.rankNames[newItem.enhanceLevel] || '무계급';
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ 프리셋 장비 지급 완료')
            .setDescription(`**${user.nickname}**님에게 장비가 지급되었습니다!`)
            .addFields(
                { name: '📦 아이템', value: `${newItem.name} [${rankName}]`, inline: false },
                { name: '⭐ 희귀도', value: newItem.rarity, inline: true },
                { name: '🛡️ 타입', value: newItem.type, inline: true },
                { name: '🏷️ 태그', value: newItem.itemTag || '없음', inline: true }
            )
            .setFooter({ text: `관리자: ${interaction.user.username}` })
            .setTimestamp();
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_equip_preset')
                    .setLabel('📋 추가 지급')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_equip_menu')
                    .setLabel('🔙 장비 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });
        
        console.log(`[프리셋 장비] ${interaction.user.username} → ${user.nickname}: ${newItem.name} [+${enhancement}]`);
    }
}

module.exports = new AdminEquipmentSystem();