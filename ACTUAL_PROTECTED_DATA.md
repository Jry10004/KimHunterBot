# 🛡️ 실제 보호되는 게임 데이터 목록

## ✅ 구현되어 있고 보호되는 기능

### 💰 경제 시스템
- **골드** (gold)
- **인벤토리** (inventory) - 모든 아이템
- **장비** (equipment) - 착용 중인 아이템
- **강화석** (enhancementStone)
- **강화 레벨 & 스탯** (enhancementLevel, enhanceStats)
- **에너지 조각** (energyFragments) - 채굴 자원
- **유물** (artifacts) - 수집한 유물들

### 📈 주식 시스템
- **주식 포트폴리오** (stockPortfolio) - 보유 주식
- **주식 거래 기록** (stockHistory)

### ⚔️ 전투 & 사냥
- **사냥 티켓** (huntingTickets)
- **PvP 티켓** (pvpTickets)
- **PvP 레이팅 & 티어** (pvp)
- **보스 진행도** (bossProgress)
- **주간 보스 입장권** (weeklyBossEntries)

### 🎮 미니게임 통계
- **레이싱** (racingStats)
- **슬롯머신** (slotStats)
- **던전** (dungeonStats)
- **가위바위보** (rpsStats)
- **독버섯** (mushroomStats)
- **블랙잭** (blackjackStats)
- **주사위** (diceStats)
- **홀짝** (oddEvenStats)

### 📊 캐릭터 성장
- **레벨 & 경험치** (level, exp)
- **스탯 포인트** (statPoints)
- **능력치** (stats.strength, agility, intelligence, defense, luck)
- **스킬** (skills)
- **인기도** (popularity)

### 🏆 업적 & 기록
- **업적** (achievements)
- **칭호** (titles, currentTitle)
- **멀티플레이 통계** (multiplayerStats)
- **완료한 퀘스트** (completedQuests)

### 📅 출석 & 이벤트
- **출석 연속일** (attendanceStreak)
- **총 출석일** (totalAttendance)
- **월간 출석** (monthlyAttendance)
- **사전강화 이벤트** (prelaunchEnhancement)
- **댕댕봇 동전던지기** (dogBotCoinflip)

### 💪 피트니스 시스템
- **피트니스 데이터** (fitness)
- **피트니스 레벨** (fitnessLevel)
- **피트니스 경험치** (fitnessExp)

### 🎨 커스터마이징
- **엠블럼** (emblems)
- **구매한 메뉴** (purchasedMenus)
- **선택한 메뉴 색상** (selectedMenuColor)

### 🔒 보안 데이터
- **가입 IP** (registrationIP)
- **마지막 접속 IP** (lastLoginIP)
- **IP 기록** (ipHistory)
- **이메일 & 인증** (email, emailVerified)
- **매크로 의심도** (macroSuspicion)

## ❌ 구현되지 않은 기능 (보호 불필요)
- 친구 시스템
- 길드/클랜 시스템
- 결혼 시스템
- 경매장 (구조만 있고 미구현)

## 📅 리셋되는 데이터 (의도적)

### 일일 리셋
- 일일 미션 진행도
- 일일 출석 체크
- 일일 인기도 변화량
- 일일 융합 횟수
- 피트니스 일일 목표

### 주간 리셋
- 주간 출석 체크
- 주간 퀘스트
- 피트니스 주간 목표

---

이 목록의 모든 데이터는 **절대 초기화되지 않으며**, 백업 시스템으로 보호됩니다!