import type { RoomSettings } from './types';

export function defaultSettings(now: Date = new Date()): RoomSettings {
  return {
    deckSize: 20,
    yearFrom: 1970,
    yearTo: now.getFullYear(),
    minRating: 6,
    maxRuntime: null,
    minVotes: 300,
    originalLanguage: null,
    region: 'TR',
    providerIds: [],
  };
}
