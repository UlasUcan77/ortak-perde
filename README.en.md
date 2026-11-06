# 🎬 Ortak Perde

**A swipe-together group movie picker you join with a QR code — ends the "what should we watch tonight?" debate.**

[Türkçe README](README.md) · [Design decisions](docs/DECISIONS.md) · [Roadmap](docs/ROADMAP.md) · [Contributing](CONTRIBUTING.md)

_"Ortak Perde" is Turkish for "shared screen / shared curtain"._

One person opens the site on a computer connected to the TV. Everyone scans the QR code with their phone, picks their own favourite genres and swipes the same deck Tinder-style. When everyone is done, the winner is revealed on the big screen after a dramatic countdown. No accounts, no sign-up, no ads.

| Main screen (TV)                                    | Phone                                              |
| --------------------------------------------------- | -------------------------------------------------- |
| `docs/screenshots/host-lobby.png` _(placeholder)_   | `docs/screenshots/phone-swipe.png` _(placeholder)_ |
| `docs/screenshots/host-results.png` _(placeholder)_ | `docs/screenshots/demo.gif` _(placeholder)_        |

> **Taking screenshots / GIFs:** run `npm run dev`, open the main screen in a 1920×1080 browser window and use device emulation (e.g. iPhone 12, 390×844) in dev tools for the phone view. Record GIFs with [Peek](https://github.com/phw/peek), [ScreenToGif](https://www.screentogif.com/) or `Cmd+Shift+5` on macOS and put them in `docs/screenshots/`. Posters require a `TMDB_API_KEY`.

## How it works

1. **Open the main screen** — `/host` creates a room and shows a big QR code and a 4-character room code (e.g. `K7QX`).
2. **Scan the QR** — everyone joins from their phone with a nickname and an emoji avatar. Can't scan? Type the code at `/join`.
3. **Pick genres** — each person picks what they like (or "anything") and, optionally, genres they absolutely don't want.
4. **The deck is built** — the server builds **one shared deck**, taking an equal number of movies from each player's genres (round-robin), removing duplicates and anything someone hard-no'd. Everyone gets the same movies in a different order.
5. **Swipe** — right = like (1 point), up = super like (2 points), left = nope. Each player has one **"NEVER"** veto per game; a vetoed movie can't win. The last swipe can be undone.
6. **Reveal** — when everyone is done (or the host hits "Finish now"), the TV counts down 5-4-3-2-1 and reveals the winner, the podium, who liked it and the agreement ratio ("4/5 liked it"). The result can be downloaded/shared as a PNG card.

Ranking: total points → number of people who liked it → number of super likes → TMDB rating → movie id (deterministic). If no movie was liked by everyone, the winner is labelled **"Compromise pick"**; if nobody liked anything at all you get "No movie tonight — go out!" plus the best-rated non-vetoed movie as a consolation.

## Quick start

Requires Node.js 20.11+ (22 recommended).

```bash
git clone https://github.com/UlasUcan77/ortak-perde.git
```

```bash
cd ortak-perde && npm install
```

```bash
npm run dev
```

The console prints `📱 Telefonla bağlanmak için: http://192.168.x.x:5173` ("connect with your phone"). Open `http://localhost:5173/host` on the computer; the QR code automatically uses your LAN IP (phones must be on the same Wi-Fi).

Works without a TMDB key, using a bundled 74-movie sample dataset (no posters).

### Getting a TMDB API key

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/signup).
2. Request an API key under **Settings → API**.
3. Copy either the "API Key (v3 auth)" or the "API Read Access Token" (v4) — both work.
4. `cp .env.example .env`, paste it into `TMDB_API_KEY=` and restart.

The key only lives on the server and is never sent to clients, logs or error messages.

## Environment variables

| Variable          | Default   | Description                                                                                                         |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| `TMDB_API_KEY`    | _(empty)_ | TMDB v3 key or v4 read token. Empty → sample dataset.                                                               |
| `PUBLIC_URL`      | _(empty)_ | Public URL phones should open, e.g. `https://perde.example.com`. Encoded in the QR and allowed as Socket.IO origin. |
| `PORT`            | `3000`    | HTTP + WebSocket port in production (single port).                                                                  |
| `HOST`            | `0.0.0.0` | Interface to bind.                                                                                                  |
| `SERVER_PORT`     | `3000`    | Development only: API server port behind the Vite proxy.                                                            |
| `WEB_PORT`        | `5173`    | Development only: Vite port.                                                                                        |
| `TMDB_REGION`     | `TR`      | Region for streaming providers and release dates (ISO 3166-1).                                                      |
| `TRUST_PROXY`     | `false`   | Set `true` behind a reverse proxy (trusts `X-Forwarded-For` for rate limiting).                                     |
| `ALLOWED_ORIGINS` | _(empty)_ | Extra comma-separated allowed origins.                                                                              |
| `LOG_LEVEL`       | `info`    | `fatal`, `error`, `warn`, `info`, `debug`.                                                                          |
| `WEB_DIST`        | _auto_    | Path of the built web app; `off` disables static hosting.                                                           |

### Which address goes into the QR code?

1. `PUBLIC_URL`, if set.
2. If the main screen was opened via `localhost`/`127.0.0.1`: the server's **LAN IP** on the same port (the Vite port 5173 in development).
3. If the main screen was opened via a reachable address (`http://192.168.1.20:3000`, `https://example.com`): that address.
4. Otherwise a warning is shown instead of a QR code — **localhost is never encoded**.

## Scripts

| Script              | What it does                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| `npm run dev`       | Server (tsx watch) + Vite together, bound to `0.0.0.0`.                  |
| `npm run build`     | Builds the web app and the server for production.                        |
| `npm start`         | Runs the built app as one process on one port (`http://localhost:3000`). |
| `npm test`          | Vitest in every package.                                                 |
| `npm run lint`      | ESLint + Prettier check.                                                 |
| `npm run typecheck` | `tsc --noEmit` in every package.                                         |

## Docker

```bash
docker compose up --build
```

or:

```bash
docker build -t ortak-perde . && docker run -p 3000:3000 -e TMDB_API_KEY=xxx -e PUBLIC_URL=http://192.168.1.20:3000 ortak-perde
```

A container can't see your home network's IP, so with Docker set **`PUBLIC_URL` to your computer's LAN address** (e.g. `http://192.168.1.20:3000`) or open the main screen via that address instead of `localhost`.

## One-click deploy (Render)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/UlasUcan77/ortak-perde)

1. Click the button and sign in to Render with GitHub.
2. Render reads [`render.yaml`](render.yaml) and only asks for `TMDB_API_KEY` (stored as a secret).
3. Hit **Apply / Deploy**. After a few minutes `https://ortak-perde-xxxx.onrender.com` is live; add `/host` for the main screen.

No need for `PUBLIC_URL` or `TRUST_PROXY`: the server uses Render's address (`RENDER_EXTERNAL_URL`) for the QR code automatically. If you attach your own domain, set `PUBLIC_URL` to it.

## Self-hosting

A single Node.js process (HTTP + WebSocket on one port), no database. Runs anywhere that supports WebSockets. Rooms live in memory, so run **one instance** (horizontal scaling would need sticky sessions and a shared adapter — see the [roadmap](docs/ROADMAP.md)).

- **Render:** easiest via the button above. Manually: New Web Service → this repo → Docker runtime; `TMDB_API_KEY` is the only variable you need. Free instances sleep when idle (waking takes about a minute and drops open rooms).
- **Fly.io:** `fly launch` (detects the Dockerfile), `internal_port = 3000`, `fly secrets set TMDB_API_KEY=... PUBLIC_URL=https://<app>.fly.dev TRUST_PROXY=true`, keep a single machine with `min_machines_running = 1`.
- **Railway:** connect the repo; the Dockerfile is used automatically and Railway provides `PORT`. Env: `TMDB_API_KEY`, `PUBLIC_URL`, `TRUST_PROXY=true`.
- **Your own server:** run the container behind Caddy/Nginx and forward WebSocket upgrade headers for `/socket.io/`. With HTTPS, `PUBLIC_URL` must start with https (HSTS is enabled then).

Serverless platforms such as Vercel can't hold long-lived WebSocket connections and are **not supported**.

## Architecture

```
packages/shared   Types, Socket.IO event names + zod schemas, scoring and deck building (pure functions)
apps/server       Fastify + Socket.IO, in-memory room manager, TMDB client + sample data, static hosting
apps/web          Vite + React + Tailwind + framer-motion; /host (TV) and /join/:code (phone)
```

- **The server is authoritative.** Clients only send intents (`player:swipe`, …); every event is validated with zod, out-of-phase events are rejected, and state only changes on the server. Each client gets its own sanitised view (`room:state`) — nobody learns who liked what until the reveal.
- **Phases:** `LOBBY → PICKING → BUILDING → SWIPING → REVEALING → RESULTS`.
- **Resilience:** player/host tokens live in `localStorage`; a locked phone or a page refresh resumes as the same player with progress intact. If the host disconnects the room waits 10 minutes; rooms older than 3 hours or left empty are cleaned up.
- **TMDB:** genre lists and discover results are cached in memory with a TTL, requests are concurrency-limited and `Retry-After` is honoured on 429. If TMDB is unreachable the server falls back to the sample data.

More in [docs/DECISIONS.md](docs/DECISIONS.md) and [CLAUDE.md](CLAUDE.md).

## Privacy

- **No** accounts, tracking cookies, analytics or ads.
- The server never writes user data to disk: nicknames, picks and swipes only live in memory and are deleted when the room closes. Per-request HTTP logs are disabled.
- The browser only stores a session token, your last nickname/avatar and language preference in `localStorage`.
- Fonts are bundled (no third-party font requests). Posters load from TMDB's image server (`image.tmdb.org`).

## Security

Zod input validation, name sanitising, Socket.IO origin checks (`PUBLIC_URL`/same origin), Helmet security headers and CSP, per-IP room creation limits. To report a vulnerability see [SECURITY.md](SECURITY.md).

## TMDB attribution

<img src="apps/web/public/tmdb-logo.svg" alt="TMDB" height="14" />

This product uses the TMDB API but is not endorsed or certified by TMDB. Movie data and posters come from [The Movie Database (TMDB)](https://www.themoviedb.org/); streaming availability is provided by JustWatch via TMDB.

## License

[MIT](LICENSE)
