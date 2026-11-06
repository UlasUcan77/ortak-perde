import { useTranslation } from 'react-i18next';
import type { GameResults, HostView } from '@ortak-perde/shared';

export function HostResults({
  results,
  onReplay,
  onChangeSettings,
  onClose,
  busy,
}: {
  view: HostView;
  results: GameResults;
  busy: boolean;
  onReplay(): void;
  onChangeSettings(): void;
  onClose(): void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <h1 className="text-6xl font-extrabold">
        {results.winner?.movie.title ?? t('results.noCinemaTitle')}
      </h1>
      <div className="flex gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={onReplay}>
          {t('results.replay')}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={onChangeSettings}>
          {t('results.changeSettings')}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          {t('results.close')}
        </button>
      </div>
    </div>
  );
}
