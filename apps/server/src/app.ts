import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import Fastify, { LogController, type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import { APP_NAME, MAX_PLAYERS, roomCodeSchema, type Locale } from '@ortak-perde/shared';
import { SampleCatalog } from './catalog/sample';
import { IMAGE_BASE, TmdbCatalog } from './catalog/tmdb';
import type { MovieCatalog } from './catalog/types';
import type { ServerConfig } from './config';
import { RoomManager } from './game/room-manager';
import { getLanIp } from './network';
import { attachSocketHandlers, isOriginAllowed, type IoServer } from './socket';

export interface AppOptions {
  config: ServerConfig;
  /** Override the catalog (tests). Defaults to TMDB when a key is set, else the sample set. */
  catalog?: MovieCatalog;
  lanIp?: string | null;
  logger?: boolean;
}

export interface App {
  fastify: FastifyInstance;
  io: IoServer;
  manager: RoomManager;
  catalog: MovieCatalog;
  lanIp: string | null;
  close(): Promise<void>;
}

const POSTER_PATH = /^\/(w\d{2,3}|original)\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;

export function buildApp({
  config,
  catalog: catalogOverride,
  lanIp: lanOverride,
  logger = false,
}: AppOptions): App {
  const fastify = Fastify({
    logger: logger ? { level: config.logLevel } : false,
    trustProxy: config.trustProxy,
    // No per-request logs: they would contain IP addresses and room codes.
    logController: new LogController({ disableRequestLogging: true }),
  });

  const sample = new SampleCatalog();
  const catalog: MovieCatalog =
    catalogOverride ??
    (config.tmdbApiKey ? new TmdbCatalog({ apiKey: config.tmdbApiKey }) : sample);
  const lanIp = lanOverride !== undefined ? lanOverride : getLanIp();

  const manager = new RoomManager({
    catalog,
    fallbackCatalog: catalog.mode === 'sample' ? null : sample,
    publicUrl: config.publicUrl,
    lanIp,
    revealMs: config.revealMs,
    buildMinMs: config.buildMinMs,
    hostGraceMs: config.hostGraceMs,
    maxRoomAgeMs: config.maxRoomAgeMs,
    emptyRoomMs: config.emptyRoomMs,
    roomCreateLimit: config.roomCreateLimit,
    logger: {
      info: (m) => fastify.log.info(m),
      warn: (m) => fastify.log.warn(m),
      error: (m) => fastify.log.error(m),
    },
  });

  const allowedOrigins = [...config.allowedOrigins];
  if (config.publicUrl) {
    try {
      allowedOrigins.push(new URL(config.publicUrl).origin);
    } catch {
      fastify.log.warn('PUBLIC_URL is not a valid URL');
    }
  }

  const io: IoServer = new Server(fastify.server, {
    serveClient: false,
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 20_000,
    pingTimeout: 20_000,
    cors: allowedOrigins.length > 0 ? { origin: allowedOrigins } : undefined,
    allowRequest: (req, callback) => {
      callback(null, isOriginAllowed(req.headers.origin, req.headers.host, allowedOrigins));
    },
  });
  attachSocketHandlers(io, manager, { trustProxy: config.trustProxy });

  const cleanupTimer = setInterval(() => manager.cleanup(), 60_000);
  cleanupTimer.unref();

  void fastify.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https://image.tmdb.org'],
        'connect-src': ["'self'", 'ws:', 'wss:'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'font-src': ["'self'", 'data:'],
        'script-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': null,
      },
    },
    crossOriginEmbedderPolicy: false,
    // Phones on plain-HTTP LAN addresses must still work; HSTS only makes sense behind HTTPS.
    strictTransportSecurity: config.publicUrl?.startsWith('https://') ? undefined : false,
  });

  fastify.get('/api/health', async () => ({ ok: true, name: APP_NAME, rooms: manager.rooms.size }));

  fastify.get<{ Querystring: { lang?: string } }>('/api/meta', async (req) => {
    const locale: Locale = req.query.lang === 'en' ? 'en' : 'tr';
    const [genres, providers] = await Promise.all([
      catalog.getGenres(locale).catch(() => sample.getGenres(locale)),
      catalog.getProviders(locale, config.region).catch(() => []),
    ]);
    return { catalogMode: catalog.mode, region: config.region, genres, providers };
  });

  // Lets the join screen show "room not found / full / already started" before asking for a name.
  fastify.get<{ Params: { code: string } }>('/api/rooms/:code', async (req) => {
    const parsed = roomCodeSchema.safeParse(req.params.code);
    const room = parsed.success ? manager.getRoom(parsed.data) : undefined;
    if (!room) return { status: 'not-found' };
    if (room.phase !== 'LOBBY') return { status: 'in-progress' };
    if (room.players.length >= MAX_PLAYERS) return { status: 'full' };
    return { status: 'open' };
  });

  // Poster proxy so the share card can draw TMDB posters on a canvas without CORS tainting.
  fastify.get<{ Params: { size: string; file: string } }>(
    '/api/poster/:size/:file',
    async (req, reply) => {
      const p = `/${req.params.size}/${req.params.file}`;
      if (catalog.mode !== 'tmdb' || !POSTER_PATH.test(p)) return reply.code(404).send();
      try {
        const upstream = await fetch(`${IMAGE_BASE}${p}`, { signal: AbortSignal.timeout(8000) });
        if (!upstream.ok || !upstream.body) return reply.code(502).send();
        reply.header('content-type', upstream.headers.get('content-type') ?? 'image/jpeg');
        reply.header('cache-control', 'public, max-age=86400');
        return reply.send(Readable.fromWeb(upstream.body as WebReadableStream));
      } catch {
        return reply.code(502).send();
      }
    },
  );

  if (config.webDist && fs.existsSync(path.join(config.webDist, 'index.html'))) {
    const webDist = config.webDist;
    void fastify.register(fastifyStatic, {
      root: webDist,
      wildcard: false,
      maxAge: '1h',
      setHeaders(reply, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          reply.header('cache-control', 'public, max-age=31536000, immutable');
        }
      },
    });
    // SPA fallback: client-side routes (/host, /join/ABCD…) get index.html.
    fastify.setNotFoundHandler((req, reply) => {
      const url = req.raw.url ?? '';
      const isPage = req.method === 'GET' || req.method === 'HEAD';
      if (isPage && !url.startsWith('/api') && !url.startsWith('/socket.io')) {
        return reply.type('text/html').sendFile('index.html');
      }
      return reply.code(404).send({ error: 'not found' });
    });
  }

  return {
    fastify,
    io,
    manager,
    catalog,
    lanIp,
    async close() {
      clearInterval(cleanupTimer);
      for (const room of [...manager.rooms.values()]) manager.closeRoom(room, 'expired');
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await fastify.close().catch(() => undefined);
    },
  };
}
