import { afterEach, describe, expect, it } from 'vitest';
import type { HostView, PlayerView, RoomView } from '@ortak-perde/shared';
import { startServer } from './helpers';

let server: Awaited<ReturnType<typeof startServer>> | null = null;

afterEach(async () => {
  await server?.stop();
  server = null;
});

const isPhase = (phase: RoomView['phase']) => (v: RoomView) => v.phase === phase;

describe('end-to-end over Socket.IO', () => {
  it('create room → join → pick genres → swipe → results', async () => {
    server = await startServer();
    const host = await server.connect();
    const created = await host.emit<{ code: string; hostToken: string; joinUrl: string }>(
      'host:create-room',
      {
        locale: 'tr',
        origin: 'http://localhost:5173',
      },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const { code } = created.data;
    expect(created.data.joinUrl).toBe(`http://192.168.1.20:5173/join/${code}`);

    const names = ['Ayşe', 'Burak', 'Cem'];
    const players = await Promise.all(names.map(() => server!.connect()));
    for (const [i, p] of players.entries()) {
      const res = await p.emit('player:join', {
        code: code.toLowerCase(),
        name: names[i],
        avatar: '🐼',
      });
      expect(res.ok).toBe(true);
    }
    const lobby = (await host.waitFor((v) => v.players.length === 3)) as HostView;
    expect(lobby.players.map((p) => p.name)).toEqual(names);

    expect((await host.emit('host:start')).ok).toBe(true);
    const genres = [[28], [35], [18, 878]];
    for (const [i, p] of players.entries()) {
      await p.waitFor(isPhase('PICKING'));
      expect(
        (await p.emit('player:set-genres', { liked: genres[i], any: false, disliked: [27] })).ok,
      ).toBe(true);
      expect((await p.emit('player:ready', { ready: true })).ok).toBe(true);
    }

    for (const p of players) {
      const view = (await p.waitFor(isPhase('SWIPING'))) as PlayerView;
      const deck = p.deck();
      expect(deck?.movies).toHaveLength(20);
      expect(deck!.movies.some((m) => m.genreIds.includes(27))).toBe(false);
      expect(view.me.order).toHaveLength(20);
    }

    // Everyone likes the first card of player 0's deck; otherwise nope.
    const favourite = (players[0]!.state() as PlayerView).me.order[0]!;
    await Promise.all(
      players.map(async (p) => {
        for (const id of (p.state() as PlayerView).me.order) {
          const res = await p.emit('player:swipe', {
            movieId: id,
            action: id === favourite ? 'super' : 'nope',
          });
          expect(res.ok).toBe(true);
        }
      }),
    );

    const revealing = (await host.waitFor(isPhase('REVEALING'))) as HostView;
    expect(revealing.results?.winner?.movie.id).toBe(favourite);
    expect(revealing.results?.mode).toBe('match');
    expect(revealing.results?.winner?.likedBy).toHaveLength(3);

    const final = (await players[1]!.waitFor(isPhase('RESULTS'))) as PlayerView;
    expect(final.results?.winner?.movie.id).toBe(favourite);
  });

  it('rejects invalid payloads, unauthorised and out-of-phase events', async () => {
    server = await startServer();
    const host = await server.connect();
    const stranger = await server.connect();

    expect(await host.emit('host:create-room', { locale: 'xx' })).toEqual({
      ok: false,
      error: 'INVALID_PAYLOAD',
    });
    const created = await host.emit<{ code: string }>('host:create-room', { locale: 'en' });
    if (!created.ok) throw new Error('create failed');
    const { code } = created.data;

    // a non-host socket cannot drive the room
    expect(await stranger.emit('host:start')).toEqual({ ok: false, error: 'NOT_AUTHORIZED' });
    expect(await stranger.emit('player:swipe', { movieId: 1, action: 'like' })).toEqual({
      ok: false,
      error: 'NOT_AUTHORIZED',
    });
    // unknown fields are rejected
    expect(await host.emit('host:update-settings', { includeAdult: true })).toEqual({
      ok: false,
      error: 'INVALID_PAYLOAD',
    });
    expect((await host.emit('host:update-settings', { deckSize: 10, minRating: 7 })).ok).toBe(true);
    expect(await host.emit('host:force-finish')).toEqual({ ok: false, error: 'WRONG_PHASE' });
    expect(
      await stranger.emit('player:join', { code, name: 'X', avatar: 'not-an-avatar' }),
    ).toEqual({
      ok: false,
      error: 'INVALID_PAYLOAD',
    });
    expect(await stranger.emit('player:join', { code: 'ZZZZ', name: 'X', avatar: '🦊' })).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
  });

  it('a player can reconnect with their token and keep progress', async () => {
    server = await startServer();
    const host = await server.connect();
    const created = await host.emit<{ code: string }>('host:create-room', { locale: 'tr' });
    if (!created.ok) throw new Error('create failed');
    const { code } = created.data;

    const a = await server.connect();
    const b = await server.connect();
    const joined = await a.emit<{ playerToken: string }>('player:join', {
      code,
      name: 'A',
      avatar: '🦊',
    });
    await b.emit('player:join', { code, name: 'B', avatar: '🐼' });
    if (!joined.ok) throw new Error('join failed');

    await host.emit('host:start');
    for (const p of [a, b]) {
      await p.waitFor(isPhase('PICKING'));
      await p.emit('player:set-genres', { liked: [], any: true, disliked: [] });
      await p.emit('player:ready', { ready: true });
    }
    const view = (await a.waitFor(isPhase('SWIPING'))) as PlayerView;
    await a.emit('player:swipe', { movieId: view.me.order[0], action: 'like' });
    a.close();
    await host.waitFor((v) => v.players.some((p) => p.name === 'A' && !p.connected));

    const again = await server.connect();
    const resumed = await again.emit('player:resume', { code, token: joined.data.playerToken });
    expect(resumed.ok).toBe(true);
    const back = (await again.waitFor((v) => v.role === 'player')) as PlayerView;
    expect(Object.keys(back.me.swipes)).toHaveLength(1);
    expect(again.deck()?.movies).toHaveLength(20);
    await host.waitFor((v) => v.players.every((p) => p.connected));
  });

  it('notifies everyone when the host closes the room', async () => {
    server = await startServer();
    const host = await server.connect();
    const created = await host.emit<{ code: string }>('host:create-room', { locale: 'tr' });
    if (!created.ok) throw new Error('create failed');
    const p = await server.connect();
    await p.emit('player:join', { code: created.data.code, name: 'A', avatar: '🦊' });
    expect((await host.emit('host:close')).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(p.closed()).toBe('host-closed');
    expect(server.app.manager.rooms.size).toBe(0);
  });

  it('rate limits room creation per IP', async () => {
    server = await startServer({ roomCreateLimit: { max: 2, windowMs: 60_000 } });
    const host = await server.connect();
    expect((await host.emit('host:create-room', { locale: 'tr' })).ok).toBe(true);
    expect((await host.emit('host:create-room', { locale: 'tr' })).ok).toBe(true);
    expect(await host.emit('host:create-room', { locale: 'tr' })).toEqual({
      ok: false,
      error: 'RATE_LIMITED',
    });
  });

  it('serves meta and health over HTTP and rejects foreign origins', async () => {
    server = await startServer();
    const meta = (await fetch(`${server.url}/api/meta?lang=en`).then((r) => r.json())) as {
      catalogMode: string;
      genres: { id: number; name: string }[];
    };
    expect(meta.catalogMode).toBe('sample');
    expect(meta.genres.find((g) => g.id === 878)?.name).toBe('Science Fiction');
    const health = await fetch(`${server.url}/api/health`);
    expect(health.headers.get('x-content-type-options')).toBe('nosniff');

    const res = await fetch(`${server.url}/socket.io/?EIO=4&transport=polling`, {
      headers: { origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
  });
});
