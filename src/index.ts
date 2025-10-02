import { Client, GatewayIntentBits, Collection, REST, Routes, Events, ActivityType, AutocompleteInteraction, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, GuildMember, PermissionFlagsBits } from 'discord.js';
import { config } from 'dotenv';
import { DatabaseManager } from './database';
import { processBossKill } from './commands/boss';
import { BOSSES, searchBosses } from './bosses';
import * as cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to get current time in GMT+8 (Philippines timezone)
function getCurrentGMT8Time(): Date {
  const now = new Date();
  const gmt8Offset = 8 * 60; // GMT+8 in minutes
  const localOffset = now.getTimezoneOffset(); // Local timezone offset in minutes
  return new Date(now.getTime() + (gmt8Offset + localOffset) * 60 * 1000);
}

// Helper function to check if user can use boss tracking buttons
async function canUseBossButtons(member: GuildMember, db: DatabaseManager): Promise<boolean> {
  // Allow server administrators
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  
  // Check for custom boss tracker role
  const settings = await db.getGuildSettings(member.guild.id);
  if (settings.bossTrackerRole) {
    return member.roles.cache.has(settings.bossTrackerRole);
  }
  
  // Default: only admins can use buttons
  return false;
}

// Helper function to create permission error embed
function createPermissionErrorEmbed(requiredRole?: string | null) {
  const description = requiredRole 
    ? `❌ You need the <@&${requiredRole}> role or Administrator permission to use boss tracking buttons.`
    : '❌ You need Administrator permission to use boss tracking buttons.';
    
  return {
    color: 0xff0000,
    title: '🚫 Insufficient Permissions',
    description,
    timestamp: new Date().toISOString()
  };
}

config();

interface BotClient extends Client {
  commands: Collection<string, any>;
  db: DatabaseManager;
}

class LordNineBossBot {
  private client: BotClient;
  private db: DatabaseManager;
  private setupSessions: Map<string, any> = new Map();

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
        
        // Only reply if we haven't already replied
        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
          } catch (replyError) {
            console.error('Error sending error reply:', replyError);
          }
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
    // Update dynamic timers every 15 minutes to keep costs low
    cron.schedule('*/15 * * * *', async () => {
      try {
        await this.updateAllDynamicTimers();
      } catch (error) {
        console.error('Error updating dynamic timers:', error);
      }
    });

    // Cleanup old ready bosses every hour (remove timers that have been ready for 12+ hours)
    cron.schedule('0 * * * *', async () => {
      try {
        await this.cleanupOldTimers();
      } catch (error) {
        console.error('Error cleaning up old timers:', error);
      }
    });

    console.log('⏰ Dynamic timer updater started (15-minute intervals)');
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
        const components = this.createTimerComponents(timer);
        
        // Try to attach boss image if it exists
        const imagePath = path.join(__dirname, '..', 'images', `${boss.id}.png`);
        const files = [];
        
        if (fs.existsSync(imagePath)) {
          const attachment = new AttachmentBuilder(imagePath, { name: `${boss.id}.png` });
          files.push(attachment);
        }

        await message.edit({ embeds: [updatedEmbed], files, components });
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

    // Use UNIX timestamp for spawn time display
    let timeDisplay;
    if (isReady) {
      timeDisplay = '**✅ READY TO SPAWN!**';
    } else {
      // Show countdown using Discord's dynamic timestamp
      timeDisplay = `<t:${Math.floor(timer.nextSpawnTime.getTime() / 1000)}:R>`;
    }

    return new EmbedBuilder()
      .setTitle(`${isReady ? '✅' : '⏳'} ${boss.name} Timer`)
      .setDescription(`**${boss.name}** (Lv.${boss.level}) at **${boss.location}**`)
      .addFields(
        { name: '⚔️ Last Kill', value: `<t:${Math.floor(timer.lastKillTime.getTime() / 1000)}:R>`, inline: true },
        { name: isReady ? '✅ Status' : '⏰ Spawns', value: timeDisplay, inline: true },
        { name: '🔄 Cycle', value: `${boss.cycleHours}h`, inline: true }
      )
      .setColor(isReady ? '#27ae60' : '#3498db')
      .setThumbnail(`attachment://${boss.id}.png`)
      .setTimestamp()
      .setFooter({ text: '🔄 Updates every 15 minutes' });
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
      if (interaction.customId.startsWith('boss_killed_')) {
        // Handle "Boss Killed" button click
        if (!interaction.guild || !interaction.member) {
          await interaction.reply({ content: '❌ This command can only be used in a server!', ephemeral: true });
          return;
        }

        const member = interaction.member as GuildMember;
        
        // Check permissions
        const canUse = await canUseBossButtons(member, this.db);
        if (!canUse) {
          const settings = await this.db.getGuildSettings(interaction.guild.id);
          const errorEmbed = createPermissionErrorEmbed(settings.bossTrackerRole);
          
          await interaction.reply({
            embeds: [errorEmbed],
            ephemeral: true
          });
          return;
        }

        const parts = interaction.customId.split('_');
        const bossId = parts[2];
        const guildId = parts[3];
        
        const boss = BOSSES.find(b => b.id === bossId);
        if (!boss) {
          await interaction.reply({ content: '❌ Boss not found!', ephemeral: true });
          return;
        }

        // Get current GMT+8 time for the kill time
        const killTime = getCurrentGMT8Time();
        const timeStr = killTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true,
          timeZone: 'Asia/Manila'
        });
        
        // Process the boss kill using the existing function
        await processBossKill(bossId, timeStr, interaction, this.db);
        return;
      }

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
      } else if (customId.startsWith('boss_killed_')) {
        await this.handleBossKillSelectMenu(interaction);
      }
    } catch (error) {
      console.error('Error handling select menu interaction:', error);
      
      // Only reply if interaction hasn't been acknowledged yet
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ content: 'There was an error processing your selection!', ephemeral: true });
        } catch (replyError) {
          console.error('Error sending error reply:', replyError);
        }
      }
    }
  }

  private async handleBossKillSelectMenu(interaction: any): Promise<void> {
    try {
      const { customId, values } = interaction;
      
      // Parse the custom ID to get the time parameter
      // Format: boss_killed_{category}_{timeStr}
      const parts = customId.split('_');
      const timeStr = parts.slice(3).join('_'); // Rejoin in case time has underscores
      const selectedBossId = values[0];
      
      // Process the boss kill with the selected boss and time
      await processBossKill(selectedBossId, timeStr === 'now' ? null : timeStr, interaction, this.db);
    } catch (error) {
      console.error('Error handling boss kill selection:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ content: '❌ There was an error processing the boss kill!', ephemeral: true });
        } catch (replyError) {
          console.error('Error sending error reply:', replyError);
        }
      }
    }
  }

  private async handleSetupSelectMenu(interaction: any): Promise<void> {
    // Check if interaction is still valid
    if (!interaction.guild || !interaction.user) {
      console.log('Invalid interaction - missing guild or user');
      return;
    }

    const { customId } = interaction;
    
    // Store the selection temporarily (we'll use a simple map for this demo)
    if (!this.setupSessions) {
      this.setupSessions = new Map();
    }
    
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const sessionKey = `${guildId}_${userId}`;
    
    let session = this.setupSessions.get(sessionKey) || {};
    
    try {
      switch (customId) {
        case 'setup_channel_select':
          session.channelId = interaction.values[0];
          await interaction.deferUpdate();
          break;
          
        case 'setup_role_select':
          session.roleId = interaction.values[0] || null;
          await interaction.deferUpdate();
          break;
          
        case 'setup_warning_select':
          session.warningMinutes = parseInt(interaction.values[0]);
          await interaction.deferUpdate();
          break;
      }
      
      this.setupSessions.set(sessionKey, session);
      
      // Update the original message to enable/disable the finish button
      await this.updateSetupMessage(interaction, session);
      
    } catch (error) {
      console.error('Error in handleSetupSelectMenu:', error);
      
      // Only reply if we haven't already
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ content: '❌ Error processing selection', ephemeral: true });
        } catch (replyError) {
          console.error('Error sending error reply:', replyError);
        }
      }
    }
  }

  private async updateSetupMessage(interaction: any, session: any): Promise<void> {
    try {
      // Don't update if interaction is too old or invalid
      if (!interaction.message) {
        console.log('No message to update');
        return;
      }

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
      try {
        await interaction.message.edit({
          embeds: [embed],
          components: [row1, row2, row3, row4]
        });
      } catch (editError) {
        console.error('Error editing setup message:', editError);
      }
      
    } catch (error) {
      console.error('Error updating setup message:', error);
    }
  }

  private async handleSetupFinish(interaction: any): Promise<void> {
    if (!interaction.guild) {
      console.log('Setup finish interaction received outside of guild');
      return;
    }

    try {
      // Acknowledge the interaction immediately
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferUpdate();
      }

      const userId = interaction.user.id;
      const guildId = interaction.guild.id;
      const sessionKey = `${guildId}_${userId}`;
      
      const session = this.setupSessions.get(sessionKey);
      
      if (!session) {
        console.log('No setup session found for key:', sessionKey);
        
        const { EmbedBuilder } = await import('discord.js');
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Setup Session Expired')
          .setDescription('The setup session has expired. Please run `/boss setup` again.')
          .setColor('#e74c3c');

        try {
          if (interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
          } else if (!interaction.replied) {
            await interaction.reply({ embeds: [errorEmbed], components: [], ephemeral: true });
          }
        } catch (replyError) {
          console.error('Error sending session expired message:', replyError);
        }
        return;
      }

      if (!session.channelId) {
        console.log('Setup incomplete - no channel selected for session:', sessionKey);
        
        const { EmbedBuilder } = await import('discord.js');
        const incompleteEmbed = new EmbedBuilder()
          .setTitle('⚠️ Setup Incomplete')
          .setDescription('Please select a notification channel before completing setup.')
          .setColor('#f39c12');

        try {
          if (interaction.deferred) {
            await interaction.editReply({ embeds: [incompleteEmbed] });
          } else if (!interaction.replied) {
            await interaction.reply({ embeds: [incompleteEmbed], ephemeral: true });
          }
        } catch (replyError) {
          console.error('Error sending incomplete setup message:', replyError);
        }
        return;
      }

      // Save settings to database
      try {
        await this.db.setGuildSettings(guildId, {
          notificationChannel: session.channelId,
          mentionRole: session.roleId || null,
          warningMinutes: session.warningMinutes || 5
        });

        console.log('Guild settings saved successfully for guild:', guildId);

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
          .setTimestamp()
          .setFooter({ text: 'You can now use /boss killed to track boss spawns!' });

        // Update the original message
        try {
          if (interaction.deferred) {
            await interaction.editReply({ embeds: [embed], components: [] });
          } else if (!interaction.replied) {
            await interaction.reply({ embeds: [embed], components: [] });
          }
        } catch (replyError) {
          console.error('Error sending success message:', replyError);
        }

        // Clean up session
        this.setupSessions.delete(sessionKey);
        console.log('Setup session cleaned up for key:', sessionKey);

      } catch (dbError) {
        console.error('Database error during setup completion:', dbError);
        
        const { EmbedBuilder } = await import('discord.js');
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Setup Failed')
          .setDescription('An error occurred while saving your settings. Please try again.')
          .setColor('#e74c3c');

        try {
          if (interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
          } else if (!interaction.replied) {
            await interaction.reply({ embeds: [errorEmbed], components: [], ephemeral: true });
          }
        } catch (replyError) {
          console.error('Error sending database error message:', replyError);
        }
      }
    } catch (error) {
      console.error('Error handling setup finish:', error);
      
      // Try to send an error response if we haven't already
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ 
            content: '❌ An error occurred while processing your request. Please try again.', 
            ephemeral: true 
          });
        } catch (replyError) {
          console.error('Error sending error reply:', replyError);
        }
      }
    }
  }

  private async cleanupOldTimers(): Promise<void> {
    try {
      const timers = await this.db.getActiveTimers();
      const now = new Date();
      const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

      for (const timer of timers) {
        // If boss spawn time was more than 1 hour ago and it's marked as ready
        if (timer.ready_sent && (now.getTime() - timer.nextSpawnTime.getTime()) > oneHour) {
          await this.db.deleteBossTimer(timer.bossId, timer.guildId);
          console.log(`🧹 Cleaned up old timer for ${timer.bossId} in guild ${timer.guildId}`);
        }
      }
    } catch (error) {
      console.error('Error in cleanup old timers:', error);
    }
  }

  private createTimerComponents(timer: any): ActionRowBuilder<ButtonBuilder>[] {
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`boss_killed_${timer.bossId}_${timer.guildId}`)
          .setLabel('Boss Killed')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚔️')
      );

    return [row];
  }
}

// Create and start the bot
const bot = new LordNineBossBot();
bot.start();
