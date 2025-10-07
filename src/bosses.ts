import { Boss } from './types';

export const BOSSES: Boss[] = [
  // Short Cycle Bosses (10-21h)
  { id: 'venatus', name: 'Venatus', level: 60, location: 'Corrupted River Stream', cycleHours: 10, category: 'short' },
  { id: 'viorent', name: 'Viorent', level: 65, location: 'Gill Stream', cycleHours: 10, category: 'short' },
  { id: 'ego', name: 'Ego', level: 70, location: 'Reclaimed Gathering Point', cycleHours: 21, category: 'short' },
  { id: 'ladydalia', name: 'Lady Dalia', level: 83, location: 'Coral Beach', cycleHours: 18, category: 'long' },
  
  // Long Cycle Bosses (24-48h)
  { id: 'araneo', name: 'Araneo', level: 83, location: 'Limestone Cavern', cycleHours: 24, category: 'long' },
  { id: 'undomiel', name: 'Undomiel', level: 85, location: 'Pearlharbor Passage', cycleHours: 24, category: 'long' },
  { id: 'livera', name: 'Livera', level: 90, location: 'Hermit\'s Hideaway', cycleHours: 24, category: 'long' },
  { id: 'generalaquleus', name: 'General Aquleus', level: 85, location: 'Lower Tomb of Tyriosa 2F', cycleHours: 29, category: 'long' },
  { id: 'baronbraudmore', name: 'Baron Baraudmore', level: 88, location: 'Rosevine Bridge', cycleHours: 32, category: 'long' },
  { id: 'amentis', name: 'Amentis', level: 88, location: 'Limestone Cape', cycleHours: 29, category: 'long' },
  { id: 'larba', name: 'Larba', level: 98, location: 'Garbana Reclaimed Land', cycleHours: 35, category: 'long' },
  { id: 'gareth', name: 'Gareth', level: 98, location: 'Deadman\'s Land District 1', cycleHours: 32, category: 'long' },
  { id: 'titore', name: 'Titore', level: 98, location: 'Deadman\'s Land District 2', cycleHours: 37, category: 'long' },
  { id: 'wannitas', name: 'Wannitas', level: 93, location: 'Snare Swamp', cycleHours: 48, category: 'long' },  
  { id: 'metus', name: 'Metus', level: 93, location: 'Follower\'s Field', cycleHours: 48, category: 'long' },
  { id: 'duplican', name: 'Duplican', level: 93, location: 'Open-Eyed Puppet\'s Throne', cycleHours: 48, category: 'long' },
  { id: 'shuliar', name: 'Shuliar', level: 95, location: 'Masquerade of Hounds', cycleHours: 35, category: 'long' },
  { id: 'catena', name: 'Catena', level: 100, location: 'Deadman\'s Land District 3', cycleHours: 35, category: 'long' },  
  { id: 'secreta', name: 'Secreta', level: 100, location: 'Kallion\'s Tomb', cycleHours: 62, category: 'long' },  
  { id: 'ordo', name: 'Ordo', level: 100, location: 'Succesor\'s Paradise', cycleHours: 62, category: 'long' },
  { id: 'asta', name: 'Asta', level: 100, location: 'Goldblood Plain', cycleHours: 62, category: 'long' },
  { id: 'supore', name: 'Supore', level: 100, location: 'Goldblood Plain', cycleHours: 62, category: 'long' },

  // Scheduled Bosses (Fixed Weekly Times - GMT+8)
  { id: 'clemantis', name: 'Clemantis', level: 85, location: 'Clemantis Lair', cycleHours: 168, category: 'scheduled', scheduledTimes: ['Monday 11:30', 'Thursday 19:00'] },
  { id: 'saphirus', name: 'Saphirus', level: 90, location: 'Saphirus Domain', cycleHours: 168, category: 'scheduled', scheduledTimes: ['Sunday 17:00', 'Tuesday 11:30'] },
  { id: 'neutro', name: 'Neutro', level: 88, location: 'Neutro Zone', cycleHours: 168, category: 'scheduled', scheduledTimes: ['Tuesday 19:00', 'Thursday 11:30'] },
  { id: 'thymele', name: 'Thymele', level: 85, location: 'Sludie Snow Field', cycleHours: 168, category: 'scheduled', scheduledTimes: ['Monday 19:00', 'Wednesday 11:30'] },
  { id: 'milavy', name: 'Milavy', level: 90, location: 'Coralline Shallows', cycleHours: 168, category: 'scheduled', scheduledTimes: ['Saturday 15:00'] },
  { id: 'ringor', name: 'Ringor', level: 90, location: 'Deserted Nest', cycleHours: 168, category: 'scheduled', scheduledTimes: ['Saturday 17:00'] },
  { id: 'roderick', name: 'Roderick', level: 92, location: 'Roderick\'s Keep', cycleHours: 168, category: 'scheduled', scheduledTimes: ['Friday 19:00'] },
  { id: 'auraq', name: 'Auraq', level: 100, location: 'Deadman\'s Land District 4', cycleHours: 168, category: 'scheduled', scheduledTimes: ['Friday 22:00', 'Wednesday 21:00'] },
  { id: 'chaiflock', name: 'Chaiflock', level: 95, location: 'Chaiflock Territory', cycleHours: 168, category: 'scheduled', scheduledTimes: ['Saturday 22:00'] },
  { id: 'benji', name: 'Benji', level: 87, location: 'Benji\'s Domain', cycleHours: 168, category: 'scheduled', scheduledTimes: ['Sunday 21:00'] }
];

export function getBossById(id: string): Boss | undefined {
  return BOSSES.find(boss => boss.id === id);
}

export function getBossesByCategory(category: Boss['category']): Boss[] {
  return BOSSES.filter(boss => boss.category === category);
}

export function searchBosses(query: string): Boss[] {
  const lowercaseQuery = query.toLowerCase();
  return BOSSES.filter(boss => 
    boss.name.toLowerCase().includes(lowercaseQuery) ||
    boss.location.toLowerCase().includes(lowercaseQuery)
  );
}
