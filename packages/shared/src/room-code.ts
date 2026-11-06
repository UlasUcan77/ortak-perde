import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants';

/** Generates a room code that is not in `taken`. `random` returns floats in [0, 1). */
export function generateRoomCode(
  taken: { has(code: string): boolean },
  random: () => number = Math.random,
  maxAttempts = 1000,
): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
    }
    if (!taken.has(code)) return code;
  }
  throw new Error('Could not allocate a unique room code');
}

/** Normalises user input ("ab cd" → "ABCD"); returns null if it cannot be a valid code. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.replace(/\s+/g, '').toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  }
  return code;
}
