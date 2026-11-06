import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { GameResults, HostView, Movie, PlayerPublic, RankedMovie } from '@ortak-perde/shared';
import { AvatarBubble } from '../components/Players';
import { Poster } from '../components/Poster';
import { renderShareCard, shareOrDownload, slug } from '../lib/shareCard';
import { formatRuntime, genreLabels } from '../player/SwipeCard';

function metaLine(movie: Movie, t: ReturnType<typeof useTranslation>['t']): string {
  return [
    movie.year,
    formatRuntime(movie.runtime, t),
    movie.rating ? `★ ${movie.rating.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function Likers({ ranked, players }: { ranked: RankedMovie; players: PlayerPublic[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {ranked.likedBy.map((id) => {
        const p = players.find((pl) => pl.id === id);
        if (!p) return null;
        return (
          <li key={id} className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3">
            <AvatarBubble player={p} size="sm" />
            <span className="font-semibold">{p.name}</span>
            {/* super likes are not revealed per person; the count is shown instead */}
          </li>
        );
      })}
    </ul>
  );
}

/** RESULTS on the host screen: winner, podium, who liked it, actions and the share card. */
export function HostResults({
  view,
  results,
  busy,
  onReplay,
  onChangeSettings,
  onClose,
}: {
  view: HostView;
  results: GameResults;
  busy: boolean;
  onReplay(): void;
  onChangeSettings(): void;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [sharing, setSharing] = useState(false);
  const winner = results.winner;
  const movie = winner?.movie ?? results.alternative;

  const share = async () => {
    if (!movie) return;
    setSharing(true);
    try {
      const blob = await renderShareCard(results, view.players, {
        heading: t(`results.mode.${results.mode}`),
        agreement: winner
          ? t('results.agreement', { liked: winner.likes, total: results.participants })
          : null,
        meta: metaLine(movie, t),
        footer: t('results.cardFooter'),
        attribution: t('common.tmdbNotice'),
      });
      await shareOrDownload(blob, `ortak-perde-${slug(movie.title)}.png`, false);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="grid flex-1 items-center gap-10 lg:grid-cols-[auto_1fr]">
        {movie ? (
          <motion.div
            initial={reduce ? false : { scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto"
          >
            <Poster
              movie={movie}
              eager
              className="aspect-[2/3] h-[56vh] max-h-[640px] rounded-3xl shadow-glow ring-4 ring-spot/50"
            />
          </motion.div>
        ) : (
          <div className="mx-auto text-[10rem]" aria-hidden="true">
            🌙
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-4">
          <span
            className={`w-fit rounded-full px-4 py-1.5 text-lg font-bold ${
              results.mode === 'match'
                ? 'bg-like/15 text-like'
                : results.mode === 'compromise'
                  ? 'bg-spot/15 text-spot'
                  : 'bg-nope/15 text-nope'
            }`}
          >
            {t(`results.mode.${results.mode}`)}
          </span>

          {results.mode === 'no-cinema' && (
            <div>
              <h1 className="text-5xl font-extrabold xl:text-6xl">{t('results.noCinemaTitle')}</h1>
              {movie && <p className="mt-3 text-2xl text-mist">{t('results.noCinemaBody')}</p>}
            </div>
          )}

          {movie && (
            <>
              <h2
                className={`text-balance font-extrabold ${results.mode === 'no-cinema' ? 'text-4xl' : 'text-5xl xl:text-7xl'}`}
              >
                {results.mode === 'no-cinema' && (
                  <span className="mr-3 text-2xl text-mist">{t('results.alternative')}:</span>
                )}
                {movie.title}
              </h2>
              {movie.originalTitle !== movie.title && (
                <p className="text-xl text-white/60">{movie.originalTitle}</p>
              )}
              <p className="text-2xl font-semibold text-mist">{metaLine(movie, t)}</p>
              <ul className="flex flex-wrap gap-2">
                {genreLabels(movie, t).map((g) => (
                  <li key={g} className="rounded-full bg-white/10 px-3 py-1 text-base">
                    {g}
                  </li>
                ))}
              </ul>
              {movie.overview && (
                <p className="line-clamp-4 max-w-3xl text-xl leading-relaxed text-white/85">
                  {movie.overview}
                </p>
              )}
              {movie.providers.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="label">{t('results.whereToWatch')}</span>
                  {movie.providers.map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3"
                    >
                      {p.logoUrl && <img src={p.logoUrl} alt="" className="h-7 w-7 rounded-full" />}
                      {p.name}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {winner && (
            <div className="flex flex-col gap-2">
              <p className="text-3xl font-extrabold text-like">
                {t('results.agreement', { liked: winner.likes, total: results.participants })}
              </p>
              <p className="label">{t('results.likedBy')}</p>
              <Likers ranked={winner} players={view.players} />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        {results.podium.length > 0 ? (
          <div>
            <p className="label mb-3">{t('results.podium')}</p>
            <ol className="flex flex-wrap gap-4">
              {results.podium.map((r, i) => (
                <li key={r.movie.id} className="card-surface flex items-center gap-4 p-3 pr-6">
                  <span className="font-display text-3xl font-extrabold text-mist">
                    {i === 0 ? t('results.second') : t('results.third')}
                  </span>
                  <Poster
                    movie={r.movie}
                    className="aspect-[2/3] w-16 rounded-xl"
                    showTitle={false}
                  />
                  <div className="min-w-0">
                    <p className="max-w-[16rem] truncate text-lg font-bold">{r.movie.title}</p>
                    <p className="text-mist">
                      {t('results.points', { count: r.score })} ·{' '}
                      {t('results.agreement', { liked: r.likes, total: results.participants })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-3">
          {results.vetoCount > 0 && (
            <span className="mr-2 text-mist">
              {t('results.vetoed', { count: results.vetoCount })}
            </span>
          )}
          {movie && (
            <button
              type="button"
              className="btn-ghost"
              disabled={sharing}
              onClick={() => void share()}
            >
              ⬇ {t('results.downloadCard')}
            </button>
          )}
          <button type="button" className="btn-primary" disabled={busy} onClick={onReplay}>
            🔁 {t('results.replay')}
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={onChangeSettings}>
            ⚙ {t('results.changeSettings')}
          </button>
          <button type="button" className="btn-ghost text-nope" onClick={onClose}>
            ✕ {t('results.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
