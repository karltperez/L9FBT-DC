import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } from 'discord.js';
import { getBossById, getBossesByCategory, BOSSES } from '../bosses';
import { DatabaseManager } from '../database';
import { BossTimer } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to get current time in GMT+8 (Philippines timezone)
function getCurrentGMT8Time(): Date {
  const now = new Date();
  const gmt8Offset = 8 * 60; // GMT+8 in minutes
  const localOffset = now.getTimezoneOffset(); // Local timezone offset in minutes
  return new Date(now.getTime() + (gmt8Offset + localOffset) * 60 * 1000);
}

// Helper function to convert GMT+8 time to UTC for storage
function convertGMT8ToUTC(gmt8Date: Date): Date {
  const gmt8Offset = 8 * 60; // GMT+8 in minutes
  return new Date(gmt8Date.getTime() - (gmt8Offset * 60 * 1000));
}

// Helper function to parse 12-hour time format in GMT+8 (Philippines timezone)
function parseTimeInput(timeStr: string): Date {
  // Get current time in GMT+8 (Philippines timezone)
  const now = new Date();
  const gmt8Offset = 8 * 60; // GMT+8 in minutes
  const localOffset = now.getTimezoneOffset(); // Local timezone offset in minutes
  const gmt8Now = new Date(now.getTime() + (gmt8Offset + localOffset) * 60 * 1000);
  
  // Clean up the input
  const cleanTime = timeStr.trim().toUpperCase();
  
  // Regex to match various 12-hour formats
  const timeRegex = /^(\d{1,2}):?(\d{0,2})\s*(AM|PM)?$/i;
  const match = cleanTime.match(timeRegex);
  
  if (!match) {
    throw new Error('Invalid time format');
  }
  
  let hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const ampm = match[3] ? match[3].toUpperCase() : null;
  
  // Validate hours and minutes
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    throw new Error('Invalid time values');
  }
  
  // If no AM/PM specified, try to determine based on context using GMT+8 time
  if (!ampm) {
    const currentHour = gmt8Now.getHours();
    const currentHour12 = currentHour > 12 ? currentHour - 12 : (currentHour === 0 ? 12 : currentHour);
    
    // Simple heuristic: if the time is close to current time, assume same period
    if (Math.abs(hours - currentHour12) <= 2) {
      // Same AM/PM as current time
      if (currentHour >= 12) {
        hours = hours === 12 ? 12 : hours + 12;
      } else {
        hours = hours === 12 ? 0 : hours;
      }
    } else {
      // Assume it was recent (past few hours)
      if (currentHour >= 12) {
        // Currently PM, assume the time was PM if reasonable, otherwise AM
        if (hours >= 6) {
          hours = hours === 12 ? 12 : hours + 12; // PM
        } else {
          hours = hours === 12 ? 0 : hours; // AM
        }
      } else {
        // Currently AM, assume the time was AM if reasonable, otherwise previous day PM
        if (hours <= currentHour12 + 2) {
          hours = hours === 12 ? 0 : hours; // AM
        } else {
          hours = hours === 12 ? 12 : hours + 12; // Previous day PM
        }
      }
    }
  } else {
    // Convert to 24-hour format
    if (ampm === 'PM' && hours !== 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }
  }
  
  // Create the date with GMT+8 timezone
  const result = new Date(gmt8Now.getFullYear(), gmt8Now.getMonth(), gmt8Now.getDate(), hours, minutes, 0, 0);
  
  // Logic for determining if the time was today or yesterday based on GMT+8:
  // - If the parsed time is more than 2 hours in the future, assume it was yesterday
  // - If the parsed time is within 2 hours (past or future), assume it's the correct time
  const timeDifference = result.getTime() - gmt8Now.getTime();
  const twoHours = 2 * 60 * 60 * 1000;
  
  if (timeDifference > twoHours) {
    // Time is too far in the future, assume it was yesterday
    result.setDate(result.getDate() - 1);
  }
  
  // Convert back to UTC for storage
  const utcResult = new Date(result.getTime() - (gmt8Offset * 60 * 1000));
  
  return utcResult;
}

export const data = new SlashCommandBuilder()
  .setName('boss')
  .setDescription('Manage field boss timers')
  .addSubcommand(subcommand =>
    subcommand
      .setName('setup')
      .setDescription('Configure boss notification settings (Admin only)')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('killed')
      .setDescription('Report that a boss was killed')
      .addStringOption(option =>
        option
          .setName('time')
          .setDescription('Kill time in 12-hour format (e.g., 2:30 PM) or leave blank for now')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Check boss timer status')
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Boss name (optional, shows all if empty)')
          .setRequired(false)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all available bosses')
      .addStringOption(option =>
        option
          .setName('category')
          .setDescription('Filter by category')
          .setRequired(false)
          .addChoices(
            { name: 'Short Cycle (10-21h)', value: 'short' },
            { name: 'Long Cycle (24-48h)', value: 'long' },
            { name: 'Scheduled Bosses', value: 'scheduled' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('remove')
      .setDescription('Remove a boss timer')
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('Boss name')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('settings')
      .setDescription('View current guild settings')
  );

export async function execute(interaction: ChatInputCommandInteraction, db: DatabaseManager) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'setup':
      await handleSetupCommand(interaction, db);
      break;
    case 'killed':
      await handleKilledCommand(interaction, db);
      break;
    case 'status':
      await handleStatusCommand(interaction, db);
      break;
    case 'list':
      await handleListCommand(interaction);
      break;
    case 'remove':
      await handleRemoveCommand(interaction, db);
      break;
    case 'settings':
      await handleSettingsCommand(interaction, db);
      break;
    default:
      await interaction.reply('Unknown subcommand.');
  }
}

// Export the processBossKill function for use in interaction handlers
export { processBossKill };

async function handleSetupCommand(interaction: ChatInputCommandInteraction, db: DatabaseManager) {
  // Check if user has administrator permissions
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You need **Administrator** permissions to use this command.',
      ephemeral: true
    });
    return;
  }

  // Create the setup UI with dropdown menus
  const embed = new EmbedBuilder()
    .setTitle('⚙️ Boss Notification Setup')
    .setDescription('Configure your server\'s boss alert settings:')
    .setColor('#3498db')
    .setFooter({ text: 'Select the alert channel and role to mention below' });

  // Channel select menu
  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('setup_channel_select')
    .setPlaceholder('Select alert channel...')
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildNews)
    .setMinValues(1)
    .setMaxValues(1);

  // Role select menu
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId('setup_role_select')
    .setPlaceholder('Select role to mention...')
    .setMinValues(0)
    .setMaxValues(1);

  // Warning time select menu
  const warningSelect = new StringSelectMenuBuilder()
    .setCustomId('setup_warning_select')
    .setPlaceholder('Select warning time...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('1 minute before spawn')
        .setDescription('Get notified 1 minute early')
        .setValue('1'),
      new StringSelectMenuOptionBuilder()
        .setLabel('5 minutes before spawn')
        .setDescription('Get notified 5 minutes early (default)')
        .setValue('5')
        .setDefault(true),
      new StringSelectMenuOptionBuilder()
        .setLabel('10 minutes before spawn')
        .setDescription('Get notified 10 minutes early')
        .setValue('10'),
      new StringSelectMenuOptionBuilder()
        .setLabel('15 minutes before spawn')
        .setDescription('Get notified 15 minutes early')
        .setValue('15'),
      new StringSelectMenuOptionBuilder()
        .setLabel('30 minutes before spawn')
        .setDescription('Get notified 30 minutes early')
        .setValue('30'),
      new StringSelectMenuOptionBuilder()
        .setLabel('60 minutes before spawn')
        .setDescription('Get notified 1 hour early')
        .setValue('60')
    );

  // Finish button
  const finishButton = new ButtonBuilder()
    .setCustomId('setup_finish')
    .setLabel('Complete Setup')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅')
    .setDisabled(true); // Initially disabled until channel is selected

  const row1 = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect);
  const row2 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
  const row3 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(warningSelect);
  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(finishButton);

  await interaction.reply({
    embeds: [embed],
    components: [row1, row2, row3, row4],
    ephemeral: true
  });
}

async function handleKilledCommand(interaction: ChatInputCommandInteraction, db: DatabaseManager) {
  const timeStr = interaction.options.getString('time');

  // Create boss kill UI with integrated time display
  const embed = new EmbedBuilder()
    .setTitle('🗡️ Report Boss Kill')
    .setDescription('Select the boss that was killed:')
    .setColor('#e74c3c');

  // Add time information to the embed
  if (timeStr) {
    embed.addFields({ 
      name: '⏰ Kill Time', 
      value: `**${timeStr}** (GMT+8)\n*Time has been set - now select the boss below*`, 
      inline: false 
    });
  } else {
    embed.addFields({ 
      name: '⏰ Kill Time', 
      value: '**Current time** (GMT+8)\n*Using current time - select the boss below*', 
      inline: false 
    });
  }

  embed.addFields({
    name: '📝 Instructions',
    value: timeStr 
      ? '✅ Time set! Now choose the boss from the categories below:' 
      : '� **Tip:** Use `/boss killed time:2:30 PM` to set a specific kill time',
    inline: false
  });

  const rows = [];

  // Boss category select menus
  const shortCycleBosses = getBossesByCategory('short');
  const longCycleBosses = getBossesByCategory('long');
  const scheduledBosses = getBossesByCategory('scheduled');

  // Short cycle bosses dropdown
  if (shortCycleBosses.length > 0) {
    const shortCycleSelect = new StringSelectMenuBuilder()
      .setCustomId(`boss_killed_short_${timeStr || 'now'}`)
      .setPlaceholder('🔵 Short Cycle Bosses (10-21h)')
      .addOptions(
        shortCycleBosses.map(boss => 
          new StringSelectMenuOptionBuilder()
            .setLabel(`${boss.name} (Lv.${boss.level})`)
            .setDescription(`${boss.location} - ${boss.cycleHours}h cycle`)
            .setValue(boss.id)
            .setEmoji('🔵')
        )
      );
    
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(shortCycleSelect));
  }

  // Long cycle bosses dropdown
  if (longCycleBosses.length > 0) {
    const longCycleSelect = new StringSelectMenuBuilder()
      .setCustomId(`boss_killed_long_${timeStr || 'now'}`)
      .setPlaceholder('🟣 Long Cycle Bosses (24-48h)')
      .addOptions(
        longCycleBosses.slice(0, 25).map(boss => // Discord limit of 25 options
          new StringSelectMenuOptionBuilder()
            .setLabel(`${boss.name} (Lv.${boss.level})`)
            .setDescription(`${boss.location} - ${boss.cycleHours}h cycle`)
            .setValue(boss.id)
            .setEmoji('🟣')
        )
      );
    
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(longCycleSelect));
  }

  // Scheduled bosses dropdown
  if (scheduledBosses.length > 0) {
    const scheduledSelect = new StringSelectMenuBuilder()
      .setCustomId(`boss_killed_scheduled_${timeStr || 'now'}`)
      .setPlaceholder('🟡 Scheduled Bosses')
      .addOptions(
        scheduledBosses.map(boss => 
          new StringSelectMenuOptionBuilder()
            .setLabel(`${boss.name} (Lv.${boss.level})`)
            .setDescription(`${boss.location} - ${boss.scheduledTimes?.join(', ') || 'Scheduled'}`)
            .setValue(boss.id)
            .setEmoji('🟡')
        )
      );
    
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(scheduledSelect));
  }

  await interaction.reply({
    embeds: [embed],
    components: rows,
    ephemeral: true
  });
}

async function handleStatusCommand(interaction: ChatInputCommandInteraction, db: DatabaseManager) {
  const bossName = interaction.options.getString('name');

  if (bossName) {
    const boss = getBossById(bossName.toLowerCase().replace(/\s+/g, ''));
    if (!boss) {
      await interaction.reply(`❌ Boss "${bossName}" not found.`);
      return;
    }

    const timer = await db.getBossTimer(boss.id, interaction.guild!.id);
    if (!timer) {
      await interaction.reply(`❌ No timer set for **${boss.name}**. Use \`/boss killed ${boss.name}\` to start tracking.`);
      return;
    }

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

    const embed = new EmbedBuilder()
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

    // Try to attach boss image if it exists
    const imagePath = path.join(__dirname, '..', '..', 'images', `${boss.id}.png`);
    const files = [];
    
    if (fs.existsSync(imagePath)) {
      const attachment = new AttachmentBuilder(imagePath, { name: `${boss.id}.png` });
      files.push(attachment);
    }

    // Create "Boss Killed" button
    const components = [];
    if (!isReady) { // Only show button if boss is not ready yet
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`boss_killed_${boss.id}_${interaction.guild!.id}`)
            .setLabel('Boss Killed')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚔️')
        );
      components.push(row);
    }

    const reply = await interaction.reply({ embeds: [embed], files, components });
    
    // Store this message for dynamic updates
    const message = await reply.fetch();
    await db.addDynamicTimerMessage(boss.id, interaction.guild!.id, interaction.channel!.id, message.id, 'status');
  } else {
    const timers = await db.getGuildTimers(interaction.guild!.id);
    
    if (timers.length === 0) {
      await interaction.reply('❌ No boss timers active. Use `/boss killed <name>` to start tracking bosses.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🏹 Active Boss Timers')
      .setDescription('Here are all active boss timers for this server:')
      .setColor('#3498db')
      .setTimestamp();

    const now = new Date();
    
    for (const timer of timers.slice(0, 10)) {
      const boss = getBossById(timer.bossId);
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
        
        if (hours > 0) {
          timeDisplay = `**${hours}h ${minutes}m**`;
        } else if (minutes > 0) {
          timeDisplay = `**${minutes}m**`;
        } else {
          const seconds = Math.floor((timeUntilSpawn % (1000 * 60)) / 1000);
          timeDisplay = `**${Math.max(0, seconds)}s**`;
        }
      }

      embed.addFields({
        name: `${isReady ? '✅' : '⏳'} ${boss.name} (Lv.${boss.level})`,
        value: timeDisplay,
        inline: true
      });
    }

    embed.setFooter({ text: '🔄 Use /boss status <name> for live updates' });

    const reply = await interaction.reply({ embeds: [embed] });
    
    // Store this message for dynamic updates (group status)
    const message = await reply.fetch();
    await db.addDynamicTimerMessage('all', interaction.guild!.id, interaction.channel!.id, message.id, 'group');
  }
}

async function handleListCommand(interaction: ChatInputCommandInteraction) {
  const category = interaction.options.getString('category');
  
  const bosses = category ? getBossesByCategory(category as any) : BOSSES;

  const embed = new EmbedBuilder()
    .setTitle('📋 Lord Nine Field Bosses')
    .setColor('#9b59b6')
    .setTimestamp();

  if (category) {
    const categoryNames = {
      short: 'Short Cycle Bosses (10-21h)',
      long: 'Long Cycle Bosses (24-48h)',
      scheduled: 'Scheduled Bosses'
    };
    embed.setDescription(`**${categoryNames[category as keyof typeof categoryNames]}**`);
  } else {
    embed.setDescription('All available field bosses in Lord Nine');
  }

  const shortCycle = bosses.filter(b => b.category === 'short');
  const longCycle = bosses.filter(b => b.category === 'long');
  const scheduled = bosses.filter(b => b.category === 'scheduled');

  if (shortCycle.length > 0) {
    embed.addFields({
      name: '🔵 Short Cycle (10-21h)',
      value: shortCycle.map(b => `• **${b.name}** (Lv.${b.level}) - ${b.cycleHours}h`).join('\n'),
      inline: false
    });
  }

  if (longCycle.length > 0) {
    embed.addFields({
      name: '🟣 Long Cycle (24-48h)',
      value: longCycle.map(b => `• **${b.name}** (Lv.${b.level}) - ${b.cycleHours}h`).join('\n'),
      inline: false
    });
  }

  if (scheduled.length > 0) {
    embed.addFields({
      name: '🟡 Scheduled Bosses',
      value: scheduled.map(b => `• **${b.name}** (Lv.${b.level}) - ${b.scheduledTimes?.join(', ') || 'Check schedule'}`).join('\n'),
      inline: false
    });
  }

  embed.addFields({
    name: 'ℹ️ How to Use',
    value: '• `/boss setup` - Configure notifications (Admin)\n• `/boss killed` - Report boss kill (select from UI)\n• `/boss killed time:2:30 PM` - Report with specific time\n• `/boss status <name>` - Check timer\n• `/boss status` - View all timers\n\n🌏 **All times use Philippines GMT+8 timezone**',
    inline: false
  });

  await interaction.reply({ embeds: [embed] });
}

async function handleRemoveCommand(interaction: ChatInputCommandInteraction, db: DatabaseManager) {
  const bossName = interaction.options.getString('name', true);

  const boss = getBossById(bossName.toLowerCase().replace(/\s+/g, ''));
  if (!boss) {
    await interaction.reply(`❌ Boss "${bossName}" not found.`);
    return;
  }

  const existingTimer = await db.getBossTimer(boss.id, interaction.guild!.id);
  if (!existingTimer) {
    await interaction.reply(`❌ No timer found for **${boss.name}**.`);
    return;
  }

  await db.deleteBossTimer(boss.id, interaction.guild!.id);

  const embed = new EmbedBuilder()
    .setTitle(`🗑️ Timer Removed`)
    .setDescription(`Timer for **${boss.name}** has been removed.`)
    .setColor('#e67e22')
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Function to process boss kill after selection from UI
async function processBossKill(bossId: string, timeStr: string | null, interaction: any, db: DatabaseManager) {
  const boss = getBossById(bossId);
  if (!boss) {
    await interaction.reply({ content: '❌ Boss not found!', ephemeral: true });
    return;
  }

  let killTime: Date;
  
  if (timeStr && timeStr !== 'now') {
    // Parse 12-hour format time in GMT+8 (already returns UTC)
    try {
      killTime = parseTimeInput(timeStr);
    } catch (error) {
      await interaction.reply({
        content: '❌ Invalid time format. Please use 12-hour format like:\n• `2:30 PM`\n• `10:15 AM`\n• `6:00 PM`\n\nOr leave blank to use current time (GMT+8 Philippines timezone).',
        ephemeral: true
      });
      return;
    }
  } else {
    // Use current GMT+8 time and convert to UTC for storage
    const currentGMT8 = getCurrentGMT8Time();
    killTime = convertGMT8ToUTC(currentGMT8);
  }

  // Get guild settings to use the correct notification channel
  const settings = await db.getGuildSettings(interaction.guild!.id);
  const channelId = settings.notificationChannel || interaction.channel!.id;

  const nextSpawnTime = new Date(killTime.getTime() + (boss.cycleHours * 60 * 60 * 1000));

  const timer: BossTimer = {
    bossId: boss.id,
    guildId: interaction.guild!.id,
    channelId: channelId,
    lastKillTime: killTime,
    nextSpawnTime: nextSpawnTime,
    isActive: true
  };

  await db.setBossTimer(timer);

  const embed = new EmbedBuilder()
    .setTitle(`🗡️ ${boss.name} Killed!`)
    .setDescription(`**${boss.name}** (Lv.${boss.level}) was killed at **${boss.location}**\n*🌏 Times shown in Philippines GMT+8 timezone*`)
    .addFields(
      { name: '⚔️ Kill Time', value: `<t:${Math.floor(killTime.getTime() / 1000)}:F>`, inline: true },
      { name: '⏰ Next Spawn', value: `<t:${Math.floor(nextSpawnTime.getTime() / 1000)}:R>`, inline: true },
      { name: '🔄 Cycle', value: `${boss.cycleHours}h`, inline: true }
    )
    .setColor('#e74c3c')
    .setThumbnail(`attachment://${boss.id}.png`)
    .setTimestamp();

  // Try to attach boss image if it exists
  const imagePath = path.join(__dirname, '..', '..', 'images', `${boss.id}.png`);
  const files = [];
  
  if (fs.existsSync(imagePath)) {
    const attachment = new AttachmentBuilder(imagePath, { name: `${boss.id}.png` });
    files.push(attachment);
  }

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`dynamic_timer_${boss.id}`)
        .setLabel('📊 Create Live Timer')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⏱️')
    );

  // Update the original message with the kill confirmation
  await interaction.update({ embeds: [embed], files, components: [row] });
}

async function handleSettingsCommand(interaction: ChatInputCommandInteraction, db: DatabaseManager) {
  const settings = await db.getGuildSettings(interaction.guild!.id);

  const embed = new EmbedBuilder()
    .setTitle('⚙️ Guild Boss Settings')
    .setDescription('Current configuration for this server:')
    .addFields(
      { name: '📢 Notification Channel', value: settings.notificationChannel ? `<#${settings.notificationChannel}>` : 'Not set', inline: true },
      { name: '👥 Mention Role', value: settings.mentionRole ? `<@&${settings.mentionRole}>` : 'None', inline: true },
      { name: '⏰ Warning Time', value: `${settings.warningMinutes} minutes`, inline: true }
    )
    .setColor('#3498db')
    .setTimestamp();

  if (!settings.notificationChannel) {
    embed.addFields({
      name: '💡 Setup Required',
      value: 'Use `/boss setup` to configure notification settings (Admin only)',
      inline: false
    });
  }

  await interaction.reply({ embeds: [embed] });
}
