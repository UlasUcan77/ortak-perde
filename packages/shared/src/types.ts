import type { DeckSize } from './constants';

export const PHASES = ['LOBBY', 'PICKING', 'BUILDING', 'SWIPING', 'REVEALING', 'RESULTS'] as const;
export type Phase = (typeof PHASES)[number];

export type SwipeAction = 'like' | 'nope' | 'super';
export type Locale = 'tr' | 'en';
export type CatalogMode = 'tmdb' | 'sample';

export interface Genre {
  id: number;
  name: string;
}

export interface WatchProvider {
  id: number;
  name: string;
  logoUrl: string | null;
}

export interface Movie {
  id: number;
  title: string;
  originalTitle: string;
  year: number | null;
  posterUrl: string | null;
  /** Used when there is no poster (sample data): a hue 0-359 for a generated gradient. */
  placeholderHue: number | null;
  overview: string;
  runtime: number | null;
  genreIds: number[];
  genres: string[];
  rating: number;
  voteCount: number;
  providers: WatchProvider[];
}

export interface RoomSettings {
  deckSize: DeckSize;
  yearFrom: number;
  yearTo: number;
  minRating: number;
  /** Max runtime in minutes, null = no limit. */
  maxRuntime: number | null;
  minVotes: number;
  /** ISO 639-1 code, null = any. */
  originalLanguage: string | null;
  /** ISO 3166-1 region for watch providers. */
  region: string;
  /** TMDB watch provider ids. Empty = no platform filter. */
  providerIds: number[];
}

export interface GenrePreference {
  liked: number[];
  /** "Fark etmez" — anything goes. */
  any: boolean;
  disliked: number[];
}

export interface PlayerPublic {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
  ready: boolean;
  /** Number of cards swiped in the current round. */
  progress: number;
  finished: boolean;
}

export type DeckNoticeCode =
  | 'relaxed-dislikes'
  | 'short-deck'
  | 'sample-fallback'
  | 'providers-ignored'
  | 'no-movies'
  | 'build-failed';

export interface DeckNotice {
  code: DeckNoticeCode;
  /** Optional detail, e.g. deck size actually built. */
  value?: number;
}

export type ResultMode = 'match' | 'compromise' | 'no-cinema';

export interface RankedMovie {
  movie: Movie;
  score: number;
  likes: number;
  supers: number;
  likedBy: string[];
}

export interface GameResults {
  mode: ResultMode;
  winner: RankedMovie | null;
  /** Second and third place (may be shorter). */
  podium: RankedMovie[];
  /** When mode is no-cinema: best-rated non-vetoed movie as a consolation pick. */
  alternative: Movie | null;
  participants: number;
  vetoCount: number;
}

interface BaseView {
  code: string;
  phase: Phase;
  round: number;
  players: PlayerPublic[];
  settings: RoomSettings;
  deckLength: number;
  catalogMode: CatalogMode;
  notices: DeckNotice[];
  hostConnected: boolean;
}

export interface HostView extends BaseView {
  role: 'host';
  joinUrl: string | null;
  joinBase: string | null;
  results: GameResults | null;
  revealEndsAt: number | null;
}

export interface PlayerSelf {
  id: string;
  name: string;
  avatar: string;
  preference: GenrePreference;
  ready: boolean;
  /** This player's personal order of movie ids. */
  order: number[];
  swipes: Record<number, SwipeAction>;
  vetoMovieId: number | null;
  canUndo: boolean;
  finished: boolean;
}

export interface PlayerView extends BaseView {
  role: 'player';
  me: PlayerSelf;
  /** Only filled in RESULTS (players see "look at the screen" during REVEALING). */
  results: GameResults | null;
}

export type RoomView = HostView | PlayerView;

export interface DeckPayload {
  round: number;
  movies: Movie[];
}
