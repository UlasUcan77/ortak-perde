import type { Movie } from './types';

/** Test helper: builds a Movie with sensible defaults. Not exported from the package index. */
export function makeMovie(id: number, overrides: Partial<Movie> = {}): Movie {
  return {
    id,
    title: `Movie ${id}`,
    originalTitle: `Movie ${id}`,
    year: 2000,
    posterUrl: null,
    placeholderHue: 200,
    overview: '',
    runtime: 100,
    genreIds: [],
    genres: [],
    rating: 7,
    voteCount: 1000,
    providers: [],
    ...overrides,
  };
}
