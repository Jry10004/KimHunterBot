const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const qaLogger = require('../../systems/qaLogger');
const fs = require('fs').promises;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('버그발견')
        .setDescription('버그나 문제를 신고합니다')
        .addStringOption(option =>
            option.setName('문제')
                .setDescription('어떤 문제가 있나요? (예: 독버섯 게임이 안됨, 끝말잇기가 이상함)')
                .setRequired(true)),
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        const problem = interaction.options.getString('문제');
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const channelName = interaction.channel.name;
        const timestamp = new Date().toLocaleString('ko-KR');
        
        // 문제를 자동으로 분류
        let category = '기타';
        if (problem.includes('독버섯') || problem.includes('mushroom')) category = '독버섯 게임';
        else if (problem.includes('끝말') || problem.includes('초성') || problem.includes('워드')) category = '워드 게임';
        else if (problem.includes('운동') || problem.includes('피로')) category = '운동 시스템';
        else if (problem.includes('광산') || problem.includes('채굴')) category = '광산';
        else if (problem.includes('유물') || problem.includes('아티팩트')) category = '유물';
        else if (problem.includes('골드') || problem.includes('돈') || problem.includes('경제')) category = '경제';
        else if (problem.includes('인벤') || problem.includes('아이템')) category = '인벤토리';
        else if (problem.includes('pvp') || problem.includes('대전')) category = 'PVP';
        
        // QA 로거에 기록
        await qaLogger.logUserFeedback(userId, category, problem);
        
        // 추가 정보 수집
        const debugInfo = {
            사용자ID: userId,
            사용자명: username,
            채널: channelName,
            시간: timestamp,
            카테고리: category,
            문제내용: problem
        };
        
        await qaLogger.writeLog('[버그 신고]', debugInfo);
        
        // 사용자에게 응답
        const embed = new EmbedBuilder()
            .setTitle('🐛 버그 신고 접수')
            .setDescription('문제를 신고해주셔서 감사합니다!\n빠르게 확인하고 수정하겠습니다.')
            .addFields(
                { name: '📝 신고 내용', value: problem },
                { name: '🏷️ 분류', value: category },
                { name: '🕐 접수 시간', value: timestamp }
            )
            .setColor('#ff6b6b')
            .setFooter({ 
                text: `신고자: ${username}`, 
                iconURL: interaction.user.displayAvatarURL() 
            });
        
        await interaction.editReply({ embeds: [embed] });
        
        // 관리자 채널에 알림 (있다면)
        try {
            const adminChannel = interaction.guild.channels.cache.find(
                ch => ch.name === 'bug-reports' || ch.name === '버그-리포트'
            );
            
            if (adminChannel) {
                const adminEmbed = new EmbedBuilder()
                    .setTitle('🚨 새로운 버그 신고')
                    .setDescription(`<@${userId}>님이 버그를 신고했습니다.`)
                    .addFields(
                        { name: '문제', value: problem },
                        { name: '카테고리', value: category },
                        { name: '채널', value: `<#${interaction.channel.id}>` },
                        { name: '시간', value: timestamp }
                    )
                    .setColor('#ff0000');
                
                await adminChannel.send({ embeds: [adminEmbed] });
            }
        } catch (error) {
            console.error('관리자 알림 실패:', error);
        }
    }
};