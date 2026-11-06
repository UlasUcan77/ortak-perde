import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  defaultSettings,
  type Movie,
  type PlayerView,
  type SwipeAction,
} from '@ortak-perde/shared';
import { SwipeDeck } from './SwipeDeck';

const emitAck = vi.fn();
vi.mock('../lib/socket', () => ({ emitAck: (...args: unknown[]) => emitAck(...args) }));

const movie = (id: number, title: string): Movie => ({
  id,
  title,
  originalTitle: title,
  year: 2001,
  posterUrl: null,
  placeholderHue: 100,
  overview: `${title} overview`,
  runtime: 95,
  genreIds: [35],
  genres: ['Komedi'],
  rating: 7.5,
  voteCount: 1000,
  providers: [],
});

const movies = [movie(1, 'Birinci'), movie(2, 'İkinci'), movie(3, 'Üçüncü')];

function view(
  swipes: Record<number, SwipeAction> = {},
  extra: Partial<PlayerView['me']> = {},
): PlayerView {
  return {
    role: 'player',
    code: 'ABCD',
    phase: 'SWIPING',
    round: 1,
    players: [],
    settings: defaultSettings(),
    deckLength: 3,
    catalogMode: 'sample',
    notices: [],
    hostConnected: true,
    results: null,
    me: {
      id: 'p1',
      name: 'Ayşe',
      avatar: '🦊',
      preference: { liked: [35], any: false, disliked: [] },
      ready: true,
      order: [2, 1, 3],
      swipes,
      vetoMovieId: null,
      canUndo: false,
      finished: false,
      ...extra,
    },
  };
}

beforeEach(() => {
  emitAck.mockReset();
  emitAck.mockResolvedValue({ ok: true, data: null });
});

describe('SwipeDeck', () => {
  it('shows the first card of the personal order with its details', () => {
    render(<SwipeDeck view={view()} movies={movies} />);
    expect(screen.getByTestId('swipe-card')).toHaveAccessibleName('İkinci');
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText('Komedi')).toBeInTheDocument();
  });

  it('buttons send swipes and advance optimistically', async () => {
    render(<SwipeDeck view={view()} movies={movies} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Beğen \(sağa/ }));
    });
    expect(emitAck).toHaveBeenCalledWith('player:swipe', { movieId: 2, action: 'like' });
    expect(screen.getAllByTestId('swipe-card').at(-1)).toHaveAccessibleName('Birinci');
  });

  it('arrow keys work too', async () => {
    render(<SwipeDeck view={view()} movies={movies} />);
    await act(async () => {
      fireEvent.keyDown(window, { key: 'ArrowUp' });
    });
    expect(emitAck).toHaveBeenCalledWith('player:swipe', { movieId: 2, action: 'super' });
  });

  it('brings the card back when the server rejects the swipe', async () => {
    emitAck.mockResolvedValueOnce({ ok: false, error: 'WRONG_PHASE' });
    render(<SwipeDeck view={view()} movies={movies} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Geç \(sola/ }));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu işlem şu an yapılamıyor.');
    expect(screen.getAllByTestId('swipe-card').at(-1)).toHaveAccessibleName('İkinci');
  });

  it('veto needs a confirmation tap and is single-use', async () => {
    const { rerender } = render(<SwipeDeck view={view()} movies={movies} />);
    const veto = screen.getByRole('button', { name: /^Asla/ });
    fireEvent.click(veto);
    expect(emitAck).not.toHaveBeenCalled();
    expect(veto).toHaveTextContent('Emin misin?');
    await act(async () => {
      fireEvent.click(veto);
    });
    expect(emitAck).toHaveBeenCalledWith('player:veto', { movieId: 2 });
    rerender(<SwipeDeck view={view({ 2: 'nope' }, { vetoMovieId: 2 })} movies={movies} />);
    expect(screen.getByRole('button', { name: /^Asla/ })).toBeDisabled();
  });

  it('undo is only enabled when the server allows it', async () => {
    const { rerender } = render(<SwipeDeck view={view()} movies={movies} />);
    expect(screen.getByRole('button', { name: 'Geri al' })).toBeDisabled();
    rerender(<SwipeDeck view={view({ 2: 'like' }, { canUndo: true })} movies={movies} />);
    const undo = screen.getByRole('button', { name: 'Geri al' });
    expect(undo).toBeEnabled();
    await act(async () => {
      fireEvent.click(undo);
    });
    expect(emitAck).toHaveBeenCalledWith('player:undo');
  });
});
