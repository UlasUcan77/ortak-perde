import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LanguageSwitcher, Logo, TmdbAttribution } from '../components/Brand';

export function HomePage() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const steps = [
    { icon: '📺', title: t('home.step1Title'), body: t('home.step1Body') },
    { icon: '📱', title: t('home.step2Title'), body: t('home.step2Body') },
    { icon: '👉', title: t('home.step3Title'), body: t('home.step3Body') },
    { icon: '🏆', title: t('home.step4Title'), body: t('home.step4Body') },
  ];
  return (
    <div className="stage-bg flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-12 px-4 py-10 text-center sm:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6"
        >
          <h1 className="text-balance text-4xl font-extrabold leading-tight sm:text-6xl">
            {t('home.title')} <span className="text-spot">{t('home.titleAccent')}</span>
          </h1>
          <p className="max-w-2xl text-balance text-lg text-mist sm:text-xl">
            {t('home.subtitle')}
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link to="/host" className="btn-primary px-8 text-lg">
              📺 {t('home.openHost')}
            </Link>
            <Link to="/join" className="btn-ghost px-8 text-lg">
              📱 {t('home.joinRoom')}
            </Link>
          </div>
          <p className="text-sm text-white/50">{t('home.hostHint')}</p>
        </motion.div>

        <ol className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={i} className="card-surface p-5 text-left">
              <span className="text-3xl" aria-hidden="true">
                {s.icon}
              </span>
              <h2 className="mt-3 text-lg font-bold">
                {i + 1}. {s.title}
              </h2>
              <p className="mt-1 text-sm text-mist">{s.body}</p>
            </li>
          ))}
        </ol>

        <p className="max-w-2xl text-sm text-white/60">🔒 {t('home.privacy')}</p>
      </main>
      <footer className="flex flex-col items-center gap-3 px-4 pb-6">
        <TmdbAttribution />
        <a
          href="https://github.com/UlasUcan77/ortak-perde"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/50 underline-offset-4 hover:underline"
        >
          {t('home.openSource')}
        </a>
      </footer>
    </div>
  );
}
