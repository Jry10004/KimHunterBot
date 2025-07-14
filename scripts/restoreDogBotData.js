const fs = require('fs');
const path = require('path');

// 완전한 이벤트 데이터 복원
const eventData = {
  "status": {
    "isActive": true,
    "startTime": "2025-01-07T21:38:00.000Z",
    "currentFloor": 3,
    "totalFloors": 5,
    "rescueComplete": false
  },
  "floors": {
    "1": { "currentHP": 0 },
    "2": { "currentHP": 0 },
    "3": { "currentHP": 72000 }, // 30%로 설정
    "4": { "currentHP": 300000 },
    "5": { "currentHP": 360000 }
  },
  "statistics": {
    "totalAttacks": 144,
    "totalDamage": 529689,
    "participants": [
      "295980447849250817",
      "364197967114272769",
      "1374702838541168650",
      "unknown",
      "424480594542592009"
    ],
    "attackLog": [], // 로그는 너무 길어서 생략
    "mvp": {
      "userId": "295980447849250817",
      "damage": 339717
    },
    "floorMVP": {
      "1": {
        "userId": "295980447849250817",
        "damage": 49450
      },
      "2": {
        "userId": "295980447849250817",
        "damage": 103895
      },
      "3": {
        "userId": "295980447849250817",
        "damage": 126105
      }
    },
    "userDamage": {
      "295980447849250817": 339717,
      "364197967114272769": 150404,
      "1374702838541168650": 28809,  // 인프 병합된 데이터
      "unknown": 1015,
      "424480594542592009": 9744
    },
    "userAttackCount": {
      "295980447849250817": 57,
      "364197967114272769": 61,
      "1374702838541168650": 16,  // 인프 병합된 데이터
      "unknown": 1,
      "424480594542592009": 9
    },
    "lastAttackTime": {
      "295980447849250817": 1751965702809,
      "364197967114272769": 1751964339260,
      "1374702838541168650": 1751965715925,
      "424480594542592009": 1751939002975
    }
  },
  "hostages": {
    "activeHostages": {},
    "hostageHistory": []
  }
};

// 백업에서 공격 로그만 복원
try {
    const backupPath = path.join(__dirname, '../backups/dogbot_old_with_duplicates/dogbot_2025-07-08T09-16-12.json');
    if (fs.existsSync(backupPath)) {
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        
        // 공격 로그에서 592659577384730645를 1374702838541168650로 변경
        eventData.statistics.attackLog = backupData.statistics.attackLog.map(log => {
            if (log.userId === '592659577384730645') {
                return { ...log, userId: '1374702838541168650' };
            }
            return log;
        });
        
        console.log('✅ 공격 로그 복원 완료 (중복 ID 병합됨)');
    }
} catch (error) {
    console.error('⚠️  공격 로그 복원 실패:', error);
}

// 파일 저장
const targetPath = path.join(__dirname, '../data/dogBotRescueState.json');
fs.writeFileSync(targetPath, JSON.stringify(eventData, null, 2));

// 백업 생성
const backupDir = path.join(__dirname, '../backups/dogbot');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const backupPath = path.join(backupDir, `dogbot_${timestamp}.json`);
fs.writeFileSync(backupPath, JSON.stringify(eventData, null, 2));

console.log('✅ 댕댕봇 구출 이벤트 데이터 복원 완료!');
console.log('📊 현재 상태:');
console.log(`  - 3층 HP: ${eventData.floors['3'].currentHP.toLocaleString()} / 240,000 (30%)`)
console.log(`  - 참여자: ${eventData.statistics.participants.length}명`);
console.log(`  - 총 공격: ${eventData.statistics.totalAttacks}회`);
console.log(`  - 인프 데이터: ${eventData.statistics.userDamage['1374702838541168650'].toLocaleString()} 데미지, ${eventData.statistics.userAttackCount['1374702838541168650']}회 공격`);
console.log(`✅ 백업 생성: ${backupPath}`);