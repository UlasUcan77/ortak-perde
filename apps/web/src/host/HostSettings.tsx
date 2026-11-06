import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DECK_SIZES, type RoomSettings, type SettingsPatch } from '@ortak-perde/shared';
import type { Meta } from '../lib/meta';

const LANGUAGES = ['tr', 'en', 'ko', 'ja', 'fr', 'es', 'it', 'de', 'hi'] as const;
const RUNTIMES = [90, 120, 150, 180] as const;
const MIN_VOTES = [0, 100, 300, 1000, 5000] as const;

/** Host settings drawer. Every change is sent to the server, which validates it. */
export function HostSettings({
  settings,
  meta,
  onChange,
}: {
  settings: RoomSettings;
  meta: Meta | null;
  onChange: (patch: SettingsPatch) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const thisYear = new Date().getFullYear();
  const [yearFrom, setYearFrom] = useState(String(settings.yearFrom));
  const [yearTo, setYearTo] = useState(String(settings.yearTo));

  const commitYears = () => {
    const from = Math.max(1900, Math.min(thisYear, Number(yearFrom) || settings.yearFrom));
    const to = Math.max(from, Math.min(thisYear, Number(yearTo) || settings.yearTo));
    setYearFrom(String(from));
    setYearTo(String(to));
    if (from !== settings.yearFrom || to !== settings.yearTo)
      onChange({ yearFrom: from, yearTo: to });
  };

  const toggleProvider = (pid: number) => {
    const has = settings.providerIds.includes(pid);
    onChange({
      providerIds: has
        ? settings.providerIds.filter((p) => p !== pid)
        : [...settings.providerIds, pid],
    });
  };

  return (
    <div className="grid gap-6 text-base md:grid-cols-2">
      <fieldset>
        <legend className="label mb-2">{t('settings.deckSize')}</legend>
        <div className="flex gap-2">
          {DECK_SIZES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={settings.deckSize === n}
              onClick={() => onChange({ deckSize: n })}
              className={`chip ${settings.deckSize === n ? 'border-spot bg-spot text-ink-950' : 'border-white/15'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label mb-2">{t('settings.years')}</legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`${id}-from`}>
            {t('settings.yearFrom')}
          </label>
          <input
            id={`${id}-from`}
            className="field w-28"
            inputMode="numeric"
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onBlur={commitYears}
          />
          <span aria-hidden="true">–</span>
          <label className="sr-only" htmlFor={`${id}-to`}>
            {t('settings.yearTo')}
          </label>
          <input
            id={`${id}-to`}
            className="field w-28"
            inputMode="numeric"
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onBlur={commitYears}
          />
        </div>
      </fieldset>

      <div>
        <label className="label mb-2 block" htmlFor={`${id}-rating`}>
          {t('settings.minRating')}:{' '}
          <span className="text-white">{settings.minRating.toFixed(1)}+</span>
        </label>
        <input
          id={`${id}-rating`}
          type="range"
          min={0}
          max={9}
          step={0.5}
          value={settings.minRating}
          onChange={(e) => onChange({ minRating: Number(e.target.value) })}
          className="w-full accent-spot"
        />
      </div>

      <div>
        <label className="label mb-2 block" htmlFor={`${id}-runtime`}>
          {t('settings.maxRuntime')}
        </label>
        <select
          id={`${id}-runtime`}
          className="field"
          value={settings.maxRuntime ?? ''}
          onChange={(e) => onChange({ maxRuntime: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">{t('settings.noLimit')}</option>
          {RUNTIMES.map((r) => (
            <option key={r} value={r}>
              {t('settings.minutes', { count: r })}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label mb-2 block" htmlFor={`${id}-votes`}>
          {t('settings.minVotes')}
        </label>
        <select
          id={`${id}-votes`}
          className="field"
          value={settings.minVotes}
          onChange={(e) => onChange({ minVotes: Number(e.target.value) })}
        >
          {MIN_VOTES.map((v) => (
            <option key={v} value={v}>
              {v === 0 ? t('settings.noLimit') : `${v}+`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label mb-2 block" htmlFor={`${id}-lang`}>
          {t('settings.originalLanguage')}
        </label>
        <select
          id={`${id}-lang`}
          className="field"
          value={settings.originalLanguage ?? ''}
          onChange={(e) => onChange({ originalLanguage: e.target.value || null })}
        >
          <option value="">{t('settings.anyLanguage')}</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {t(`languages.${l}`)}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="md:col-span-2">
        <legend className="label mb-2">
          {t('settings.providers')}{' '}
          <span className="normal-case tracking-normal text-white/50">
            ({meta?.region ?? 'TR'})
          </span>
        </legend>
        {meta && meta.providers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {meta.providers.map((p) => {
              const on = settings.providerIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleProvider(p.id)}
                  className={`chip ${on ? 'border-spot bg-spot/15 text-spot' : 'border-white/15 text-white/80'}`}
                >
                  {p.logoUrl && <img src={p.logoUrl} alt="" className="h-5 w-5 rounded" />}
                  {p.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-mist">{t('settings.providersUnavailable')}</p>
        )}
        <p className="mt-2 text-sm text-white/50">{t('settings.providersHint')}</p>
      </fieldset>

      <p className="text-sm text-white/50 md:col-span-2">🔞 {t('settings.adultAlwaysOff')}</p>
    </div>
  );
}
