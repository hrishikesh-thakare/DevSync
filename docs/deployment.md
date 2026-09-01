# Deploying DevSync

Three pieces: **Supabase** (Postgres + Storage), the **API** as one long-lived
Node process, and the **frontend** as static files on a CDN.

The API holds WebSocket connections, so it cannot run on a serverless function
platform — Vercel Functions, Netlify Functions and Cloudflare Workers are all
ruled out for the backend. Render, Railway, Fly and a plain VM all work.

---

## ⚠️ Run exactly one API instance

Rate-limit counters, the background job queue, the live-call registry and
Socket.io room membership all live in **process memory**. With two instances
behind one load balancer:

- chat messages reach only the users who happen to share an instance with the sender,
- rate limits become N× the configured value,
- queued invite emails vanish when the instance holding them restarts.

Making this safe means Redis — `@socket.io/redis-adapter`, `rate-limit-redis`,
and BullMQ replacing `backend/src/workers/queue.ts`. Until then, keep
`numInstances: 1`. The app logs a warning at boot if it detects otherwise.

---

## 1. Supabase

1. Create the project. From **Settings → Database**, take the **session pooler**
   connection string (port `5432`) as `DATABASE_URL`.
   The transaction pooler (`6543`) also works — the app detects it from the URL
   and disables prepared statements, which PgBouncer cannot serve — but session
   mode is the simpler default.
2. From **Settings → API**, take the project URL and the **service role** key.
   That key bypasses row-level security: it belongs in the API's environment
   only, never in a `VITE_` variable.
3. Create a **private** bucket named `workspace-files`. Uploads are routed
   through the backend, never direct from the browser.

## 2. Database migrations

Run them as a **release step**, not from application boot — two instances
booting together would race to apply the same migration.

```bash
cd backend && npm ci && npm run build
npm run db:deploy      # node dist/db/migrate.js
```

`db:deploy` uses drizzle-orm's migrator, which is a runtime dependency, so it
survives `npm ci --omit=dev`. `drizzle-kit migrate` is for local development
only — drizzle-kit is a devDependency and is not installed in production.

`render.yaml` wires this to `preDeployCommand`. On a platform with no release
hook, set `RUN_MIGRATIONS_ON_BOOT=true` and accept the single-instance
constraint you already have.

## 3. API

Render blueprint: [`render.yaml`](../render.yaml). Container:
[`backend/Dockerfile`](../backend/Dockerfile).

| Setting | Value |
| :--- | :--- |
| Root directory | `backend` |
| Build | `npm ci && npm run build` |
| Pre-deploy | `npm run db:deploy` |
| Start | `npm start` |
| Health check | `/api/health` |
| Instances | **1** |

`/api/health` round-trips a query to Postgres and answers `503` when the
database is unreachable, so a broken instance is pulled from rotation.
`/api/health/live` is the liveness counterpart and does not touch the database.

### Required environment

The app **refuses to boot** in production if any of these are missing or
malformed — see `assertEnv()` in `backend/src/config/env.ts`.

| Variable | Notes |
| :--- | :--- |
| `DATABASE_URL` | Supabase connection string |
| `JWT_SECRET` | ≥ 32 chars. `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | Exactly 64 hex chars. `openssl rand -hex 32`. Rotating it makes every stored GitHub token undecryptable |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Without these, uploads would fall back to ephemeral container disk, so production rejects them |
| `FRONTEND_URL`, `BACKEND_URL` | Real public origins, no trailing slash |
| `NODE_ENV=production`, `TRUST_PROXY_HOPS=1` | |

`backend/.env.example` documents every variable, required and optional.

### The cookie trap

`FRONTEND_URL` and `BACKEND_URL` are compared to decide the refresh cookie's
`SameSite` mode (`backend/src/lib/cookies.ts`):

- **Same registrable domain** (`app.devsync.io` + `api.devsync.io`) → `SameSite=Lax`.
- **Different sites** (`devsync.vercel.app` + `devsync-api.onrender.com`) →
  `SameSite=None; Secure`, the only combination a browser attaches to a
  cross-site refresh call.

Leave these pointing at `localhost` in a split-domain deployment and every user
is silently signed out 15 minutes after logging in — the access token expires,
the refresh cookie is not sent, and the session cannot be renewed. Set
`COOKIE_SAMESITE` explicitly only when a proxy puts both apps on one hostname.

## 4. Frontend

Vercel config: [`frontend/vercel.json`](../frontend/vercel.json). Netlify and
Cloudflare Pages read [`frontend/public/_redirects`](../frontend/public/_redirects).

| Setting | Value |
| :--- | :--- |
| Root directory | `frontend` |
| Install | `npm ci --legacy-peer-deps` |
| Build | `npm run build` |
| Output | `dist` |

Set `VITE_API_URL` (including the `/api` suffix), `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. There is no separate socket variable — the Socket.io
URL is derived from `VITE_API_URL`. Everything in a `VITE_` variable is compiled
into the bundle and publicly readable.

**The SPA rewrite is not optional.** With 43 client-side routes, a host that
does not rewrite unknown paths to `index.html` returns 404 on every deep link
and every page refresh.

## 5. Wire the callbacks

Point these at the real domains, not ngrok:

- Supabase **Authentication → URL Configuration**: site URL and redirect URLs.
- GitHub OAuth app: callback `https://<api>/api/auth/github/callback`.
- GitHub webhook: `https://<api>/api/webhooks/github`.
- Any extra frontend hostname (apex vs www, previews) → `CORS_ORIGINS`.

---

## Post-deploy checks

```bash
curl https://<api>/api/health          # {"status":"ok","database":"ok",...}
```

Then in a browser: sign in, wait past the 15-minute access-token expiry (or
clear `localStorage.accessToken`), and reload. Staying signed in confirms the
cross-site refresh cookie is working — this is the one failure that does not
show up in a smoke test run immediately after deploy.

Also confirm a file upload succeeds and survives an API restart, which proves
Supabase Storage is configured rather than the disabled disk fallback.
