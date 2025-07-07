// require 캐시 정리
console.log('Clearing require cache...');

// Canvas 관련 모듈 캐시 제거
const modulesToClear = [
    '@napi-rs/canvas',
    'canvas',
    './data/ticTacToeGame',
    './handlers/minigame/tictactoe'
];

modulesToClear.forEach(mod => {
    try {
        const resolvedPath = require.resolve(mod);
        delete require.cache[resolvedPath];
        console.log(`Cleared cache for: ${mod}`);
    } catch (e) {
        console.log(`Module not in cache: ${mod}`);
    }
});

console.log('Cache cleared! Please restart the bot.');