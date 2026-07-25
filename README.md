<div align="center">
  <h1>🚀 DevSync</h1>
  <p><strong>The Unified Workspace for Agile Engineering Teams</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#documentation">Documentation</a>
  </p>
</div>

---

DevSync is an enterprise-grade project management and real-time collaboration platform designed specifically for software development teams. By seamlessly integrating Kanban-style issue tracking, agile sprint management, and threaded chat channels into a single cohesive interface, DevSync eliminates context switching and accelerates team velocity.

## ✨ Features

- **Hierarchical Organization**: Structure your company with **Workspaces** and silo work into distinct **Projects**.
- **Agile Project Management**:
  - Interactive **Kanban Boards** with fluid drag-and-drop mechanics (`@dnd-kit`).
  - Native support for Epics, Stories, Tasks, Bugs, and Subtasks.
  - **Sprint Planning**: Time-boxed iterations with velocity tracking and backlog prioritization powered by LexoRank ordering.
- **Real-Time Communication**:
  - WebSockets-powered (`Socket.io`) instant messaging.
  - **Project-Scoped Channels** and Workspace-wide discussion rooms.
  - Threaded replies, direct messaging, and rich-text formatting (`Tiptap`).
- **Deep GitHub Integration**:
  - Connect repositories directly to projects.
  - Auto-link commits to tasks via smart commit messages.
  - Real-time CI/CD workflow monitoring directly from the Kanban board.
- **Enterprise-Grade Security**:
  - Two-layered **Role-Based Access Control (RBAC)** securing both Workspace (`Owner`, `Admin`, `Member`) and Project (`Project Admin`, `Developer`, `Viewer`) boundaries.
  - Secure OAuth 2.0 flows via Supabase Auth.

---

## 🛠 Tech Stack

DevSync is built on a modern, type-safe, monolithic architecture.

### Frontend
- **Framework**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS v4 + Framer Motion (Micro-animations)
- **State Management**: Zustand
- **Editor & UI**: Tiptap (Rich Text), `@dnd-kit` (Drag & Drop), Recharts
- **Real-time**: `socket.io-client`

### Backend
- **Runtime**: Node.js (ESM) + Express 5 + TypeScript
- **Database**: PostgreSQL (Managed by Supabase)
- **ORM**: Drizzle ORM v0.44
- **Real-time**: Socket.io v4
- **Security & Validation**: Zod, JSON Web Tokens (JWT), bcrypt

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
Create a `.env` file in the `backend/` directory based on the required environment variables:
```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
JWT_SECRET=your_super_secret_jwt_key
ENCRYPTION_KEY=32_byte_hex_string_for_aes_256_gcm
```
Run database migrations and start the server:
```bash
npm run db:push
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install --legacy-peer-deps
```
Create a `.env` file in the `frontend/` directory:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
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
2. In a separate terminal, expose your backend port (default `5000`):
   ```bash
   ngrok http 5000
   ```
3. Copy the generated `https://xxxx.ngrok-free.app` URL and update your backend GitHub webhook URL or `WEBHOOK_BASE_URL` in `backend/.env`.


---

## 📚 Documentation & Architecture

For deep dives into the system architecture, schema, and API contracts, please refer to the official documentation located in the `docs/` directory:

| Document | Description |
| :--- | :--- |
| [**Architecture & API**](./docs/backend-architecture.md) | Request lifecycle, RBAC enforcement, and complete API endpoint reference. |
| [**Database Schema**](./docs/schema.md) | Drizzle table definitions, relations, constraints, and ERD diagram. |
| [**Tech Stack**](./docs/tech-stack.md) | Detailed breakdown of technical choices and future architectural plans. |
| [**Navigation Flow**](./docs/navigation-flow.md) | Frontend routing topology and screen-by-screen feature inventory. |

---

## 🧪 Testing credentials

The database comes pre-seeded with 20 distinct users designed to test every facet of the RBAC system across multiple projects.

Please see [**`test_users.md`**](./test_users.md) for the complete roster of testing accounts and recommended workflows.

*(Global Test Password: `password123`)*

---

<div align="center">
  <i>Built for the final year project submission.</i>
</div>
