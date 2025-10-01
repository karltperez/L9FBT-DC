// Test the new 12-hour time parsing functionality
const { parseTimeInput } = require('./dist/commands/boss.js');

console.log('Testing 12-hour time format parsing:\n');

const testCases = [
  '2:30 PM',
  '10:15 AM', 
  '6:00 PM',
  '12:00 AM',
  '12:00 PM',
  '2:30',
  '10:15',
  '6:00'
];

testCases.forEach(timeStr => {
  try {
    const parsed = parseTimeInput(timeStr);
    console.log(`Input: "${timeStr}" -> ${parsed.toLocaleString()}`);
  } catch (error) {
    console.log(`Input: "${timeStr}" -> ERROR: ${error.message}`);
  }
});
