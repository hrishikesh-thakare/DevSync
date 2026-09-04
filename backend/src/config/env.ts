import 'dotenv/config';

/** `undefined` unless explicitly set, so a caller can tell "unset" from "false". */
const optionalBool = (raw: string | undefined): boolean | undefined =>
  raw === undefined || raw === '' ? undefined : raw === 'true';

export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL!,

  // Postgres connection tuning. Managed providers terminate idle connections and
  // cap how many a client may hold, and pooled connection strings (Supabase's
  // transaction pooler on :6543, PgBouncer generally) cannot serve the prepared
  // statements postgres-js issues by default — the first query fails outright.
  // Detected from the URL so the common cases need no configuration, with an
  // explicit override for the ones detection cannot see.
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '10', 10),
  DB_IDLE_TIMEOUT: parseInt(process.env.DB_IDLE_TIMEOUT || '20', 10),
  DB_CONNECT_TIMEOUT: parseInt(process.env.DB_CONNECT_TIMEOUT || '15', 10),
  DB_PREPARE: optionalBool(process.env.DB_PREPARE),
  DB_SSL: optionalBool(process.env.DB_SSL),

  // Auth
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',

  // OAuth
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  // Supabase (Storage & Auth Integrations)
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Zoom (Server-to-Server OAuth app) — used only to mint meetings for the
  // channel "Start call" button. Not a per-user/per-workspace OAuth flow:
  // one Zoom account (whoever owns these credentials) hosts every meeting;
  // anyone can still join the resulting link without their own Zoom account.
  ZOOM_ACCOUNT_ID: process.env.ZOOM_ACCOUNT_ID || '',
  ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID || '',
  ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET || '',

  // SMTP Email
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT || '',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_SECURE: process.env.SMTP_SECURE || '',
  SMTP_FROM: process.env.SMTP_FROM || '',

  // Real mail is only sent in production. Set this to 'true' to override that
  // for a deliberate local test — never leave it on, because the e2e seed
  // drives the live HTTP API and every seeded registration sends.
  SMTP_ALLOW_DEV: process.env.SMTP_ALLOW_DEV === 'true',

  // Hard ceiling on messages per calendar day. 0 uses the built-in default
  // (500 in production, matching Gmail's own free-tier limit; 25 elsewhere).
  SMTP_MAX_PER_DAY: parseInt(process.env.SMTP_MAX_PER_DAY || '0', 10) || 0,

  // Encryption (for GitHub tokens, secrets)
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',

  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001',

  // Extra browser origins allowed to call the API and open a socket, beyond
  // FRONTEND_URL. Comma-separated. Needed whenever more than one hostname
  // reaches the same frontend — apex vs www, a custom domain alongside the
  // platform one, or preview deployments.
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),

  // Refresh-cookie attributes. Both are derived from FRONTEND_URL/BACKEND_URL
  // when unset — see lib/cookies.ts. Set COOKIE_SAMESITE to lax|strict|none
  // only to override that derivation.
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE || '',
  COOKIE_SECURE: optionalBool(process.env.COOKIE_SECURE),

  // Reverse proxy hop count (Nginx, Load Balancer, Render/Railway, Cloudflare, etc.).
  // Express uses this to derive req.ip from X-Forwarded-For so rate limiting
  // and audit-log IPs see the real client, not the proxy. Set to the number of
  // trusted proxies in front of the app (1 = single proxy, the common case).
  TRUST_PROXY_HOPS: parseInt(process.env.TRUST_PROXY_HOPS || '1', 10),

  // Block sign-in until the email address is verified. On by default in
  // production (opt out with REQUIRE_EMAIL_VERIFICATION=false); opt in
  // explicitly anywhere else (the e2e suite sets it to 'true').
  REQUIRE_EMAIL_VERIFICATION:
    process.env.REQUIRE_EMAIL_VERIFICATION === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.REQUIRE_EMAIL_VERIFICATION !== 'false'),
} as const;

/**
 * Fail fast on a misconfigured production boot.
 *
 * Every one of these was previously a `!` assertion or an `|| ''` default, so a
 * missing value surfaced later as a confusing runtime error — an invalid JWT
 * signature, an "ENCRYPTION_KEY must be set" thrown mid-request when someone
 * connects GitHub, uploads silently landing on an ephemeral disk. A deploy that
 * cannot work should not accept traffic and pretend otherwise.
 */
const requiredInProduction: Array<[string, unknown]> = [
  ['DATABASE_URL', env.DATABASE_URL],
  ['JWT_SECRET', env.JWT_SECRET],
  ['ENCRYPTION_KEY', env.ENCRYPTION_KEY],
  ['SUPABASE_URL', env.SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY],
  ['FRONTEND_URL', process.env.FRONTEND_URL],
  ['BACKEND_URL', process.env.BACKEND_URL],
];

export const assertEnv = (): void => {
  const problems: string[] = [];

  if (!env.DATABASE_URL) problems.push('DATABASE_URL is required.');
  if (!env.JWT_SECRET) problems.push('JWT_SECRET is required.');

  if (env.NODE_ENV === 'production') {
    for (const [name, value] of requiredInProduction) {
      if (!value) problems.push(`${name} is required in production.`);
    }
    if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
      problems.push('JWT_SECRET must be at least 32 characters in production.');
    }
    if (env.ENCRYPTION_KEY && !/^[0-9a-f]{64}$/i.test(env.ENCRYPTION_KEY)) {
      problems.push('ENCRYPTION_KEY must be 64 hex characters (32 bytes) in production.');
    }
    if (env.SUPABASE_URL.includes('placeholder')) {
      problems.push(
        'SUPABASE_URL is still a placeholder. File uploads would fall back to local disk, ' +
          'which is wiped on every restart on a managed host.'
      );
    }
  }

  if (problems.length) {
    console.error('\n❌ Invalid environment configuration:\n' + problems.map((p) => `   • ${p}`).join('\n') + '\n');
    process.exit(1);
  }
};
