import { SWIPE_POINTS } from './constants';
import type { GameResults, Movie, RankedMovie, SwipeAction } from './types';

export interface ScoringPlayer {
  id: string;
  swipes: Readonly<Record<number, SwipeAction>>;
  vetoMovieId: number | null;
}

export interface ScoringInput {
  movies: readonly Movie[];
  players: readonly ScoringPlayer[];
}

/**
 * Ranking order: total score → number of people who liked it → number of super likes →
 * TMDB rating → movie id (ascending, so the result is fully deterministic).
 */
export function compareRanked(a: RankedMovie, b: RankedMovie): number {
  return (
    b.score - a.score ||
    b.likes - a.likes ||
    b.supers - a.supers ||
    b.movie.rating - a.movie.rating ||
    a.movie.id - b.movie.id
  );
}

/** Scores every non-vetoed movie and returns them sorted best-first. */
export function rankMovies({ movies, players }: ScoringInput): RankedMovie[] {
  const vetoed = new Set(
    players.map((p) => p.vetoMovieId).filter((id): id is number => id !== null),
  );
  const ranked: RankedMovie[] = [];
  for (const movie of movies) {
    if (vetoed.has(movie.id)) continue;
    let score = 0;
    let supers = 0;
    const likedBy: string[] = [];
    for (const player of players) {
      const action = player.swipes[movie.id];
      if (!action) continue;
      score += SWIPE_POINTS[action];
      if (action === 'like' || action === 'super') likedBy.push(player.id);
      if (action === 'super') supers++;
    }
    ranked.push({ movie, score, likes: likedBy.length, supers, likedBy });
  }
  return ranked.sort(compareRanked);
}

/** Highest TMDB rating first, ties broken by id. */
function bestRated(movies: readonly Movie[]): Movie | null {
  let best: Movie | null = null;
  for (const m of movies) {
    if (!best || m.rating > best.rating || (m.rating === best.rating && m.id < best.id)) best = m;
  }
  return best;
}

/**
 * Computes the final results.
 * - A "participant" is a player who swiped at least one card or used their veto.
 * - mode "match": at least one non-vetoed movie was liked by every participant; the best of
 *   those wins.
 * - mode "compromise": no unanimous movie, the best-scoring non-vetoed movie (score > 0) wins.
 * - mode "no-cinema": nothing scored; `alternative` is the best-rated non-vetoed movie.
 */
export function computeResults(input: ScoringInput): GameResults {
  const participants = input.players.filter(
    (p) => Object.keys(p.swipes).length > 0 || p.vetoMovieId !== null,
  ).length;
  const vetoCount = new Set(
    input.players.map((p) => p.vetoMovieId).filter((id): id is number => id !== null),
  ).size;
  const ranked = rankMovies(input);

  const unanimous = ranked.filter((r) => participants > 0 && r.likes === participants);
  let winner: RankedMovie | null = null;
  let mode: GameResults['mode'];

  if (unanimous.length > 0) {
    winner = unanimous[0]!;
    mode = 'match';
  } else if (ranked[0] && ranked[0].score > 0) {
    winner = ranked[0];
    mode = 'compromise';
  } else {
    mode = 'no-cinema';
  }

  const podium = ranked.filter((r) => r !== winner && r.score > 0).slice(0, 2);
  const alternative = mode === 'no-cinema' ? bestRated(ranked.map((r) => r.movie)) : null;

  return { mode, winner, podium, alternative, participants, vetoCount };
}
