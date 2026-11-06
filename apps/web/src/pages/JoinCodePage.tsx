import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { normalizeRoomCode, ROOM_CODE_LENGTH } from '@ortak-perde/shared';
import { LanguageSwitcher, Logo, TmdbAttribution } from '../components/Brand';

/** /join — asks for the 4-character room code, then goes to /join/CODE. */
export function JoinCodePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeRoomCode(value);
    if (!code) {
      setError(true);
      return;
    }
    navigate(`/join/${code}`);
  };

  return (
    <div className="stage-bg flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4">
        <Link to="/" aria-label={t('common.home')}>
          <Logo />
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
        <h1 className="text-center text-3xl font-extrabold">{t('join.codeTitle')}</h1>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <label htmlFor={id} className="label text-center">
            {t('join.codeLabel')}
          </label>
          <input
            id={id}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            maxLength={ROOM_CODE_LENGTH + 2}
            value={value}
            aria-invalid={error}
            aria-describedby={error ? `${id}-err` : undefined}
            onChange={(e) => {
              setValue(e.target.value.toUpperCase());
              setError(false);
            }}
            placeholder="ABCD"
            className="field py-4 text-center font-display text-5xl font-extrabold uppercase tracking-[0.3em]"
          />
          {error && (
            <p id={`${id}-err`} role="alert" className="text-center text-nope">
              {t('join.codeInvalid')}
            </p>
          )}
          <button
            type="submit"
            className="btn-primary text-lg"
            disabled={value.trim().length < ROOM_CODE_LENGTH}
          >
            {t('join.continue')}
          </button>
        </form>
      </main>
      <div className="px-4 pb-6">
        <TmdbAttribution compact />
      </div>
    </div>
  );
}
