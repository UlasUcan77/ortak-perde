import { useCallback, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  MIN_PLAYERS_TO_START,
  type CreateRoomResult,
  type DeckNotice,
  type HostView,
  type SettingsPatch,
} from '@ortak-perde/shared';
import { LanguageSwitcher, Logo, TmdbAttribution } from '../components/Brand';
import { JoinQr } from '../components/JoinQr';
import { PlayerGrid, ProgressBar } from '../components/Players';
import { CenterMessage, ConnectionBanner, Spinner } from '../components/Status';
import { currentLang } from '../i18n';
import { useWakeLock } from '../lib/device';
import { useMeta } from '../lib/meta';
import { emitAck } from '../lib/socket';
import { HOST_KEY, storage, type HostSession } from '../lib/storage';
import { useRoomSocket } from '../lib/useRoomSocket';
import { HostReveal } from './HostReveal';
import { HostResults } from './HostResults';
import { HostSettings } from './HostSettings';

export function HostPage() {
  const { t, i18n } = useTranslation();
  const meta = useMeta(i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'tr');
  const [busy, setBusy] = useState(false);

  const createRoom = useCallback(async () => {
    const res = await emitAck<CreateRoomResult>('host:create-room', {
      locale: currentLang(),
      origin: window.location.origin,
    });
    if (res.ok)
      storage.set(HOST_KEY, {
        code: res.data.code,
        token: res.data.hostToken,
      } satisfies HostSession);
    return res;
  }, []);

  const room = useRoomSocket<HostView>(async () => {
    const saved = storage.get<HostSession>(HOST_KEY);
    if (saved) {
      const res = await emitAck('host:resume', saved);
      if (res.ok) return;
      storage.remove(HOST_KEY);
    }
    const res = await createRoom();
    room.setError(res.ok ? null : res.error);
  });
  const view = room.view;

  useWakeLock(!!view && view.phase !== 'LOBBY');

  const act = async (event: Parameters<typeof emitAck>[0], payload: object = {}) => {
    setBusy(true);
    const res = await emitAck(event, payload);
    setBusy(false);
    room.setError(res.ok ? null : res.error);
    return res;
  };

  const newRoom = async () => {
    storage.remove(HOST_KEY);
    room.reset();
    const res = await createRoom();
    room.setError(res.ok ? null : res.error);
  };

  const closeRoom = async () => {
    if (!window.confirm(t('host.confirmClose'))) return;
    await act('host:close');
    storage.remove(HOST_KEY);
    window.location.assign('/');
  };

  let content: React.ReactNode;
  if (room.closed) {
    content = (
      <CenterMessage emoji="🎬" title={t('host.roomClosedTitle')} body={t(`closed.${room.closed}`)}>
        <button type="button" className="btn-primary" onClick={() => void newRoom()}>
          {t('host.newRoom')}
        </button>
      </CenterMessage>
    );
  } else if (!view) {
    content =
      room.error === 'RATE_LIMITED' ? (
        <CenterMessage emoji="⏳" title={t('errors.RATE_LIMITED')} />
      ) : (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner label={t('host.creating')} />
        </div>
      );
  } else {
    content = (
      <HostPhase
        view={view}
        busy={busy}
        meta={meta}
        onSettings={(patch) => void act('host:update-settings', patch)}
        onStart={() => void act('host:start')}
        onContinue={() => void act('host:continue')}
        onFinish={() => void act('host:force-finish')}
        onReplay={() => void act('host:reset', { mode: 'replay' })}
        onChangeSettings={() => void act('host:reset', { mode: 'settings' })}
        onClose={() => void closeRoom()}
      />
    );
  }

  return (
    <div className="stage-bg relative flex min-h-dvh flex-col overflow-hidden">
      <div className="curtain-left hidden lg:block" />
      <div className="curtain-right hidden lg:block" />
      <ConnectionBanner status={room.status} />
      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 lg:px-[9vw]">
        <Link to="/" aria-label={t('common.home')}>
          <Logo size="lg" />
        </Link>
        <div className="flex items-center gap-3">
          {view && (
            <span className="hidden rounded-full bg-white/5 px-4 py-2 font-display text-lg font-bold tracking-widest md:inline">
              {view.code}
            </span>
          )}
          <LanguageSwitcher />
        </div>
      </header>
      <main className="relative z-10 flex flex-1 flex-col px-6 pb-6 lg:px-[9vw]">
        {room.error && view && (
          <p
            role="alert"
            className="mb-4 rounded-2xl bg-nope/15 px-4 py-3 text-center text-lg text-nope"
          >
            {t(`errors.${room.error}`)}
          </p>
        )}
        {content}
      </main>
      <div className="relative z-10 px-6 pb-4">
        <TmdbAttribution compact />
      </div>
    </div>
  );
}

interface PhaseProps {
  view: HostView;
  busy: boolean;
  meta: ReturnType<typeof useMeta>;
  onSettings(patch: SettingsPatch): void;
  onStart(): void;
  onContinue(): void;
  onFinish(): void;
  onReplay(): void;
  onChangeSettings(): void;
  onClose(): void;
}

function HostPhase(props: PhaseProps) {
  // Enter-only transitions: never wait for an exit animation, which would stall phase changes
  // in background tabs or on TVs that throttle requestAnimationFrame.
  const reduce = useReducedMotion();
  const { view } = props;
  return (
    <motion.section
      key={view.phase === 'REVEALING' || view.phase === 'RESULTS' ? 'finale' : view.phase}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-1 flex-col"
    >
      {view.phase === 'LOBBY' && <Lobby {...props} />}
      {view.phase === 'PICKING' && <Picking {...props} />}
      {view.phase === 'BUILDING' && <Building />}
      {view.phase === 'SWIPING' && <Swiping {...props} />}
      {(view.phase === 'REVEALING' || view.phase === 'RESULTS') && view.results && (
        <>
          {view.phase === 'REVEALING' ? (
            <HostReveal results={view.results} players={view.players} />
          ) : (
            <HostResults
              view={view}
              results={view.results}
              busy={props.busy}
              onReplay={props.onReplay}
              onChangeSettings={props.onChangeSettings}
              onClose={props.onClose}
            />
          )}
        </>
      )}
    </motion.section>
  );
}

export function Notices({
  notices,
  className = '',
}: {
  notices: DeckNotice[];
  className?: string;
}) {
  const { t } = useTranslation();
  if (notices.length === 0) return null;
  return (
    <ul className={`flex flex-col gap-2 ${className}`}>
      {notices.map((n) => (
        <li
          key={n.code}
          className="rounded-2xl border border-spot/30 bg-spot/10 px-4 py-2 text-spot-soft"
        >
          {t(`notices.${n.code}`, { count: n.value ?? 0 })}
        </li>
      ))}
    </ul>
  );
}

function Lobby({ view, meta, busy, onSettings, onStart }: PhaseProps) {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const enough = view.players.length >= MIN_PLAYERS_TO_START;
  return (
    <div className="grid flex-1 items-center gap-10 lg:grid-cols-[auto_1fr]">
      <JoinQr joinUrl={view.joinUrl} joinBase={view.joinBase} code={view.code} />
      <div className="flex min-w-0 flex-col gap-6">
        <div>
          <h1 className="text-4xl font-extrabold md:text-5xl xl:text-6xl">
            {t('host.lobbyTitle')}
          </h1>
          <p className="mt-2 text-xl text-mist">{t('host.lobbySubtitle')}</p>
        </div>
        <Notices notices={view.notices} />
        {view.players.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-white/15 p-8 text-center text-xl text-mist">
            {t('host.waitingForPlayers')}
          </p>
        ) : (
          <PlayerGrid players={view.players} />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary px-10 text-xl"
            disabled={!enough || busy}
            onClick={onStart}
          >
            {t('host.start')} ▶
          </button>
          <button
            type="button"
            className="btn-ghost"
            aria-expanded={showSettings}
            aria-controls="host-settings"
            onClick={() => setShowSettings((s) => !s)}
          >
            ⚙ {t('host.settings')}
          </button>
          <span className="text-mist">
            {enough
              ? t('host.playerCount', { count: view.players.length })
              : t('host.needPlayers', { count: MIN_PLAYERS_TO_START })}
          </span>
        </div>
        <AnimatePresence initial={false}>
          {showSettings && (
            <motion.div
              id="host-settings"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="card-surface p-6">
                <HostSettings settings={view.settings} meta={meta} onChange={onSettings} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {view.catalogMode === 'sample' && (
          <p className="text-sm text-white/50">ℹ {t('host.sampleMode')}</p>
        )}
      </div>
    </div>
  );
}

function Picking({ view, busy, onContinue }: PhaseProps) {
  const { t } = useTranslation();
  const ready = view.players.filter((p) => p.ready).length;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8">
      <div className="text-center">
        <p className="label">{t('host.step', { n: 1 })}</p>
        <h1 className="mt-2 text-5xl font-extrabold xl:text-6xl">{t('host.pickingTitle')}</h1>
        <p className="mt-3 text-2xl text-mist">
          {t('host.readyCount', { ready, total: view.players.length })}
        </p>
      </div>
      <PlayerGrid
        players={view.players}
        renderStatus={(p) => (
          <p className={`text-lg font-semibold ${p.ready ? 'text-like' : 'text-mist'}`}>
            {p.ready ? `✓ ${t('host.ready')}` : t('host.choosing')}
          </p>
        )}
      />
      <div className="flex justify-center">
        <button
          type="button"
          className="btn-ghost text-lg"
          disabled={busy || ready === 0}
          onClick={onContinue}
        >
          {t('host.continue')} →
        </button>
      </div>
    </div>
  );
}

function Building() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10">
      <div className="relative h-72 w-52" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-3xl border border-white/15 bg-gradient-to-br from-ink-600 to-ink-800 shadow-card"
            style={{ zIndex: 5 - i }}
            animate={
              reduce
                ? undefined
                : {
                    x: [0, (i % 2 ? 1 : -1) * (60 + i * 15), 0],
                    rotate: [0, (i % 2 ? 1 : -1) * (8 + i * 3), 0],
                  }
            }
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
          >
            <div className="flex h-full items-center justify-center text-5xl">🎞️</div>
          </motion.div>
        ))}
      </div>
      <h1 className="text-5xl font-extrabold" role="status">
        {t('host.building')}
      </h1>
    </div>
  );
}

function Swiping({ view, busy, onFinish }: PhaseProps) {
  const { t } = useTranslation();
  const done = view.players.filter((p) => p.finished).length;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8">
      <div className="text-center">
        <p className="label">{t('host.step', { n: 2 })}</p>
        <h1 className="mt-2 text-5xl font-extrabold xl:text-6xl">{t('host.swipingTitle')}</h1>
        <p className="mt-3 text-2xl text-mist">
          {t('host.finishedCount', { done, total: view.players.length })}
        </p>
      </div>
      <Notices notices={view.notices} className="mx-auto max-w-3xl" />
      <ul className="flex flex-col gap-4">
        {view.players.map((p) => (
          <li key={p.id} className={`flex items-center gap-4 ${p.connected ? '' : 'opacity-50'}`}>
            <span className="w-14 text-center text-4xl" aria-hidden="true">
              {p.avatar}
            </span>
            <div className="flex-1">
              <div className="mb-1 flex justify-between text-xl font-bold">
                <span>
                  {p.name}
                  {!p.connected && (
                    <span className="ml-2 text-sm font-normal text-nope">
                      {t('common.offline')}
                    </span>
                  )}
                </span>
                <span className={p.finished ? 'text-like' : 'text-mist'}>
                  {p.finished ? `✓ ${t('host.done')}` : `${p.progress}/${view.deckLength}`}
                </span>
              </div>
              <ProgressBar value={p.progress} max={view.deckLength} label={p.name} />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-center text-mist">🤫 {t('host.secret')}</p>
      <div className="flex justify-center">
        <button type="button" className="btn-ghost text-lg" disabled={busy} onClick={onFinish}>
          {t('host.finishNow')} ⏹
        </button>
      </div>
    </div>
  );
}
