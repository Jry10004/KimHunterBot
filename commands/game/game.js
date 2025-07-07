const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { handleMainMenu } = require('../index');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('게임')
        .setDescription('게임 메인 메뉴를 표시합니다'),
    
    async execute(interaction) {
        // 관리자 확인
        const ADMIN_IDS = ['424480594542592009', '295980447849250817', '532128778175619084', '592659577384730645'];
        const isAdmin = ADMIN_IDS.includes(interaction.user.id);
        
        const embed = new EmbedBuilder()
            .setTitle('🎮 강화왕 김헌터 게임')
            .setDescription(
                '환영합니다! 원하시는 메뉴를 선택해주세요.\n\n' +
                '**📝 회원가입**: `/회원가입` 명령어로 시작하세요!'
            )
            .setColor('#5865F2')
            .addFields(
                { name: '👤 캐릭터', value: '프로필, 인벤토리, 장비', inline: true },
                { name: '🎮 미니게임', value: '다양한 게임 플레이', inline: true },
                { name: '⚔️ PVP', value: '다른 플레이어와 대전', inline: true },
                { name: '💰 경제', value: '주식, 유물, 조각', inline: true },
                { name: '📅 일일활동', value: '출석, 사냥, 운동, 퀘스트', inline: true },
                { name: '🏰 던전', value: '던전 탐험', inline: true },
                { name: '👹 보스', value: '보스 레이드', inline: true },
                { name: '🔨 강화', value: '장비 강화', inline: true },
                { name: '🏅 랭킹', value: '각종 순위 확인', inline: true }
            )
            .setFooter({ text: '버튼을 클릭하거나 드롭다운 메뉴를 선택하세요!' })
            .setTimestamp();

        // 일반 사용자 메뉴
        const mainSelect = new StringSelectMenuBuilder()
            .setCustomId('main_menu')
            .setPlaceholder('🎮 게임 메뉴를 선택하세요')
            .addOptions([
                {
                    label: '👤 캐릭터',
                    description: '프로필, 인벤토리, 장비 관리',
                    value: 'profile',
                    emoji: '👤'
                },
                {
                    label: '🎮 미니게임',
                    description: '독버섯, 슬롯머신, 가위바위보 등',
                    value: 'minigame',
                    emoji: '🎮'
                },
                {
                    label: '⚔️ PVP',
                    description: '다른 플레이어와 대전',
                    value: 'pvp',
                    emoji: '⚔️'
                },
                {
                    label: '💰 경제',
                    description: '주식, 유물탐사, 조각융합',
                    value: 'stocks',
                    emoji: '💰'
                },
                {
                    label: '📅 일일활동',
                    description: '출석체크, 사냥, 운동, 퀘스트',
                    value: 'daily',
                    emoji: '📅'
                },
                {
                    label: '🏰 던전',
                    description: '던전 탐험하고 보상 획득',
                    value: 'dungeon',
                    emoji: '🏰'
                },
                {
                    label: '👹 보스',
                    description: '강력한 보스 레이드',
                    value: 'boss',
                    emoji: '👹'
                },
                {
                    label: '🔨 강화',
                    description: '장비 강화 시스템',
                    value: 'enhance',
                    emoji: '🔨'
                },
                {
                    label: '🏅 랭킹',
                    description: '각종 순위 확인',
                    value: 'ranking',
                    emoji: '🏅'
                }
            ]);

        const selectRow = new ActionRowBuilder().addComponents(mainSelect);

        // 빠른 접근 버튼
        const quickButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('profile')
                    .setLabel('👤 프로필')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('inventory')
                    .setLabel('🎒 인벤토리')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 미니게임')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('stocks')
                    .setLabel('📈 주식')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('daily')
                    .setLabel('📅 일일활동')
                    .setStyle(ButtonStyle.Secondary)
            );

        const components = [selectRow, quickButtons];

        // 관리자 메뉴 추가
        if (isAdmin) {
            // 관리자 옵션 추가
            mainSelect.addOptions([
                {
                    label: '🔧 관리자 패널',
                    description: '서버 관리 기능',
                    value: 'admin_panel',
                    emoji: '🔧'
                }
            ]);

            const adminButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('admin_panel')
                        .setLabel('🔧 관리자 패널')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('admin_user_manage')
                        .setLabel('👥 유저 관리')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('admin_economy')
                        .setLabel('💰 경제 관리')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('admin_stats')
                        .setLabel('📊 통계')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('admin_backup')
                        .setLabel('💾 백업')
                        .setStyle(ButtonStyle.Danger)
                );

            components.push(adminButtons);

            // 관리자 정보 추가
            embed.addFields(
                { name: '🔧 관리자 기능', value: '유저 관리, 경제 조작, 서버 설정', inline: false }
            );
        }

        await interaction.reply({
            embeds: [embed],
            components: components,
            ephemeral: false
        });
    }
};