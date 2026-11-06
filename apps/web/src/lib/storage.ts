/** localStorage wrapper that never throws (private mode, blocked storage…). */
export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export interface HostSession {
  code: string;
  token: string;
}

export interface PlayerSession {
  token: string;
  playerId: string;
}

export const HOST_KEY = 'ortak-perde:host';
export const playerKey = (code: string) => `ortak-perde:player:${code}`;
export const PROFILE_KEY = 'ortak-perde:profile';
