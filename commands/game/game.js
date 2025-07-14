const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('게임')
        .setDescription('게임 메인 메뉴를 표시합니다'),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        // 유저 데이터 확인
        const User = require('../../models/User');
        const user = await User.findOne({ discordId: interaction.user.id });
        
        if (!user || !user.registered) {
            return await interaction.editReply({
                content: '❌ 먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.'
            });
        }
        
        // 전투력 계산
        const { calculateCombatPower } = require('../../handlers/common/utils');
        const combatPower = calculateCombatPower(user);
        
        // 관리자 확인
        const ADMIN_IDS = ['424480594542592009', '295980447849250817', '532128778175619084', '592659577384730645'];
        const isAdmin = ADMIN_IDS.includes(interaction.user.id);
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎮 김헌터 메인 메뉴')
            .setDescription(`${user.nickname}님, 환영합니다!\n원하는 메뉴를 선택해주세요.`)
            .addFields(
                { name: '💰 보유 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '📊 레벨', value: `Lv.${user.level}`, inline: true },
                { name: '⚔️ 전투력', value: `${combatPower}`, inline: true }
            )
            .setFooter({ text: '아래 드롭다운 메뉴에서 원하는 기능을 선택하세요!' })
            .setTimestamp();

        // 메인 메뉴 생성
        const menuOptions = [
            {
                label: '👤 프로필',
                description: '내 정보와 스탯 확인',
                value: 'profile',
                emoji: '👤'
            },
            {
                label: '🎒 인벤토리',
                description: '보유 아이템 확인',
                value: 'inventory',
                emoji: '🎒'
            },
            {
                label: '🎮 미니게임',
                description: '다양한 미니게임 플레이',
                value: 'minigame_menu',
                emoji: '🎮'
            },
            {
                label: '⚔️ PVP',
                description: '다른 유저와 대전',
                value: 'pvp',
                emoji: '⚔️'
            },
            {
                label: '🏰 던전 탐험',
                description: '던전을 탐험하며 보상 획득',
                value: 'dungeon',
                emoji: '🏰'
            },
            {
                label: '👹 보스 상점',
                description: '보스 토큰으로 아이템 구매',
                value: 'boss_shop',
                emoji: '👹'
            },
            {
                label: '📈 주식',
                description: '주식 거래소',
                value: 'stocks',
                emoji: '📈'
            },
            {
                label: '🏺 유물탐사',
                description: '고대 유물 발굴 및 거래',
                value: 'artifacts',
                emoji: '🏺'
            },
            {
                label: '💎 조각',
                description: '에너지 조각 시스템',
                value: 'fragments',
                emoji: '💎'
            },
            {
                label: '🛒 상점',
                description: '아이템 구매',
                value: 'shop',
                emoji: '🛒'
            },
            {
                label: '🎖️ 강화',
                description: '아이템 계급 승급',
                value: 'enhance',
                emoji: '🎖️'
            },
            {
                label: '🏅 랭킹',
                description: '전체 유저 순위 확인',
                value: 'ranking',
                emoji: '🏅'
            },
            {
                label: '📅 일일활동',
                description: '출석체크 및 일일 미션',
                value: 'daily',
                emoji: '📅'
            },
            {
                label: '🎯 사냥',
                description: '몬스터 사냥',
                value: 'hunting',
                emoji: '🎯'
            },
            {
                label: '🏃 운동',
                description: '체력 단련',
                value: 'work',
                emoji: '🏃'
            },
            {
                label: '📊 시세 확인',
                description: '전리품 시세 정보',
                value: 'market_prices',
                emoji: '📊'
            }
        ];

        // 관리자 메뉴 추가
        if (isAdmin) {
            menuOptions.push({
                label: '🛠️ 관리자 패널',
                description: '서버 관리 및 시스템 제어',
                value: 'admin_panel',
                emoji: '🛠️'
            });
        }

        const mainSelect = new StringSelectMenuBuilder()
            .setCustomId('main_menu')
            .setPlaceholder('✨ 김헌터 월드에 오신 것을 환영합니다!')
            .addOptions(menuOptions.slice(0, 25)); // 최대 25개까지만

        const selectRow = new ActionRowBuilder().addComponents(mainSelect);

        await interaction.editReply({
            embeds: [embed],
            components: [selectRow]
        });
    }
};