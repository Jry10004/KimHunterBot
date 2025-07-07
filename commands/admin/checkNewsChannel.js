const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const newsSystem = require('../systems/newsSystem');
const ServerSettings = require('../models/ServerSettings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('뉴스채널확인')
        .setDescription('현재 설정된 뉴스 채널을 확인하고 문제를 진단합니다 (관리자 전용)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        // 뉴스 시스템 상태 확인
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📰 뉴스 시스템 진단')
            .setTimestamp();
        
        // 현재 메모리상의 뉴스 채널
        embed.addFields({
            name: '📋 메모리 상태',
            value: [
                `초기화 여부: ${newsSystem.isInitialized ? '✅ 초기화됨' : '❌ 초기화 안됨'}`,
                `클라이언트 연결: ${newsSystem.client ? '✅ 연결됨' : '❌ 연결 안됨'}`,
                `뉴스 채널 수: ${newsSystem.newsChannels.size}개`,
                `채널 ID들: ${newsSystem.newsChannels.size > 0 ? Array.from(newsSystem.newsChannels).join(', ') : '없음'}`
            ].join('\n'),
            inline: false
        });
        
        // 데이터베이스에서 설정 확인
        try {
            const dbSettings = await ServerSettings.findOne({ guildId: interaction.guild.id });
            
            if (dbSettings && dbSettings.newsChannelId) {
                embed.addFields({
                    name: '💾 데이터베이스 설정',
                    value: [
                        `서버 ID: ${dbSettings.guildId}`,
                        `뉴스 채널 ID: ${dbSettings.newsChannelId}`,
                        `설정 날짜: ${dbSettings.updatedAt.toLocaleString('ko-KR')}`
                    ].join('\n'),
                    inline: false
                });
                
                // 채널이 실제로 존재하는지 확인
                try {
                    const channel = await interaction.client.channels.fetch(dbSettings.newsChannelId);
                    embed.addFields({
                        name: '📢 채널 상태',
                        value: [
                            `채널명: ${channel.name}`,
                            `채널 타입: ${channel.type === 0 ? '텍스트 채널' : '기타'}`,
                            `접근 가능: ✅`
                        ].join('\n'),
                        inline: false
                    });
                } catch (error) {
                    embed.addFields({
                        name: '📢 채널 상태',
                        value: `❌ 채널을 찾을 수 없습니다: ${error.message}`,
                        inline: false
                    });
                }
                
                // 메모리에 없다면 추가
                if (!newsSystem.newsChannels.has(dbSettings.newsChannelId)) {
                    newsSystem.addNewsChannel(dbSettings.newsChannelId);
                    embed.addFields({
                        name: '🔧 자동 복구',
                        value: '✅ 데이터베이스의 채널 ID를 메모리에 추가했습니다.',
                        inline: false
                    });
                }
            } else {
                embed.addFields({
                    name: '💾 데이터베이스 설정',
                    value: '❌ 이 서버에 설정된 뉴스 채널이 없습니다.',
                    inline: false
                });
            }
        } catch (error) {
            embed.addFields({
                name: '⚠️ 데이터베이스 오류',
                value: error.message,
                inline: false
            });
        }
        
        // 뉴스 큐 상태
        embed.addFields({
            name: '📊 뉴스 큐 상태',
            value: [
                `일반 뉴스 큐: ${newsSystem.newsQueue.length}개`,
                `속보 큐: ${newsSystem.breakingNews.length}개`,
                `히스토리: ${newsSystem.newsHistory.length}개`
            ].join('\n'),
            inline: false
        });
        
        // 해결 방법 제안
        if (newsSystem.newsChannels.size === 0) {
            embed.addFields({
                name: '💡 해결 방법',
                value: '`/뉴스채널설정` 명령어를 사용하여 뉴스 채널을 설정해주세요.',
                inline: false
            });
        }
        
        await interaction.editReply({ embeds: [embed] });
        
        // 테스트 메시지 발송 옵션
        if (newsSystem.newsChannels.size > 0) {
            await interaction.followUp({
                content: '📰 테스트 뉴스를 발송하시겠습니까? `/뉴스테스트 유형:속보`를 사용해보세요.',
                flags: 64
            });
        }
    }
};