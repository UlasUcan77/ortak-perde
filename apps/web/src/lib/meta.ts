import { useEffect, useState } from 'react';
import type { CatalogMode, Genre, WatchProvider } from '@ortak-perde/shared';

export interface Meta {
  catalogMode: CatalogMode;
  region: string;
  genres: Genre[];
  providers: WatchProvider[];
}

const cache = new Map<string, Promise<Meta>>();

function fetchMeta(lang: string): Promise<Meta> {
  let p = cache.get(lang);
  if (!p) {
    p = fetch(`/api/meta?lang=${lang}`).then((r) => {
      if (!r.ok) throw new Error(`meta ${r.status}`);
      return r.json() as Promise<Meta>;
    });
    p.catch(() => cache.delete(lang));
    cache.set(lang, p);
  }
  return p;
}

/** Genres and streaming providers known to the server (localised). */
export function useMeta(lang: string): Meta | null {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    let alive = true;
    fetchMeta(lang)
      .then((m) => alive && setMeta(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [lang]);
  return meta;
}

export type RoomStatus = 'open' | 'in-progress' | 'full' | 'not-found';

export async function fetchRoomStatus(code: string): Promise<RoomStatus | null> {
  try {
    const r = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
    if (!r.ok) return null;
    return ((await r.json()) as { status: RoomStatus }).status;
  } catch {
    return null;
  }
}
