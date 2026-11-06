import {
  HIDDEN_GENRE_IDS,
  MOVIE_GENRE_IDS,
  type Genre,
  type Locale,
  type Movie,
} from '@ortak-perde/shared';
import rawMovies from '../data/sample-movies.json';
import { genreName } from './genre-names';
import type { DiscoverQuery, MovieCatalog } from './types';

interface SampleMovie {
  id: number;
  title: Record<Locale, string>;
  originalTitle: string;
  year: number;
  runtime: number;
  genreIds: number[];
  rating: number;
  hue: number;
  overview: Record<Locale, string>;
}

export const SAMPLE_MOVIES = rawMovies as SampleMovie[];
const PAGE_SIZE = 20;

function toMovie(m: SampleMovie, locale: Locale): Movie {
  return {
    id: m.id,
    title: m.title[locale],
    originalTitle: m.originalTitle,
    year: m.year,
    posterUrl: null,
    placeholderHue: m.hue,
    overview: m.overview[locale],
    runtime: m.runtime,
    genreIds: m.genreIds,
    genres: m.genreIds.map((g) => genreName(g, locale)).filter((n): n is string => n !== null),
    rating: m.rating,
    voteCount: 0,
    providers: [],
  };
}

/**
 * Offline catalog backed by a small bundled dataset (titles, years, genres, runtimes,
 * approximate ratings and our own one-line summaries; no posters). Used when no TMDB key
 * is configured and as a fallback when TMDB is unreachable.
 */
export class SampleCatalog implements MovieCatalog {
  readonly mode = 'sample' as const;

  async getGenres(locale: Locale): Promise<Genre[]> {
    return MOVIE_GENRE_IDS.filter((id) => !HIDDEN_GENRE_IDS.includes(id)).map((id) => ({
      id,
      name: genreName(id, locale) ?? String(id),
    }));
  }

  async getProviders(): Promise<[]> {
    return [];
  }

  async discover({ genreId, settings, locale, page }: DiscoverQuery): Promise<Movie[]> {
    const matches = SAMPLE_MOVIES.filter(
      (m) =>
        (genreId === null || m.genreIds.includes(genreId)) &&
        m.year >= settings.yearFrom &&
        m.year <= settings.yearTo &&
        m.rating >= settings.minRating &&
        (settings.maxRuntime === null || m.runtime <= settings.maxRuntime),
    ).sort((a, b) => b.rating - a.rating || a.id - b.id);
    return matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((m) => toMovie(m, locale));
  }

  async enrich(movies: Movie[]): Promise<Movie[]> {
    return movies;
  }
}
