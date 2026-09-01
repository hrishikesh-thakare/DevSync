import { env } from './env.js';

/**
 * Origins the browser may call the API (and open a socket) from.
 *
 * Previously this was the single `FRONTEND_URL` string, which breaks the moment
 * more than one hostname reaches the same frontend: apex alongside www, a
 * custom domain alongside the platform one (`*.vercel.app`), or a preview
 * deployment. Each of those is a different origin, and a mismatch fails as an
 * opaque CORS error in the browser with nothing in the server log.
 */
const configured = new Set(
  [env.FRONTEND_URL, ...env.CORS_ORIGINS].map((o) => o.replace(/\/$/, '')).filter(Boolean)
);

// Local dev tooling: the Vite server, the Playwright runs, and previews served
// on a neighbouring port. Never trusted in production.
const devOrigins = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export const allowedOrigins = [...configured];

export const isAllowedOrigin = (origin: string | undefined): boolean => {
  // Same-origin requests, curl, and server-to-server calls send no Origin at
  // all. Those were never subject to CORS in the first place.
  if (!origin) return true;

  const normalized = origin.replace(/\/$/, '');
  if (configured.has(normalized)) return true;
  if (env.NODE_ENV !== 'production' && devOrigins.test(normalized)) return true;

  return false;
};

/** The `origin` callback shape shared by the `cors` middleware and Socket.io. */
export const corsOrigin = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void => {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }
  // Logged, because the browser-side symptom names neither the origin nor the
  // allowlist and this is otherwise very hard to diagnose from a deploy.
  console.warn(`CORS: rejected origin ${origin}. Allowed: ${allowedOrigins.join(', ') || '(none)'}`);
  callback(new Error('Not allowed by CORS'));
};
