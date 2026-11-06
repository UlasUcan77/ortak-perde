import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import tr from './locales/tr.json';

/**
 * To add a language: create locales/<code>.json (copy en.json), add it to `resources`
 * and SUPPORTED_LANGUAGES. Missing keys fall back to Turkish.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
] as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { tr: { translation: tr }, en: { translation: en } },
    fallbackLng: 'tr',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ortak-perde:lang',
      caches: ['localStorage'],
    },
    returnNull: false,
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.resolvedLanguage ?? 'tr';

/** The two-letter code of the active language ("tr" | "en"). */
export function currentLang(): 'tr' | 'en' {
  return i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'tr';
}

export default i18n;
