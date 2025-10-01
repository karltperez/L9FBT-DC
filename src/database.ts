import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { BossTimer } from './types';

export class DatabaseManager {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

  async initialize(): Promise<void> {
    this.db = await open({
      filename: './database.db',
      driver: sqlite3.Database
    });

    await this.createTables();
    await this.migrateDatabase();
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS boss_timers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        boss_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        last_kill_time INTEGER NOT NULL,
        next_spawn_time INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        warning_sent INTEGER DEFAULT 0,
        ready_sent INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(boss_id, guild_id)
      );

      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        timezone TEXT DEFAULT 'UTC',
        notification_channel TEXT,
        mention_role TEXT,
        warning_minutes INTEGER DEFAULT 5,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS dynamic_timer_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        boss_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        timer_type TEXT DEFAULT 'status',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(boss_id, guild_id, message_id)
      );
    `);
  }

  private async migrateDatabase(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Check if the new columns exist
    const tableInfo = await this.db.all("PRAGMA table_info(boss_timers)");
    const hasWarningColumn = tableInfo.some((col: any) => col.name === 'warning_sent');
    const hasReadyColumn = tableInfo.some((col: any) => col.name === 'ready_sent');

    if (!hasWarningColumn || !hasReadyColumn) {
      console.log('🔄 Migrating database to add notification tracking columns...');
      
      if (!hasWarningColumn) {
        await this.db.exec('ALTER TABLE boss_timers ADD COLUMN warning_sent INTEGER DEFAULT 0');
        console.log('✅ Added warning_sent column');
      }
      
      if (!hasReadyColumn) {
        await this.db.exec('ALTER TABLE boss_timers ADD COLUMN ready_sent INTEGER DEFAULT 0');
        console.log('✅ Added ready_sent column');
      }
      
      console.log('✅ Database migration completed');
    }
  }

  async setBossTimer(timer: BossTimer): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run(`
      INSERT OR REPLACE INTO boss_timers 
      (boss_id, guild_id, channel_id, last_kill_time, next_spawn_time, is_active, warning_sent, ready_sent, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, strftime('%s', 'now'))
    `, [
      timer.bossId,
      timer.guildId,
      timer.channelId,
      Math.floor(timer.lastKillTime.getTime() / 1000),
      Math.floor(timer.nextSpawnTime.getTime() / 1000),
      timer.isActive ? 1 : 0
    ]);
  }

  async getBossTimer(bossId: string, guildId: string): Promise<BossTimer | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = await this.db.get(`
      SELECT * FROM boss_timers 
      WHERE boss_id = ? AND guild_id = ?
    `, [bossId, guildId]);

    if (!row) return null;

    return {
      bossId: row.boss_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      lastKillTime: new Date(row.last_kill_time * 1000),
      nextSpawnTime: new Date(row.next_spawn_time * 1000),
      isActive: row.is_active === 1
    };
  }

  async getActiveTimers(): Promise<BossTimer[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.all(`
      SELECT * FROM boss_timers 
      WHERE is_active = 1
    `);

    return rows.map((row: any) => ({
      bossId: row.boss_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      lastKillTime: new Date(row.last_kill_time * 1000),
      nextSpawnTime: new Date(row.next_spawn_time * 1000),
      isActive: row.is_active === 1,
      warning_sent: row.warning_sent === 1,
      ready_sent: row.ready_sent === 1
    }));
  }

  async getGuildTimers(guildId: string): Promise<BossTimer[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.all(`
      SELECT * FROM boss_timers 
      WHERE guild_id = ? AND is_active = 1
      ORDER BY next_spawn_time ASC
    `, [guildId]);

    return rows.map((row: any) => ({
      bossId: row.boss_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      lastKillTime: new Date(row.last_kill_time * 1000),
      nextSpawnTime: new Date(row.next_spawn_time * 1000),
      isActive: row.is_active === 1
    }));
  }

  async deleteBossTimer(bossId: string, guildId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run(`
      DELETE FROM boss_timers 
      WHERE boss_id = ? AND guild_id = ?
    `, [bossId, guildId]);
  }

  async setGuildSettings(guildId: string, settings: {
    timezone?: string;
    notificationChannel?: string;
    mentionRole?: string;
    warningMinutes?: number;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run(`
      INSERT OR REPLACE INTO guild_settings 
      (guild_id, timezone, notification_channel, mention_role, warning_minutes, updated_at)
      VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
    `, [
      guildId,
      settings.timezone || 'UTC',
      settings.notificationChannel || null,
      settings.mentionRole || null,
      settings.warningMinutes || 5
    ]);
  }

  async getGuildSettings(guildId: string): Promise<{
    timezone: string;
    notificationChannel: string | null;
    mentionRole: string | null;
    warningMinutes: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const row = await this.db.get(`
      SELECT * FROM guild_settings WHERE guild_id = ?
    `, [guildId]);

    return {
      timezone: row?.timezone || 'UTC',
      notificationChannel: row?.notification_channel || null,
      mentionRole: row?.mention_role || null,
      warningMinutes: row?.warning_minutes || 5
    };
  }

  async addDynamicTimerMessage(bossId: string, guildId: string, channelId: string, messageId: string, timerType: string = 'status'): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run(`
      INSERT OR REPLACE INTO dynamic_timer_messages 
      (boss_id, guild_id, channel_id, message_id, timer_type)
      VALUES (?, ?, ?, ?, ?)
    `, [bossId, guildId, channelId, messageId, timerType]);
  }

  async getDynamicTimerMessages(bossId?: string, guildId?: string): Promise<{
    id: number;
    bossId: string;
    guildId: string;
    channelId: string;
    messageId: string;
    timerType: string;
  }[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM dynamic_timer_messages';
    const params: any[] = [];

    if (bossId && guildId) {
      query += ' WHERE boss_id = ? AND guild_id = ?';
      params.push(bossId, guildId);
    } else if (guildId) {
      query += ' WHERE guild_id = ?';
      params.push(guildId);
    }

    const rows = await this.db.all(query, params);
    return rows.map(row => ({
      id: row.id,
      bossId: row.boss_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id,
      timerType: row.timer_type
    }));
  }

  async removeDynamicTimerMessage(messageId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.run('DELETE FROM dynamic_timer_messages WHERE message_id = ?', [messageId]);
  }

  async cleanupDynamicTimerMessages(bossId: string, guildId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.run('DELETE FROM dynamic_timer_messages WHERE boss_id = ? AND guild_id = ?', [bossId, guildId]);
  }

  async updateNotificationFlags(bossId: string, guildId: string, warningSent: boolean, readySent: boolean): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run(`
      UPDATE boss_timers 
      SET warning_sent = ?, ready_sent = ?, updated_at = strftime('%s', 'now')
      WHERE boss_id = ? AND guild_id = ?
    `, [warningSent ? 1 : 0, readySent ? 1 : 0, bossId, guildId]);
  }
}
