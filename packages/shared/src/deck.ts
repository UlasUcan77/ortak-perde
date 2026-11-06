import { createRng, shuffle } from './random';
import type { GenrePreference, Movie } from './types';

export interface DeckPlayer {
  id: string;
  preference: GenrePreference;
}

export interface BuildDeckInput {
  players: readonly DeckPlayer[];
  /** Candidate movies per genre id, best first. */
  byGenre: ReadonlyMap<number, readonly Movie[]>;
  /** General pool (used for "any genre" players and as filler), best first. */
  general: readonly Movie[];
  deckSize: number;
  /** Movies shown in earlier rounds; only used when nothing else is left. */
  seenIds?: ReadonlySet<number>;
}

export interface BuildDeckResult {
  movies: Movie[];
  /** True when disliked genres had to be let back in to reach half of the deck size. */
  relaxed: boolean;
  /** Union of every player's disliked genres. */
  dislikedGenres: number[];
  /** How many cards each player's taste contributed (for fairness tests / debugging). */
  contributed: Record<string, number>;
}

const GENERAL = -1;

/** Union of all players' disliked genres. */
export function collectDislikedGenres(players: readonly DeckPlayer[]): number[] {
  const set = new Set<number>();
  for (const p of players) for (const g of p.preference.disliked) set.add(g);
  return [...set].sort((a, b) => a - b);
}

/** Genres any player wants (the server fetches candidates for these). */
export function collectLikedGenres(players: readonly DeckPlayer[]): number[] {
  const set = new Set<number>();
  for (const p of players) for (const g of p.preference.liked) set.add(g);
  return [...set].sort((a, b) => a - b);
}

export function wantsGeneralPool(players: readonly DeckPlayer[]): boolean {
  return players.some((p) => p.preference.any || p.preference.liked.length === 0);
}

/**
 * Builds one shared deck by round-robin over players: each turn a player contributes the next
 * unused movie from one of their liked genres (cycling through their genres). Duplicates are
 * removed. Movies with any genre someone disliked are excluded, unless fewer than half of the
 * deck size would remain — then the rule is relaxed (and `relaxed` is reported).
 *
 * Passes, in order, until the deck is full:
 *  1. players' genres, unseen, no disliked genres
 *  2. players' genres, previously seen allowed
 *  3. general pool filler, no disliked genres
 *  4. (only if still below half) anything, disliked genres allowed → relaxed
 */
export function buildDeck(input: BuildDeckInput): BuildDeckResult {
  const { players, byGenre, general, deckSize } = input;
  const seen = input.seenIds ?? new Set<number>();
  const dislikedGenres = collectDislikedGenres(players);
  const disliked = new Set(dislikedGenres);

  const deck: Movie[] = [];
  const used = new Set<number>();
  const contributed: Record<string, number> = Object.fromEntries(players.map((p) => [p.id, 0]));

  const sourcesFor = (p: DeckPlayer): number[] => {
    const genres = p.preference.liked.filter((g) => (byGenre.get(g)?.length ?? 0) > 0);
    if (p.preference.any || genres.length === 0) genres.push(GENERAL);
    return genres;
  };
  const listFor = (source: number): readonly Movie[] =>
    source === GENERAL ? general : (byGenre.get(source) ?? []);

  const hasDisliked = (m: Movie) => m.genreIds.some((g) => disliked.has(g));

  interface PassOptions {
    allowSeen: boolean;
    allowDisliked: boolean;
    generalOnly: boolean;
  }

  const runPass = (opts: PassOptions) => {
    const accepts = (m: Movie) =>
      !used.has(m.id) &&
      (opts.allowSeen || !seen.has(m.id)) &&
      (opts.allowDisliked || !hasDisliked(m));

    const state = players.map((p) => ({
      player: p,
      sources: opts.generalOnly ? [GENERAL] : sourcesFor(p),
      turn: 0,
      exhausted: false,
    }));
    if (state.length === 0)
      state.push({
        player: { id: '', preference: { liked: [], any: true, disliked: [] } },
        sources: [GENERAL],
        turn: 0,
        exhausted: false,
      });

    while (deck.length < deckSize && state.some((s) => !s.exhausted)) {
      for (const s of state) {
        if (deck.length >= deckSize) break;
        if (s.exhausted) continue;
        let picked: Movie | undefined;
        for (let tries = 0; tries < s.sources.length && !picked; tries++) {
          const source = s.sources[s.turn % s.sources.length]!;
          s.turn++;
          picked = listFor(source).find(accepts);
        }
        if (!picked) {
          s.exhausted = true;
          continue;
        }
        deck.push(picked);
        used.add(picked.id);
        if (s.player.id) contributed[s.player.id] = (contributed[s.player.id] ?? 0) + 1;
      }
    }
  };

  runPass({ allowSeen: false, allowDisliked: false, generalOnly: false });
  if (deck.length < deckSize)
    runPass({ allowSeen: true, allowDisliked: false, generalOnly: false });
  if (deck.length < deckSize)
    runPass({ allowSeen: false, allowDisliked: false, generalOnly: true });
  if (deck.length < deckSize) runPass({ allowSeen: true, allowDisliked: false, generalOnly: true });

  let relaxed = false;
  if (deck.length < Math.ceil(deckSize / 2) && disliked.size > 0) {
    const before = deck.length;
    runPass({ allowSeen: true, allowDisliked: true, generalOnly: false });
    if (deck.length < deckSize)
      runPass({ allowSeen: true, allowDisliked: true, generalOnly: true });
    relaxed = deck.length > before;
  }

  return { movies: deck, relaxed, dislikedGenres, contributed };
}

/** Deterministic per-player card order: everyone gets the same movies in a different order. */
export function personalOrder(movieIds: readonly number[], seed: string): number[] {
  return shuffle(movieIds, createRng(seed));
}
