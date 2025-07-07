const { SlashCommandBuilder } = require('discord.js');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// 배포 명령어 (관리자 전용)
const deployCommand = {
    data: new SlashCommandBuilder()
        .setName('배포')
        .setDescription('봇 배포 관리 (관리자 전용)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('베타')
                .setDescription('베타 서버에 현재 버전 배포'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('상태')
                .setDescription('배포 상태 확인'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('롤백')
                .setDescription('이전 버전으로 롤백')),
    
    async execute(interaction) {
        // 관리자 권한 체크
        if (!isAdmin(interaction.user.id)) {
            await interaction.reply({ 
                content: '❌ 관리자만 사용할 수 있는 명령어입니다!', 
                flags: 64 
            });
            return;
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === '베타') {
            await interaction.deferReply({ flags: 64 });
            
            try {
                // Git 상태 확인
                const { stdout: status } = await execAsync('git status --porcelain');
                if (status) {
                    await interaction.editReply({
                        content: '❌ 커밋되지 않은 변경사항이 있습니다!\\n먼저 변경사항을 커밋해주세요.'
                    });
                    return;
                }
                
                // 현재 커밋 해시 가져오기
                const { stdout: commitHash } = await execAsync('git rev-parse --short HEAD');
                const { stdout: commitMessage } = await execAsync('git log -1 --pretty=%B');
                
                // 배포 스크립트 실행
                await execAsync('./deploy-beta.sh');
                
                // 배포 성공 메시지
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ 베타 배포 완료!')
                    .setDescription(`베타 서버에 새 버전이 배포되었습니다.`)
                    .addFields(
                        { name: '📌 버전', value: `\`${commitHash.trim()}\``, inline: true },
                        { name: '💬 커밋', value: commitMessage.trim(), inline: false },
                        { name: '🕐 배포 시간', value: new Date().toLocaleString('ko-KR'), inline: true }
                    )
                    .setFooter({ text: '베타 테스터들에게 새 버전을 알려주세요!' });
                
                await interaction.editReply({ embeds: [embed] });
                
                // 베타 서버에 알림 (선택사항)
                const betaChannel = client.channels.cache.get('BETA_ANNOUNCEMENT_CHANNEL_ID');
                if (betaChannel) {
                    await betaChannel.send({
                        content: '@everyone',
                        embeds: [{
                            color: 0x00ff00,
                            title: '🚀 새 버전이 배포되었습니다!',
                            description: `**변경사항:** ${commitMessage.trim()}`,
                            footer: { text: '버그를 발견하면 제보해주세요!' }
                        }]
                    });
                }
                
            } catch (error) {
                console.error('배포 오류:', error);
                await interaction.editReply({
                    content: `❌ 배포 중 오류가 발생했습니다:\\n\`\`\`${error.message}\`\`\``
                });
            }
        }
        
        else if (subcommand === '상태') {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 배포 상태')
                .addFields(
                    { name: '🔧 개발 서버', value: '✅ 정상 작동', inline: true },
                    { name: '🧪 베타 서버', value: '✅ 정상 작동', inline: true },
                    { name: '🎮 프로덕션', value: '❌ 미배포', inline: true }
                );
            
            await interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        else if (subcommand === '롤백') {
            // 롤백 로직 구현
            await interaction.reply({ 
                content: '🔄 롤백 기능은 준비 중입니다...', 
                flags: 64 
            });
        }
    }
};

module.exports = deployCommand;