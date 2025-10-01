import { Boss } from './types';

export const BOSSES: Boss[] = [
  // Short Cycle Bosses (10-21h)
  { id: 'venatus', name: 'Venatus', level: 60, location: 'Corrupted River Stream', cycleHours: 10, category: 'short' },
  { id: 'viorent', name: 'Viorent', level: 65, location: 'Gill Stream', cycleHours: 10, category: 'short' },
  { id: 'ego', name: 'Ego', level: 70, location: 'Reclaimed Gathering Point', cycleHours: 21, category: 'short' },
  { id: 'araneo', name: 'Araneo', level: 83, location: 'Limestone Cavern', cycleHours: 12, category: 'short' },
  { id: 'undomiel', name: 'Undomiel', level: 85, location: 'Pearlharbor Passage', cycleHours: 18, category: 'short' },
  { id: 'livera', name: 'Livera', level: 90, location: 'Hermit\'s Hideaway', cycleHours: 20, category: 'short' },

  // Long Cycle Bosses (24-48h)
  { id: 'ladydalia', name: 'Lady Dalia', level: 83, location: 'Coral Beach', cycleHours: 24, category: 'long' },
  { id: 'generalaquleus', name: 'General Aquleus', level: 85, location: 'Lower Tomb of Tyriosa 2F', cycleHours: 29, category: 'long' },
  { id: 'amentis', name: 'Amentis', level: 88, location: 'Limestone Cape', cycleHours: 29, category: 'long' },
  { id: 'ordo', name: 'Ordo', level: 90, location: 'Limestone Waterway', cycleHours: 48, category: 'long' },
  { id: 'larba', name: 'Larba', level: 98, location: 'Garbana Reclaimed Land', cycleHours: 35, category: 'long' },
  { id: 'ringor', name: 'Ringor', level: 90, location: 'Deserted Nest', cycleHours: 39, category: 'long' },
  { id: 'thymele', name: 'Thymele', level: 85, location: 'Sludie Snow Field', cycleHours: 37, category: 'long' },
  { id: 'milavy', name: 'Milavy', level: 90, location: 'Coralline Shallows', cycleHours: 43, category: 'long' },
  { id: 'gareth', name: 'Gareth', level: 98, location: 'Deadman\'s Land District 1', cycleHours: 32, category: 'long' },
  { id: 'titore', name: 'Titore', level: 98, location: 'Deadman\'s Land District 2', cycleHours: 37, category: 'long' },
  { id: 'metus', name: 'Metus', level: 93, location: 'Follower\'s Field', cycleHours: 48, category: 'long' },
  { id: 'duplican', name: 'Duplican', level: 93, location: 'Open-Eyed Puppet\'s Throne', cycleHours: 48, category: 'long' },
  { id: 'shuliar', name: 'Shuliar', level: 95, location: 'Masquerade of Hounds', cycleHours: 35, category: 'long' },
  { id: 'catena', name: 'Catena', level: 100, location: 'Deadman\'s Land District 3', cycleHours: 35, category: 'long' },

  // Scheduled Bosses (Fixed Times)
  { id: 'auraq', name: 'Auraq', level: 100, location: 'Deadman\'s Land District 4', cycleHours: 24, category: 'scheduled', scheduledTimes: ['12:00', '20:00'] },
  { id: 'rohtahzek', name: 'Rohtahzek', level: 95, location: 'Rohtah Cave', cycleHours: 24, category: 'scheduled', scheduledTimes: ['14:00', '22:00'] },
  { id: 'mutanus', name: 'Mutanus', level: 90, location: 'Mutant\'s Nest', cycleHours: 12, category: 'scheduled', scheduledTimes: ['06:00', '12:00', '18:00'] },
  { id: 'grezak', name: 'Grezak', level: 88, location: 'Grezak\'s Lair', cycleHours: 18, category: 'scheduled', scheduledTimes: ['08:00', '20:00'] },
  { id: 'godhun', name: 'Godhun', level: 85, location: 'Godhun\'s Territory', cycleHours: 24, category: 'scheduled', scheduledTimes: ['10:00', '18:00'] },
  { id: 'taros', name: 'Taros', level: 83, location: 'Taros Valley', cycleHours: 16, category: 'scheduled', scheduledTimes: ['07:00', '15:00', '23:00'] },
  { id: 'kazar', name: 'Kazar', level: 80, location: 'Kazar\'s Domain', cycleHours: 20, category: 'scheduled', scheduledTimes: ['09:00', '21:00'] }
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
