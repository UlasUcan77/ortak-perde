import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { PlayerPublic } from '@ortak-perde/shared';

export function AvatarBubble({
  player,
  size = 'md',
}: {
  player: Pick<PlayerPublic, 'avatar' | 'name'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls = { sm: 'h-9 w-9 text-xl', md: 'h-14 w-14 text-3xl', lg: 'h-20 w-20 text-5xl' }[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ink-600 to-ink-700 ring-2 ring-white/10 ${cls}`}
      title={player.name}
      aria-hidden="true"
    >
      {player.avatar}
    </span>
  );
}

/** Live roster for the host screen; players pop in as they join. */
export function PlayerGrid({
  players,
  renderStatus,
}: {
  players: PlayerPublic[];
  renderStatus?: (p: PlayerPublic) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  return (
    <ul className="grid grid-cols-2 gap-3 xl:grid-cols-3" aria-live="polite">
      <AnimatePresence initial={false}>
        {players.map((p) => (
          <motion.li
            key={p.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-800/80 p-3 ${
              p.connected ? '' : 'opacity-50'
            }`}
          >
            <AvatarBubble player={p} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-bold">{p.name}</p>
              {!p.connected && <p className="text-sm text-nope">{t('common.offline')}</p>}
              {renderStatus?.(p)}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-3 w-full overflow-hidden rounded-full bg-white/10"
    >
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-velvet to-spot"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  );
}
