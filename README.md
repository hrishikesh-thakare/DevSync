<div align="center">
  <h1>🚀 DevSync</h1>
  <p><strong>The Unified Workspace for Agile Engineering Teams</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#testing">Testing</a> •
    <a href="#documentation">Documentation</a>
  </p>
</div>

---

DevSync is an enterprise-grade project management and real-time collaboration platform designed specifically for software development teams. By seamlessly integrating Kanban-style issue tracking, agile sprint management, and threaded chat channels into a single cohesive interface, DevSync eliminates context switching and accelerates team velocity.

## ✨ Features

- **Hierarchical Organization**: Structure your company with **Workspaces** and silo work into distinct **Projects**.
- **Agile Project Management**:
  - Interactive **Kanban Boards** with fluid drag-and-drop mechanics (`@dnd-kit`).
  - **Backlog, Roadmap, Calendar and Epic views** over a single ranked task list.
  - Native support for Epics, Stories, Tasks, Bugs, and Subtasks.
  - **Sprint Planning**: Time-boxed iterations with velocity tracking and backlog prioritization powered by LexoRank ordering.
- **Real-Time Communication**:
  - WebSockets-powered (`Socket.io`) instant messaging.
  - **Project-Scoped Channels** and Workspace-wide discussion rooms.
  - Threaded replies, direct messaging, and rich-text formatting.
- **Deep GitHub Integration**:
  - Connect repositories directly to projects.
  - Auto-link commits to tasks via smart commit messages.
  - Real-time CI/CD workflow monitoring directly from the Kanban board.
- **Enterprise-Grade Security**:
  - Two-layered **Role-Based Access Control (RBAC)** securing both Workspace (`Owner`, `Admin`, `Member`) and Project (`Project Admin`, `Developer`, `Viewer`) boundaries.
  - Short-lived JWTs (15 min) with revocable **refresh tokens** stored as HTTP-only cookies.
  - Secure OAuth 2.0 flows (Google & GitHub) via Supabase Auth.
  - Encrypted storage of GitHub tokens (AES-256-GCM), `helmet` hardening, rate limiting, and strict Zod validation on all inputs.

---

## 🛠 Tech Stack

DevSync is built on a modern, type-safe, monolithic architecture.

### Frontend
- **Framework**: React 19 + TypeScript + Vite 8 + React Router 7
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **State Management**: Zustand 5
- **Forms & Validation**: React Hook Form + Zod
- **Editor & UI**: `@dnd-kit` (Drag & Drop), Lucide Icons, Sonner (Toasts)
- **Real-time**: `socket.io-client`

### Backend
- **Runtime**: Node.js (ESM) + Express 5 + TypeScript
- **Database**: PostgreSQL (Managed by Supabase)
- **ORM**: Drizzle ORM v0.45
- **Real-time**: Socket.io v4
- **Auth**: JSON Web Tokens (JWT) + refresh tokens, bcrypt, Supabase OAuth
- **Security & Validation**: Zod, Helmet, express-rate-limit, AES-256-GCM encryption
- **Extras**: Nodemailer (SMTP), Gemini AI, GitHub & Google OAuth

---

## 🚀 Getting Started

Follow these instructions to set up DevSync locally for development and testing.

### Prerequisites
- Node.js (v20+)
- npm or yarn
- A [Supabase](https://supabase.com/) project (Database & Authentication)

### 1. Clone the repository
```bash
git clone https://github.com/your-org/devsync.git
cd devsync
```

### 2. Backend Setup
```bash
cd backend
npm install
```
Copy the example environment file and fill it in — every variable is documented inline, including which are required in production:
```bash
cp .env.example .env
```
The three you cannot skip locally are `DATABASE_URL`, `JWT_SECRET`, and `ENCRYPTION_KEY` (`openssl rand -hex 32`).

Apply migrations and start the server:
```bash
npm run db:migrate    # drizzle-kit, for local development
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install --legacy-peer-deps
```
Create a `.env` file in the `frontend/` directory:
```env
VITE_API_URL=http://localhost:3001/api
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```
Start the Vite development server:
```bash
npm run dev
```

### 4. Optional: Ngrok Setup (For GitHub Webhooks & Remote Testing)
To receive external GitHub webhooks (such as commit triggers or PR auto-linking) or share your local environment remotely, use [Ngrok](https://ngrok.com/):

1. Start your backend and frontend servers as described above.
2. In a separate terminal, expose your backend port (default `3001`):
   ```bash
   ngrok http 3001
   ```
3. Copy the generated `https://xxxx.ngrok-free.app` URL and update your backend GitHub webhook URL or `BACKEND_URL` in `backend/.env`.

---

## 🧪 Testing

DevSync ships with an extensive **Playwright E2E suite** (338 tests across 42 spec files) covering authentication & sessions, workspace/project/channel CRUD, sprint lifecycles, task management, and a rigorous RBAC matrix including cross-project isolation. 

There are also **38 backend unit tests** for critical utility code.

Backend unit tests cover the logic underneath that suite - encryption, cookie
attribute derivation, CORS matching, the retry queue, status transitions — and
need no database or running server:
```bash
cd backend && npm test
```

See [**`docs/e2e-test-suite.md`**](./docs/e2e-test-suite.md) for a complete breakdown of every test module.

---

## 📚 Documentation & Architecture

For deep dives into the system architecture, schema, and API contracts, please refer to the official documentation located in the `docs/` directory:

| Document | Description |
| :--- | :--- |
| [**Architecture & API**](./docs/backend-architecture.md) | Request lifecycle, RBAC enforcement, and complete API endpoint reference. |
| [**Database Schema**](./docs/schema.md) | Drizzle table definitions, relations, constraints, and ERD diagram. |
| [**Tech Stack**](./docs/tech-stack.md) | Detailed breakdown of technical choices and future architectural plans. |
| [**Navigation Flow**](./docs/navigation-flow.md) | Frontend routing topology and screen-by-screen feature inventory. |
| [**E2E Test Suite**](./docs/e2e-test-suite.md) | Complete inventory of the Playwright end-to-end tests and what they verify. |
| [**Migrations**](./docs/migrations.md) | Authoring migrations, the snapshot contract, and what Drizzle cannot describe. |
| [**Deployment**](./docs/deployment.md) | Supabase + API + static frontend, required environment, and the cross-site cookie trap. |

---

## 🧪 Testing credentials

The database comes pre-seeded with 20 distinct users designed to test every facet of the RBAC system across multiple projects.

Please see [**`test_users.md`**](./test_users.md) for the complete roster of testing accounts and recommended workflows.

*(Global Test Password: `Password123!`)*

---

<div align="center">
  <i>Built for the final year project submission.</i>
</div>