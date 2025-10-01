// Test GMT+8 timezone handling
console.log('Testing GMT+8 timezone implementation:\n');

// Simulate the timezone functions
function getCurrentGMT8Time() {
  const now = new Date();
  const gmt8Offset = 8 * 60; // GMT+8 in minutes
  const localOffset = now.getTimezoneOffset(); // Local timezone offset in minutes
  return new Date(now.getTime() + (gmt8Offset + localOffset) * 60 * 1000);
}

function convertGMT8ToUTC(gmt8Date) {
  const gmt8Offset = 8 * 60; // GMT+8 in minutes
  return new Date(gmt8Date.getTime() - (gmt8Offset * 60 * 1000));
}

// Test current times
const currentLocal = new Date();
const currentGMT8 = getCurrentGMT8Time();
const convertedUTC = convertGMT8ToUTC(currentGMT8);

console.log('Current Local Time:', currentLocal.toLocaleString());
console.log('Current GMT+8 Time:', currentGMT8.toLocaleString());
console.log('GMT+8 -> UTC:', convertedUTC.toLocaleString());
console.log('UTC -> GMT+8 verification:', new Date(convertedUTC.getTime() + (8 * 60 * 60 * 1000)).toLocaleString());

// Test boss timer calculation
const killTime = convertGMT8ToUTC(currentGMT8); // Kill time in UTC
const cycleHours = 10; // Venatus cycle
const nextSpawnTime = new Date(killTime.getTime() + (cycleHours * 60 * 60 * 1000));

console.log('\nBoss Timer Test (Venatus 10h cycle):');
console.log('Kill Time (UTC):', killTime.toLocaleString());
console.log('Next Spawn (UTC):', nextSpawnTime.toLocaleString());
console.log('Next Spawn (GMT+8):', new Date(nextSpawnTime.getTime() + (8 * 60 * 60 * 1000)).toLocaleString());

// Test Discord timestamp
console.log('\nDiscord Timestamps:');
console.log('Kill Time:', `<t:${Math.floor(killTime.getTime() / 1000)}:F>`);
console.log('Next Spawn:', `<t:${Math.floor(nextSpawnTime.getTime() / 1000)}:R>`);
