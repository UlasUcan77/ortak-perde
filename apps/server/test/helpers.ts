import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket } from 'socket.io-client';
import type {
  AckResponse,
  ClientToServerEvents,
  DeckPayload,
  RoomView,
  ServerToClientEvents,
} from '@ortak-perde/shared';
import { buildApp, type App } from '../src/app';
import { loadConfig, type ServerConfig } from '../src/config';
import { SampleCatalog } from '../src/catalog/sample';
import { RoomManager, type RoomManagerOptions } from '../src/game/room-manager';

export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    ...loadConfig({}),
    webDist: null,
    revealMs: 50,
    buildMinMs: 0,
    ...overrides,
  };
}

export function createManager(overrides: Partial<RoomManagerOptions> = {}): RoomManager {
  return new RoomManager({
    catalog: new SampleCatalog(),
    revealMs: 20,
    buildMinMs: 0,
    hostGraceMs: 10 * 60_000,
    maxRoomAgeMs: 3 * 60 * 60_000,
    emptyRoomMs: 30 * 60_000,
    roomCreateLimit: { max: 100, windowMs: 60_000 },
    lanIp: '192.168.1.20',
    ...overrides,
  });
}

export type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface TestClient {
  socket: TestSocket;
  /** Latest room:state received. */
  state: () => RoomView | null;
  deck: () => DeckPayload | null;
  closed: () => string | null;
  emit<T = unknown>(event: keyof ClientToServerEvents, payload?: object): Promise<AckResponse<T>>;
  /** Resolves once a room:state matching `predicate` arrives (or the current one matches). */
  waitFor(predicate: (view: RoomView) => boolean, timeoutMs?: number): Promise<RoomView>;
  close(): void;
}

export async function startServer(overrides: Partial<ServerConfig> = {}): Promise<{
  app: App;
  url: string;
  connect(): Promise<TestClient>;
  stop(): Promise<void>;
}> {
  const app = buildApp({ config: testConfig(overrides), lanIp: '192.168.1.20' });
  await app.fastify.listen({ port: 0, host: '127.0.0.1' });
  const { port } = app.fastify.server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  const clients: TestClient[] = [];

  const connect = async (): Promise<TestClient> => {
    const socket: TestSocket = ioClient(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    let state: RoomView | null = null;
    let deck: DeckPayload | null = null;
    let closed: string | null = null;
    const waiters: { predicate: (v: RoomView) => boolean; resolve: (v: RoomView) => void }[] = [];
    socket.on('room:state', (view) => {
      state = view;
      for (const w of [...waiters]) {
        if (w.predicate(view)) {
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(view);
        }
      }
    });
    socket.on('game:deck', (d) => {
      deck = d;
    });
    socket.on('room:closed', (p) => {
      closed = p.reason;
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    const client: TestClient = {
      socket,
      state: () => state,
      deck: () => deck,
      closed: () => closed,
      emit: (event, payload = {}) =>
        new Promise((resolve) => {
          (socket.emit as (e: string, p: object, ack: (r: unknown) => void) => void)(
            event,
            payload,
            (res) => resolve(res as never),
          );
        }),
      waitFor: (predicate, timeoutMs = 3000) =>
        new Promise((resolve, reject) => {
          if (state && predicate(state)) return resolve(state);
          const timer = setTimeout(
            () => reject(new Error('timed out waiting for state')),
            timeoutMs,
          );
          waiters.push({
            predicate,
            resolve: (v) => {
              clearTimeout(timer);
              resolve(v);
            },
          });
        }),
      close: () => socket.close(),
    };
    clients.push(client);
    return client;
  };

  return {
    app,
    url,
    connect,
    async stop() {
      for (const c of clients) c.close();
      await app.close();
    },
  };
}
