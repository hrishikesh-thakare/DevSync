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

  // SMTP Email
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT || '',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_SECURE: process.env.SMTP_SECURE || '',
  SMTP_FROM: process.env.SMTP_FROM || '',

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
} as const;
