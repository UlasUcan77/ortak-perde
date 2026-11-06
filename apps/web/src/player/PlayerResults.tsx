import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameResults, PlayerView } from '@ortak-perde/shared';
import { Poster } from '../components/Poster';
import { renderShareCard, shareOrDownload, slug } from '../lib/shareCard';
import { formatRuntime } from './SwipeCard';

/** Short result on the phone; the big show happens on the host screen. */
export function PlayerResults({ view, results }: { view: PlayerView; results: GameResults }) {
  const { t } = useTranslation();
  const [sharing, setSharing] = useState(false);
  const pick = results.winner?.movie ?? results.alternative;
  const iLiked = results.winner?.likedBy.includes(view.me.id) ?? false;

  const share = async () => {
    if (!pick) return;
    setSharing(true);
    try {
      const blob = await renderShareCard(results, view.players, {
        heading: t(`results.mode.${results.mode}`),
        agreement: results.winner
          ? t('results.agreement', { liked: results.winner.likes, total: results.participants })
          : null,
        meta: [
          pick.year,
          formatRuntime(pick.runtime, t),
          pick.rating ? `★ ${pick.rating.toFixed(1)}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        footer: t('results.cardFooter'),
        attribution: t('common.tmdbNotice'),
      });
      await shareOrDownload(blob, `ortak-perde-${slug(pick.title)}.png`, true);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="label">{t(`results.mode.${results.mode}`)}</p>
      {results.mode === 'no-cinema' && (
        <h1 className="text-2xl font-extrabold">{t('results.noCinemaTitle')}</h1>
      )}
      {pick ? (
        <>
          {results.mode === 'no-cinema' && <p className="text-mist">{t('results.noCinemaBody')}</p>}
          <Poster movie={pick} className="aspect-[2/3] w-44 rounded-2xl shadow-card" eager />
          <h2 className="text-3xl font-extrabold">{pick.title}</h2>
          {results.winner && (
            <p className="text-lg text-mist">
              {t('results.agreement', { liked: results.winner.likes, total: results.participants })}
              {iLiked && <span className="ml-1 text-like">· {t('results.youLikedIt')}</span>}
            </p>
          )}
          <button
            type="button"
            className="btn-ghost"
            disabled={sharing}
            onClick={() => void share()}
          >
            ↗ {t('results.shareCard')}
          </button>
        </>
      ) : null}
      <p className="text-sm text-white/50">{t('player.hostDecidesNext')}</p>
    </div>
  );
}
