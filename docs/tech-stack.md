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
| **TypeScript 5** | Language | Type safety across the stack, reducing runtime errors. |
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
| **Zod 3** | Schema Validation | Validates incoming request payloads (req.body) against strict schemas before controller logic. |
| **LexoRank** | Sorting Algorithm | Used to generate alphanumeric strings for drag-and-drop task ordering in the backlog without recalculating all rows. |
| **JWT (jsonwebtoken)** | Authentication | Stateless session management for the API. |
| **bcryptjs** | Password Hashing | Secure hashing for local email/password accounts. |
| **helmet & cors** | Security | Standard Express security middleware headers and cross-origin controls. |

---

## ☁️ Infrastructure & Services

| Service | Role | Usage |
|---|---|---|
| **Supabase Auth** | Identity Provider | Handles OAuth flows (GitHub, Google) securely without us managing the handshake. |
| **Supabase Storage** | File Storage | Stores avatar images, task attachments, and chat files in S3-compatible buckets. |
| **ngrok** | Local Tunneling | Exposes the local backend (`localhost:3001`) to the internet to receive GitHub Webhook payloads during development. |

---

## 🔮 Future / Planned Stack (Not Yet Wired)

The following technologies are present in the `package.json` and directory structure but are reserved for future phases:

*   **Background Jobs:** In-process queue in `workers/queue.ts` — SMTP invite emails and GitHub webhook event processing run off the request path with retry + exponential backoff. No external broker required, at the cost of durability: queued jobs are held in memory and are lost on restart.
*   **AI Integration:** Gemini-powered features live in `services/ai.service.ts` — sprint retrospective summaries + per-member contribution reports (posted to the project channel on sprint close) and task duration estimates. Disabled gracefully when `GEMINI_API_KEY` is unset.

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
