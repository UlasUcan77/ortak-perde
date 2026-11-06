import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { normalizeRoomCode } from '@ortak-perde/shared';
import { CenterMessage } from './components/Status';
import { HostPage } from './host/HostPage';
import { HomePage } from './pages/HomePage';
import { JoinCodePage } from './pages/JoinCodePage';
import { PlayerPage } from './player/PlayerPage';

function PlayerRoute() {
  const { code = '' } = useParams();
  const normalized = normalizeRoomCode(code);
  if (!normalized) return <Navigate to="/join" replace />;
  if (normalized !== code) return <Navigate to={`/join/${normalized}`} replace />;
  return <PlayerPage key={normalized} code={normalized} />;
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="stage-bg min-h-dvh">
      <CenterMessage emoji="🍿" title={t('common.notFound')}>
        <Link to="/" className="btn-primary">
          {t('common.home')}
        </Link>
      </CenterMessage>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/host" element={<HostPage />} />
          <Route path="/join" element={<JoinCodePage />} />
          <Route path="/join/:code" element={<PlayerRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
