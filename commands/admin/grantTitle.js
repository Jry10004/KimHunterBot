const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

// 칭호 정보
const TITLE_INFO = {
    '댕댕봇 구출자': {
        description: '댕댕봇 구출 이벤트에서 가장 큰 기여를 한 영웅',
        effect: '없음',
        emoji: '🦸‍♂️',
        rarity: '전설'
    },
    '버그 사냥꾼': {
        description: '초기 버그 수정에 도움을 준 특별한 플레이어',
        effect: '골드 획득 +20%, 경험치 획득 +20%, 드롭률 +10%',
        emoji: '🔍',
        rarity: '영웅'
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('칭호부여')
        .setDescription('유저에게 칭호를 부여합니다 (관리자 전용)')
        .addUserOption(option =>
            option.setName('유저')
                .setDescription('칭호를 부여할 유저')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('칭호')
                .setDescription('부여할 칭호')
                .setRequired(true)
                .addChoices(
                    { name: '🦸‍♂️ 댕댕봇 구출자', value: '댕댕봇 구출자' },
                    { name: '🔍 버그 사냥꾼', value: '버그 사냥꾼' }
                )),
    
    async execute(interaction) {
        // 관리자 권한 확인
        const adminIds = ['424480594542592009', '295980447849250817', '532128778175619084'];
        if (!adminIds.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('유저');
        const title = interaction.options.getString('칭호');

        // 타겟 유저 데이터 조회
        const userData = await User.findOne({ discordId: targetUser.id });
        if (!userData || !userData.registered) {
            return await interaction.reply({
                content: '❌ 해당 유저는 게임에 등록되지 않았습니다!',
                ephemeral: true
            });
        }

        // 이미 보유한 칭호인지 확인
        if (userData.titles && userData.titles.includes(title)) {
            return await interaction.reply({
                content: `❌ ${targetUser.username}님은 이미 **${title}** 칭호를 보유하고 있습니다!`,
                ephemeral: true
            });
        }

        // 칭호 부여
        if (!userData.titles) {
            userData.titles = [];
        }
        userData.titles.push(title);

        // 첫 칭호인 경우 자동 장착
        if (userData.titles.length === 1) {
            userData.equippedTitle = title;
        }

        await userData.save();

        const titleInfo = TITLE_INFO[title];
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎉 칭호 부여 완료!')
            .setDescription(`**${targetUser.username}**님에게 **${titleInfo.emoji} ${title}** 칭호가 부여되었습니다!`)
            .addFields(
                { name: '등급', value: titleInfo.rarity, inline: true },
                { name: '효과', value: titleInfo.effect, inline: true },
                { name: '설명', value: titleInfo.description, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `관리자: ${interaction.user.username}` });

        await interaction.reply({
            embeds: [embed]
        });

        // 로그
        console.log(`[칭호 부여] ${targetUser.username}(${targetUser.id})에게 ${title} 칭호 부여 - 관리자: ${interaction.user.username}`);
    }
};