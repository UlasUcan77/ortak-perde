import { describe, expect, it } from 'vitest';
import { computeResults, rankMovies } from './scoring';
import { makeMovie } from './test-utils';
import type { SwipeAction } from './types';

const player = (
  id: string,
  swipes: Record<number, SwipeAction>,
  vetoMovieId: number | null = null,
) => ({ id, swipes, vetoMovieId });

describe('rankMovies', () => {
  it('scores like=1, super=2, nope=0', () => {
    const movies = [makeMovie(1), makeMovie(2), makeMovie(3)];
    const ranked = rankMovies({
      movies,
      players: [
        player('a', { 1: 'like', 2: 'super', 3: 'nope' }),
        player('b', { 1: 'like', 2: 'nope', 3: 'nope' }),
      ],
    });
    const byId = Object.fromEntries(ranked.map((r) => [r.movie.id, r]));
    expect(byId[1]).toMatchObject({ score: 2, likes: 2, supers: 0, likedBy: ['a', 'b'] });
    expect(byId[2]).toMatchObject({ score: 2, likes: 1, supers: 1, likedBy: ['a'] });
    expect(byId[3]).toMatchObject({ score: 0, likes: 0, supers: 0, likedBy: [] });
  });

  it('breaks ties by likes, then supers, then TMDB rating, then id', () => {
    const movies = [
      makeMovie(10, { rating: 7 }), // score 2, 2 likes
      makeMovie(11, { rating: 9 }), // score 2, 1 like (super)
      makeMovie(12, { rating: 8 }), // score 1
      makeMovie(13, { rating: 8 }), // score 1 — same rating as 12, higher id
      makeMovie(14, { rating: 6 }), // score 1, lower rating
    ];
    const ranked = rankMovies({
      movies,
      players: [
        player('a', { 10: 'like', 11: 'super', 12: 'like', 13: 'nope', 14: 'nope' }),
        player('b', { 10: 'like', 11: 'nope', 12: 'nope', 13: 'like', 14: 'like' }),
      ],
    });
    expect(ranked.map((r) => r.movie.id)).toEqual([10, 11, 12, 13, 14]);
  });

  it('super-like count breaks a tie between equal score and equal likes', () => {
    const movies = [makeMovie(1, { rating: 9 }), makeMovie(2, { rating: 1 })];
    // movie 1: like + like + nope = 2 (2 likes, 0 super)
    // movie 2: super + nope + nope = 2 (1 like) → loses on likes
    // add a third case: equal score & likes, supers differ
    const m3 = makeMovie(3, { rating: 1 });
    const m4 = makeMovie(4, { rating: 9 });
    const ranked = rankMovies({
      movies: [...movies, m3, m4],
      players: [
        player('a', { 1: 'like', 2: 'super', 3: 'super', 4: 'like' }),
        player('b', { 1: 'like', 2: 'nope', 3: 'like', 4: 'like' }),
        player('c', { 1: 'nope', 2: 'nope', 3: 'nope', 4: 'like' }),
      ],
    });
    // m3: 3 points, 2 likes, 1 super; m4: 3 points, 3 likes → m4 first (likes), then m3
    expect(ranked.map((r) => r.movie.id)).toEqual([4, 3, 1, 2]);
  });

  it('is deterministic regardless of input order', () => {
    const movies = [makeMovie(5), makeMovie(3), makeMovie(4)];
    const players = [player('a', { 3: 'like', 4: 'like', 5: 'like' })];
    const a = rankMovies({ movies, players }).map((r) => r.movie.id);
    const b = rankMovies({ movies: [...movies].reverse(), players }).map((r) => r.movie.id);
    expect(a).toEqual([3, 4, 5]);
    expect(b).toEqual(a);
  });

  it('removes vetoed movies', () => {
    const ranked = rankMovies({
      movies: [makeMovie(1), makeMovie(2)],
      players: [player('a', { 1: 'super', 2: 'like' }), player('b', { 1: 'super' }, 1)],
    });
    expect(ranked.map((r) => r.movie.id)).toEqual([2]);
  });
});

describe('computeResults', () => {
  it('picks a unanimous movie as a match, preferring it over a higher-scoring split movie', () => {
    const movies = [makeMovie(1), makeMovie(2)];
    const results = computeResults({
      movies,
      players: [
        player('a', { 1: 'super', 2: 'like' }),
        player('b', { 1: 'super', 2: 'like' }),
        player('c', { 1: 'nope', 2: 'like' }),
      ],
    });
    expect(results.mode).toBe('match');
    expect(results.winner?.movie.id).toBe(2);
    expect(results.podium.map((r) => r.movie.id)).toEqual([1]);
    expect(results.participants).toBe(3);
  });

  it('a vetoed movie can never win, even when everyone else loved it', () => {
    const results = computeResults({
      movies: [makeMovie(1), makeMovie(2)],
      players: [
        player('a', { 1: 'super', 2: 'like' }),
        player('b', { 1: 'super', 2: 'like' }),
        player('c', { 1: 'nope', 2: 'like' }, 1),
      ],
    });
    expect(results.winner?.movie.id).toBe(2);
    expect(results.mode).toBe('match');
    expect(results.vetoCount).toBe(1);
  });

  it('falls back to compromise mode when no movie is liked by everyone', () => {
    const results = computeResults({
      movies: [makeMovie(1), makeMovie(2), makeMovie(3)],
      players: [
        player('a', { 1: 'super', 2: 'nope', 3: 'like' }),
        player('b', { 1: 'nope', 2: 'like', 3: 'nope' }),
      ],
    });
    expect(results.mode).toBe('compromise');
    expect(results.winner?.movie.id).toBe(1);
    expect(results.podium.map((r) => r.movie.id)).toEqual([2, 3]);
  });

  it('reports no-cinema when nobody liked anything and offers the best-rated alternative', () => {
    const results = computeResults({
      movies: [
        makeMovie(1, { rating: 7 }),
        makeMovie(2, { rating: 8.5 }),
        makeMovie(3, { rating: 9 }),
      ],
      players: [
        player('a', { 1: 'nope', 2: 'nope', 3: 'nope' }, 3),
        player('b', { 1: 'nope', 2: 'nope', 3: 'nope' }),
      ],
    });
    expect(results.mode).toBe('no-cinema');
    expect(results.winner).toBeNull();
    expect(results.podium).toEqual([]);
    // movie 3 is rated higher but vetoed
    expect(results.alternative?.id).toBe(2);
  });

  it('handles everything vetoed', () => {
    const results = computeResults({
      movies: [makeMovie(1)],
      players: [player('a', { 1: 'like' }, 1), player('b', { 1: 'like' })],
    });
    expect(results.mode).toBe('no-cinema');
    expect(results.alternative).toBeNull();
  });

  it('only counts players who took part when checking unanimity', () => {
    const results = computeResults({
      movies: [makeMovie(1), makeMovie(2)],
      players: [
        player('a', { 1: 'like', 2: 'nope' }),
        player('b', { 1: 'like' }),
        player('idle', {}),
      ],
    });
    expect(results.participants).toBe(2);
    expect(results.mode).toBe('match');
    expect(results.winner?.movie.id).toBe(1);
  });

  it('with no participants at all it is a no-cinema night', () => {
    const results = computeResults({
      movies: [makeMovie(1)],
      players: [player('a', {}), player('b', {})],
    });
    expect(results.mode).toBe('no-cinema');
    expect(results.alternative?.id).toBe(1);
  });
});
