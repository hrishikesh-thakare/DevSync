import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { globalLimiter } from './middleware/rateLimit.js';

const app = express();

// ─── Global Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(globalLimiter);
// ─── Webhooks (Must be before express.json) ────────────────────────────────
import { githubWebhookRouter } from './modules/github/github.routes.js';
app.use('/api/webhooks/github', githubWebhookRouter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { resolveSlug, resolveProjectKey, resolveTaskKey } from './middleware/slugs.js';

// Register param resolvers globally
app.param('slug', resolveSlug);
app.param('key', resolveProjectKey);
app.param('taskKey', resolveTaskKey);

// ─── Route Modules (add as you build them) ───────────────────────────────────
import authRoutes from './modules/auth/auth.routes.js';
app.use('/api/auth', authRoutes);

import workspacesRoutes from './modules/workspaces/workspaces.routes.js';
app.use('/api/workspaces', workspacesRoutes);

import projectsRoutes from './modules/projects/projects.routes.js';
app.use('/api/workspaces/:slug/projects', projectsRoutes);

import tasksRoutes from './modules/tasks/tasks.routes.js';
app.use('/api/workspaces/:slug/projects/:key/tasks', tasksRoutes);

import sprintsRoutes from './modules/sprints/sprints.routes.js';
app.use('/api/workspaces/:slug/projects/:key/sprints', sprintsRoutes);

import channelsRoutes from './modules/channels/channels.routes.js';
app.use('/api/workspaces/:slug/channels', channelsRoutes);

import filesRoutes from './modules/files/files.routes.js';
app.use('/api/workspaces/:slug/files', filesRoutes);

// Messages routes moved to channels.routes.ts

import { githubConfigRouter, githubTaskRouter, githubUserRouter } from './modules/github/github.routes.js';
app.use('/api/workspaces/:slug/projects/:key/github', githubConfigRouter);
app.use('/api/workspaces/:slug/projects/:key/tasks/:taskKey/github', githubTaskRouter);
app.use('/api/github', githubUserRouter);

import searchRoutes from './modules/search/search.routes.js';
app.use('/api/workspaces/:slug/search', searchRoutes);

import notificationsRoutes from './modules/notifications/notifications.routes.js';
app.use('/api/notifications', notificationsRoutes);

import auditRoutes from './modules/audit/audit.routes.js';
app.use('/api/audit', auditRoutes);

import { createServer } from 'http';
import { initSocket } from './sockets/index.js';
import { registerWorkers } from './workers/index.js';

// ─── Start Server ────────────────────────────────────────────────────────────
const httpServer = createServer(app);

// Initialize Socket.io
initSocket(httpServer);

// Register background job workers (email delivery, GitHub webhook events)
registerWorkers();

httpServer.listen(env.PORT, () => {
  console.log(`🚀 DevSync backend running on http://localhost:${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
});

export default app;
