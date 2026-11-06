import { describe, expect, it } from 'vitest';
import { buildDeck, personalOrder, type DeckPlayer } from './deck';
import { makeMovie } from './test-utils';
import type { Movie } from './types';

const ACTION = 28;
const COMEDY = 35;
const HORROR = 27;
const DRAMA = 18;

function range(start: number, count: number, genreIds: number[]): Movie[] {
  return Array.from({ length: count }, (_, i) => makeMovie(start + i, { genreIds }));
}

const p = (id: string, liked: number[], disliked: number[] = [], any = false): DeckPlayer => ({
  id,
  preference: { liked, disliked, any },
});

describe('buildDeck', () => {
  it('balances the deck equally between players', () => {
    const byGenre = new Map([
      [ACTION, range(100, 30, [ACTION])],
      [COMEDY, range(200, 30, [COMEDY])],
    ]);
    const res = buildDeck({
      players: [p('a', [ACTION]), p('b', [COMEDY])],
      byGenre,
      general: [],
      deckSize: 10,
    });
    expect(res.movies).toHaveLength(10);
    expect(res.contributed).toEqual({ a: 5, b: 5 });
    expect(res.movies.filter((m) => m.genreIds.includes(ACTION))).toHaveLength(5);
    expect(res.relaxed).toBe(false);
  });

  it('cycles through each player’s multiple genres', () => {
    const byGenre = new Map([
      [ACTION, range(100, 30, [ACTION])],
      [COMEDY, range(200, 30, [COMEDY])],
      [DRAMA, range(300, 30, [DRAMA])],
    ]);
    const res = buildDeck({
      players: [p('a', [ACTION, DRAMA]), p('b', [COMEDY])],
      byGenre,
      general: [],
      deckSize: 8,
    });
    const count = (g: number) => res.movies.filter((m) => m.genreIds.includes(g)).length;
    expect(res.contributed).toEqual({ a: 4, b: 4 });
    expect(count(ACTION)).toBe(2);
    expect(count(DRAMA)).toBe(2);
    expect(count(COMEDY)).toBe(4);
  });

  it('never contains duplicates, even when genres overlap', () => {
    const shared = range(1, 10, [ACTION, COMEDY]);
    const res = buildDeck({
      players: [p('a', [ACTION]), p('b', [COMEDY])],
      byGenre: new Map([
        [ACTION, shared],
        [COMEDY, shared],
      ]),
      general: [],
      deckSize: 10,
    });
    const ids = res.movies.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(10);
  });

  it('removes movies of genres anybody disliked', () => {
    const actionHorror = range(100, 10, [ACTION, HORROR]);
    const actionOnly = range(200, 20, [ACTION]);
    const res = buildDeck({
      players: [p('a', [ACTION]), p('b', [], [HORROR], true)],
      byGenre: new Map([[ACTION, [...actionHorror, ...actionOnly]]]),
      general: [...actionHorror, ...range(300, 20, [COMEDY])],
      deckSize: 10,
    });
    expect(res.movies).toHaveLength(10);
    expect(res.movies.some((m) => m.genreIds.includes(HORROR))).toBe(false);
    expect(res.relaxed).toBe(false);
    expect(res.dislikedGenres).toEqual([HORROR]);
  });

  it('relaxes the dislike rule when fewer than half the deck would remain', () => {
    const horrorComedies = range(100, 20, [HORROR, COMEDY]);
    const res = buildDeck({
      players: [p('a', [HORROR]), p('b', [COMEDY], [HORROR])],
      byGenre: new Map([
        [HORROR, horrorComedies],
        [COMEDY, [...horrorComedies, ...range(200, 3, [COMEDY])]],
      ]),
      general: [],
      deckSize: 10,
    });
    expect(res.relaxed).toBe(true);
    expect(res.movies).toHaveLength(10);
    // the 3 "clean" comedies are still included
    expect(res.movies.filter((m) => !m.genreIds.includes(HORROR))).toHaveLength(3);
  });

  it('keeps the rule (shorter deck) when at least half remains', () => {
    const res = buildDeck({
      players: [p('a', [COMEDY], [HORROR])],
      byGenre: new Map([[COMEDY, [...range(1, 6, [COMEDY]), ...range(50, 10, [COMEDY, HORROR])]]]),
      general: [],
      deckSize: 10,
    });
    expect(res.relaxed).toBe(false);
    expect(res.movies).toHaveLength(6);
  });

  it('fills from the general pool for "any genre" players and as filler', () => {
    const res = buildDeck({
      players: [p('a', [], [], true), p('b', [ACTION])],
      byGenre: new Map([[ACTION, range(100, 2, [ACTION])]]),
      general: range(500, 20, [DRAMA]),
      deckSize: 10,
    });
    expect(res.movies).toHaveLength(10);
    expect(res.movies.filter((m) => m.genreIds.includes(ACTION))).toHaveLength(2);
  });

  it('prefers unseen movies, reusing seen ones only when needed', () => {
    const movies = range(1, 12, [ACTION]);
    const seenIds = new Set([1, 2, 3, 4, 5, 6]);
    const full = buildDeck({
      players: [p('a', [ACTION])],
      byGenre: new Map([[ACTION, movies]]),
      general: [],
      deckSize: 6,
      seenIds,
    });
    expect(full.movies.map((m) => m.id)).toEqual([7, 8, 9, 10, 11, 12]);

    const needMore = buildDeck({
      players: [p('a', [ACTION])],
      byGenre: new Map([[ACTION, movies]]),
      general: [],
      deckSize: 10,
      seenIds,
    });
    expect(needMore.movies).toHaveLength(10);
  });
});

describe('personalOrder', () => {
  it('is a deterministic permutation per seed', () => {
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    const a1 = personalOrder(ids, 'ROOM:a:1');
    const a2 = personalOrder(ids, 'ROOM:a:1');
    const b = personalOrder(ids, 'ROOM:b:1');
    expect(a1).toEqual(a2);
    expect([...a1].sort((x, y) => x - y)).toEqual(ids);
    expect(b).not.toEqual(a1);
  });
});
