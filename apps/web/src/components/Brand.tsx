import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#141019" />
      <path d="M10 12h20c-2.5 13-2.5 28 0 42H10z" fill="#e0475f" />
      <path d="M54 12H34c2.5 13 2.5 28 0 42h20z" fill="#e0475f" />
      <path d="M16 12v42M22 12v42M42 12v42M48 12v42" stroke="#9e1f3a" strokeWidth="2" />
      <path d="M9 11h46" stroke="#f2c14e" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="36" r="4.5" fill="#f2c14e" />
    </svg>
  );
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' | 'xl' }) {
  const text = { md: 'text-xl', lg: 'text-3xl', xl: 'text-5xl md:text-6xl' }[size];
  const mark = { md: 'h-9 w-9', lg: 'h-12 w-12', xl: 'h-16 w-16 md:h-20 md:w-20' }[size];
  return (
    <span className="inline-flex items-center gap-3">
      <LogoMark className={mark} />
      <span className={`font-display font-extrabold tracking-tight ${text}`}>
        Ortak <span className="text-velvet">Perde</span>
      </span>
    </span>
  );
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage ?? 'tr';
  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className="flex gap-1 rounded-full bg-white/5 p-1"
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={current === l.code}
          onClick={() => void i18n.changeLanguage(l.code)}
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase transition ${
            current === l.code ? 'bg-white text-ink-900' : 'text-mist hover:text-white'
          }`}
        >
          {l.code}
        </button>
      ))}
    </div>
  );
}

/** Required TMDB attribution (logo + notice). */
export function TmdbAttribution({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <footer
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-white/55 ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
    >
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
      >
        <img
          src="/tmdb-logo.svg"
          alt="The Movie Database (TMDB)"
          className={compact ? 'h-2.5' : 'h-3'}
        />
      </a>
      <span>{t('common.tmdbNotice')}</span>
    </footer>
  );
}
