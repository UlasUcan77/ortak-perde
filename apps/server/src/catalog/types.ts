import type {
  CatalogMode,
  Genre,
  Locale,
  Movie,
  RoomSettings,
  WatchProvider,
} from '@ortak-perde/shared';

export interface DiscoverQuery {
  /** null = no genre filter (general pool). */
  genreId: number | null;
  settings: RoomSettings;
  locale: Locale;
  page: number;
}

/** A source of movies. Implemented by the TMDB client and the offline sample dataset. */
export interface MovieCatalog {
  readonly mode: CatalogMode;
  getGenres(locale: Locale): Promise<Genre[]>;
  getProviders(locale: Locale, region: string): Promise<WatchProvider[]>;
  /** Returns candidate movies for one page of a discover query, best first. */
  discover(query: DiscoverQuery): Promise<Movie[]>;
  /** Fills in details that discover does not return (runtime, providers, overview fallback). */
  enrich(movies: Movie[], locale: Locale, region: string): Promise<Movie[]>;
}

export function tmdbLanguage(locale: Locale): string {
  return locale === 'tr' ? 'tr-TR' : 'en-US';
}
