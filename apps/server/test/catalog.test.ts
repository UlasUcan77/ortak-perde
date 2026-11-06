import { describe, expect, it, vi } from 'vitest';
import { defaultSettings, MOVIE_GENRE_IDS } from '@ortak-perde/shared';
import { createLimiter, TtlCache } from '../src/catalog/cache';
import { SAMPLE_MOVIES, SampleCatalog } from '../src/catalog/sample';
import { TmdbCatalog } from '../src/catalog/tmdb';
import { getLanIp } from '../src/network';

const KEY = 'secret-test-key-1234567890';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('sample catalog', () => {
  it('ships 60-80 movies with known genres and both languages', () => {
    expect(SAMPLE_MOVIES.length).toBeGreaterThanOrEqual(60);
    expect(SAMPLE_MOVIES.length).toBeLessThanOrEqual(80);
    const ids = new Set(SAMPLE_MOVIES.map((m) => m.id));
    expect(ids.size).toBe(SAMPLE_MOVIES.length);
    for (const m of SAMPLE_MOVIES) {
      expect(m.title.tr && m.title.en && m.overview.tr && m.overview.en).toBeTruthy();
      for (const g of m.genreIds) expect(MOVIE_GENRE_IDS).toContain(g);
    }
  });

  it('filters by genre, years, rating and runtime', async () => {
    const catalog = new SampleCatalog();
    const settings = {
      ...defaultSettings(),
      yearFrom: 2000,
      yearTo: 2020,
      minRating: 8,
      maxRuntime: 120,
    };
    const movies = await catalog.discover({ genreId: 16, settings, locale: 'en', page: 1 });
    expect(movies.length).toBeGreaterThan(0);
    for (const m of movies) {
      expect(m.genreIds).toContain(16);
      expect(m.year).toBeGreaterThanOrEqual(2000);
      expect(m.rating).toBeGreaterThanOrEqual(8);
      expect(m.runtime).toBeLessThanOrEqual(120);
      expect(m.posterUrl).toBeNull();
      expect(m.placeholderHue).not.toBeNull();
    }
  });
});

describe('TMDB client', () => {
  it('builds discover queries with all filters and maps movies', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/genre/movie/list')) {
        return jsonResponse({ genres: [{ id: 28, name: 'Aksiyon' }] });
      }
      return jsonResponse({
        results: [
          {
            id: 5,
            title: 'Film',
            original_title: 'Film',
            release_date: '2011-05-01',
            poster_path: '/p.jpg',
            genre_ids: [28],
            vote_average: 7.46,
            vote_count: 900,
          },
          { id: 6, title: 'Adult', adult: true },
        ],
      });
    });
    const tmdb = new TmdbCatalog({ apiKey: KEY, fetch: fetchMock as typeof fetch });
    const settings = {
      ...defaultSettings(),
      maxRuntime: 120,
      providerIds: [8, 337],
      originalLanguage: 'tr',
    };
    const movies = await tmdb.discover({ genreId: 28, settings, locale: 'tr', page: 2 });

    expect(movies).toEqual([
      expect.objectContaining({
        id: 5,
        year: 2011,
        posterUrl: 'https://image.tmdb.org/t/p/w500/p.jpg',
        genres: ['Aksiyon'],
        rating: 7.5,
      }),
    ]);
    const discoverCall = fetchMock.mock.calls
      .map((c) => new URL(String(c[0])))
      .find((u) => u.pathname.endsWith('/discover/movie'))!;
    const q = discoverCall.searchParams;
    expect(q.get('with_genres')).toBe('28');
    expect(q.get('include_adult')).toBe('false');
    expect(q.get('vote_count.gte')).toBe('300');
    expect(q.get('with_runtime.lte')).toBe('120');
    expect(q.get('with_watch_providers')).toBe('8|337');
    expect(q.get('watch_region')).toBe('TR');
    expect(q.get('with_original_language')).toBe('tr');
    expect(q.get('language')).toBe('tr-TR');
    expect(q.get('page')).toBe('2');
  });

  it('caches responses', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ genres: [{ id: 28, name: 'Action' }] }));
    const tmdb = new TmdbCatalog({ apiKey: KEY, fetch: fetchMock as typeof fetch });
    await Promise.all([tmdb.getGenres('en'), tmdb.getGenres('en')]);
    await tmdb.getGenres('en');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and never leaks the key in errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValue(new Response('nope', { status: 401 }));
    const tmdb = new TmdbCatalog({ apiKey: KEY, fetch: fetchMock as typeof fetch, maxRetries: 2 });
    const err = await tmdb.getGenres('en').catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).not.toContain(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses a bearer header for v4 tokens instead of a query parameter', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({ genres: [] }),
    );
    const tmdb = new TmdbCatalog({
      apiKey: 'eyJhbGciOiJIUzI1NiJ9.token',
      fetch: fetchMock as typeof fetch,
    });
    await tmdb.getGenres('en');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain('api_key');
    expect((init?.headers as Record<string, string>).authorization).toMatch(/^Bearer /);
  });

  it('enriches movies with runtime and regional streaming providers', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        id: 5,
        runtime: 111,
        overview: '',
        'watch/providers': {
          results: {
            TR: { flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' }] },
          },
        },
      }),
    );
    const tmdb = new TmdbCatalog({ apiKey: KEY, fetch: fetchMock as typeof fetch });
    const [movie] = await tmdb.enrich(
      [
        {
          id: 5,
          title: 'F',
          originalTitle: 'F',
          year: 2000,
          posterUrl: null,
          placeholderHue: 1,
          overview: 'x',
          runtime: null,
          genreIds: [],
          genres: [],
          rating: 7,
          voteCount: 1,
          providers: [],
        },
      ],
      'tr',
      'TR',
    );
    expect(movie!.runtime).toBe(111);
    expect(movie!.providers).toEqual([
      { id: 8, name: 'Netflix', logoUrl: 'https://image.tmdb.org/t/p/w92/n.png' },
    ]);
  });
});

describe('utilities', () => {
  it('limits concurrency', async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        limit(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 5));
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
  });

  it('expires cache entries', () => {
    let now = 0;
    const cache = new TtlCache<number>(100, 10, () => now);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    now = 101;
    expect(cache.get('a')).toBeUndefined();
  });

  it('prefers a real LAN address over virtual adapters', () => {
    const iface = (address: string, internal = false) => ({
      address,
      internal,
      family: 'IPv4' as const,
      netmask: '255.255.255.0',
      mac: '00:00:00:00:00:00',
      cidr: null,
    });
    expect(
      getLanIp({
        lo: [iface('127.0.0.1', true)],
        'vEthernet (WSL)': [iface('172.20.0.1')],
        'Wi-Fi': [iface('192.168.1.42')],
      }),
    ).toBe('192.168.1.42');
    expect(getLanIp({ lo: [iface('127.0.0.1', true)] })).toBeNull();
  });
});
