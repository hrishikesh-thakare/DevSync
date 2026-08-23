import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { globalLimiter } from './middleware/rateLimit.js';

const app = express();

// Trust the configured number of reverse proxies so req.ip reflects the real
// client IP (X-Forwarded-For) instead of the proxy's internal address. Rate
// limiters and audit-log IPs depend on this; without it, every user behind a
// proxy shares one bucket and a single burst can lock out everyone.
app.set('trust proxy', env.TRUST_PROXY_HOPS);

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

// 1mb everywhere by default. The 50mb ceiling exists only for the two endpoints
// that carry a base64-encoded file in the JSON body; applying it globally meant
// every route on the API would buffer a 50mb payload before rejecting it.
app.use(/^\/api\/workspaces\/[^/]+\/(files\/upload|projects\/[^/]+\/tasks\/[^/]+\/attachments)$/, express.json({ limit: '50mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
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

import projectsRoutes from './modules/projects/projects.routes.js';
app.use('/api/workspaces/:slug/projects', projectsRoutes);

import tasksRoutes from './modules/tasks/tasks.routes.js';
app.use('/api/workspaces/:slug/projects/:key/tasks', tasksRoutes);

import sprintsRoutes from './modules/sprints/sprints.routes.js';
app.use('/api/workspaces/:slug/projects/:key/sprints', sprintsRoutes);

import labelsRoutes from './modules/labels/labels.routes.js';
app.use('/api/workspaces/:slug/projects/:key/labels', labelsRoutes);

import channelsRoutes from './modules/channels/channels.routes.js';
app.use('/api/workspaces/:slug/channels', channelsRoutes);

import filesRoutes from './modules/files/files.routes.js';
app.use('/api/workspaces/:slug/files', filesRoutes);

import workspacesRoutes from './modules/workspaces/workspaces.routes.js';
app.use('/api/workspaces', workspacesRoutes);

// Messages routes moved to channels.routes.ts

import { githubConfigRouter, githubTaskRouter, githubUserRouter } from './modules/github/github.routes.js';
app.use('/api/workspaces/:slug/projects/:key/github', githubConfigRouter);
app.use('/api/workspaces/:slug/projects/:key/tasks/:taskKey/github', githubTaskRouter);
app.use('/api/github', githubUserRouter);

import searchRoutes from './modules/search/search.routes.js';
app.use('/api/workspaces/:slug/search', searchRoutes);

import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
app.use('/api/workspaces/:slug/dashboard', dashboardRoutes);

import notificationsRoutes from './modules/notifications/notifications.routes.js';
app.use('/api/notifications', notificationsRoutes);

import auditRoutes from './modules/audit/audit.routes.js';
app.use('/api/audit', auditRoutes);

// ─── 404 + Error handling (must be registered after every route) ─────────────
//
// Without these, Express's built-in handlers answer with an HTML page. In
// development that page embeds the stack trace *and absolute filesystem paths*
// (`D:\Final-Yr-Project\DevSync\backend\node_modules\...`), and in every
// environment it breaks clients that expect JSON.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // A malformed JSON body surfaces here as a SyntaxError from body-parser.
  const status = typeof err?.status === 'number' ? err.status : 500;

  if (status >= 500) {
    console.error('Unhandled error:', err);
  }

  res.status(status).json({
    error:
      status === 400 && err instanceof SyntaxError
        ? 'Malformed JSON body.'
        : status < 500
          ? err?.message || 'Request could not be processed.'
          : 'Internal server error.',
  });
});

import { createServer } from 'http';
import { initSocket, getIO } from './sockets/index.js';
import { registerWorkers, shutdownQueue } from './workers/index.js';
import { queryClient } from './config/db.js';

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 ${signal} received, starting graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Close Socket.io connections
  try {
    const io = getIO();
    io.close(() => {
      console.log('✅ Socket.io closed');
    });
  } catch {
    // Socket.io may not be initialized
  }

  // Drain background job queue
  shutdownQueue();
  console.log('✅ Job queue drained');

  // Close database connection
  try {
    await queryClient.end({ timeout: 5 });
    console.log('✅ Database connection closed');
  } catch (err) {
    console.error('❌ Database close error:', err);
  }

  // Force exit after timeout
  setTimeout(() => {
    console.error('⏱️  Shutdown timeout, forcing exit');
    process.exit(1);
  }, 10_000).unref();

  // Exit cleanly once all handles are closed
  process.on('exit', () => {
    console.log('👋 Graceful shutdown complete');
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A rejected promise with no catch would otherwise terminate the process in
// modern Node — one failing background job taking the whole API down. Route
// errors never reach here; the Express error handler above catches those.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

// An uncaught exception leaves application state unknowable, so the only safe
// response is to drain and exit — a process manager (or `npm run dev`) restarts
// from a clean slate. Logging and carrying on would risk serving corrupt data.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception — shutting down:', err);
  void shutdown('uncaughtException').finally(() => process.exit(1));
});

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
