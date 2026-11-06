import { useState } from 'react';
import type { TFunction } from 'i18next';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Movie, SwipeAction } from '@ortak-perde/shared';
import { Poster } from '../components/Poster';
import { getSwipeDecision, SWIPE_THRESHOLD } from './swipe';

export function formatRuntime(minutes: number | null, t: TFunction): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? t('movie.runtimeHM', { h, m }) : t('movie.runtimeM', { m });
}

export function genreLabels(movie: Movie, t: TFunction): string[] {
  return movie.genreIds
    .map((id, i) => t(`genres.${id}`, { defaultValue: movie.genres[i] ?? '' }))
    .filter(Boolean);
}

/** Exit animation per action; `custom` is supplied by AnimatePresence. */
export const cardVariants = {
  enter: { scale: 0.94, opacity: 0, y: 12 },
  center: { scale: 1, opacity: 1, y: 0, x: 0, rotate: 0 },
  exit: (action: SwipeAction | 'undo' | null) => ({
    x: action === 'like' ? 520 : action === 'nope' ? -520 : 0,
    y: action === 'super' ? -760 : 0,
    rotate: action === 'like' ? 18 : action === 'nope' ? -18 : 0,
    opacity: 0,
    transition: { duration: 0.28, ease: 'easeIn' as const },
  }),
};

function Stamp({ label, className, style }: { label: string; className: string; style: object }) {
  return (
    <motion.span
      aria-hidden="true"
      style={style}
      className={`pointer-events-none absolute z-20 rounded-xl border-4 px-3 py-1 font-display text-3xl font-extrabold uppercase tracking-wider ${className}`}
    >
      {label}
    </motion.span>
  );
}

/**
 * The top, draggable card. Releasing past the threshold calls onSwipe; otherwise it springs
 * back. Tapping (without dragging) toggles the plot summary.
 */
export function SwipeCard({
  movie,
  onSwipe,
  disabled,
}: {
  movie: Movie;
  onSwipe: (a: SwipeAction) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], reduce ? [0, 0] : [-14, 14]);
  const likeOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);
  const superOpacity = useTransform(y, [-SWIPE_THRESHOLD, -20], [1, 0]);

  const meta = [
    movie.year,
    formatRuntime(movie.runtime, t),
    movie.rating ? `★ ${movie.rating.toFixed(1)}` : null,
  ].filter(Boolean);

  return (
    <motion.article
      className="absolute inset-0 z-10 cursor-grab touch-none select-none overflow-hidden rounded-[1.75rem] bg-ink-800 shadow-card active:cursor-grabbing"
      style={{ x, y, rotate }}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      drag={!disabled}
      dragMomentum={false}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        const decision = getSwipeDecision(info.offset, info.velocity);
        if (decision) {
          onSwipe(decision);
        } else {
          void animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
          void animate(y, 0, { type: 'spring', stiffness: 500, damping: 30 });
        }
      }}
      onTap={() => setExpanded((e) => !e)}
      aria-label={movie.title}
      data-testid="swipe-card"
    >
      <Poster movie={movie} className="h-full w-full" eager showTitle={false} />

      <Stamp
        label={t('swipe.like')}
        className="left-5 top-8 -rotate-12 border-like text-like"
        style={{ opacity: likeOpacity }}
      />
      <Stamp
        label={t('swipe.nope')}
        className="right-5 top-8 rotate-12 border-nope text-nope"
        style={{ opacity: nopeOpacity }}
      />
      <Stamp
        label={t('swipe.super')}
        className="bottom-1/2 left-1/2 -translate-x-1/2 border-super text-super"
        style={{ opacity: superOpacity }}
      />

      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink-950 via-ink-950/85 to-transparent px-5 pb-5 pt-24">
        <h2 className="text-balance text-2xl font-extrabold leading-tight sm:text-3xl">
          {movie.title}
        </h2>
        {movie.originalTitle && movie.originalTitle !== movie.title && (
          <p className="truncate text-sm text-white/60">{movie.originalTitle}</p>
        )}
        <p className="mt-1 text-sm font-semibold text-mist">{meta.join(' · ')}</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {genreLabels(movie, t)
            .slice(0, 4)
            .map((g) => (
              <li key={g} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium">
                {g}
              </li>
            ))}
        </ul>
        {expanded ? (
          <p className="mt-3 line-clamp-[9] text-sm leading-relaxed text-white/90">
            {movie.overview || t('movie.noOverview')}
          </p>
        ) : (
          <p className="mt-2 text-xs text-white/50">{t('swipe.tapForPlot')}</p>
        )}
      </div>
    </motion.article>
  );
}
