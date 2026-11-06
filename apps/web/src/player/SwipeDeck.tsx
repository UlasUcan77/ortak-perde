import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Movie, PlayerView, SwipeAction } from '@ortak-perde/shared';
import { Poster } from '../components/Poster';
import { preloadImages, vibrate } from '../lib/device';
import { emitAck } from '../lib/socket';
import { keyToAction } from './swipe';
import { SwipeCard } from './SwipeCard';

const PRELOAD_AHEAD = 3;

/**
 * Card stack for the SWIPING phase. Swipes are applied optimistically: the card leaves at once
 * and comes back only if the server rejects it. The server state stays the source of truth
 * (after a reconnect the deck continues where the server says).
 */
export function SwipeDeck({ view, movies }: { view: PlayerView; movies: Movie[] }) {
  const { t } = useTranslation();
  const { me } = view;
  const byId = useMemo(() => new Map(movies.map((m) => [m.id, m])), [movies]);
  const [pending, setPending] = useState<Set<number>>(() => new Set());
  const [lastAction, setLastAction] = useState<SwipeAction | 'undo' | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [vetoConfirm, setVetoConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drop optimistic entries once the server has recorded them.
  useEffect(() => {
    setPending((prev) => {
      const next = new Set([...prev].filter((id) => !me.swipes[id]));
      return next.size === prev.size ? prev : next;
    });
  }, [me.swipes]);

  const remaining = me.order.filter((id) => !me.swipes[id] && !pending.has(id));
  const current = remaining[0] !== undefined ? byId.get(remaining[0]) : undefined;
  const upcoming = remaining
    .slice(1, 3)
    .map((id) => byId.get(id))
    .filter((m): m is Movie => !!m);
  const done = me.order.length - remaining.length;
  const vetoUsed = me.vetoMovieId !== null;

  useEffect(() => {
    preloadImages(remaining.slice(1, 1 + PRELOAD_AHEAD).map((id) => byId.get(id)?.posterUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining[0], byId]);

  const send = useCallback(
    async (movieId: number, action: SwipeAction, veto = false) => {
      setLastAction(action);
      setPending((p) => new Set(p).add(movieId));
      setError(null);
      vibrate(action === 'super' ? [10, 40, 10] : veto ? [30, 30, 30] : 12);
      const res = veto
        ? await emitAck('player:veto', { movieId })
        : await emitAck('player:swipe', { movieId, action });
      if (!res.ok && res.error !== 'ALREADY_SWIPED') {
        setPending((p) => {
          const next = new Set(p);
          next.delete(movieId);
          return next;
        });
        setError(t(`errors.${res.error}`));
      }
    },
    [t],
  );

  const swipe = useCallback(
    (action: SwipeAction) => {
      if (current) void send(current.id, action);
    },
    [current, send],
  );

  const undo = useCallback(async () => {
    if (!me.canUndo || pending.size > 0 || undoBusy) return;
    setUndoBusy(true);
    setLastAction('undo');
    const res = await emitAck('player:undo');
    setUndoBusy(false);
    if (!res.ok) setError(t(`errors.${res.error}`));
  }, [me.canUndo, pending.size, undoBusy, t]);

  const veto = () => {
    if (!current || vetoUsed) return;
    if (!vetoConfirm) {
      setVetoConfirm(true);
      return;
    }
    setVetoConfirm(false);
    void send(current.id, 'nope', true);
  };

  useEffect(() => setVetoConfirm(false), [current?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const action = keyToAction(e.key);
      if (!action) return;
      e.preventDefault();
      if (action === 'undo') void undo();
      else swipe(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [swipe, undo]);

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="flex items-center justify-between gap-2 pb-2">
        <button
          type="button"
          className="btn-ghost min-h-10 px-3 py-1.5 text-sm"
          onClick={() => void undo()}
          disabled={!me.canUndo || pending.size > 0 || undoBusy}
          aria-label={t('swipe.undo')}
        >
          ↶ {t('swipe.undo')}
        </button>
        <p className="font-display text-lg font-bold" aria-live="polite">
          {t('swipe.progress', {
            done: Math.min(done + 1, me.order.length),
            total: me.order.length,
          })}
        </p>
        <span className={`text-sm ${vetoUsed ? 'text-white/40' : 'text-nope'}`}>
          🚫 {vetoUsed ? t('swipe.vetoUsed') : t('swipe.vetoLeft')}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div
          className="h-full bg-gradient-to-r from-velvet to-spot transition-all"
          style={{ width: `${me.order.length ? (done / me.order.length) * 100 : 0}%` }}
        />
      </div>

      <div className="relative my-3 min-h-0 flex-1">
        {upcoming
          .slice()
          .reverse()
          .map((m, i, arr) => {
            const depth = arr.length - i;
            return (
              <div
                key={m.id}
                aria-hidden="true"
                className="absolute inset-0 overflow-hidden rounded-[1.75rem] shadow-card transition-transform duration-300"
                style={{
                  transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`,
                  opacity: 1 - depth * 0.25,
                }}
              >
                <Poster movie={m} className="h-full w-full" showTitle={false} />
              </div>
            );
          })}
        <AnimatePresence custom={lastAction} initial={false}>
          {current && <SwipeCard key={current.id} movie={current} onSwipe={swipe} />}
        </AnimatePresence>
        {!current && <div className="skeleton absolute inset-0 rounded-[1.75rem]" />}
      </div>

      {error && (
        <p role="alert" className="pb-2 text-center text-sm text-nope">
          {error}
        </p>
      )}

      <div
        className="grid grid-cols-4 items-center gap-2"
        role="group"
        aria-label={t('swipe.actions')}
      >
        <ActionButton
          label={t('swipe.nopeAction')}
          onClick={() => swipe('nope')}
          disabled={!current}
          className="text-nope"
        >
          ✕
        </ActionButton>
        <ActionButton
          label={t('swipe.superAction')}
          onClick={() => swipe('super')}
          disabled={!current}
          className="text-super"
        >
          ★
        </ActionButton>
        <ActionButton
          label={t('swipe.likeAction')}
          onClick={() => swipe('like')}
          disabled={!current}
          className="text-like"
        >
          ♥
        </ActionButton>
        <button
          type="button"
          onClick={veto}
          disabled={!current || vetoUsed}
          aria-label={t('swipe.vetoAction')}
          className={`flex h-16 flex-col items-center justify-center rounded-2xl border text-xs font-extrabold uppercase tracking-wider transition active:scale-95 disabled:opacity-30 ${
            vetoConfirm ? 'border-nope bg-nope text-white' : 'border-nope/50 bg-nope/10 text-nope'
          }`}
        >
          <span className="text-xl" aria-hidden="true">
            🚫
          </span>
          {vetoConfirm ? t('swipe.vetoConfirm') : t('swipe.veto')}
        </button>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-16 items-center justify-center rounded-2xl border border-white/10 bg-ink-800 text-3xl font-bold shadow-card transition active:scale-90 disabled:opacity-30 ${className}`}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
