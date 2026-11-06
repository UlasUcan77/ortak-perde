import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { ConnectionStatus } from '../lib/useRoomSocket';

/** Banner shown while the socket is reconnecting (e.g. phone was locked, Wi-Fi dropped). */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {status === 'offline' && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-50 flex justify-center p-2"
        >
          <span className="rounded-full bg-nope px-4 py-2 text-sm font-semibold text-white shadow-card">
            {t('common.reconnecting')}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4">
      <span
        className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-spot"
        aria-hidden="true"
      />
      {label && <span className="text-mist">{label}</span>}
    </div>
  );
}

export function CenterMessage({
  emoji,
  title,
  body,
  children,
}: {
  emoji?: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      {emoji && (
        <span className="text-6xl" aria-hidden="true">
          {emoji}
        </span>
      )}
      <h1 className="text-3xl font-extrabold">{title}</h1>
      {body && <p className="text-mist">{body}</p>}
      {children}
    </div>
  );
}
