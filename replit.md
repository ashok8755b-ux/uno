# Online UNO — Replit Project

Production-quality online multiplayer UNO game.

## Architecture

- **Client** (`client/`): React 19 + Vite + Tailwind + Framer Motion PWA, port 5000
- **Server** (`server/`): Express + Socket.IO authoritative game server, port 3001
- **Shared** (`shared/`): TypeScript types and constants, compiled to `shared/dist/`
- **Vite proxy**: `/socket.io` requests from port 5000 are proxied to port 3001 automatically

## Running locally on Replit

The "Start application" workflow runs `npm run dev` which:
1. Compiles the shared package
2. Starts shared TypeScript watch
3. Starts Vite dev server (port 5000)
4. Starts Express + Socket.IO server (port 3001)

## Environment

Firebase credentials are already set in `.replit` env vars. Socket URL is empty string (same-origin via Vite proxy).

## User preferences

- Preserve existing project structure and stack — do not restructure
- Fix TypeScript errors before declaring done
- Server TypeScript build command: `node_modules/.bin/tsc -p server/tsconfig.json`
- Client TypeScript build command: `node_modules/.bin/tsc -p client/tsconfig.app.json --noEmit`
- Shared TypeScript build command: `node_modules/.bin/tsc -p shared/tsconfig.json`
- UnoCard values use hyphens to match shared types: `draw-two`, `wild-draw-four` (never underscores)
- Never display "W4" on cards — use "+4" instead
- Keep game pages in `client/src/pages/`, contexts in `client/src/contexts/`
