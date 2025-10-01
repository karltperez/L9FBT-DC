import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder } from 'discord.js';
import { getBossById, getBossesByCategory, BOSSES } from '../bosses';
import { DatabaseManager } from '../database';
import { BossTimer } from '../types';
import * as fs from 'fs';
import * as path from 'path';

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
          .setName('name')
          .setDescription('Boss name')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('time')
          .setDescription('Kill time (optional, defaults to now)')
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
  const bossName = interaction.options.getString('name', true);
  const timeStr = interaction.options.getString('time');

  const boss = getBossById(bossName.toLowerCase().replace(/\s+/g, ''));
  if (!boss) {
    await interaction.reply(`❌ Boss "${bossName}" not found. Use \`/boss list\` to see available bosses.`);
    return;
  }

  let killTime = new Date();
  if (timeStr) {
    const parsedTime = new Date(timeStr);
    if (!isNaN(parsedTime.getTime())) {
      killTime = parsedTime;
    }
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
    .setDescription(`**${boss.name}** (Lv.${boss.level}) was killed at **${boss.location}**`)
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

  await interaction.reply({ embeds: [embed], files, components: [row] });
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

    const embed = new EmbedBuilder()
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

    // Try to attach boss image if it exists
    const imagePath = path.join(__dirname, '..', '..', 'images', `${boss.id}.png`);
    const files = [];
    
    if (fs.existsSync(imagePath)) {
      const attachment = new AttachmentBuilder(imagePath, { name: `${boss.id}.png` });
      files.push(attachment);
    }

    const reply = await interaction.reply({ embeds: [embed], files });
    
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
    value: '• `/boss setup` - Configure notifications (Admin)\n• `/boss killed <name>` - Report boss kill\n• `/boss status <name>` - Check timer\n• `/boss status` - View all timers',
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
