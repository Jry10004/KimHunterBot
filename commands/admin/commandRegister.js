require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('명령어등록')
        .setDescription('슬래시 명령어를 다시 등록합니다 (개발자 전용)')
        .addStringOption(option =>
            option.setName('범위')
                .setDescription('명령어 등록 범위')
                .setRequired(false)
                .addChoices(
                    { name: '전역 (모든 서버)', value: 'global' },
                    { name: '이 서버만', value: 'guild' }
                ))
        .addBooleanOption(option =>
            option.setName('초기화')
                .setDescription('기존 명령어를 모두 삭제하고 새로 등록')
                .setRequired(false)),
    
    async execute(interaction) {
        // 개발자 확인
        const DEVELOPER_IDS = ['424480594542592009', '295980447849250817', '532128778175619084'];
        if (!DEVELOPER_IDS.includes(interaction.user.id)) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 개발자만 사용할 수 있습니다!', 
                ephemeral: true 
            });
        }

        // 즉시 응답
        await interaction.reply({
            content: '⏳ 명령어 등록을 시작합니다...',
            flags: 64  // ephemeral flag
        });

        const scope = interaction.options.getString('범위') || 'global';
        const shouldClear = interaction.options.getBoolean('초기화') || false;

        try {
            // 환경 변수 확인 (BOT_TOKEN 또는 DISCORD_TOKEN)
            const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
            if (!token) {
                throw new Error('BOT_TOKEN 또는 DISCORD_TOKEN이 설정되지 않았습니다. .env 파일을 확인해주세요.');
            }
            if (!process.env.CLIENT_ID) {
                throw new Error('CLIENT_ID가 설정되지 않았습니다. .env 파일을 확인해주세요.');
            }
            
            const rest = new REST({ version: '10' }).setToken(token);
            
            // commands.js에서 명령어 목록 가져오기
            const commandsPath = path.join(__dirname, '..', 'commands.js');
            delete require.cache[require.resolve(commandsPath)];
            const { productionCommands } = require(commandsPath);
            
            // 이미 commands.js에 명령어초기화와 명령어등록이 포함되어 있으므로
            // 추가로 포함하지 않음
            const allCommands = productionCommands;
            
            let result;
            let route;
            
            if (scope === 'guild' && interaction.guild) {
                route = Routes.applicationGuildCommands(process.env.CLIENT_ID, interaction.guild.id);
            } else {
                route = Routes.applicationCommands(process.env.CLIENT_ID);
            }
            
            // 초기화 옵션이 켜져있으면 기존 명령어 삭제
            if (shouldClear) {
                await rest.put(route, { body: [] });
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
            }
            
            // 명령어 등록
            result = await rest.put(route, { body: allCommands });
            
            // 결과 임베드 생성
            const embed = new EmbedBuilder()
                .setTitle('✅ 명령어 등록 완료')
                .setColor('#00FF00')
                .setDescription(`${result.length}개의 명령어가 성공적으로 등록되었습니다.`)
                .addFields(
                    {
                        name: '📍 등록 범위',
                        value: scope === 'guild' ? `이 서버 (${interaction.guild.name})` : '전역 (모든 서버)',
                        inline: true
                    },
                    {
                        name: '🔄 초기화',
                        value: shouldClear ? '✅ 수행됨' : '❌ 수행 안함',
                        inline: true
                    },
                    {
                        name: '📊 등록된 명령어 수',
                        value: `${result.length}개`,
                        inline: true
                    }
                )
                .setTimestamp();
            
            // 등록된 명령어 목록 (처음 10개만)
            const commandList = result.slice(0, 10).map(cmd => `• /${cmd.name}`).join('\n');
            if (result.length > 10) {
                embed.addFields({
                    name: '📋 등록된 명령어 (일부)',
                    value: commandList + `\n... 외 ${result.length - 10}개`,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '📋 등록된 명령어',
                    value: commandList || '없음',
                    inline: false
                });
            }
            
            // 주의사항 추가
            embed.addFields({
                name: '⚠️ 주의사항',
                value: '• 전역 명령어는 반영까지 최대 1시간이 걸릴 수 있습니다.\n• 길드 명령어는 즉시 반영됩니다.\n• 명령어가 보이지 않으면 Discord를 재시작해보세요.',
                inline: false
            });
            
            // 버튼 추가
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('check_commands')
                        .setLabel('🔍 명령어 확인')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('refresh_commands')
                        .setLabel('🔄 새로고침')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.editReply({ 
                content: null,
                embeds: [embed],
                components: [buttons]
            });
            
        } catch (error) {
            console.error('명령어 등록 중 오류:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ 명령어 등록 실패')
                .setColor('#FF0000')
                .setDescription('명령어 등록 중 오류가 발생했습니다.')
                .addFields(
                    {
                        name: '오류 메시지',
                        value: `\`\`\`${error.message || '알 수 없는 오류'}\`\`\``,
                        inline: false
                    },
                    {
                        name: '해결 방법',
                        value: '• 봇 토큰이 올바른지 확인하세요.\n• 봇에 충분한 권한이 있는지 확인하세요.\n• 인터넷 연결을 확인하세요.',
                        inline: false
                    }
                )
                .setTimestamp();
            
            await interaction.editReply({ 
                content: null,
                embeds: [errorEmbed],
                components: []
            });
        }
    },
    
    async handleButton(interaction) {
        // 개발자 확인
        const DEVELOPER_IDS = ['424480594542592009', '295980447849250817', '532128778175619084'];
        if (!DEVELOPER_IDS.includes(interaction.user.id)) {
            return interaction.reply({ 
                content: '❌ 이 기능은 개발자만 사용할 수 있습니다!', 
                ephemeral: true 
            });
        }
        
        if (interaction.customId === 'check_commands') {
            await interaction.deferReply({ ephemeral: true });
            
            try {
                // 환경 변수 확인 (BOT_TOKEN 또는 DISCORD_TOKEN)
                const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
                if (!token) {
                    throw new Error('BOT_TOKEN 또는 DISCORD_TOKEN이 설정되지 않았습니다. .env 파일을 확인해주세요.');
                }
                if (!process.env.CLIENT_ID) {
                    throw new Error('CLIENT_ID가 설정되지 않았습니다. .env 파일을 확인해주세요.');
                }
                
                const rest = new REST({ version: '10' }).setToken(token);
                
                // 전역 명령어 가져오기
                const globalCommands = await rest.get(
                    Routes.applicationCommands(process.env.CLIENT_ID)
                );
                
                // 길드 명령어 가져오기 (현재 서버)
                let guildCommands = [];
                if (interaction.guild) {
                    guildCommands = await rest.get(
                        Routes.applicationGuildCommands(process.env.CLIENT_ID, interaction.guild.id)
                    );
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('📋 등록된 명령어 목록')
                    .setColor('#0099FF')
                    .setTimestamp();
                
                // 전역 명령어 목록
                if (globalCommands.length > 0) {
                    const globalList = globalCommands.slice(0, 15).map(cmd => `• /${cmd.name}`).join('\n');
                    embed.addFields({
                        name: `🌐 전역 명령어 (${globalCommands.length}개)`,
                        value: globalList + (globalCommands.length > 15 ? `\n... 외 ${globalCommands.length - 15}개` : ''),
                        inline: false
                    });
                }
                
                // 길드 명령어 목록
                if (guildCommands.length > 0) {
                    const guildList = guildCommands.slice(0, 10).map(cmd => `• /${cmd.name}`).join('\n');
                    embed.addFields({
                        name: `🏠 서버 전용 명령어 (${guildCommands.length}개)`,
                        value: guildList + (guildCommands.length > 10 ? `\n... 외 ${guildCommands.length - 10}개` : ''),
                        inline: false
                    });
                }
                
                await interaction.editReply({ embeds: [embed] });
                
            } catch (error) {
                console.error('명령어 확인 중 오류:', error);
                await interaction.editReply({ 
                    content: '❌ 명령어 목록을 가져오는 중 오류가 발생했습니다.' 
                });
            }
        } else if (interaction.customId === 'refresh_commands') {
            await interaction.reply({
                content: '🔄 명령어 캐시를 새로고침하려면 Discord를 재시작하세요.\n\n💡 **팁**: 명령어가 보이지 않는다면:\n1. Discord를 완전히 종료 후 다시 실행\n2. 서버를 나갔다가 다시 참가\n3. `/` 입력 후 잠시 대기',
                ephemeral: true
            });
        }
    }
};