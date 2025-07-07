const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const newsSystem = require('../systems/newsSystem');
const lifeSystem = require('../systems/lifeSystemIntegration');
const dungeonScheduler = require('../systems/dungeonScheduler');
const ServerSettings = require('../models/ServerSettings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('뉴스채널설정')
        .setDescription('뉴스가 발송될 채널을 설정합니다 (관리자 전용)')
        .addChannelOption(option =>
            option.setName('채널')
                .setDescription('뉴스가 발송될 채널')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const channel = interaction.options.getChannel('채널');
        
        // 텍스트 채널인지 확인
        if (channel.type !== 0) {
            return await interaction.reply({
                content: '❌ 텍스트 채널만 설정할 수 있습니다!',
                flags: 64
            });
        }
        
        // 뉴스 채널로 설정
        newsSystem.addNewsChannel(channel.id);
        lifeSystem.setNewsChannel(channel.id);
        dungeonScheduler.setNewsChannel(channel.id);
        
        // 데이터베이스에 저장
        try {
            await ServerSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { 
                    guildId: interaction.guild.id,
                    newsChannelId: channel.id
                },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('뉴스 채널 설정 저장 오류:', error);
        }
        
        // 확인 메시지
        await interaction.reply({
            content: `✅ 뉴스 채널이 ${channel}로 설정되었습니다!\n\n` +
                     `📰 발송 시간:\n` +
                     `- 아침 뉴스: 오전 9시\n` +
                     `- 저녁 뉴스: 오후 6시\n` +
                     `- 심야 뉴스: 오후 10시\n\n` +
                     `속보는 실시간으로 발송됩니다!`,
            flags: 64
        });
        
        // 테스트 메시지 발송
        try {
            await channel.send({
                content: '📰 **김헌터 월드 뉴스** 채널로 설정되었습니다!\n이제 이 채널에서 정기 뉴스와 속보를 받아보실 수 있습니다.'
            });
        } catch (error) {
            console.error('뉴스 채널 테스트 메시지 발송 실패:', error);
        }
    }
};