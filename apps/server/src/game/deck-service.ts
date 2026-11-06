import {
  buildDeck,
  collectLikedGenres,
  createRng,
  shuffle,
  type DeckNotice,
  type DeckPlayer,
  type Locale,
  type Movie,
  type RoomSettings,
} from '@ortak-perde/shared';
import type { MovieCatalog } from '../catalog/types';

export interface CreateDeckInput {
  players: DeckPlayer[];
  settings: RoomSettings;
  locale: Locale;
  seenIds: ReadonlySet<number>;
  /** Seed for variety between rounds (room code + round). */
  seed: string;
}

export interface CreateDeckResult {
  movies: Movie[];
  notices: DeckNotice[];
  catalogMode: MovieCatalog['mode'];
}

export class NoMoviesError extends Error {
  constructor() {
    super('No movies matched the filters');
    this.name = 'NoMoviesError';
  }
}

/** Pages fetched per genre: popularity-sorted, then shuffled per round for variety. */
const PAGES_PER_GENRE = 2;

async function gather(
  catalog: MovieCatalog,
  input: CreateDeckInput,
): Promise<{ byGenre: Map<number, Movie[]>; general: Movie[] }> {
  const genres = collectLikedGenres(input.players);
  const fetchPool = async (genreId: number | null) => {
    const pages = await Promise.all(
      Array.from({ length: PAGES_PER_GENRE }, (_, i) =>
        catalog.discover({ genreId, settings: input.settings, locale: input.locale, page: i + 1 }),
      ),
    );
    const unique = new Map<number, Movie>();
    for (const m of pages.flat()) if (!unique.has(m.id)) unique.set(m.id, m);
    return shuffle([...unique.values()], createRng(`${input.seed}:${genreId ?? 'any'}`));
  };
  const [general, ...lists] = await Promise.all([
    fetchPool(null),
    ...genres.map((g) => fetchPool(g)),
  ]);
  return { byGenre: new Map(genres.map((g, i) => [g, lists[i] ?? []])), general: general ?? [] };
}

/**
 * Builds a deck: fetches candidates for every liked genre (plus a general pool), runs the
 * shared round-robin deck builder and enriches the chosen movies with details.
 * Falls back to the sample catalog if the primary catalog fails.
 */
export async function createDeck(
  primary: MovieCatalog,
  fallback: MovieCatalog | null,
  input: CreateDeckInput,
  onFallback?: (err: unknown) => void,
): Promise<CreateDeckResult> {
  const notices: DeckNotice[] = [];
  let catalog = primary;
  let pools: Awaited<ReturnType<typeof gather>>;
  try {
    pools = await gather(primary, input);
  } catch (err) {
    if (!fallback || fallback === primary) throw err;
    onFallback?.(err);
    catalog = fallback;
    notices.push({ code: 'sample-fallback' });
    pools = await gather(fallback, input);
  }

  const built = buildDeck({
    players: input.players,
    byGenre: pools.byGenre,
    general: pools.general,
    deckSize: input.settings.deckSize,
    seenIds: input.seenIds,
  });
  if (built.movies.length === 0) throw new NoMoviesError();

  if (built.relaxed) notices.push({ code: 'relaxed-dislikes' });
  if (built.movies.length < input.settings.deckSize) {
    notices.push({ code: 'short-deck', value: built.movies.length });
  }
  if (catalog.mode === 'sample' && input.settings.providerIds.length > 0) {
    notices.push({ code: 'providers-ignored' });
  }

  const movies = await catalog.enrich(built.movies, input.locale, input.settings.region);
  return { movies, notices, catalogMode: catalog.mode };
}
