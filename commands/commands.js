// Production commands export
const productionCommands = [
    {
        name: '게임',
        description: '게임 메뉴를 엽니다',
        type: 1,
    },
    {
        name: '핑',
        description: '봇의 응답속도를 확인합니다',
        type: 1,
    },
    {
        name: '회원가입',
        description: '김헌터 게임에 회원가입합니다',
        type: 1,
    },
    {
        name: '계급부여',
        description: '아이템에 김헌터 계급을 부여합니다',
        type: 1,
    },
    {
        name: '주식',
        description: '주식 거래소를 엽니다',
        type: 1,
    },
    {
        name: '랭킹',
        description: '전체 랭킹을 확인합니다',
        type: 1,
    },
    {
        name: '의뢰',
        description: '랜덤 의뢰를 수행합니다',
        type: 1,
    },
    {
        name: '결투',
        description: 'PVP 결투를 시작합니다',
        type: 1,
    },
    {
        name: '독버섯',
        description: '독버섯 게임을 시작합니다',
        type: 1,
    },
    {
        name: '홀짝',
        description: '홀짝 게임을 시작합니다',
        type: 1,
    },
    {
        name: '초성',
        description: '초성 게임을 시작합니다',
        type: 1,
    },
    {
        name: '끝말잇기',
        description: '끝말잇기 게임을 시작합니다',
        type: 1,
    },
    {
        name: '에너지채굴',
        description: '에너지 조각을 채굴합니다',
        type: 1,
    },
    {
        name: '유물탐사',
        description: '유물 탐사를 시작합니다',
        type: 1,
    },
    {
        name: '서버오픈',
        description: '서버를 오픈합니다 (관리자 전용)',
        type: 1
    },
    {
        name: '보스',
        description: '보스 레이드를 관리합니다 (관리자 전용)',
        type: 1,
        options: [
            {
                name: '스폰',
                description: '보스를 소환합니다',
                type: 1,
                options: [
                    {
                        name: '보스',
                        description: '소환할 보스를 선택하세요',
                        type: 3,
                        required: false,
                        choices: [
                            { name: '그림자 암살자', value: 'shadow_assassin' },
                            { name: '용암 골렘', value: 'lava_golem' },
                            { name: '얼음 여왕', value: 'ice_queen' },
                            { name: '폭풍의 지배자', value: 'storm_lord' },
                            { name: '어둠의 군주', value: 'dark_lord' }
                        ]
                    }
                ]
            },
            {
                name: '종료',
                description: '현재 보스를 제거합니다',
                type: 1
            },
            {
                name: '정보',
                description: '현재 보스 정보를 확인합니다',
                type: 1
            }
        ]
    },
    {
        name: '돈지급',
        description: '유저에게 골드를 지급합니다 (관리자 전용)',
        type: 1,
        options: [
            {
                name: '유저',
                description: '골드를 지급할 유저',
                type: 6,
                required: true
            },
            {
                name: '금액',
                description: '지급할 골드 금액',
                type: 4,
                required: true,
                min_value: 1
            }
        ]
    },
    {
        name: '말',
        description: '봇이 메시지를 전송합니다 (관리자 전용)',
        type: 1,
        options: [
            {
                name: '메시지',
                description: '봇이 전송할 메시지',
                type: 3,
                required: true
            },
            {
                name: '채널',
                description: '메시지를 전송할 채널 (비워두면 현재 채널)',
                type: 7,
                required: false,
                channel_types: [0, 5] // 텍스트 채널과 공지 채널만
            }
        ]
    },
    {
        name: '사전강화',
        description: '오픈 전 강화 이벤트에 참여합니다',
        type: 1,
    },
    {
        name: '사냥',
        description: '사냥터로 이동합니다',
        type: 1,
    },
    {
        name: 'ip관리',
        description: 'IP 관련 정보를 관리합니다 (관리자 전용)',
        type: 1,
        options: [
            {
                name: '조회',
                description: '유저의 IP 정보를 조회합니다',
                type: 1,
                options: [
                    {
                        name: '유저',
                        description: '조회할 유저',
                        type: 6,
                        required: true
                    }
                ]
            },
            {
                name: '이메일조회',
                description: '이메일로 연결된 모든 계정을 조회합니다',
                type: 1,
                options: [
                    {
                        name: '이메일',
                        description: '조회할 이메일 주소',
                        type: 3,
                        required: true
                    }
                ]
            },
            {
                name: '차단',
                description: 'IP를 차단 목록에 추가합니다',
                type: 1,
                options: [
                    {
                        name: 'ip',
                        description: '차단할 IP 주소',
                        type: 3,
                        required: true
                    },
                    {
                        name: '사유',
                        description: '차단 사유',
                        type: 3,
                        required: false
                    }
                ]
            }
        ]
    },
    {
        name: '청소',
        description: '채널의 메시지를 삭제합니다',
        type: 1,
        options: [
            {
                name: '시간',
                description: '특정 시간 이내의 메시지를 삭제합니다',
                type: 1,
                options: [
                    {
                        name: '시간',
                        description: '삭제할 메시지의 시간 범위 (시간 단위)',
                        type: 4,
                        required: true,
                        min_value: 1,
                        max_value: 168
                    },
                    {
                        name: '개수',
                        description: '삭제할 메시지 개수 (기본값: 100)',
                        type: 4,
                        required: false,
                        min_value: 1,
                        max_value: 100
                    }
                ]
            },
            {
                name: '일',
                description: '특정 일 이내의 메시지를 삭제합니다',
                type: 1,
                options: [
                    {
                        name: '일',
                        description: '삭제할 메시지의 일 범위',
                        type: 4,
                        required: true,
                        min_value: 1,
                        max_value: 7
                    },
                    {
                        name: '개수',
                        description: '삭제할 메시지 개수 (기본값: 100)',
                        type: 4,
                        required: false,
                        min_value: 1,
                        max_value: 100
                    }
                ]
            },
            {
                name: '개수',
                description: '특정 개수의 메시지를 삭제합니다',
                type: 1,
                options: [
                    {
                        name: '개수',
                        description: '삭제할 메시지 개수',
                        type: 4,
                        required: true,
                        min_value: 1,
                        max_value: 100
                    }
                ]
            }
        ]
    },
    {
        name: '매크로감지',
        description: '매크로 감지 시스템 관리 (관리자 전용)',
        type: 1,
        options: [
            {
                name: '검사',
                description: '특정 유저를 매크로 검사합니다',
                type: 1,
                options: [
                    {
                        name: '유저',
                        description: '검사할 유저',
                        type: 6,
                        required: true
                    }
                ]
            },
            {
                name: '상태',
                description: '매크로 감지 시스템 상태를 확인합니다',
                type: 1,
                options: [
                    {
                        name: '유저',
                        description: '특정 유저의 상태 확인 (선택사항)',
                        type: 6,
                        required: false
                    }
                ]
            },
            {
                name: '제재해제',
                description: '유저의 매크로 제재를 해제합니다',
                type: 1,
                options: [
                    {
                        name: '유저',
                        description: '제재를 해제할 유저',
                        type: 6,
                        required: true
                    }
                ]
            },
            {
                name: '화이트리스트',
                description: '화이트리스트 관리',
                type: 1,
                options: [
                    {
                        name: '작업',
                        description: '수행할 작업',
                        type: 3,
                        required: true,
                        choices: [
                            { name: '추가', value: 'add' },
                            { name: '제거', value: 'remove' },
                            { name: '목록', value: 'list' }
                        ]
                    },
                    {
                        name: '유저',
                        description: '대상 유저 (목록 조회시 불필요)',
                        type: 6,
                        required: false
                    }
                ]
            },
            {
                name: '통계',
                description: '매크로 감지 시스템 전체 통계를 확인합니다',
                type: 1
            }
        ]
    },
    {
        name: '공지작성',
        description: '프로페셔널 공지사항을 작성합니다 (관리자 전용)',
        type: 1,
        options: [
            {
                name: '새공지',
                description: '새로운 공지사항을 작성합니다',
                type: 1,
                options: [
                    {
                        name: '템플릿',
                        description: '공지 템플릿을 선택하세요',
                        type: 3,
                        required: true,
                        choices: [
                            { name: '📢 기본 공지', value: 'basic' },
                            { name: '🔧 점검 공지', value: 'maintenance' },
                            { name: '🎉 이벤트 공지', value: 'event' },
                            { name: '📋 업데이트 공지', value: 'update' }
                        ]
                    }
                ]
            },
            {
                name: '미리보기',
                description: '저장된 공지를 미리보기합니다',
                type: 1,
                options: [
                    {
                        name: '공지id',
                        description: '미리보기할 공지 ID',
                        type: 3,
                        required: true
                    }
                ]
            },
            {
                name: '발송',
                description: '저장된 공지를 발송합니다',
                type: 1,
                options: [
                    {
                        name: '공지id',
                        description: '발송할 공지 ID',
                        type: 3,
                        required: true
                    },
                    {
                        name: '채널',
                        description: '공지를 발송할 채널',
                        type: 7,
                        required: true,
                        channel_types: [0, 5] // 텍스트 채널과 공지 채널만
                    },
                    {
                        name: '멘션',
                        description: '멘션 옵션',
                        type: 3,
                        required: false,
                        choices: [
                            { name: '@everyone', value: 'everyone' },
                            { name: '@here', value: 'here' },
                            { name: '멘션 없음', value: 'none' }
                        ]
                    }
                ]
            },
            {
                name: '목록',
                description: '저장된 공지 목록을 확인합니다',
                type: 1
            },
            {
                name: '삭제',
                description: '저장된 공지를 삭제합니다',
                type: 1,
                options: [
                    {
                        name: '공지id',
                        description: '삭제할 공지 ID',
                        type: 3,
                        required: true
                    }
                ]
            }
        ]
    },
    {
        name: '댕댕봇소환',
        description: '댕댕봇을 이 채널에 소환합니다 (관리자 전용)',
        type: 1
    },
    {
        name: '권한테스트',
        description: '봇과 사용자의 권한을 확인합니다',
        type: 1
    },
    {
        name: '데이터복구',
        description: '[관리자 전용] 유저 데이터 백업 및 복구',
        type: 1,
        options: [
            {
                name: '백업',
                description: '특정 유저의 데이터를 백업합니다',
                type: 1,
                options: [
                    {
                        name: '유저',
                        description: '백업할 유저',
                        type: 6,
                        required: true
                    }
                ]
            },
            {
                name: '복구',
                description: '유저의 백업 데이터를 복구합니다',
                type: 1,
                options: [
                    {
                        name: '유저',
                        description: '복구할 유저',
                        type: 6,
                        required: true
                    }
                ]
            },
            {
                name: '검증',
                description: '유저 데이터의 무결성을 검증합니다',
                type: 1,
                options: [
                    {
                        name: '유저',
                        description: '검증할 유저',
                        type: 6,
                        required: true
                    }
                ]
            },
            {
                name: '목록',
                description: '특정 유저의 백업 목록을 확인합니다',
                type: 1,
                options: [
                    {
                        name: '유저',
                        description: '백업 목록을 확인할 유저',
                        type: 6,
                        required: true
                    }
                ]
            }
        ]
    },
    {
        name: '관리자',
        description: '관리자 패널을 엽니다 (관리자 전용)',
        type: 1,
        options: [
            {
                name: '엠블럼초기화',
                description: '특정 유저의 엠블럼을 초기화합니다',
                type: 1,
                options: [
                    {
                        name: '유저',
                        description: '엠블럼을 초기화할 유저',
                        type: 6,
                        required: true
                    }
                ]
            },
            {
                name: '엠블럼지급',
                description: '특정 유저에게 엠블럼을 지급합니다',
                type: 1,
                options: [
                    {
                        name: '유저',
                        description: '엠블럼을 지급받을 유저',
                        type: 6,
                        required: true
                    },
                    {
                        name: '계열',
                        description: '엠블럼 계열',
                        type: 3,
                        required: true,
                        choices: [
                            { name: '⚔️ 전사', value: 'warrior' },
                            { name: '🏹 궁수', value: 'archer' },
                            { name: '🛡️ 수호자', value: 'defender' },
                            { name: '🧙 마법사', value: 'wizard' },
                            { name: '🗡️ 도적', value: 'rogue' }
                        ]
                    },
                    {
                        name: '등급',
                        description: '엠블럼 등급 (0-4)',
                        type: 4,
                        required: true,
                        min_value: 0,
                        max_value: 4
                    }
                ]
            },
            {
                name: '엠블럼현황',
                description: '전체 엠블럼 보유 현황을 확인합니다',
                type: 1
            },
            {
                name: '엠블럼상점새로고침',
                description: '영구 엠블럼 상점을 새로고침합니다',
                type: 1
            }
        ]
    },
    {
        name: '데이터관리',
        description: '게임 데이터 관리 시스템 (관리자 전용)',
        type: 1,
        options: [
            {
                name: '상태',
                description: '데이터 매니저 상태 확인',
                type: 1
            },
            {
                name: '저장',
                description: '모든 데이터 즉시 저장',
                type: 1
            },
            {
                name: '백업',
                description: '데이터 백업 생성',
                type: 1
            },
            {
                name: '백업목록',
                description: '백업 목록 확인',
                type: 1
            },
            {
                name: '복원',
                description: '백업에서 데이터 복원',
                type: 1,
                options: [
                    {
                        name: '백업명',
                        description: '복원할 백업 이름',
                        type: 3,
                        required: true
                    }
                ]
            }
        ]
    },
    {
        name: '명령어초기화',
        description: '중복된 명령어를 제거합니다 (개발자 전용)',
        type: 1
    },
    {
        name: '명령어등록',
        description: '슬래시 명령어를 다시 등록합니다 (개발자 전용)',
        type: 1,
        options: [
            {
                name: '범위',
                description: '명령어 등록 범위',
                type: 3,
                required: false,
                choices: [
                    { name: '전역 (모든 서버)', value: 'global' },
                    { name: '이 서버만', value: 'guild' }
                ]
            },
            {
                name: '초기화',
                description: '기존 명령어를 모두 삭제하고 새로 등록',
                type: 5,
                required: false
            }
        ]
    },
    {
        name: '댕댕봇구출시작',
        description: '댕댕봇 구출 이벤트를 시작합니다 (관리자 전용)',
        type: 1,
        options: [
            {
                name: '초기화',
                description: '이벤트 데이터를 초기화하고 시작',
                type: 5,
                required: false
            }
        ]
    },
    {
        name: '댕댕봇납치',
        description: '댕댕봇 납치 이벤트 현황을 확인합니다',
        type: 1
    },
    {
        name: '버그발견',
        description: '버그나 문제를 신고합니다',
        type: 1,
        options: [
            {
                name: '문제',
                description: '어떤 문제가 있나요? (예: 독버섯 게임이 안됨, 끝말잇기가 이상함)',
                type: 3,
                required: true
            }
        ]
    },
    {
        name: '사전강화종료',
        description: '사전강화 이벤트를 종료하고 보상을 지급합니다 (관리자 전용)',
        type: 1
    },
    {
        name: '댕댕봇백업',
        description: '댕댕봇 구출 이벤트 백업 관리 (관리자 전용)',
        type: 1,
        options: [
            {
                name: '생성',
                description: '현재 상태를 백업합니다',
                type: 1
            },
            {
                name: '복원',
                description: '최신 백업을 복원합니다',
                type: 1
            },
            {
                name: '목록',
                description: '백업 목록을 확인합니다',
                type: 1
            }
        ]
    }
];

module.exports = { productionCommands };