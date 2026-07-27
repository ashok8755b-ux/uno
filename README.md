# Online UNO

Production-quality online multiplayer UNO — React + Vite PWA frontend, Express + Socket.IO backend, Firebase Authentication, Firestore player profiles.

## Features

- **Full official UNO rules** — Draw Two, Skip, Reverse, Wild, Wild Draw Four, colour picker, UNO penalty, stacking, turn timer
- **Server-authoritative** — all game logic runs on the server; anti-cheat built in
- **Real-time multiplayer** — Socket.IO with reconnect support and automatic host migration
- **Room system** — create/join with a 4-digit code, invite link, configurable settings
- **Authentication** — Google login + guest (anonymous) via Firebase Auth
- **Player profiles** — Firestore `users/{uid}` with game stats
- **PWA** — installable, service worker, offline splash
- **Responsive** — mobile-first, landscape gameplay optimised

## Stack

| Package | Role |
|---------|------|
| `client/` | React 19 + Vite + Tailwind + Framer Motion PWA |
| `server/` | Express + Socket.IO authoritative backend |
| `shared/` | TypeScript types and game constants |

## Quick start

```bash
npm install
cp client/.env.example client/.env   # fill in Firebase keys
cp server/.env.example server/.env
npm run dev
```

- Client: `http://localhost:5000`
- Server: `http://localhost:3001`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Shared watch + Vite dev + server dev |
| `npm run build` | Production build (shared → client → server) |
| `npm run lint` | ESLint client + server |
| `npm run format` | Prettier write |

## Deployment

See **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** for full Vercel + Render instructions and environment variable reference.

**Short version:**
- Client → Vercel (root: `client/`, build: `npm run build`, output: `dist`)
- Server → Render (Node 20, build + start commands in deployment guide)
- Firebase credentials needed for both; Vercel domain must be added to Firebase Authorized Domains

## Environment variables

### Client (`client/.env`)

```
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Server (`server/.env`)

```
PORT=3001
CLIENT_ORIGIN=http://localhost:5000
CLIENT_PUBLIC_URL=http://localhost:5000
NODE_ENV=development
```

## Milestones completed

| # | Feature |
|---|---------|
| M1 | Monorepo, Vite/React/Tailwind, Express + Socket.IO, shared types, PWA |
| M2 | Firebase Auth — Google login, guest login, Firestore user profiles |
| M3 | Room system — create/join, invite link, lobby, ready state, host migration, reconnect, kick, settings |
| M4 | Authoritative UNO engine — full official rules, scoring, round/match management |
| M5 | Socket integration — server-validated game state, real-time sync, game UI |

## License

Private — all rights reserved.
