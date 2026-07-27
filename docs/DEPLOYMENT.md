# Deployment Guide

## Architecture

| Service | Platform | Notes |
|---------|----------|-------|
| Client (React PWA) | Vercel | Static build from `client/dist` |
| Server (Express + Socket.IO) | Render / Railway / Fly.io | Node.js 20+ |
| Auth + Firestore | Firebase | Already configured |

---

## Client — Vercel

### Build settings (auto-detected or set manually)

| Setting | Value |
|---------|-------|
| Framework preset | Vite |
| Root directory | `client` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

### Environment variables (Vercel dashboard → Settings → Environment Variables)

```
VITE_API_URL=https://your-server-url.onrender.com
VITE_SOCKET_URL=https://your-server-url.onrender.com
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`client/vercel.json` already handles SPA routing rewrites and asset caching headers.

---

## Server — Render

### New Web Service settings

| Setting | Value |
|---------|-------|
| Runtime | Node |
| Root directory | *(leave blank — set in commands)* |
| Build command | `npm install && node node_modules/typescript/bin/tsc -p shared/tsconfig.json && npm run build -w server` |
| Start command | `node server/dist/index.js` |
| Node version | 20 |

### Environment variables (Render dashboard → Environment)

```
NODE_ENV=production
PORT=3001
CLIENT_ORIGIN=https://your-app.vercel.app
CLIENT_PUBLIC_URL=https://your-app.vercel.app
SESSION_SECRET=<random-string>
```

> **Note:** Set `CLIENT_ORIGIN` to the exact Vercel production URL (no trailing slash) so Socket.IO CORS is correctly scoped.

---

## Firebase setup

See [`docs/firebase-setup.md`](firebase-setup.md) for the full Firebase project and Firestore rules setup.

Apply Firestore security rules from [`docs/firestore.rules`](firestore.rules):

```bash
firebase deploy --only firestore:rules
```

---

## First-deploy checklist

1. Deploy server to Render and note the public URL.
2. Set `VITE_SOCKET_URL` and `VITE_API_URL` on Vercel to the Render URL.
3. Add the Vercel URL as an **Authorized Domain** in Firebase Console → Authentication → Settings.
4. Deploy client to Vercel.
5. Test auth flow end-to-end in the Vercel preview URL.
6. Apply Firestore rules.

---

## Local development

```bash
# Install all workspaces
npm install

# Copy env files and fill in Firebase keys
cp client/.env.example client/.env
cp server/.env.example server/.env

# Start everything (shared watch + client dev + server dev)
npm run dev
```

Client runs on `http://localhost:5000`, server on `http://localhost:3001`.  
Vite proxies `/socket.io` → server, so both work through a single port.
