import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HIDDEN_GENRE_IDS,
  MOVIE_GENRE_IDS,
  type Genre,
  type GenrePreference,
} from '@ortak-perde/shared';
import { vibrate } from '../lib/device';
import { emitAck } from '../lib/socket';

const GENRE_EMOJI: Record<number, string> = {
  28: '💥',
  12: '🧭',
  16: '🎨',
  35: '😂',
  80: '🕵️',
  99: '🎥',
  18: '🎭',
  10751: '👨‍👩‍👧',
  14: '🐉',
  36: '🏛️',
  27: '👻',
  10402: '🎵',
  9648: '🔍',
  10749: '💘',
  878: '🚀',
  53: '😱',
  10752: '🪖',
  37: '🤠',
};

/** Each player picks their own genres ("anything" allowed) and optionally hard no's. */
export function GenrePicker({
  preference,
  ready,
  genres,
}: {
  preference: GenrePreference;
  ready: boolean;
  genres: Genre[] | null;
}) {
  const { t } = useTranslation();
  const [pref, setPref] = useState<GenrePreference>(preference);
  const [showDislikes, setShowDislikes] = useState(preference.disliked.length > 0);
  const [busy, setBusy] = useState(false);

  const list: Genre[] =
    genres ??
    MOVIE_GENRE_IDS.filter((id) => !HIDDEN_GENRE_IDS.includes(id)).map((id) => ({
      id,
      name: String(id),
    }));
  const label = (g: Genre) => t(`genres.${g.id}`, { defaultValue: g.name });

  const update = (next: GenrePreference) => {
    setPref(next);
    vibrate(8);
    void emitAck('player:set-genres', next);
  };

  const toggleLiked = (id: number) => {
    const liked = pref.liked.includes(id)
      ? pref.liked.filter((g) => g !== id)
      : [...pref.liked, id];
    update({ ...pref, liked, disliked: pref.disliked.filter((g) => g !== id) });
  };
  const toggleDisliked = (id: number) => {
    const disliked = pref.disliked.includes(id)
      ? pref.disliked.filter((g) => g !== id)
      : [...pref.disliked, id];
    update({ ...pref, disliked, liked: pref.liked.filter((g) => g !== id) });
  };

  const canBeReady = pref.liked.length > 0 || pref.any;

  const setReady = async (value: boolean) => {
    setBusy(true);
    await emitAck('player:set-genres', pref);
    await emitAck('player:ready', { ready: value });
    setBusy(false);
  };

  if (ready) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="text-6xl" aria-hidden="true">
          ✅
        </span>
        <h1 className="text-3xl font-extrabold">{t('picking.readyTitle')}</h1>
        <p className="text-mist">{t('picking.readyBody')}</p>
        <ul className="flex flex-wrap justify-center gap-1.5">
          {pref.any && <li className="chip border-spot/40 text-spot">🎲 {t('picking.any')}</li>}
          {pref.liked.map((id) => (
            <li key={id} className="chip border-like/40 text-like">
              {GENRE_EMOJI[id]} {t(`genres.${id}`)}
            </li>
          ))}
          {pref.disliked.map((id) => (
            <li key={id} className="chip border-nope/40 text-nope line-through">
              {t(`genres.${id}`)}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => void setReady(false)}
        >
          {t('picking.change')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-32 pt-4">
      <div>
        <h1 className="text-3xl font-extrabold">{t('picking.title')}</h1>
        <p className="text-mist">{t('picking.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('picking.likedGroup')}>
        <button
          type="button"
          aria-pressed={pref.any}
          onClick={() => update({ ...pref, any: !pref.any })}
          className={`chip ${pref.any ? 'border-spot bg-spot text-ink-950' : 'border-white/15 bg-white/5'}`}
        >
          🎲 {t('picking.any')}
        </button>
        {list.map((g) => {
          const on = pref.liked.includes(g.id);
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleLiked(g.id)}
              className={`chip ${on ? 'border-like bg-like/20 text-white' : 'border-white/15 bg-white/5'}`}
            >
              <span aria-hidden="true">{GENRE_EMOJI[g.id] ?? '🎬'}</span> {label(g)}
            </button>
          );
        })}
      </div>

      <div className="card-surface p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left font-semibold"
          aria-expanded={showDislikes}
          onClick={() => setShowDislikes((s) => !s)}
        >
          <span>🙅 {t('picking.dislikedTitle')}</span>
          <span aria-hidden="true">{showDislikes ? '−' : '+'}</span>
        </button>
        {showDislikes && (
          <>
            <p className="mt-1 text-sm text-mist">{t('picking.dislikedHint')}</p>
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label={t('picking.dislikedTitle')}
            >
              {list.map((g) => {
                const on = pref.disliked.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDisliked(g.id)}
                    className={`chip ${on ? 'border-nope bg-nope/20 text-white line-through' : 'border-white/15 bg-white/5'}`}
                  >
                    {label(g)}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-ink-900 via-ink-900/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            className="btn-primary w-full text-lg"
            disabled={!canBeReady || busy}
            onClick={() => void setReady(true)}
          >
            {canBeReady ? t('picking.ready') : t('picking.pickOne')}
          </button>
        </div>
      </div>
    </div>
  );
}
