import {
  HIDDEN_GENRE_IDS,
  PREFERRED_PROVIDER_NAMES,
  type Genre,
  type Locale,
  type Movie,
  type WatchProvider,
} from '@ortak-perde/shared';
import { createLimiter, TtlCache } from './cache';
import { genreName } from './genre-names';
import { tmdbLanguage, type DiscoverQuery, type MovieCatalog } from './types';

const API_BASE = 'https://api.themoviedb.org/3';
export const IMAGE_BASE = 'https://image.tmdb.org/t/p';
const POSTER_SIZE = 'w500';
const LOGO_SIZE = 'w92';

const HOUR = 60 * 60_000;

/** Error thrown for TMDB failures. Never contains the request URL (which may carry the key). */
export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'TmdbError';
  }
}

interface TmdbDiscoverMovie {
  id: number;
  title?: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  adult?: boolean;
}

interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
  display_priority?: number;
  display_priorities?: Record<string, number>;
}

interface TmdbMovieDetails {
  id: number;
  runtime?: number | null;
  overview?: string;
  genres?: { id: number; name: string }[];
  'watch/providers'?: {
    results?: Record<
      string,
      { flatrate?: TmdbProvider[]; free?: TmdbProvider[]; ads?: TmdbProvider[] }
    >;
  };
}

export interface TmdbOptions {
  apiKey: string;
  fetch?: typeof fetch;
  /** Max parallel requests to TMDB (they allow ~50 req/s; we stay far below). */
  concurrency?: number;
  timeoutMs?: number;
  maxRetries?: number;
  now?: () => number;
}

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9+]/g, '');
}

const PREFERRED = new Set(PREFERRED_PROVIDER_NAMES.map(normalise));

function yearOf(date: string | undefined): number | null {
  const y = Number(date?.slice(0, 4));
  return Number.isFinite(y) && y > 1800 ? y : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TmdbCatalog implements MovieCatalog {
  readonly mode = 'tmdb' as const;
  private readonly fetchImpl: typeof fetch;
  private readonly limit: ReturnType<typeof createLimiter>;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly apiKey: string;
  private readonly useBearer: boolean;

  private readonly genreCache: TtlCache<Genre[]>;
  private readonly providerCache: TtlCache<WatchProvider[]>;
  private readonly discoverCache: TtlCache<Movie[]>;
  private readonly detailsCache: TtlCache<TmdbMovieDetails>;

  constructor(options: TmdbOptions) {
    this.apiKey = options.apiKey;
    // v4 "API Read Access Tokens" are JWTs and go into the Authorization header.
    this.useBearer = options.apiKey.startsWith('eyJ');
    this.fetchImpl = options.fetch ?? fetch;
    this.limit = createLimiter(options.concurrency ?? 6);
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.maxRetries = options.maxRetries ?? 3;
    const now = options.now ?? Date.now;
    this.genreCache = new TtlCache(24 * HOUR, 10, now);
    this.providerCache = new TtlCache(24 * HOUR, 20, now);
    this.discoverCache = new TtlCache(HOUR, 2000, now);
    this.detailsCache = new TtlCache(6 * HOUR, 5000, now);
  }

  /** Performs a GET against the TMDB v3 API with retries on 429/5xx. */
  async request<T>(
    pathname: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = new URL(API_BASE + pathname);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.useBearer) headers.authorization = `Bearer ${this.apiKey}`;
    else url.searchParams.set('api_key', this.apiKey);

    return this.limit(async () => {
      for (let attempt = 0; ; attempt++) {
        let res: Response;
        try {
          res = await this.fetchImpl(url, { headers, signal: AbortSignal.timeout(this.timeoutMs) });
        } catch (err) {
          if (attempt < this.maxRetries) {
            await sleep(300 * 2 ** attempt);
            continue;
          }
          const reason = err instanceof Error ? err.name : 'unknown';
          throw new TmdbError(`TMDB request to ${pathname} failed (${reason})`, null);
        }
        if (res.ok) return (await res.json()) as T;
        if ((res.status === 429 || res.status >= 500) && attempt < this.maxRetries) {
          const retryAfter = Number(res.headers.get('retry-after'));
          await sleep(
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt,
          );
          continue;
        }
        throw new TmdbError(
          `TMDB request to ${pathname} failed with status ${res.status}`,
          res.status,
        );
      }
    });
  }

  async getGenres(locale: Locale): Promise<Genre[]> {
    return this.genreCache.getOrLoad(locale, async () => {
      const primary = await this.request<{ genres: Genre[] }>('/genre/movie/list', {
        language: tmdbLanguage(locale),
      });
      let fallback: Genre[] = [];
      if (locale !== 'en' && primary.genres.some((g) => !g.name)) {
        fallback = (
          await this.request<{ genres: Genre[] }>('/genre/movie/list', { language: 'en-US' })
        ).genres;
      }
      return primary.genres
        .filter((g) => !HIDDEN_GENRE_IDS.includes(g.id))
        .map((g) => ({
          id: g.id,
          name:
            g.name ||
            fallback.find((f) => f.id === g.id)?.name ||
            genreName(g.id, locale) ||
            String(g.id),
        }));
    });
  }

  async getProviders(locale: Locale, region: string): Promise<WatchProvider[]> {
    return this.providerCache.getOrLoad(`${locale}:${region}`, async () => {
      const data = await this.request<{ results: TmdbProvider[] }>('/watch/providers/movie', {
        language: tmdbLanguage(locale),
        watch_region: region,
      });
      const sorted = [...data.results].sort(
        (a, b) =>
          (a.display_priorities?.[region] ?? a.display_priority ?? 999) -
          (b.display_priorities?.[region] ?? b.display_priority ?? 999),
      );
      const preferred = sorted.filter((p) => PREFERRED.has(normalise(p.provider_name)));
      return (preferred.length > 0 ? preferred : sorted.slice(0, 12)).map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logoUrl: p.logo_path ? `${IMAGE_BASE}/${LOGO_SIZE}${p.logo_path}` : null,
      }));
    });
  }

  async discover({ genreId, settings, locale, page }: DiscoverQuery): Promise<Movie[]> {
    const params: Record<string, string | number | undefined> = {
      language: tmdbLanguage(locale),
      include_adult: 'false',
      include_video: 'false',
      sort_by: 'popularity.desc',
      page,
      with_genres: genreId ?? undefined,
      'primary_release_date.gte': `${settings.yearFrom}-01-01`,
      'primary_release_date.lte': `${settings.yearTo}-12-31`,
      'vote_average.gte': settings.minRating,
      'vote_count.gte': settings.minVotes,
      'with_runtime.lte': settings.maxRuntime ?? undefined,
      with_original_language: settings.originalLanguage ?? undefined,
      region: settings.region,
      watch_region: settings.region,
    };
    if (settings.providerIds.length > 0) {
      params.with_watch_providers = settings.providerIds.join('|');
      params.with_watch_monetization_types = 'flatrate|free|ads';
    }
    const key = JSON.stringify(params);
    const genres = await this.getGenres(locale).catch(() => [] as Genre[]);
    return this.discoverCache.getOrLoad(key, async () => {
      const data = await this.request<{ results: TmdbDiscoverMovie[] }>('/discover/movie', params);
      return data.results
        .filter((m) => !m.adult && m.title)
        .map((m) => this.toMovie(m, genres, locale));
    });
  }

  private toMovie(m: TmdbDiscoverMovie, genres: Genre[], locale: Locale): Movie {
    const genreIds = m.genre_ids ?? [];
    return {
      id: m.id,
      title: m.title ?? m.original_title ?? '',
      originalTitle: m.original_title ?? m.title ?? '',
      year: yearOf(m.release_date),
      posterUrl: m.poster_path ? `${IMAGE_BASE}/${POSTER_SIZE}${m.poster_path}` : null,
      placeholderHue: m.poster_path ? null : (m.id * 47) % 360,
      overview: m.overview ?? '',
      runtime: null,
      genreIds,
      genres: genreIds
        .map((id) => genres.find((g) => g.id === id)?.name ?? genreName(id, locale))
        .filter((n): n is string => !!n),
      rating: Math.round((m.vote_average ?? 0) * 10) / 10,
      voteCount: m.vote_count ?? 0,
      providers: [],
    };
  }

  private details(id: number, language: string): Promise<TmdbMovieDetails> {
    return this.detailsCache.getOrLoad(`${id}:${language}`, () =>
      this.request<TmdbMovieDetails>(`/movie/${id}`, {
        language,
        append_to_response: 'watch/providers',
      }),
    );
  }

  async enrich(movies: Movie[], locale: Locale, region: string): Promise<Movie[]> {
    const language = tmdbLanguage(locale);
    return Promise.all(
      movies.map(async (movie) => {
        try {
          const d = await this.details(movie.id, language);
          let overview = d.overview || movie.overview;
          if (!overview && language !== 'en-US') {
            overview = (await this.details(movie.id, 'en-US')).overview ?? '';
          }
          const regional = d['watch/providers']?.results?.[region];
          const seen = new Set<number>();
          const providers: WatchProvider[] = [];
          for (const p of [
            ...(regional?.flatrate ?? []),
            ...(regional?.free ?? []),
            ...(regional?.ads ?? []),
          ]) {
            if (seen.has(p.provider_id)) continue;
            seen.add(p.provider_id);
            providers.push({
              id: p.provider_id,
              name: p.provider_name,
              logoUrl: p.logo_path ? `${IMAGE_BASE}/${LOGO_SIZE}${p.logo_path}` : null,
            });
          }
          return { ...movie, runtime: d.runtime ?? null, overview, providers };
        } catch {
          // Details are nice-to-have; keep the card with what discover gave us.
          return movie;
        }
      }),
    );
  }
}
