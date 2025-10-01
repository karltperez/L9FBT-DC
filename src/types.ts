export interface Boss {
  id: string;
  name: string;
  level: number;
  location: string;
  cycleHours: number;
  category: 'short' | 'long' | 'scheduled';
  scheduledTimes?: string[]; // For scheduled bosses like Auraq
}

export interface BossTimer {
  bossId: string;
  guildId: string;
  channelId: string;
  lastKillTime: Date;
  nextSpawnTime: Date;
  isActive: boolean;
}
