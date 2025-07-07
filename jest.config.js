module.exports = {
    // 테스트 환경
    testEnvironment: 'node',
    
    // 테스트 파일 위치
    testMatch: [
        '**/tests/**/*.test.js',
        '**/__tests__/**/*.js'
    ],
    
    // 커버리지 설정
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        'commands/**/*.js',
        'models/**/*.js',
        'services/**/*.js',
        'systems/**/*.js',
        'utils/**/*.js',
        'handlers/**/*.js',
        'database/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/__tests__/**'
    ],
    
    // 커버리지 임계값
    coverageThreshold: {
        global: {
            branches: 60,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    
    // 설정 파일
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    
    // 모듈 경로
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@models/(.*)$': '<rootDir>/models/$1',
        '^@services/(.*)$': '<rootDir>/services/$1',
        '^@utils/(.*)$': '<rootDir>/utils/$1'
    },
    
    // 변환 설정
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    
    // 타임아웃
    testTimeout: 10000,
    
    // 실행 전 초기화
    clearMocks: true,
    restoreMocks: true,
    
    // 상세 로그
    verbose: true,
    
    // 병렬 실행
    maxWorkers: '50%',
    
    // 캐시
    cache: true,
    cacheDirectory: '<rootDir>/.jest-cache',
    
    // 테스트 실행 순서
    testSequencer: '<rootDir>/tests/utils/testSequencer.js',
    
    // 리포터
    reporters: [
        'default',
        [
            'jest-html-reporter',
            {
                pageTitle: 'KimHunter Bot Test Report',
                outputPath: 'test-report.html',
                includeFailureMsg: true,
                includeConsoleLog: true
            }
        ]
    ],
    
    // 테스트 필터링을 위한 태그
    projects: [
        {
            displayName: 'unit',
            testMatch: ['<rootDir>/tests/unit/**/*.test.js']
        },
        {
            displayName: 'integration',
            testMatch: ['<rootDir>/tests/integration/**/*.test.js']
        },
        {
            displayName: 'e2e',
            testMatch: ['<rootDir>/tests/e2e/**/*.test.js']
        }
    ]
};