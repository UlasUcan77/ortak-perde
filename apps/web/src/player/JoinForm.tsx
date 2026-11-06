import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AVATARS, NAME_MAX_LENGTH, sanitizeName, type Avatar } from '@ortak-perde/shared';
import { PROFILE_KEY, storage } from '../lib/storage';

interface Profile {
  name: string;
  avatar: Avatar;
}

/** Nickname + emoji avatar. Remembers the last profile on this device for next time. */
export function JoinForm({
  code,
  busy,
  error,
  onJoin,
}: {
  code: string;
  busy: boolean;
  error: string | null;
  onJoin: (profile: Profile) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const saved = storage.get<Profile>(PROFILE_KEY);
  const [name, setName] = useState(saved?.name ?? '');
  const [avatar, setAvatar] = useState<Avatar>(
    saved && (AVATARS as readonly string[]).includes(saved.avatar)
      ? saved.avatar
      : AVATARS[Math.floor(Math.random() * AVATARS.length)]!,
  );
  const clean = sanitizeName(name);

  return (
    <form
      className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) onJoin({ name: clean, avatar });
      }}
    >
      <div className="text-center">
        <p className="label">{t('join.room')}</p>
        <p className="font-display text-5xl font-extrabold tracking-[0.25em] text-spot">{code}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-name`} className="label">
          {t('join.nameLabel')}
        </label>
        <input
          id={`${id}-name`}
          className="field py-3 text-lg"
          value={name}
          maxLength={NAME_MAX_LENGTH + 4}
          autoComplete="nickname"
          enterKeyHint="go"
          placeholder={t('join.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={`${id}-hint`}
        />
        <p id={`${id}-hint`} className="text-xs text-white/50">
          {t('join.nameHint', { max: NAME_MAX_LENGTH })}
        </p>
      </div>

      <fieldset>
        <legend className="label mb-2">{t('join.avatarLabel')}</legend>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={avatar === a}
              aria-label={t('join.avatarOption', { avatar: a })}
              onClick={() => setAvatar(a)}
              className={`flex aspect-square items-center justify-center rounded-2xl text-3xl transition active:scale-90 ${
                avatar === a ? 'bg-spot/20 ring-2 ring-spot' : 'bg-white/5'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-nope/15 px-3 py-2 text-center text-nope">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary text-lg" disabled={!clean || busy}>
        {avatar} {t('join.submit')}
      </button>
      <p className="text-center text-xs text-white/50">{t('join.noAccount')}</p>
    </form>
  );
}
