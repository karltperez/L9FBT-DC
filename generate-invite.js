/**
 * Discord Bot Invite URL Generator
 * Run this script to generate a proper invite URL for your bot
 */

const CLIENT_ID = "1421810657317359648"; // Your bot's Client ID

// Required permissions for Lord Nine Boss Timer bot
const permissions = [
  "2048",    // Use Slash Commands
  "2048",    // Send Messages  
  "16384",   // Embed Links
  "65536",   // Read Message History
  "17179869184", // Mention Everyone (for role mentions)
  "262144",  // Use External Emojis
  "64",      // Add Reactions
].join("");

// Calculate permission integer
const permissionValue = 
  2048 +      // Send Messages
  2048 +      // Use Slash Commands (applications.commands scope handles this)
  16384 +     // Embed Links
  65536 +     // Read Message History
  17179869184 + // Mention Everyone
  262144 +    // Use External Emojis
  64;         // Add Reactions

console.log("🤖 Lord Nine Boss Timer Bot Invite URL Generator\n");

console.log("📋 Required Scopes:");
console.log("- bot");
console.log("- applications.commands");

console.log("\n🔑 Required Permissions:");
console.log("- Send Messages");
console.log("- Use Slash Commands");
console.log("- Embed Links");
console.log("- Read Message History");
console.log("- Mention Everyone");
console.log("- Use External Emojis");
console.log("- Add Reactions");

console.log(`\n🔗 Invite URL:`);
console.log(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=17179936000&scope=bot%20applications.commands`);

console.log("\n📝 Instructions:");
console.log("1. Copy the URL above");
console.log("2. Paste in browser");
console.log("3. Select your server");
console.log("4. Authorize the bot");
console.log("5. The bot will have proper permissions!");
