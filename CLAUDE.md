# CLAUDE.md

Guidance for AI coding assistants (and humans) working in this repository.

## What this is

Ortak Perde: a group movie picker. A host screen (TV, `/host`) shows a QR code; phones join (`/join/:code`), pick genres, swipe a shared deck; the host screen reveals the winner. No accounts, no database — rooms live in server memory.

## Layout

```
packages/shared   Types, Socket.IO event names + zod schemas (protocol.ts), scoring.ts, deck.ts,
                  join-url.ts, names.ts, room-code.ts. Pure functions only, no I/O. Consumed as TS source.
apps/server       Fastify + Socket.IO. app.ts (HTTP routes, helmet, static, socket wiring),
                  socket.ts (validation + auth per event), game/room-manager.ts (state machine),
                  game/deck-service.ts, catalog/{tmdb,sample}.ts, data/sample-movies.json.
apps/web          Vite + React + Tailwind + framer-motion + i18next.
                  host/ (TV screens), player/ (phone screens), lib/ (socket, session hook, share card),
                  i18n/locales/{tr,en}.json.
```

## Commands

```bash
npm run dev         # server (tsx watch, --dev → SERVER_PORT 3000) + Vite (5173, 0.0.0.0, proxies /api and /socket.io)
npm run build       # web (vite) then server (tsup, bundles shared)
npm start           # production: one process, one port (PORT, default 3000), serves apps/web/dist
npm test            # vitest in all workspaces
npm run lint        # eslint + prettier --check
npm run typecheck   # tsc in all workspaces
```

## Core principles

1. **The server is authoritative.** Clients send intents; `RoomManager` decides. Every client event is validated with its zod schema in `socket.ts`; handlers check the caller's role (`asHost` / `asPlayer`) and the room phase and return an `ErrorCode` instead of throwing. Never trust or merge client-computed state.
2. **Per-role views.** Clients only ever receive `manager.hostView(room)` or `manager.playerView(room, player)`. Do not leak other players' swipes before RESULTS (host gets results in REVEALING).
3. **Pure game logic lives in `packages/shared`** (scoring, deck building, join URL, name sanitising) and is unit-tested there.
4. **No user data on disk, no per-request logs, the TMDB key never leaves the server** (not in responses, logs or error messages).
5. **Every user-facing string is an i18n key** in both `tr.json` and `en.json` (Turkish is the default/fallback).
6. **UI must work without animations finishing** (background tabs/TVs throttle rAF): don't gate state changes on exit animations. Respect `prefers-reduced-motion`. No horizontal scroll at 320 px. Every gesture has a button equivalent.

## Phases

`LOBBY → PICKING → BUILDING → SWIPING → REVEALING → RESULTS`; `host:reset` goes RESULTS → BUILDING (replay) or → LOBBY (settings). Joining is only allowed in LOBBY; resuming (token) is always allowed.

## Adding a socket event

1. `packages/shared/src/protocol.ts`: add to `EVENTS`, add a `.strict()` zod schema, add to `ClientToServerEvents`.
2. `apps/server/src/socket.ts`: `on(EVENTS.x, schema, asHost/asPlayer(...))`.
3. Rule in `RoomManager` (phase check + error codes), then `this.changed(room)` to broadcast.
4. Tests: unit test on `RoomManager` and, if it is part of the main flow, extend `test/integration.test.ts`.
5. Client: call via `emitAck('x', payload)` from `apps/web/src/lib/socket.ts`.

## Test expectations

- shared: every rule change in scoring/deck needs a test (ties, veto, compromise, no-cinema, balance, dislikes, relaxation).
- server: `test/room-manager.test.ts` (rules, phases, limits, reconnection, cleanup), `test/integration.test.ts` (real Socket.IO clients), `test/catalog.test.ts` (TMDB client with mocked fetch — never hit the real API in tests).
- web: testing-library for critical components (swipe deck, QR); pure helpers (`player/swipe.ts`) get unit tests.
- Before committing: `npm run lint && npm run typecheck && npm test && npm run build`.

## Conventions

- Conventional Commits (`feat(server): …`, `fix(web): …`).
- TypeScript strict with `noUncheckedIndexedAccess`; `import type` for types; extensionless relative imports (Bundler resolution).
- Keep the sample dataset (`apps/server/src/data/sample-movies.json`) free of copyrighted text: facts only plus our own one-line summaries, no posters.
- Record notable design decisions in `docs/DECISIONS.md`.
