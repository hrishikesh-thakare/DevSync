import { describe, it, expect, vi } from 'vitest';

const load = async (vars: Record<string, string | undefined>) => {
  vi.resetModules();
  process.env.DATABASE_URL ||= 'postgres://localhost:5432/none';
  process.env.JWT_SECRET ||= 'test-secret-that-is-at-least-32-chars-long';
  for (const key of ['FRONTEND_URL', 'CORS_ORIGINS', 'NODE_ENV']) delete process.env[key];
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) process.env[key] = value;
  }
  return import('./cors.js');
};

const PROD = {
  FRONTEND_URL: 'https://devsync.vercel.app',
  NODE_ENV: 'production',
};

describe('isAllowedOrigin', () => {
  it('allows the configured frontend origin', async () => {
    const { isAllowedOrigin } = await load(PROD);
    expect(isAllowedOrigin('https://devsync.vercel.app')).toBe(true);
  });

  it('allows additional origins from CORS_ORIGINS', async () => {
    const { isAllowedOrigin } = await load({
      ...PROD,
      CORS_ORIGINS: 'https://www.devsync.io, https://devsync.io',
    });
    expect(isAllowedOrigin('https://www.devsync.io')).toBe(true);
    expect(isAllowedOrigin('https://devsync.io')).toBe(true);
  });

  it('ignores a trailing slash on either side', async () => {
    const { isAllowedOrigin } = await load({ ...PROD, FRONTEND_URL: 'https://devsync.io/' });
    expect(isAllowedOrigin('https://devsync.io')).toBe(true);
    expect(isAllowedOrigin('https://devsync.io/')).toBe(true);
  });

  it('rejects an unlisted origin', async () => {
    const { isAllowedOrigin } = await load(PROD);
    expect(isAllowedOrigin('https://evil.example.com')).toBe(false);
  });

  it('rejects a lookalike that merely starts with an allowed origin', async () => {
    const { isAllowedOrigin } = await load(PROD);
    expect(isAllowedOrigin('https://devsync.vercel.app.evil.com')).toBe(false);
  });

  it('allows requests with no Origin header', async () => {
    // curl, server-to-server, and same-origin navigations send none; CORS was
    // never the mechanism protecting those.
    const { isAllowedOrigin } = await load(PROD);
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it('allows localhost in development but not in production', async () => {
    const dev = await load({ FRONTEND_URL: 'http://localhost:5173', NODE_ENV: 'development' });
    expect(dev.isAllowedOrigin('http://localhost:4173')).toBe(true);
    expect(dev.isAllowedOrigin('http://127.0.0.1:3000')).toBe(true);

    const prod = await load(PROD);
    expect(prod.isAllowedOrigin('http://localhost:5173')).toBe(false);
  });
});

describe('corsOrigin callback', () => {
  it('calls back with true for an allowed origin', async () => {
    const { corsOrigin } = await load(PROD);
    const cb = vi.fn();
    corsOrigin('https://devsync.vercel.app', cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('calls back with an error for a rejected origin', async () => {
    const { corsOrigin } = await load(PROD);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cb = vi.fn();
    corsOrigin('https://evil.example.com', cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
