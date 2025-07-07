// Script to remove user 1387906374285004983 from the antiMacro whitelist
const antiMacro = require('../systems/antiMacro');

const userId = '1387906374285004983';

// Remove from whitelist
antiMacro.removeFromWhitelist(userId);

// Check if removed
const isStillWhitelisted = antiMacro.isExempted(userId);

console.log(`User ${userId} whitelist removal:`);
console.log(`- Was in whitelist: ${antiMacro.ANTI_MACRO.whitelist.has(userId) ? 'Yes' : 'No'}`);
console.log(`- Is exempted: ${isStillWhitelisted ? 'Yes' : 'No'}`);
console.log(`- Current whitelist size: ${antiMacro.ANTI_MACRO.whitelist.size}`);
console.log(`- Whitelist members:`, Array.from(antiMacro.ANTI_MACRO.whitelist));

console.log('\n✅ User has been removed from the whitelist and can now test the macro detection system.');