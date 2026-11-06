import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_PLAYERS } from '@ortak-perde/shared';
import type { Room, RoomManager } from '../src/game/room-manager';
import { createManager } from './helpers';

function setup(manager: RoomManager = createManager()) {
  const created = manager.createRoom({
    locale: 'tr',
    origin: 'http://localhost:5173',
    ip: '1.1.1.1',
    socketId: 'host',
  });
  if (!created.ok) throw new Error(created.error);
  const room = created.data.room;
  const join = (name: string, socketId = `s-${name}`) => {
    const res = manager.join({ code: room.code, name, avatar: '🦊', socketId });
    if (!res.ok) throw new Error(res.error);
    return res.data.player;
  };
  return { manager, room, join, created: created.data };
}

/** Waits until the async deck build finished. */
async function untilPhase(room: Room, phase: Room['phase']) {
  await vi.waitFor(() => expect(room.phase).toBe(phase), { timeout: 2000 });
}

async function toSwiping(manager: RoomManager, room: Room) {
  expect(manager.start(room)).toEqual({ ok: true, data: null });
  for (const p of room.players) {
    manager.setGenres(room, p, { liked: [18], any: false, disliked: [] });
    manager.setReady(room, p, true);
  }
  await untilPhase(room, 'SWIPING');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('room lifecycle', () => {
  it('creates rooms with a LAN join URL instead of localhost', () => {
    const { room, created } = setup();
    expect(room.code).toMatch(/^[A-Z2-9]{4}$/);
    expect(created.joinUrl).toBe(`http://192.168.1.20:5173/join/${room.code}`);
    expect(created.hostToken.length).toBeGreaterThanOrEqual(16);
  });

  it('walks through every phase', async () => {
    const { manager, room, join } = setup();
    const a = join('Ayşe');
    const b = join('Burak');
    expect(room.phase).toBe('LOBBY');
    await toSwiping(manager, room);
    expect(room.deck).toHaveLength(20);
    // Same movies for everyone, personal order differs
    expect([...a.order].sort()).toEqual([...b.order].sort());
    expect(a.order).not.toEqual(b.order);

    for (const p of [a, b]) for (const id of p.order) manager.swipe(room, p, id, 'like');
    expect(room.phase).toBe('REVEALING');
    expect(room.results?.mode).toBe('match');
    await untilPhase(room, 'RESULTS');

    expect(manager.reset(room, 'replay').ok).toBe(true);
    await untilPhase(room, 'SWIPING');
    expect(room.round).toBe(2);
    // replay prefers movies that were not shown in round 1
    expect(a.swipes).toEqual({});

    for (const p of [a, b]) for (const id of p.order) manager.swipe(room, p, id, 'nope');
    await untilPhase(room, 'RESULTS');
    expect(room.results?.mode).toBe('no-cinema');
    expect(manager.reset(room, 'settings').ok).toBe(true);
    expect(room.phase).toBe('LOBBY');
  });

  it('requires two players to start', () => {
    const { manager, room, join } = setup();
    join('Solo');
    expect(manager.start(room)).toEqual({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
  });

  it('rejects actions outside their phase', () => {
    const { manager, room, join } = setup();
    const a = join('Ayşe');
    expect(manager.swipe(room, a, 1, 'like')).toEqual({ ok: false, error: 'WRONG_PHASE' });
    expect(manager.setGenres(room, a, { liked: [18], any: false, disliked: [] })).toEqual({
      ok: false,
      error: 'WRONG_PHASE',
    });
    expect(manager.forceFinish(room)).toEqual({ ok: false, error: 'WRONG_PHASE' });
    expect(manager.reset(room, 'replay')).toEqual({ ok: false, error: 'WRONG_PHASE' });
    expect(manager.continueToBuilding(room)).toEqual({ ok: false, error: 'WRONG_PHASE' });
  });

  it('closes joining once the game started', () => {
    const { manager, room, join } = setup();
    join('A');
    join('B');
    manager.start(room);
    const res = manager.join({ code: room.code, name: 'Late', avatar: '🐼', socketId: 'late' });
    expect(res).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
  });

  it('caps rooms at 12 players and numbers duplicate names', () => {
    const { manager, room, join } = setup();
    for (let i = 0; i < MAX_PLAYERS; i++) join('Can');
    expect(room.players.map((p) => p.name).slice(0, 3)).toEqual(['Can', 'Can 2', 'Can 3']);
    const res = manager.join({ code: room.code, name: 'One more', avatar: '🐼', socketId: 'x' });
    expect(res).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  it('sanitises names and rejects empty ones', () => {
    const { manager, room, join } = setup();
    expect(join('<b>Zeynep</b>').name).toBe('bZeynepb');
    expect(manager.join({ code: room.code, name: '   ', avatar: '🦊', socketId: 'x' })).toEqual({
      ok: false,
      error: 'INVALID_PAYLOAD',
    });
    expect(manager.join({ code: 'ZZZZ', name: 'A', avatar: '🦊', socketId: 'x' })).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
  });

  it('rate limits room creation per IP', () => {
    const manager = createManager({ roomCreateLimit: { max: 2, windowMs: 60_000 } });
    const create = (ip: string) => manager.createRoom({ locale: 'tr', ip, socketId: 'h' });
    expect(create('9.9.9.9').ok).toBe(true);
    expect(create('9.9.9.9').ok).toBe(true);
    expect(create('9.9.9.9')).toEqual({ ok: false, error: 'RATE_LIMITED' });
    expect(create('8.8.8.8').ok).toBe(true);
  });
});

describe('picking', () => {
  it('needs a genre (or "any") before ready, and ignores unknown genres', () => {
    const { manager, room, join } = setup();
    const a = join('A');
    join('B');
    manager.start(room);
    expect(manager.setReady(room, a, true)).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
    manager.setGenres(room, a, { liked: [18, 999], any: false, disliked: [27, 18] });
    expect(a.preference).toEqual({ liked: [18], any: false, disliked: [27] });
    expect(manager.setReady(room, a, true).ok).toBe(true);
  });

  it('host can continue with only some players ready', async () => {
    const { manager, room, join } = setup();
    const a = join('A');
    join('B');
    manager.start(room);
    expect(manager.continueToBuilding(room)).toEqual({ ok: false, error: 'NO_READY_PLAYERS' });
    manager.setGenres(room, a, { liked: [35], any: false, disliked: [] });
    manager.setReady(room, a, true);
    expect(manager.continueToBuilding(room).ok).toBe(true);
    await untilPhase(room, 'SWIPING');
    // the player who did not pick anything was treated as "any genre"
    expect(room.players[1]!.preference.any).toBe(true);
  });

  it('goes back to the lobby with a notice when no movie matches', async () => {
    const { manager, room, join } = setup();
    join('A');
    join('B');
    manager.updateSettings(room, { yearFrom: 1900, yearTo: 1901 });
    await toSwiping(manager, room).catch(() => undefined);
    await untilPhase(room, 'LOBBY');
    expect(room.notices).toEqual([{ code: 'no-movies' }]);
  });
});

describe('swiping', () => {
  it('rejects unknown movies and double swipes', async () => {
    const { manager, room, join } = setup();
    const a = join('A');
    join('B');
    await toSwiping(manager, room);
    expect(manager.swipe(room, a, 123456, 'like')).toEqual({ ok: false, error: 'INVALID_MOVIE' });
    const id = a.order[0]!;
    expect(manager.swipe(room, a, id, 'like').ok).toBe(true);
    expect(manager.swipe(room, a, id, 'nope')).toEqual({ ok: false, error: 'ALREADY_SWIPED' });
  });

  it('allows a single undo step, never for a veto', async () => {
    const { manager, room, join } = setup();
    const a = join('A');
    join('B');
    await toSwiping(manager, room);
    const [m1, m2, m3] = a.order;
    manager.swipe(room, a, m1!, 'like');
    manager.swipe(room, a, m2!, 'super');
    expect(manager.playerView(room, a).me.canUndo).toBe(true);
    expect(manager.undo(room, a).ok).toBe(true);
    expect(a.swipes[m2!]).toBeUndefined();
    expect(manager.undo(room, a)).toEqual({ ok: false, error: 'NOTHING_TO_UNDO' });

    expect(manager.veto(room, a, m2!).ok).toBe(true);
    expect(manager.undo(room, a)).toEqual({ ok: false, error: 'NOTHING_TO_UNDO' });
    expect(manager.veto(room, a, m3!)).toEqual({ ok: false, error: 'ALREADY_VETOED' });
  });

  it('a veto removes the movie from the results', async () => {
    const { manager, room, join } = setup();
    const a = join('A');
    const b = join('B');
    await toSwiping(manager, room);
    const target = a.order[0]!;
    manager.veto(room, b, target);
    for (const p of [a, b])
      for (const id of p.order) if (!p.swipes[id]) manager.swipe(room, p, id, 'super');
    expect(room.phase).toBe('REVEALING');
    const ids = [room.results!.winner!.movie.id, ...room.results!.podium.map((r) => r.movie.id)];
    expect(ids).not.toContain(target);
  });

  it('host can finish early; views hide other players’ choices', async () => {
    const { manager, room, join } = setup();
    const a = join('A');
    const b = join('B');
    await toSwiping(manager, room);
    manager.swipe(room, a, a.order[0]!, 'like');
    const viewForB = manager.playerView(room, b);
    expect(JSON.stringify(viewForB)).not.toContain('"swipes":{"' + a.order[0]);
    expect(viewForB.players.find((p) => p.id === a.id)?.progress).toBe(1);
    expect(viewForB.me.swipes).toEqual({});
    expect(manager.hostView(room).results).toBeNull();

    expect(manager.forceFinish(room).ok).toBe(true);
    expect(room.phase).toBe('REVEALING');
    // players only see results after the reveal
    expect(manager.playerView(room, b).results).toBeNull();
    expect(manager.hostView(room).results).not.toBeNull();
    await untilPhase(room, 'RESULTS');
    expect(manager.playerView(room, b).results?.winner?.movie.id).toBe(a.order[0]);
  });
});

describe('reconnection and cleanup', () => {
  it('lets a player resume with their token and keeps progress', async () => {
    const { manager, room, join } = setup();
    const a = join('A', 'sock-1');
    join('B');
    await toSwiping(manager, room);
    manager.swipe(room, a, a.order[0]!, 'like');
    manager.playerDisconnected(room.code, a.id, 'sock-1');
    expect(a.connected).toBe(false);

    expect(manager.resumePlayer(room.code, 'wrong-token-xxxxxxxx', 'sock-2')).toEqual({
      ok: false,
      error: 'INVALID_TOKEN',
    });
    const res = manager.resumePlayer(room.code, a.token, 'sock-2');
    expect(res.ok).toBe(true);
    expect(a.connected).toBe(true);
    expect(Object.keys(a.swipes)).toHaveLength(1);
    // a stale disconnect from the old socket must not mark the player offline
    manager.playerDisconnected(room.code, a.id, 'sock-1');
    expect(a.connected).toBe(true);
  });

  it('host can resume; rooms are removed 10 minutes after the host left', () => {
    let now = 1_000_000;
    const manager = createManager({ now: () => now });
    const { room, created } = setup(manager);
    manager.hostDisconnected(room.code, 'host');
    now += 5 * 60_000;
    manager.cleanup();
    expect(manager.resumeHost(room.code, created.hostToken, 'host-2').ok).toBe(true);
    manager.hostDisconnected(room.code, 'host-2');
    now += 10 * 60_000 + 1;
    manager.cleanup();
    expect(manager.getRoom(room.code)).toBeUndefined();
  });

  it('removes rooms older than 3 hours', () => {
    let now = 0;
    const manager = createManager({ now: () => now });
    const { room, join } = setup(manager);
    join('A');
    now = 3 * 60 * 60_000 + 1;
    manager.cleanup();
    expect(manager.getRoom(room.code)).toBeUndefined();
  });

  it('removes empty rooms after a while', () => {
    let now = 0;
    const manager = createManager({ now: () => now });
    const { room } = setup(manager);
    now = 31 * 60_000;
    manager.cleanup();
    expect(manager.getRoom(room.code)).toBeUndefined();
  });
});
