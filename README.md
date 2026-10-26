<div align="center">
  <h1>🚀 DevSync</h1>
  <p><strong>The Unified Workspace for Agile Engineering Teams</strong></p>

  <p>
    <a href="#-features">Features</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-things-that-will-bite-you">Gotchas</a> •
    <a href="#-ci--testing">CI & Testing</a> •
    <a href="#-documentation--architecture">Documentation</a>
  </p>
</div>

---

DevSync is a project management and real-time collaboration platform for software teams. It combines Kanban issue tracking, agile sprint management, threaded chat, and GitHub integration into one interface so a team does not have to context-switch between three tools to answer one question.

## ✨ Features

- **Hierarchical Organization**: **Workspaces** contain **Projects**; both have their own membership and roles.
- **Agile Project Management**:
  - Interactive **Kanban Boards** with drag-and-drop (`@dnd-kit`).
  - **Backlog, Roadmap, Calendar, and Epic views** over a single ranked task list.
  - Epics, Stories, Tasks, Bugs, and Subtasks.
  - **Sprint Planning**: time-boxed iterations, velocity tracking, and backlog ordering via **fractional indexing** (a card is re-ranked by generating a key between its two neighbours, so a move rewrites one row rather than renumbering the column).
- **Real-Time Communication**:
  - `Socket.io` messaging, threaded replies, DMs, reactions, and rich text via Tiptap.
  - **Project-scoped channels** alongside workspace-wide rooms.
  - **Zoom "start call"** link-outs per channel via Server-to-Server OAuth (see [Gotchas](#-things-that-will-bite-you)).
- **Deep GitHub Integration**:
  - Connect a repo to a project; ingest commits, branches, PRs, issues, and CI runs by webhook.
  - Smart-commit task linking (`FLEET-12 fixes ...`) resolved server-side.
  - CI workflow run status displayed directly on the project's **GitHub tab**.
- **Delivery Analytics**: cycle time per board column, weekly throughput, sprint velocity, CI health, and burndown. These are **value-stream metrics** — how work moves across your own board. They are deliberately *not* DORA metrics, which need deployment and incident concepts DevSync does not model.
- **AI assists** (Gemini): sprint retrospective summaries and CI failure explanations. Degrades gracefully to null when unconfigured — no feature hard-depends on it.
- **Security & Quality**:
  - Two-layer **RBAC** across Workspace (`owner`/`admin`/`member`) and Project (`project_admin`/`developer`/`viewer`).
  - 15-minute JWTs + rotating, revocable refresh tokens in HTTP-only cookies, with reuse detection that revokes the entire token family.
  - OAuth (Google & GitHub) via Supabase Auth.
  - AES-256-GCM encryption for stored GitHub tokens, `helmet`, per-IP and per-account rate limiting, and Zod 4 schema validation on every input.
  - Zero high-severity vulnerabilities enforced via CI audit gates.

---

## 🛠 Tech Stack

Monolithic, type-safe, TypeScript end to end. Full rationale in [`docs/tech-stack.md`](./docs/tech-stack.md).

### Frontend
- **Framework**: React 19 + TypeScript 6 + Vite 8 + React Router 7
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **State**: Zustand 5 (auth/session) + TanStack Query v5 (server state)
- **Forms & Validation**: React Hook Form + Zod 4
- **UI & Content**: `@dnd-kit`, Tiptap (chat composer), Recharts (analytics), Lucide, Sonner
- **Real-time**: `socket.io-client` v4

### Backend
- **Runtime**: Node.js (ESM, Node 22 in CI) + Express 5 + TypeScript
- **Database**: PostgreSQL via Supabase
- **ORM**: Drizzle ORM
- **Real-time**: Socket.io v4
- **Auth**: JWT + refresh tokens, bcryptjs, Supabase OAuth
- **Email**: **SendGrid HTTP API** — *not* SMTP. Render blocks outbound SMTP ports, so a nodemailer/SMTP transport could never work on the deployed host.
- **AI**: Gemini (`gemini-3-flash-preview` / `gemini-3.6-flash`)
- **Security**: Zod 4, Helmet, express-rate-limit, AES-256-GCM

---

## 🚀 Getting Started

### Prerequisites
- Node.js v20+ (Node 22 recommended)
- A [Supabase](https://supabase.com/) project (Postgres + Auth + Storage)

### 1. Clone
```bash
git clone https://github.com/hrishikesh-thakare/DevSync.git
cd DevSync
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
```
Every variable is documented inline in `.env.example`. The three you cannot skip locally:

| Variable | How to get it |
| :--- | :--- |
| `DATABASE_URL` | Supabase → Settings → Database → **session pooler** string (port `5432`) |
| `JWT_SECRET` | Any long random string (`openssl rand -base64 48`) |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` — must be exactly 32 bytes (64 hex characters) |

Run migrations and start the dev server:
```bash
npm run db:migrate    # drizzle-kit — local development
npm run dev           # http://localhost:3001
```

### 3. Frontend
```bash
cd ../frontend
npm install --legacy-peer-deps
```
Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```
Start the frontend dev server:
```bash
npm run dev           # http://localhost:5173
```

### 4. Seed data

Two seeds, in this order — the demo seed depends on the e2e seed's user accounts:

```bash
cd e2e     && npx tsx seed/seed-test-data.ts        # 20 test users + RBAC fixtures
cd backend && npx tsx src/db/seed-demo-workspace.ts # "Northwind Labs": 6 months of history
```

`seed-demo-workspace.ts` builds a workspace with ~445 tasks, 52 sprints, channels, chat, GitHub rows, and audit history, all backdated. It writes **directly to Postgres on purpose**: `created_at` / `completed_at` are set server-side by the API, so history cannot be backdated through HTTP. It is safe to re-run — it drops and rebuilds only its own workspace, and never touches the e2e workspace the test suite asserts against.

Sign in as `alice@demo.com` / `Password123!` and open `/w/northwind-labs`.

### 5. Optional: ngrok for GitHub webhooks
```bash
ngrok http 3001
```
Point the repo's webhook at the generated URL and set `BACKEND_URL` in `backend/.env`.

---

## ⚠️ Things that will bite you

Non-obvious operational facts, each of which has cost real debugging time. None are guessable from the code.

### OAuth silently returns you to the landing page
Supabase refuses any `redirect_to` not on its allowlist and **falls back to the Site URL without an error**. The symptom is a login loop that never reaches `/auth/callback`.

**Fix:** Supabase Dashboard → Authentication → **URL Configuration** → add your exact callback to **Redirect URLs**:
```
http://localhost:5173/auth/callback          # local
https://<your-frontend-domain>/auth/callback # production
```
Note this is the **frontend** origin, not the backend — `/auth/callback` is a React route that then calls `POST /auth/oauth/callback`.

### Email is deliberately gated off outside production
Sending requires `NODE_ENV=production` **or** `SMTP_ALLOW_DEV=true`. Otherwise the message is only logged to the backend console:
```
MOCK EMAIL SENT TO: someone@example.com
LINK: http://localhost:5173/register?inviteToken=...
```
Grab invite/reset links from that console output — nothing reaches a real inbox. Reserved and obviously fake domains (`demo.com`, `example.com`, `*.test`) are never mailed even when sending is on, and a per-process daily cap (25 in dev, 500 in prod) is the last defence.

This gate exists because it was once absent: an e2e seed run mailed ~600 non-existent `@demo.com` addresses in a day and got the sending account suspended for spam.

### Zoom credentials & fork PRs
Zoom calls use a Server-to-Server OAuth app (`ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`). In GitHub Actions, pull requests from forks do not inherit repository secrets; unconfigured credentials cause call initiation to return `502 Bad Gateway`. E2E tests detect this status and skip gracefully rather than failing the run. Calls are ephemeral in-memory records (`activeCalls.ts`) and are cleared on server restarts.

### One repo cannot be connected to two projects
`github_commits` is unique on `(repo_full_name, commit_sha)` **globally**, not per project. If two projects connect the same repo, whichever ingests a commit first owns it and the second silently receives nothing (`ON CONFLICT DO NOTHING`). Symptoms look like an incomplete sync with no error anywhere.

### Gemini free tier is 20 requests/day
Not per minute — **per day, per model**. Exhausting it returns `429 RESOURCE_EXHAUSTED` until reset. AI features degrade gracefully to null rather than failing the request, so a missing sprint summary is usually quota, not a bug.

### A PAT needs `workflow` scope to push `.github/workflows/`
Pushes that create or modify a workflow file are rejected outright without it, with an error that does not mention your token.

### The API must run as exactly one instance
Rate-limit counters, the job queue, the live-call registry, and Socket.io rooms all live in process memory. See [`docs/deployment.md`](./docs/deployment.md) before scaling out.

---

## 🧪 CI & Testing

Every commit and pull request runs through a two-stage CI pipeline defined in `.github/workflows/`:

### 1. Static Gates & Security (`ci.yml`)
- **Backend**:
  - `npm run typecheck` (`tsc --noEmit`)
  - `npm test` (Vitest unit test suite)
  - `npm run build` (`tsc` + migration journal copy)
  - `test -f dist/db/migrations/meta/_journal.json` (runtime migration verification)
  - `npm audit --omit=dev --audit-level=high` (enforces 0 high/critical production vulnerabilities)
- **Frontend**:
  - `npm run lint` (`eslint .`)
  - `npm run build` (`tsc -b && vite build`)
  - `npm audit --omit=dev --audit-level=high`

### 2. End-to-End Test Suite (`e2e-tests.yml`)
Runs against a fresh PostgreSQL 16 container, migrates the schema, boots both services, seeds the RBAC test matrix, and executes Playwright:

**367 Playwright E2E tests across 44 spec files**:
```bash
cd e2e
npx playwright test
npx playwright test --list          # inventory without running
npx playwright test tests/analytics # one module
```

**38 backend unit tests across 5 files**:
Cover logic underneath the E2E suite — encryption, cookie attribute derivation, CORS matching, the retry queue, and task status transitions:
```bash
cd backend
npm test
```

Full test suite inventory: [`docs/e2e-test-suite.md`](./docs/e2e-test-suite.md).

---

## 📚 Documentation & Architecture

| Document | Description |
| :--- | :--- |
| [**Architecture & API**](./docs/backend-architecture.md) | Request lifecycle, RBAC enforcement, complete endpoint reference. |
| [**Database Schema**](./docs/schema.md) | Drizzle tables, relations, constraints, ERD. |
| [**Tech Stack**](./docs/tech-stack.md) | Technical choices, rationale, and the single-instance constraint. |
| [**Navigation Flow**](./docs/navigation-flow.md) | Route topology and screen-by-screen inventory with RBAC visibility. |
| [**E2E Test Suite**](./docs/e2e-test-suite.md) | Every Playwright test and what it verifies. |
| [**Migrations**](./docs/migrations.md) | Authoring migrations, the snapshot contract, and what Drizzle cannot describe. |
| [**Deployment**](./docs/deployment.md) | Supabase + API + static frontend, required env, and the single-instance rule. |

---

## 🔑 Test credentials

20 seeded users covering the RBAC matrix across multiple projects. Full roster and recommended workflows in [`test_users.md`](./test_users.md).

Primary account: `alice@demo.com` — **global password `Password123!`**

---

<div align="center">
  <i>Built for the final year project submission.</i>
</div>
