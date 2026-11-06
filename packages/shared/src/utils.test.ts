import { describe, expect, it } from 'vitest';
import { ROOM_CODE_ALPHABET } from './constants';
import { buildJoinUrl, displayJoinHint, isLoopbackHost, resolveJoinBase } from './join-url';
import { sanitizeName, uniqueName } from './names';
import {
  joinSchema,
  roomCodeSchema,
  setGenresSchema,
  settingsPatchSchema,
  settingsSchema,
  swipeSchema,
} from './protocol';
import { generateRoomCode, normalizeRoomCode } from './room-code';
import { defaultSettings } from './settings';

describe('room codes', () => {
  it('never uses look-alike characters', () => {
    for (const ch of ['0', 'O', '1', 'I', 'L']) expect(ROOM_CODE_ALPHABET).not.toContain(ch);
  });

  it('generates 4-char codes and avoids collisions', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 200; i++) taken.add(generateRoomCode(taken));
    expect(taken.size).toBe(200);
    for (const code of taken) expect(code).toMatch(/^[A-Z2-9]{4}$/);
  });

  it('retries on collision', () => {
    const values = [0, 0, 0, 0, 0.99, 0.99, 0.99, 0.99];
    let i = 0;
    const code = generateRoomCode(new Set(['AAAA']), () => values[i++ % values.length]!);
    expect(code).toBe('9999');
  });

  it('normalises user input', () => {
    expect(normalizeRoomCode(' ab cd ')).toBe('ABCD');
    expect(normalizeRoomCode('AB0D')).toBeNull();
    expect(normalizeRoomCode('ABC')).toBeNull();
    expect(roomCodeSchema.parse('xyz9')).toBe('XYZ9');
    expect(roomCodeSchema.safeParse('OOOO').success).toBe(false);
  });
});

describe('names', () => {
  it('strips markup and control characters', () => {
    expect(sanitizeName('  <script>alert(1)</script> ')).toBe('scriptalert(1)sc');
    expect(sanitizeName('Ali​‮ Veli')).toBe('Ali Veli');
    expect(sanitizeName('   ')).toBe('');
  });

  it('limits to 16 characters, emoji-safe', () => {
    expect(sanitizeName('a'.repeat(30))).toHaveLength(16);
    expect(Array.from(sanitizeName('😀'.repeat(20)))).toHaveLength(16);
  });

  it('numbers duplicates', () => {
    expect(uniqueName('Ayşe', ['ayşe'])).toBe('Ayşe 2');
    expect(uniqueName('Ayşe', ['Ayşe', 'Ayşe 2'])).toBe('Ayşe 3');
    expect(uniqueName('Can', ['Ayşe'])).toBe('Can');
    expect(uniqueName('abcdefghijklmnop', ['abcdefghijklmnop'])).toBe('abcdefghijklmn 2');
  });
});

describe('join URL', () => {
  it('detects loopback hosts', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
    expect(isLoopbackHost('192.168.1.5')).toBe(false);
  });

  it('prefers PUBLIC_URL', () => {
    expect(
      resolveJoinBase({
        publicUrl: 'https://perde.example.com/',
        lanIp: '192.168.1.5',
        origin: 'http://localhost:5173',
      }),
    ).toBe('https://perde.example.com');
  });

  it('swaps localhost for the LAN IP and keeps the dev port', () => {
    expect(resolveJoinBase({ lanIp: '192.168.1.5', origin: 'http://localhost:5173' })).toBe(
      'http://192.168.1.5:5173',
    );
  });

  it('uses the page origin when it is already reachable', () => {
    expect(resolveJoinBase({ lanIp: '10.0.0.2', origin: 'https://perde.app' })).toBe(
      'https://perde.app',
    );
  });

  it('never returns localhost', () => {
    expect(resolveJoinBase({ origin: 'http://localhost:3000' })).toBeNull();
    expect(resolveJoinBase({ publicUrl: 'http://localhost:3000', origin: null })).toBeNull();
  });

  it('builds URLs and hints', () => {
    expect(buildJoinUrl('http://192.168.1.5:3000', 'ABCD')).toBe(
      'http://192.168.1.5:3000/join/ABCD',
    );
    expect(displayJoinHint('https://perde.app')).toBe('perde.app/join');
    expect(buildJoinUrl(null, 'ABCD')).toBeNull();
  });
});

describe('schemas', () => {
  it('accepts default settings', () => {
    expect(settingsSchema.safeParse(defaultSettings()).success).toBe(true);
  });

  it('rejects unknown keys, bad deck sizes and inverted year ranges', () => {
    expect(settingsPatchSchema.safeParse({ includeAdult: true }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ deckSize: 12 }).success).toBe(false);
    expect(
      settingsSchema.safeParse({ ...defaultSettings(), yearFrom: 2020, yearTo: 2000 }).success,
    ).toBe(false);
  });

  it('validates join payloads', () => {
    expect(joinSchema.safeParse({ code: 'abcd', name: 'Ali', avatar: '🦊' }).success).toBe(true);
    expect(joinSchema.safeParse({ code: 'abcd', name: 'Ali', avatar: '💩' }).success).toBe(false);
  });

  it('validates swipes and genre preferences', () => {
    expect(swipeSchema.safeParse({ movieId: 5, action: 'super' }).success).toBe(true);
    expect(swipeSchema.safeParse({ movieId: 5, action: 'maybe' }).success).toBe(false);
    expect(setGenresSchema.safeParse({ liked: [28], any: false, disliked: [28] }).success).toBe(
      false,
    );
  });
});
