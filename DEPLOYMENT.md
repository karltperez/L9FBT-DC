# Deployment Guide

This guide covers different ways to deploy the Lord Nine Field Boss Timer Discord Bot.

## 🖥️ Self-Hosting (Recommended for Development)

### Prerequisites
- VPS or dedicated server
- Node.js 16.0.0 or higher
- Git
- Process manager (PM2 recommended)

### Step-by-Step Deployment

1. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2 globally
   npm install -g pm2
   ```

2. **Clone Repository**
   ```bash
   cd /opt
   sudo git clone https://github.com/karltperez/L9FBT-DC.git
   cd L9FBT-DC
   sudo chown -R $USER:$USER .
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env
   ```
   
   Add your Discord bot credentials:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here  # Optional for development
   ```

5. **Build Project**
   ```bash
   npm run build
   ```

6. **Start with PM2**
   ```bash
   pm2 start dist/index.js --name "l9-boss-timer"
   pm2 save
   pm2 startup
   ```

7. **Monitor**
   ```bash
   pm2 status
   pm2 logs l9-boss-timer
   ```

## ☁️ Cloud Deployment

### Heroku Deployment

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Login and Create App**
   ```bash
   heroku login
   heroku create your-bot-name
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set DISCORD_TOKEN=your_token_here
   heroku config:set CLIENT_ID=your_client_id_here
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

5. **Scale Worker**
   ```bash
   heroku ps:scale worker=1
   ```

### Railway Deployment

1. **Connect GitHub Repository**
   - Visit railway.app
   - Connect your GitHub account
   - Select the L9FBT-DC repository

2. **Set Environment Variables**
   - Add DISCORD_TOKEN
   - Add CLIENT_ID
   - Add GUILD_ID (optional)

3. **Deploy automatically via Git**

### DigitalOcean App Platform

1. **Create App**
   - Visit DigitalOcean App Platform
   - Connect GitHub repository
   - Select L9FBT-DC

2. **Configure Build**
   ```yaml
   build_command: npm run build
   run_command: npm start
   ```

3. **Set Environment Variables**
   - DISCORD_TOKEN
   - CLIENT_ID

## 🐳 Docker Deployment

### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  bot:
    build: .
    environment:
      - DISCORD_TOKEN=${DISCORD_TOKEN}
      - CLIENT_ID=${CLIENT_ID}
    volumes:
      - ./database.db:/app/database.db
    restart: unless-stopped
```

### Deploy with Docker
```bash
# Build image
docker build -t l9-boss-timer .

# Run container
docker run -d \
  --name l9-boss-timer \
  -e DISCORD_TOKEN=your_token \
  -e CLIENT_ID=your_client_id \
  -v $(pwd)/database.db:/app/database.db \
  l9-boss-timer
```

## 📊 Monitoring and Maintenance

### Health Checks
```bash
# Check bot status
pm2 status

# View logs
pm2 logs l9-boss-timer --lines 100

# Restart if needed
pm2 restart l9-boss-timer
```

### Database Backup
```bash
# Create backup
cp database.db database.backup.$(date +%Y%m%d_%H%M%S).db

# Automated backup script
#!/bin/bash
BACKUP_DIR="/opt/backups"
DB_FILE="/opt/L9FBT-DC/database.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $DB_FILE $BACKUP_DIR/database_$DATE.db

# Keep only last 7 days
find $BACKUP_DIR -name "database_*.db" -mtime +7 -delete
```

### Updates
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Rebuild
npm run build

# Restart
pm2 restart l9-boss-timer
```

## 🔒 Security Best Practices

### Server Security
- Keep OS and packages updated
- Use firewall (ufw/iptables)
- Disable root login
- Use SSH keys instead of passwords
- Regular security audits

### Application Security
- Never expose .env files
- Use environment variables for secrets
- Regular dependency updates
- Monitor for security vulnerabilities

### Discord Security
- Use minimal required permissions
- Regenerate tokens if compromised
- Monitor bot usage patterns
- Follow Discord's security guidelines

## 🚨 Troubleshooting

### Common Issues

**Bot not responding:**
```bash
# Check if process is running
pm2 status

# Check logs for errors
pm2 logs l9-boss-timer

# Restart bot
pm2 restart l9-boss-timer
```

**Database errors:**
```bash
# Check file permissions
ls -la database.db

# Ensure write permissions
chmod 664 database.db
```

**Memory issues:**
```bash
# Monitor memory usage
pm2 monit

# Increase memory limit if needed
pm2 delete l9-boss-timer
pm2 start dist/index.js --name "l9-boss-timer" --max-memory-restart 500M
```

## 📈 Performance Optimization

### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'l9-boss-timer',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

### Database Optimization
- Regular VACUUM operations
- Index optimization
- Connection pooling if needed

## 📞 Support

For deployment issues:
- Check GitHub Issues
- Review logs carefully
- Provide environment details
- Include error messages

---

**Happy Deploying!** 🚀
