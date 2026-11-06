import crypto from 'node:crypto';
import {
  buildJoinUrl,
  computeResults,
  defaultSettings,
  generateRoomCode,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  MOVIE_GENRE_IDS,
  personalOrder,
  resolveJoinBase,
  sanitizeName,
  settingsSchema,
  uniqueName,
  type AckResponse,
  type CatalogMode,
  type CloseReason,
  type DeckNotice,
  type ErrorCode,
  type GameResults,
  type GenrePreference,
  type HostView,
  type Locale,
  type Movie,
  type Phase,
  type PlayerPublic,
  type PlayerView,
  type RoomSettings,
  type SettingsPatch,
  type SwipeAction,
} from '@ortak-perde/shared';
import type { MovieCatalog } from '../catalog/types';
import { createDeck, NoMoviesError } from './deck-service';
import { RateLimiter } from './rate-limiter';

export type Result<T = null> = AckResponse<T>;
const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const OK: Result = { ok: true, data: null };
const fail = (error: ErrorCode): { ok: false; error: ErrorCode } => ({ ok: false, error });

export interface Player {
  id: string;
  token: string;
  name: string;
  avatar: string;
  socketId: string | null;
  connected: boolean;
  joinedAt: number;
  preference: GenrePreference;
  ready: boolean;
  order: number[];
  swipes: Record<number, SwipeAction>;
  /** Movie ids in the order they were swiped (for undo). */
  history: number[];
  /** Undo is allowed exactly one step back, and never for a veto. */
  undoAvailable: boolean;
  vetoMovieId: number | null;
}

export interface Room {
  code: string;
  hostToken: string;
  hostSocketId: string | null;
  hostConnected: boolean;
  hostLastSeen: number;
  createdAt: number;
  lastActivity: number;
  locale: Locale;
  joinBase: string | null;
  phase: Phase;
  round: number;
  settings: RoomSettings;
  players: Player[];
  deck: Movie[];
  seenIds: Set<number>;
  catalogMode: CatalogMode;
  notices: DeckNotice[];
  results: GameResults | null;
  revealEndsAt: number | null;
  revealTimer: NodeJS.Timeout | null;
}

export interface RoomListener {
  /** Something visible changed: broadcast fresh views. */
  roomChanged(room: Room): void;
  /** A new deck was built: send it to every player before the state update. */
  deckReady(room: Room): void;
  /** The room is gone. */
  roomClosed(room: Room, reason: CloseReason): void;
}

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export interface RoomManagerOptions {
  catalog: MovieCatalog;
  fallbackCatalog?: MovieCatalog | null;
  publicUrl?: string | null;
  lanIp?: string | null;
  revealMs: number;
  buildMinMs: number;
  hostGraceMs: number;
  maxRoomAgeMs: number;
  emptyRoomMs: number;
  roomCreateLimit: { max: number; windowMs: number };
  now?: () => number;
  logger?: Logger;
}

const NOOP_LISTENER: RoomListener = {
  roomChanged() {},
  deckReady() {},
  roomClosed() {},
};

const KNOWN_GENRES = new Set<number>(MOVIE_GENRE_IDS);

function token(bytes = 18): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sameToken(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function swipeCount(p: Player): number {
  return Object.keys(p.swipes).length;
}

/**
 * Owns every room and enforces the game rules. The server is authoritative: every method
 * validates the phase and the caller's rights and returns an error code instead of throwing.
 * Socket-level concerns (who is calling, broadcasting) live in socket.ts.
 */
export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private listener: RoomListener = NOOP_LISTENER;
  private readonly createLimiter: RateLimiter;
  private readonly now: () => number;
  private readonly log: Logger;

  constructor(private readonly opts: RoomManagerOptions) {
    this.now = opts.now ?? Date.now;
    this.createLimiter = new RateLimiter(
      opts.roomCreateLimit.max,
      opts.roomCreateLimit.windowMs,
      this.now,
    );
    this.log = opts.logger ?? { info() {}, warn() {}, error() {} };
  }

  setListener(listener: RoomListener): void {
    this.listener = listener;
  }

  get catalogMode(): CatalogMode {
    return this.opts.catalog.mode;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  private touch(room: Room): void {
    room.lastActivity = this.now();
  }

  private changed(room: Room): void {
    this.touch(room);
    this.listener.roomChanged(room);
  }

  // -------------------------------------------------------------------------
  // Host
  // -------------------------------------------------------------------------

  createRoom(input: {
    locale: Locale;
    origin?: string;
    ip: string;
    socketId: string;
  }): Result<{ room: Room; hostToken: string; joinUrl: string | null }> {
    if (!this.createLimiter.hit(input.ip)) return fail('RATE_LIMITED');
    const code = generateRoomCode(this.rooms);
    const now = this.now();
    const joinBase = resolveJoinBase({
      publicUrl: this.opts.publicUrl,
      lanIp: this.opts.lanIp,
      origin: input.origin,
    });
    const room: Room = {
      code,
      hostToken: token(),
      hostSocketId: input.socketId,
      hostConnected: true,
      hostLastSeen: now,
      createdAt: now,
      lastActivity: now,
      locale: input.locale,
      joinBase,
      phase: 'LOBBY',
      round: 0,
      settings: defaultSettings(new Date(now)),
      players: [],
      deck: [],
      seenIds: new Set(),
      catalogMode: this.opts.catalog.mode,
      notices: [],
      results: null,
      revealEndsAt: null,
      revealTimer: null,
    };
    this.rooms.set(code, room);
    this.log.info(`room ${code} created (${this.rooms.size} active)`);
    return ok({ room, hostToken: room.hostToken, joinUrl: buildJoinUrl(joinBase, code) });
  }

  resumeHost(code: string, hostToken: string, socketId: string): Result<Room> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');
    if (!sameToken(room.hostToken, hostToken)) return fail('INVALID_TOKEN');
    room.hostSocketId = socketId;
    room.hostConnected = true;
    room.hostLastSeen = this.now();
    this.changed(room);
    return ok(room);
  }

  hostDisconnected(code: string, socketId: string): void {
    const room = this.rooms.get(code);
    if (!room || room.hostSocketId !== socketId) return;
    room.hostSocketId = null;
    room.hostConnected = false;
    room.hostLastSeen = this.now();
    this.changed(room);
  }

  /** Returns the room if `socketId` is its current host connection. */
  hostRoom(code: string | null, socketId: string): Room | null {
    if (!code) return null;
    const room = this.rooms.get(code);
    return room && room.hostSocketId === socketId ? room : null;
  }

  updateSettings(room: Room, patch: SettingsPatch): Result {
    if (room.phase !== 'LOBBY' && room.phase !== 'RESULTS') return fail('WRONG_PHASE');
    const parsed = settingsSchema.safeParse({ ...room.settings, ...patch });
    if (!parsed.success) return fail('INVALID_PAYLOAD');
    room.settings = parsed.data as RoomSettings;
    this.changed(room);
    return OK;
  }

  /** LOBBY → PICKING */
  start(room: Room): Result {
    if (room.phase !== 'LOBBY') return fail('WRONG_PHASE');
    if (room.players.length < MIN_PLAYERS_TO_START) return fail('NOT_ENOUGH_PLAYERS');
    room.phase = 'PICKING';
    room.notices = [];
    room.results = null;
    for (const p of room.players) p.ready = false;
    this.changed(room);
    return OK;
  }

  /** PICKING → BUILDING, even if not everybody is ready. */
  continueToBuilding(room: Room): Result {
    if (room.phase !== 'PICKING') return fail('WRONG_PHASE');
    if (!room.players.some((p) => p.ready)) return fail('NO_READY_PLAYERS');
    void this.build(room);
    return OK;
  }

  /** SWIPING → REVEALING */
  forceFinish(room: Room): Result {
    if (room.phase !== 'SWIPING') return fail('WRONG_PHASE');
    this.reveal(room);
    return OK;
  }

  /** RESULTS → BUILDING (replay with the same tastes) or → LOBBY (change settings). */
  reset(room: Room, mode: 'replay' | 'settings'): Result {
    if (room.phase !== 'RESULTS' && room.phase !== 'REVEALING') return fail('WRONG_PHASE');
    this.clearRevealTimer(room);
    if (mode === 'settings') {
      room.phase = 'LOBBY';
      room.results = null;
      room.notices = [];
      room.deck = [];
      for (const p of room.players) this.resetRoundState(p);
      this.changed(room);
      return OK;
    }
    if (room.players.length === 0) return fail('NOT_ENOUGH_PLAYERS');
    void this.build(room);
    return OK;
  }

  closeRoom(room: Room, reason: CloseReason): void {
    this.clearRevealTimer(room);
    this.rooms.delete(room.code);
    this.log.info(`room ${room.code} closed (${reason})`);
    this.listener.roomClosed(room, reason);
  }

  // -------------------------------------------------------------------------
  // Players
  // -------------------------------------------------------------------------

  join(input: { code: string; name: string; avatar: string; socketId: string }): Result<{
    room: Room;
    player: Player;
  }> {
    const room = this.rooms.get(input.code);
    if (!room) return fail('ROOM_NOT_FOUND');
    if (room.phase !== 'LOBBY') return fail('GAME_IN_PROGRESS');
    if (room.players.length >= MAX_PLAYERS) return fail('ROOM_FULL');
    const clean = sanitizeName(input.name);
    if (!clean) return fail('INVALID_PAYLOAD');
    const player: Player = {
      id: token(6),
      token: token(),
      name: uniqueName(
        clean,
        room.players.map((p) => p.name),
      ),
      avatar: input.avatar,
      socketId: input.socketId,
      connected: true,
      joinedAt: this.now(),
      preference: { liked: [], any: false, disliked: [] },
      ready: false,
      order: [],
      swipes: {},
      history: [],
      undoAvailable: false,
      vetoMovieId: null,
    };
    room.players.push(player);
    this.changed(room);
    return ok({ room, player });
  }

  resumePlayer(
    code: string,
    playerToken: string,
    socketId: string,
  ): Result<{ room: Room; player: Player }> {
    const room = this.rooms.get(code);
    if (!room) return fail('ROOM_NOT_FOUND');
    const player = room.players.find((p) => sameToken(p.token, playerToken));
    if (!player) return fail('INVALID_TOKEN');
    player.socketId = socketId;
    player.connected = true;
    this.changed(room);
    return ok({ room, player });
  }

  playerDisconnected(code: string, playerId: string, socketId: string): void {
    const room = this.rooms.get(code);
    const player = room?.players.find((p) => p.id === playerId);
    if (!room || !player || player.socketId !== socketId) return;
    player.socketId = null;
    player.connected = false;
    this.changed(room);
  }

  /** Returns room + player if `socketId` is that player's current connection. */
  playerFor(
    code: string | null,
    playerId: string | null,
    socketId: string,
  ): { room: Room; player: Player } | null {
    if (!code || !playerId) return null;
    const room = this.rooms.get(code);
    const player = room?.players.find((p) => p.id === playerId);
    if (!room || !player || player.socketId !== socketId) return null;
    return { room, player };
  }

  leave(room: Room, player: Player): Result {
    room.players = room.players.filter((p) => p !== player);
    if (room.players.length === 0 && room.phase !== 'LOBBY') {
      this.clearRevealTimer(room);
      room.phase = 'LOBBY';
      room.deck = [];
      room.results = null;
    }
    this.changed(room);
    if (room.phase === 'PICKING') this.maybeFinishPicking(room);
    if (room.phase === 'SWIPING') this.maybeFinishSwiping(room);
    return OK;
  }

  setGenres(room: Room, player: Player, pref: GenrePreference): Result {
    if (room.phase !== 'PICKING') return fail('WRONG_PHASE');
    const liked = [...new Set(pref.liked.filter((g) => KNOWN_GENRES.has(g)))];
    const disliked = [
      ...new Set(pref.disliked.filter((g) => KNOWN_GENRES.has(g) && !liked.includes(g))),
    ];
    player.preference = { liked, any: pref.any, disliked };
    if (liked.length === 0 && !pref.any) player.ready = false;
    this.changed(room);
    return OK;
  }

  setReady(room: Room, player: Player, ready: boolean): Result {
    if (room.phase !== 'PICKING') return fail('WRONG_PHASE');
    if (ready && player.preference.liked.length === 0 && !player.preference.any) {
      return fail('INVALID_PAYLOAD');
    }
    player.ready = ready;
    this.changed(room);
    this.maybeFinishPicking(room);
    return OK;
  }

  swipe(room: Room, player: Player, movieId: number, action: SwipeAction): Result {
    if (room.phase !== 'SWIPING') return fail('WRONG_PHASE');
    if (!player.order.includes(movieId)) return fail('INVALID_MOVIE');
    if (player.swipes[movieId]) return fail('ALREADY_SWIPED');
    player.swipes[movieId] = action;
    player.history.push(movieId);
    player.undoAvailable = true;
    this.changed(room);
    this.maybeFinishSwiping(room);
    return OK;
  }

  undo(room: Room, player: Player): Result {
    if (room.phase !== 'SWIPING') return fail('WRONG_PHASE');
    const last = player.history.at(-1);
    if (last === undefined || !player.undoAvailable || last === player.vetoMovieId) {
      return fail('NOTHING_TO_UNDO');
    }
    player.history.pop();
    delete player.swipes[last];
    player.undoAvailable = false;
    this.changed(room);
    return OK;
  }

  /** "ASLA": vetoes the given (not yet swiped) movie. Once per player per round. */
  veto(room: Room, player: Player, movieId: number): Result {
    if (room.phase !== 'SWIPING') return fail('WRONG_PHASE');
    if (player.vetoMovieId !== null) return fail('ALREADY_VETOED');
    if (!player.order.includes(movieId)) return fail('INVALID_MOVIE');
    if (player.swipes[movieId]) return fail('ALREADY_SWIPED');
    player.vetoMovieId = movieId;
    player.swipes[movieId] = 'nope';
    player.history.push(movieId);
    player.undoAvailable = false;
    this.changed(room);
    this.maybeFinishSwiping(room);
    return OK;
  }

  // -------------------------------------------------------------------------
  // Transitions
  // -------------------------------------------------------------------------

  private maybeFinishPicking(room: Room): void {
    if (room.phase !== 'PICKING') return;
    if (room.players.length >= MIN_PLAYERS_TO_START && room.players.every((p) => p.ready)) {
      void this.build(room);
    }
  }

  private isFinished(p: Player): boolean {
    return p.order.length > 0 && swipeCount(p) >= p.order.length;
  }

  private maybeFinishSwiping(room: Room): void {
    if (room.phase !== 'SWIPING') return;
    if (room.players.length > 0 && room.players.every((p) => this.isFinished(p))) this.reveal(room);
  }

  private resetRoundState(p: Player): void {
    p.ready = false;
    p.order = [];
    p.swipes = {};
    p.history = [];
    p.undoAvailable = false;
    p.vetoMovieId = null;
  }

  /** BUILDING: builds a deck asynchronously, then moves to SWIPING (or back to LOBBY). */
  private async build(room: Room): Promise<void> {
    this.clearRevealTimer(room);
    room.phase = 'BUILDING';
    room.round += 1;
    room.results = null;
    room.revealEndsAt = null;
    room.notices = [];
    const round = room.round;
    for (const p of room.players) {
      // Players that never picked anything get "anything goes".
      if (p.preference.liked.length === 0) p.preference = { ...p.preference, any: true };
    }
    this.changed(room);

    const started = this.now();
    let outcome: Awaited<ReturnType<typeof createDeck>> | null = null;
    let failure: DeckNotice | null = null;
    try {
      outcome = await createDeck(
        this.opts.catalog,
        this.opts.fallbackCatalog ?? null,
        {
          players: room.players.map((p) => ({ id: p.id, preference: p.preference })),
          settings: room.settings,
          locale: room.locale,
          seenIds: room.seenIds,
          seed: `${room.code}:${round}`,
        },
        (err) => this.log.warn(`catalog failed, using sample data: ${(err as Error).message}`),
      );
    } catch (err) {
      failure = { code: err instanceof NoMoviesError ? 'no-movies' : 'build-failed' };
      if (!(err instanceof NoMoviesError))
        this.log.error(`deck build failed: ${(err as Error).message}`);
    }

    const wait = this.opts.buildMinMs - (this.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    // The room may have been closed or reset while we were waiting.
    if (this.rooms.get(room.code) !== room || room.round !== round || room.phase !== 'BUILDING')
      return;

    if (!outcome) {
      room.phase = 'LOBBY';
      room.notices = failure ? [failure] : [];
      for (const p of room.players) this.resetRoundState(p);
      this.changed(room);
      return;
    }

    room.deck = outcome.movies;
    room.catalogMode = outcome.catalogMode;
    room.notices = outcome.notices;
    const ids = outcome.movies.map((m) => m.id);
    for (const id of ids) room.seenIds.add(id);
    for (const p of room.players) {
      this.resetRoundState(p);
      p.order = personalOrder(ids, `${room.code}:${p.id}:${round}`);
    }
    room.phase = 'SWIPING';
    this.listener.deckReady(room);
    this.changed(room);
  }

  /** REVEALING for `revealMs`, then RESULTS. */
  private reveal(room: Room): void {
    room.phase = 'REVEALING';
    room.results = computeResults({
      movies: room.deck,
      players: room.players.map((p) => ({
        id: p.id,
        swipes: p.swipes,
        vetoMovieId: p.vetoMovieId,
      })),
    });
    room.revealEndsAt = this.now() + this.opts.revealMs;
    this.clearRevealTimer(room);
    room.revealTimer = setTimeout(() => {
      room.revealTimer = null;
      if (this.rooms.get(room.code) !== room || room.phase !== 'REVEALING') return;
      room.phase = 'RESULTS';
      this.changed(room);
    }, this.opts.revealMs);
    room.revealTimer.unref?.();
    this.changed(room);
  }

  private clearRevealTimer(room: Room): void {
    if (room.revealTimer) clearTimeout(room.revealTimer);
    room.revealTimer = null;
  }

  // -------------------------------------------------------------------------
  // Housekeeping
  // -------------------------------------------------------------------------

  /** Removes expired rooms. Called periodically. */
  cleanup(): void {
    const now = this.now();
    for (const room of [...this.rooms.values()]) {
      if (now - room.createdAt > this.opts.maxRoomAgeMs) this.closeRoom(room, 'expired');
      else if (!room.hostConnected && now - room.hostLastSeen > this.opts.hostGraceMs) {
        this.closeRoom(room, 'host-timeout');
      } else if (room.players.length === 0 && now - room.lastActivity > this.opts.emptyRoomMs) {
        this.closeRoom(room, 'expired');
      }
    }
    this.createLimiter.prune();
  }

  // -------------------------------------------------------------------------
  // Views (sanitised state sent to clients)
  // -------------------------------------------------------------------------

  private publicPlayer(p: Player): PlayerPublic {
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      connected: p.connected,
      ready: p.ready,
      progress: swipeCount(p),
      finished: this.isFinished(p),
    };
  }

  private baseView(room: Room) {
    return {
      code: room.code,
      phase: room.phase,
      round: room.round,
      players: room.players.map((p) => this.publicPlayer(p)),
      settings: room.settings,
      deckLength: room.deck.length,
      catalogMode: room.catalogMode,
      notices: room.notices,
      hostConnected: room.hostConnected,
    };
  }

  hostView(room: Room): HostView {
    const showResults = room.phase === 'REVEALING' || room.phase === 'RESULTS';
    return {
      ...this.baseView(room),
      role: 'host',
      joinBase: room.joinBase,
      joinUrl: buildJoinUrl(room.joinBase, room.code),
      results: showResults ? room.results : null,
      revealEndsAt: room.phase === 'REVEALING' ? room.revealEndsAt : null,
    };
  }

  playerView(room: Room, player: Player): PlayerView {
    const last = player.history.at(-1);
    return {
      ...this.baseView(room),
      role: 'player',
      me: {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        preference: player.preference,
        ready: player.ready,
        order: player.order,
        swipes: { ...player.swipes },
        vetoMovieId: player.vetoMovieId,
        canUndo:
          room.phase === 'SWIPING' &&
          player.undoAvailable &&
          last !== undefined &&
          last !== player.vetoMovieId,
        finished: this.isFinished(player),
      },
      results: room.phase === 'RESULTS' ? room.results : null,
    };
  }
}
