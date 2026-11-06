import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import type { Genre, JoinResult, Movie, PlayerView } from '@ortak-perde/shared';
import { LanguageSwitcher, Logo, TmdbAttribution } from '../components/Brand';
import { AvatarBubble, ProgressBar } from '../components/Players';
import { CenterMessage, ConnectionBanner, Spinner } from '../components/Status';
import { useWakeLock, vibrate } from '../lib/device';
import { fetchRoomStatus, useMeta, type RoomStatus } from '../lib/meta';
import { emitAck } from '../lib/socket';
import { playerKey, PROFILE_KEY, storage, type PlayerSession } from '../lib/storage';
import { useRoomSocket } from '../lib/useRoomSocket';
import { GenrePicker } from './GenrePicker';
import { JoinForm } from './JoinForm';
import { PlayerResults } from './PlayerResults';
import { SwipeDeck } from './SwipeDeck';

type Stage = 'checking' | 'join' | 'joined';

export function PlayerPage({ code }: { code: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const meta = useMeta(i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'tr');
  const [stage, setStage] = useState<Stage>('checking');
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Runs on every (re)connect: resume with the stored token, else show the join form.
  const room = useRoomSocket<PlayerView>(async () => {
    const saved = storage.get<PlayerSession>(playerKey(code));
    if (saved) {
      const res = await emitAck<JoinResult>('player:resume', { code, token: saved.token });
      if (res.ok) {
        setStage('joined');
        return;
      }
      storage.remove(playerKey(code));
    }
    setRoomStatus(await fetchRoomStatus(code));
    setStage('join');
  });
  const view = room.view;

  useWakeLock(stage === 'joined' && !!view && view.phase !== 'LOBBY' && view.phase !== 'RESULTS');

  useEffect(() => {
    if (room.closed) storage.remove(playerKey(code));
  }, [room.closed, code]);

  const join = useCallback(
    async (profile: { name: string; avatar: string }) => {
      setBusy(true);
      setJoinError(null);
      const res = await emitAck<JoinResult>('player:join', { code, ...profile });
      setBusy(false);
      if (!res.ok) {
        setJoinError(t(`errors.${res.error}`));
        if (
          res.error === 'ROOM_NOT_FOUND' ||
          res.error === 'GAME_IN_PROGRESS' ||
          res.error === 'ROOM_FULL'
        ) {
          setRoomStatus(
            res.error === 'ROOM_NOT_FOUND'
              ? 'not-found'
              : res.error === 'ROOM_FULL'
                ? 'full'
                : 'in-progress',
          );
        }
        return;
      }
      storage.set(playerKey(code), {
        token: res.data.playerToken,
        playerId: res.data.playerId,
      } satisfies PlayerSession);
      storage.set(PROFILE_KEY, profile);
      vibrate(20);
      setStage('joined');
    },
    [code, t],
  );

  const leave = async () => {
    if (!window.confirm(t('player.confirmLeave'))) return;
    await emitAck('player:leave');
    storage.remove(playerKey(code));
    navigate('/');
  };

  let content: React.ReactNode;
  if (room.closed) {
    content = (
      <CenterMessage
        emoji="🎬"
        title={t('player.roomClosedTitle')}
        body={t(`closed.${room.closed}`)}
      >
        <Link to="/join" className="btn-primary">
          {t('player.joinAnother')}
        </Link>
      </CenterMessage>
    );
  } else if (stage === 'checking' || (stage === 'joined' && !view)) {
    content = (
      <div className="flex min-h-[70dvh] items-center justify-center">
        <Spinner
          label={room.status === 'offline' ? t('common.reconnecting') : t('common.connecting')}
        />
      </div>
    );
  } else if (stage === 'join') {
    content =
      roomStatus && roomStatus !== 'open' ? (
        <CenterMessage
          emoji={roomStatus === 'full' ? '🈵' : roomStatus === 'in-progress' ? '🎞️' : '🔎'}
          title={t(`roomStatus.${roomStatus}.title`)}
          body={t(`roomStatus.${roomStatus}.body`, { code })}
        >
          <Link to="/join" className="btn-primary">
            {t('player.tryAnotherCode')}
          </Link>
        </CenterMessage>
      ) : (
        <JoinForm
          code={code}
          busy={busy || room.status !== 'online'}
          error={joinError}
          onJoin={(p) => void join(p)}
        />
      );
  } else if (view) {
    content = (
      <PlayerPhase
        view={view}
        deckMovies={room.deck?.round === view.round ? room.deck.movies : null}
        genres={meta?.genres ?? null}
        onLeave={() => void leave()}
      />
    );
  }

  const fullBleed = stage === 'joined' && view?.phase === 'SWIPING' && !view.me.finished;

  return (
    <div className="stage-bg flex min-h-dvh flex-col">
      <ConnectionBanner status={room.status} />
      {!fullBleed && (
        <header className="flex items-center justify-between px-4 py-3">
          <Link to="/" aria-label={t('common.home')}>
            <Logo />
          </Link>
          <LanguageSwitcher />
        </header>
      )}
      <main className="flex flex-1 flex-col">{content}</main>
      {!fullBleed && view?.phase !== 'PICKING' && (
        <div className="px-4 pb-4">
          <TmdbAttribution compact />
        </div>
      )}
    </div>
  );
}

function PlayerPhase({
  view,
  deckMovies,
  genres,
  onLeave,
}: {
  view: PlayerView;
  deckMovies: Movie[] | null;
  genres: Genre[] | null;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  switch (view.phase) {
    case 'LOBBY':
      return (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <AvatarBubble player={view.me} size="lg" />
          <div>
            <h1 className="text-3xl font-extrabold">
              {t('player.lobbyTitle', { name: view.me.name })}
            </h1>
            <p className="mt-2 text-mist">{t('player.lobbyBody')}</p>
          </div>
          <ul className="flex flex-wrap justify-center gap-2" aria-label={t('player.inRoom')}>
            {view.players.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-1.5 rounded-full bg-white/5 py-1 pl-1 pr-3 text-sm"
              >
                <AvatarBubble player={p} size="sm" />
                {p.name}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-sm text-white/50 underline underline-offset-4"
            onClick={onLeave}
          >
            {t('player.leave')}
          </button>
        </div>
      );
    case 'PICKING':
      return (
        <GenrePicker
          key={view.round}
          preference={view.me.preference}
          ready={view.me.ready}
          genres={genres}
        />
      );
    case 'BUILDING':
      return (
        <div className="flex flex-1 items-center justify-center">
          <Spinner label={t('player.building')} />
        </div>
      );
    case 'SWIPING':
      if (view.me.finished) return <Waiting view={view} />;
      if (!deckMovies) {
        return (
          <div className="flex flex-1 items-center justify-center">
            <Spinner label={t('common.connecting')} />
          </div>
        );
      }
      return <SwipeDeck view={view} movies={deckMovies} />;
    case 'REVEALING':
      return <LookAtScreen />;
    case 'RESULTS':
      return view.results ? <PlayerResults view={view} results={view.results} /> : null;
  }
}

function Waiting({ view }: { view: PlayerView }) {
  const { t } = useTranslation();
  const others = view.players.filter((p) => p.id !== view.me.id);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <span className="text-6xl" aria-hidden="true">
          🍿
        </span>
        <h1 className="mt-3 text-3xl font-extrabold">{t('player.waitingTitle')}</h1>
        <p className="mt-2 text-mist">{t('player.waitingBody')}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {others.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <AvatarBubble player={p} size="sm" />
            <div className="flex-1">
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold">{p.name}</span>
                <span className={p.finished ? 'text-like' : 'text-mist'}>
                  {p.finished ? '✓' : `${p.progress}/${view.deckLength}`}
                </span>
              </div>
              <ProgressBar value={p.progress} max={view.deckLength} label={p.name} />
            </div>
          </li>
        ))}
      </ul>
      {view.me.canUndo && (
        <button type="button" className="btn-ghost" onClick={() => void emitAck('player:undo')}>
          ↶ {t('swipe.undoLast')}
        </button>
      )}
    </div>
  );
}

function LookAtScreen() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  useEffect(() => vibrate([20, 60, 20]), []);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <motion.span
        className="text-8xl"
        aria-hidden="true"
        animate={reduce ? undefined : { scale: [1, 1.15, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        👀
      </motion.span>
      <h1 className="text-4xl font-extrabold">{t('player.lookAtScreen')}</h1>
      <p className="text-mist">{t('player.lookAtScreenBody')}</p>
    </div>
  );
}
