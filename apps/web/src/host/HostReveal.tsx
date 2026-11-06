import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { GameResults, PlayerPublic } from '@ortak-perde/shared';
import { Confetti } from '../components/Confetti';
import { Poster } from '../components/Poster';

const COUNTDOWN_FROM = 5;

/**
 * REVEALING: 5-4-3-2-1 countdown, then the winning poster grows in under a spotlight.
 * Timing is local (setTimeout), so client/server clock skew doesn't matter; the server
 * moves on to RESULTS after REVEAL_DURATION_MS (8 s), which covers countdown + reveal.
 */
export function HostReveal({ results }: { results: GameResults; players: PlayerPublic[] }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [count, setCount] = useState(COUNTDOWN_FROM);

  useEffect(() => {
    if (count <= 0) return;
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count]);

  const movie = results.winner?.movie ?? results.alternative;

  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center gap-8"
      aria-live="assertive"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-[-10%] mx-auto h-[120%] w-[60%] rounded-[50%] bg-[radial-gradient(ellipse_at_top,rgba(242,193,78,0.25),transparent_65%)]"
        aria-hidden="true"
      />
      {count > 0 ? (
        <>
          <p className="text-3xl font-semibold text-mist">{t('reveal.drumroll')}</p>
          <AnimatePresence mode="popLayout">
            <motion.span
              key={count}
              initial={reduce ? false : { scale: 2.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? undefined : { scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="font-display text-[14rem] font-extrabold leading-none text-spot drop-shadow-[0_0_60px_rgba(242,193,78,0.45)]"
            >
              {count}
            </motion.span>
          </AnimatePresence>
        </>
      ) : (
        <>
          {results.mode !== 'no-cinema' && <Confetti />}
          {results.mode === 'compromise' && (
            <span className="rounded-full bg-spot/15 px-5 py-2 text-xl font-bold text-spot">
              {t('reveal.compromise')}
            </span>
          )}
          {results.mode === 'no-cinema' ? (
            <motion.div
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <span className="text-9xl" aria-hidden="true">
                🌙
              </span>
              <h1 className="mt-6 text-6xl font-extrabold">{t('results.noCinemaTitle')}</h1>
            </motion.div>
          ) : (
            movie && (
              <motion.div
                initial={reduce ? false : { scale: 0.25, opacity: 0, rotate: -4 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                className="flex flex-col items-center gap-6"
              >
                <Poster
                  movie={movie}
                  eager
                  className="aspect-[2/3] h-[52vh] rounded-3xl shadow-glow ring-4 ring-spot/60"
                />
                <h1 className="text-balance text-center text-6xl font-extrabold">{movie.title}</h1>
              </motion.div>
            )
          )}
        </>
      )}
    </div>
  );
}
