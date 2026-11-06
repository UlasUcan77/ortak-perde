/** Room code alphabet: uppercase letters + digits without look-alikes (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;

export const MIN_PLAYERS_TO_START = 2;
export const MAX_PLAYERS = 12;
export const NAME_MAX_LENGTH = 16;

export const DECK_SIZES = [10, 15, 20, 30] as const;
export type DeckSize = (typeof DECK_SIZES)[number];

/** Points per swipe action. */
export const SWIPE_POINTS = { nope: 0, like: 1, super: 2 } as const;

/** Duration of the REVEALING phase (countdown + reveal) in milliseconds. */
export const REVEAL_DURATION_MS = 8_000;

/** Emoji avatars a player can choose from. Validated server side. */
export const AVATARS = [
  '🦊',
  '🐼',
  '🐸',
  '🐙',
  '🦄',
  '🐯',
  '🐨',
  '🐧',
  '🦉',
  '🐢',
  '🦖',
  '🐳',
  '🦁',
  '🐶',
  '🐱',
  '🐰',
  '🦝',
  '🐝',
  '👽',
  '🤖',
  '👻',
  '🎃',
  '🍿',
  '🌵',
] as const;
export type Avatar = (typeof AVATARS)[number];

/**
 * TMDB movie genre ids. These ids are stable across TMDB and are also used by the
 * bundled sample dataset. Localised names live in the web app's i18n files.
 */
export const MOVIE_GENRE_IDS = [
  28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37, 10770,
] as const;

/** Genres hidden from the picker (rarely useful for a movie night). */
export const HIDDEN_GENRE_IDS: readonly number[] = [10770];

/**
 * Streaming services offered in the "only my platforms" filter, matched by name against
 * TMDB's provider list for the region. TMDB ids differ per region, so we match names.
 */
export const PREFERRED_PROVIDER_NAMES = [
  'Netflix',
  'Disney Plus',
  'Amazon Prime Video',
  'Max',
  'HBO Max',
  'Apple TV+',
  'Apple TV Plus',
  'Tabii',
  'Exxen',
  'BluTV',
  'MUBI',
  'TOD',
  'Gain',
  'puhutv',
  'TV+',
] as const;
