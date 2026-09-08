# DevSync — Technology Stack Overview

This document outlines the core technologies used in the DevSync project, including the frontend, backend, infrastructure, and reasoning behind these choices.

---

## 🏗️ Architecture Summary

DevSync uses a **monolithic backend** (Node.js/Express) communicating with a **Single Page Application frontend** (React). Both are built with **TypeScript**. The database and core authentication are delegated to **Supabase** (PostgreSQL-as-a-service).

---

## 🎨 Frontend Stack

| Technology | Role | Why it was chosen |
|---|---|---|
| **React 19** | UI Library | Component-based UI, huge ecosystem, standard for modern SPAs. |
| **Vite 8** | Build Tool & Bundler | Extremely fast HMR (Hot Module Replacement) and optimized production builds. |
| **TypeScript 6** | Language | Type safety across the stack, reducing runtime errors. |
| **TailwindCSS v4** | Styling | Utility-first CSS for rapid UI development without writing custom CSS classes. |
| **shadcn/ui** | Component Library | Beautifully designed components that you can copy and paste into your apps, highly customizable. |
| **Zustand 5** | State Management | Lightweight, fast, and boiler-plate free alternative to Redux. |
| **React Router 7** | Routing | Standard client-side routing for SPAs. |
| **React Hook Form + Zod** | Forms & Validation | Performant, flexible, and extensible forms with easy-to-use validation. |
| **dnd-kit 6** | Drag and Drop | Accessible, flexible drag-and-drop toolkit. Drives the Kanban board (via the `@reui/c-kanban-1` primitives), the Backlog's sortable list, and the reui gantt, event-calendar and filter blocks. |
| **Socket.io-client 4** | Real-time Client | Receives WebSocket events for instant chat messages and live task updates. |
| **Sonner** | Toasts | Opinionated toast component for React for success and error notifications. |
| **Lucide React** | Icons | Clean, consistent SVG icon set. |

---

## ⚙️ Backend Stack

| Technology | Role | Why it was chosen |
|---|---|---|
| **Node.js (ESM)** | Runtime | Allows sharing TypeScript types with the frontend and unifies the stack language. |
| **Express 5** | Web Framework | Lightweight, unopinionated routing and middleware engine. |
| **Drizzle ORM** | Database ORM | Type-safe, SQL-like ORM that is lighter and faster than Prisma. |
| **Supabase (PostgreSQL)** | Database | Managed PostgreSQL with built-in pgvector (for future AI) and row-level security capabilities. |
| **Socket.io 4** | WebSockets | Handles real-time bi-directional event emission (e.g., chat messages). |
| **Zod** | Schema Validation | Validates incoming request payloads (req.body) against strict schemas before controller logic. |
| **fractional-indexing** | Sorting Algorithm | Generates a sort key *between* two neighbours, so reordering a card rewrites one row instead of renumbering the column. Often called LexoRank after the Jira algorithm of the same shape — the package is `fractional-indexing`, not a LexoRank implementation. |
| **JWT (jsonwebtoken)** | Authentication | Stateless session management for the API. |
| **bcryptjs** | Password Hashing | Secure hashing for local email/password accounts. |
| **@sendgrid/mail** | Transactional Email | Invite, password-reset and verification mail over SendGrid's **HTTP API**. Not SMTP: Render blocks outbound SMTP ports on standard web services, so a nodemailer transport could never connect from the deployed host regardless of credentials. Gated off outside production — see below. |
| **helmet & cors** | Security | Standard Express security middleware headers and cross-origin controls. |

---

## ☁️ Infrastructure & Services

| Service | Role | Usage |
|---|---|---|
| **Supabase Auth** | Identity Provider | Handles OAuth flows (GitHub, Google) securely without us managing the handshake. |
| **Supabase Storage** | File Storage | Stores avatar images, task attachments, and chat files in S3-compatible buckets. |
| **ngrok** | Local Tunneling | Exposes the local backend (`localhost:3001`) to the internet to receive GitHub Webhook payloads during development. |

---

## 🔌 Wired, but with caveats

These are live in the app, not planned — each carries a constraint worth knowing before you rely on it.

*   **Background jobs:** In-process queue in `workers/queue.ts`. Invite email delivery and GitHub webhook processing run off the request path with retry + exponential backoff. No external broker required, at the cost of durability: **queued jobs are held in memory and lost on restart**, and this is one of the four things pinning the API to a single instance.

*   **Email (`services/email.service.ts`):** Three gates sit in front of every send.
    1. *Is sending allowed at all?* Requires `NODE_ENV=production` or `SMTP_ALLOW_DEV=true`. Otherwise the message body and link are logged to the console instead — that console output is how you retrieve invite and password-reset links in development.
    2. *Is the address deliverable?* Reserved and obviously-fake domains (`demo.com`, `example.com`, `*.test`, `*.invalid`, …) are never mailed even when sending is on.
    3. *Daily cap.* 25/day in dev, 500/day in production, counted per process.

    Gates 1 and 2 exist because they were once absent: a single e2e seed run mailed roughly 600 non-existent `@demo.com` addresses, every one hard-bounced, and the sending account was suspended for spam. The comment block in `email.service.ts` records the incident date.

*   **AI (`services/ai.service.ts`, `gemini-3.6-flash`):** Sprint retrospective summaries, task duration estimates, and CI failure explanations. Every call degrades to `null` rather than throwing, so an absent summary is never a broken request.

    Two things to know. First, the **free tier allows 20 requests per day per model** — not per minute — so bulk generation exhausts it quickly and returns `429 RESOURCE_EXHAUSTED` until reset. Second, `generateSprintReport` deliberately returns **team-level output only**. It previously also produced a per-assignee "contribution report" — an AI-written sentence judging each person's contribution, posted publicly to the project channel on every sprint close with no review step. That was removed as a documented anti-pattern (individual activity metrics stated with false authority), alongside the Analytics contribution chart — and migration `0018` dropped the `sprints.ai_contribution_report` column outright, so the removal is enforced by the schema, not just by convention. Do not reintroduce it.

*   **Zoom (`lib/zoom.ts`, `modules/channels/activeCalls.ts`):** Server-to-Server OAuth app, so there is no per-user consent flow — every meeting is created under the one Zoom account owning the credentials, and `join_before_host` means no participant needs a Zoom account. Calls are **ephemeral and never persisted**: `activeCalls` is an in-memory `Map`, so there is no call history to query and a restart clears every live call.

---

## ⚠️ Scaling constraint

The API is **single-instance by design**. Four pieces of state live in process
memory rather than a shared store:

| State | Where | Breaks at 2+ instances as |
|---|---|---|
| Rate-limit counters | `express-rate-limit` memory store | Effective limit becomes N× the configured value |
| Background jobs | `workers/queue.ts` | Queued invite emails lost when their instance restarts |
| Live call registry | `modules/channels/activeCalls.ts` | One channel mints a separate Zoom meeting per instance |
| Socket.io rooms | Default in-memory adapter | Chat messages reach only viewers on the sender's instance |

Removing the constraint means Redis in all four places:
`@socket.io/redis-adapter`, `rate-limit-redis`, and BullMQ in place of the
in-process queue. Until then the deployment must pin one instance — the app
logs a warning at boot if it detects a higher instance count. See
[deployment.md](./deployment.md).
