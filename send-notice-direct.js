// 직접 공지 발송 명령어 추가 스크립트
// 이 코드를 index.js의 명령어 처리 부분에 추가하세요

// 명령어: /긴급공지
else if (commandName === '긴급공지') {
    // 관리자 체크
    if (!ADMIN_IDS.includes(interaction.user.id)) {
        await interaction.reply({ 
            content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!', 
            flags: 64 
        });
        return;
    }
    
    const channel = interaction.channel;
    
    // 첫 번째 공지: 업데이트
    const updateEmbed = new EmbedBuilder()
        .setColor('#9900ff')
        .setTitle('🟡 🛡️ 매크로 방지 시스템 도입 업데이트')
        .setAuthor({ 
            name: '김헌터 운영팀', 
            iconURL: client.user.displayAvatarURL() 
        })
        .setDescription(`**버전**: v1.5.0

안녕하세요, 김헌터 운영팀입니다.

더욱 공정한 게임 환경을 위해 매크로 방지 시스템을 도입했습니다.

본 업데이트는 정상적인 플레이어에게는 전혀 영향을 주지 않으며,
비정상적인 패턴이 감지될 경우에만 작동합니다.

【시스템 작동 방식】
• 비정상적으로 빠른 반복 클릭 감지
• 동일한 패턴의 반복 행동 분석
• 의심 패턴 발견 시 간단한 검증 요청

【검증 방식】
• 간단한 버튼 클릭
• 최대 10초 이내 완료
• 정상 플레이어는 즉시 통과

모든 플레이어가 공정하게 즐길 수 있는 환경을 만들어가겠습니다.
감사합니다.`)
        .addFields(
            { 
                name: '✨ 변경사항', 
                value: `• 매크로 방지 시스템 도입
• 실시간 패턴 분석 기능 추가
• 단계별 제재 시스템 구현
• /매크로테스트 명령어 추가 (관리자 전용)` 
            },
            { 
                name: '🏷️ 태그', 
                value: '`업데이트` `매크로방지` `보안강화` `시스템개선`' 
            }
        )
        .setFooter({ text: '📋 업데이트 | 📋 업데이트 공지' })
        .setTimestamp();
    
    // 두 번째 공지: 점검 및 사과
    const maintenanceEmbed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('🔴 🙏 오픈 연기 사과 및 사전강화 이벤트 대규모 업데이트')
        .setAuthor({ 
            name: '김헌터 운영팀', 
            iconURL: client.user.displayAvatarURL() 
        })
        .setDescription(`안녕하세요, 김헌터 운영팀입니다.

먼저 예정된 오픈 일정이 연기된 점에 대해 진심으로 사과드립니다.
더 나은 서비스를 제공하기 위한 불가피한 결정이었음을 양해 부탁드립니다.

기다려주시는 분들을 위해 사전강화 이벤트를 대폭 개선했습니다!

【사전강화 이벤트 업데이트】
🎯 최대 강화 레벨: +30 → +999 상향!
💰 1등 보상: 20만 골드 → 40만 골드 대폭 상향!
🐕 댕댕봇 이벤트: 유지시간 3분으로 증가

【새로운 강화 시스템】
• 300강 이상: 파괴/하락/유지 시스템 도입
• 난이도별 차별화된 보상
• 실시간 랭킹 시스템

【댕댕봇 개선사항】
• /댕댕봇소환 명령어로 원하는 채널 지정 가능
• 1시간에 5번 랜덤 출현
• 정답 시 강화 +1 보너스

오픈까지 더욱 재미있게 즐기실 수 있도록 노력하겠습니다.
기다려주시는 모든 분들께 다시 한번 감사드립니다.`)
        .addFields(
            { 
                name: '🕐 점검 시간', 
                value: '완료', 
                inline: true 
            },
            { 
                name: '⏱️ 예상 소요시간', 
                value: '완료', 
                inline: true 
            },
            { 
                name: '🎁 보상', 
                value: '• 사전강화 이벤트 보상 2배 상향\n• 정식 오픈 시 추가 보상 예정' 
            },
            { 
                name: '🏷️ 태그', 
                value: '`점검완료` `사과` `사전강화` `이벤트업데이트` `보상상향`' 
            }
        )
        .setFooter({ text: '🔧 점검 | 🔧 점검 공지' })
        .setTimestamp();
    
    await interaction.deferReply({ flags: 64 });
    
    // 공지 발송
    const msg1 = await channel.send({ embeds: [updateEmbed] });
    await msg1.react('✅');
    await msg1.react('❓');
    
    const msg2 = await channel.send({ embeds: [maintenanceEmbed] });
    await msg2.react('✅');
    await msg2.react('❓');
    await msg2.pin(); // 중요도가 높으므로 고정
    
    await interaction.editReply({ 
        content: '✅ 긴급 공지가 발송되었습니다!' 
    });
}