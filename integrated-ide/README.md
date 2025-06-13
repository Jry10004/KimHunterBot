# 🎮 KimHunter IDE

클로드 코드와 김헌터 봇을 통합 관리할 수 있는 개발 환경입니다.

## ✨ 주요 기능

- 🤖 **Claude Code 통합**: 터미널에서 Claude Code 직접 사용
- 🎮 **봇 관리**: 김헌터 봇 시작/중지 및 실시간 콘솔 모니터링
- 💬 **실시간 채팅**: Claude와 직접 대화하며 개발
- 🔐 **보안 인증**: Authentication Code 기반 안전한 인증 시스템
- 📊 **통합 대시보드**: 모든 정보를 한 화면에서 확인

## 📋 시스템 요구사항

- Node.js 16.0.0 이상
- npm 또는 yarn
- Claude.ai 계정 (Authentication Code 필요)
- Windows/macOS/Linux

## 🚀 설치 및 실행

### 1. 의존성 설치

```bash
cd integrated-ide
npm install
```

### 2. 프로그램 실행

```bash
# 개발 모드로 실행
npm run dev

# 일반 실행
npm start
```

### 3. 첫 실행 설정

1. 프로그램 실행 후 인증 창이 나타납니다
2. Claude.ai 웹사이트에서 Authentication Code를 복사하세요
   - Claude.ai → 설정 → Authentication → Copy Code
3. 복사한 Authentication Code를 프로그램에 붙여넣기하세요
4. 인증이 완료되면 모든 기능을 사용할 수 있습니다

## 🎯 사용 방법

### 봇 관리
- **🚀 봇 시작**: 김헌터 봇을 시작합니다
- **⏹️ 봇 중지**: 실행 중인 봇을 중지합니다
- **콘솔 모니터링**: 실시간으로 봇 로그를 확인할 수 있습니다

### Claude Code 사용
- **🤖 Claude Code**: Claude Code 터미널을 시작합니다
- **명령어 입력**: 하단 입력창에서 Claude에게 명령을 전달할 수 있습니다
- **실시간 응답**: Claude의 응답을 실시간으로 확인할 수 있습니다

### 채팅 기능
- **💬 실시간 대화**: Claude와 자연어로 대화하며 개발 진행
- **대화 저장**: 중요한 대화 내용을 JSON 파일로 저장
- **대화 기록**: 모든 대화 내역을 세션 중 유지

## 📁 프로젝트 구조

```
integrated-ide/
├── src/
│   ├── main.js              # Electron 메인 프로세스
│   └── renderer/
│       ├── index.html       # 메인 UI
│       ├── styles.css       # 스타일 정의
│       └── script.js        # 프론트엔드 로직
├── package.json
└── README.md
```

## 🔧 개발자 옵션

### 빌드

```bash
# 실행 파일 생성
npm run build

# 디렉토리만 패키징
npm run pack
```

### 개발 모드

```bash
# 개발자 도구와 함께 실행
npm run dev
```

## 🛡️ 보안

- Authentication Code는 로컬에 안전하게 저장됩니다
- 세션은 24시간 후 자동으로 만료됩니다
- 외부 네트워크 연결은 필요한 경우에만 수행됩니다
- 모든 통신은 HTTPS를 통해 이루어집니다

## 🐛 문제 해결

### 인증 실패
- Authentication Code가 올바르게 복사되었는지 확인하세요
- Claude.ai 웹사이트에서 최신 Authentication Code를 다시 복사하세요
- Authentication Code가 만료되지 않았는지 확인하세요
- 인터넷 연결을 확인하세요

### 봇 시작 실패
- 프로젝트 경로가 올바른지 확인하세요
- Node.js 버전을 확인하세요
- 봇 프로젝트의 의존성이 설치되어 있는지 확인하세요

### Claude Code 연결 실패
- claude-code CLI가 설치되어 있는지 확인하세요
- 터미널 권한을 확인하세요

## 📞 지원

문제가 발생하거나 개선 사항이 있다면 이슈를 등록해주세요.

---

**🎮 즐거운 개발 되세요! 🚀**