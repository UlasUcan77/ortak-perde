import type { Locale } from '@ortak-perde/shared';

/** Built-in TMDB movie genre names, used by the sample catalog and as a TMDB fallback. */
export const GENRE_NAMES: Record<number, Record<Locale, string>> = {
  28: { tr: 'Aksiyon', en: 'Action' },
  12: { tr: 'Macera', en: 'Adventure' },
  16: { tr: 'Animasyon', en: 'Animation' },
  35: { tr: 'Komedi', en: 'Comedy' },
  80: { tr: 'Suç', en: 'Crime' },
  99: { tr: 'Belgesel', en: 'Documentary' },
  18: { tr: 'Dram', en: 'Drama' },
  10751: { tr: 'Aile', en: 'Family' },
  14: { tr: 'Fantastik', en: 'Fantasy' },
  36: { tr: 'Tarih', en: 'History' },
  27: { tr: 'Korku', en: 'Horror' },
  10402: { tr: 'Müzik', en: 'Music' },
  9648: { tr: 'Gizem', en: 'Mystery' },
  10749: { tr: 'Romantik', en: 'Romance' },
  878: { tr: 'Bilim Kurgu', en: 'Science Fiction' },
  53: { tr: 'Gerilim', en: 'Thriller' },
  10752: { tr: 'Savaş', en: 'War' },
  37: { tr: 'Vahşi Batı', en: 'Western' },
  10770: { tr: 'TV Filmi', en: 'TV Movie' },
};

export function genreName(id: number, locale: Locale): string | null {
  return GENRE_NAMES[id]?.[locale] ?? null;
}
