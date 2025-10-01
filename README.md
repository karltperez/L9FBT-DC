# Lord Nine Field Boss Timer Discord Bot

A comprehensive Discord bot for tracking field boss spawn timers in the Lord Nine MMORPG. Never miss a boss spawn again with automated notifications and easy-to-use slash commands!

## 🎯 Features

### 📋 Boss Management
- **30+ Field Bosses** tracked across all categories
- **Smart Categories**: Short Cycle (10-21h), Long Cycle (24-48h), and Scheduled Bosses
- **Boss Search**: Autocomplete boss names and locations
- **Detailed Information**: Boss levels, locations, and spawn cycles

### ⚡ Slash Commands
- `/boss setup <channel> [role] [warning]` - Configure notifications (Admin only)
- `/boss killed <name> [time]` - Report a boss kill and start timer
- `/boss status [name]` - Check timer status for specific boss or all bosses  
- `/boss list [category]` - List all available bosses by category
- `/boss remove <name>` - Remove a boss timer
- `/boss settings` - View current guild configuration

### 🔔 Smart Notifications
- **Configurable warnings** before boss spawns (default: 5 minutes)
- **Spawn alerts** when bosses are ready
- **Role mentions** for important notifications
- **Dedicated notification channels** per server
- **Automatic scheduling** using cron jobs
- **Rich embeds** with boss details and timestamps

### 📊 Dynamic Live Timers (NEW!)
- **Real-time Updates**: Timer messages update every 30 seconds automatically
- **Precise Countdown**: Shows exact time remaining (hours, minutes, seconds)
- **Interactive Creation**: Click buttons to generate live timers after boss kills
- **Group Overview**: Live updating status for all active boss timers
- **Visual Enhancement**: Boss images attached to timer embeds
- **Smart Display**: Automatically switches from countdown to "READY TO SPAWN!" status

### 💾 Persistent Storage
- **SQLite database** for reliable data storage
- **Per-server timers** - each Discord server has independent timers
- **Guild settings** for customization options

## 🚀 Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- A Discord Application with bot token
- TypeScript knowledge (optional for usage)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository>
   cd L9-FBT-Discord-App
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your bot details:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here  # Optional for development
   ```

3. **Build and start the bot:**
   ```bash
   npm run build
   npm start
   
   # Or for development with auto-restart:
   npm run dev
   ```

## 🏗️ Development

### Project Structure
```
src/
├── index.ts           # Main bot entry point
├── database.ts        # Database manager and schema
├── bosses.ts          # Boss data and utility functions
├── types.ts           # TypeScript type definitions
└── commands/
    └── boss.ts        # Boss command implementation
```

### Available Scripts
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start the production bot
- `npm run dev` - Start development server with ts-node
- `npm run watch` - Watch for changes and recompile

### Adding New Bosses
Add boss data to `src/bosses.ts`:
```typescript
{
  id: 'newboss',
  name: 'New Boss',
  level: 95,
  location: 'Boss Location',
  cycleHours: 24,
  category: 'long'
}
```

## 🎮 Boss Categories

### 🔵 Short Cycle Bosses (10-21h)
- **Venatus** (Lv.60) - 10h cycle
- **Viorent** (Lv.65) - 10h cycle
- **Ego** (Lv.70) - 21h cycle
- **Araneo** (Lv.83) - 12h cycle
- **Undomiel** (Lv.85) - 18h cycle
- **Livera** (Lv.90) - 20h cycle

### 🟣 Long Cycle Bosses (24-48h)
- **Lady Dalia** (Lv.83) - 24h cycle
- **General Aquleus** (Lv.85) - 29h cycle
- **Amentis** (Lv.88) - 29h cycle
- **Gareth** (Lv.98) - 32h cycle
- **Titore** (Lv.98) - 37h cycle
- **Catena** (Lv.100) - 35h cycle
- **Metus** (Lv.93) - 48h cycle
- *...and many more!*

### 🟡 Scheduled Bosses
- **Auraq** (Lv.100) - 12:00, 20:00 daily
- **Rohtahzek** (Lv.95) - 14:00, 22:00 daily
- **Mutanus** (Lv.90) - 06:00, 12:00, 18:00 daily
- *...and more scheduled bosses!*

## 🔧 Configuration

### Bot Permissions Required
- **Send Messages** - For timer notifications
- **Use Slash Commands** - For command functionality
- **Embed Links** - For rich embed responses
- **Read Message History** - For context awareness

### Database Schema
The bot automatically creates these tables:
- `boss_timers` - Stores active timers per guild
- `guild_settings` - Stores server-specific configuration

## 📚 Usage Examples

### Initial Setup (Admin Only)
```
/boss setup channel:#boss-alerts role:@Raiders warning:10
/boss settings  # View current configuration
```

### Basic Usage
```
/boss killed gareth
/boss status gareth
/boss list category:Long Cycle (24-48h)
/boss remove gareth
```

### Advanced Features
- **Time Override**: `/boss killed gareth time:2024-01-15 14:30`
- **View All Timers**: `/boss status` (without boss name)
- **Search Bosses**: Start typing any boss name for autocomplete suggestions
- **Custom Notifications**: Set warning time from 1-60 minutes
- **Role Mentions**: Ping specific roles for boss alerts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with descriptive messages
5. Push and create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Common Issues
- **Bot not responding**: Check bot permissions and token
- **Commands not appearing**: Ensure CLIENT_ID is correct and bot is invited with application.commands scope
- **Database errors**: Check file permissions and disk space

### Getting Help
- Create an issue on GitHub
- Check the Discord.js documentation
- Verify your environment variables are correctly set

---

**Happy Boss Hunting in Lord Nine!** 🏹⚔️

## 📋 **Legal & Privacy**

- **[Terms of Service](./TERMS_OF_SERVICE.md)** - Usage terms and conditions
- **[Privacy Policy](./PRIVACY_POLICY.md)** - Data collection and privacy practices

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with descriptive messages
5. Push and create a Pull Request

## 📞 **Support & Contact**

- **GitHub Issues**: [Report bugs or request features](https://github.com/karltperez/L9FBT-DC/issues)
- **Repository**: https://github.com/karltperez/L9FBT-DC

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
