# DevSync Frontend

The frontend for DevSync is built with React 19, Vite 8, and TypeScript. It provides a highly responsive, real-time SPA for workspace and project management.

## 🛠 Tech Stack

- **Framework**: React 19 + TypeScript + Vite 8
- **Routing**: React Router 7
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui
- **State Management**: Zustand 5
- **Forms & Validation**: React Hook Form + Zod
- **Drag & Drop**: `@dnd-kit`
- **Icons**: Lucide React
- **Real-time**: `socket.io-client`

## 🚀 Development Setup

1. Ensure you have the backend running first (see `../README.md`).
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Create a `.env` file in this directory based on the `.env.example` or with the following variables:
   ```env
   VITE_API_URL=http://localhost:3001/api
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## 🏗️ Architecture Overview

For details about the frontend routing structure, screen inventory, and RBAC rules, please refer to the `docs/navigation-flow.md` document in the root directory.
