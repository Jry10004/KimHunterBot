const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const command = new SlashCommandBuilder()
    .setName('보스소환')
    .setDescription('특정 보스를 소환합니다 (관리자 전용)')
    .addStringOption(option =>
        option.setName('보스')
            .setDescription('소환할 보스를 선택하세요')
            .setRequired(true)
            .addChoices(
                { name: '👺 고블린 족장', value: 'goblin_chief' },
                { name: '💀 해골 왕', value: 'skeleton_king' },
                { name: '🗡️ 그림자 암살자', value: 'shadow_assassin' },
                { name: '👹 데몬 로드', value: 'demon_lord' },
                { name: '🗿 고대 골렘', value: 'ancient_golem' },
                { name: '🐉 서리 드래곤', value: 'frost_dragon' },
                { name: '🔥 화염 엘리멘탈', value: 'fire_elemental' }
            ));

const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || '1385688101422371077';

if (!token) {
    console.error('BOT_TOKEN이 설정되지 않았습니다!');
    process.exit(1);
}

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
    try {
        console.log('보스소환 명령어 등록 시작...');
        
        // 길드 ID를 여기에 입력하세요
        const guildId = '1074296372787707954'; // 실제 서버 ID로 변경
        
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [command.toJSON()] },
        );

        console.log('보스소환 명령어가 성공적으로 등록되었습니다!');
    } catch (error) {
        console.error('명령어 등록 실패:', error);
    }
})();