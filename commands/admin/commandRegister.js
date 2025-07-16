const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { productionCommands } = require('../commands');
require('dotenv').config();

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
        // 개발자 권한 확인
        const developerIds = ['295980447849250817', '532128778175619084', '424480594542592009'];
        if (!developerIds.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 개발자만 사용할 수 있습니다!',
                flags: 64
            });
        }

        // defer 전에 이미 응답했는지 확인
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: 64 });
        }

        const scope = interaction.options.getString('범위') || 'guild';
        const clearFirst = interaction.options.getBoolean('초기화') || false;

        try {
            // 토큰 확인
            console.log('환경 변수 BOT_TOKEN:', process.env.BOT_TOKEN ? '설정됨' : '없음');
            console.log('Client token:', interaction.client.token ? '있음' : '없음');
            
            const token = process.env.BOT_TOKEN || interaction.client.token;
            if (!token) {
                throw new Error('봇 토큰을 찾을 수 없습니다. 환경 변수를 확인해주세요.');
            }
            
            const rest = new REST({ version: '9' }).setToken(token);
            const clientId = interaction.client.user.id;
            const guildId = interaction.guild.id;

            // 보스소환 명령어 디버깅
            const bossCommand = productionCommands.find(cmd => cmd.name === '보스소환');
            console.log('보스소환 명령어 데이터:', JSON.stringify(bossCommand, null, 2));
            
            // 슬래시 빌더로 변환
            const commands = productionCommands.map(cmd => {
                const builder = new SlashCommandBuilder()
                    .setName(cmd.name)
                    .setDescription(cmd.description);
                
                // 옵션 처리
                if (cmd.options) {
                    if (cmd.name === '보스소환') {
                        console.log('보스소환 옵션 처리 시작:', cmd.options);
                    }
                    cmd.options.forEach(option => {
                        if (option.type === 1) { // SUB_COMMAND
                            builder.addSubcommand(sub => {
                                sub.setName(option.name).setDescription(option.description);
                                if (option.options) {
                                    option.options.forEach(subOpt => {
                                        if (subOpt.type === 3) { // STRING
                                            sub.addStringOption(opt => {
                                                opt.setName(subOpt.name)
                                                   .setDescription(subOpt.description)
                                                   .setRequired(subOpt.required || false);
                                                if (subOpt.choices) {
                                                    subOpt.choices.forEach(choice => {
                                                        opt.addChoices(choice);
                                                    });
                                                }
                                                return opt;
                                            });
                                        } else if (subOpt.type === 4) { // INTEGER
                                            sub.addIntegerOption(opt => {
                                                opt.setName(subOpt.name)
                                                   .setDescription(subOpt.description)
                                                   .setRequired(subOpt.required || false);
                                                if (subOpt.min_value !== undefined) opt.setMinValue(subOpt.min_value);
                                                if (subOpt.max_value !== undefined) opt.setMaxValue(subOpt.max_value);
                                                return opt;
                                            });
                                        } else if (subOpt.type === 6) { // USER
                                            sub.addUserOption(opt => opt
                                                .setName(subOpt.name)
                                                .setDescription(subOpt.description)
                                                .setRequired(subOpt.required || false)
                                            );
                                        }
                                    });
                                }
                                return sub;
                            });
                        } else if (option.type === 3) { // STRING
                            builder.addStringOption(opt => {
                                opt.setName(option.name)
                                   .setDescription(option.description)
                                   .setRequired(option.required || false);
                                if (option.choices) {
                                    option.choices.forEach(choice => {
                                        opt.addChoices(choice);
                                    });
                                }
                                return opt;
                            });
                        } else if (option.type === 4) { // INTEGER
                            builder.addIntegerOption(opt => {
                                opt.setName(option.name)
                                   .setDescription(option.description)
                                   .setRequired(option.required || false);
                                if (option.min_value !== undefined) opt.setMinValue(option.min_value);
                                if (option.max_value !== undefined) opt.setMaxValue(option.max_value);
                                return opt;
                            });
                        } else if (option.type === 5) { // BOOLEAN
                            builder.addBooleanOption(opt => opt
                                .setName(option.name)
                                .setDescription(option.description)
                                .setRequired(option.required || false)
                            );
                        } else if (option.type === 6) { // USER
                            builder.addUserOption(opt => opt
                                .setName(option.name)
                                .setDescription(option.description)
                                .setRequired(option.required || false)
                            );
                        } else if (option.type === 7) { // CHANNEL
                            builder.addChannelOption(opt => {
                                opt.setName(option.name)
                                   .setDescription(option.description)
                                   .setRequired(option.required || false);
                                if (option.channel_types) {
                                    opt.addChannelTypes(...option.channel_types);
                                }
                                return opt;
                            });
                        }
                    });
                }
                
                const jsonCommand = builder.toJSON();
                if (cmd.name === '보스소환') {
                    console.log('보스소환 최종 명령어 JSON:', JSON.stringify(jsonCommand, null, 2));
                }
                return jsonCommand;
            });

            let result;
            if (scope === 'global') {
                // 글로벌 명령어 등록
                if (clearFirst) {
                    await rest.put(Routes.applicationCommands(clientId), { body: [] });
                }
                result = await rest.put(
                    Routes.applicationCommands(clientId),
                    { body: commands }
                );
            } else {
                // 길드 명령어 등록
                if (clearFirst) {
                    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
                }
                result = await rest.put(
                    Routes.applicationGuildCommands(clientId, guildId),
                    { body: commands }
                );
            }

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ 명령어 등록 완료!')
                .setDescription(`${scope === 'global' ? '전역' : '길드'} 명령어가 성공적으로 등록되었습니다.`)
                .addFields(
                    { name: '등록된 명령어 수', value: `${result.length}개`, inline: true },
                    { name: '등록 범위', value: scope === 'global' ? '모든 서버' : '현재 서버', inline: true },
                    { name: '초기화 여부', value: clearFirst ? '✅ 초기화 후 등록' : '❌ 기존 명령어 유지', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `실행자: ${interaction.user.username}` });

            await interaction.editReply({
                embeds: [embed]
            });

            console.log(`[명령어 등록] ${result.length}개 명령어 등록 완료 - 범위: ${scope}, 실행자: ${interaction.user.username}`);

        } catch (error) {
            console.error('명령어 등록 오류:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ 명령어 등록 실패')
                .setDescription('명령어 등록 중 오류가 발생했습니다.')
                .addFields({
                    name: '오류 메시지',
                    value: `\`\`\`${error.message}\`\`\``
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [errorEmbed]
            });
        }
    }
};