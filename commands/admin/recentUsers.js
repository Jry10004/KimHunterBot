const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('최근가입자')
        .setDescription('최근 가입한 사용자 목록을 확인합니다 (관리자 전용)')
        .addIntegerOption(option =>
            option.setName('일수')
                .setDescription('최근 며칠 이내 가입자를 볼까요? (기본: 7일)')
                .setMinValue(1)
                .setMaxValue(30)
        ),
    
    async execute(interaction) {
        // 관리자 권한 확인
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', 
                ephemeral: true 
            });
        }

        const days = interaction.options.getInteger('일수') || 7;
        await interaction.deferReply({ ephemeral: true });

        try {
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - days);

            const recentUsers = await User.find({
                registered: true,
                createdAt: { $gte: dateLimit }
            })
            .sort({ createdAt: -1 })
            .select('email nickname discordId createdAt emailVerified level gold')
            .limit(50);

            if (recentUsers.length === 0) {
                return await interaction.editReply({
                    content: `최근 ${days}일 이내에 가입한 사용자가 없습니다.`
                });
            }

            // 임베드 생성
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`📋 최근 ${days}일 이내 가입자 목록`)
                .setDescription(`총 ${recentUsers.length}명이 가입했습니다.`)
                .setTimestamp();

            // 사용자 정보를 텍스트로 변환
            const userList = recentUsers.map((user, index) => {
                const date = new Date(user.createdAt).toLocaleString('ko-KR', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const verified = user.emailVerified ? '✅' : '❌';
                
                return `**${index + 1}.** ${date} | **${user.nickname || 'N/A'}** | Lv.${user.level}\n` +
                       `   📧 ${user.email || 'N/A'} ${verified}\n` +
                       `   💰 ${user.gold.toLocaleString()}G | ID: ${user.discordId}`;
            });

            // 사용자가 많을 경우 파일로 저장
            if (userList.length > 10) {
                const fullList = userList.join('\n\n');
                const buffer = Buffer.from(fullList, 'utf-8');
                
                embed.addFields({
                    name: '📊 요약',
                    value: `최근 ${days}일 동안 ${recentUsers.length}명이 가입했습니다.\n자세한 목록은 첨부 파일을 확인하세요.`
                });

                // 최근 5명만 임베드에 표시
                const preview = userList.slice(0, 5).join('\n\n');
                embed.addFields({
                    name: '👥 최근 가입자 (상위 5명)',
                    value: preview || '없음'
                });

                await interaction.editReply({
                    embeds: [embed],
                    files: [{
                        attachment: buffer,
                        name: `recent_users_${days}days.txt`
                    }]
                });
            } else {
                // 10명 이하일 경우 임베드에 모두 표시
                embed.addFields({
                    name: '👥 가입자 목록',
                    value: userList.join('\n\n') || '없음'
                });

                await interaction.editReply({
                    embeds: [embed]
                });
            }

            // 통계 추가
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const todayCount = recentUsers.filter(user => 
                new Date(user.createdAt) >= today
            ).length;

            const statsEmbed = new EmbedBuilder()
                .setColor('#0099FF')
                .setTitle('📈 가입 통계')
                .addFields(
                    { name: '오늘 가입', value: `${todayCount}명`, inline: true },
                    { name: `최근 ${days}일`, value: `${recentUsers.length}명`, inline: true },
                    { name: '이메일 인증률', value: `${Math.round(recentUsers.filter(u => u.emailVerified).length / recentUsers.length * 100)}%`, inline: true }
                );

            await interaction.followUp({
                embeds: [statsEmbed],
                ephemeral: true
            });

        } catch (error) {
            console.error('[최근가입자] 오류:', error);
            await interaction.editReply({
                content: '❌ 최근 가입자 목록을 가져오는 중 오류가 발생했습니다.'
            });
        }
    }
};