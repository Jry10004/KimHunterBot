const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../../handlers/common/utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('회원가입채널설정')
        .setDescription('[관리자] 회원가입 채널을 설정하고 안내 메시지를 게시합니다')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        // 관리자 권한 확인
        if (!isAdmin(interaction.user.id)) {
            // 이미 defer되었는지 확인
            if (interaction.deferred) {
                return interaction.editReply({ 
                    content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!'
                });
            } else {
                return interaction.reply({ 
                    content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!', 
                    ephemeral: true 
                });
            }
        }

        // defer가 이미 되어있는지 확인하고, 안되어있으면 defer
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
        }

        try {
            const channel = interaction.channel;
            
            // 채널 이름 변경
            await channel.edit({
                name: '📝│회원가입',
                topic: '김헌터 회원가입 | /회원가입 명령어 사용'
            });

            // 회원가입 안내 임베드
            const registrationEmbed = new EmbedBuilder()
                .setTitle('📝 김헌터 회원가입')
                .setDescription(
                    '**강화왕 김헌터의 세계에 오신 것을 환영합니다!**\n\n' +
                    '게임을 시작하려면 먼저 회원가입이 필요합니다.\n' +
                    '아래 버튼을 클릭하거나 `/회원가입` 명령어를 사용하세요!'
                )
                .addFields(
                    {
                        name: '✅ 회원가입 절차',
                        value: '1️⃣ 회원가입 버튼 클릭\n' +
                               '2️⃣ 이메일 주소 입력\n' +
                               '3️⃣ 게임 닉네임 설정\n' +
                               '4️⃣ 이메일 인증 완료',
                        inline: false
                    },
                    {
                        name: '📧 이메일 인증',
                        value: '가입 시 입력한 이메일로 인증 코드가 발송됩니다.\n' +
                               '인증 코드를 입력하면 회원가입이 완료됩니다.',
                        inline: false
                    },
                    {
                        name: '🎮 게임 시작',
                        value: '회원가입 완료 후 `/게임` 명령어로 게임을 시작하세요!',
                        inline: false
                    },
                    {
                        name: '💡 주의사항',
                        value: '• 닉네임은 2~10자의 한글/영문/숫자만 가능합니다\n' +
                               '• 이메일은 인증 및 비밀번호 찾기에 사용됩니다\n' +
                               '• 한 디스코드 계정당 하나의 게임 계정만 생성 가능합니다',
                        inline: false
                    }
                )
                .setColor('#4CAF50')
                .setImage('https://i.imgur.com/wSTFkRM.png') // 예시 이미지, 실제 이미지로 교체 가능
                .setFooter({ text: '김헌터 | 강화의 신이 되어보세요!' });

            // 회원가입 버튼
            const registrationButton = new ButtonBuilder()
                .setCustomId('start_registration')
                .setLabel('📝 회원가입 시작')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');

            const row = new ActionRowBuilder()
                .addComponents(registrationButton);

            // 메시지 전송
            const message = await channel.send({
                embeds: [registrationEmbed],
                components: [row]
            });

            // 메시지 ID를 환경 변수나 설정 파일에 저장하면 좋음
            await interaction.editReply({
                content: `✅ 회원가입 채널 설정이 완료되었습니다!\n` +
                        `채널: ${channel}\n` +
                        `메시지 ID: ${message.id}`
            });

        } catch (error) {
            console.error('회원가입 채널 설정 오류:', error);
            await interaction.editReply({
                content: '❌ 채널 설정 중 오류가 발생했습니다.'
            });
        }
    }
};