import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import util from 'node:util';
import { REVEAL_DURATION_MS } from '@ortak-perde/shared';

export interface ServerConfig {
  port: number;
  host: string;
  publicUrl: string | null;
  /** Extra origins allowed to open a Socket.IO connection (besides same-origin and PUBLIC_URL). */
  allowedOrigins: string[];
  tmdbApiKey: string | null;
  region: string;
  trustProxy: boolean;
  logLevel: string;
  /** Directory of the built web app to serve, or null to skip static hosting. */
  webDist: string | null;
  revealMs: number;
  /** Minimum time the BUILDING phase is shown (so the animation is visible). */
  buildMinMs: number;
  hostGraceMs: number;
  maxRoomAgeMs: number;
  emptyRoomMs: number;
  roomCreateLimit: { max: number; windowMs: number };
}

function bool(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

function nonEmpty(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function defaultWebDist(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // In development (running src/ through tsx) the web app is served by Vite instead.
  if (path.basename(here) === 'src') return null;
  // works for both src/ (tsx) and dist/ (bundled) layouts: apps/server/{src,dist} → apps/web/dist
  const candidate = path.resolve(here, '../../web/dist');
  return fs.existsSync(path.join(candidate, 'index.html')) ? candidate : null;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  { dev = false }: { dev?: boolean } = {},
): ServerConfig {
  const region = nonEmpty(env.TMDB_REGION)?.toUpperCase() ?? 'TR';
  return {
    // In development the public port is Vite's (5173); the API server sits behind its proxy on
    // SERVER_PORT so a PORT variable meant for the web app doesn't collide with it.
    port: Number(dev ? (env.SERVER_PORT ?? 3000) : (env.PORT ?? 3000)),
    host: env.HOST ?? '0.0.0.0',
    publicUrl: nonEmpty(env.PUBLIC_URL),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    tmdbApiKey: nonEmpty(env.TMDB_API_KEY),
    region: /^[A-Z]{2}$/.test(region) ? region : 'TR',
    trustProxy: bool(env.TRUST_PROXY),
    logLevel: env.LOG_LEVEL ?? 'info',
    webDist: env.WEB_DIST === 'off' ? null : (nonEmpty(env.WEB_DIST) ?? defaultWebDist()),
    revealMs: REVEAL_DURATION_MS,
    buildMinMs: 1800,
    hostGraceMs: 10 * 60_000,
    maxRoomAgeMs: 3 * 60 * 60_000,
    emptyRoomMs: 30 * 60_000,
    roomCreateLimit: { max: 10, windowMs: 10 * 60_000 },
  };
}

/**
 * Loads the first .env found in the working directory or up to two parents (repo root).
 * Real environment variables win, except empty ones: an inherited `TMDB_API_KEY=` must not
 * hide the value in .env (process.loadEnvFile would keep the empty value).
 */
export function loadDotEnv(
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  let dir = cwd;
  for (let i = 0; i < 3; i++) {
    const file = path.join(dir, '.env');
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      // Notepad may save UTF-8 with a byte order mark.
      const parsed = util.parseEnv(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined && !env[key]) env[key] = value;
      }
      return file;
    }
    dir = path.dirname(dir);
  }
  return null;
}
