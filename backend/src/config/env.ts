import 'dotenv/config';

export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL!,

  // Auth
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // OAuth
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
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
