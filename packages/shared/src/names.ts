import { NAME_MAX_LENGTH } from './constants';

/**
 * Cleans a display name: strips control/format characters and markup-ish characters,
 * collapses whitespace and limits the length (by user-perceived characters).
 * Returns an empty string if nothing usable is left.
 */
export function sanitizeName(raw: string): string {
  const cleaned = raw
    .normalize('NFC')
    // control chars, zero-width & bidi overrides
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    // characters that are meaningful in HTML/URLs; React escapes anyway, this is defence in depth
    .replace(/[<>"'`&\\/{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(cleaned);
  return chars.slice(0, NAME_MAX_LENGTH).join('').trim();
}

/** Makes `name` unique among `existing` by appending " 2", " 3"... within the length limit. */
export function uniqueName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => n.toLocaleLowerCase('tr')));
  if (!taken.has(name.toLocaleLowerCase('tr'))) return name;
  for (let n = 2; n < 1000; n++) {
    const suffix = ` ${n}`;
    const base = Array.from(name)
      .slice(0, NAME_MAX_LENGTH - suffix.length)
      .join('')
      .trim();
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate.toLocaleLowerCase('tr'))) return candidate;
  }
  return name;
}
