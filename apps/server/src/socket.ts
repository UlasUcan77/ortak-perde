import type { IncomingMessage } from 'node:http';
import type { Server, Socket } from 'socket.io';
import type { ZodType } from 'zod';
import {
  createRoomSchema,
  EVENTS,
  emptySchema,
  hostResumeSchema,
  joinSchema,
  playerResumeSchema,
  readySchema,
  resetSchema,
  setGenresSchema,
  settingsPatchSchema,
  swipeSchema,
  vetoSchema,
  type AckResponse,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@ortak-perde/shared';
import type { Player, Room, RoomManager } from './game/room-manager';

export interface SocketData {
  role: 'host' | 'player' | null;
  code: string | null;
  playerId: string | null;
  ip: string;
}

export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/** Rejects cross-origin browser connections unless the origin is explicitly allowed. */
export function isOriginAllowed(
  origin: string | undefined,
  host: string | undefined,
  allowed: readonly string[],
): boolean {
  if (!origin) return true; // non-browser clients (no Origin header)
  if (allowed.includes(origin)) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Sends every connected participant their own view of the room. */
export function broadcastRoom(io: IoServer, manager: RoomManager, room: Room): void {
  if (room.hostSocketId) io.to(room.hostSocketId).emit(EVENTS.roomState, manager.hostView(room));
  for (const p of room.players) {
    if (p.socketId) io.to(p.socketId).emit(EVENTS.roomState, manager.playerView(room, p));
  }
}

function sendDeck(io: IoServer, room: Room, player: Player): void {
  if (!player.socketId || room.deck.length === 0) return;
  io.to(player.socketId).emit(EVENTS.gameDeck, { round: room.round, movies: room.deck });
}

export function attachSocketHandlers(
  io: IoServer,
  manager: RoomManager,
  opts: { trustProxy: boolean },
): void {
  manager.setListener({
    roomChanged: (room) => broadcastRoom(io, manager, room),
    deckReady: (room) => {
      for (const p of room.players) sendDeck(io, room, p);
    },
    roomClosed: (room, reason) => {
      const ids = [room.hostSocketId, ...room.players.map((p) => p.socketId)].filter(
        (id): id is string => !!id,
      );
      for (const id of ids) {
        io.to(id).emit(EVENTS.roomClosed, { reason });
        const s = io.sockets.sockets.get(id);
        if (s) s.data = { ...s.data, role: null, code: null, playerId: null };
      }
    },
  });

  io.on('connection', (socket: IoSocket) => {
    socket.data = {
      role: null,
      code: null,
      playerId: null,
      ip: clientIp(socket.request, opts.trustProxy),
    };

    /**
     * Registers a handler with schema validation. Payloads failing validation are rejected
     * with INVALID_PAYLOAD; handler exceptions become INTERNAL. Acks are optional for clients.
     */
    function on<S extends ZodType, T>(
      event: keyof ClientToServerEvents,
      schema: S,
      handler: (payload: S['_output']) => AckResponse<T>,
    ): void {
      (socket.on as (ev: string, fn: (...args: unknown[]) => void) => void)(event, (...args) => {
        let payload: unknown = args[0];
        let ack = args[1];
        if (typeof payload === 'function') {
          ack = payload;
          payload = {};
        }
        const reply = (res: AckResponse<T>) => {
          if (typeof ack === 'function') (ack as (r: AckResponse<T>) => void)(res);
        };
        const parsed = schema.safeParse(payload ?? {});
        if (!parsed.success) return reply({ ok: false, error: 'INVALID_PAYLOAD' });
        try {
          reply(handler(parsed.data));
        } catch (err) {
          console.error(`handler ${event} failed:`, err);
          reply({ ok: false, error: 'INTERNAL' });
        }
      });
    }

    const asHost =
      <T>(fn: (room: Room) => AckResponse<T>) =>
      (): AckResponse<T> => {
        const room =
          socket.data.role === 'host' ? manager.hostRoom(socket.data.code, socket.id) : null;
        return room ? fn(room) : { ok: false, error: 'NOT_AUTHORIZED' };
      };
    const asPlayer =
      <P, T>(fn: (room: Room, player: Player, payload: P) => AckResponse<T>) =>
      (payload: P): AckResponse<T> => {
        const found =
          socket.data.role === 'player'
            ? manager.playerFor(socket.data.code, socket.data.playerId, socket.id)
            : null;
        return found
          ? fn(found.room, found.player, payload)
          : { ok: false, error: 'NOT_AUTHORIZED' };
      };

    const leaveCurrent = () => {
      const { role, code, playerId } = socket.data;
      if (role === 'host' && code) manager.hostDisconnected(code, socket.id);
      if (role === 'player' && code && playerId)
        manager.playerDisconnected(code, playerId, socket.id);
      socket.data = { ...socket.data, role: null, code: null, playerId: null };
    };

    // --- host ---------------------------------------------------------------
    on(EVENTS.hostCreateRoom, createRoomSchema, (p) => {
      const res = manager.createRoom({
        locale: p.locale,
        origin: p.origin,
        ip: socket.data.ip,
        socketId: socket.id,
      });
      if (!res.ok) return res;
      leaveCurrent();
      socket.data = { ...socket.data, role: 'host', code: res.data.room.code, playerId: null };
      broadcastRoom(io, manager, res.data.room);
      return {
        ok: true,
        data: {
          code: res.data.room.code,
          hostToken: res.data.hostToken,
          joinUrl: res.data.joinUrl,
        },
      };
    });

    on(EVENTS.hostResume, hostResumeSchema, (p) => {
      const previousHost = manager.getRoom(p.code)?.hostSocketId;
      const res = manager.resumeHost(p.code, p.token, socket.id);
      if (!res.ok) return res;
      if (previousHost && previousHost !== socket.id) {
        const old = io.sockets.sockets.get(previousHost);
        if (old) old.data = { ...old.data, role: null, code: null };
      }
      socket.data = { ...socket.data, role: 'host', code: p.code, playerId: null };
      broadcastRoom(io, manager, res.data);
      return { ok: true, data: { code: p.code } };
    });

    on(EVENTS.hostUpdateSettings, settingsPatchSchema, (p) =>
      asHost((room) => manager.updateSettings(room, p))(),
    );
    on(
      EVENTS.hostStart,
      emptySchema,
      asHost((room) => manager.start(room)),
    );
    on(
      EVENTS.hostContinue,
      emptySchema,
      asHost((room) => manager.continueToBuilding(room)),
    );
    on(
      EVENTS.hostForceFinish,
      emptySchema,
      asHost((room) => manager.forceFinish(room)),
    );
    on(EVENTS.hostReset, resetSchema, (p) => asHost((room) => manager.reset(room, p.mode))());
    on(
      EVENTS.hostClose,
      emptySchema,
      asHost((room) => {
        manager.closeRoom(room, 'host-closed');
        return { ok: true, data: null };
      }),
    );

    // --- players ------------------------------------------------------------
    on(EVENTS.playerJoin, joinSchema, (p) => {
      const res = manager.join({
        code: p.code,
        name: p.name,
        avatar: p.avatar,
        socketId: socket.id,
      });
      if (!res.ok) return res;
      leaveCurrent();
      socket.data = { ...socket.data, role: 'player', code: p.code, playerId: res.data.player.id };
      broadcastRoom(io, manager, res.data.room);
      return {
        ok: true,
        data: { playerId: res.data.player.id, playerToken: res.data.player.token },
      };
    });

    on(EVENTS.playerResume, playerResumeSchema, (p) => {
      const previous = manager
        .getRoom(p.code)
        ?.players.find((pl) => pl.token === p.token)?.socketId;
      const res = manager.resumePlayer(p.code, p.token, socket.id);
      if (!res.ok) return res;
      if (previous && previous !== socket.id) {
        const old = io.sockets.sockets.get(previous);
        if (old) old.data = { ...old.data, role: null, code: null, playerId: null };
      }
      socket.data = { ...socket.data, role: 'player', code: p.code, playerId: res.data.player.id };
      // Deck first, then state, so the client can render the current card immediately.
      sendDeck(io, res.data.room, res.data.player);
      broadcastRoom(io, manager, res.data.room);
      return { ok: true, data: { playerId: res.data.player.id, playerToken: p.token } };
    });

    on(
      EVENTS.playerSetGenres,
      setGenresSchema,
      asPlayer((room, player, p) => manager.setGenres(room, player, p)),
    );
    on(
      EVENTS.playerReady,
      readySchema,
      asPlayer((room, player, p) => manager.setReady(room, player, p.ready)),
    );
    on(
      EVENTS.playerSwipe,
      swipeSchema,
      asPlayer((room, player, p) => manager.swipe(room, player, p.movieId, p.action)),
    );
    on(
      EVENTS.playerUndo,
      emptySchema,
      asPlayer((room, player) => manager.undo(room, player)),
    );
    on(
      EVENTS.playerVeto,
      vetoSchema,
      asPlayer((room, player, p) => manager.veto(room, player, p.movieId)),
    );
    on(
      EVENTS.playerLeave,
      emptySchema,
      asPlayer((room, player) => {
        const res = manager.leave(room, player);
        socket.data = { ...socket.data, role: null, code: null, playerId: null };
        return res;
      }),
    );

    socket.on('disconnect', leaveCurrent);
  });
}
