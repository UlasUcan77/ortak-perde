import { useTranslation } from 'react-i18next';
import type { GameResults, PlayerView } from '@ortak-perde/shared';
import { Poster } from '../components/Poster';

/** Short result on the phone; the big show happens on the host screen. */
export function PlayerResults({ view, results }: { view: PlayerView; results: GameResults }) {
  const { t } = useTranslation();
  const pick = results.winner?.movie ?? results.alternative;
  const iLiked = results.winner?.likedBy.includes(view.me.id) ?? false;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="label">{t(`results.mode.${results.mode}`)}</p>
      {pick ? (
        <>
          <Poster movie={pick} className="aspect-[2/3] w-44 rounded-2xl shadow-card" eager />
          <h1 className="text-3xl font-extrabold">{pick.title}</h1>
          {results.winner && (
            <p className="text-lg text-mist">
              {t('results.agreement', { liked: results.winner.likes, total: results.participants })}
              {iLiked && <span className="ml-1 text-like">· {t('results.youLikedIt')}</span>}
            </p>
          )}
          {results.mode === 'no-cinema' && <p className="text-mist">{t('results.noCinemaBody')}</p>}
        </>
      ) : (
        <h1 className="text-3xl font-extrabold">{t('results.noCinemaTitle')}</h1>
      )}
      <p className="text-sm text-white/50">{t('player.hostDecidesNext')}</p>
    </div>
  );
}
