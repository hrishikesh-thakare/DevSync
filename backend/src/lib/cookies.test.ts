import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The regression these guard against: with `SameSite=Lax`, a browser does not
 * attach the refresh cookie to a cross-site `POST /auth/refresh`, so every user
 * on a split-domain deployment is signed out 15 minutes after logging in.
 */
const load = async (vars: Record<string, string | undefined>) => {
  vi.resetModules();
  process.env.DATABASE_URL ||= 'postgres://localhost:5432/none';
  process.env.JWT_SECRET ||= 'test-secret-that-is-at-least-32-chars-long';
  for (const key of ['FRONTEND_URL', 'BACKEND_URL', 'NODE_ENV', 'COOKIE_SAMESITE', 'COOKIE_SECURE']) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) process.env[key] = value;
  }
  return import('./cookies.js');
};

beforeEach(() => {
  vi.resetModules();
});

describe('refreshCookieOptions', () => {
  it('uses Lax for a same-origin local dev setup', async () => {
    const { refreshCookieOptions } = await load({
      FRONTEND_URL: 'http://localhost:5173',
      BACKEND_URL: 'http://localhost:3001',
      NODE_ENV: 'development',
    });
    const opts = refreshCookieOptions();
    expect(opts.sameSite).toBe('lax');
    // Plain http in dev: a Secure cookie would never be stored at all.
    expect(opts.secure).toBe(false);
    expect(opts.httpOnly).toBe(true);
  });

  it('uses Lax when both apps share a registrable domain', async () => {
    const { refreshCookieOptions } = await load({
      FRONTEND_URL: 'https://app.devsync.io',
      BACKEND_URL: 'https://api.devsync.io',
      NODE_ENV: 'production',
    });
    const opts = refreshCookieOptions();
    expect(opts.sameSite).toBe('lax');
    expect(opts.secure).toBe(true);
  });

  it('uses None + Secure for the split-host production deployment', async () => {
    const { refreshCookieOptions } = await load({
      FRONTEND_URL: 'https://devsync.vercel.app',
      BACKEND_URL: 'https://devsync-api.onrender.com',
      NODE_ENV: 'production',
    });
    const opts = refreshCookieOptions();
    expect(opts.sameSite).toBe('none');
    expect(opts.secure).toBe(true);
  });

  it('stays on Lax when the API is not served over https', async () => {
    // A local setup whose BACKEND_URL points at an ngrok tunnel for GitHub
    // webhooks is cross-site by hostname, but a Secure cookie cannot be
    // delivered over the plain-http dev server, so None would break login.
    const { refreshCookieOptions } = await load({
      FRONTEND_URL: 'http://localhost:5173',
      BACKEND_URL: 'http://some-tunnel.ngrok-free.dev',
      NODE_ENV: 'development',
    });
    expect(refreshCookieOptions().sameSite).toBe('lax');
  });

  it('treats a multi-part public suffix as one site', async () => {
    const { refreshCookieOptions } = await load({
      FRONTEND_URL: 'https://app.devsync.co.uk',
      BACKEND_URL: 'https://api.devsync.co.uk',
      NODE_ENV: 'production',
    });
    expect(refreshCookieOptions().sameSite).toBe('lax');
  });

  it('honours an explicit COOKIE_SAMESITE override', async () => {
    const { refreshCookieOptions } = await load({
      FRONTEND_URL: 'https://devsync.vercel.app',
      BACKEND_URL: 'https://devsync-api.onrender.com',
      NODE_ENV: 'production',
      COOKIE_SAMESITE: 'lax',
      COOKIE_SECURE: 'true',
    });
    expect(refreshCookieOptions().sameSite).toBe('lax');
  });

  it('never emits SameSite=None without Secure', async () => {
    // Browsers reject that combination outright, so the override must not be
    // able to produce a cookie that is silently never stored.
    const { refreshCookieOptions } = await load({
      FRONTEND_URL: 'https://devsync.vercel.app',
      BACKEND_URL: 'https://devsync-api.onrender.com',
      NODE_ENV: 'production',
      COOKIE_SAMESITE: 'none',
      COOKIE_SECURE: 'false',
    });
    const opts = refreshCookieOptions();
    expect(opts.sameSite).toBe('none');
    expect(opts.secure).toBe(true);
  });

  it('clear options mirror the set options so the cookie actually clears', async () => {
    const { refreshCookieOptions, clearRefreshCookieOptions } = await load({
      FRONTEND_URL: 'https://devsync.vercel.app',
      BACKEND_URL: 'https://devsync-api.onrender.com',
      NODE_ENV: 'production',
    });
    const { maxAge, ...set } = refreshCookieOptions();
    expect(clearRefreshCookieOptions()).toEqual(set);
    expect(maxAge).toBeGreaterThan(0);
  });
});
