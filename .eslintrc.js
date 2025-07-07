module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true
    },
    extends: [
        'eslint:recommended',
        'plugin:jest/recommended',
        'prettier'
    ],
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module'
    },
    plugins: ['jest'],
    rules: {
        // 에러 방지
        'no-console': 'off', // 콘솔 사용 허용
        'no-unused-vars': ['warn', { 
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_'
        }],
        'no-empty': ['error', { allowEmptyCatch: true }],
        
        // 코드 품질
        'prefer-const': 'error',
        'no-var': 'error',
        'eqeqeq': ['error', 'always', { null: 'ignore' }],
        'curly': ['error', 'multi-line'],
        'no-throw-literal': 'error',
        
        // 비동기 코드
        'require-await': 'warn',
        'no-return-await': 'error',
        'prefer-promise-reject-errors': 'error',
        
        // 스타일
        'quotes': ['error', 'single', { avoidEscape: true }],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        'object-curly-spacing': ['error', 'always'],
        'array-bracket-spacing': ['error', 'never'],
        
        // Jest 관련
        'jest/no-disabled-tests': 'warn',
        'jest/no-focused-tests': 'error',
        'jest/no-identical-title': 'error',
        'jest/prefer-to-have-length': 'warn',
        'jest/valid-expect': 'error'
    },
    overrides: [
        {
            files: ['**/*.test.js', '**/__tests__/**/*.js'],
            env: {
                jest: true
            }
        }
    ],
    ignorePatterns: [
        'node_modules/',
        'coverage/',
        'dist/',
        '.jest-cache/',
        'backups/',
        '*.min.js'
    ]
};