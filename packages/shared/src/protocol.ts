import { z } from 'zod';
import { AVATARS, DECK_SIZES, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants';
import type { DeckPayload, RoomView } from './types';

/** Socket.IO event names. Client → server events always carry a payload object and an ack. */
export const EVENTS = {
  hostCreateRoom: 'host:create-room',
  hostResume: 'host:resume',
  hostUpdateSettings: 'host:update-settings',
  hostStart: 'host:start',
  hostContinue: 'host:continue',
  hostForceFinish: 'host:force-finish',
  hostReset: 'host:reset',
  hostClose: 'host:close',
  playerJoin: 'player:join',
  playerResume: 'player:resume',
  playerSetGenres: 'player:set-genres',
  playerReady: 'player:ready',
  playerSwipe: 'player:swipe',
  playerUndo: 'player:undo',
  playerVeto: 'player:veto',
  playerLeave: 'player:leave',
  roomState: 'room:state',
  gameDeck: 'game:deck',
  roomClosed: 'room:closed',
} as const;

export const ERROR_CODES = [
  'INVALID_PAYLOAD',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'GAME_IN_PROGRESS',
  'WRONG_PHASE',
  'NOT_AUTHORIZED',
  'INVALID_TOKEN',
  'RATE_LIMITED',
  'NOT_ENOUGH_PLAYERS',
  'NO_READY_PLAYERS',
  'INVALID_MOVIE',
  'ALREADY_SWIPED',
  'ALREADY_VETOED',
  'NOTHING_TO_UNDO',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type AckResponse<T = null> = { ok: true; data: T } | { ok: false; error: ErrorCode };
export type Ack<T = null> = (res: AckResponse<T>) => void;

export type CloseReason = 'host-closed' | 'expired' | 'host-timeout' | 'left';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const codeChars = ROOM_CODE_ALPHABET.replace(/[-\\^\]]/g, '\\$&');
const ROOM_CODE_REGEX = new RegExp(`^[${codeChars}]{${ROOM_CODE_LENGTH}}$`);

export const roomCodeSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(ROOM_CODE_REGEX));

export const tokenSchema = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

const genreIdSchema = z.number().int().positive().max(1_000_000);
const movieIdSchema = z.number().int().positive().max(1_000_000_000);

export const deckSizeSchema = z.union(
  DECK_SIZES.map((n) => z.literal(n)) as [
    z.ZodLiteral<10>,
    z.ZodLiteral<15>,
    z.ZodLiteral<20>,
    z.ZodLiteral<30>,
  ],
);

const settingsShape = {
  deckSize: deckSizeSchema,
  yearFrom: z.number().int().min(1900).max(2100),
  yearTo: z.number().int().min(1900).max(2100),
  minRating: z.number().min(0).max(9),
  maxRuntime: z.number().int().min(60).max(400).nullable(),
  minVotes: z.number().int().min(0).max(100_000),
  originalLanguage: z
    .string()
    .regex(/^[a-z]{2}$/)
    .nullable(),
  region: z.string().regex(/^[A-Z]{2}$/),
  providerIds: z.array(z.number().int().positive().max(1_000_000)).max(30),
};

export const settingsSchema = z
  .object(settingsShape)
  .strict()
  .refine((s) => s.yearFrom <= s.yearTo, { message: 'yearFrom must be <= yearTo' });

export const settingsPatchSchema = z.object(settingsShape).partial().strict();

export const createRoomSchema = z
  .object({
    locale: z.enum(['tr', 'en']),
    /** window.location.origin of the host screen, used to compute the join URL. */
    origin: z.string().max(200).optional(),
  })
  .strict();

export const hostResumeSchema = z.object({ code: roomCodeSchema, token: tokenSchema }).strict();
export const playerResumeSchema = hostResumeSchema;

export const joinSchema = z
  .object({
    code: roomCodeSchema,
    name: z.string().max(100),
    avatar: z.enum(AVATARS),
  })
  .strict();

export const setGenresSchema = z
  .object({
    liked: z.array(genreIdSchema).max(25),
    any: z.boolean(),
    disliked: z.array(genreIdSchema).max(25),
  })
  .strict()
  .refine((p) => !p.liked.some((g) => p.disliked.includes(g)), {
    message: 'a genre cannot be both liked and disliked',
  });

export const readySchema = z.object({ ready: z.boolean() }).strict();

export const swipeSchema = z
  .object({ movieId: movieIdSchema, action: z.enum(['like', 'nope', 'super']) })
  .strict();

export const vetoSchema = z.object({ movieId: movieIdSchema }).strict();

export const resetSchema = z.object({ mode: z.enum(['replay', 'settings']) }).strict();

export const emptySchema = z.object({}).strict();

export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type ResumePayload = z.infer<typeof hostResumeSchema>;
export type JoinPayload = z.infer<typeof joinSchema>;
export type SetGenresPayload = z.infer<typeof setGenresSchema>;
export type SwipePayload = z.infer<typeof swipeSchema>;
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
export type ResetPayload = z.infer<typeof resetSchema>;

export interface CreateRoomResult {
  code: string;
  hostToken: string;
  joinUrl: string | null;
}

export interface JoinResult {
  playerId: string;
  playerToken: string;
}

type Empty = Record<string, never>;

export interface ClientToServerEvents {
  'host:create-room': (p: CreateRoomPayload, ack: Ack<CreateRoomResult>) => void;
  'host:resume': (p: ResumePayload, ack: Ack<{ code: string }>) => void;
  'host:update-settings': (p: SettingsPatch, ack: Ack) => void;
  'host:start': (p: Empty, ack: Ack) => void;
  'host:continue': (p: Empty, ack: Ack) => void;
  'host:force-finish': (p: Empty, ack: Ack) => void;
  'host:reset': (p: ResetPayload, ack: Ack) => void;
  'host:close': (p: Empty, ack: Ack) => void;
  'player:join': (p: JoinPayload, ack: Ack<JoinResult>) => void;
  'player:resume': (p: ResumePayload, ack: Ack<JoinResult>) => void;
  'player:set-genres': (p: SetGenresPayload, ack: Ack) => void;
  'player:ready': (p: { ready: boolean }, ack: Ack) => void;
  'player:swipe': (p: SwipePayload, ack: Ack) => void;
  'player:undo': (p: Empty, ack: Ack) => void;
  'player:veto': (p: { movieId: number }, ack: Ack) => void;
  'player:leave': (p: Empty, ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (view: RoomView) => void;
  'game:deck': (deck: DeckPayload) => void;
  'room:closed': (p: { reason: CloseReason }) => void;
}
