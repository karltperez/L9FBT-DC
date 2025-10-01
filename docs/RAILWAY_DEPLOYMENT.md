# Railway Deployment

This project is configured for easy deployment on Railway.

## Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

## Manual Deployment

1. **Connect to Railway**
   - Visit [railway.app](https://railway.app)
   - Sign up with GitHub
   - Click "Deploy from GitHub repo"

2. **Select Repository**
   - Choose `karltperez/L9FBT-DC`
   - Railway will automatically detect the Node.js project

3. **Configure Environment Variables**
   Add these required variables in Railway dashboard:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_application_id
   GUILD_ID=your_test_server_id (optional)
   ```

4. **Deploy**
   - Railway will automatically build and deploy
   - Monitor logs in the Railway dashboard

## Environment Variables Setup

### Required Variables
- `DISCORD_TOKEN`: Your Discord bot token from Discord Developer Portal
- `CLIENT_ID`: Your Discord application ID

### Optional Variables  
- `GUILD_ID`: For development/testing in specific server
- `NODE_ENV`: Set to `production` for production deployment

## Railway Configuration

The project includes `railway.json` for optimal Railway deployment:
- Automatic restart on failure
- Proper build and start commands
- Nixpacks builder for Node.js optimization

## Database Persistence

Railway provides persistent storage for the SQLite database file (`database.db`). Your boss timers and settings will persist across deployments.

## Monitoring

Monitor your bot through:
- Railway dashboard logs
- Railway metrics
- Discord bot status

## Troubleshooting

Common issues and solutions:

**Bot not starting:**
- Check environment variables are set correctly
- Verify Discord token is valid
- Review Railway deployment logs

**Database errors:**
- Ensure write permissions for database file
- Check Railway storage limits

**Commands not appearing:**
- Verify CLIENT_ID is correct
- Check bot permissions in Discord server
- Wait a few minutes for slash commands to sync

## Support

For Railway-specific issues:
- Check Railway documentation
- Review deployment logs
- Contact Railway support if needed

For bot issues:
- Create GitHub issue
- Check bot logs
- Verify Discord configuration
