import { Client, GatewayIntentBits, Collection, REST, Routes, Events, ActivityType, AutocompleteInteraction, AttachmentBuilder } from 'discord.js';
import { config } from 'dotenv';
import { DatabaseManager } from './database';
import { BOSSES, searchBosses } from './bosses';
import * as cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';

config();

interface BotClient extends Client {
  commands: Collection<string, any>;
  db: DatabaseManager;
}

class LordNineBossBot {
  private client: BotClient;
  private db: DatabaseManager;
  private setupSessions: Map<string, any>;

  constructor() {
    this.setupSessions = new Map();
    this.client = new Client({ 
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
      ] 
    }) as BotClient;
    
    this.db = new DatabaseManager();
    this.client.db = this.db;
    this.client.commands = new Collection();

    this.setupEventHandlers();
    this.loadCommands();
  }

  private setupEventHandlers(): void {
    this.client.once(Events.ClientReady, async (client) => {
      console.log(`✅ Bot is ready! Logged in as ${client.user?.tag}`);
      
      // Initialize database
      await this.db.initialize();
      console.log('📊 Database initialized');

      // Set bot status
      client.user?.setActivity('Field Bosses in Lord Nine', { type: ActivityType.Watching });

      // Start notification scheduler
      this.startNotificationScheduler();
      
      // Deploy slash commands
      await this.deployCommands();
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isAutocomplete()) {
        await this.handleAutocomplete(interaction);
        return;
      }

      if (interaction.isButton()) {
        await this.handleButtonInteraction(interaction);
        return;
      }

      if (interaction.isAnySelectMenu()) {
        await this.handleSelectMenuInteraction(interaction);
        return;
      }

      if (!interaction.isChatInputCommand()) return;

      const command = this.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, this.db);
      } catch (error) {
        console.error('Error executing command:', error);
        const reply = { content: 'There was an error while executing this command!', ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    });

    this.client.on(Events.Error, (error) => {
      console.error('Discord client error:', error);
    });
  }

  private async loadCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) {
      console.log('⚠️ Commands directory not found');
      return;
    }

    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

    for (const file of commandFiles) {
      const command = await import(path.join(commandsPath, file));
      if ('data' in command && 'execute' in command) {
        this.client.commands.set(command.data.name, command);
        console.log(`✅ Loaded command: ${command.data.name}`);
      } else {
        console.log(`⚠️ Command ${file} is missing required "data" or "execute" property.`);
      }
    }
  }

  private async deployCommands(): Promise<void> {
    const commands = [];
    
    for (const [, command] of this.client.commands) {
      commands.push(command.data.toJSON());
    }

    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

    try {
      console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID!),
        { body: commands }
      );

      console.log(`✅ Successfully reloaded ${(data as any[]).length} application (/) commands.`);
    } catch (error) {
      console.error('❌ Error deploying commands:', error);
    }
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const { commandName, options } = interaction;

    if (commandName === 'boss') {
      const focusedOption = options.getFocused(true);
      
      if (focusedOption.name === 'name') {
        const query = focusedOption.value.toString().toLowerCase();
        
        let filteredBosses = BOSSES;
        if (query) {
          filteredBosses = searchBosses(query);
        }

        // Limit to 25 choices (Discord's limit)
        const choices = filteredBosses.slice(0, 25).map(boss => ({
          name: `${boss.name} (Lv.${boss.level}) - ${boss.location}`,
          value: boss.id
        }));

        await interaction.respond(choices);
      }
    }
  }

  private startNotificationScheduler(): void {
    // Check for boss spawns and update timers every minute
    cron.schedule('* * * * *', async () => {
      try {
        const timers = await this.db.getActiveTimers();
        const now = new Date();

        for (const timer of timers) {
          const timeUntilSpawn = timer.nextSpawnTime.getTime() - now.getTime();
          const minutesUntilSpawn = Math.floor(timeUntilSpawn / (1000 * 60));

          // Get guild settings for warning time
          const settings = await this.db.getGuildSettings(timer.guildId);

          // Check if boss is ready to spawn or within warning time
          if (timeUntilSpawn <= 0 || minutesUntilSpawn === settings.warningMinutes) {
            await this.sendBossNotification(timer, minutesUntilSpawn <= 0);
          }

          // Update dynamic timer messages (if any exist)
          await this.updateDynamicTimerMessages(timer);
        }
      } catch (error) {
        console.error('Error in notification scheduler:', error);
      }
    });

    // Update dynamic timers more frequently (every 30 seconds) for smoother updates
    cron.schedule('*/30 * * * * *', async () => {
      try {
        await this.updateAllDynamicTimers();
      } catch (error) {
        console.error('Error updating dynamic timers:', error);
      }
    });

    console.log('⏰ Notification scheduler started');
  }

  private async sendBossNotification(timer: any, isReady: boolean): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(timer.guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(timer.channelId);
      if (!channel || !channel.isTextBased()) return;

      const boss = BOSSES.find(b => b.id === timer.bossId);
      if (!boss) return;

      // Get guild settings for mention role
      const settings = await this.db.getGuildSettings(timer.guildId);
      const mentionText = settings.mentionRole ? `<@&${settings.mentionRole}> ` : '';

      const embed = {
        title: isReady ? '🚨 Boss Ready!' : '⚠️ Boss Warning!',
        description: isReady 
          ? `**${boss.name}** (Lv.${boss.level}) is ready to spawn at **${boss.location}**!`
          : `**${boss.name}** (Lv.${boss.level}) will spawn in **${settings.warningMinutes} minutes** at **${boss.location}**!`,
        color: isReady ? 0x27ae60 : 0xf39c12,
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: '📍 Location',
            value: boss.location,
            inline: true
          },
          {
            name: '🔄 Cycle',
            value: `${boss.cycleHours}h`,
            inline: true
          },
          {
            name: '⏰ Spawn Time',
            value: `<t:${Math.floor(timer.nextSpawnTime.getTime() / 1000)}:F>`,
            inline: true
          }
        ]
      };

      await channel.send({ 
        content: mentionText,
        embeds: [embed] 
      });

      // If boss is ready, mark as notified or reset timer
      if (isReady) {
        // Optionally, you could remove the timer or set it to inactive here
        // await this.db.deleteBossTimer(timer.bossId, timer.guildId);
      }
    } catch (error) {
      console.error('Error sending boss notification:', error);
    }
  }

  private async updateDynamicTimerMessages(timer: any): Promise<void> {
    try {
      const dynamicMessages = await this.db.getDynamicTimerMessages(timer.bossId, timer.guildId);
      
      for (const dynamicMessage of dynamicMessages) {
        await this.updateSingleDynamicTimer(dynamicMessage);
      }
    } catch (error) {
      console.error('Error updating dynamic timer messages:', error);
    }
  }

  private async updateAllDynamicTimers(): Promise<void> {
    try {
      const allDynamicMessages = await this.db.getDynamicTimerMessages();
      
      for (const dynamicMessage of allDynamicMessages) {
        await this.updateSingleDynamicTimer(dynamicMessage);
      }
    } catch (error) {
      console.error('Error updating all dynamic timers:', error);
    }
  }

  private async updateSingleDynamicTimer(dynamicMessage: {
    bossId: string;
    guildId: string;
    channelId: string;
    messageId: string;
    timerType: string;
  }): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(dynamicMessage.guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(dynamicMessage.channelId);
      if (!channel || !channel.isTextBased()) return;

      const message = await channel.messages.fetch(dynamicMessage.messageId).catch(() => null);
      if (!message) {
        // Message was deleted, clean up the database
        await this.db.removeDynamicTimerMessage(dynamicMessage.messageId);
        return;
      }

      const timer = await this.db.getBossTimer(dynamicMessage.bossId, dynamicMessage.guildId);
      if (!timer) {
        // Timer no longer exists, clean up
        await this.db.removeDynamicTimerMessage(dynamicMessage.messageId);
        return;
      }

      const boss = BOSSES.find(b => b.id === dynamicMessage.bossId);
      if (!boss) return;

      if (dynamicMessage.timerType === 'group') {
        // Handle group timer updates
        const updatedEmbed = await this.createGroupTimerEmbed(dynamicMessage.guildId);
        await message.edit({ embeds: [updatedEmbed] });
      } else {
        // Handle individual boss timer updates
        const updatedEmbed = await this.createDynamicTimerEmbed(boss, timer);
        
        // Try to attach boss image if it exists
        const imagePath = path.join(__dirname, '..', 'images', `${boss.id}.png`);
        const files = [];
        
        if (fs.existsSync(imagePath)) {
          const attachment = new AttachmentBuilder(imagePath, { name: `${boss.id}.png` });
          files.push(attachment);
        }

        await message.edit({ embeds: [updatedEmbed], files });
      }
    } catch (error) {
      console.error('Error updating single dynamic timer:', error);
      // If message update fails, remove from database
      await this.db.removeDynamicTimerMessage(dynamicMessage.messageId);
    }
  }

  private async createDynamicTimerEmbed(boss: any, timer: any) {
    const { EmbedBuilder } = await import('discord.js');
    
    const now = new Date();
    const timeUntilSpawn = timer.nextSpawnTime.getTime() - now.getTime();
    const isReady = timeUntilSpawn <= 0;

    // Calculate more precise time remaining
    const hours = Math.floor(timeUntilSpawn / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilSpawn % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeUntilSpawn % (1000 * 60)) / 1000);

    let timeDisplay;
    if (isReady) {
      timeDisplay = '**✅ READY TO SPAWN!**';
    } else if (hours > 0) {
      timeDisplay = `**${hours}h ${minutes}m ${seconds}s**`;
    } else if (minutes > 0) {
      timeDisplay = `**${minutes}m ${seconds}s**`;
    } else {
      timeDisplay = `**${Math.max(0, seconds)}s**`;
    }

    return new EmbedBuilder()
      .setTitle(`${isReady ? '✅' : '⏳'} ${boss.name} Timer`)
      .setDescription(`**${boss.name}** (Lv.${boss.level}) at **${boss.location}**`)
      .addFields(
        { name: '⚔️ Last Kill', value: `<t:${Math.floor(timer.lastKillTime.getTime() / 1000)}:R>`, inline: true },
        { name: isReady ? '✅ Status' : '⏰ Time Remaining', value: timeDisplay, inline: true },
        { name: '🔄 Cycle', value: `${boss.cycleHours}h`, inline: true }
      )
      .setColor(isReady ? '#27ae60' : '#3498db')
      .setThumbnail(`attachment://${boss.id}.png`)
      .setTimestamp()
      .setFooter({ text: '🔄 Updates every 30 seconds' });
  }

  private async createGroupTimerEmbed(guildId: string) {
    const { EmbedBuilder } = await import('discord.js');
    
    const timers = await this.db.getGuildTimers(guildId);
    
    if (timers.length === 0) {
      return new EmbedBuilder()
        .setTitle('🏹 Active Boss Timers')
        .setDescription('❌ No boss timers active. Use `/boss killed <name>` to start tracking bosses.')
        .setColor('#3498db')
        .setTimestamp();
    }

    const embed = new EmbedBuilder()
      .setTitle('🏹 Active Boss Timers')
      .setDescription('Here are all active boss timers for this server:')
      .setColor('#3498db')
      .setTimestamp()
      .setFooter({ text: '🔄 Updates every 30 seconds' });

    const now = new Date();
    
    for (const timer of timers.slice(0, 10)) {
      const boss = BOSSES.find(b => b.id === timer.bossId);
      if (!boss) continue;

      const timeUntilSpawn = timer.nextSpawnTime.getTime() - now.getTime();
      const isReady = timeUntilSpawn <= 0;

      // Calculate more precise time display
      let timeDisplay;
      if (isReady) {
        timeDisplay = '**✅ READY TO SPAWN!**';
      } else {
        const hours = Math.floor(timeUntilSpawn / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilSpawn % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilSpawn % (1000 * 60)) / 1000);
        
        if (hours > 0) {
          timeDisplay = `**${hours}h ${minutes}m ${seconds}s**`;
        } else if (minutes > 0) {
          timeDisplay = `**${minutes}m ${seconds}s**`;
        } else {
          timeDisplay = `**${Math.max(0, seconds)}s**`;
        }
      }

      embed.addFields({
        name: `${isReady ? '✅' : '⏳'} ${boss.name} (Lv.${boss.level})`,
        value: timeDisplay,
        inline: true
      });
    }

    return embed;
  }

  public async start(): Promise<void> {
    if (!process.env.DISCORD_TOKEN) {
      console.error('❌ DISCORD_TOKEN is required in .env file');
      process.exit(1);
    }

    if (!process.env.CLIENT_ID) {
      console.error('❌ CLIENT_ID is required in .env file');
      process.exit(1);
    }

    try {
      await this.client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
      console.error('❌ Failed to login:', error);
      process.exit(1);
    }
  }

  private async handleButtonInteraction(interaction: any): Promise<void> {
    try {
      if (interaction.customId.startsWith('dynamic_timer_')) {
        const bossId = interaction.customId.replace('dynamic_timer_', '');
        const boss = BOSSES.find(b => b.id === bossId);
        
        if (!boss) {
          await interaction.reply({ content: '❌ Boss not found!', ephemeral: true });
          return;
        }

        const timer = await this.db.getBossTimer(bossId, interaction.guild!.id);
        if (!timer) {
          await interaction.reply({ content: '❌ No timer found for this boss!', ephemeral: true });
          return;
        }

        // Create dynamic timer embed
        const embed = await this.createDynamicTimerEmbed(boss, timer);
        
        // Try to attach boss image if it exists
        const imagePath = path.join(__dirname, '..', 'images', `${boss.id}.png`);
        const files = [];
        
        if (fs.existsSync(imagePath)) {
          const { AttachmentBuilder } = await import('discord.js');
          const attachment = new AttachmentBuilder(imagePath, { name: `${boss.id}.png` });
          files.push(attachment);
        }

        const reply = await interaction.reply({ embeds: [embed], files });
        const message = await reply.fetch();
        
        // Store this message for dynamic updates
        await this.db.addDynamicTimerMessage(bossId, interaction.guild!.id, interaction.channel!.id, message.id, 'status');
      } else if (interaction.customId === 'setup_finish') {
        await this.handleSetupFinish(interaction);
      }
    } catch (error) {
      console.error('Error handling button interaction:', error);
      const reply = { content: 'There was an error processing your request!', ephemeral: true };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }

  private async handleSelectMenuInteraction(interaction: any): Promise<void> {
    try {
      const { customId } = interaction;
      
      if (customId.startsWith('setup_')) {
        await this.handleSetupSelectMenu(interaction);
      }
    } catch (error) {
      console.error('Error handling select menu interaction:', error);
      const reply = { content: 'There was an error processing your selection!', ephemeral: true };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }

  private async handleSetupSelectMenu(interaction: any): Promise<void> {
    const { customId } = interaction;
    
    // Store the selection temporarily (we'll use a simple map for this demo)
    if (!this.setupSessions) {
      this.setupSessions = new Map();
    }
    
    const userId = interaction.user.id;
    const guildId = interaction.guild!.id;
    const sessionKey = `${guildId}_${userId}`;
    
    let session = this.setupSessions.get(sessionKey) || {};
    
    switch (customId) {
      case 'setup_channel_select':
        session.channelId = interaction.values[0];
        await interaction.reply({ content: '✅ Channel selected!', ephemeral: true });
        break;
        
      case 'setup_role_select':
        session.roleId = interaction.values[0] || null;
        await interaction.reply({ content: '✅ Role selected!', ephemeral: true });
        break;
        
      case 'setup_warning_select':
        session.warningMinutes = parseInt(interaction.values[0]);
        await interaction.reply({ content: '✅ Warning time selected!', ephemeral: true });
        break;
    }
    
    this.setupSessions.set(sessionKey, session);
    
    // Update the original message to enable/disable the finish button
    await this.updateSetupMessage(interaction, session);
  }

  private async updateSetupMessage(interaction: any, session: any): Promise<void> {
    try {
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType } = await import('discord.js');
      
      const embed = new EmbedBuilder()
        .setTitle('⚙️ Boss Notification Setup')
        .setDescription('Configure your server\'s boss alert settings:')
        .setColor('#3498db');
      
      // Add current selections to embed
      if (session.channelId) {
        embed.addFields({ name: '📢 Selected Channel', value: `<#${session.channelId}>`, inline: true });
      }
      if (session.roleId) {
        embed.addFields({ name: '👥 Selected Role', value: `<@&${session.roleId}>`, inline: true });
      }
      if (session.warningMinutes) {
        embed.addFields({ name: '⏰ Warning Time', value: `${session.warningMinutes} minutes`, inline: true });
      }
      
      embed.setFooter({ text: session.channelId ? 'Ready to complete setup!' : 'Select the alert channel and role to mention below' });

      // Recreate components (Discord requires this for updates)
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('setup_channel_select')
        .setPlaceholder(session.channelId ? '✅ Channel selected' : 'Select alert channel...')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildNews)
        .setMinValues(1)
        .setMaxValues(1);

      const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('setup_role_select')
        .setPlaceholder(session.roleId ? '✅ Role selected' : 'Select role to mention...')
        .setMinValues(0)
        .setMaxValues(1);

      const warningSelect = new StringSelectMenuBuilder()
        .setCustomId('setup_warning_select')
        .setPlaceholder(session.warningMinutes ? `✅ ${session.warningMinutes} minutes selected` : 'Select warning time...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('1 minute before spawn')
            .setDescription('Get notified 1 minute early')
            .setValue('1')
            .setDefault(session.warningMinutes === 1),
          new StringSelectMenuOptionBuilder()
            .setLabel('5 minutes before spawn')
            .setDescription('Get notified 5 minutes early (default)')
            .setValue('5')
            .setDefault(session.warningMinutes === 5 || !session.warningMinutes),
          new StringSelectMenuOptionBuilder()
            .setLabel('10 minutes before spawn')
            .setDescription('Get notified 10 minutes early')
            .setValue('10')
            .setDefault(session.warningMinutes === 10),
          new StringSelectMenuOptionBuilder()
            .setLabel('15 minutes before spawn')
            .setDescription('Get notified 15 minutes early')
            .setValue('15')
            .setDefault(session.warningMinutes === 15),
          new StringSelectMenuOptionBuilder()
            .setLabel('30 minutes before spawn')
            .setDescription('Get notified 30 minutes early')
            .setValue('30')
            .setDefault(session.warningMinutes === 30),
          new StringSelectMenuOptionBuilder()
            .setLabel('60 minutes before spawn')
            .setDescription('Get notified 1 hour early')
            .setValue('60')
            .setDefault(session.warningMinutes === 60)
        );

      const finishButton = new ButtonBuilder()
        .setCustomId('setup_finish')
        .setLabel('Complete Setup')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
        .setDisabled(!session.channelId); // Enable only when channel is selected

      const row1 = new ActionRowBuilder().addComponents(channelSelect);
      const row2 = new ActionRowBuilder().addComponents(roleSelect);
      const row3 = new ActionRowBuilder().addComponents(warningSelect);
      const row4 = new ActionRowBuilder().addComponents(finishButton);

      // Try to edit the original interaction message
      const originalMessage = await interaction.message;
      if (originalMessage) {
        await originalMessage.edit({
          embeds: [embed],
          components: [row1, row2, row3, row4]
        });
      }
    } catch (error) {
      console.error('Error updating setup message:', error);
    }
  }

  private async handleSetupFinish(interaction: any): Promise<void> {
    const userId = interaction.user.id;
    const guildId = interaction.guild!.id;
    const sessionKey = `${guildId}_${userId}`;
    
    const session = this.setupSessions.get(sessionKey);
    
    if (!session || !session.channelId) {
      await interaction.reply({ content: '❌ Please select a notification channel first!', ephemeral: true });
      return;
    }

    // Save settings to database
    await this.db.setGuildSettings(guildId, {
      notificationChannel: session.channelId,
      mentionRole: session.roleId || null,
      warningMinutes: session.warningMinutes || 5
    });

    // Clean up session
    this.setupSessions.delete(sessionKey);

    // Create success embed
    const { EmbedBuilder } = await import('discord.js');
    const embed = new EmbedBuilder()
      .setTitle('✅ Boss Notification Settings Saved!')
      .setDescription('Your guild settings have been configured successfully!')
      .addFields(
        { name: '📢 Notification Channel', value: `<#${session.channelId}>`, inline: true },
        { name: '👥 Mention Role', value: session.roleId ? `<@&${session.roleId}>` : 'None', inline: true },
        { name: '⏰ Warning Time', value: `${session.warningMinutes || 5} minutes`, inline: true }
      )
      .setColor('#27ae60')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Update the original message to show completion
    try {
      await interaction.message.edit({
        embeds: [embed],
        components: [] // Remove all components
      });
    } catch (error) {
      console.error('Error updating original setup message:', error);
    }
  }
}

// Create and start the bot
const bot = new LordNineBossBot();
bot.start();
